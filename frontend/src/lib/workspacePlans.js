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

export function getPlanRouterLimit(plan = {}) {
  const raw = plan?.router_limit

  if (raw === null || String(raw).trim().toLowerCase() === 'unlimited') {
    return null
  }

  if (raw !== undefined && raw !== '') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return extractRouterLimitFromFeatures(plan?.features)
}

export function getPlanRouterLabel(plan = {}) {
  const routerLimit = getPlanRouterLimit(plan)

  if (routerLimit === null) return 'Unlimited MikroTik routers'
  if (!Number.isFinite(routerLimit)) return 'Router allocation set by admin'
  return `Up to ${routerLimit} MikroTik router${routerLimit === 1 ? '' : 's'}`
}

export function getPlanDisplayFeatures(plan = {}) {
  const features = Array.isArray(plan?.features) ? plan.features : []
  const routerLabel = getPlanRouterLabel(plan)
  const filtered = features.filter((feature) => !/router/i.test(String(feature || '')))

  return Number.isFinite(getPlanRouterLimit(plan)) || getPlanRouterLimit(plan) === null
    ? [routerLabel, ...filtered]
    : filtered
}
