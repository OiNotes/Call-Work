'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ManualReportForm } from '@/components/reports/ManualReportForm'

export default function ReportPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <ManualReportForm />
      </div>
    </DashboardLayout>
  )
}
