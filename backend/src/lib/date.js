function toUtcDate(dateValue = new Date()) {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${dateValue}`)
  }

  return date
}

function getLastUtcDayOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function addUtcDays(dateValue, days) {
  const date = toUtcDate(dateValue)
  const result = new Date(date.toISOString())
  result.setUTCDate(result.getUTCDate() + Number(days || 0))
  return result
}

function addUtcMonthsClamped(dateValue, months) {
  const date = toUtcDate(dateValue)
  const totalMonths = date.getUTCMonth() + Number(months || 0)
  const year = date.getUTCFullYear() + Math.floor(totalMonths / 12)
  const normalizedMonth = ((totalMonths % 12) + 12) % 12
  const day = Math.min(date.getUTCDate(), getLastUtcDayOfMonth(year, normalizedMonth))

  return new Date(
    Date.UTC(
      year,
      normalizedMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  )
}

function isValidDateOnly(value) {
  if (!value) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false

  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || month < 1 || month > 12 || day < 1) return false

  return day <= getLastUtcDayOfMonth(year, month - 1)
}

function toValidDateOnly(value) {
  return isValidDateOnly(value) ? String(value) : ''
}

module.exports = {
  addUtcDays,
  addUtcMonthsClamped,
  getLastUtcDayOfMonth,
  isValidDateOnly,
  toUtcDate,
  toValidDateOnly,
}
