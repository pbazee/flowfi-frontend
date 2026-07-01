import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  PackageCheck,
  Search,
  Truck,
} from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import StorefrontShell from '@/components/shop/StorefrontShell'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import { usePlatformContent } from '@/hooks/usePlatformContent'
import api from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters'
import {
  getShopOrderStatusLabel,
  getShopOrderStepIndex,
  SHOP_ORDER_STATUS_COPY,
  SHOP_ORDER_TRACK_STEPS,
} from '@/lib/shop-orders'

function buildWhatsAppHref(whatsapp, referenceOrQuery) {
  const digits = String(whatsapp || '').replace(/[^\d]/g, '')
  if (!digits) return ''

  const message = referenceOrQuery
    ? `Hello FlowFi, I need help finding my order: ${referenceOrQuery}.`
    : 'Hello FlowFi, I need help finding my order.'

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function resolveTimeline(order) {
  if (Array.isArray(order?.status_history) && order.status_history.length > 0) {
    return order.status_history
  }

  if (!order) return []

  return [
    {
      id: `${order.reference}-fallback`,
      status: order.status,
      note: order.courier_note || order.cancellation_reason || null,
      created_at: order.updated_at || order.created_at,
    },
  ]
}

function StatusSteps({ status }) {
  const activeIndex = getShopOrderStepIndex(status)

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {SHOP_ORDER_TRACK_STEPS.map((step, index) => {
        const isComplete = activeIndex >= index
        const isActive = activeIndex === index

        return (
          <div key={step} className="relative rounded-3xl border border-gray-100 bg-white px-4 py-4">
            {index < SHOP_ORDER_TRACK_STEPS.length - 1 ? (
              <div className="absolute left-[calc(100%-12px)] top-7 hidden h-0.5 w-6 bg-gray-200 md:block" />
            ) : null}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full ${
                  isComplete ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'
                } ${isActive ? 'ring-4 ring-primary-100' : ''}`}
              >
                {isComplete ? <CheckCircle2 size={18} /> : <PackageCheck size={18} />}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Step {index + 1}</p>
                <p className={`mt-1 text-sm font-semibold ${isComplete ? 'text-gray-900' : 'text-gray-500'}`}>
                  {getShopOrderStatusLabel(step)}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OrderTimeline({ order }) {
  const entries = useMemo(() => resolveTimeline(order), [order])

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tracking timeline</h3>
          <p className="mt-1 text-sm text-gray-500">Every status change appears here with the latest note and timestamp.</p>
        </div>
        <Clock3 size={18} className="text-primary-600" />
      </div>

      <div className="mt-6 space-y-5">
        {entries.map((entry, index) => (
          <div key={entry.id || `${entry.status}-${entry.created_at}-${index}`} className="relative flex gap-4">
            <div className="relative flex w-6 justify-center">
              <div className="mt-1 h-3 w-3 rounded-full bg-primary-600" />
              {index < entries.length - 1 ? <div className="absolute top-5 h-[calc(100%+4px)] w-px bg-gray-200" /> : null}
            </div>
            <div className="flex-1 rounded-3xl border border-gray-100 bg-gray-50 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">{getShopOrderStatusLabel(entry.status)}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-gray-400">{formatDateTime(entry.created_at)}</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {entry.note || SHOP_ORDER_STATUS_COPY[entry.status] || 'No extra note was added for this update.'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrderDetails({ order }) {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Order reference</p>
            <h2 className="mt-2 text-3xl font-display font-bold text-gray-900">{order.reference}</h2>
            <p className="mt-2 text-sm text-gray-500">Placed on {formatDateTime(order.created_at)}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="mt-6">
          <StatusSteps status={order.status} />
        </div>

        {order.status === 'cancelled' ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            <p className="font-semibold">This order was cancelled.</p>
            <p className="mt-2">{order.cancellation_reason || 'Contact FlowFi if you need help with this order.'}</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <OrderTimeline order={order} />

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900">Items in this order</h3>
            <div className="mt-5 space-y-3">
              {(order.items || []).map((item, index) => (
                <div
                  key={`${item.product_id || item.name}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-3xl border border-gray-100 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Qty {item.quantity} at {formatCurrency(item.price)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.total)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900">Order summary</h3>
            <div className="mt-5 space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal || order.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <span>{formatCurrency(order.delivery_fee || 0)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Payment</span>
                <span className="capitalize">
                  {order.payment_method} / {order.payment_status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span>{getShopOrderStatusLabel(order.status)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Estimated delivery</span>
                <span>
                  {order.estimated_delivery_date
                    ? formatDate(order.estimated_delivery_date)
                    : order.shipping_estimated_days
                      ? `${order.shipping_estimated_days} day(s)`
                      : 'Pending confirmation'}
                </span>
              </div>
              {order.delivered_at ? (
                <div className="flex items-center justify-between">
                  <span>Delivered at</span>
                  <span>{formatDateTime(order.delivered_at)}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900">Delivery details</h3>
            <p className="mt-4 text-sm leading-relaxed text-gray-700">
              {order.delivery_address || 'No delivery address was recorded for this order.'}
            </p>
            <p className="mt-3 text-sm text-gray-500">
              {[order.shipping_town, order.shipping_region, order.shipping_county, order.shipping_country]
                .filter(Boolean)
                .join(', ') || 'Destination details pending'}
            </p>

            {order.tracking_number ? (
              <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Tracking number</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">{order.tracking_number}</p>
              </div>
            ) : null}

            {order.courier_note ? (
              <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Courier note</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">{order.courier_note}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OrderTrackPage() {
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: content } = usePlatformContent()
  const initialReference = searchParams.get('ref') || params.reference || ''
  const [searchInput, setSearchInput] = useState(initialReference)
  const [submittedSearch, setSubmittedSearch] = useState(initialReference)

  useEffect(() => {
    if (!initialReference) return
    setSearchInput(initialReference)
    setSubmittedSearch(initialReference)
  }, [initialReference])

  const lookupQuery = useQuery({
    queryKey: ['shop-order-track-lookup', submittedSearch],
    enabled: Boolean(submittedSearch),
    retry: false,
    queryFn: () =>
      api
        .get('/shop/orders/lookup', {
          params: {
            query: submittedSearch,
          },
        })
        .then((response) => response.data),
  })

  const activeOrder = lookupQuery.data?.order || null
  const candidateOrders = lookupQuery.data?.orders || []
  const whatsappHref = buildWhatsAppHref(content?.contact?.whatsapp, submittedSearch || searchInput)

  function submitSearch(event) {
    event.preventDefault()
    const trimmed = searchInput.trim()
    if (!trimmed) return

    setSubmittedSearch(trimmed)
    if (trimmed.toUpperCase().startsWith('ORD-')) {
      setSearchParams({ ref: trimmed.toUpperCase() })
    } else {
      setSearchParams({})
    }
  }

  function selectOrder(reference) {
    setSearchInput(reference)
    setSubmittedSearch(reference)
    setSearchParams({ ref: reference })
  }

  return (
    <StorefrontShell
      backHref="/shop"
      backLabel="Back to shop"
      title="Track your order"
      description="Search with your order reference or phone number to see the latest fulfilment status, courier updates, and delivery progress."
    >
      <div className="space-y-6">
        <div className="card p-6">
          <form onSubmit={submitSearch} className="grid gap-4 lg:grid-cols-[1fr,auto]">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="input h-14 pl-11"
                placeholder="Enter ORD-XXXX or your phone number"
              />
            </div>
            <button type="submit" className="btn-primary h-14 px-6">
              Search order
            </button>
          </form>
        </div>

        {!submittedSearch ? (
          <div className="card p-8">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-gray-50 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Search by reference</p>
                <p className="mt-3 text-sm text-gray-700">Use the exact code from checkout, for example `ORD-OQSHYXQPMJ`.</p>
              </div>
              <div className="rounded-3xl bg-gray-50 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Search by phone</p>
                <p className="mt-3 text-sm text-gray-700">If you placed multiple orders, we will list them so you can choose the right one.</p>
              </div>
              <div className="rounded-3xl bg-gray-50 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Need help?</p>
                <p className="mt-3 text-sm text-gray-700">FlowFi support can help you trace the order if you have trouble finding it.</p>
              </div>
            </div>
          </div>
        ) : lookupQuery.isLoading ? (
          <div className="card flex min-h-64 items-center justify-center p-8 text-center">
            <div>
              <Loader2 size={26} className="mx-auto animate-spin text-primary-600" />
              <p className="mt-4 text-sm text-gray-500">Looking up your order details...</p>
            </div>
          </div>
        ) : lookupQuery.isError ? (
          <EmptyState
            icon={Truck}
            title="We couldn't find that order yet"
            description="Double-check the reference or phone number. If the issue continues, message the FlowFi team and we will help you track it."
            action={
              whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-primary">
                  Contact us on WhatsApp
                </a>
              ) : (
                <Link to="/shop" className="btn-primary">
                  Back to shop
                </Link>
              )
            }
          />
        ) : activeOrder ? (
          <OrderDetails order={activeOrder} />
        ) : candidateOrders.length > 1 ? (
          <div className="space-y-4">
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Choose an order to track</h2>
                  <p className="mt-2 text-sm text-gray-500">
                    We found {candidateOrders.length} orders for this phone number. Select the right reference to open full tracking details.
                  </p>
                </div>
                <AlertCircle size={18} className="text-primary-600" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {candidateOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => selectOrder(order.reference)}
                  className="card text-left transition-transform hover:-translate-y-0.5"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Order reference</p>
                        <h3 className="mt-2 text-xl font-semibold text-gray-900">{order.reference}</h3>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-gray-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Placed</p>
                        <p className="mt-2 text-sm font-medium text-gray-900">{formatDateTime(order.created_at)}</p>
                      </div>
                      <div className="rounded-2xl bg-gray-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Total</p>
                        <p className="mt-2 text-sm font-medium text-gray-900">{formatCurrency(order.total)}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary-700">
                      Open tracking details
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Truck}
            title="We couldn't find that order yet"
            description="Double-check the reference or phone number. If the issue continues, message the FlowFi team and we will help you track it."
            action={
              whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-primary">
                  Contact us on WhatsApp
                </a>
              ) : (
                <Link to="/shop" className="btn-primary">
                  Back to shop
                </Link>
              )
            }
          />
        )}
      </div>
    </StorefrontShell>
  )
}
