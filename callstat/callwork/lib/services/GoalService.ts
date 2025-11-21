import { prisma } from '@/lib/prisma'

/**
 * GoalService - единый источник данных для целей продаж
 *
 * Обеспечивает консистентность данных между дашбордом, прогнозами и другими компонентами
 */
export class GoalService {
  /**
   * Получить месячную цель конкретного пользователя
   * @param userId - ID пользователя
   * @returns Цель пользователя в рублях или 0 если не установлена
   */
  static async getUserGoal(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyGoal: true }
    })

    return Number(user?.monthlyGoal || 0)
  }

  /**
   * Получить суммарную цель команды для менеджера
   * Включает цель самого менеджера + всех его активных сотрудников
   *
   * @param managerId - ID менеджера
   * @returns Суммарная цель команды в рублях
   */
  static async getTeamGoal(managerId: string): Promise<number> {
    const team = await prisma.user.findMany({
      where: {
        OR: [
          { id: managerId }, // Сам менеджер
          { managerId: managerId } // Его сотрудники
        ],
        isActive: true // Только активные
      },
      select: { monthlyGoal: true }
    })

    return team.reduce((sum, user) => sum + Number(user.monthlyGoal || 0), 0)
  }

  /**
   * Проверить, установлена ли цель у пользователя
   * @param userId - ID пользователя
   * @returns true если цель установлена и > 0
   */
  static async hasGoal(userId: string): Promise<boolean> {
    const goal = await this.getUserGoal(userId)
    return goal > 0
  }

  /**
   * Получить информацию о целях для команды
   * @param managerId - ID менеджера
   * @returns Детальная информация о целях команды
   */
  static async getTeamGoalBreakdown(managerId: string) {
    const team = await prisma.user.findMany({
      where: {
        OR: [
          { id: managerId },
          { managerId: managerId }
        ],
        isActive: true
      },
      select: {
        id: true,
        name: true,
        role: true,
        monthlyGoal: true
      }
    })

    const totalGoal = team.reduce((sum, user) => sum + Number(user.monthlyGoal || 0), 0)
    const usersWithGoals = team.filter(user => user.monthlyGoal && Number(user.monthlyGoal) > 0)

    return {
      totalGoal,
      teamSize: team.length,
      usersWithGoals: usersWithGoals.length,
      usersWithoutGoals: team.length - usersWithGoals.length,
      breakdown: team.map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        goal: Number(user.monthlyGoal || 0)
      }))
    }
  }
}
