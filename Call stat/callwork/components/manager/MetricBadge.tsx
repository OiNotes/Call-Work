import { memo } from 'react'

interface MetricBadgeProps {
  label: string
  value: string
  isGood: boolean
}

export const MetricBadge = memo(function MetricBadge({ label, value, isGood }: MetricBadgeProps) {
  return (
    <div className={`p-2 rounded-lg ${isGood ? 'bg-green-50' : 'bg-red-50'}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className={`text-lg font-semibold ${isGood ? 'text-green-600' : 'text-red-600'}`}>
        {value}
      </p>
    </div>
  )
})
