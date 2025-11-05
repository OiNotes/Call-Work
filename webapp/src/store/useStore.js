import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { mockShops, mockSubscriptions, mockUser } from '../utils/mockData';
import { useToastStore } from '../hooks/useToast';

export const normalizeProduct = (product) => {
  const rawStock = product?.stock_quantity ?? product?.stock ?? 0;
  const price = typeof product?.price === 'number' ? product.price : Number(product?.price) || 0;
  const isAvailable = product?.is_available ?? product?.isActive ?? true;
  const isPreorder = isAvailable && rawStock <= 0;
  const availability = !isAvailable
    ? 'unavailable'
    : isPreorder
      ? 'preorder'
      : 'stock';

  return {
    ...product,
    price,
    stock: rawStock,
    stock_quantity: rawStock,
    is_available: isAvailable,
    isAvailable,
    currency: product?.currency || 'USD',
    image: product?.image || product?.images?.[0] || null,
    isPreorder,
    availability,
    // Явно сохраняем поля скидок
    original_price: product?.original_price ?? null,
    discount_percentage: product?.discount_percentage ?? 0,
    discount_expires_at: product?.discount_expires_at ?? null,
  };
};

/**
 * Normalize order data from API (PostgreSQL DECIMAL fields come as strings)
 * @param {Object} order - Raw order from API
 * @returns {Object} Normalized order with numeric fields
 */
export const normalizeOrder = (order) => {
  if (!order) return null;

  // Convert PostgreSQL DECIMAL strings to numbers
  const totalPrice = typeof order.total_price === 'number'
    ? order.total_price
    : parseFloat(order.total_price) || 0;

  const total = typeof order.total === 'number'
    ? order.total
    : parseFloat(order.total) || 0;

  const quantity = typeof order.quantity === 'number'
    ? order.quantity
    : parseInt(order.quantity, 10) || 1;

  return {
    ...order,
    total_price: totalPrice,
    total: total,
    quantity: quantity,
  };
};

export const useStore = create(
  persist(
    (set, get) => ({
      // User data
      user: mockUser,
      setUser: (user) => set({ user }),

      // Auth token
      token: null,
      setToken: (token) => {
        set({ token });
        // Configure axios default header
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
          delete axios.defaults.headers.common['Authorization'];
        }
      },

      // Cart
      cart: [],
      addToCart: (product) => {
        const { cart: currentCart, currentShop, productsShopId } = get();
        const existingItem = currentCart.find(item => item.id === product.id);

        if (existingItem) {
          set({
            cart: currentCart.map(item =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          });
        } else {
          // Сохраняем shopId вместе с товаром для восстановления currentShop при checkout
          const shopId = currentShop?.id || product.shop_id || product.shopId || productsShopId;

          if (!shopId) {
            console.error('[addToCart] CRITICAL: Cannot add to cart - shopId missing!', product);
            const toast = useToastStore.getState().addToast;
            toast({ type: 'error', message: 'Ошибка: товар без магазина', duration: 3000 });
            return;
          }

          set({ cart: [...currentCart, { ...product, quantity: 1, shopId }] });
        }
      },

      removeFromCart: (productId) => {
        set({ cart: get().cart.filter(item => item.id !== productId) });
      },

      updateCartQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(productId);
          return;
        }

        set({
          cart: get().cart.map(item =>
            item.id === productId
              ? { ...item, quantity }
              : item
          )
        });
      },

      clearCart: () => set({ cart: [] }),

      getCartTotal: () => {
        return get().cart.reduce((total, item) => total + (item.price * item.quantity), 0);
      },

      getCartCount: () => {
        return get().cart.reduce((total, item) => total + item.quantity, 0);
      },

      // Shops
      shops: mockShops,
      setShops: (shops) => set({ shops }),

      // Products
      products: [],
      productsShopId: null,
      setProducts: (products, shopId = null) => {
        const normalized = Array.isArray(products) ? products.map(normalizeProduct) : [];
        set({ products: normalized, productsShopId: shopId });
      },

      // Current shop
      currentShop: null,
      setCurrentShop: (shop) => set({ currentShop: shop }),

      // Subscriptions
      subscriptions: mockSubscriptions,
      setSubscriptions: (subscriptions) => set({ subscriptions }),

      // UI State
      isCartOpen: false,
      setCartOpen: (isOpen) => set({ isCartOpen: isOpen }),

      activeTab: 'subscriptions',
      setActiveTab: (tab) => set({ activeTab: tab }),

      hasFollows: false,
      setHasFollows: (value) => set({ hasFollows: Boolean(value) }),

      // Payment State
      currentOrder: null,
      selectedCrypto: null,
      paymentStep: 'idle',
      pendingOrders: [],
      paymentWallet: null,
      cryptoAmount: 0,
      invoiceExpiresAt: null,
      isVerifying: false,
      verifyError: null,
      isCreatingOrder: false,
      isGeneratingInvoice: false,

      // Payment Actions
      startCheckout: () => {
        const { cart, shops } = get();
        const toast = useToastStore.getState().addToast;

        if (cart.length === 0) {
          console.warn('[startCheckout] Cannot checkout: cart is empty');
          toast({ type: 'warning', message: 'Корзина пуста', duration: 2500 });
          return;
        }

        // Получить shopId из первого товара в корзине
        const shopId = cart[0]?.shopId;

        if (!shopId) {
          console.error('[startCheckout] CRITICAL: Cannot checkout - shopId missing!');
          console.error('[startCheckout] Cart item:', cart[0]);
          
          toast({ 
            type: 'error', 
            message: 'Ошибка оформления заказа. Очистите корзину и попробуйте снова.', 
            duration: 4000 
          });
          
          // Открыть обратно корзину, чтобы пользователь мог что-то сделать
          set({ isCartOpen: true });
          return;
        }

        // Найти shop в shops list или создать минимальный объект
        let shop = shops?.find(s => s.id === shopId);

        if (!shop) {
          console.warn(`[startCheckout] Shop ${shopId} not found in shops list, creating minimal shop object`);
          shop = { id: shopId, name: 'Shop' };
        }

        console.log('[startCheckout] Setting currentShop:', shop);

        set({
          currentShop: shop,
          paymentStep: 'method'
        });
      },

      createOrder: async () => {
        const { cart, user } = get();

        if (cart.length === 0) return null;

        set({ isCreatingOrder: true });

        let timeoutId; // ✅ Moved BEFORE try block for finally access
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
          const initData = window.Telegram?.WebApp?.initData || '';
          const item = cart[0];

          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), 15000);

          const response = await axios.post(`${API_URL}/orders`, {
            productId: item.id,
            quantity: item.quantity,
            deliveryAddress: null
          }, {
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': initData
            },
            signal: controller.signal
          });

          // Normalize order (PostgreSQL DECIMAL fields come as strings)
          const order = normalizeOrder(response.data.data);
          set({
            currentOrder: order
          });

          return order;
        } catch (error) {
          console.error('Create order error:', error);
          
          const toast = useToastStore.getState().addToast;
          
          if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
            toast({ type: 'error', message: 'Timeout: проверьте соединение', duration: 3500 });
          } else if (error.response?.status === 401) {
            toast({ type: 'error', message: 'Ошибка авторизации', duration: 3000 });
          } else {
            toast({ type: 'error', message: 'Не удалось создать заказ', duration: 3000 });
          }

          throw error;
        } finally {
          // CRITICAL: Always cleanup timeout and reset loading state
          if (timeoutId) clearTimeout(timeoutId);
          set({ isCreatingOrder: false });
        }
      },

      // ✅ Use closure for synchronous lock to prevent race condition on fast double-clicks
      selectCrypto: (() => {
        let invoiceInProgress = false; // Synchronous lock

        return async (crypto) => {
          const { currentOrder, user, isGeneratingInvoice } = get();
          const toast = useToastStore.getState().addToast;

          // Check BOTH store state AND closure variable
          if (isGeneratingInvoice || invoiceInProgress) {
            console.warn('[selectCrypto] Already generating invoice, ignoring');
            return;
          }

          // Set BOTH locks IMMEDIATELY (synchronous)
          invoiceInProgress = true;
          set({
            selectedCrypto: crypto,
            isGeneratingInvoice: true
          });

        try {
          // Create order if not exists
          let order = currentOrder;
          if (!order) {
            order = await get().createOrder();
            if (!order) {
              const errorMsg = 'Не удалось создать заказ';
              toast({ type: 'error', message: errorMsg, duration: 3000 });
              throw new Error('Failed to create order');
            }
          }

          // Generate invoice
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
          const response = await axios.post(
            `${API_URL}/orders/${order.id}/invoice`,
            { currency: crypto },
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          const invoice = response.data.data;

          // Ensure cryptoAmount is NUMBER (backend might return string from PostgreSQL)
          const cryptoAmount = parseFloat(invoice.cryptoAmount);
          if (!isFinite(cryptoAmount) || cryptoAmount <= 0) {
            const errorMsg = 'Некорректная сумма от сервера';
            toast({ type: 'error', message: errorMsg, duration: 3000 });
            throw new Error('Invalid cryptoAmount from API');
          }

          set({
            paymentWallet: invoice.address,
            cryptoAmount,
            invoiceExpiresAt: invoice.expiresAt,
            paymentStep: 'details'
          });
        } catch (error) {
          console.error('Generate invoice error:', error);

          // Детальные toast сообщения
          const errorMsg = error.response?.data?.error || error.message;
          if (errorMsg?.includes('order')) {
            toast({ type: 'error', message: 'Не удалось создать заказ', duration: 3500 });
          } else if (errorMsg?.includes('wallet') || errorMsg?.includes('address')) {
            toast({ type: 'error', message: 'Кошелёк недоступен. Обратитесь к продавцу.', duration: 3500 });
          } else if (errorMsg?.includes('timeout') || errorMsg?.includes('network')) {
            toast({ type: 'error', message: 'Проблема с соединением. Попробуйте снова.', duration: 3500 });
          } else if (errorMsg?.includes('expired')) {
            toast({ type: 'error', message: 'Заказ истёк. Создайте новый.', duration: 3500 });
          } else {
            toast({ type: 'error', message: 'Ошибка генерации счёта', duration: 3000 });
          }

          set({
            paymentStep: 'method', // Вернуть на выбор метода при ошибке
            verifyError: error.response?.data?.error || 'Ошибка генерации invoice'
          });
          throw error;
        } finally {
          // CRITICAL: Always reset loading state, even on unhandled errors
          invoiceInProgress = false; // Reset synchronous lock
          set({ isGeneratingInvoice: false });
        }
      };
      })(), // End of closure IIFE

      submitPaymentHash: async (hash) => {
        const { currentOrder, selectedCrypto, user } = get();
        const toast = useToastStore.getState().addToast;

        if (!currentOrder) {
          toast({ type: 'error', message: 'Заказ не найден', duration: 3000 });
          return;
        }

        set({ isVerifying: true, verifyError: null });

        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
          const response = await axios.post(
            `${API_URL}/payments/verify`,
            {
              orderId: currentOrder.id,
              txHash: hash,
              currency: selectedCrypto
            },
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.data.success) {
            // Normalize order before saving to pendingOrders
            const completedOrder = normalizeOrder({
              ...currentOrder,
              crypto: selectedCrypto,
              txHash: hash,
              status: 'confirmed',
              submittedAt: new Date().toISOString()
            });

            set({
              pendingOrders: [...get().pendingOrders, completedOrder],
              paymentStep: 'success'
            });

            // Clear cart
            get().clearCart();

            // Success toast
            toast({ type: 'success', message: 'Платёж подтверждён!', duration: 3500 });
          }
        } catch (error) {
          console.error('Verify payment error:', error);

          // Детальные toast сообщения для разных ошибок
          const errorMsg = error.response?.data?.error || error.message;
          const statusCode = error.response?.status;

          if (statusCode === 404) {
            toast({ type: 'error', message: 'Транзакция не найдена в блокчейне', duration: 4000 });
          } else if (errorMsg?.includes('confirmation')) {
            toast({ type: 'warning', message: 'Недостаточно подтверждений. Ожидайте...', duration: 4000 });
          } else if (errorMsg?.includes('amount') || errorMsg?.includes('сумма')) {
            toast({ type: 'error', message: 'Неверная сумма транзакции', duration: 3500 });
          } else if (errorMsg?.includes('address') || errorMsg?.includes('wallet')) {
            toast({ type: 'error', message: 'Неверный адрес получателя', duration: 3500 });
          } else if (errorMsg?.includes('expired')) {
            toast({ type: 'error', message: 'Счёт истёк. Создайте новый заказ.', duration: 4000 });
          } else if (errorMsg?.includes('timeout') || errorMsg?.includes('network')) {
            toast({ type: 'error', message: 'Проблема с соединением. Попробуйте снова.', duration: 3500 });
          } else if (errorMsg?.includes('invalid') || errorMsg?.includes('hash')) {
            toast({ type: 'error', message: 'Некорректный hash транзакции', duration: 3500 });
          } else {
            toast({ type: 'error', message: 'Ошибка проверки платежа', duration: 3000 });
          }

          set({
            verifyError: error.response?.data?.error || 'Ошибка проверки платежа'
          });
        } finally {
          // CRITICAL: Always reset loading state
          set({ isVerifying: false });
        }
      },

      // Universal payment flow reset with options
      resetPaymentFlow: (options = {}) => {
        const {
          clearCart = false,           // Clear shopping cart?
          clearPendingOrders = false,  // Clear order history?
          keepOrder = false,           // Keep currentOrder for retry?
          reason = 'manual'            // 'manual', 'success', 'error', 'timeout'
        } = options;

        // Logging for debugging
        if (import.meta.env.DEV) {
          console.log(`[resetPaymentFlow] Reason: ${reason}`, {
            clearCart,
            clearPendingOrders,
            keepOrder,
            currentState: {
              paymentStep: get().paymentStep,
              hasOrder: !!get().currentOrder,
              hasCrypto: !!get().selectedCrypto
            }
          });
        }

        // Clear cart if requested
        if (clearCart) {
          get().clearCart();
        }

        // Full payment state cleanup
        set({
          // Order data
          currentOrder: keepOrder ? get().currentOrder : null,
          selectedCrypto: null,

          // Flow control
          paymentStep: 'idle',

          // Payment details
          paymentWallet: null,
          cryptoAmount: 0,
          invoiceExpiresAt: null,

          // Loading states (CRITICAL to reset!)
          isCreatingOrder: false,
          isGeneratingInvoice: false,
          isVerifying: false,

          // Errors
          verifyError: null,

          // History (optional)
          ...(clearPendingOrders ? { pendingOrders: [] } : {})
        });
      },

      clearCheckout: () => {
        // Use universal reset function
        get().resetPaymentFlow({ clearCart: true, reason: 'manual' });
      },

      setPaymentStep: (step) => set({ paymentStep: step }),

      removePendingOrder: (orderId) => {
        set({
          pendingOrders: get().pendingOrders.filter(order => order.id !== orderId)
        });
      },

      // Wallets
      wallets: [],
      addWallet: (wallet) => set({ wallets: [...get().wallets, wallet] }),
      removeWallet: (address) => set({ wallets: get().wallets.filter(w => w.address !== address) }),

      // Language
      language: 'ru',
      setLanguage: (lang) => set({ language: lang }),

      // WebSocket actions
      refetchProducts: async (shopId) => {
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
          const response = await axios.get(`${API_URL}/products`, {
            params: { shopId }
          });

          const payload = Array.isArray(response.data?.data) ? response.data.data : [];
          const normalized = payload.map(normalizeProduct);
          const { currentShop, productsShopId } = get();
          const shouldUpdate = currentShop?.id === shopId || productsShopId === shopId;

          if (shouldUpdate) {
            set({ products: normalized, productsShopId: shopId });
          }
        } catch (error) {
          // Error handled silently
        }
      },

      updateOrderStatus: (orderId, status) => {
        set((state) => ({
          orders: state.orders?.map(order =>
            order.id === orderId ? { ...order, status } : order
          ),
          currentOrder: state.currentOrder?.id === orderId
            ? { ...state.currentOrder, status }
            : state.currentOrder
        }));
      },

      incrementSubscribers: (shopId) => {
        set((state) => ({
          shops: state.shops.map(shop =>
            shop.id === shopId
              ? { ...shop, subscriber_count: (shop.subscriber_count || 0) + 1 }
              : shop
          ),
          subscriptions: state.subscriptions.map(sub =>
            sub.id === shopId
              ? { ...sub, subscriber_count: (sub.subscriber_count || 0) + 1 }
              : sub
          )
        }));
      },

      // Follow Detail Navigation
      followDetailId: null,
      setFollowDetailId: (id) => set({ followDetailId: id }),

      // Current Follow Data
      currentFollow: null,
      setCurrentFollow: (follow) => set({ currentFollow: follow }),

      // Follow Products
      followProducts: [],
      setFollowProducts: (products) => set({ followProducts: products })
    }),
    {
      name: 'status-stock-storage',
      partialize: (state) => ({
        pendingOrders: state.pendingOrders
      })
    }
  )
);
