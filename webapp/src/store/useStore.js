import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { mockShops, mockProducts, mockSubscriptions, mockUser } from '../utils/mockData';
import { generateOrderId } from '../utils/paymentUtils';

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
        const currentCart = get().cart;
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
          set({ cart: [...currentCart, { ...product, quantity: 1 }] });
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
        const cart = get().cart;
        const total = get().getCartTotal();

        if (cart.length === 0) return;

        set({
          paymentStep: 'method'
        });
      },

      createOrder: async () => {
        const { cart, user } = get();

        if (cart.length === 0) return null;

        set({ isCreatingOrder: true });

        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

          // For now, support single product checkout
          const item = cart[0];

          const response = await axios.post(`${API_URL}/orders`, {
            productId: item.id,
            quantity: item.quantity,
            deliveryAddress: null
          }, {
            headers: {
              'Authorization': `Bearer ${user?.token || ''}`,
              'Content-Type': 'application/json'
            }
          });

          const order = response.data.data;
          set({
            currentOrder: order,
            isCreatingOrder: false
          });

          return order;
        } catch (error) {
          console.error('Create order error:', error);
          set({ isCreatingOrder: false });
          throw error;
        }
      },

      selectCrypto: async (crypto) => {
        const { currentOrder, user } = get();

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
                'Authorization': `Bearer ${user?.token || ''}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const invoice = response.data.data;

          set({
            paymentWallet: invoice.address,
            cryptoAmount: invoice.cryptoAmount,
            invoiceExpiresAt: invoice.expiresAt,
            paymentStep: 'details',
            isGeneratingInvoice: false
          });
        } catch (error) {
          console.error('Generate invoice error:', error);
          set({
            isGeneratingInvoice: false,
            verifyError: error.response?.data?.error || 'Ошибка генерации invoice'
          });
          throw error;
        }
      },

      submitPaymentHash: async (hash) => {
        const { currentOrder, selectedCrypto, user } = get();

        if (!currentOrder) return;

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
                'Authorization': `Bearer ${user?.token || ''}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.data.success) {
            const completedOrder = {
              ...currentOrder,
              crypto: selectedCrypto,
              txHash: hash,
              status: 'confirmed',
              submittedAt: new Date().toISOString()
            };

            set({
              pendingOrders: [...get().pendingOrders, completedOrder],
              paymentStep: 'success',
              isVerifying: false
            });

            // Clear cart
            get().clearCart();
          }
        } catch (error) {
          console.error('Verify payment error:', error);
          set({
            isVerifying: false,
            verifyError: error.response?.data?.error || 'Ошибка проверки платежа'
          });
        }
      },

      clearCheckout: () => {
        get().clearCart();
        set({
          currentOrder: null,
          selectedCrypto: null,
          paymentStep: 'idle',
          paymentWallet: null
        });
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
