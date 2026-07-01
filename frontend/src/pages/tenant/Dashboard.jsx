import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Copy, CreditCard, ExternalLink, Router, Star, Users, Wifi } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/formatters'
import { useAuthStore } from '@/store/auth'

const chartColors = ['#1D9E75', '#23C7D9', '#4F8CFF', '#FFB020']

function MetricCard({ label, value, note, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-gray-500">{label}</p>
        <div className="rounded-2xl bg-primary-50 p-2 text-primary-600">
          <Icon size={16} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-2 text-sm text-gray-900">{note}</p>
    </div>
  )
}

function EmptyChartState({ text }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
      {text}
    </div>
  )
}

export default function TenantDashboard() {
  const { tenant } = useAuthStore()

  const { data: dash, isLoading } = useQuery({
    queryKey: ['tenant-dashboard'],
    queryFn: () => api.get('/tenant/dashboard').then((response) => response.data),
    refetchInterval: 30000,
  })

  const { data: analytics } = useQuery({
    queryKey: ['tenant-analytics', 30],
    queryFn: () => api.get('/tenant/analytics?days=30').then((response) => response.data),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['tenant-top-customers'],
    queryFn: () => api.get('/tenant/customers').then((response) => response.data),
  })

  const portalUrl = `${window.location.origin}/portal/${tenant?.id}`
  const workspaceStatus = dash?.subscription?.status || dash?.tenant_status || tenant?.status
  const paymentData = useMemo(
    () => Object.entries(analytics?.paymentSplit || {}).map(([name, value]) => ({ name, value })),
    [analytics?.paymentSplit]
  )
  const packageData = useMemo(
    () => [...(analytics?.byPackage || [])].sort((a, b) => b.count - a.count).slice(0, 5),
    [analytics?.byPackage]
  )
  const topCustomers = customers.slice(0, 5)
  const averageRevenuePerSession = analytics?.totalSessions
    ? (analytics.totalRevenue || 0) / analytics.totalSessions
    : 0

  function copyPortalLink() {
    navigator.clipboard.writeText(portalUrl)
    toast.success('Portal link copied')
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-3xl bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {dash?.payment_setup?.warning_message && !['past_due', 'trial_expired', 'suspended'].includes(workspaceStatus) ? (
        <div className="mb-6 rounded-[30px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">Your portal is not accepting payments.</p>
          <p className="mt-1">
            {dash.payment_setup.warning_message}{' '}
            <Link to="/tenant/settings" className="font-semibold underline">Go to Settings</Link> to complete setup.
          </p>
        </div>
      ) : null}

      {workspaceStatus === 'trial_expired' ? (
        <div className="mb-6 rounded-[30px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">Your trial has expired.</p>
          <p className="mt-1">
            Your portal is no longer accepting new payments.{' '}
            <Link to="/tenant/settings" className="font-semibold underline">Go to Billing</Link> to restore service.
          </p>
        </div>
      ) : null}

      {workspaceStatus === 'past_due' ? (
        <div className="mb-6 rounded-[30px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">Your portal is not accepting payments.</p>
          <p className="mt-1">
            Your trial has ended and payment is overdue. Your workspace will be suspended soon.{' '}
            <Link to="/tenant/settings" className="font-semibold underline">Go to Billing</Link> to restore service.
          </p>
        </div>
      ) : null}

      {workspaceStatus === 'suspended' ? (
        <div className="mb-6 rounded-[30px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <p className="font-semibold">Your workspace is suspended.</p>
          <p className="mt-1">
            Your portal is not accepting payments. Customers cannot purchase new WiFi sessions.{' '}
            <Link to="/tenant/settings" className="font-semibold underline">Go to Billing</Link> to restore service.
          </p>
        </div>
      ) : null}

      <div className="rounded-[36px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Tenant workspace</p>
            <h1 className="mt-3 text-4xl font-bold text-gray-900">{tenant?.name || 'Dashboard'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-900">
              Monitor revenue, session activity, package performance, customer value, and portal reach from one workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:border-primary-200 hover:bg-primary-50"
            >
              <ExternalLink size={15} />
              Open customer portal
            </a>
            <button
              type="button"
              onClick={copyPortalLink}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:border-primary-200 hover:bg-primary-50"
            >
              <Copy size={15} />
              Copy portal link
            </button>
          </div>
        </div>

        {dash?.subscription ? (
          <div className="mt-6 rounded-[28px] border border-primary-100 bg-primary-50/70 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary-700">Plan</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">{dash.subscription.plan_name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary-700">Subscription status</p>
                <p className="mt-2 text-sm font-semibold capitalize text-gray-900">{dash.subscription.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary-700">
                  {dash.subscription.status === 'trialing' ? 'Trial ends' : 'Next billing date'}
                </p>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {formatDateTime(
                    dash.subscription.status === 'trialing'
                      ? dash.subscription.trial_ends_at
                      : dash.subscription.next_billing_date
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Today's revenue"
            value={formatCurrency(dash?.todayRevenue || 0)}
            note="Completed payments collected so far today."
            icon={CreditCard}
          />
          <MetricCard
            label="Active sessions"
            value={formatNumber(dash?.activeSessions || 0)}
            note="Sessions currently active on the portal."
            icon={Wifi}
          />
          <MetricCard
            label="Revenue (30d)"
            value={formatCurrency(analytics?.totalRevenue || 0)}
            note="Completed customer revenue in the last 30 days."
            icon={CreditCard}
          />
          <MetricCard
            label="Customers"
            value={formatNumber(dash?.totalCustomers || 0)}
            note="Unique customer phones seen across sessions."
            icon={Users}
          />
          <MetricCard
            label="Routers online"
            value={`${formatNumber(dash?.routers?.online || 0)} / ${formatNumber(dash?.routers?.total || 0)}`}
            note="Online routers versus total registered routers."
            icon={Router}
          />
          <MetricCard
            label="Sessions (30d)"
            value={formatNumber(analytics?.totalSessions || 0)}
            note={`Average revenue per session: ${formatCurrency(averageRevenuePerSession)}`}
            icon={Star}
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-[30px] border border-gray-100 bg-gray-50 p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Revenue trend</p>
                <p className="mt-1 text-sm text-gray-900">Completed portal revenue across the last 30 days.</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Today</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{format(new Date(), 'MMM d, yyyy')}</p>
              </div>
            </div>

            {(analytics?.timeline || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={analytics.timeline}>
                  <defs>
                    <linearGradient id="tenantRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#1D9E75" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `KES ${Math.round(value / 1000)}k`} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), 'Revenue']}
                    labelFormatter={(value) => `Date: ${value}`}
                    contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', color: '#111827' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#1D9E75" strokeWidth={3} fill="url(#tenantRevenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState text="Revenue starts plotting here once customers begin paying." />
            )}
          </div>

          <div className="rounded-[30px] border border-gray-100 bg-gray-50 p-5">
            <p className="text-sm font-semibold text-gray-900">Payment mix</p>
            <p className="mt-1 text-sm text-gray-900">Revenue split by payment method for the last 30 days.</p>
            {paymentData.length > 0 ? (
              <>
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentData} dataKey="value" innerRadius={55} outerRadius={82} paddingAngle={4}>
                        {paymentData.map((entry, index) => (
                          <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {paymentData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                        <span className="text-sm text-gray-900">{entry.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChartState text="Payment methods appear here once collections begin." />
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-900">Top packages</p>
            <p className="mt-1 text-sm text-gray-900">Which packages customers are selecting most often.</p>
          </div>

          {packageData.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-[1fr,0.95fr]">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={packageData}>
                    <CartesianGrid vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fill: '#111827', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      formatter={(value) => [formatNumber(value), 'Sessions']}
                      contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', color: '#111827' }}
                    />
                    <Bar dataKey="count" radius={[10, 10, 0, 0]} fill="#23C7D9" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {packageData.map((pkg, index) => (
                  <div key={pkg.name} className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-sm font-semibold text-primary-700">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{pkg.name}</p>
                          <p className="text-xs text-gray-500">Package demand</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{formatNumber(pkg.count)} sessions</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChartState text="Package demand appears here once sessions are created." />
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Top customers</p>
                <p className="mt-1 text-sm text-gray-700">Phones ranked by total spend and repeat activity.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {topCustomers.length > 0 ? (
                topCustomers.map((customer) => (
                  <div key={customer.phone} className="rounded-3xl bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{customer.phone}</p>
                        <p className="mt-1 text-xs text-gray-600">{formatNumber(customer.sessions)} sessions</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(customer.totalSpent)}</p>
                        <p className="mt-1 text-xs text-gray-600">Last seen {String(customer.lastSeen || '').slice(0, 10) || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-gray-50 p-5 text-sm text-gray-700">
                  Customer value appears here once sessions start accumulating.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm font-semibold text-gray-900">Portal access</p>
            <p className="mt-1 text-sm text-gray-700">Use this link on hotspot pages, QR codes, or counter handoff.</p>
            <div className="mt-5 rounded-3xl bg-primary-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-700">Portal URL</p>
              <code className="mt-3 block break-all rounded-2xl border border-primary-100 bg-white px-4 py-3 text-xs text-primary-900">
                {portalUrl}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
