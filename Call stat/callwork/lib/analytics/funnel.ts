import { Report } from '@prisma/client'

export interface FunnelStage {
    id: string
    label: string
    value: number
    prevValue?: number
    conversion: number
    benchmark: number
    isRedZone: boolean
    dropOff?: number // Percentage of lost leads
}

export interface ManagerStats {
    id: string
    name: string
    zoomAppointments: number
    pzmConducted: number
    vzmConducted: number
    contractReview: number
    successfulDeals: number
    salesAmount: number

    // Conversions
    pzmConversion: number // Zoom -> PZM
    vzmConversion: number // PZM -> VZM
    contractConversion: number // VZM -> Contract
    dealConversion: number // Contract -> Deal

    // Global Conversion
    totalConversion: number // Zoom -> Deal

    // Deepthink New Metrics
    planSales: number // Target sales amount
    planDeals: number // Target deal count
    activityScore: number // Composite score (calls + tasks)
    trend: 'up' | 'down' | 'flat' // Growth/Decline indicator
}

export const BENCHMARKS = {
    pzmConversion: 70,
    vzmConversion: 50,
    contractConversion: 40,
    dealConversion: 30,
    activityScore: 80, // Example benchmark
}

// Helper to determine heatmap color based on deviation from benchmark
export function getHeatmapColor(value: number, benchmark: number): string {
    if (value === 0) return 'bg-white text-gray-400' // No data/Zero - neutral to avoid "pink wall"

    const ratio = value / benchmark
    if (ratio >= 1.1) return 'bg-emerald-50 text-emerald-700 font-bold' // Superb
    if (ratio >= 1.0) return 'bg-green-50 text-green-700' // Good
    if (ratio >= 0.9) return 'bg-yellow-50 text-yellow-700' // Warning
    if (ratio >= 0.7) return 'bg-orange-50 text-orange-700' // Bad
    return 'bg-red-50 text-red-700 font-bold' // Critical
}

export function calculateManagerStats(reports: Report[]): Omit<ManagerStats, 'id' | 'name'> {
    const totals = reports.reduce(
        (acc, report) => ({
            zoomAppointments: acc.zoomAppointments + report.zoomAppointments,
            pzmConducted: acc.pzmConducted + report.pzmConducted,
            vzmConducted: acc.vzmConducted + report.vzmConducted,
            contractReview: acc.contractReview + report.contractReviewCount,
            successfulDeals: acc.successfulDeals + report.successfulDeals,
            salesAmount: acc.salesAmount + Number(report.monthlySalesAmount),
        }),
        {
            zoomAppointments: 0,
            pzmConducted: 0,
            vzmConducted: 0,
            contractReview: 0,
            successfulDeals: 0,
            salesAmount: 0,
        }
    )

    const safeDiv = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

    // Mocking Plan & Activity for MVP since they are not in DB yet
    // In a real app, these would come from a 'Targets' table
    const planSales = 1000000 // Example target
    const planDeals = 10 // Example target
    const activityScore = Math.min(100, Math.round(Math.random() * 40 + 60)) // Random 60-100 for demo
    const trend = Math.random() > 0.5 ? 'up' : 'down' as const

    return {
        ...totals,
        pzmConversion: safeDiv(totals.pzmConducted, totals.zoomAppointments),
        vzmConversion: safeDiv(totals.vzmConducted, totals.pzmConducted),
        contractConversion: safeDiv(totals.contractReview, totals.vzmConducted),
        dealConversion: safeDiv(totals.successfulDeals, totals.contractReview),
        totalConversion: safeDiv(totals.successfulDeals, totals.zoomAppointments),
        planSales,
        planDeals,
        activityScore,
        trend,
    }
}

export function getFunnelData(stats: Omit<ManagerStats, 'id' | 'name'>): FunnelStage[] {
    return [
        {
            id: 'zoom',
            label: 'Записи на Зум',
            value: stats.zoomAppointments,
            conversion: 100,
            benchmark: 100,
            isRedZone: false,
            dropOff: 0
        },
        {
            id: 'pzm',
            label: 'ПЗМ проведено',
            value: stats.pzmConducted,
            prevValue: stats.zoomAppointments,
            conversion: stats.pzmConversion,
            benchmark: BENCHMARKS.pzmConversion,
            isRedZone: stats.pzmConversion < BENCHMARKS.pzmConversion,
            dropOff: stats.zoomAppointments > 0 ? 100 - stats.pzmConversion : 0
        },
        {
            id: 'vzm',
            label: 'ВЗМ проведено',
            value: stats.vzmConducted,
            prevValue: stats.pzmConducted,
            conversion: stats.vzmConversion,
            benchmark: BENCHMARKS.vzmConversion,
            isRedZone: stats.vzmConversion < BENCHMARKS.vzmConversion,
            dropOff: stats.pzmConducted > 0 ? 100 - stats.vzmConversion : 0
        },
        {
            id: 'contract',
            label: 'Разбор договора',
            value: stats.contractReview,
            prevValue: stats.vzmConducted,
            conversion: stats.contractConversion,
            benchmark: BENCHMARKS.contractConversion,
            isRedZone: stats.contractConversion < BENCHMARKS.contractConversion,
            dropOff: stats.vzmConducted > 0 ? 100 - stats.contractConversion : 0
        },
        {
            id: 'deal',
            label: 'Сделка',
            value: stats.successfulDeals,
            prevValue: stats.contractReview,
            conversion: stats.dealConversion,
            benchmark: BENCHMARKS.dealConversion,
            isRedZone: stats.dealConversion < BENCHMARKS.dealConversion,
            dropOff: stats.contractReview > 0 ? 100 - stats.dealConversion : 0
        },
    ]
}

export function analyzeRedZones(stats: ManagerStats) {
    const issues = []

    if (stats.pzmConversion < BENCHMARKS.pzmConversion) {
        issues.push({
            stage: 'ПЗМ',
            metric: 'Конверсия в явку',
            value: stats.pzmConversion,
            benchmark: BENCHMARKS.pzmConversion,
            severity: 'warning'
        })
    }

    if (stats.vzmConversion < BENCHMARKS.vzmConversion) {
        issues.push({
            stage: 'ВЗМ',
            metric: 'Квалификация лида',
            value: stats.vzmConversion,
            benchmark: BENCHMARKS.vzmConversion,
            severity: 'critical'
        })
    }

    if (stats.dealConversion < BENCHMARKS.dealConversion) {
        issues.push({
            stage: 'Сделка',
            metric: 'Закрытие',
            value: stats.dealConversion,
            benchmark: BENCHMARKS.dealConversion,
            severity: 'critical'
        })
    }

    // New Alert: Low Activity
    if (stats.activityScore < BENCHMARKS.activityScore) {
        issues.push({
            stage: 'Активность',
            metric: 'Индекс активности',
            value: stats.activityScore,
            benchmark: BENCHMARKS.activityScore,
            severity: 'warning'
        })
    }

    return issues
}
