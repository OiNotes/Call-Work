import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { mockSubscriptions, mockUser } from '../utils/mockData';
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
        const toast = useToastStore.getState().addToast;
        const existingItem = currentCart.find(item => item.id === product.id);

        if (existingItem) {
          // ✅ STOCK VALIDATION: Check if can increase quantity
          const newQuantity = existingItem.quantity + 1;
          const stock = existingItem.stock_quantity || existingItem.stock || 0;
          const isPreorder = existingItem.isPreorder || existingItem.availability === 'preorder';
          
          // Allow unlimited quantity for preorders
          if (!isPreorder && newQuantity > stock) {
            console.warn('[addToCart] Cannot add more - stock limit reached:', { product: existingItem.name, stock, requested: newQuantity });
            toast({ 
              type: 'warning', 
              message: `Максимум ${stock} шт. в наличии`, 
              duration: 2500 
            });
            return; // Don't add
          }
          
          set({
            cart: currentCart.map(item =>
              item.id === product.id
                ? { ...item, quantity: newQuantity }
                : item
            ),
            // ✅ FIX: Clear stale order when cart changes
            currentOrder: null
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

          set({ 
            cart: [...currentCart, { ...product, quantity: 1, shopId }],
            // ✅ FIX: Clear stale order when cart changes
            currentOrder: null
          });
        }
        
        console.log('[addToCart] Product added, currentOrder cleared');
      },

      removeFromCart: (productId) => {
        set({ 
          cart: get().cart.filter(item => item.id !== productId),
          // ✅ FIX: Clear stale order when cart changes
          currentOrder: null
        });
        
        console.log('[removeFromCart] Product removed, currentOrder cleared');
      },

      updateCartQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(productId);
          return;
        }

        const toast = useToastStore.getState().addToast;
        const { cart } = get();
        const item = cart.find(i => i.id === productId);
        
        if (item) {
          // ✅ STOCK VALIDATION: Check if quantity exceeds stock
          const stock = item.stock_quantity || item.stock || 0;
          const isPreorder = item.isPreorder || item.availability === 'preorder';
          
          // Allow unlimited quantity for preorders
          if (!isPreorder && quantity > stock) {
            console.warn('[updateCartQuantity] Quantity exceeds stock:', { product: item.name, stock, requested: quantity });
            toast({ 
              type: 'warning', 
              message: `Максимум ${stock} шт. в наличии. Установлено ${stock}.`, 
              duration: 3000 
            });
            // Set to max available stock instead
            quantity = stock;
          }
        }

        set({
          cart: get().cart.map(item =>
            item.id === productId
              ? { ...item, quantity }
              : item
          ),
          // ✅ FIX: Clear stale order when cart changes
          // Forces order re-creation with updated quantity on next checkout
          currentOrder: null
        });

        console.log('[updateCartQuantity] Cart updated, currentOrder cleared');
      },

      clearCart: () => {
        set({ cart: [] });
        // ✅ FIX: Clear payment state to avoid orphan orders
        get().resetPaymentFlow({ clearCart: false, reason: 'cart_cleared' });
        console.log('[clearCart] Cart and payment state cleared');
      },

      getCartTotal: () => {
        return get().cart.reduce((total, item) => total + (item.price * item.quantity), 0);
      },

      getCartCount: () => {
        return get().cart.reduce((total, item) => total + item.quantity, 0);
      },

      // Shops
      shops: [], // ✅ FIX: No hardcoded mock data, load from API
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

        // ✅ FIX: Validate cart items
        const invalidItems = cart.filter(item => item.price <= 0 || item.quantity <= 0);
        if (invalidItems.length > 0) {
          console.error('[startCheckout] Invalid cart items:', invalidItems);
          toast({ type: 'error', message: 'Ошибка в корзине. Обновите страницу.', duration: 3000 });
          return;
        }

        // ✅ FIX: Validate cart total
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (total <= 0) {
          console.error('[startCheckout] Invalid cart total:', total);
          toast({ type: 'error', message: 'Сумма заказа должна быть больше 0', duration: 3000 });
          return;
        }

        // ✅ FIX: Validate all products from same shop (multi-shop orders not allowed)
        const cartShopIds = cart.map(item => item.shopId).filter(Boolean);
        const uniqueShops = new Set(cartShopIds);
        
        if (uniqueShops.size > 1) {
          console.error('[startCheckout] ❌ Multi-shop order attempt!', {
            shops: Array.from(uniqueShops),
            items: cart.map(i => ({ id: i.id, name: i.name, shopId: i.shopId }))
          });
          
          toast({
            type: 'error',
            message: 'Нельзя заказать товары из разных магазинов в одном заказе. Оформите заказы отдельно.',
            duration: 4500
          });
          
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

        // ✅ FIX: Always create minimal shop object - currentShop loaded correctly via /shops/my
        // Don't use shops.find() which could return stale mock data
        const shop = { id: shopId, name: 'Loading...' };

        console.log('[startCheckout] Setting currentShop:', shop);

        // ✅ FIX: ALWAYS clear currentOrder to force fresh creation
        // This prevents stale order reuse after cart quantity changes
        set({
          currentShop: shop,
          currentOrder: null,      // Force re-create order with current cart totals
          selectedCrypto: null,
          paymentWallet: null,
          cryptoAmount: 0,
          invoiceExpiresAt: null,
          verifyError: null,
          paymentStep: 'method'
        });

        console.log('[startCheckout] ✅ Payment state cleared, cart total:', total.toFixed(2));
      },

      createOrder: async () => {
        const { cart, user, isCreatingOrder } = get();

        // ✅ FIX: Prevent race condition from double-click
        if (isCreatingOrder) {
          console.warn('[createOrder] Already creating order, ignoring duplicate call');
          return null;
        }

        if (cart.length === 0) return null;

        // ✅ Multi-item cart now fully supported!
        console.log(`[createOrder] Creating order for ${cart.length} item(s):`, cart.map(i => `${i.name} x${i.quantity}`));

        set({ isCreatingOrder: true });

        let timeoutId; // ✅ Moved BEFORE try block for finally access
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
          const initData = window.Telegram?.WebApp?.initData || '';

          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), 8000);

          // ✅ Prepare payload
          const payload = {
            items: cart.map(item => ({
              productId: item.id,
              quantity: item.quantity
            })),
            deliveryAddress: null
          };

          // 🐞 DEBUG: Validate payload before sending (catch corrupt data early)
          const invalidItems = payload.items.filter(item =>
            typeof item.productId !== 'number' ||
            item.productId <= 0 ||
            typeof item.quantity !== 'number' ||
            item.quantity <= 0
          );

          if (invalidItems.length > 0) {
            console.error('❌ [createOrder] Invalid items in cart!', invalidItems);
            console.error('Full cart state:', cart);
            const toast = useToastStore.getState().addToast;
            toast({ type: 'error', message: 'Ошибка: некорректные данные в корзине', duration: 3500 });
            return null;
          }

          // ✅ Log payload for debugging intermittent issues
          console.log('[createOrder] Sending payload:', JSON.stringify(payload));

          // ✅ Get current token from store
          const { token } = get();

          // ✅ Send ALL cart items to backend
          const response = await axios.post(`${API_URL}/orders`, payload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': initData,
              ...(token && { 'Authorization': `Bearer ${token}` })  // ✅ FIX: Add auth token!
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
          console.error('❌ [createOrder] Error:', error);

          // ✅ Enhanced error logging for debugging 400 errors
          if (error.response) {
            console.error('Server Response Status:', error.response.status);
            console.error('Server Response Data:', error.response.data);
          }

          const toast = useToastStore.getState().addToast;

          if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
            toast({ type: 'error', message: 'Timeout: проверьте соединение', duration: 3500 });
          } else if (error.response?.status === 401) {
            toast({ type: 'error', message: 'Ошибка авторизации', duration: 3000 });
          } else if (error.response?.status === 400) {
            // ✅ FIX: Parse specific 400 error messages from backend
            const errorData = error.response.data;

            if (errorData?.error === 'Malformed JSON payload') {
              toast({ type: 'error', message: 'Ошибка сети: повреждённые данные (попробуйте ещё раз)', duration: 4000 });
            } else if (errorData?.error?.includes('Insufficient stock')) {
              // Extract product name and show specific error
              toast({ type: 'error', message: errorData.error, duration: 4500 });
            } else if (errorData?.error) {
              // Show backend error message if available
              toast({ type: 'error', message: errorData.error, duration: 3500 });
            } else {
              toast({ type: 'error', message: 'Ошибка запроса (400)', duration: 3000 });
            }
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
          console.log('🔵 [selectCrypto] START', { crypto, rawInput: crypto });
          
          // ✅ Normalize to UPPERCASE before everything (fix ID case mismatch)
          const normalizedCrypto = crypto.toUpperCase();
          console.log('🔵 [selectCrypto] Normalized:', normalizedCrypto);

          const { currentOrder, user, isGeneratingInvoice } = get();
          const toast = useToastStore.getState().addToast;
          
          console.log('🔵 [selectCrypto] Current order:', currentOrder);

          // Check BOTH store state AND closure variable
          if (isGeneratingInvoice || invoiceInProgress) {
            console.warn('🔴 [selectCrypto] Already generating invoice, ignoring');
            return;
          }

          // Set BOTH locks IMMEDIATELY (synchronous)
          invoiceInProgress = true;
          set({
            selectedCrypto: normalizedCrypto,
            isGeneratingInvoice: true
          });

        let timeoutId; // ✅ Declare before try for finally access
        const controller = new AbortController();

        try {
          timeoutId = setTimeout(() => controller.abort(), 8000);

          // ✅ FIX: Calculate current cart total for validation
          const cart = get().cart;
          const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          console.log('🔵 [selectCrypto] Current cart total:', cartTotal.toFixed(2));

          // Create order if not exists
          let order = currentOrder;
          if (!order) {
            console.log('🔵 [selectCrypto] No current order, creating new...');
            order = await get().createOrder();
            if (!order) {
              const errorMsg = 'Не удалось создать заказ';
              console.error('🔴 [selectCrypto] ERROR: Failed to create order');
              toast({ type: 'error', message: errorMsg, duration: 3000 });
              throw new Error('Failed to create order');
            }
            console.log('🟢 [selectCrypto] Order created:', order);
          } else {
            console.log('🔵 [selectCrypto] Using existing order:', order.id);
            
            // ✅ FIX: Validate order total matches cart total
            const orderTotal = parseFloat(order.total_price) || 0;
            const diff = Math.abs(orderTotal - cartTotal);
            
            if (diff > 0.01) {
              console.warn('🟡 [selectCrypto] ⚠️ STALE ORDER DETECTED!');
              console.warn('🟡 [selectCrypto] Order total:', orderTotal.toFixed(2));
              console.warn('🟡 [selectCrypto] Cart total:', cartTotal.toFixed(2));
              console.warn('🟡 [selectCrypto] Difference:', diff.toFixed(2));
              console.warn('🟡 [selectCrypto] Re-creating order with fresh data...');
              
              // Re-create order with current cart data
              order = await get().createOrder();
              if (!order) {
                const errorMsg = 'Не удалось обновить заказ';
                console.error('🔴 [selectCrypto] ERROR: Failed to re-create order');
                toast({ type: 'error', message: errorMsg, duration: 3000 });
                throw new Error('Failed to re-create order');
              }
              
              console.log('🟢 [selectCrypto] Order re-created with correct total:', order.total_price);
            } else {
              console.log('🟢 [selectCrypto] Order total valid:', orderTotal.toFixed(2));
            }
          }

          // Generate invoice
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
          
          console.log('🔵 [selectCrypto] Sending API request:', {
            url: `${API_URL}/orders/${order.id}/invoice`,
            currency: normalizedCrypto
          });
          
          const response = await axios.post(
            `${API_URL}/orders/${order.id}/invoice`,
            { chain: normalizedCrypto },
            {
              headers: {
                'Content-Type': 'application/json'
              },
              signal: controller.signal // ✅ Add abort signal
            }
          );
          
          console.log('🟢 [selectCrypto] API SUCCESS:', response.data);

          const invoice = response.data.data;
          
          console.log('🔵 [selectCrypto] Invoice received:', invoice);

          // Ensure cryptoAmount is NUMBER (backend might return string from PostgreSQL)
          const cryptoAmount = parseFloat(invoice.cryptoAmount);
          
          console.log('🔵 [selectCrypto] Parsed cryptoAmount:', cryptoAmount);
          
          if (!isFinite(cryptoAmount) || cryptoAmount <= 0) {
            const errorMsg = 'Некорректная сумма от сервера';
            console.error('🔴 [selectCrypto] Invalid cryptoAmount:', { invoice, cryptoAmount });
            toast({ type: 'error', message: errorMsg, duration: 3000 });
            throw new Error('Invalid cryptoAmount from API');
          }

          set({
            paymentWallet: invoice.address,
            cryptoAmount,
            invoiceExpiresAt: invoice.expiresAt,
            paymentStep: 'details'
          });
          
          console.log('🟢 [selectCrypto] SUCCESS - State updated, showing payment details');
        } catch (error) {
          console.error('🔴 [selectCrypto] API ERROR:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            fullError: error
          });

          // Handle timeout/abort
          if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
            toast({ type: 'error', message: 'Timeout: проверьте соединение (15с)', duration: 3500 });
            set({
              paymentStep: 'method',
              verifyError: 'Timeout generating invoice'
            });
            throw error;
          }

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
          if (timeoutId) clearTimeout(timeoutId); // Cleanup timeout
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

        let timeoutId; // Declare before try for finally access
        const controller = new AbortController();

        try {
          timeoutId = setTimeout(() => controller.abort(), 10000);

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
              },
              signal: controller.signal
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

          // Handle timeout/abort
          if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
            toast({ type: 'error', message: 'Timeout: проверьте соединение (15с)', duration: 3500 });
            set({
              verifyError: 'Timeout verifying payment'
            });
            return; // Don't throw, just return
          }

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
          if (timeoutId) clearTimeout(timeoutId); // Cleanup timeout
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
        token: state.token, // ✅ Fix: Persist token across page refresh
        pendingOrders: state.pendingOrders
      })
    }
  )
);
