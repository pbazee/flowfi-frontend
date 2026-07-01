const express = require('express')
const router = express.Router()
const shortUUID = require('short-uuid')
const { getSupabaseAdmin } = require('../lib/supabase')
const { authenticate, requireRole } = require('../middleware/auth')
const {
  getPaymentAvailability,
  initiateStkPush,
  initializePaystack,
} = require('../services/payment.service')
const { buildShippingOptions, loadShippingZones, quoteShipping } = require('../services/shipping.service')
const { sendShopOrderStatusEmail } = require('../services/order-status-email.service')
const { isRelationMissingError } = require('../lib/db-compat')
const { logger } = require('../lib/logger')
const { toValidDateOnly } = require('../lib/date')

function normalizePhone(phone) {
  if (!phone) return phone
  const trimmed = String(phone).replace(/\s+/g, '')
  if (trimmed.startsWith('0')) return `254${trimmed.slice(1)}`
  if (trimmed.startsWith('+')) return trimmed.slice(1)
  return trimmed
}

function toPhoneVariants(phone) {
  const normalized = normalizePhone(phone)
  const digits = String(phone || '').replace(/[^\d]/g, '')
  const local = normalized?.startsWith('254') ? `0${normalized.slice(3)}` : digits
  const short = normalized?.startsWith('254') ? normalized.slice(3) : digits.replace(/^0/, '')
  return [...new Set([normalized, digits, local, short].filter(Boolean))]
}

function phonesMatch(left, right) {
  const leftVariants = toPhoneVariants(left)
  const rightVariants = toPhoneVariants(right)
  return leftVariants.some((value) => rightVariants.includes(value))
}

async function loadOrderStatusHistory(orderId) {
  const db = getSupabaseAdmin()

  try {
    const { data, error } = await db
      .from('shop_order_status_history')
      .select('id, order_id, status, note, updated_by, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    if (isRelationMissingError(error, 'shop_order_status_history')) {
      return []
    }

    throw error
  }
}

function serializeOrder(order, options = {}) {
  if (!order) return null

  const estimatedDeliveryDate = toValidDateOnly(order.estimated_delivery_date || order.estimated_delivery)
  const courierNote = order.courier_note || order.tracking_note || null

  return {
    id: order.id,
    reference: order.reference,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    delivery_address: order.delivery_address,
    shipping_country: order.shipping_country,
    shipping_county: order.shipping_county,
    shipping_region: order.shipping_region,
    shipping_town: order.shipping_town,
    items: order.items,
    subtotal: order.subtotal,
    delivery_fee: order.delivery_fee,
    shipping_quote_status: order.shipping_quote_status || 'not_requested',
    shipping_estimated_days: order.shipping_estimated_days,
    total: order.total,
    payment_method: order.payment_method,
    payment_status: order.payment_status || 'pending',
    payment_provider: order.payment_provider,
    status: order.status,
    courier_note: courierNote,
    tracking_note: courierNote,
    tracking_number: order.tracking_number || null,
    estimated_delivery_date: estimatedDeliveryDate,
    estimated_delivery: estimatedDeliveryDate,
    delivered_at: order.delivered_at || null,
    cancelled_at: order.cancelled_at || null,
    cancellation_reason: order.cancellation_reason || null,
    notes: order.notes,
    paid_at: order.paid_at,
    created_at: order.created_at,
    updated_at: order.updated_at,
    status_history: options.history || [],
  }
}

router.get('/products', async (req, res) => {
  const db = getSupabaseAdmin()
  const { category, page = 1, limit = 24, search } = req.query
  const offset = (page - 1) * limit

  let query = db
    .from('shop_products')
    .select(
      'id, name, slug, description, price, compare_price, images, category, stock_qty, rating, review_count, tags, is_featured',
      { count: 'exact' }
    )
    .eq('status', 'active')
    .range(offset, offset + limit - 1)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, count, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ products: data, total: count })
})

router.get('/products/:slug', async (req, res) => {
  const db = getSupabaseAdmin()
  const { data } = await db
    .from('shop_products')
    .select('*')
    .eq('slug', req.params.slug)
    .eq('status', 'active')
    .single()

  if (!data) return res.status(404).json({ error: 'Product not found' })
  res.json(data)
})

router.get('/categories', async (req, res) => {
  const db = getSupabaseAdmin()
  const { data } = await db
    .from('shop_products')
    .select('category')
    .eq('status', 'active')

  const cats = [...new Set((data || []).map((p) => p.category).filter(Boolean))]
  res.json(cats)
})

router.get('/shipping/options', async (req, res) => {
  try {
    const zones = await loadShippingZones()
    res.json(buildShippingOptions(zones))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/shipping/quote', async (req, res) => {
  try {
    const quote = await quoteShipping({
      country: req.body.country,
      county: req.body.county,
      region: req.body.region,
      town: req.body.town,
    })

    res.json(quote)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/orders', async (req, res) => {
  const {
    items,
    customer_name,
    customer_email,
    customer_phone,
    delivery_address,
    shipping_country,
    shipping_county,
    shipping_region,
    shipping_town,
    payment_method,
    notes,
  } = req.body

  if (!items?.length || !customer_name || !customer_phone || !delivery_address || !shipping_country) {
    return res.status(400).json({
      error: 'items, customer_name, customer_phone, delivery_address and shipping_country required',
    })
  }

  if (!['mpesa', 'paystack'].includes(payment_method)) {
    return res.status(400).json({ error: 'Unsupported payment method' })
  }

  if (payment_method === 'paystack' && !customer_email) {
    return res.status(400).json({ error: 'customer_email is required for Paystack checkout' })
  }

  try {
    const db = getSupabaseAdmin()
    const paymentAvailability = getPaymentAvailability()

    if (!paymentAvailability[payment_method]) {
      return res.status(503).json({
        error:
          payment_method === 'mpesa'
            ? 'M-Pesa checkout is not configured yet. Please use Paystack instead.'
            : 'Paystack checkout is not configured yet. Please contact support.',
      })
    }

    let subtotal = 0
    const enrichedItems = []
    let order = null

    for (const item of items) {
      const { data: product } = await db
        .from('shop_products')
        .select('id, name, price, stock_qty')
        .eq('id', item.product_id)
        .eq('status', 'active')
        .single()

      if (!product) return res.status(400).json({ error: `Product ${item.product_id} not found` })
      if (product.stock_qty !== null && product.stock_qty < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` })
      }

      subtotal += product.price * item.quantity
      enrichedItems.push({
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        total: product.price * item.quantity,
      })
    }

    const shippingQuote = await quoteShipping({
      country: shipping_country,
      county: shipping_county,
      region: shipping_region,
      town: shipping_town,
    })

    const deliveryFee = shippingQuote.matched ? Number(shippingQuote.price || 0) : 0
    const total = subtotal + deliveryFee
    const orderRef = `ORD-${shortUUID.generate().slice(0, 10).toUpperCase()}`

    const { data: createdOrder, error } = await db
      .from('shop_orders')
      .insert({
        reference: orderRef,
        customer_name,
        customer_email,
        customer_phone,
        delivery_address,
        shipping_country,
        shipping_county,
        shipping_region,
        shipping_town,
        shipping_zone_id: shippingQuote.zone?.id || null,
        shipping_quote_status: shippingQuote.status,
        shipping_estimated_days: shippingQuote.estimated_days,
        items: enrichedItems,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        payment_method,
        payment_status: 'pending',
        status: 'pending',
        notes,
      })
      .select()
      .single()

    if (error) throw error
    order = createdOrder

    if (payment_method === 'mpesa') {
      const mpesaResponse = await initiateStkPush(
        normalizePhone(customer_phone),
        total,
        orderRef,
        `FlowFi Shop Order ${orderRef}`
      )

      const { data: updatedOrder, error: updateError } = await db
        .from('shop_orders')
        .update({
          payment_ref: mpesaResponse.CheckoutRequestID,
          payment_provider: 'mpesa',
          payment_provider_data: mpesaResponse,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .select()
        .single()

      if (updateError) throw updateError

      logger.info(`Shop order ${orderRef}: initiated M-Pesa payment for ${customer_phone}`)
      return res.status(201).json({
        order: serializeOrder(updatedOrder),
        payment_method,
        checkoutRequestId: mpesaResponse.CheckoutRequestID,
        message: 'Complete the M-Pesa prompt on your phone to confirm this order.',
      })
    }

    const callbackUrl = `${process.env.FRONTEND_URL}/payment/callback?flow=shop`
    const paystackResponse = await initializePaystack(
      customer_email,
      total,
      orderRef,
      {
        flow: 'shop',
        customer_phone,
        order_reference: orderRef,
      },
      callbackUrl
    )

    const { data: updatedOrder, error: updateError } = await db
      .from('shop_orders')
      .update({
        payment_ref: orderRef,
        payment_provider: 'paystack',
        payment_provider_data: paystackResponse.data || paystackResponse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single()

    if (updateError) throw updateError

    logger.info(`Shop order ${orderRef}: initialized Paystack checkout for ${customer_email}`)
    return res.status(201).json({
      order: serializeOrder(updatedOrder),
      payment_method,
      authorization_url: paystackResponse.data.authorization_url,
      message: 'Redirecting to Paystack checkout.',
    })
  } catch (err) {
    logger.error(`Shop order error: ${err.message}`, { stack: err.stack })
    res.status(500).json({ error: err.message || 'Order failed' })
  }
})

router.get('/orders/lookup', async (req, res) => {
  const db = getSupabaseAdmin()
  const search = String(req.query.query || req.query.ref || req.query.phone || '').trim()

  if (!search) {
    return res.status(400).json({ error: 'query is required' })
  }

  try {
    const normalizedSearch = search.toUpperCase()

    if (normalizedSearch.startsWith('ORD-')) {
      const { data, error } = await db.from('shop_orders').select('*').eq('reference', normalizedSearch).maybeSingle()
      if (error) throw error

      if (!data) {
        return res.status(404).json({ error: 'Order not found' })
      }

      const history = await loadOrderStatusHistory(data.id)
      return res.json({
        matched_by: 'reference',
        total: 1,
        order: serializeOrder(data, { history }),
        orders: [serializeOrder(data)],
      })
    }

    const searchVariants = toPhoneVariants(search)
    const fallbackNeedle = searchVariants[0] || search.replace(/[^\d]/g, '')
    const lastDigits = fallbackNeedle.slice(-4)

    let query = db
      .from('shop_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (lastDigits) {
      query = query.or(`customer_phone.ilike.%${search}%,customer_phone.ilike.%${lastDigits}%`)
    } else {
      query = query.ilike('customer_phone', `%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error

    const matches = (data || []).filter((order) => phonesMatch(order.customer_phone, search))
    if (matches.length === 0) {
      return res.status(404).json({ error: 'Order not found' })
    }

    if (matches.length === 1) {
      const history = await loadOrderStatusHistory(matches[0].id)
      return res.json({
        matched_by: 'phone',
        total: 1,
        order: serializeOrder(matches[0], { history }),
        orders: matches.map((order) => serializeOrder(order)),
      })
    }

    return res.json({
      matched_by: 'phone',
      total: matches.length,
      orders: matches.map((order) => serializeOrder(order)),
    })
  } catch (error) {
    logger.error(`Shop order lookup error: ${error.message}`, { stack: error.stack })
    return res.status(500).json({ error: 'Could not search shop orders right now' })
  }
})

router.get('/orders/:reference', async (req, res) => {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('shop_orders')
    .select('*')
    .eq('reference', String(req.params.reference || '').toUpperCase())
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Order not found' })

  const history = await loadOrderStatusHistory(data.id)
  res.json(serializeOrder(data, { history }))
})

router.use(authenticate, requireRole('super_admin'))

router.post('/products', async (req, res) => {
  const db = getSupabaseAdmin()
  const {
    name,
    description,
    price,
    compare_price,
    category,
    stock_qty,
    images,
    tags,
    specifications,
    is_featured,
  } = req.body

  if (!name || !price) return res.status(400).json({ error: 'name and price required' })

  const slug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
    '-' +
    Date.now().toString(36)

  const { data, error } = await db
    .from('shop_products')
    .insert({
      name,
      slug,
      description,
      price,
      compare_price,
      category,
      stock_qty,
      images: images || [],
      tags: tags || [],
      specifications: specifications || {},
      is_featured: is_featured || false,
      status: 'active',
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.put('/products/:id', async (req, res) => {
  const db = getSupabaseAdmin()
  const allowed = [
    'name',
    'description',
    'price',
    'compare_price',
    'category',
    'stock_qty',
    'images',
    'tags',
    'specifications',
    'is_featured',
    'status',
  ]
  const updates = {}
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k]

  const { data } = await db.from('shop_products').update(updates).eq('id', req.params.id).select().single()
  res.json(data)
})

router.get('/admin/orders', async (req, res) => {
  const db = getSupabaseAdmin()
  const { status, page = 1 } = req.query
  const offset = (page - 1) * 50

  let query = db
    .from('shop_orders')
    .select('*', { count: 'exact' })
    .range(offset, offset + 49)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, count } = await query
  res.json({ orders: (data || []).map((order) => serializeOrder(order)), total: count })
})

router.patch('/admin/orders/:id', async (req, res) => {
  const db = getSupabaseAdmin()
  const {
    status,
    courier_note,
    tracking_note,
    estimated_delivery_date,
    estimated_delivery,
    tracking_number,
    cancellation_reason,
  } = req.body
  const normalizedEstimatedDelivery = estimated_delivery_date || estimated_delivery
    ? toValidDateOnly(estimated_delivery_date || estimated_delivery)
    : null
  const trimmedCourierNote = String(courier_note ?? tracking_note ?? '').trim() || null
  const trimmedTrackingNumber = String(tracking_number || '').trim() || null
  const trimmedCancellationReason = String(cancellation_reason || '').trim() || null

  if ((estimated_delivery_date || estimated_delivery) && !normalizedEstimatedDelivery) {
    return res.status(400).json({ error: 'estimated_delivery_date must be a valid calendar date' })
  }

  const { data: existingOrder, error: existingOrderError } = await db
    .from('shop_orders')
    .select('*')
    .eq('id', req.params.id)
    .single()

  if (existingOrderError) {
    return res.status(500).json({ error: existingOrderError.message })
  }

  const nextStatus = status || existingOrder.status
  if (nextStatus === 'cancelled' && !trimmedCancellationReason) {
    return res.status(400).json({ error: 'cancellation_reason is required when cancelling an order' })
  }

  const now = new Date().toISOString()
  const updates = {
    status: nextStatus,
    tracking_note: trimmedCourierNote,
    courier_note: trimmedCourierNote,
    tracking_number: trimmedTrackingNumber,
    estimated_delivery: normalizedEstimatedDelivery,
    estimated_delivery_date: normalizedEstimatedDelivery,
    cancellation_reason: nextStatus === 'cancelled' ? trimmedCancellationReason : null,
    status_updated_by: req.user.id,
    updated_at: now,
  }

  if (nextStatus === 'delivered') {
    updates.delivered_at = existingOrder.delivered_at || now
    updates.cancelled_at = null
  } else if (existingOrder.delivered_at) {
    updates.delivered_at = null
  }

  if (nextStatus === 'cancelled') {
    updates.cancelled_at = existingOrder.cancelled_at || now
    updates.delivered_at = null
  } else if (existingOrder.cancelled_at) {
    updates.cancelled_at = null
  }

  const { data, error } = await db
    .from('shop_orders')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  let notificationWarning = null
  try {
    const emailResult = await sendShopOrderStatusEmail(data)
    if (emailResult?.skipped) {
      notificationWarning =
        emailResult.reason === 'missing_customer_email'
          ? 'Order updated, but the customer does not have an email address on file.'
          : 'Order updated, but no status email was sent for this status.'
    }
  } catch (emailError) {
    logger.error(`Shop order status email failed for ${data.reference}: ${emailError.message}`)
    notificationWarning = 'Order updated, but the email notification could not be sent.'
  }

  res.json({
    ...serializeOrder(data),
    notification_warning: notificationWarning,
  })
})

module.exports = router
