const { getSupabaseAdmin } = require('../lib/supabase')
const { logger } = require('../lib/logger')
const { sendWorkspaceActivationNotification } = require('./notification.service')
const {
  createTenantSubscription,
  loadWorkspacePlanById,
  reactivateTenantSubscription,
} = require('./subscription.service')

async function activateWorkspaceOrder(order) {
  if (!order) return null

  const db = getSupabaseAdmin()

  if (order.status === 'activated' && order.tenant_id && order.user_id) {
    return { tenantId: order.tenant_id, userId: order.user_id, order }
  }

  const paidAt = order.paid_at || new Date().toISOString()
  let tenantId = order.tenant_id
  let userId = order.user_id

  if (!tenantId) {
    const tenantPayload = {
      name: order.business_name,
      business_type: order.business_type || 'other',
      status: 'active',
      contact_phone: order.signup_phone,
      contact_email: order.signup_email,
      workspace_plan_id: order.plan_id,
      workspace_plan_name: order.plan_name,
      workspace_billing_period: order.billing_period || 'monthly',
      workspace_paid_at: paidAt,
    }

    let createdTenantResult = await db.from('tenants').insert(tenantPayload).select().single()
    let createdTenant = createdTenantResult.data
    let tenantError = createdTenantResult.error

    if (tenantError && String(tenantError?.message || tenantError).includes('workspace_')) {
      const fallback = { ...tenantPayload }
      delete fallback.workspace_billing_period
      delete fallback.workspace_plan_id
      delete fallback.workspace_plan_name
      delete fallback.workspace_paid_at
      const retry = await db.from('tenants').insert(fallback).select().single()
      createdTenant = retry.data
      tenantError = retry.error
    }

    if (tenantError) throw tenantError
    tenantId = createdTenant.id
  }

  const { data: existingUser, error: existingUserError } = await db
    .from('users')
    .select('id')
    .eq('email', order.signup_email)
    .limit(1)
    .maybeSingle()

  if (existingUserError) throw existingUserError

  if (existingUser?.id) {
    const { error: userUpdateError } = await db
      .from('users')
      .update({
        name: order.signup_name,
        phone: order.signup_phone,
        role: 'tenant_admin',
        status: 'active',
        tenant_id: tenantId,
        password_hash: order.signup_password_hash,
      })
      .eq('id', existingUser.id)

    if (userUpdateError) throw userUpdateError
    userId = existingUser.id
  } else {
    const { data: createdUser, error: userInsertError } = await db
      .from('users')
      .insert({
        email: order.signup_email,
        password_hash: order.signup_password_hash,
        name: order.signup_name,
        phone: order.signup_phone,
        role: 'tenant_admin',
        status: 'active',
        tenant_id: tenantId,
      })
      .select('id')
      .single()

    if (userInsertError) throw userInsertError
    userId = createdUser.id
  }

  const { data: updatedOrder, error: orderUpdateError } = await db
    .from('workspace_orders')
    .update({
      status: 'activated',
      payment_status: 'paid',
      paid_at: paidAt,
      tenant_id: tenantId,
      user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select()
    .single()

  if (orderUpdateError) throw orderUpdateError

  try {
    await reactivateTenantSubscription({
      tenantId,
      referenceDate: paidAt,
      markLatestInvoicePaid: true,
    })
  } catch (error) {
    if (!String(error.message || '').includes('Tenant subscription not found')) {
      logger.warn(`Workspace subscription reactivation skipped for tenant ${tenantId}: ${error.message}`)
    } else {
      const plan =
        (await loadWorkspacePlanById(order.plan_id)) || {
          id: order.plan_id,
          name: order.plan_name,
          period: order.billing_period || 'monthly',
          price: Number(order.amount || 0),
          trial_days: 0,
          is_active: true,
        }

      await createTenantSubscription({
        tenantId,
        plan,
        metadata: {
          source: 'workspace_order',
          workspace_order_id: order.id,
        },
        signupContext: {
          email: order.signup_email,
          name: order.signup_name,
          businessName: order.business_name,
        },
      })
    }
  }

  await sendWorkspaceActivationNotification({
    email: order.signup_email,
    name: order.signup_name,
    businessName: order.business_name,
    planName: order.plan_name,
  })

  logger.info(`Workspace activated for ${order.signup_email} on plan ${order.plan_name}`)

  return { tenantId, userId, order: updatedOrder }
}

async function finalizeWorkspaceOrderPayment(order, provider, providerData = {}, paymentRef) {
  if (!order) return null

  const db = getSupabaseAdmin()
  let workingOrder = order

  if (order.payment_status !== 'paid') {
    const { data: updatedOrder, error } = await db
      .from('workspace_orders')
      .update({
        payment_status: 'paid',
        status: order.status === 'activated' ? 'activated' : 'paid',
        payment_ref: paymentRef || order.payment_ref,
        gateway_data: providerData,
        paid_at: order.paid_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single()

    if (error) throw error
    workingOrder = updatedOrder
  }

  const activation = await activateWorkspaceOrder(workingOrder)
  logger.info(`Workspace order ${workingOrder.reference} marked paid via ${provider}`)
  return activation
}

async function finalizeWorkspaceUpgradePayment(order, provider, providerData = {}, paymentRef) {
  if (!order) return null

  const db = getSupabaseAdmin()
  let workingOrder = order

  if (order.payment_status !== 'paid') {
    const { data: updatedOrder, error } = await db
      .from('workspace_orders')
      .update({
        payment_status: 'paid',
        status: 'paid',
        payment_ref: paymentRef || order.payment_ref,
        gateway_data: providerData,
        paid_at: order.paid_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single()

    if (error) throw error
    workingOrder = updatedOrder
  }

  // Upgrade the subscription
  const { reactivateTenantSubscription, loadWorkspacePlanById } = require('./subscription.service')
  
  const newPlan = await loadWorkspacePlanById(workingOrder.plan_id)
  if (!newPlan) throw new Error(`Plan ${workingOrder.plan_id} not found during upgrade finalize`)

  // Update tenant table
  const { error: tenantError } = await db
    .from('tenants')
    .update({
      workspace_plan_id: workingOrder.plan_id,
      workspace_plan_name: workingOrder.plan_name,
      updated_at: new Date().toISOString()
    })
    .eq('id', workingOrder.tenant_id)

  if (tenantError) throw tenantError

  // Reactivate/Reset subscription cycle
  await reactivateTenantSubscription({
    tenantId: workingOrder.tenant_id,
    referenceDate: workingOrder.paid_at,
    markLatestInvoicePaid: true
  })

  // Update the subscription amount to the new plan amount
  const { error: subUpdateError } = await db
    .from('tenant_subscriptions')
    .update({
      amount: workingOrder.payload?.math_breakdown?.newAmount || newPlan.price,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', workingOrder.tenant_id)
  
  if (subUpdateError) {
    logger.warn(`Could not update subscription amount for tenant ${workingOrder.tenant_id}: ${subUpdateError.message}`)
  }

  logger.info(`Workspace upgrade for tenant ${workingOrder.tenant_id} to plan ${workingOrder.plan_name} finalized via ${provider}`)
  
  return { tenantId: workingOrder.tenant_id, order: workingOrder }
}

module.exports = { activateWorkspaceOrder, finalizeWorkspaceOrderPayment, finalizeWorkspaceUpgradePayment }
