import { useRef } from 'react';
import axios from 'axios';
import { useStore } from '../store/useStore';

// Базовый URL API (можно вынести в .env)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Hook для API вызовов с stable reference
 * Использует useRef pattern чтобы возвращать ОДИНАКОВЫЙ объект на каждый render
 * @returns {Object} Объект с методами API (stable reference)
 */
export function useApi() {
  // Create stable API reference with useRef
  const apiRef = useRef(null);
  
  // Initialize only once
  if (!apiRef.current) {
    // Token getter that always returns current token from store
    const getToken = () => useStore.getState().token;
    
    // Create request function with token getter closure
    const createRequest = (tokenGetter) => async (method, endpoint, data = null, config = {}) => {
      // Создаём AbortController для timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 секунд

      try {
        // Получаем initData из Telegram WebApp для авторизации
        const initData = window.Telegram?.WebApp?.initData || '';
        const currentToken = tokenGetter();

        // Формируем axios config
        const axiosConfig = {
          method,
          url: `${API_BASE_URL}${endpoint}`,
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData,
            ...(currentToken && { 'Authorization': `Bearer ${currentToken}` }),
            ...config.headers,
          },
          signal: controller.signal,  // Добавляем signal для timeout
          ...config,
        };

        // Добавляем data только для методов которые его поддерживают
        // GET и DELETE не должны иметь body
        if (method !== 'GET' && method !== 'DELETE' && data !== null) {
          axiosConfig.data = data;
        }

        const response = await axios(axiosConfig);

        clearTimeout(timeoutId);  // Очищаем timeout при успехе
        return { data: response.data, error: null };
      } catch (err) {
        clearTimeout(timeoutId);  // Очищаем timeout при ошибке

        console.error(`API ${method} ${endpoint} error:`, err);

        // Обработка timeout ошибки
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          const timeoutError = 'Request timeout - please check your connection';
          return { data: null, error: timeoutError };
        }

        // Обычные ошибки
        const apiError = err.response?.data;
        const errorMessage = apiError?.error || apiError?.message || err.message || 'Произошла ошибка';
        return { data: null, error: errorMessage };
      }
    };
    
    // Create request function with token getter
    const request = createRequest(getToken);
    
    // Create stable API methods - эти функции НИКОГДА не пересоздаются
    apiRef.current = {
      // GET запрос
      get: async (endpoint, config = {}) => {
        return await request('GET', endpoint, null, config);
      },
      
      // POST запрос
      post: async (endpoint, data, config = {}) => {
        return await request('POST', endpoint, data, config);
      },
      
      // PUT запрос
      put: async (endpoint, data, config = {}) => {
        return await request('PUT', endpoint, data, config);
      },
      
      // DELETE запрос
      delete: async (endpoint, config = {}) => {
        return await request('DELETE', endpoint, null, config);
      },
      
      // PATCH запрос
      patch: async (endpoint, data, config = {}) => {
        return await request('PATCH', endpoint, data, config);
      },
      
      // Универсальный fetchApi wrapper (для совместимости с Settings modals)
      fetchApi: async (endpoint, options = {}) => {
        const method = options.method?.toUpperCase() || 'GET';
        const data = options.body || null;
        const config = { ...options };
        delete config.method;
        delete config.body;

        let result;
        switch (method) {
          case 'GET':
            result = await apiRef.current.get(endpoint, config);
            break;
          case 'POST':
            result = await apiRef.current.post(endpoint, data, config);
            break;
          case 'PUT':
            result = await apiRef.current.put(endpoint, data, config);
            break;
          case 'DELETE':
            result = await apiRef.current.delete(endpoint, config);
            break;
          case 'PATCH':
            result = await apiRef.current.patch(endpoint, data, config);
            break;
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }

        // Возвращаем только data (для совместимости с fetch API)
        if (result.error) {
          throw new Error(result.error);
        }
        return result.data;
      }
    };
  }
  
  // Return SAME reference every time - это ключевая фича
  return apiRef.current;
}

/**
 * Hook для конкретных API endpoints
 */
export function useShopApi() {
  const api = useApi();
  
  // Используем useRef для stable methods reference
  const methodsRef = useRef(null);
  
  if (!methodsRef.current) {
    methodsRef.current = {
      // Получить список магазинов
      getShops: async () => {
        return await api.get('/shops');
      },

      // Получить магазин по ID
      getShop: async (shopId) => {
        return await api.get(`/shops/${shopId}`);
      },

      // Получить товары магазина
      getShopProducts: async (shopId) => {
        return await api.get(`/shops/${shopId}/products`);
      },

      // Получить подписки пользователя
      getSubscriptions: async () => {
        return await api.get('/subscriptions');
      },

      // Создать заказ
      createOrder: async (orderData) => {
        return await api.post('/orders', orderData);
      },

      // Подтвердить оплату
      confirmPayment: async (orderId, paymentData) => {
        return await api.post(`/orders/${orderId}/confirm`, paymentData);
      },

      // Получить заказы пользователя
      getMyOrders: async () => {
        return await api.get('/orders/my');
      },
    };
  }

  return { ...api, ...methodsRef.current };
}

/**
 * Hook для API follows
 */
export function useFollowsApi() {
  const api = useApi();
  
  // Используем useRef для stable methods reference
  const methodsRef = useRef(null);
  
  if (!methodsRef.current) {
    methodsRef.current = {
      // Детали подписки
      getDetail: async (followId) => {
        try {
          const response = await api.get(`/follows/${followId}`);
          return response.data;
        } catch (error) {
          console.error('Error getting follow detail:', error);
          throw error;
        }
      },

      // Товары подписки
      getProducts: async (followId, params = {}) => {
        try {
          const response = await api.get(`/follows/${followId}/products`, { params });
          return response.data;
        } catch (error) {
          console.error('Error getting follow products:', error);
          throw error;
        }
      },

      // Изменить наценку
      updateMarkup: async (followId, markupPercentage) => {
        try {
          const response = await api.put(`/follows/${followId}/markup`, { markupPercentage });
          return response.data;
        } catch (error) {
          console.error('Error updating markup:', error);
          throw error;
        }
      },

      // Сменить режим
      switchMode: async (followId, mode, markupPercentage = null) => {
        try {
          const body = { mode };
          if (markupPercentage !== null) body.markupPercentage = markupPercentage;
          const response = await api.put(`/follows/${followId}/mode`, body);
          return response.data;
        } catch (error) {
          console.error('Error switching mode:', error);
          throw error;
        }
      },

      // Удалить подписку
      deleteFollow: async (followId) => {
        try {
          await api.delete(`/follows/${followId}`);
          return { success: true };
        } catch (error) {
          console.error('Error deleting follow:', error);
          throw error;
        }
      },
    };
  }

  return { ...api, ...methodsRef.current };
}
