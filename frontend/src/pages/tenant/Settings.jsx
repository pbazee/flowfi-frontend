import { useEffect, useMemo, useState } from 'react'
import { useIsDemo } from '@/hooks/useIsDemo'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ExternalLink,
  Palette,
  Phone,
  Save,
  Settings2,
  ShieldCheck,
  Store,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import { useAuthStore } from '@/store/auth'

const initialForm = {
  name: '',
  business_type: '',
  logo_url: '',
  portal_primary_color: '#0F6E56',
  portal_secondary_color: '#1D9E75',
  portal_welcome_message: '',
  mpesa_shortcode: '',
  mpesa_paybill: '',
  mpesa_consumer_key: '',
  mpesa_consumer_secret: '',
  mpesa_passkey: '',
  paystack_public_key: '',
  paystack_secret_key: '',
  contact_phone: '',
  contact_email: '',
  address: '',
}

const fieldLabels = {
  paystack_public_key: 'Paystack public key',
  paystack_secret_key: 'Paystack secret key',
  mpesa_shortcode: 'M-Pesa shortcode',
  mpesa_paybill: 'M-Pesa paybill',
  mpesa_consumer_key: 'M-Pesa consumer key',
  mpesa_consumer_secret: 'M-Pesa consumer secret',
  mpesa_passkey: 'M-Pesa passkey',
}

function WarningBadge({ show }) {
  if (!show) return null

  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
      Payment setup incomplete
    </span>
  )
}

function PaymentField({ label, warning, children }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="label mb-0">{label}</label>
        <WarningBadge show={warning} />
      </div>
      {children}
    </div>
  )
}

export default function Settings() {
  const isDemo = useIsDemo()
  const { tenant, updateTenant } = useAuthStore()
  const [form, setForm] = useState(initialForm)

  const { data: profile } = useQuery({
    queryKey: ['tenant-profile'],
    queryFn: () => api.get('/tenant/profile').then((response) => response.data),
  })

  useEffect(() => {
    if (!profile) return

    setForm({
      ...initialForm,
      ...profile,
      portal_primary_color: profile.portal_primary_color || '#0F6E56',
      portal_secondary_color: profile.portal_secondary_color || '#1D9E75',
      portal_welcome_message:
        profile.portal_welcome_message || 'Welcome to our WiFi. Choose a package to connect.',
    })
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/tenant/profile', payload).then((response) => response.data),
    onSuccess: (data) => {
      updateTenant(data)
      toast.success('Tenant settings saved')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not save settings')
    },
  })

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isDemo) return toast('This is a live demo — sign up to save changes', { icon: '🔒' })
    saveMutation.mutate(form)
  }

  const portalLink = `${window.location.origin}/portal/${tenant?.id || profile?.id || ''}`
  const paymentSetup = profile?.payment_setup || tenant?.payment_setup || null
  const missingFields = paymentSetup?.missing_fields || []

  const paymentSummary = useMemo(
    () => [
      {
        id: 'paystack',
        label: 'Paystack',
        ready: Boolean(paymentSetup?.paystack?.ready),
        missing: (paymentSetup?.paystack?.missing_fields || []).map((key) => fieldLabels[key] || key),
      },
      {
        id: 'mpesa',
        label: 'M-Pesa',
        ready: Boolean(paymentSetup?.mpesa?.ready),
        missing: (paymentSetup?.mpesa?.missing_fields || []).map((key) => fieldLabels[key] || key),
      },
    ],
    [paymentSetup]
  )

  function isFieldIncomplete(key) {
    const currentValue = String(form[key] || '').trim()
    return !currentValue && missingFields.includes(key)
  }

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Workspace"
        title="Tenant settings"
        description="Update business information, portal branding, support contacts, and the payment credentials your venue needs to collect guest WiFi payments directly."
        actions={
          tenant?.id ? (
            <a
              href={portalLink}
              target="_blank"
              rel="noreferrer"
              className="btn-outline flex items-center gap-2"
            >
              <ExternalLink size={14} />
              Open captive portal
            </a>
          ) : null
        }
      />

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <div className="space-y-6">
          {paymentSetup?.warning_message ? (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Your portal is not accepting payments.</p>
                  <p className="mt-1">{paymentSetup.warning_message}</p>
                </div>
              </div>
            </div>
          ) : null}

          <SectionCard
            title="Business identity"
            description="Core information used in your dashboard, checkout flows, and tenant profile."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Business name</label>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  className="input"
                  placeholder="Downtown Cafe WiFi"
                />
              </div>
              <div>
                <label className="label">Business type</label>
                <input
                  value={form.business_type}
                  onChange={(event) => updateField('business_type', event.target.value)}
                  className="input"
                  placeholder="Restaurant, campus, co-working..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Logo URL</label>
                <input
                  value={form.logo_url}
                  onChange={(event) => updateField('logo_url', event.target.value)}
                  className="input"
                  placeholder="https://yourdomain.com/logo.png"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Address</label>
                <textarea
                  value={form.address}
                  onChange={(event) => updateField('address', event.target.value)}
                  className="input min-h-24"
                  placeholder="Branch, building, street, estate..."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Customer contact and payment setup"
            description="Guest WiFi payments use your own M-Pesa or Paystack credentials. Nothing here should fall back to FlowFi superadmin credentials."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Contact phone</label>
                <input
                  value={form.contact_phone}
                  onChange={(event) => updateField('contact_phone', event.target.value)}
                  className="input"
                  placeholder="+254712345678"
                />
              </div>
              <div>
                <label className="label">Contact email</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(event) => updateField('contact_email', event.target.value)}
                  className="input"
                  placeholder="ops@yourbusiness.com"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-gray-50 p-2 text-primary-600">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Paystack</p>
                    <p className="text-xs text-gray-500">Customer card and supported alternative payments</p>
                    <a 
                      href="https://dashboard.paystack.com/#/settings/developer" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-primary-600 transition-colors"
                    >
                      Get this from your Paystack Dashboard <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
                <div className="mt-5 grid gap-4">
                  <PaymentField label="Paystack public key" warning={isFieldIncomplete('paystack_public_key')}>
                    <input
                      value={form.paystack_public_key}
                      onChange={(event) => updateField('paystack_public_key', event.target.value)}
                      className="input"
                      placeholder="pk_live_xxxxx"
                    />
                  </PaymentField>
                  <PaymentField label="Paystack secret key" warning={isFieldIncomplete('paystack_secret_key')}>
                    <input
                      type="password"
                      value={form.paystack_secret_key}
                      onChange={(event) => updateField('paystack_secret_key', event.target.value)}
                      className="input"
                      placeholder="sk_live_xxxxx"
                    />
                  </PaymentField>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-gray-50 p-2 text-primary-600">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">M-Pesa Daraja</p>
                    <p className="text-xs text-gray-500">STK Push and venue-owned collections</p>
                    <a 
                      href="https://developer.safaricom.co.ke/" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-primary-600 transition-colors"
                    >
                      Get this from Safaricom Daraja Portal <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
                <div className="mt-5 grid gap-4">
                  <PaymentField label="M-Pesa shortcode" warning={isFieldIncomplete('mpesa_shortcode')}>
                    <input
                      value={form.mpesa_shortcode}
                      onChange={(event) => updateField('mpesa_shortcode', event.target.value)}
                      className="input"
                      placeholder="174379"
                    />
                  </PaymentField>
                  <PaymentField label="M-Pesa paybill" warning={isFieldIncomplete('mpesa_paybill')}>
                    <input
                      value={form.mpesa_paybill}
                      onChange={(event) => updateField('mpesa_paybill', event.target.value)}
                      className="input"
                      placeholder="400200"
                    />
                  </PaymentField>
                  <PaymentField label="M-Pesa consumer key" warning={isFieldIncomplete('mpesa_consumer_key')}>
                    <input
                      type="password"
                      value={form.mpesa_consumer_key}
                      onChange={(event) => updateField('mpesa_consumer_key', event.target.value)}
                      className="input"
                      placeholder="Daraja consumer key"
                    />
                  </PaymentField>
                  <PaymentField label="M-Pesa consumer secret" warning={isFieldIncomplete('mpesa_consumer_secret')}>
                    <input
                      type="password"
                      value={form.mpesa_consumer_secret}
                      onChange={(event) => updateField('mpesa_consumer_secret', event.target.value)}
                      className="input"
                      placeholder="Daraja consumer secret"
                    />
                  </PaymentField>
                  <PaymentField label="M-Pesa passkey" warning={isFieldIncomplete('mpesa_passkey')}>
                    <input
                      type="password"
                      value={form.mpesa_passkey}
                      onChange={(event) => updateField('mpesa_passkey', event.target.value)}
                      className="input"
                      placeholder="M-Pesa passkey"
                    />
                  </PaymentField>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-gray-50 p-5 text-sm text-gray-600">
              <p className="font-semibold text-gray-900">Where to get these credentials</p>
              <p className="mt-2 leading-relaxed">
                Paystack keys come from your Paystack dashboard after business verification. Daraja consumer credentials and passkey come from Safaricom developer go-live approval for your own till or paybill.
              </p>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Payment readiness"
            description="Guests should only see the payment options you have fully configured."
          >
            <div className="space-y-4">
              {paymentSummary.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-5 ${
                    item.ready ? 'border-green-100 bg-green-50' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                        item.ready ? 'bg-white text-green-700' : 'bg-white text-amber-800'
                      }`}
                    >
                      {item.ready ? 'Ready' : 'Incomplete'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-700">
                    {item.ready
                      ? `${item.label} can be shown on the captive portal.`
                      : `Missing: ${item.missing.join(', ')}`}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Portal branding"
            description="Tune the captive portal colors and welcome copy that new customers see before they connect."
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Primary color</label>
                  <div className="flex items-center gap-3 rounded-2xl border border-gray-200 px-3 py-2">
                    <input
                      type="color"
                      value={form.portal_primary_color}
                      onChange={(event) => updateField('portal_primary_color', event.target.value)}
                      className="h-10 w-12 rounded-lg border-0 bg-transparent p-0"
                    />
                    <input
                      value={form.portal_primary_color}
                      onChange={(event) => updateField('portal_primary_color', event.target.value)}
                      className="w-full bg-transparent text-sm text-gray-700 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Secondary color</label>
                  <div className="flex items-center gap-3 rounded-2xl border border-gray-200 px-3 py-2">
                    <input
                      type="color"
                      value={form.portal_secondary_color}
                      onChange={(event) => updateField('portal_secondary_color', event.target.value)}
                      className="h-10 w-12 rounded-lg border-0 bg-transparent p-0"
                    />
                    <input
                      value={form.portal_secondary_color}
                      onChange={(event) => updateField('portal_secondary_color', event.target.value)}
                      className="w-full bg-transparent text-sm text-gray-700 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Welcome message</label>
                <textarea
                  value={form.portal_welcome_message}
                  onChange={(event) => updateField('portal_welcome_message', event.target.value)}
                  className="input min-h-28"
                  placeholder="Welcome to our hotspot. Pick a package to get online."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Portal preview"
            description="A quick feel for how the customer-facing experience will look with the current colors, message, and support details."
          >
            <div
              className="rounded-[28px] p-6 text-white"
              style={{
                background: `linear-gradient(135deg, ${form.portal_primary_color}, ${form.portal_secondary_color})`,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <Store size={20} />
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                    Guest WiFi
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                    Secure
                  </span>
                </div>
              </div>
              <h3 className="mt-8 text-2xl font-semibold font-display">
                {form.name || 'Your business name'}
              </h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">
                {form.portal_welcome_message || 'Welcome to our WiFi. Choose a package to connect.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-2xl bg-white/15 px-4 py-3 text-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <Palette size={14} />
                    Portal colors
                  </div>
                  <p>{form.portal_primary_color} / {form.portal_secondary_color}</p>
                </div>
                <div className="rounded-2xl bg-white/15 px-4 py-3 text-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <Phone size={14} />
                    Need help? Contact us.
                  </div>
                  <p>{form.contact_phone || 'Add a support number'}</p>
                  <p className="mt-1 text-white/70">{form.contact_email || 'Add a support email'}</p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Save changes"
            description="These updates apply to your tenant profile and customer-facing portal settings."
          >
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className={`btn-primary flex w-full items-center justify-center gap-2 ${isDemo ? 'opacity-80' : ''}`}
            >
              <Save size={15} />
              {saveMutation.isPending ? 'Saving settings...' : 'Save tenant settings'}
            </button>
            <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
              <div className="flex items-center gap-2 text-gray-700">
                <Settings2 size={15} />
                Tips
              </div>
              <p className="mt-2 leading-relaxed">
                Secret keys stay encrypted on the backend and masked after save. Guests should only see payment methods that are fully configured for your venue.
              </p>
            </div>
          </SectionCard>
        </div>
      </form>
    </div>
  )
}
