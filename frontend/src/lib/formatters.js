import { format } from 'date-fns'

export function formatCurrency(value) {
  const amount = Number(value || 0)
  const hasDecimals = amount % 1 !== 0

  return `KES ${amount.toLocaleString(undefined, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

export function formatDate(value, pattern = 'MMM d, yyyy') {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return format(date, pattern)
}

export function formatDateTime(value) {
  return formatDate(value, 'MMM d, yyyy HH:mm')
}

export function formatDurationMinutes(value) {
  const minutes = Number(value || 0)
  if (!minutes) return '—'
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} day(s)`
  if (minutes >= 60) return `${Math.round(minutes / 60)} hour(s)`
  return `${minutes} min`
}

export function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export function normalizeObject(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return value
}

export function getPrimaryImage(images) {
  return normalizeArray(images)[0] || 'https://placehold.co/960x640/f3f4f6/6b7280?text=FlowFi'
}

export function titleize(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function statusTone(status) {
  switch (String(status || '').toLowerCase()) {
    case 'active':
    case 'success':
    case 'confirmed':
    case 'delivered':
    case 'online':
    case 'used':
    case 'ready':
      return 'success'
    case 'pending':
    case 'trialing':
    case 'past due':
    case 'past_due':
    case 'unused':
    case 'processing':
      return 'warning'
    case 'offline':
    case 'inactive':
    case 'failed':
    case 'expired':
    case 'suspended':
    case 'cancelled':
      return 'danger'
    case 'shipped':
    case 'info':
      return 'info'
    default:
      return 'neutral'
  }
}
