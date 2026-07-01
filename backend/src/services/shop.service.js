const { getSupabaseAdmin } = require('../lib/supabase')
const { logger } = require('../lib/logger')
const { sendOrderConfirmation } = require('./notification.service')

async function finalizeShopOrderPayment(order, provider, providerData = {}) {
  if (!order) return null

  const db = getSupabaseAdmin()

  if (order.payment_status === 'paid') {
    return order
  }

  for (const item of order.items || []) {
    try {
      const result = await db.rpc('decrement_stock', { product_id: item.product_id, qty: item.quantity })
      if (result.error) {
        throw result.error
      }
    } catch (error) {
      logger.warn(`Could not decrement stock for product ${item.product_id}: ${error.message}`)
    }
  }

  let updatedOrder = null
  try {
    const res = await db
      .from('shop_orders')
      .update({
        payment_status: 'paid',
        payment_provider: provider,
        payment_provider_data: providerData,
        paid_at: new Date().toISOString(),
        status: order.status === 'pending' ? 'confirmed' : order.status,
        status_updated_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single()

    if (res.error) throw res.error
    updatedOrder = res.data
  } catch (err) {
    logger.warn(`Shop order update failed for ${order.reference}: ${err.message}`)
    // Fallback: try a minimal update in case the DB schema lacks payment_* columns
    try {
      const fallback = await db
        .from('shop_orders')
        .update({
          status: order.status === 'pending' ? 'confirmed' : order.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .select()
        .single()

      if (fallback.error) throw fallback.error
      updatedOrder = fallback.data
      logger.warn(`Shop order ${order.reference} updated with minimal fields due to schema limitations`) 
    } catch (fallbackErr) {
      throw fallbackErr
    }
  }

  await sendOrderConfirmation({
    customerEmail: updatedOrder.customer_email,
    customerPhone: updatedOrder.customer_phone,
    reference: updatedOrder.reference,
    total: updatedOrder.total,
    items: updatedOrder.items || [],
  })

  logger.info(`Shop order ${updatedOrder.reference} marked paid via ${provider}`)

  return updatedOrder
}

module.exports = { finalizeShopOrderPayment }
