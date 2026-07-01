const { DEFAULT_WORKSPACE_PLANS } = require('./defaultPlatformContent')

function parseJson(value, fallback) {
  if (!value) return fallback

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function extractRouterLimitFromFeatures(features = []) {
  for (const feature of features) {
    const text = String(feature || '').trim()
    if (!text) continue

    if (/unlimited\s+(mikrotik\s+)?routers/i.test(text)) {
      return null
    }

    const match = text.match(/up to\s+(\d+)\s+(mikrotik\s+)?routers?/i)
    if (match) {
      return Number(match[1])
    }
  }

  return undefined
}

function normalizeRouterLimit(plan = {}) {
  const raw = plan.router_limit

  if (raw === null || String(raw).trim().toLowerCase() === 'unlimited') {
    return null
  }

  if (raw !== undefined && raw !== '') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return extractRouterLimitFromFeatures(plan.features)
}

function parseWorkspacePlans(settingValue) {
  return parseJson(settingValue, DEFAULT_WORKSPACE_PLANS).map((plan) => ({
    ...plan,
    router_limit: normalizeRouterLimit(plan),
    trial_days: Math.max(0, Number(plan?.trial_days || 0) || 0),
  }))
}

function getWorkspacePlan(plans = [], planId, planName) {
  if (!Array.isArray(plans) || plans.length === 0) return null

  // First try exact id match
  const byId = plans.find((plan) => plan.id === planId)
  if (byId) return byId

  // Then try case-insensitive name match
  const nameLookup = String(planName || '').trim().toLowerCase()
  if (nameLookup) {
    const byName = plans.find((plan) => String(plan.name || '').trim().toLowerCase() === nameLookup)
    if (byName) return byName
  }

  return null
}

function getRouterLimitLabel(limit) {
  if (limit === null) return 'Unlimited MikroTik routers'
  if (!Number.isFinite(Number(limit)) || Number(limit) <= 0) return 'Router allocation set by admin'
  return `Up to ${Number(limit)} MikroTik router${Number(limit) === 1 ? '' : 's'}`
}

module.exports = {
  getRouterLimitLabel,
  getWorkspacePlan,
  normalizeRouterLimit,
  parseWorkspacePlans,
}
