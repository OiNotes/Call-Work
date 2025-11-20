/**
 * Расчёт прогноза выполнения месячного плана продаж
 * 
 * @param currentSales - Текущая сумма продаж за текущий месяц
 * @param monthlyGoal - Месячная цель продаж
 * @returns Объект с метриками прогноза
 */
export function calculateMonthlyForecast(
  currentSales: number,
  monthlyGoal: number
) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  
  // Дней в текущем месяце
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  // Сколько дней прошло (включая текущий)
  const daysPassed = today.getDate()
  
  // Сколько дней осталось
  const daysRemaining = daysInMonth - daysPassed
  
  // Средняя сумма продаж в день
  const dailyAverage = daysPassed > 0 ? currentSales / daysPassed : 0
  
  // Прогноз на конец месяца (линейная экстраполяция)
  const projectedTotal = dailyAverage * daysInMonth
  
  // Процент выполнения прогноза от цели
  const projectedCompletion = monthlyGoal > 0 
    ? (projectedTotal / monthlyGoal) * 100 
    : 0
  
  // Ожидаемая сумма на текущий день (по плану)
  const expectedByNow = (monthlyGoal / daysInMonth) * daysPassed
  
  // Темп выполнения (pacing) - насколько опережаем/отстаём от плана
  const pacing = expectedByNow > 0 
    ? ((currentSales - expectedByNow) / expectedByNow) * 100 
    : 0
  
  // Хороший ли темп? (допуск -5%)
  const isPacingGood = pacing >= -5
  
  // Необходимая дневная сумма для достижения цели
  const dailyRequired = daysRemaining > 0 
    ? (monthlyGoal - currentSales) / daysRemaining 
    : 0

  return {
    // Текущие значения
    current: currentSales,
    goal: monthlyGoal,
    
    // Прогноз
    projected: Math.round(projectedTotal),
    completion: Math.round(projectedCompletion),
    
    // Темп
    pacing: Math.round(pacing),
    isPacingGood,
    
    // Расчётные показатели
    daysInMonth,
    daysPassed,
    daysRemaining,
    dailyAverage: Math.round(dailyAverage),
    dailyRequired: Math.round(dailyRequired),
    expectedByNow: Math.round(expectedByNow),
  }
}

/**
 * Генерация данных для графика прогноза
 * 
 * @param currentSales - Текущая сумма продаж
 * @param monthlyGoal - Месячная цель
 * @param dailySales - Массив продаж по дням (опционально)
 * @returns Массив точек для графика
 */
export function generateForecastChartData(
  currentSales: number,
  monthlyGoal: number,
  dailySales?: Array<{ day: number; sales: number }>
) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const currentDay = today.getDate()
  
  const data = []
  
  // Расчёт среднего дневного значения
  const dailyAverage = currentDay > 0 ? currentSales / currentDay : 0
  const dailyPlan = monthlyGoal / daysInMonth
  
  let cumulativeSales = 0
  
  for (let day = 1; day <= daysInMonth; day++) {
    const point: any = {
      day,
      plan: Math.round(dailyPlan * day), // Линия плана
    }
    
    if (day <= currentDay) {
      // Факт (используем реальные данные если есть, иначе равномерное распределение)
      if (dailySales && dailySales.length > 0) {
        const dayData = dailySales.find(d => d.day === day)
        cumulativeSales += dayData?.sales || 0
        point.actual = cumulativeSales
      } else {
        // Равномерное распределение
        cumulativeSales = Math.round(dailyAverage * day)
        point.actual = cumulativeSales
      }
    } else {
      // Прогноз (продолжаем линию тренда)
      point.forecast = Math.round(currentSales + dailyAverage * (day - currentDay))
    }
    
    data.push(point)
  }
  
  return data
}
