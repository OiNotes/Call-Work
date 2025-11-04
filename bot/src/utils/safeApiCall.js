import logger from './logger.js';

/**
 * Безопасная обёртка для вызовов Backend API
 * 
 * Гарантирует корректную обработку:
 * - 200 OK с success: false в теле ответа
 * - HTTP 4xx/5xx ошибок
 * - Сетевых ошибок (timeout, connection refused)
 * 
 * @param {Function} apiFunction - Функция API для вызова
 * @param {...any} args - Аргументы для передачи в apiFunction
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function safeApiCall(apiFunction, ...args) {
  try {
    const response = await apiFunction(...args);
    
    // API client может вернуть два формата:
    // 1. Wrapper: { success: true, data: ... } или { success: false, error: ... }
    // 2. Unwrapped: просто данные (product, shop, etc.) - уже распакованные api.js
    
    // Проверка что response - объект
    if (!response || typeof response !== 'object') {
      logger.warn('API call returned non-object response:', response);
      return { 
        success: false, 
        error: 'Неожиданный формат ответа от сервера' 
      };
    }
    
    // Проверяем wrapper format (есть поле 'success')
    if ('success' in response) {
      // Wrapper: { success: true, data: ... }
      if (response.success && 'data' in response) {
        return { 
          success: true, 
          data: response.data 
        };
      }
      
      // Wrapper: { success: false, error: ... }
      if (response.success === false) {
        const errorMessage = response.error || response.message || 'Неизвестная ошибка API';
        logger.warn('API call returned failure status:', { 
          error: errorMessage, 
          response 
        });
        return { 
          success: false, 
          error: errorMessage 
        };
      }
      
      // Wrapper format но странный (success: true без data)
      logger.warn('API call returned wrapper without data field:', response);
      return { 
        success: false, 
        error: 'Неожиданный формат ответа от сервера' 
      };
    }
    
    // Unwrapped format: API client вернул данные напрямую (product, shop, etc.)
    // Это успешный ответ, т.к. не было thrown exception
    logger.debug('API call returned unwrapped data (success):', {
      hasId: !!response.id,
      hasName: !!response.name,
      keys: Object.keys(response).slice(0, 5)
    });
    return { 
      success: true, 
      data: response 
    };

  } catch (error) {
    // Обработка сетевых ошибок и HTTP ошибок (4xx, 5xx)
    logger.error('API call exception:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    
    let errorMessage = 'Ошибка сети или сервера';
    
    if (error.response) {
      // HTTP ошибка (4xx, 5xx)
      const status = error.response.status;
      const backendError = error.response.data?.error || error.response.data?.message;
      
      if (status === 400) {
        errorMessage = `Неверные данные: ${backendError || 'проверьте параметры'}`;
      } else if (status === 401) {
        errorMessage = 'Ошибка авторизации';
      } else if (status === 403) {
        errorMessage = 'Доступ запрещён';
      } else if (status === 404) {
        errorMessage = `Не найдено: ${backendError || 'ресурс не существует'}`;
      } else if (status === 409) {
        errorMessage = `Конфликт: ${backendError || 'данные уже существуют'}`;
      } else if (status === 422) {
        errorMessage = `Ошибка валидации: ${backendError || 'проверьте данные'}`;
      } else if (status >= 500) {
        errorMessage = `Ошибка сервера (${status}): ${backendError || 'попробуйте позже'}`;
      } else {
        errorMessage = `Ошибка ${status}: ${backendError || 'неизвестная ошибка'}`;
      }
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Сервер недоступен (ECONNREFUSED)';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Превышено время ожидания ответа от сервера';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Сервер не найден (проверьте BACKEND_URL)';
    }
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

/**
 * Форматирует результат для AI
 * Преобразует ошибку в структуру понятную для AI response generation
 */
export function formatResultForAI(result, actionType) {
  if (!result.success) {
    return {
      success: false,
      message: result.error,
      data: {
        error: {
          code: 'API_ERROR',
          message: result.error
        }
      }
    };
  }
  
  return {
    success: true,
    data: {
      action: actionType,
      ...result.data
    }
  };
}
