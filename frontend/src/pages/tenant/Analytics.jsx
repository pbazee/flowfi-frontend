import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, DollarSign, Package, Wallet } from 'lucide-react'
import api from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import { formatCurrency, formatNumber } from '@/lib/formatters'

const dayOptions = [7, 30, 90]

export default function Analytics() {
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-analytics-page', days],
    queryFn: () => api.get('/tenant/analytics', { params: { days } }).then((response) => response.data),
  })

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Workspace Intelligence"
        title="Tenant analytics"
        description="Follow revenue, session volume, and package demand across your selected time window."
        actions={
          <div className="flex flex-wrap gap-2">
            {dayOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  days === option ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Last {option} days
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue" value={formatCurrency(data?.totalRevenue)} icon={DollarSign} />
        <StatTile label="Sessions" value={formatNumber(data?.totalSessions)} icon={Activity} tone="green" />
        <StatTile label="Packages sold" value={formatNumber(data?.byPackage?.reduce((sum, item) => sum + Number(item.count || 0), 0))} icon={Package} tone="amber" />
        <StatTile label="Average revenue/day" value={formatCurrency(data?.dailyRevenue?.length ? Number(data.totalRevenue || 0) / data.dailyRevenue.length : 0)} icon={Wallet} tone="blue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <SectionCard
          title="Revenue trend"
          description={`Successful transaction revenue over the last ${days} days.`}
        >
          {isLoading ? (
            <div className="h-[320px] animate-pulse rounded-2xl bg-gray-100" />
          ) : !data?.dailyRevenue?.length ? (
            <EmptyState
              icon={DollarSign}
              title="No revenue data yet"
              description="This chart will populate as successful payments are recorded."
            />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={data.dailyRevenue}>
                <defs>
                  <linearGradient id="tenantAnalyticsRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F6E56" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0F6E56" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ borderRadius: 16, border: '1px solid #e5e7eb', fontSize: 13 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0F6E56"
                  strokeWidth={2}
                  fill="url(#tenantAnalyticsRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard
          title="Package demand"
          description="Which packages are creating the most sessions."
        >
          {isLoading ? (
            <div className="h-[320px] animate-pulse rounded-2xl bg-gray-100" />
          ) : !data?.byPackage?.length ? (
            <EmptyState
              icon={Package}
              title="No package activity yet"
              description="Package usage will appear here once customers begin purchasing sessions."
            />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.byPackage}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) => [formatNumber(value), 'Sessions']}
                  contentStyle={{ borderRadius: 16, border: '1px solid #e5e7eb', fontSize: 13 }}
                />
                <Bar dataKey="count" radius={[10, 10, 0, 0]} fill="#1D9E75" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
