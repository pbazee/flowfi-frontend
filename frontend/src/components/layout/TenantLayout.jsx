import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  BarChart3,
  CreditCard,
  Gift,
  LayoutDashboard,
  LogOut,
  Package,
  Router,
  Settings,
  Star,
  Store,
  Users,
  Wifi,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useIsDemo } from '@/hooks/useIsDemo'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useSidebarBadges } from '@/hooks/useSidebarBadges'

const navSections = [
  {
    label: 'Operations',
    links: [
      { to: '/tenant', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/tenant/routers', label: 'Routers', icon: Router },
        { to: '/tenant/packages', label: 'Packages', icon: Package },
        { to: '/tenant/session-credits', label: 'Session credits', icon: Gift },
        { to: '/tenant/sessions', label: 'Sessions', icon: Activity, badgeKey: 'active_sessions' },
        { to: '/tenant/transactions', label: 'Transactions', icon: CreditCard, badgeKey: 'pending_transactions' },
        { to: '/tenant/billing', label: 'Billing', icon: CreditCard },
    ],
  },
  {
    label: 'Growth',
    links: [
      { to: '/tenant/loyalty', label: 'Loyalty', icon: Star },
      { to: '/tenant/customers', label: 'Customers', icon: Users, badgeKey: 'new_customers' },
      { to: '/tenant/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/tenant/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function TenantLayout() {
  const { user, tenant, logout } = useAuthStore()
  const navigate = useNavigate()
  const isDemo = useIsDemo()
  const badges = useSidebarBadges(false)

  const { data: demoStatus } = useQuery({
    queryKey: ['demo-status'],
    queryFn: () => api.get('/platform/demo-status').then((res) => res.data),
    enabled: isDemo,
  })

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isPending = tenant?.status === 'pending'
  const isPastDue = tenant?.status === 'past_due'
  const isTrialExpired = tenant?.status === 'trial_expired'
  const isSuspended = tenant?.status === 'suspended'
  const showStatusAlert = isPending || isPastDue || isTrialExpired || isSuspended

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {isDemo && demoStatus?.banner_message && (
        <div className="bg-primary-900 px-4 py-2 text-center text-sm font-medium text-white shadow-sm">
          {demoStatus.banner_message}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-72 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-6">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600">
              <Wifi size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-gray-900">FlowFi</p>
              <p className="truncate text-xs text-gray-500">{tenant?.name || 'Tenant workspace'}</p>
            </div>
          </div>
        </div>

        {showStatusAlert ? (
          <div className={`mx-2 mb-5 flex items-start gap-2 rounded-2xl p-3 text-xs ${
            isSuspended
              ? 'bg-red-50 text-red-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              {isPending
                ? 'Your account is pending review. Some features may stay limited until approval.'
                : isTrialExpired
                  ? <>Your trial has expired. <Link to="/tenant/billing" className="font-semibold underline">Go to Billing</Link> to restore service.</>
                  : isPastDue
                    ? <>Your portal is not accepting payments. <Link to="/tenant/billing" className="font-semibold underline">Go to Billing</Link> to restore service.</>
                    : <>Your workspace is suspended. <Link to="/tenant/billing" className="font-semibold underline">Pay your invoice</Link> to reactivate.</>}
            </span>
          </div>
        ) : null}

        <nav className="flex-1 space-y-6 overflow-y-auto pr-1">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 text-[11px] font-medium uppercase tracking-[0.24em] text-gray-400">
                {section.label}
              </p>
              <div className="mt-2 space-y-1">
                {section.links.map(({ to, label, icon: Icon, end, badgeKey }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={16} />
                    <span className="flex-1">{label}</span>
                    {badges[badgeKey] > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                        {badges[badgeKey]}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-600">
              {user?.name?.[0]?.toUpperCase() || 'T'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{user?.name}</p>
              <p className="truncate text-xs text-gray-400">{user?.email}</p>
            </div>
          </div>

          <Link to="/" className="btn-outline flex w-full items-center justify-center gap-2">
            <Store size={15} />
            Go to storefront
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {user?.email === 'demo@flowfi.app' ? (
          <div className="flex shrink-0 items-center justify-center gap-2 bg-primary-600 px-4 py-2 text-xs font-medium text-white">
            <span>🎮 You're viewing the FlowFi demo. Data resets when an admin triggers it.</span>
            <Link
              to="/register"
              className="ml-1 rounded-full bg-white/20 px-2.5 py-0.5 font-semibold text-white underline-offset-2 transition-colors hover:bg-white/30 hover:underline"
            >
              Create a free account →
            </Link>
          </div>
        ) : null}
        <header className="border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-gray-400">Tenant workspace</p>
              <p className="mt-1 text-sm text-gray-900">Run routers, packages, payments, loyalty, and customer support from one place.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-2xl bg-gray-50 px-3 py-2 text-right sm:block">
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-400">{tenant?.name || user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-ghost flex items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  </div>
  )
}
