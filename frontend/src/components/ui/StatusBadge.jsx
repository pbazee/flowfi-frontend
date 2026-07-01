import { statusTone, titleize } from '@/lib/formatters'

const toneClass = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  neutral: 'inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600',
}

export default function StatusBadge({ status, tone, children, className = '' }) {
  const resolvedTone = tone || statusTone(status)
  const label = children || titleize(status)

  return <span className={`${toneClass[resolvedTone] || toneClass.neutral} ${className}`.trim()}>{label}</span>
}
