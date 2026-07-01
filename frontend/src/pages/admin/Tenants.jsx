import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Gift,
  MessageSquare,
  Package,
  RefreshCw,
  Router,
  Search,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'
import ComposeMessage from '@/components/ui/ComposeMessage'
import { formatCurrency, formatDate } from '@/lib/formatters'

// ── helpers ────────────────────────────────────────────────────
function formatBillingDate(value) {
  if (!value) return 'Not scheduled'
  try { return formatDate(value) } catch { return 'Not scheduled' }
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const STATUS_STYLES = {
  active:    'bg-green-50 text-green-700 border border-green-200',
  trialing:  'bg-blue-50 text-blue-700 border border-blue-200',
  suspended: 'bg-red-50 text-red-700 border border-red-200',
  past_due:  'bg-orange-50 text-orange-700 border border-orange-200',
  pending:   'bg-gray-100 text-gray-600 border border-gray-200',
  hold:      'bg-gray-100 text-gray-600 border border-gray-200',
}

function StatusBadge({ status }) {
  const label = status === 'past_due' ? 'Past Due' : (status || 'unknown')
  const cls = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  )
}

function PaymentBadge({ label, ready }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ready ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {ready ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
      {label}
    </span>
  )
}

// ── stat card ──────────────────────────────────────────────────
function StatCard({ label, value, color = 'gray' }) {
  const colors = {
    gray:   'bg-white border-gray-200',
    green:  'bg-green-50 border-green-200',
    orange: 'bg-orange-50 border-orange-200',
    red:    'bg-red-50 border-red-200',
  }
  const valueColors = {
    gray: 'text-gray-900', green: 'text-green-700', orange: 'text-orange-700', red: 'text-red-700',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColors[color]}`}>{value}</p>
    </div>
  )
}

// ── tenant detail side panel ───────────────────────────────────
function TenantPanel({ tenantId, onClose, onGrace, onStatusChange, onMessage }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenant-detail', tenantId],
    queryFn: () => api.get(`/admin/tenants/${tenantId}`).then(r => r.data),
    enabled: Boolean(tenantId),
  })

  const tenant  = data?.tenant
  const stats   = data?.stats
  const txs     = data?.recent_transactions || []
  const grants  = data?.grace_grants || []
  const sub     = tenant?.tenant_subscriptions?.[0]
  const owner   = tenant?.users?.[0]
  const payment = tenant?.payment_setup

  if (isLoading || !tenant) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-gray-400">
        <RefreshCw size={20} className="animate-spin" />
        <span className="text-sm">Loading tenant…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto text-sm">
      {/* header */}
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div>
          <p className="font-semibold text-gray-900 text-base">{tenant.name}</p>
          <p className="text-xs text-gray-500 capitalize mt-0.5">{tenant.business_type || 'other'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Registered {formatDate(tenant.created_at)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={tenant.effective_status || tenant.status} />
            <PaymentBadge label="Paystack" ready={payment?.paystack?.ready} />
            <PaymentBadge label="M-Pesa" ready={payment?.mpesa?.ready} />
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
          <X size={16} />
        </button>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-4 gap-0 border-b border-gray-100">
        {[
          { label: 'Plan', value: sub?.plan_name || tenant.workspace_plan_name || '—' },
          { label: 'Routers', value: `${stats?.routers_online || 0}/${stats?.routers_total || 0}` },
          { label: 'Packages', value: stats?.packages_total || 0 },
          { label: 'Revenue', value: formatCurrency(stats?.total_revenue || 0) },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 text-center border-r border-gray-100 last:border-0">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="font-semibold text-gray-900 mt-0.5 truncate text-sm">{value}</p>
          </div>
        ))}
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-gray-100">
        <button
          onClick={() => onMessage(tenant.id)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition-colors"
        >
          <MessageSquare size={12} /> Send message
        </button>
        <button
          onClick={() => onGrace(tenant)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 font-medium transition-colors"
        >
          <Gift size={12} /> Grant grace
        </button>
        {tenant.status !== 'suspended' ? (
          <button
            onClick={() => onStatusChange(tenant.id, 'suspended')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors"
          >
            <XCircle size={12} /> Suspend
          </button>
        ) : (
          <button
            onClick={() => onStatusChange(tenant.id, 'active')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors"
          >
            <CheckCircle2 size={12} /> Reactivate
          </button>
        )}
      </div>

      {/* profile */}
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Tenant Profile</p>
        <div className="space-y-2">
          {[
            { label: 'Owner', value: owner?.name || '—' },
            { label: 'Email', value: owner?.email || tenant.contact_email || '—' },
            { label: 'Phone', value: owner?.phone || tenant.contact_phone || '—' },
            { label: 'Trial ends', value: sub?.trial_ends_at ? formatBillingDate(sub.trial_ends_at) : '—' },
            { label: 'Next billing', value: formatBillingDate(sub?.next_billing_date) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-gray-400">{label}</span>
              <span className="text-gray-900 font-medium text-right max-w-[60%] truncate">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* payment setup */}
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Payment Setup</p>
        <div className="space-y-2">
          {[
            { label: 'Paystack', ready: payment?.paystack?.ready, missing: payment?.paystack?.missing_fields },
            { label: 'M-Pesa', ready: payment?.mpesa?.ready, missing: payment?.mpesa?.missing_fields },
          ].map(({ label, ready, missing }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-gray-400">{label}</span>
              {ready ? (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Complete</span>
              ) : (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle size={12} /> Missing: {(missing || []).slice(0, 2).join(', ')}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* recent transactions */}
      {txs.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Recent Transactions</p>
          <div className="space-y-2">
            {txs.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-700">{tx.customer_email || tx.phone || '—'}</p>
                  <p className="text-xs text-gray-400">{formatDate(tx.paid_at || tx.created_at)}</p>
                </div>
                <span className="text-xs font-semibold text-gray-900">{formatCurrency(tx.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* grace grants */}
      {grants.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Grace Grants</p>
          <div className="space-y-2">
            {grants.slice(0, 5).map((g) => (
              <div key={g.id} className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-700">{g.reason || 'No reason'}</p>
                  <p className="text-xs text-gray-400">{formatDate(g.granted_at)}</p>
                </div>
                <span className="text-xs font-semibold text-blue-600">+{g.days_granted}d</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* active sessions */}
      <div className="p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Active Sessions</p>
        <p className="text-lg font-bold text-gray-900">{stats?.active_sessions || 0}</p>
      </div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────
export default function Tenants() {
  const queryClient = useQueryClient()

  // filter state
  const [search, setSearch]               = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterPlan, setFilterPlan]       = useState('')
  const [trialWithin, setTrialWithin]     = useState('')
  const [hasPayment, setHasPayment]       = useState('')
  const [regFrom, setRegFrom]             = useState('')
  const [regTo, setRegTo]                 = useState('')

  // ui state
  const [selectedId, setSelectedId]       = useState(null)
  const [graceModal, setGraceModal]       = useState(null)
  const [graceDays, setGraceDays]         = useState('1')
  const [graceReason, setGraceReason]     = useState('')
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false)
  const [messageForm, setMessageForm] = useState({ channel: 'email', subject: '', message: '', recipientType: 'all' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenants', filterStatus, filterPlan, trialWithin, hasPayment, regFrom, regTo],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterPlan)   params.set('plan', filterPlan)
      if (trialWithin)  params.set('trial_ending_within', trialWithin)
      if (hasPayment)   params.set('has_payment_setup', hasPayment)
      if (regFrom)      params.set('registered_from', regFrom)
      if (regTo)        params.set('registered_to', regTo)
      const qs = params.toString()
      return api.get(`/admin/tenants${qs ? `?${qs}` : ''}`).then(r => r.data)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/admin/tenants/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] })
      queryClient.invalidateQueries({ queryKey: ['admin-tenant-detail', selectedId] })
      toast.success('Tenant status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const graceMutation = useMutation({
    mutationFn: ({ id, days_granted, reason }) =>
      api.post(`/admin/tenants/${id}/grace-grants`, { days_granted, reason }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] })
      queryClient.invalidateQueries({ queryKey: ['admin-tenant-detail', selectedId] })
      toast.success('Grace days granted')
      setGraceModal(null)
      setGraceDays('1')
      setGraceReason('')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to grant grace days'),
  })

  const [sendResult, setSendResult] = useState(null)

  const messageMutation = useMutation({
    mutationFn: (payload) => api.post('/admin/communications', payload).then(r => r.data),
    onSuccess: (data) => {
      setSendResult({ success: true, count: data.recipient_count })
      setMessageForm({ channel: 'email', subject: '', message: '', recipientType: 'all' })
      setTimeout(() => {
        setIsMessageModalOpen(false)
        setSendResult(null)
      }, 2000)
    },
    onError: (err) => {
      setSendResult({ success: false, error: err.response?.data?.error || 'Failed to send message' })
    },
  })

  const openMessageModal = (tenantId = null) => {
    setMessageForm({
      channel: 'email',
      subject: '',
      message: '',
      recipientType: tenantId || 'all'
    })
    setIsMessageModalOpen(true)
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!messageForm.message) return
    const showSubject = messageForm.channel === 'email' || messageForm.channel === 'both'
    if (showSubject && !messageForm.subject) return

    messageMutation.mutate({
      subject: messageForm.subject || `FlowFi Message — ${new Date().toLocaleDateString()}`,
      message: messageForm.message,
      channel: messageForm.channel,
      recipient_type: messageForm.recipientType === 'all' ? 'all' : 'specific',
      filters: messageForm.recipientType === 'all' ? {} : { id: messageForm.recipientType }
    })
  }

  const allTenants = data?.tenants || []

  // client-side search (backend already filters status/plan/etc)
  const tenants = useMemo(() => {
    if (!search.trim()) return allTenants
    const term = search.trim().toLowerCase()
    return allTenants.filter((t) =>
      [t.name, t.business_type, t.contact_email, t.users?.[0]?.name, t.users?.[0]?.email]
        .filter(Boolean).join(' ').toLowerCase().includes(term)
    )
  }, [allTenants, search])

  // stats
  const statsActive    = allTenants.filter(t => (t.effective_status || t.status) === 'active').length
  const statsSuspended = allTenants.filter(t => (t.effective_status || t.status) === 'suspended').length
  const statsPastDue   = allTenants.filter(t => (t.effective_status || t.status) === 'past_due').length

  return (
    <div className={`flex h-full ${selectedId ? 'overflow-hidden' : ''}`}>
      {/* Main content */}
      <div className={`flex-1 p-8 overflow-y-auto min-w-0 transition-all duration-300 ${selectedId ? 'pr-4' : ''}`}>
        <PageHeader
          eyebrow="Platform"
          title="Tenants"
          description="Manage workspace access, review plan status, and extend billing dates when a venue needs service recovery time."
          actions={
            <button
              onClick={() => openMessageModal(selectedId)}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition-colors"
            >
              <MessageSquare size={16} /> Send communication
            </button>
          }
        />

        {/* stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Filtered Tenants" value={tenants.length} color="gray" />
          <StatCard label="Active" value={statsActive} color="green" />
          <StatCard label="Past Due" value={statsPastDue} color="orange" />
          <StatCard label="Suspended" value={statsSuspended} color="red" />
        </div>

        {/* filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 space-y-3">
          <div className="flex gap-3 flex-wrap">
            {/* search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9 w-full"
                placeholder="Search business name, owner, email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* plan */}
            <select className="input w-40" value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
              <option value="">All plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>

            {/* status */}
            <select className="input w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="suspended">Suspended</option>
              <option value="past_due">Past Due</option>
              <option value="pending">Hold</option>
            </select>

            {/* trial within */}
            <select className="input w-48" value={trialWithin} onChange={e => setTrialWithin(e.target.value)}>
              <option value="">Trial ending: any</option>
              <option value="7">Within 7 days</option>
              <option value="3">Within 3 days</option>
              <option value="1">Today</option>
            </select>

            {/* payment setup */}
            <select className="input w-48" value={hasPayment} onChange={e => setHasPayment(e.target.value)}>
              <option value="">Payment setup: either</option>
              <option value="yes">Paystack or M-Pesa ready</option>
              <option value="no">None setup</option>
            </select>
          </div>

          {/* date range */}
          <div className="flex gap-3 items-center flex-wrap">
            <span className="text-xs text-gray-500">Registered:</span>
            <input type="date" className="input w-40 text-sm" value={regFrom} onChange={e => setRegFrom(e.target.value)} />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" className="input w-40 text-sm" value={regTo} onChange={e => setRegTo(e.target.value)} />
            {(search || filterStatus || filterPlan || trialWithin || hasPayment || regFrom || regTo) && (
              <button
                onClick={() => { setSearch(''); setFilterStatus(''); setFilterPlan(''); setTrialWithin(''); setHasPayment(''); setRegFrom(''); setRegTo('') }}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* header */}
          <div className="grid grid-cols-12 px-5 py-3 text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
            <span className="col-span-3">Business</span>
            <span className="col-span-2">Plan</span>
            <span className="col-span-2">Next Billing</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-3">Payment Setup</span>
          </div>

          {isLoading && (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && tenants.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">No tenants match your filters</div>
          )}

          {tenants.map(tenant => {
            const owner = tenant.users?.[0]
            const sub   = tenant.tenant_subscriptions?.[0]
            const payment = tenant.payment_setup
            const status  = tenant.effective_status || tenant.status
            const trialDays = daysUntil(sub?.trial_ends_at)
            const isSelected = selectedId === tenant.id

            return (
              <div
                key={tenant.id}
                onClick={() => setSelectedId(isSelected ? null : tenant.id)}
                className={`grid grid-cols-12 items-center gap-3 px-5 py-4 border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
              >
                {/* business */}
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                    <ChevronRight size={12} className="text-gray-300" />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400 capitalize">{tenant.business_type || 'other'}</p>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">{owner?.email || tenant.contact_email || '—'}</p>
                </div>

                {/* plan */}
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-900">{sub?.plan_name || tenant.workspace_plan_name || '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(sub?.amount || 0)}</p>
                </div>

                {/* billing */}
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-900">{formatBillingDate(sub?.next_billing_date)}</p>
                  {sub?.trial_ends_at && trialDays !== null && (
                    <p className={`text-xs mt-0.5 ${trialDays <= 3 ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
                      Trial {trialDays >= 0 ? `ends in ${trialDays}d` : 'ended'}
                    </p>
                  )}
                </div>

                {/* status */}
                <div className="col-span-2">
                  <StatusBadge status={status} />
                </div>

                {/* payment badges */}
                <div className="col-span-3 flex flex-wrap gap-1">
                  <PaymentBadge label="Paystack" ready={payment?.paystack?.ready} />
                  <PaymentBadge label="M-Pesa" ready={payment?.mpesa?.ready} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Side panel */}
      {selectedId && (
        <div className="w-96 shrink-0 border-l border-gray-200 bg-white overflow-hidden flex flex-col">
          <TenantPanel
            tenantId={selectedId}
            onClose={() => setSelectedId(null)}
            onGrace={(tenant) => { setGraceModal(tenant); setGraceDays('1'); setGraceReason('') }}
            onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
            onMessage={(id) => openMessageModal(id)}
          />
        </div>
      )}

      {/* Message modal */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setIsMessageModalOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Send Communication</h2>
            <p className="text-sm text-gray-500 mb-6">
              {messageForm.recipientType === 'all' 
                ? 'Sending to all tenants on the platform.'
                : `Sending to selected tenant.`}
            </p>

            <form onSubmit={handleSendMessage} className="space-y-4">
              {/* result banner */}
              {sendResult && (
                <div className={`p-4 rounded-xl border flex gap-3 ${
                  sendResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {sendResult.success
                    ? <div className="text-green-600 shrink-0 text-xl font-bold">✓</div>
                    : <div className="text-red-600 shrink-0 text-xl font-bold">!</div>}
                  <div>
                    <p className="font-medium">{sendResult.success ? 'Message Sent Successfully' : 'Delivery Failed'}</p>
                    <p className="text-sm opacity-80 mt-1">
                      {sendResult.success ? `Delivered to ${sendResult.count} recipient(s)` : sendResult.error}
                    </p>
                  </div>
                </div>
              )}

              <ComposeMessage 
                channel={messageForm.channel} 
                setChannel={(ch) => setMessageForm({ ...messageForm, channel: ch })} 
                subject={messageForm.subject} 
                setSubject={(sub) => setMessageForm({ ...messageForm, subject: sub })} 
                message={messageForm.message} 
                setMessage={(msg) => setMessageForm({ ...messageForm, message: msg })} 
              />

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsMessageModalOpen(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={messageMutation.isPending}
                  className="btn-primary"
                >
                  {messageMutation.isPending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grace modal */}
      {graceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setGraceModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-1 font-semibold text-gray-900">Grant grace days</h3>
            <p className="mb-5 text-sm text-gray-500">{graceModal.name}</p>
            <div className="grid gap-4">
              <div>
                <label className="label">Days granted</label>
                <input
                  type="number" min={1} step={1} className="input"
                  value={graceDays} onChange={e => setGraceDays(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Reason</label>
                <textarea
                  className="input min-h-28" value={graceReason}
                  onChange={e => setGraceReason(e.target.value)}
                  placeholder="Power outage, ISP downtime, maintenance delay…"
                />
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Next billing date will move from{' '}
                <strong>{formatBillingDate(graceModal.tenant_subscriptions?.[0]?.next_billing_date)}</strong>.
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setGraceModal(null)} className="btn-ghost flex-1">Cancel</button>
              <button
                type="button"
                disabled={graceMutation.isPending}
                onClick={() => graceMutation.mutate({ id: graceModal.id, days_granted: Number(graceDays), reason: graceReason })}
                className="btn-primary flex-1"
              >
                {graceMutation.isPending ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
