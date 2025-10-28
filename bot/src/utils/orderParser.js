/**
 * Parse order numbers from user input
 *
 * Supports formats:
 * - "1 3 5" → [1, 3, 5]
 * - "1-5" → [1, 2, 3, 4, 5]
 * - "1 3-5 7" → [1, 3, 4, 5, 7]
 *
 * @param {string} input - User input string
 * @param {number} maxNumber - Maximum valid order number
 * @returns {{valid: boolean, numbers?: number[], error?: string}}
 */
export function parseOrderNumbers(input, maxNumber) {
  if (!input || typeof input !== 'string') {
    return {
      valid: false,
      error: 'Не указан ввод'
    };
  }

  if (!maxNumber || typeof maxNumber !== 'number' || maxNumber < 1) {
    return {
      valid: false,
      error: 'Неверный максимальный номер'
    };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Пустой ввод'
    };
  }

  const numbers = new Set();
  const parts = trimmed.split(/\s+/); // Split by whitespace

  try {
    for (const part of parts) {
      // Check if it's a range (e.g., "1-5")
      if (part.includes('-')) {
        const rangeParts = part.split('-');

        if (rangeParts.length !== 2) {
          return {
            valid: false,
            error: `Неверный формат диапазона: "${part}". Используйте формат "1-5"`
          };
        }

        const start = Number.parseInt(rangeParts[0], 10);
        const end = Number.parseInt(rangeParts[1], 10);

        if (!Number.isInteger(start) || !Number.isInteger(end)) {
          return {
            valid: false,
            error: `Диапазон должен содержать числа: "${part}"`
          };
        }

        if (start < 1 || end < 1) {
          return {
            valid: false,
            error: `Номера должны быть положительными: "${part}"`
          };
        }

        if (start > end) {
          return {
            valid: false,
            error: `Начало диапазона больше конца: "${part}"`
          };
        }

        if (start > maxNumber || end > maxNumber) {
          return {
            valid: false,
            error: `Номера вне диапазона (1-${maxNumber}): "${part}"`
          };
        }

        // Add all numbers in range
        for (let i = start; i <= end; i++) {
          numbers.add(i);
        }
      } else {
        // Single number
        const num = Number.parseInt(part, 10);

        if (!Number.isInteger(num)) {
          return {
            valid: false,
            error: `Неверное число: "${part}"`
          };
        }

        if (num < 1) {
          return {
            valid: false,
            error: `Номер должен быть положительным: "${part}"`
          };
        }

        if (num > maxNumber) {
          return {
            valid: false,
            error: `Номер вне диапазона (1-${maxNumber}): "${part}"`
          };
        }

        numbers.add(num);
      }
    }

    if (numbers.size === 0) {
      return {
        valid: false,
        error: 'Не найдено допустимых номеров'
      };
    }

    // Convert Set to sorted array
    const sortedNumbers = Array.from(numbers).sort((a, b) => a - b);

    return {
      valid: true,
      numbers: sortedNumbers
    };

  } catch (error) {
    return {
      valid: false,
      error: `Ошибка парсинга: ${error.message}`
    };
  }
}

/**
 * Format order numbers for display
 * @param {number[]} numbers - Array of order numbers
 * @returns {string} - Formatted string
 */
export function formatOrderNumbers(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return '';
  }

  // Group consecutive numbers into ranges
  const ranges = [];
  let rangeStart = numbers[0];
  let rangeEnd = numbers[0];

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === rangeEnd + 1) {
      // Continue range
      rangeEnd = numbers[i];
    } else {
      // End current range, start new one
      if (rangeStart === rangeEnd) {
        ranges.push(`${rangeStart}`);
      } else {
        ranges.push(`${rangeStart}-${rangeEnd}`);
      }
      rangeStart = numbers[i];
      rangeEnd = numbers[i];
    }
  }

  // Add final range
  if (rangeStart === rangeEnd) {
    ranges.push(`${rangeStart}`);
  } else {
    ranges.push(`${rangeStart}-${rangeEnd}`);
  }

  return ranges.join(', ');
}
