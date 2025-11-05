/**
 * P1-BOT-009: User-Friendly Error Messages
 *
 * Converts technical errors to user-friendly messages
 */

const ERROR_MESSAGES = {
  // Network errors
  ECONNREFUSED: '⚠️ Сервер временно недоступен. Попробуйте позже.',
  ETIMEDOUT: '⚠️ Превышено время ожидания. Попробуйте позже.',
  ENOTFOUND: '⚠️ Сервер не найден. Проверьте подключение к интернету.',
  ENETUNREACH: '⚠️ Сеть недоступна. Проверьте подключение.',

  // HTTP errors
  400: '⚠️ Некорректный запрос. Проверьте введённые данные.',
  401: '⚠️ Требуется авторизация. Нажмите /start',
  403: '⚠️ Доступ запрещён. У вас нет прав для этого действия.',
  404: '⚠️ Данные не найдены.',
  409: '⚠️ Конфликт данных. Такая запись уже существует.',
  429: '⚠️ Слишком много запросов. Попробуйте через минуту.',
  500: '⚠️ Ошибка сервера. Попробуйте позже.',
  502: '⚠️ Сервер временно недоступен.',
  503: '⚠️ Сервис временно недоступен.',
  504: '⚠️ Превышено время ожидания сервера.'
};

/**
 * Convert error to user-friendly message
 */
export const toFriendlyError = (error) => {
  // Network errors
  if (error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }

  // HTTP errors
  if (error.response?.status && ERROR_MESSAGES[error.response.status]) {
    return ERROR_MESSAGES[error.response.status];
  }

  // API error with custom message
  if (error.response?.data?.error && typeof error.response.data.error === 'string') {
    const apiError = error.response.data.error.toLowerCase();

    // Common API errors
    if (apiError.includes('not found')) {
      return '⚠️ Данные не найдены.';
    }
    if (apiError.includes('unauthorized') || apiError.includes('invalid token')) {
      return '⚠️ Сессия истекла. Нажмите /start для повторной авторизации.';
    }
    if (apiError.includes('already exists')) {
      return '⚠️ Такая запись уже существует.';
    }
    if (apiError.includes('limit reached') || apiError.includes('tier limit')) {
      return '⚠️ Достигнут лимит тарифного плана. Обновите тариф для продолжения.';
    }
    if (apiError.includes('circular')) {
      return '⚠️ Невозможно создать циклическую подписку.';
    }
  }

  // Validation errors
  if (error.response?.data?.details && Array.isArray(error.response.data.details)) {
    const validationErrors = error.response.data.details
      .map(d => `• ${d.message || d.msg || d}`)
      .join('\n');
    return `⚠️ Ошибка валидации:\n\n${validationErrors}`;
  }

  // Default
  return '⚠️ Произошла ошибка. Попробуйте позже.';
};

export default toFriendlyError;
