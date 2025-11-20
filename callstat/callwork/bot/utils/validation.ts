export function validateNumber(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, '')
  const num = parseInt(cleaned, 10)
  
  if (isNaN(num) || num < 0) {
    return null
  }
  
  return num
}

export function validateSalesAmount(text: string): number | null {
  // Удаляем пробелы, символы валюты
  const cleaned = text
    .trim()
    .replace(/\s/g, '')
    .replace(/₽/g, '')
    .replace(/руб/gi, '')
    .replace(/,/g, '.')
  
  const num = parseFloat(cleaned)
  
  if (isNaN(num) || num < 0) {
    return null
  }
  
  return num
}

export function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim())
}
