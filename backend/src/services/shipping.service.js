const { randomUUID } = require('crypto')
const { getSupabaseAdmin } = require('../lib/supabase')

const DEFAULT_COUNTRIES = ['Kenya']

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeList(values) {
  if (Array.isArray(values)) {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
  }

  if (typeof values === 'string') {
    return [...new Set(values.split(',').map((value) => value.trim()).filter(Boolean))]
  }

  return []
}

function resolveZoneCountries(zone = {}) {
  const countries = normalizeList(zone.countries)
  if (countries.length > 0) return countries

  const hasLegacyLocationData =
    normalizeList(zone.counties).length > 0 ||
    normalizeList(zone.regions).length > 0 ||
    normalizeList(zone.towns).length > 0

  return hasLegacyLocationData ? ['Kenya'] : []
}

function serializeShippingZone(zone = {}) {
  return {
    id: zone.id,
    name: zone.name,
    countries: resolveZoneCountries(zone),
    counties: normalizeList(zone.counties),
    regions: normalizeList(zone.regions),
    towns: normalizeList(zone.towns),
    price: Number(zone.price || 0),
    estimated_days:
      zone.estimated_days === null || zone.estimated_days === undefined || zone.estimated_days === ''
        ? null
        : Number(zone.estimated_days),
    is_active: zone.is_active !== false,
    created_at: zone.created_at,
    updated_at: zone.updated_at,
  }
}

function normalizeZoneInput(zone = {}, index = 0) {
  return {
    id: zone.id || randomUUID(),
    name: String(zone.name || `Zone ${index + 1}`).trim(),
    countries: normalizeList(zone.countries),
    counties: normalizeList(zone.counties),
    regions: normalizeList(zone.regions),
    towns: normalizeList(zone.towns),
    price: Number(zone.price || 0),
    estimated_days:
      zone.estimated_days === null || zone.estimated_days === undefined || zone.estimated_days === ''
        ? null
        : Math.max(1, Number(zone.estimated_days)),
    is_active: zone.is_active !== false,
  }
}

function getZoneMatchScore(zone, destination = {}) {
  const country = normalizeToken(destination.country)
  const town = normalizeToken(destination.town)
  const region = normalizeToken(destination.region)
  const county = normalizeToken(destination.county)
  const countries = resolveZoneCountries(zone).map(normalizeToken)
  const towns = normalizeList(zone.towns).map(normalizeToken)
  const regions = normalizeList(zone.regions).map(normalizeToken)
  const counties = normalizeList(zone.counties).map(normalizeToken)

  if (countries.length > 0) {
    if (!country || !countries.includes(country)) {
      return 0
    }
  }

  if (town && towns.includes(town)) return 400
  if (region && regions.includes(region)) return 300
  if (county && counties.includes(county)) return 200
  if (country && countries.includes(country)) return 100

  if (countries.length === 0 && towns.length === 0 && regions.length === 0 && counties.length === 0) {
    return 1
  }

  return 0
}

async function loadShippingZones({ includeInactive = false } = {}) {
  const db = getSupabaseAdmin()
  let query = db
    .from('shipping_zones')
    .select('*')
    .order('is_active', { ascending: false })
    .order('price', { ascending: true })
    .order('name', { ascending: true })

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(serializeShippingZone)
}

async function replaceShippingZones(zonesInput = []) {
  const db = getSupabaseAdmin()
  const zones = zonesInput
    .map((zone, index) => normalizeZoneInput(zone, index))
    .filter((zone) => zone.name)

  const { data: existingZones, error: existingError } = await db.from('shipping_zones').select('id')
  if (existingError) throw existingError

  const existingIds = new Set((existingZones || []).map((zone) => zone.id))
  const incomingIds = new Set(zones.map((zone) => zone.id))
  const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id))

  if (zones.length > 0) {
    const { error: upsertError } = await db.from('shipping_zones').upsert(zones, { onConflict: 'id' })
    if (upsertError) throw upsertError
  } else if (existingIds.size > 0) {
    const { error: clearError } = await db.from('shipping_zones').delete().in('id', [...existingIds])
    if (clearError) throw clearError
  }

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await db.from('shipping_zones').delete().in('id', idsToDelete)
    if (deleteError) throw deleteError
  }

  return loadShippingZones({ includeInactive: true })
}

function buildShippingOptions(zones = []) {
  const countries = new Set()
  const counties = new Set()
  const regions = new Set()
  const towns = new Set()
  const regionToTowns = {}

  for (const zone of zones) {
    const zoneCountries = resolveZoneCountries(zone)
    const zoneCounties = normalizeList(zone.counties)
    const zoneRegions = normalizeList(zone.regions)
    const zoneTowns = normalizeList(zone.towns)

    zoneCountries.forEach((entry) => countries.add(entry))
    zoneCounties.forEach((entry) => counties.add(entry))
    zoneRegions.forEach((entry) => regions.add(entry))
    zoneTowns.forEach((entry) => towns.add(entry))

    // Map each region in this zone to its towns
    for (const region of zoneRegions) {
      if (!regionToTowns[region]) regionToTowns[region] = new Set()
      zoneTowns.forEach((town) => regionToTowns[region].add(town))
    }
  }

  // Convert Sets to sorted Arrays
  const sortedRegionToTowns = {}
  Object.keys(regionToTowns).forEach((region) => {
    sortedRegionToTowns[region] = [...regionToTowns[region]].sort((a, b) => a.localeCompare(b))
  })

  return {
    countries: countries.size > 0 ? [...countries].sort((a, b) => a.localeCompare(b)) : DEFAULT_COUNTRIES,
    counties: [...counties].sort((a, b) => a.localeCompare(b)),
    regions: [...regions].sort((a, b) => a.localeCompare(b)),
    towns: [...towns].sort((a, b) => a.localeCompare(b)),
    regionToTowns: sortedRegionToTowns,
  }
}

async function quoteShipping(destination = {}) {
  const zones = await loadShippingZones()
  const matches = zones
    .map((zone) => ({ zone, score: getZoneMatchScore(zone, destination) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (left.zone.price !== right.zone.price) return left.zone.price - right.zone.price
      return String(left.zone.name || '').localeCompare(String(right.zone.name || ''))
    })

  const bestMatch = matches[0]?.zone || null

  if (!bestMatch) {
    return {
      matched: false,
      status: 'manual_quote',
      zone: null,
      price: 0,
      estimated_days: null,
      message: 'Contact us for shipping quote.',
    }
  }

  return {
    matched: true,
    status: 'matched',
    zone: bestMatch,
    price: Number(bestMatch.price || 0),
    estimated_days: bestMatch.estimated_days ?? null,
    message:
      bestMatch.estimated_days
        ? `Shipping to ${bestMatch.name} usually takes about ${bestMatch.estimated_days} day(s).`
        : `Shipping available for ${bestMatch.name}.`,
  }
}

module.exports = {
  buildShippingOptions,
  loadShippingZones,
  normalizeList,
  quoteShipping,
  replaceShippingZones,
  serializeShippingZone,
}
