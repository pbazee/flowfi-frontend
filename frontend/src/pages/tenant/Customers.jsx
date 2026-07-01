import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Search, ShieldCheck, Smartphone, Users } from 'lucide-react'
import api from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/formatters'

function customerTier(customer) {
  if (customer.totalSpent >= 5000 || customer.sessions >= 8) return 'VIP'
  if (customer.totalSpent >= 2000 || customer.sessions >= 4) return 'Repeat'
  return 'New'
}

export default function Customers() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('spend')

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['tenant-customers'],
    queryFn: () => api.get('/tenant/customers').then((response) => response.data),
  })

  const visibleCustomers = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = !term
      ? customers
      : customers.filter((customer) => customer.phone?.toLowerCase().includes(term))

    return [...filtered].sort((a, b) => {
      if (sortBy === 'sessions') return Number(b.sessions || 0) - Number(a.sessions || 0)
      if (sortBy === 'lastSeen') return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
      return Number(b.totalSpent || 0) - Number(a.totalSpent || 0)
    })
  }, [customers, search, sortBy])

  const totalSpend = customers.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0)
  const returningCustomers = customers.filter((customer) => Number(customer.sessions || 0) >= 2).length
  const vipCustomers = customers.filter((customer) => customerTier(customer) === 'VIP').length
  const averageSpend = customers.length ? Math.round(totalSpend / customers.length) : 0

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Audience"
        title="Customers"
        description="See who comes back most often, who spends the most, and which customer segments are worth nurturing."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Customers" value={formatNumber(customers.length)} icon={Users} />
        <StatTile label="Returning" value={formatNumber(returningCustomers)} icon={ShieldCheck} tone="green" />
        <StatTile label="VIP tier" value={formatNumber(vipCustomers)} icon={BarChart3} tone="amber" />
        <StatTile label="Avg. spend" value={formatCurrency(averageSpend)} icon={Smartphone} tone="blue" />
      </div>

      <SectionCard
        title="Customer directory"
        description="Search by phone number and sort by spend, session count, or recency."
      >
        <div className="mb-5 grid gap-3 lg:grid-cols-[1.2fr,0.7fr,auto]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input pl-9"
              placeholder="Search phone number..."
            />
          </div>

          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="input">
            <option value="spend">Sort by spend</option>
            <option value="sessions">Sort by sessions</option>
            <option value="lastSeen">Sort by last seen</option>
          </select>

          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
            {formatCurrency(totalSpend)} total observed spend
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : visibleCustomers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers found"
            description="Customer profiles will appear here once sessions start capturing phone numbers."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-left">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  <th className="pb-3 pr-4 font-medium">Phone</th>
                  <th className="pb-3 pr-4 font-medium">Tier</th>
                  <th className="pb-3 pr-4 font-medium">Sessions</th>
                  <th className="pb-3 pr-4 font-medium">Spend</th>
                  <th className="pb-3 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleCustomers.map((customer) => (
                  <tr key={customer.phone} className="align-top">
                    <td className="py-4 pr-4">
                      <p className="text-sm font-semibold text-gray-900">{customer.phone}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge tone={customerTier(customer) === 'VIP' ? 'success' : customerTier(customer) === 'Repeat' ? 'info' : 'warning'}>
                        {customerTier(customer)}
                      </StatusBadge>
                    </td>
                    <td className="py-4 pr-4 text-sm font-medium text-gray-900">
                      {formatNumber(customer.sessions)}
                    </td>
                    <td className="py-4 pr-4 text-sm font-medium text-gray-900">
                      {formatCurrency(customer.totalSpent)}
                    </td>
                    <td className="py-4 text-sm text-gray-500">
                      {formatDateTime(customer.lastSeen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
