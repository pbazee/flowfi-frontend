import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PackageCheck, ShoppingBag, Truck, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/formatters'
import { SHOP_ORDER_STATUS_OPTIONS } from '@/lib/shop-orders'

const orderStatuses = SHOP_ORDER_STATUS_OPTIONS

function toValidDateInput(value) {
  if (!value) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return ''

  const [year, month, day] = String(value).split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return day >= 1 && day <= lastDay ? String(value) : ''
}

export default function ShopOrders() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [form, setForm] = useState({
    status: 'pending',
    estimated_delivery_date: '',
    courier_note: '',
    tracking_number: '',
    cancellation_reason: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-shop-orders', statusFilter],
    queryFn: () =>
      api
        .get('/shop/admin/orders', {
          params: {
            status: statusFilter || undefined,
          },
        })
        .then((response) => response.data),
  })

  useEffect(() => {
    if (!selectedOrder) return

    setForm({
      status: selectedOrder.status || 'pending',
      estimated_delivery_date: toValidDateInput(
        selectedOrder.estimated_delivery_date || selectedOrder.estimated_delivery
      ),
      courier_note: selectedOrder.courier_note || selectedOrder.tracking_note || '',
      tracking_number: selectedOrder.tracking_number || '',
      cancellation_reason: selectedOrder.cancellation_reason || '',
    })
  }, [selectedOrder])

  const orders = data?.orders || []
  const totalOrders = data?.total || orders.length
  const pendingOrders = orders.filter((order) => order.status === 'pending').length
  const fulfilledOrders = orders.filter((order) => ['shipped', 'delivered'].includes(order.status)).length
  const orderRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)

  const latestOrders = useMemo(() => {
    return [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [orders])

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) =>
      api.patch(`/shop/admin/orders/${id}`, payload).then((response) => response.data),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['admin-shop-orders'] })
      setSelectedOrder(updatedOrder)
      toast.success('Order updated')
      if (updatedOrder.notification_warning) {
        toast(updatedOrder.notification_warning)
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not update the order')
    },
  })

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!selectedOrder) return

    if (form.status === 'cancelled' && !form.cancellation_reason.trim()) {
      toast.error('Add a cancellation reason before saving this order')
      return
    }

    updateMutation.mutate({
      id: selectedOrder.id,
      payload: {
        status: form.status,
        courier_note: form.courier_note.trim() || null,
        tracking_number: form.tracking_number.trim() || null,
        estimated_delivery_date: form.estimated_delivery_date || null,
        cancellation_reason: form.status === 'cancelled' ? form.cancellation_reason.trim() || null : null,
      },
    })
  }

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Commerce"
        title="Shop orders"
        description="Review incoming storefront orders, update fulfillment status, and leave delivery notes for the customer journey."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Orders" value={formatNumber(totalOrders)} icon={ShoppingBag} />
        <StatTile label="Pending" value={formatNumber(pendingOrders)} icon={Truck} tone="amber" />
        <StatTile label="Fulfilled" value={formatNumber(fulfilledOrders)} icon={PackageCheck} tone="green" />
        <StatTile label="Loaded revenue" value={formatCurrency(orderRevenue)} icon={Wallet} tone="blue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <SectionCard
          title="Order queue"
          description="Open an order to update status, estimated delivery, and tracking notes."
          action={
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="input min-w-[180px]"
            >
              <option value="">All statuses</option>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          }
        >
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : latestOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No orders yet"
              description="Once the storefront starts receiving orders, the queue will appear here."
            />
          ) : (
            <div className="space-y-4">
              {latestOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full rounded-3xl border p-5 text-left transition-colors ${
                    selectedOrder?.id === order.id
                      ? 'border-primary-200 bg-primary-50'
                      : 'border-gray-100 hover:border-primary-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{order.reference}</h3>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        {order.customer_name} - {order.customer_phone}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.total)}</p>
                      <p className="mt-1 text-xs text-gray-400">{formatDateTime(order.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Payment</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {(order.payment_method || 'mpesa')} / {(order.payment_status || 'pending')}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Items</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">{formatNumber(order.items?.length || 0)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Delivery</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {order.shipping_quote_status === 'matched'
                          ? `${formatCurrency(order.delivery_fee || 0)}`
                          : order.delivery_address
                            ? 'Manual quote'
                            : 'Pickup / no address'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Order details"
          description="Selected order summary and fulfillment controls."
        >
          {!selectedOrder ? (
            <EmptyState
              icon={PackageCheck}
              title="Pick an order"
              description="Select an order from the queue to inspect line items and update fulfillment."
            />
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gray-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Reference</p>
                    <h3 className="mt-2 text-2xl font-semibold text-gray-900">{selectedOrder.reference}</h3>
                    <p className="mt-2 text-sm text-gray-500">
                      {selectedOrder.customer_name} - {selectedOrder.customer_phone}
                    </p>
                    {selectedOrder.customer_email ? (
                      <p className="mt-1 text-sm text-gray-500">{selectedOrder.customer_email}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={selectedOrder.status} />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Created</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      {formatDateTime(selectedOrder.created_at)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Subtotal / Total</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      {formatCurrency(selectedOrder.subtotal || selectedOrder.total)} / {formatCurrency(selectedOrder.total)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 md:col-span-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Payment</p>
                    <p className="mt-2 text-sm font-medium text-gray-900 capitalize">
                      {selectedOrder.payment_method || 'mpesa'} / {selectedOrder.payment_status || 'pending'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">Items</h4>
                <div className="mt-3 space-y-3">
                  {(selectedOrder.items || []).map((item, index) => (
                    <div key={`${item.product_id || item.name}-${index}`} className="rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            Qty {item.quantity} at {formatCurrency(item.price)}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{formatCurrency(item.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Delivery address</p>
                  <p className="mt-2 text-sm text-gray-700">
                    {selectedOrder.delivery_address || 'No delivery address provided'}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    {[selectedOrder.shipping_town, selectedOrder.shipping_region, selectedOrder.shipping_county, selectedOrder.shipping_country]
                      .filter(Boolean)
                      .join(', ') || 'Destination not captured'}
                  </p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Shipping quote / notes</p>
                  <p className="mt-2 text-sm text-gray-700">
                    {selectedOrder.shipping_quote_status === 'matched'
                      ? `Quoted at ${formatCurrency(selectedOrder.delivery_fee || 0)}${selectedOrder.shipping_estimated_days ? ` for ${selectedOrder.shipping_estimated_days} day(s)` : ''}`
                      : 'Customer needs a manual shipping quote.'}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    {selectedOrder.notes || 'No order notes provided'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-gray-100 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Order status</label>
                    <select
                      value={form.status}
                      onChange={(event) => updateField('status', event.target.value)}
                      className="input"
                    >
                      {orderStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Estimated delivery</label>
                    <input
                      type="date"
                      value={form.estimated_delivery_date}
                      onChange={(event) => updateField('estimated_delivery_date', event.target.value)}
                      className="input"
                    />
                    {selectedOrder.estimated_delivery_date || selectedOrder.estimated_delivery ? (
                      <p className="mt-2 text-xs text-gray-400">
                        Previously set to {formatDate(
                          selectedOrder.estimated_delivery_date || selectedOrder.estimated_delivery
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Courier note</label>
                    <textarea
                      value={form.courier_note}
                      onChange={(event) => updateField('courier_note', event.target.value)}
                      className="input min-h-28"
                      placeholder="Package handed to courier, customer requested evening delivery..."
                    />
                  </div>
                  <div>
                    <label className="label">Tracking number</label>
                    <input
                      value={form.tracking_number}
                      onChange={(event) => updateField('tracking_number', event.target.value)}
                      className="input"
                      placeholder="Courier tracking or dispatch code"
                    />
                  </div>
                </div>

                {form.status === 'cancelled' ? (
                  <div>
                    <label className="label">Cancellation reason</label>
                    <textarea
                      value={form.cancellation_reason}
                      onChange={(event) => updateField('cancellation_reason', event.target.value)}
                      className="input min-h-24"
                      placeholder="Customer request, stock unavailable, delivery issue..."
                      required
                    />
                  </div>
                ) : null}

                <button type="submit" disabled={updateMutation.isPending} className="btn-primary w-full">
                  {updateMutation.isPending ? 'Saving update...' : 'Save and notify customer'}
                </button>
              </form>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
