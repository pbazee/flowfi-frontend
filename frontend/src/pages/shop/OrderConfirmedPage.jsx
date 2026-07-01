import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Copy, Loader2, Truck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import StorefrontShell from '@/components/shop/StorefrontShell'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

export default function OrderConfirmedPage() {
  const [searchParams] = useSearchParams()
  const reference = String(searchParams.get('ref') || '').trim().toUpperCase()

  const orderQuery = useQuery({
    queryKey: ['shop-order-confirmed', reference],
    enabled: Boolean(reference),
    retry: false,
    queryFn: () => api.get(`/shop/orders/${reference}`).then((response) => response.data),
  })

  async function copyReference() {
    if (!reference) return

    await navigator.clipboard.writeText(reference)
    toast.success('Order reference copied')
  }

  if (!reference) {
    return (
      <StorefrontShell backHref="/shop" backLabel="Back to shop">
        <EmptyState
          icon={Truck}
          title="Order reference missing"
          description="Open this page with a valid order reference so we can load your confirmation details."
          action={
            <Link to="/shop" className="btn-primary">
              Return to shop
            </Link>
          }
        />
      </StorefrontShell>
    )
  }

  if (orderQuery.isLoading) {
    return (
      <StorefrontShell backHref="/shop" backLabel="Back to shop">
        <div className="card flex min-h-72 items-center justify-center p-8 text-center">
          <div>
            <Loader2 size={28} className="mx-auto animate-spin text-primary-600" />
            <p className="mt-4 text-sm text-gray-500">Loading your order confirmation...</p>
          </div>
        </div>
      </StorefrontShell>
    )
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <StorefrontShell backHref="/shop" backLabel="Back to shop">
        <EmptyState
          icon={Truck}
          title="We couldn't load that order"
          description="Double-check the reference or open your tracking page to search again."
          action={
            <Link to={`/shop/track?ref=${reference}`} className="btn-primary">
              Track this order
            </Link>
          }
        />
      </StorefrontShell>
    )
  }

  const order = orderQuery.data

  return (
    <StorefrontShell
      backHref="/shop"
      backLabel="Continue shopping"
      title="Order confirmed!"
      description="Your payment has been verified successfully and the FlowFi team has started processing your order."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <div className="card p-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-600">
              <CheckCircle2 size={42} />
            </div>
            <div className="mt-6 text-center">
              <p className="text-xs uppercase tracking-[0.22em] text-green-700">Payment verified</p>
              <h1 className="mt-3 text-4xl font-display font-bold text-gray-900">Order confirmed!</h1>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                We&apos;ve sent a confirmation to your email.
              </p>
            </div>

            <div className="mt-8 rounded-[28px] border border-gray-100 bg-gray-50 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Order reference</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-3xl font-bold text-gray-900">{order.reference}</p>
                <button type="button" onClick={copyReference} className="btn-outline flex items-center gap-2">
                  <Copy size={16} />
                  Copy
                </button>
              </div>
            </div>

            <div className="mt-8 space-y-3">
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

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={`/shop/track?ref=${order.reference}`} className="btn-primary">
                Track your order
              </Link>
              <Link to="/shop" className="btn-outline">
                Continue shopping
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Order summary</h2>
              <StatusBadge status={order.status} />
            </div>

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
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900">Delivery address</h2>
            <p className="mt-4 text-sm leading-relaxed text-gray-700">
              {order.delivery_address || 'No delivery address was captured for this order.'}
            </p>
            <p className="mt-3 text-sm text-gray-500">
              {[order.shipping_town, order.shipping_region, order.shipping_county, order.shipping_country]
                .filter(Boolean)
                .join(', ') || 'Destination details pending'}
            </p>
          </div>
        </div>
      </div>
    </StorefrontShell>
  )
}
