import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  DollarSign,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  Quote,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Users,
  Wifi,
  Wrench,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useSidebarBadges } from '@/hooks/useSidebarBadges'

const navSections = [
  {
    label: 'Platform',
    links: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/tenants', label: 'Tenants', icon: Users, badgeKey: 'new_tenants' },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/admin/messages', label: 'Messages', icon: Mail, badgeKey: 'new_messages' },
      { to: '/admin/communications', label: 'Communications', icon: Mail },
      { to: '/admin/demo', label: 'Demo', icon: Gamepad2 },
      { to: '/admin/settings', label: 'Core Settings', icon: Settings },
    ],
  },
  {
    label: 'Public Site',
    links: [
      { to: '/admin/services', label: 'Services', icon: Wrench },
      { to: '/admin/plans', label: 'Plans', icon: Package },
      { to: '/admin/shipping', label: 'Shipping', icon: Truck },
      { to: '/admin/blog', label: 'Blog', icon: BookOpen },
      { to: '/admin/reviews', label: 'Reviews', icon: Quote },
      { to: '/admin/about', label: 'About Us', icon: Users },
      { to: '/admin/legal', label: 'Legal Pages', icon: BookOpen },
    ],
  },
  {
    label: 'Store',
    links: [
      { to: '/admin/shop/products', label: 'Shop Products', icon: Package },
      { to: '/admin/shop/orders', label: 'Shop Orders', icon: ShoppingBag, badgeKey: 'pending_orders' },
    ],
  },
]

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const badges = useSidebarBadges(true)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="flex w-72 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-6">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600">
            <Wifi size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-gray-900">FlowFi</p>
            <p className="text-xs uppercase tracking-[0.24em] text-primary-600">Platform</p>
          </div>
        </div>

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
              {user?.name?.[0]?.toUpperCase() || 'A'}
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
        <header className="border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-gray-400">Platform control room</p>
              <p className="mt-1 text-sm text-gray-900">Manage tenants, public content, and storefront operations.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-2xl bg-gray-50 px-3 py-2 text-right sm:block">
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
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
  )
}
