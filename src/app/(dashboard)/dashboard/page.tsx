import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
import {
  Users,
  CreditCard,
  Router,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          cookies().getAll().map((c) => ({ name: c.name, value: c.value })),
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  // Get tenant_id from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', session.user.id)
    .single()

  const tenantId = profile?.tenant_id

  // Fetch stats in parallel
  const [customersRes, routersRes, paymentsRes] = await Promise.all([
    tenantId
      ? supabase.from('demo_customers').select('id, status').eq('tenant_id', tenantId)
      : Promise.resolve({ data: [] }),
    tenantId
      ? supabase.from('routers').select('id, name, location, status').eq('tenant_id', tenantId)
      : Promise.resolve({ data: [] }),
    tenantId
      ? supabase
          .from('transactions')
          .select('id, amount, status, payment_method, created_at, customer_email')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ])

  const customers = customersRes.data ?? []
  const routers = routersRes.data ?? []
  const payments = paymentsRes.data ?? []

  const activeCustomers = customers.filter((c) => c.status === 'active').length
  const onlineRouters = routers.filter((r) => r.status === 'online').length
  const completedPayments = payments.filter((p) => p.status === 'success')
  const totalRevenue = completedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const recentPayments = payments.slice(0, 5)

  const stats = [
    {
      label: 'Total Revenue',
      value: `KES ${totalRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      trend: '+12%',
      up: true,
    },
    {
      label: 'Active Customers',
      value: activeCustomers.toString(),
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      trend: '+3',
      up: true,
    },
    {
      label: 'Total Payments',
      value: completedPayments.length.toString(),
      icon: CreditCard,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      trend: '+8%',
      up: true,
    },
    {
      label: 'Routers Online',
      value: `${onlineRouters} / ${routers.length}`,
      icon: Router,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      trend: onlineRouters === routers.length ? '100%' : `${Math.round((onlineRouters / (routers.length || 1)) * 100)}%`,
      up: onlineRouters === routers.length,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your ISP operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${stat.up ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {stat.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {stat.trend}
                </span>
              </div>
              <p className="mt-4 text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Bottom Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* Recent Payments */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Payments</h2>
            <a href="/dashboard/payments" className="text-xs text-primary hover:underline">
              View all →
            </a>
          </div>
          <div className="divide-y divide-border">
            {recentPayments.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No payments yet</p>
            ) : (
              recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {payment.customer_email ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {payment.payment_method} · {new Date(payment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      KES {Number(payment.amount).toLocaleString()}
                    </p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        payment.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : payment.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Router Status */}
        <div className="rounded-xl border border-border bg-card shadow-sm min-w-[260px]">
          <div className="border-b border-border px-6 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Routers</h2>
            <a href="/dashboard/routers" className="text-xs text-primary hover:underline">
              Manage →
            </a>
          </div>
          <div className="divide-y divide-border">
            {routers.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No routers</p>
            ) : (
              routers.map((router) => (
                <div key={router.id} className="flex items-center gap-3 px-6 py-3">
                  <div
                    className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                      router.status === 'online' ? 'bg-emerald-400' : 'bg-red-400'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{router.name}</p>
                    <p className="text-xs text-muted-foreground">{router.location}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Activity bar */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-cyan-400" />
          <h2 className="font-semibold text-foreground">Customer Status Overview</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {(['active', 'suspended', 'expired'] as const).map((status) => {
            const count = customers.filter((c) => c.status === status).length
            const pct = customers.length > 0 ? Math.round((count / customers.length) * 100) : 0
            const colors = {
              active: { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              suspended: { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
              expired: { bar: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10' },
            }
            const c = colors[status]
            return (
              <div key={status} className={`rounded-lg p-4 ${c.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium capitalize text-foreground">{status}</p>
                  <p className={`text-lg font-bold ${c.text}`}>{count}</p>
                </div>
                <div className="h-2 rounded-full bg-border">
                  <div
                    className={`h-2 rounded-full ${c.bar} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{pct}% of total</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
