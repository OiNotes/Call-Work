import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useStore } from '../store/useStore';

// Базовый URL API (можно вынести в .env)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Hook для API вызовов
 * @returns {Object} Объект с методами API
 */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const token = useStore((state) => state.token);

  // Базовый запрос
  const request = useCallback(async (method, endpoint, data = null, config = {}) => {
    // Создаём AbortController для timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 секунд

    setLoading(true);
    setError(null);

    try {
      // Получаем initData из Telegram WebApp для авторизации
      const initData = window.Telegram?.WebApp?.initData || '';

      // Формируем axios config
      const axiosConfig = {
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
          ...(token && { 'Authorization': `Bearer ${token}` }),
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
      setLoading(false);
      return { data: response.data, error: null };
    } catch (err) {
      clearTimeout(timeoutId);  // Очищаем timeout при ошибке

      // Обработка timeout ошибки
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        const timeoutError = 'Request timeout - please check your connection';
        setError(timeoutError);
        setLoading(false);
        return { data: null, error: timeoutError };
      }

      // Обычные ошибки
      const apiError = err.response?.data;
      const errorMessage = apiError?.error || apiError?.message || err.message || 'Произошла ошибка';
      setError(errorMessage);
      setLoading(false);
      return { data: null, error: errorMessage };
    }
  }, [token]);

  // GET запрос
  const get = useCallback(async (endpoint, config = {}) => {
    return await request('GET', endpoint, null, config);
  }, [request]);

  // POST запрос
  const post = useCallback(async (endpoint, data, config = {}) => {
    return await request('POST', endpoint, data, config);
  }, [request]);

  // PUT запрос
  const put = useCallback(async (endpoint, data, config = {}) => {
    return await request('PUT', endpoint, data, config);
  }, [request]);

  // DELETE запрос
  const del = useCallback(async (endpoint, config = {}) => {
    return await request('DELETE', endpoint, null, config);
  }, [request]);

  // PATCH запрос
  const patch = useCallback(async (endpoint, data, config = {}) => {
    return await request('PATCH', endpoint, data, config);
  }, [request]);

  // Очистка ошибки
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Универсальный fetchApi wrapper (для совместимости с Settings modals)
  const fetchApi = useCallback(async (endpoint, options = {}) => {
    const method = options.method?.toUpperCase() || 'GET';
    const data = options.body || null;
    const config = { ...options };
    delete config.method;
    delete config.body;

    let result;
    switch (method) {
      case 'GET':
        result = await get(endpoint, config);
        break;
      case 'POST':
        result = await post(endpoint, data, config);
        break;
      case 'PUT':
        result = await put(endpoint, data, config);
        break;
      case 'DELETE':
        result = await del(endpoint, config);
        break;
      case 'PATCH':
        result = await patch(endpoint, data, config);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    // Возвращаем только data (для совместимости с fetch API)
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  }, [get, post, put, del, patch]);

  // КРИТИЧНО: НЕ включать loading/error в dependencies!
  // Иначе каждый запрос пересоздаёт объект → infinite loop
  return useMemo(() => ({
    get,
    post,
    put,
    delete: del,
    patch,
    fetchApi,
    clearError,
  }), [get, post, put, del, patch, fetchApi, clearError]);
}

/**
 * Hook для конкретных API endpoints
 */
export function useShopApi() {
  const api = useApi();

  // Получить список магазинов
  const getShops = useCallback(async () => {
    return await api.get('/shops');
  }, [api]);

  // Получить магазин по ID
  const getShop = useCallback(async (shopId) => {
    return await api.get(`/shops/${shopId}`);
  }, [api]);

  // Получить товары магазина
  const getShopProducts = useCallback(async (shopId) => {
    return await api.get(`/shops/${shopId}/products`);
  }, [api]);

  // Получить подписки пользователя
  const getSubscriptions = useCallback(async () => {
    return await api.get('/subscriptions');
  }, [api]);

  // Создать заказ
  const createOrder = useCallback(async (orderData) => {
    return await api.post('/orders', orderData);
  }, [api]);

  // Подтвердить оплату
  const confirmPayment = useCallback(async (orderId, paymentData) => {
    return await api.post(`/orders/${orderId}/confirm`, paymentData);
  }, [api]);

  // Получить заказы пользователя
  const getMyOrders = useCallback(async () => {
    return await api.get('/orders/my');
  }, [api]);

  return useMemo(() => ({
    ...api,
    getShops,
    getShop,
    getShopProducts,
    getSubscriptions,
    createOrder,
    confirmPayment,
    getMyOrders,
  }), [api, getShops, getShop, getShopProducts, getSubscriptions, createOrder, confirmPayment, getMyOrders]);
}

/**
 * Hook для API follows
 */
export function useFollowsApi() {
  const api = useApi();

  // Детали подписки
  const getDetail = useCallback(async (followId) => {
    try {
      const response = await api.get(`/follows/${followId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting follow detail:', error);
      throw error;
    }
  }, [api]);

  // Товары подписки
  const getProducts = useCallback(async (followId, params = {}) => {
    try {
      const response = await api.get(`/follows/${followId}/products`, { params });
      return response.data;
    } catch (error) {
      console.error('Error getting follow products:', error);
      throw error;
    }
  }, [api]);

  // Изменить наценку
  const updateMarkup = useCallback(async (followId, markupPercentage) => {
    try {
      const response = await api.put(`/follows/${followId}/markup`, { markupPercentage });
      return response.data;
    } catch (error) {
      console.error('Error updating markup:', error);
      throw error;
    }
  }, [api]);

  // Сменить режим
  const switchMode = useCallback(async (followId, mode, markupPercentage = null) => {
    try {
      const body = { mode };
      if (markupPercentage !== null) body.markupPercentage = markupPercentage;
      const response = await api.put(`/follows/${followId}/mode`, body);
      return response.data;
    } catch (error) {
      console.error('Error switching mode:', error);
      throw error;
    }
  }, [api]);

  // Удалить подписку
  const deleteFollow = useCallback(async (followId) => {
    try {
      await api.delete(`/follows/${followId}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting follow:', error);
      throw error;
    }
  }, [api]);

  return useMemo(() => ({
    ...api,
    getDetail,
    getProducts,
    updateMarkup,
    switchMode,
    deleteFollow,
  }), [api, getDetail, getProducts, updateMarkup, switchMode, deleteFollow]);
}
