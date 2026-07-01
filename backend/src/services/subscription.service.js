const { getSupabaseAdmin } = require('../lib/supabase')
const { logger } = require('../lib/logger')
const { DEFAULT_WORKSPACE_PLANS } = require('../lib/defaultPlatformContent')
const { parseWorkspacePlans, getWorkspacePlan } = require('../lib/workspacePlans')
const { isRelationMissingError } = require('../lib/db-compat')
const { addUtcDays, addUtcMonthsClamped } = require('../lib/date')
const {
  sendSubscriptionInvoiceNotification,
  sendTenantGraceGrantedNotification,
  sendTrialEndingTomorrowNotification,
  sendTrialPastDueNotification,
  sendWorkspaceSuspendedNotification,
  sendWorkspaceTrialNotification,
} = require('./notification.service')

const TRIAL_GRACE_DAYS = 3

function slugify(value, fallback = 'plan') {
  const base = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return base || fallback
}

function normalizeBillingPeriod(value) {
  const raw = String(value || 'monthly').trim().toLowerCase()

  if (['year', 'yearly', 'annual', 'annually'].includes(raw)) return 'yearly'
  if (['quarter', 'quarterly'].includes(raw)) return 'quarterly'
  if (['week', 'weekly'].includes(raw)) return 'weekly'
  if (['day', 'daily'].includes(raw)) return 'daily'
  return 'monthly'
}

function normalizePlanRecord(plan = {}, index = 0) {
  const id = slugify(plan.id || plan.name || `plan-${index + 1}`)
  const features = Array.isArray(plan.features) ? plan.features.map((feature) => String(feature || '').trim()).filter(Boolean) : []
  const trialDays = Math.max(0, Number(plan.trial_days || 0) || 0)
  const rawRouterLimit = plan.router_limit
  const routerLimit =
    rawRouterLimit === null || String(rawRouterLimit).trim().toLowerCase() === 'unlimited'
      ? null
      : Number.isFinite(Number(rawRouterLimit)) && Number(rawRouterLimit) > 0
        ? Number(rawRouterLimit)
        : undefined

  return {
    id,
    name: String(plan.name || `Plan ${index + 1}`).trim(),
    price: Number(plan.price || 0),
    period: normalizeBillingPeriod(plan.period),
    router_limit: routerLimit,
    description: String(plan.description || '').trim(),
    features,
    featured: Boolean(plan.featured),
    trial_days: trialDays,
    is_active: plan.is_active !== false,
    sort_order: Number.isFinite(Number(plan.sort_order)) ? Number(plan.sort_order) : index,
  }
}

function addDays(dateValue, days) {
  return addUtcDays(dateValue, days)
}

function addBillingInterval(dateValue, billingPeriod = 'monthly') {
  const period = normalizeBillingPeriod(billingPeriod)
  const result = new Date(dateValue)

  if (period === 'yearly') {
    return addUtcMonthsClamped(result, 12)
  }

  if (period === 'quarterly') {
    return addUtcMonthsClamped(result, 3)
  }

  if (period === 'weekly') {
    result.setUTCDate(result.getUTCDate() + 7)
    return result
  }

  if (period === 'daily') {
    result.setUTCDate(result.getUTCDate() + 1)
    return result
  }

  return addUtcMonthsClamped(result, 1)
}

function serializePlan(plan = {}) {
  return {
    id: plan.id,
    name: plan.name,
    price: Number(plan.price || 0),
    period: normalizeBillingPeriod(plan.period),
    router_limit: plan.router_limit === null ? null : Number.isFinite(Number(plan.router_limit)) ? Number(plan.router_limit) : undefined,
    description: plan.description || '',
    features: Array.isArray(plan.features) ? plan.features : [],
    featured: Boolean(plan.featured),
    trial_days: Math.max(0, Number(plan.trial_days || 0) || 0),
    is_active: plan.is_active !== false,
    sort_order: Number.isFinite(Number(plan.sort_order)) ? Number(plan.sort_order) : 0,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  }
}

async function loadPlansFromSettings(db) {
  const { data, error } = await db
    .from('platform_settings')
    .select('value')
    .eq('key', 'workspace_plans')
    .maybeSingle()

  if (error) throw error

  return parseWorkspacePlans(data?.value || JSON.stringify(DEFAULT_WORKSPACE_PLANS)).map((plan, index) =>
    normalizePlanRecord(plan, index)
  )
}

async function syncPlansSetting(plans = []) {
  const db = getSupabaseAdmin()
  const payload = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: Number(plan.price || 0),
    period: normalizeBillingPeriod(plan.period),
    router_limit: plan.router_limit ?? null,
    description: plan.description || '',
    features: Array.isArray(plan.features) ? plan.features : [],
    featured: Boolean(plan.featured),
    trial_days: Math.max(0, Number(plan.trial_days || 0) || 0),
  }))

  await db.from('platform_settings').upsert(
    {
      key: 'workspace_plans',
      value: JSON.stringify(payload),
      description: 'Public workspace pricing plans',
    },
    { onConflict: 'key' }
  )
}

async function loadWorkspacePlans({ includeInactive = false } = {}) {
  const db = getSupabaseAdmin()

  try {
    let query = db.from('plans').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) throw error

    if (Array.isArray(data) && data.length > 0) {
      return data.map(serializePlan)
    }
  } catch (error) {
    logger.warn(`Falling back to workspace plans setting: ${error.message}`)
  }

  return loadPlansFromSettings(db)
}

async function loadWorkspacePlanById(planId) {
  const plans = await loadWorkspacePlans({ includeInactive: true })
  // Support lookup by id or by name (case-insensitive)
  return getWorkspacePlan(plans || [], planId, planId) || null
}

async function replacePlans(plansInput = []) {
  const db = getSupabaseAdmin()
  const normalizedPlans = plansInput
    .map((plan, index) => normalizePlanRecord(plan, index))
    .filter((plan) => plan.name)

  if (normalizedPlans.length === 0) {
    throw new Error('At least one plan is required')
  }

  const { data: existingPlans, error: existingError } = await db.from('plans').select('id')
  if (existingError) throw existingError

  const existingIds = new Set((existingPlans || []).map((plan) => plan.id))
  const incomingIds = new Set(normalizedPlans.map((plan) => plan.id))
  const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id))

  const { error: upsertError } = await db.from('plans').upsert(normalizedPlans, { onConflict: 'id' })
  if (upsertError) throw upsertError

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await db.from('plans').delete().in('id', idsToDelete)
    if (deleteError) throw deleteError
  }

  await syncPlansSetting(normalizedPlans)
  return loadWorkspacePlans({ includeInactive: true })
}

function buildScheduleSnapshot(startedAt, billingPeriod) {
  const currentPeriodStartsAt = new Date(startedAt)
  const currentPeriodEndsAt = addBillingInterval(currentPeriodStartsAt, billingPeriod)

  return {
    current_period_starts_at: currentPeriodStartsAt.toISOString(),
    current_period_ends_at: currentPeriodEndsAt.toISOString(),
    next_billing_date: currentPeriodEndsAt.toISOString(),
  }
}

async function loadTenantSubscription(tenantId) {
  if (!tenantId) return null

  const db = getSupabaseAdmin()
  try {
    const { data, error } = await db
      .from('tenant_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) throw error
    return data
  } catch (error) {
    if (isRelationMissingError(error, 'tenant_subscriptions')) {
      logger.warn('tenant_subscriptions table is missing; continuing without subscription details')
      return null
    }

    throw error
  }
}

async function generateSubscriptionInvoice(subscription, options = {}) {
  if (!subscription?.tenant_id || !subscription?.id) return null

  const db = getSupabaseAdmin()
  const periodStart = new Date(options.periodStart || subscription.current_period_starts_at || subscription.billing_starts_at || new Date())
  const periodEnd = new Date(options.periodEnd || subscription.current_period_ends_at || addBillingInterval(periodStart, subscription.billing_period))
  const dueAt = new Date(options.dueAt || periodStart)

  const payload = {
    subscription_id: subscription.id,
    tenant_id: subscription.tenant_id,
    plan_id: subscription.plan_id,
    plan_name: subscription.plan_name,
    billing_period: normalizeBillingPeriod(subscription.billing_period),
    amount: Number(options.amount ?? subscription.amount ?? 0),
    invoice_type: options.invoiceType || 'renewal',
    status: options.status || 'pending',
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    due_at: dueAt.toISOString(),
    description:
      options.description ||
      `${subscription.plan_name} ${options.invoiceType === 'initial' ? 'subscription start' : 'renewal'} invoice`,
    metadata: options.metadata || {},
  }

  let data = null
  try {
    const result = await db
      .from('tenant_invoices')
      .upsert(payload, { onConflict: 'subscription_id,period_start' })
      .select()
      .single()

    if (result.error) throw result.error
    data = result.data
  } catch (error) {
    if (isRelationMissingError(error, 'tenant_invoices')) {
      logger.warn('tenant_invoices table is missing; skipping invoice generation')
      return null
    }

    throw error
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('name, contact_email')
    .eq('id', subscription.tenant_id)
    .maybeSingle()

  if (tenant?.contact_email) {
    await sendSubscriptionInvoiceNotification({
      email: tenant.contact_email,
      tenantName: tenant.name,
      planName: subscription.plan_name,
      amount: payload.amount,
      invoiceType: payload.invoice_type,
      dueAt: payload.due_at,
      periodStart: payload.period_start,
      periodEnd: payload.period_end,
    })
  }

  return data
}

async function createTenantSubscription({ tenantId, plan, metadata = {}, signupContext = {} }) {
  const db = getSupabaseAdmin()
  try {
    const startedAt = new Date()
    const trialDays = Math.max(0, Number(plan?.trial_days || 0) || 0)
    const billingPeriod = normalizeBillingPeriod(plan?.period)
    const trialEndsAt = addDays(startedAt, trialDays)
    const isTrialing = trialDays > 0
    const activeSchedule = !isTrialing ? buildScheduleSnapshot(startedAt, billingPeriod) : null

    const payload = {
      tenant_id: tenantId,
      plan_id: plan?.id || null,
      plan_name: plan?.name || 'Workspace plan',
      billing_period: billingPeriod,
      amount: Number(plan?.price || 0),
      status: isTrialing ? 'trialing' : 'active',
      trial_days: trialDays,
      trial_starts_at: startedAt.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      billing_starts_at: trialEndsAt.toISOString(),
      next_billing_date: trialEndsAt.toISOString(),
      metadata,
    }

    if (!isTrialing) {
      Object.assign(payload, {
        billing_starts_at: startedAt.toISOString(),
        ...activeSchedule,
        next_billing_date: activeSchedule.next_billing_date,
        last_invoiced_at: startedAt.toISOString(),
      })
    }

    const { data: subscription, error } = await db
      .from('tenant_subscriptions')
      .upsert(payload, { onConflict: 'tenant_id' })
      .select()
      .single()

    if (error) throw error

    try {
      const { error: updateError } = await db
        .from('tenants')
        .update({
          status: isTrialing ? 'trialing' : 'active',
          workspace_plan_id: plan?.id || null,
          workspace_plan_name: plan?.name || null,
          workspace_billing_period: billingPeriod,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId)

      if (updateError) throw updateError
    } catch (err) {
      // If the tenants table doesn't have any workspace_* column, retry without them
      if (String(err?.message || err).includes('workspace_')) {
        const { error: fallbackError } = await db
          .from('tenants')
          .update({
            status: isTrialing ? 'trialing' : 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantId)

        if (fallbackError) throw fallbackError
      } else {
        throw err
      }
    }

    if (isTrialing) {
      await sendWorkspaceTrialNotification({
        email: signupContext.email,
        name: signupContext.name,
        businessName: signupContext.businessName,
        planName: subscription.plan_name,
        trialDays,
        trialEndsAt: subscription.trial_ends_at,
      })
    } else {
      await generateSubscriptionInvoice(subscription, {
        invoiceType: 'initial',
        periodStart: subscription.current_period_starts_at,
        periodEnd: subscription.current_period_ends_at,
        dueAt: subscription.billing_starts_at,
      })
    }

    return subscription
  } catch (err) {
    logger.warn(`Could not create tenant subscription: ${err.message}`)
    return null
  }
}

async function updateTenantWorkspaceStatus(tenantId, status, referenceDate = new Date()) {
  if (!tenantId) return null
  const db = getSupabaseAdmin()
  const updates = {
    status,
    updated_at: new Date(referenceDate).toISOString(),
  }

  try {
    const { data, error } = await db
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select()
      .maybeSingle()

    if (error) throw error
    return data
  } catch (error) {
    logger.warn(`Could not update tenant ${tenantId} status to ${status}: ${error.message}`)
    return null
  }
}

function resolveTrialGraceEnd(subscription, referenceDate = new Date()) {
  const anchor = subscription?.trial_ends_at || subscription?.billing_starts_at || referenceDate
  return addDays(anchor, TRIAL_GRACE_DAYS)
}

async function listSubscriptionsByStatus(statuses = []) {
  const db = getSupabaseAdmin()
  const normalizedStatuses = Array.isArray(statuses) ? statuses.filter(Boolean) : [statuses].filter(Boolean)

  let data = []
  try {
    let query = db.from('tenant_subscriptions').select('*')
    if (normalizedStatuses.length === 1) {
      query = query.eq('status', normalizedStatuses[0])
    } else if (normalizedStatuses.length > 1) {
      query = query.in('status', normalizedStatuses)
    }

    const result = await query

    if (result.error) throw result.error
    data = result.data || []
  } catch (error) {
    if (isRelationMissingError(error, 'tenant_subscriptions')) {
      logger.warn('tenant_subscriptions table is missing; skipping subscription status processing')
      return []
    }

    throw error
  }

  return data
}

async function loadTenantContactProfile(tenantId) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('tenants')
    .select('id, name, contact_email, contact_phone')
    .eq('id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function sendTrialEndingWarnings(referenceDate = new Date()) {
  const subscriptions = await listSubscriptionsByStatus('trialing')
  const now = new Date(referenceDate).getTime()
  const warningWindowEnd = now + 24 * 60 * 60 * 1000
  const db = getSupabaseAdmin()
  const processed = []

  for (const subscription of subscriptions) {
    const trialEndsAt = new Date(subscription.trial_ends_at || 0).getTime()
    if (!trialEndsAt || Number.isNaN(trialEndsAt)) continue
    if (subscription.trial_ending_warning_sent_at) continue
    if (trialEndsAt <= now || trialEndsAt > warningWindowEnd) continue

    const tenant = await loadTenantContactProfile(subscription.tenant_id)
    await sendTrialEndingTomorrowNotification({
      email: tenant?.contact_email,
      phone: tenant?.contact_phone,
      tenantName: tenant?.name,
      trialEndsAt: subscription.trial_ends_at,
    })

    const { data: updatedSubscription, error } = await db
      .from('tenant_subscriptions')
      .update({
        trial_ending_warning_sent_at: new Date(referenceDate).toISOString(),
        updated_at: new Date(referenceDate).toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single()

    if (error) throw error
    processed.push(updatedSubscription)
  }

  return processed
}

async function moveExpiredTrialsToPastDue(referenceDate = new Date()) {
  const db = getSupabaseAdmin()
  const now = new Date(referenceDate).getTime()
  const subscriptions = await listSubscriptionsByStatus('trialing')
  const processed = []

  for (const subscription of subscriptions) {
    const trialEndsAt = new Date(subscription.trial_ends_at || 0).getTime()
    if (!trialEndsAt || Number.isNaN(trialEndsAt) || trialEndsAt > now) continue

    const billingStart = new Date(subscription.billing_starts_at || subscription.trial_ends_at || referenceDate)
    const schedule = buildScheduleSnapshot(billingStart, subscription.billing_period)
    const nowIso = new Date(referenceDate).toISOString()

    const { data: updatedSubscription, error } = await db
      .from('tenant_subscriptions')
      .update({
        status: 'past_due',
        billing_starts_at: billingStart.toISOString(),
        current_period_starts_at: schedule.current_period_starts_at,
        current_period_ends_at: schedule.current_period_ends_at,
        next_billing_date: billingStart.toISOString(),
        updated_at: nowIso,
      })
      .eq('id', subscription.id)
      .select()
      .single()

    if (error) throw error

    await updateTenantWorkspaceStatus(subscription.tenant_id, 'past_due', referenceDate)

    await generateSubscriptionInvoice(updatedSubscription, {
      invoiceType: 'initial',
      periodStart: updatedSubscription.current_period_starts_at,
      periodEnd: updatedSubscription.current_period_ends_at,
      dueAt: billingStart.toISOString(),
      status: 'pending',
    })

    const tenant = await loadTenantContactProfile(subscription.tenant_id)
    await sendTrialPastDueNotification({
      email: tenant?.contact_email,
      phone: tenant?.contact_phone,
      tenantName: tenant?.name,
      graceEndsAt: resolveTrialGraceEnd(updatedSubscription, referenceDate).toISOString(),
    })

    processed.push(updatedSubscription)
  }

  return processed
}

async function suspendPastDueWorkspaces(referenceDate = new Date()) {
  const db = getSupabaseAdmin()
  const now = new Date(referenceDate).getTime()
  const subscriptions = await listSubscriptionsByStatus('past_due')
  const processed = []

  for (const subscription of subscriptions) {
    const graceEndsAt = resolveTrialGraceEnd(subscription, referenceDate)
    if (graceEndsAt.getTime() > now) continue

    const { data: updatedSubscription, error } = await db
      .from('tenant_subscriptions')
      .update({
        status: 'suspended',
        updated_at: new Date(referenceDate).toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single()

    if (error) throw error

    await updateTenantWorkspaceStatus(subscription.tenant_id, 'suspended', referenceDate)

    const tenant = await loadTenantContactProfile(subscription.tenant_id)
    await sendWorkspaceSuspendedNotification({
      email: tenant?.contact_email,
      phone: tenant?.contact_phone,
      tenantName: tenant?.name,
    })

    processed.push(updatedSubscription)
  }

  return processed
}

async function processDueRenewals(referenceDate = new Date()) {
  const db = getSupabaseAdmin()
  const nowIso = new Date(referenceDate).toISOString()
  let data = []

  try {
    const result = await db
      .from('tenant_subscriptions')
      .select('*')
      .eq('status', 'active')
      .lte('next_billing_date', nowIso)

    if (result.error) throw result.error
    data = result.data || []
  } catch (error) {
    if (isRelationMissingError(error, 'tenant_subscriptions')) {
      logger.warn('tenant_subscriptions table is missing; skipping renewal processing')
      return []
    }

    throw error
  }

  const processed = []

  for (const subscription of data || []) {
    const periodStart = new Date(subscription.next_billing_date || referenceDate)
    const schedule = buildScheduleSnapshot(periodStart, subscription.billing_period)

    const { data: updatedSubscription, error: updateError } = await db
      .from('tenant_subscriptions')
      .update({
        current_period_starts_at: periodStart.toISOString(),
        current_period_ends_at: schedule.current_period_ends_at,
        next_billing_date: schedule.next_billing_date,
        last_invoiced_at: new Date(referenceDate).toISOString(),
        updated_at: new Date(referenceDate).toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single()

    if (updateError) throw updateError

    const invoice = await generateSubscriptionInvoice(updatedSubscription, {
      invoiceType: 'renewal',
      periodStart: updatedSubscription.current_period_starts_at,
      periodEnd: updatedSubscription.current_period_ends_at,
      dueAt: periodStart.toISOString(),
    })

    processed.push({ subscription: updatedSubscription, invoice })
  }

  return processed
}

async function reactivateTenantSubscription({
  tenantId,
  referenceDate = new Date(),
  markLatestInvoicePaid = false,
} = {}) {
  if (!tenantId) {
    throw new Error('tenantId is required to reactivate a subscription')
  }

  const db = getSupabaseAdmin()
  const subscription = await loadTenantSubscription(tenantId)
  if (!subscription) {
    throw new Error('Tenant subscription not found')
  }

  const billingAnchor = new Date(referenceDate)
  const schedule = buildScheduleSnapshot(billingAnchor, subscription.billing_period)
  const updatePayload = {
    status: 'active',
    billing_starts_at: billingAnchor.toISOString(),
    current_period_starts_at: schedule.current_period_starts_at,
    current_period_ends_at: schedule.current_period_ends_at,
    next_billing_date: schedule.next_billing_date,
    last_invoiced_at: billingAnchor.toISOString(),
    updated_at: billingAnchor.toISOString(),
  }

  const { data: updatedSubscription, error } = await db
    .from('tenant_subscriptions')
    .update(updatePayload)
    .eq('id', subscription.id)
    .select()
    .single()

  if (error) throw error

  await updateTenantWorkspaceStatus(tenantId, 'active', referenceDate)

  if (markLatestInvoicePaid) {
    try {
      const { data: pendingInvoices, error: invoiceError } = await db
        .from('tenant_invoices')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      if (invoiceError) throw invoiceError

      if (pendingInvoices?.[0]?.id) {
        await db
          .from('tenant_invoices')
          .update({
            status: 'paid',
            paid_at: billingAnchor.toISOString(),
            updated_at: billingAnchor.toISOString(),
          })
          .eq('id', pendingInvoices[0].id)
      }
    } catch (invoiceError) {
      if (!isRelationMissingError(invoiceError, 'tenant_invoices')) {
        throw invoiceError
      }
    }
  }

  return updatedSubscription
}

async function runDailySubscriptionBilling(referenceDate = new Date()) {
  const trialWarnings = await sendTrialEndingWarnings(referenceDate)
  const pastDueTrials = await moveExpiredTrialsToPastDue(referenceDate)
  const suspendedTrials = await suspendPastDueWorkspaces(referenceDate)
  const renewals = await processDueRenewals(referenceDate)

  return {
    warningsSent: trialWarnings.length,
    processedTrials: pastDueTrials.length,
    suspendedTrials: suspendedTrials.length,
    processedRenewals: renewals.length,
  }
}

async function grantGraceDays({ tenantId, daysGranted, reason, grantedBy }) {
  const db = getSupabaseAdmin()
  const subscription = await loadTenantSubscription(tenantId)

  if (!subscription) {
    throw new Error('Tenant subscription not found')
  }

  const previousBillingDate = new Date(
    subscription.next_billing_date ||
      subscription.current_period_ends_at ||
      subscription.trial_ends_at ||
      new Date()
  )
  const newBillingDate = addDays(previousBillingDate, daysGranted)
  const updates = {
    next_billing_date: newBillingDate.toISOString(),
    grace_days_total: Math.max(0, Number(subscription.grace_days_total || 0) + Number(daysGranted || 0)),
    updated_at: new Date().toISOString(),
  }

  if (subscription.status === 'trialing') {
    updates.trial_ends_at = addDays(subscription.trial_ends_at || previousBillingDate, daysGranted).toISOString()
    updates.billing_starts_at = addDays(subscription.billing_starts_at || previousBillingDate, daysGranted).toISOString()
  } else {
    updates.current_period_ends_at = addDays(
      subscription.current_period_ends_at || previousBillingDate,
      daysGranted
    ).toISOString()
  }

  const { data: updatedSubscription, error: updateError } = await db
    .from('tenant_subscriptions')
    .update(updates)
    .eq('id', subscription.id)
    .select()
    .single()

  if (updateError) throw updateError

  const { data: grant, error: grantError } = await db
    .from('grace_grants')
    .insert({
      tenant_id: tenantId,
      subscription_id: subscription.id,
      days_granted: Number(daysGranted || 0),
      reason: String(reason || '').trim(),
      granted_by: grantedBy || null,
      previous_billing_date: previousBillingDate.toISOString(),
      new_billing_date: newBillingDate.toISOString(),
    })
    .select()
    .single()

  if (grantError) throw grantError

  const { data: tenant } = await db
    .from('tenants')
    .select('name, contact_email, contact_phone')
    .eq('id', tenantId)
    .maybeSingle()

  await sendTenantGraceGrantedNotification({
    email: tenant?.contact_email,
    phone: tenant?.contact_phone,
    tenantName: tenant?.name,
    daysGranted,
    reason,
    newBillingDate: newBillingDate.toISOString(),
  })

  logger.info(`Granted ${daysGranted} grace day(s) to tenant ${tenantId}`)
  return { subscription: updatedSubscription, grant }
}

module.exports = {
  addBillingInterval,
  createTenantSubscription,
  grantGraceDays,
  loadTenantSubscription,
  loadWorkspacePlanById,
  loadWorkspacePlans,
  normalizeBillingPeriod,
  normalizePlanRecord,
  reactivateTenantSubscription,
  replacePlans,
  runDailySubscriptionBilling,
  serializePlan,
}
