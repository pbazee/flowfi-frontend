const { getSupabaseAdmin } = require('../lib/supabase')
const { loadTenantSubscription } = require('./subscription.service')
const { serializeTenantForClient } = require('./tenant-payment.service')

async function loadTenantForClient(tenantId) {
  if (!tenantId) return null

  const db = getSupabaseAdmin()
  const { data, error } = await db.from('tenants').select('*').eq('id', tenantId).maybeSingle()
  if (error) throw error
  if (!data) return null

  const subscription = await loadTenantSubscription(tenantId)
  return serializeTenantForClient(data, { subscription })
}

module.exports = {
  loadTenantForClient,
}
