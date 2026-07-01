import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Smartphone,
  Truck,
  UserCircle2,
  Wallet,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import StorefrontShell from '@/components/shop/StorefrontShell'
import EmptyState from '@/components/ui/EmptyState'
import { usePlatformContent } from '@/hooks/usePlatformContent'
import api from '@/lib/api'
import { formatCurrency, getPrimaryImage } from '@/lib/formatters'
import { useCartStore } from '@/store/cart'

const steps = [
  { id: 1, title: 'Customer info', icon: UserCircle2 },
  { id: 2, title: 'Shipping', icon: Truck },
  { id: 3, title: 'Payment', icon: Wallet },
  { id: 4, title: 'Review', icon: CheckCircle2 },
]

const initialForm = {
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  delivery_address: '',
  shipping_country: 'Kenya',
  shipping_county: '',
  notes: '',
  payment_method: 'paystack',
}

function StepCard({ step, currentStep }) {
  const Icon = step.icon
  const isActive = currentStep === step.id
  const isComplete = currentStep > step.id

  return (
    <div
      className={`rounded-2xl border px-4 py-4 transition-colors ${
        isActive
          ? 'border-primary-300 bg-primary-50'
          : isComplete
            ? 'border-green-100 bg-green-50'
            : 'border-gray-100 bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            isActive
              ? 'bg-white text-primary-600'
              : isComplete
                ? 'bg-white text-green-600'
                : 'bg-gray-50 text-gray-500'
          }`}
        >
          <Icon size={16} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Step {step.id}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{step.title}</p>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const items = useCartStore((state) => state.items)
  const clear = useCartStore((state) => state.clear)
  const { data: content } = usePlatformContent()
  const [form, setForm] = useState(initialForm)
  const [step, setStep] = useState(1)
  const [submittedReference, setSubmittedReference] = useState('')
  const paymentMethods = content?.paymentMethods || {}
  const availableMethods = useMemo(
    () =>
      [
        {
          id: 'mpesa',
          label: 'M-Pesa',
          icon: Smartphone,
          note: 'Trigger an STK prompt on the phone number above',
          enabled: Boolean(paymentMethods.mpesa),
        },
        {
          id: 'paystack',
          label: 'Paystack',
          icon: CreditCard,
          note: 'Card plus supported bank transfer and mobile money options',
          enabled: Boolean(paymentMethods.paystack),
        },
      ].filter((method) => method.enabled),
    [paymentMethods.mpesa, paymentMethods.paystack]
  )

  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)

  const shippingOptionsQuery = useQuery({
    queryKey: ['shop-shipping-options'],
    queryFn: () => api.get('/shop/shipping/options').then((response) => response.data),
  })

  const shippingQuoteQuery = useQuery({
    queryKey: [
      'shop-shipping-quote',
      form.shipping_country,
      form.shipping_county,
    ],
    enabled: Boolean(form.shipping_country || form.shipping_county),
    queryFn: () =>
      api
        .post('/shop/shipping/quote', {
          country: form.shipping_country,
          county: form.shipping_county,
        })
        .then((response) => response.data),
  })

  const orderQuery = useQuery({
    queryKey: ['shop-order-status', submittedReference],
    enabled: Boolean(submittedReference),
    refetchInterval: (query) => {
      const paymentStatus = query.state.data?.payment_status
      return paymentStatus === 'paid' || paymentStatus === 'failed' ? false : 4000
    },
    queryFn: () => api.get(`/shop/orders/${submittedReference}`).then((response) => response.data),
  })

  const checkoutMutation = useMutation({
    mutationFn: (payload) => api.post('/shop/orders', payload).then((response) => response.data),
    onSuccess: (data) => {
      clear()
      if (data.payment_method !== 'paystack') {
        setSubmittedReference(data.order.reference)
      }

      if (data.payment_method === 'paystack' && data.authorization_url) {
        window.location.href = data.authorization_url
        return
      }

      toast.success(data.message || 'Complete the payment prompt on your phone')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not place the order')
    },
  })

  useEffect(() => {
    if (orderQuery.data?.payment_status === 'paid' && submittedReference) {
      navigate(`/shop/order-confirmed?ref=${submittedReference}`)
    }
  }, [orderQuery.data?.payment_status, submittedReference, navigate])

  useEffect(() => {
    const defaultMethod = paymentMethods.defaultMethod || availableMethods[0]?.id
    if (!defaultMethod) return

    setForm((current) => {
      if (availableMethods.some((method) => method.id === current.payment_method)) {
        return current
      }

      return { ...current, payment_method: defaultMethod }
    })
  }, [availableMethods, paymentMethods.defaultMethod])

  function updateField(key, value) {
    setForm((current) => {
      const updates = { ...current, [key]: value }

      return updates
    })
  }

  function validateStep(currentStep) {
    if (currentStep === 1) {
      if (!form.customer_name.trim() || !form.customer_phone.trim() || !form.customer_email.trim()) {
        toast.error('Complete the customer info step before continuing')
        return false
      }
      return true
    }

    if (currentStep === 2) {
      if (!form.delivery_address.trim() || !form.shipping_country.trim()) {
        toast.error('Add the delivery address and destination before continuing')
        return false
      }
      return true
    }

    if (currentStep === 3) {
      if (availableMethods.length === 0) {
        toast.error('No online payment method is configured for the storefront yet')
        return false
      }

      if (!form.payment_method) {
        toast.error('Choose a payment method before continuing')
        return false
      }

      if (form.payment_method === 'paystack' && !form.customer_email.trim()) {
        toast.error('Email address is required for Paystack checkout')
        return false
      }

      return true
    }

    return true
  }

  function goNext() {
    if (!validateStep(step)) return
    setStep((current) => Math.min(4, current + 1))
  }

  function goBack() {
    setStep((current) => Math.max(1, current - 1))
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (step !== 4) {
      return
    }

    if (items.length === 0) {
      toast.error('Add products to your cart before checking out')
      return
    }

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return
    }

    checkoutMutation.mutate({
      ...form,
      items: items.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      })),
    })
  }

  if (items.length === 0 && !submittedReference) {
    return (
      <StorefrontShell backHref="/shop" backLabel="Back to shop">
        <EmptyState
          icon={Truck}
          title="Nothing to check out yet"
          description="Your cart is empty, so there's nothing to submit to the order pipeline."
          action={<Link to="/shop" className="btn-primary">Browse products</Link>}
        />
      </StorefrontShell>
    )
  }

  if (submittedReference) {
    const order = orderQuery.data
    const isPaid = order?.payment_status === 'paid'

    return (
      <StorefrontShell backHref="/shop" backLabel="Back to shop">
        <div className="mx-auto max-w-xl">
          <div className="card p-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Loader2 size={36} className="animate-spin" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
              Completing Payment
            </p>
            <h1 className="mt-4 text-3xl font-bold font-display text-gray-900">Order {submittedReference}</h1>
            <p className="mx-auto mt-4 text-sm leading-relaxed text-gray-600">
              {form.payment_method === 'mpesa'
                ? 'Please check your phone for the M-Pesa payment prompt. Enter your PIN to complete the transaction. This page will update automatically.'
                : 'We are verifying your transaction. Please do not close this window.'}
            </p>

            <div className="mt-8 space-y-3 rounded-[32px] border border-gray-100 bg-gray-50 p-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold text-gray-900">{formatCurrency(order?.total || estimatedTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Method</span>
                <span className="font-semibold capitalize text-gray-900">{order?.payment_method || form.payment_method}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-3">
                <span className="text-gray-500">Status</span>
                <span className="flex items-center gap-2 font-semibold text-primary-600 text-sm">
                  <Loader2 size={12} className="animate-spin" />
                  {isPaid ? 'Payment verified' : 'Waiting for completion...'}
                </span>
              </div>
            </div>

            <p className="mt-8 text-xs text-gray-400">
              A copy of your order summary has been logged to our systems. Reference: {submittedReference}
            </p>
          </div>
        </div>
      </StorefrontShell>
    )
  }

  const shippingOptions = shippingOptionsQuery.data || { countries: ['Kenya'], regions: [], towns: [] }
  const shippingQuote = shippingQuoteQuery.data
  const deliveryFee = shippingQuote?.matched ? Number(shippingQuote.price || 0) : 0
  const estimatedTotal = subtotal + deliveryFee

  return (
    <StorefrontShell
      backHref="/shop/cart"
      backLabel="Back to cart"
      title="Checkout"
      description="Complete your venue order with a guided 4-step flow."
    >
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-4">
          {steps.map((item) => (
            <StepCard key={item.id} step={item} currentStep={step} />
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.15fr,0.85fr]">
          <form
            onSubmit={(e) => e.preventDefault()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault()
              }
            }}
            className="space-y-6"
          >
            {step === 1 ? (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900">Step 1: Customer info</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Full name</label>
                    <input
                      value={form.customer_name}
                      onChange={(event) => updateField('customer_name', event.target.value)}
                      className="input"
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Phone number</label>
                    <input
                      value={form.customer_phone}
                      onChange={(event) => updateField('customer_phone', event.target.value)}
                      className="input"
                      placeholder="0712 345 678"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Email address</label>
                    <input
                      type="email"
                      value={form.customer_email}
                      onChange={(event) => updateField('customer_email', event.target.value)}
                      className="input"
                      placeholder="ops@yourvenue.com"
                      required
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900">Step 2: Shipping</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label">County</label>
                    <select
                      value={form.shipping_county}
                      onChange={(event) => updateField('shipping_county', event.target.value)}
                      className="input"
                    >
                      <option value="">Select county</option>
                      {(shippingOptions.counties || []).map((county) => (
                        <option key={county} value={county}>
                          {county}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Delivery address</label>
                    <textarea
                      value={form.delivery_address}
                      onChange={(event) => updateField('delivery_address', event.target.value)}
                      className="input min-h-28"
                      placeholder="Venue location, branch, building, estate, or dispatch notes"
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
                  {shippingQuoteQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-primary-700">
                      <Loader2 size={15} className="animate-spin" />
                      Fetching shipping cost...
                    </div>
                  ) : shippingQuote?.matched ? (
                    <>
                      <p className="font-semibold text-gray-900">
                        Shipping fee: {formatCurrency(shippingQuote.price)}
                      </p>
                      <p className="mt-1">
                        {shippingQuote.message}
                      </p>
                    </>
                  ) : (
                    <p className="font-medium text-amber-700">
                      Contact us for shipping quote.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900">Step 3: Payment</h2>
                {availableMethods.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    No online payment method is configured for the storefront yet. Please contact support before placing an order.
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {availableMethods.map((method) => {
                      const Icon = method.icon
                      const selected = form.payment_method === method.id

                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => updateField('payment_method', method.id)}
                          className={`rounded-2xl border p-4 text-left transition-colors ${
                            selected ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:border-primary-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`rounded-xl p-2 ${selected ? 'bg-white text-primary-600' : 'bg-gray-50 text-gray-500'}`}>
                              <Icon size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{method.label}</p>
                              <p className="text-xs text-gray-700">{method.note}</p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900">Step 4: Review</h2>
                <div className="mt-5 space-y-4 text-sm text-gray-700">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Customer</p>
                    <p className="mt-2 font-semibold text-gray-900">{form.customer_name}</p>
                    <p className="mt-1">{form.customer_phone}</p>
                    <p className="mt-1">{form.customer_email}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Shipping</p>
                    <p className="mt-2 font-semibold text-gray-900">
                      {[form.shipping_town, form.shipping_region, form.shipping_country].filter(Boolean).join(', ')}
                    </p>
                    <p className="mt-1">{form.delivery_address}</p>
                    <p className="mt-2 text-sm text-gray-600">
                      {shippingQuote?.matched
                        ? `Shipping fee ${formatCurrency(shippingQuote.price)}`
                        : 'Contact us for shipping quote.'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Payment</p>
                    <p className="mt-2 font-semibold text-gray-900 capitalize">{form.payment_method}</p>
                    {form.notes ? <p className="mt-2 text-gray-600">{form.notes}</p> : null}
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Order summary</p>
                    <div className="mt-3 space-y-3">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                            <p className="mt-1 text-xs text-gray-500">Qty {item.quantity}</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(Number(item.price) * item.quantity)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 space-y-2 rounded-2xl bg-white px-4 py-4">
                      <div className="flex items-center justify-between">
                        <span>Items subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Shipping</span>
                        <span>
                          {shippingQuote?.matched
                            ? formatCurrency(deliveryFee)
                            : 'Manual quote'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-base font-semibold text-gray-900">
                        <span>Total</span>
                        <span>{formatCurrency(estimatedTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-900">
                  Review this summary, then use the button below to start payment manually.
                </div>
              </div>
            ) : null}

            <div className="card p-6">
              <label className="label">Order notes</label>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                className="input min-h-24"
                placeholder="Installation needs, preferred delivery window, custom bundle requests..."
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {step > 1 ? (
                <button
                  key={`btn-back-${step}`}
                  type="button"
                  onClick={goBack}
                  className="btn-outline"
                >
                  Back
                </button>
              ) : null}

              {step < 4 ? (
                <button
                  key={`btn-next-${step}`}
                  type="button"
                  onClick={goNext}
                  className="btn-primary"
                >
                  Continue to {steps[step]?.title || 'next step'}
                </button>
              ) : (
                <button
                  key="btn-confirm-final"
                  type="button"
                  onClick={handleSubmit}
                  disabled={checkoutMutation.isPending || availableMethods.length === 0}
                  className="btn-primary flex items-center gap-2"
                >
                  {checkoutMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                  {form.payment_method === 'paystack' ? 'Confirm and pay' : 'Pay now'}
                </button>
              )}
            </div>
          </form>

          <aside className="space-y-4">
            <div className="card p-6">
              <h2 className="text-base font-semibold text-gray-900">Order summary</h2>
              <div className="mt-5 space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <img
                      src={getPrimaryImage(item.images)}
                      alt={item.name}
                      className="h-16 w-16 rounded-2xl object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(Number(item.price) * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3 border-t border-gray-100 pt-4 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {step >= 2 ? (
                  <div className="flex items-center justify-between">
                    <span>Shipping</span>
                    <span>
                      {shippingQuote?.matched
                        ? formatCurrency(deliveryFee)
                        : 'Contact us for shipping quote.'}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-base font-semibold text-gray-900">
                  <span>
                    {step >= 2
                      ? shippingQuote?.matched
                        ? 'Current total'
                        : 'Subtotal before shipping'
                      : 'Estimated total'}
                  </span>
                  <span>{formatCurrency(estimatedTotal)}</span>
                </div>
              </div>

              {step >= 2 ? (
                <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  <div className="flex items-start gap-2">
                    <MapPin size={15} className="mt-0.5 text-primary-600" />
                    <span>
                      {shippingQuote?.matched
                        ? shippingQuote.message
                        : 'No shipping rule matched this destination yet. The order can still be submitted and the team will follow up with a manual quote.'}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </StorefrontShell>
  )
}
