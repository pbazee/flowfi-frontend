const { getSupabaseAdmin } = require('../lib/supabase')
const { isRelationMissingError } = require('../lib/db-compat')

const SOURCE_LABELS = {
  subscriptions: 'Subscriptions',
  shop: 'Shop Sales',
  services: 'Services',
}

function startOfUtcDay(dateValue = new Date()) {
  const date = new Date(dateValue)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(dateValue, days) {
  const date = new Date(dateValue)
  date.setUTCDate(date.getUTCDate() + Number(days || 0))
  return date
}

function formatDayKey(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 10)
}

function createBreakdown() {
  return {
    subscriptions: 0,
    shop: 0,
    services: 0,
  }
}

function normalizeAmount(...values) {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return 0
}

function isWithinRange(timestamp, fromIso, toIso) {
  if (!timestamp) return false

  const time = new Date(timestamp).getTime()
  if (Number.isNaN(time)) return false

  if (fromIso && time < new Date(fromIso).getTime()) return false
  if (toIso && time > new Date(toIso).getTime()) return false
  return true
}

async function safeSelect(table, builder) {
  const db = getSupabaseAdmin()

  try {
    const query = builder(db.from(table))
    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (error) {
    if (isRelationMissingError(error, table)) {
      return []
    }

    throw error
  }
}

async function loadSubscriptionRows() {
  return safeSelect('workspace_orders', (query) =>
    query.select('id, tenant_id, business_name, total, amount, paid_at, created_at, payment_status')
  )
}

async function loadShopRows() {
  return safeSelect('shop_orders', (query) =>
    query.select('id, total, paid_at, created_at, payment_status')
  )
}

function normalizeServicePaymentRows(rows = []) {
  return rows
    .filter((row) => {
      const paymentStatus = String(row.payment_status || '').toLowerCase()
      const status = String(row.status || '').toLowerCase()

      return (
        row.payment_confirmed === true ||
        ['paid', 'success', 'confirmed'].includes(paymentStatus) ||
        ['paid', 'confirmed', 'completed'].includes(status)
      )
    })
    .map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id || null,
      tenant_name: row.tenant_name || row.business_name || row.customer_name || null,
      amount: normalizeAmount(row.amount, row.total_amount, row.total, row.quoted_amount, row.paid_amount),
      paid_at: row.paid_at || row.confirmed_at || row.updated_at || row.created_at,
    }))
    .filter((row) => row.amount > 0 && row.paid_at)
}

async function loadServiceRows() {
  const candidates = ['service_requests', 'service_orders']

  for (const table of candidates) {
    const rows = await safeSelect(table, (query) => query.select('*'))
    const normalized = normalizeServicePaymentRows(rows)

    if (normalized.length > 0) {
      return normalized
    }
  }

  return []
}

function buildRevenueRows({ subscriptionRows = [], shopRows = [], serviceRows = [] }, fromIso, toIso) {
  const rows = []

  for (const row of subscriptionRows) {
    if (String(row.payment_status || '').toLowerCase() !== 'paid') continue

    const paidAt = row.paid_at || row.created_at
    if (!isWithinRange(paidAt, fromIso, toIso)) continue

    rows.push({
      source: 'subscriptions',
      amount: normalizeAmount(row.total, row.amount),
      timestamp: paidAt,
      tenantId: row.tenant_id || null,
      tenantName: row.business_name || null,
    })
  }

  for (const row of shopRows) {
    if (String(row.payment_status || '').toLowerCase() !== 'paid') continue

    const paidAt = row.paid_at || row.created_at
    if (!isWithinRange(paidAt, fromIso, toIso)) continue

    rows.push({
      source: 'shop',
      amount: normalizeAmount(row.total),
      timestamp: paidAt,
      tenantId: null,
      tenantName: null,
    })
  }

  for (const row of serviceRows) {
    if (!isWithinRange(row.paid_at, fromIso, toIso)) continue

    rows.push({
      source: 'services',
      amount: normalizeAmount(row.amount),
      timestamp: row.paid_at,
      tenantId: row.tenant_id || null,
      tenantName: row.tenant_name || null,
    })
  }

  return rows.filter((row) => row.amount > 0 && row.timestamp)
}

function summarizeRevenueRows(rows = []) {
  const totals = createBreakdown()
  const byTenant = new Map()

  for (const row of rows) {
    totals[row.source] += row.amount

    if (row.tenantId || row.tenantName) {
      const key = row.tenantId || row.tenantName
      const existing = byTenant.get(key) || {
        name: row.tenantName || 'Unknown tenant',
        revenue: 0,
      }

      existing.revenue += row.amount
      byTenant.set(key, existing)
    }
  }

  return {
    totalRevenue: Object.values(totals).reduce((sum, value) => sum + value, 0),
    breakdown: Object.entries(SOURCE_LABELS).map(([key, label]) => ({
      key,
      label,
      value: totals[key],
    })),
    byTenant: [...byTenant.values()].sort((left, right) => right.revenue - left.revenue),
  }
}

function buildTimeline(rows = [], fromDate, toDate) {
  const days = new Map()

  for (
    let cursor = startOfUtcDay(fromDate);
    cursor.getTime() <= startOfUtcDay(toDate).getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    days.set(formatDayKey(cursor), {
      date: formatDayKey(cursor),
      revenue: 0,
      subscriptions: 0,
      shop: 0,
      services: 0,
    })
  }

  for (const row of rows) {
    const key = formatDayKey(row.timestamp)
    const bucket = days.get(key)
    if (!bucket) continue

    bucket.revenue += row.amount
    bucket[row.source] += row.amount
  }

  return [...days.values()]
}

async function loadRevenueSnapshot({ days = 30, now = new Date() } = {}) {
  const endDate = new Date(now)
  const startDate = addUtcDays(startOfUtcDay(endDate), -(Number(days || 30) - 1))
  const fromIso = startDate.toISOString()
  const toIso = endDate.toISOString()

  const [subscriptionRows, shopRows, serviceRows] = await Promise.all([
    loadSubscriptionRows(),
    loadShopRows(),
    loadServiceRows(),
  ])

  const revenueRows = buildRevenueRows({ subscriptionRows, shopRows, serviceRows }, fromIso, toIso)
  const summary = summarizeRevenueRows(revenueRows)

  return {
    ...summary,
    timeline: buildTimeline(revenueRows, startDate, endDate),
    from: fromIso,
    to: toIso,
  }
}

async function loadTodayRevenueSnapshot(now = new Date()) {
  const startDate = startOfUtcDay(now)
  const [subscriptionRows, shopRows, serviceRows] = await Promise.all([
    loadSubscriptionRows(),
    loadShopRows(),
    loadServiceRows(),
  ])

  const revenueRows = buildRevenueRows(
    { subscriptionRows, shopRows, serviceRows },
    startDate.toISOString(),
    new Date(now).toISOString()
  )

  return summarizeRevenueRows(revenueRows)
}

module.exports = {
  SOURCE_LABELS,
  loadRevenueSnapshot,
  loadTodayRevenueSnapshot,
}
