const { getSupabaseAdmin } = require('../lib/supabase')
const { logger } = require('../lib/logger')
const { disconnectUser, upsertHotspotUser } = require('./mikrotik.service')
const { isRelationMissingError } = require('../lib/db-compat')

const RECENTLY_EXPIRED_WINDOW_MS = 1000 * 60 * 60 * 24 * 3

function addMinutes(dateValue, minutes) {
  const result = new Date(dateValue)
  result.setUTCMinutes(result.getUTCMinutes() + Number(minutes || 0))
  return result
}

function minutesUntil(dateValue) {
  if (!dateValue) return 0
  const diff = new Date(dateValue).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 60000))
}

function minutesBetween(start, end) {
  if (!start || !end) return 0
  return Math.max(0, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 60000))
}

function formatMikroTikDuration(totalMinutes) {
  let remaining = Math.max(1, Math.ceil(Number(totalMinutes || 0)))
  const units = [
    ['w', 60 * 24 * 7],
    ['d', 60 * 24],
    ['h', 60],
    ['m', 1],
  ]

  const parts = []
  for (const [suffix, size] of units) {
    const value = Math.floor(remaining / size)
    if (value > 0) {
      parts.push(`${value}${suffix}`)
      remaining -= value * size
    }
  }

  return parts.join('') || '1m'
}

function buildCreditNote(existingNote, minutes, reason) {
  const parts = []
  if (existingNote) parts.push(String(existingNote).trim())

  parts.push(`Session credit: +${minutes} min${reason ? ` (${reason})` : ''} at ${new Date().toISOString()}`)
  return parts.filter(Boolean).join('\n')
}

function buildDisplayIdentity(session) {
  return session?.phone || session?.mac_address || session?.username || 'guest'
}

function buildMikroTikFailureMessage(error) {
  if (!error?.message) {
    return 'Could not reach the router. Please check your MikroTik connection and try again.'
  }

  if (/timeout|connect|router|socket|network|host|authentication/i.test(error.message)) {
    return `Could not reach the router. Please check your MikroTik connection and try again. ${error.message}`
  }

  return `MikroTik sync failed. Please check the router connection and try again. ${error.message}`
}

function createCreditError(message, options = {}) {
  const error = new Error(message)
  error.statusCode = options.statusCode || 500
  error.publicMessage = options.publicMessage || message
  error.creditLogId = options.creditLogId || null
  error.creditLog = options.creditLog || null
  return error
}

async function loadTrackingRow(sessionId) {
  const db = getSupabaseAdmin()

  try {
    const { data, error } = await db
      .from('guest_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle()

    if (error) throw error
    return data
  } catch (error) {
    if (isRelationMissingError(error, 'guest_sessions')) {
      return null
    }

    throw error
  }
}

async function loadTrackingById(guestSessionId, tenantId) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('guest_sessions')
    .select('*')
    .eq('id', guestSessionId)
    .eq('tenant_id', tenantId)
    .single()

  if (error) throw error
  return data
}

async function loadSessionWithPackage(sessionId, tenantId) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('sessions')
    .select('*, packages(*)')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .single()

  if (error) throw error
  return data
}

function derivePurchasedMinutes(session, tracking) {
  if (tracking?.time_purchased !== undefined && tracking?.time_purchased !== null) {
    return Math.max(0, Number(tracking.time_purchased || 0))
  }

  if (session?.packages?.duration_minutes !== undefined && session?.packages?.duration_minutes !== null) {
    return Math.max(0, Number(session.packages.duration_minutes || 0))
  }

  return minutesBetween(session?.created_at, session?.expires_at)
}

function deriveCreditedMinutes(session, tracking, purchasedMinutes) {
  if (tracking?.time_credited !== undefined && tracking?.time_credited !== null) {
    return Math.max(0, Number(tracking.time_credited || 0))
  }

  const sessionWindow = minutesBetween(session?.created_at, session?.expires_at)
  return Math.max(0, sessionWindow - purchasedMinutes)
}

async function upsertGuestSessionTracking(session, options = {}) {
  if (!session?.id) return null

  const db = getSupabaseAdmin()
  const existingTracking = options.existingTracking || (await loadTrackingRow(session.id))
  const purchasedMinutes = derivePurchasedMinutes(session, existingTracking)
  const currentRemainingMinutes = minutesUntil(session.expires_at)
  const currentCreditedMinutes =
    deriveCreditedMinutes(session, existingTracking, purchasedMinutes) + Math.max(0, Number(options.creditMinutes || 0))
  const timeRemaining = Math.max(0, options.remainingMinutes ?? currentRemainingMinutes)
  const timeUsed = Math.max(0, purchasedMinutes + currentCreditedMinutes - timeRemaining)

  const payload = {
    session_id: session.id,
    tenant_id: session.tenant_id,
    router_id: session.router_id || null,
    package_id: session.package_id || null,
    username: session.username || null,
    phone: session.phone || null,
    mac_address: session.mac_address || null,
    time_purchased: purchasedMinutes,
    time_used: timeUsed,
    time_credited: currentCreditedMinutes,
    time_remaining: timeRemaining,
    credited_by: options.creditedBy || existingTracking?.credited_by || null,
    last_credit_reason: options.reason || existingTracking?.last_credit_reason || null,
  }

  try {
    const { data, error } = await db
      .from('guest_sessions')
      .upsert(payload, { onConflict: 'session_id' })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    if (isRelationMissingError(error, 'guest_sessions')) {
      return null
    }

    throw error
  }
}

async function ensureGuestSessionTracking(session) {
  return upsertGuestSessionTracking(session)
}

async function resolveCreditRouter(session) {
  if (session.router_id) return session.router_id

  const db = getSupabaseAdmin()
  const { data } = await db
    .from('routers')
    .select('id')
    .eq('tenant_id', session.tenant_id)
    .eq('status', 'online')
    .order('last_seen', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.id || null
}

async function insertSessionCreditLog({
  tenantId,
  guestSessionId,
  macAddress,
  phone,
  minutesCredited,
  reason,
  creditedBy,
  mikrotikSuccess,
  mikrotikError,
}) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('session_credit_log')
    .insert({
      tenant_id: tenantId,
      guest_session_id: guestSessionId,
      mac_address: macAddress || null,
      phone: phone || null,
      minutes_credited: minutesCredited,
      reason,
      credited_by: creditedBy || null,
      mikrotik_success: Boolean(mikrotikSuccess),
      mikrotik_error: mikrotikError || null,
    })
    .select('*, users(name, email)')
    .single()

  if (error) throw error
  return data
}

async function updateSessionCreditLogResult(creditLogId, tenantId, mikrotikSuccess, mikrotikError = null) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('session_credit_log')
    .update({
      mikrotik_success: Boolean(mikrotikSuccess),
      mikrotik_error: mikrotikError,
    })
    .eq('id', creditLogId)
    .eq('tenant_id', tenantId)
    .select('*, users(name, email)')
    .single()

  if (error) throw error
  return data
}

async function syncCreditedSessionOnRouter({ session, tracking }) {
  const routerId = await resolveCreditRouter(session)
  if (!routerId) {
    throw new Error('No online MikroTik router is available for this tenant right now.')
  }

  if (!session?.mac_address) {
    throw new Error('This guest session does not have a MAC address on record.')
  }

  await upsertHotspotUser(routerId, {
    username: session.username,
    password: session.password,
    profile: session.packages?.mikrotik_profile || 'default',
    comment: `FlowFi session credit ${session.id}`,
    limitUptime: formatMikroTikDuration(tracking?.time_remaining ?? minutesUntil(session.expires_at)),
  })

  await disconnectUser(routerId, session.mac_address)
  return routerId
}

async function grantGuestSessionCredit({ tenantId, sessionId, minutes, reason, creditedBy }) {
  const db = getSupabaseAdmin()
  const session = await loadSessionWithPackage(sessionId, tenantId)
  const sanitizedMinutes = Math.max(1, Number(minutes || 0))
  const currentRemainingMinutes = minutesUntil(session.expires_at)
  const newRemainingMinutes = currentRemainingMinutes + sanitizedMinutes
  const baseExpiry = currentRemainingMinutes > 0 && session.status === 'active' ? session.expires_at : new Date()
  const newExpiresAt = addMinutes(baseExpiry, sanitizedMinutes).toISOString()
  const creditNote = buildCreditNote(session.note, sanitizedMinutes, reason)
  const routerId = await resolveCreditRouter(session)

  const { data: updatedSession, error: updateError } = await db
    .from('sessions')
    .update({
      expires_at: newExpiresAt,
      status: 'active',
      router_id: routerId || session.router_id || null,
      expiry_warned: false,
      note: creditNote,
    })
    .eq('id', session.id)
    .select('*, packages(*)')
    .single()

  if (updateError) throw updateError

  const tracking = await upsertGuestSessionTracking(updatedSession, {
    creditMinutes: sanitizedMinutes,
    creditedBy,
    reason,
    remainingMinutes: newRemainingMinutes,
  })

  if (!tracking?.id) {
    throw createCreditError('Guest session tracking is unavailable for this tenant.', {
      statusCode: 500,
      publicMessage: 'Guest session tracking is unavailable right now. Please run the latest database migration and try again.',
    })
  }

  try {
    await syncCreditedSessionOnRouter({ session: updatedSession, tracking })

    const creditLog = await insertSessionCreditLog({
      tenantId,
      guestSessionId: tracking.id,
      macAddress: updatedSession.mac_address,
      phone: updatedSession.phone,
      minutesCredited: sanitizedMinutes,
      reason,
      creditedBy,
      mikrotikSuccess: true,
      mikrotikError: null,
    })

    return {
      session: updatedSession,
      tracking,
      creditLog,
      message: `${sanitizedMinutes} minutes credited to ${buildDisplayIdentity(updatedSession)}. Guest can reconnect now.`,
    }
  } catch (error) {
    logger.warn(`Guest session credit router sync failed for ${updatedSession.id}: ${error.message}`)

    let creditLog = null
    try {
      creditLog = await insertSessionCreditLog({
        tenantId,
        guestSessionId: tracking.id,
        macAddress: updatedSession.mac_address,
        phone: updatedSession.phone,
        minutesCredited: sanitizedMinutes,
        reason,
        creditedBy,
        mikrotikSuccess: false,
        mikrotikError: error.message,
      })
    } catch (logError) {
      logger.error(`Could not write session credit log for ${updatedSession.id}: ${logError.message}`)
    }

    throw createCreditError(error.message, {
      statusCode: 502,
      publicMessage: buildMikroTikFailureMessage(error),
      creditLogId: creditLog?.id || null,
      creditLog,
    })
  }
}

async function retrySessionCreditSync({ tenantId, creditLogId }) {
  const db = getSupabaseAdmin()
  const { data: creditLog, error } = await db
    .from('session_credit_log')
    .select('*, guest_sessions(*), users(name, email)')
    .eq('id', creditLogId)
    .eq('tenant_id', tenantId)
    .single()

  if (error) throw error
  if (!creditLog?.guest_sessions?.session_id) {
    throw createCreditError('Credit log not found for this tenant.', {
      statusCode: 404,
      publicMessage: 'We could not find that failed credit. Please search again.',
    })
  }

  const session = await loadSessionWithPackage(creditLog.guest_sessions.session_id, tenantId)

  try {
    await syncCreditedSessionOnRouter({ session, tracking: creditLog.guest_sessions })
    const updatedLog = await updateSessionCreditLogResult(creditLogId, tenantId, true, null)

    return {
      session,
      tracking: creditLog.guest_sessions,
      creditLog: updatedLog,
      message: `${creditLog.minutes_credited} minutes credited to ${buildDisplayIdentity(session)}. Guest can reconnect now.`,
    }
  } catch (syncError) {
    logger.warn(`Guest session credit retry failed for ${creditLogId}: ${syncError.message}`)

    let updatedLog = null
    try {
      updatedLog = await updateSessionCreditLogResult(creditLogId, tenantId, false, syncError.message)
    } catch (updateError) {
      logger.error(`Could not update session credit log ${creditLogId}: ${updateError.message}`)
    }

    throw createCreditError(syncError.message, {
      statusCode: 502,
      publicMessage: buildMikroTikFailureMessage(syncError),
      creditLogId,
      creditLog: updatedLog,
    })
  }
}

async function syncGuestSessionTracking(sessionId, tenantId) {
  const session = await loadSessionWithPackage(sessionId, tenantId)
  return upsertGuestSessionTracking(session)
}

function rankCreditableSession(session) {
  if (session.status === 'active') return 0

  const endsAt = new Date(session.expires_at || session.created_at).getTime()
  if (['expired', 'terminated'].includes(session.status) && endsAt >= Date.now() - RECENTLY_EXPIRED_WINDOW_MS) {
    return 1
  }

  return 2
}

async function searchCreditableSessions({ tenantId, query = '', limit = 10 }) {
  const db = getSupabaseAdmin()
  const searchTerm = String(query || '').trim().replace(/[,%]/g, ' ')

  let request = db
    .from('sessions')
    .select('*, packages(name, duration_minutes, mikrotik_profile)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(Math.max(limit * 2, 12))

  if (searchTerm) {
    request = request.or(
      `phone.ilike.%${searchTerm}%,mac_address.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`
    )
  }

  const { data, error } = await request
  if (error) throw error

  const rows = data || []
  let trackingBySessionId = new Map()

  if (rows.length) {
    try {
      const trackingRows = await db
        .from('guest_sessions')
        .select('*')
        .in('session_id', rows.map((row) => row.id))

      if (trackingRows.error) throw trackingRows.error
      trackingBySessionId = new Map((trackingRows.data || []).map((row) => [row.session_id, row]))
    } catch (trackingError) {
      if (!isRelationMissingError(trackingError, 'guest_sessions')) {
        throw trackingError
      }
    }
  }

  return rows
    .map((row) => ({
      ...row,
      guest_tracking: trackingBySessionId.get(row.id) || null,
    }))
    .filter((row) => rankCreditableSession(row) < 2)
    .sort((a, b) => {
      const rankDelta = rankCreditableSession(a) - rankCreditableSession(b)
      if (rankDelta !== 0) return rankDelta
      return new Date(b.expires_at || b.created_at).getTime() - new Date(a.expires_at || a.created_at).getTime()
    })
    .slice(0, limit)
}

async function listSessionCreditHistory({ tenantId, limit = 50 }) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('session_credit_log')
    .select('*, users(name, email)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isRelationMissingError(error, 'session_credit_log')) {
      return []
    }

    throw error
  }

  return data || []
}

module.exports = {
  ensureGuestSessionTracking,
  grantGuestSessionCredit,
  listSessionCreditHistory,
  retrySessionCreditSync,
  searchCreditableSessions,
  syncGuestSessionTracking,
}
