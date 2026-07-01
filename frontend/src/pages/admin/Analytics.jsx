import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, DollarSign, Layers3, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import { formatCurrency } from '@/lib/formatters'

const dayOptions = [7, 30, 90]
const chartColors = ['#0F6E56', '#1D9E75', '#5DCAA5', '#9FE1CB']

export default function Analytics() {
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-page', days],
    queryFn: () =>
      api
        .get('/admin/analytics', { params: { days } })
        .then((response) => response.data),
  })

  const sourceBreakdown = useMemo(() => data?.sourceBreakdown || [], [data?.sourceBreakdown])

  const topTenants = data?.byTenant || []
  const averageDailyRevenue = data?.dailyRevenue?.length
    ? Math.round(Number(data.totalRevenue || 0) / data.dailyRevenue.length)
    : 0
  const breakdownByKey = Object.fromEntries(sourceBreakdown.map((entry) => [entry.key, Number(entry.value || 0)]))

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Platform Intelligence"
        title="Analytics"
        description="A longer-range view of combined platform revenue, source splits, and tenant-linked contribution trends."
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
        <StatTile label="Subscriptions" value={formatCurrency(breakdownByKey.subscriptions)} icon={TrendingUp} tone="green" />
        <StatTile label="Shop sales" value={formatCurrency(breakdownByKey.shop)} icon={Layers3} tone="amber" />
        <StatTile label="Services" value={formatCurrency(breakdownByKey.services)} icon={BarChart3} tone="blue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <SectionCard
          title="Revenue timeline"
          description={`Combined revenue across subscriptions, shop sales, and services over the last ${days} days.`}
        >
          {isLoading ? (
            <div className="h-[320px] animate-pulse rounded-2xl bg-gray-100" />
          ) : !data?.dailyRevenue?.length ? (
            <EmptyState
              icon={DollarSign}
              title="No revenue yet"
              description="Once subscription, shop, or service payments are recorded, the daily trend chart will populate automatically."
            />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={data.dailyRevenue}>
                <defs>
                  <linearGradient id="analyticsRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F6E56" stopOpacity={0.16} />
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
                  fill="url(#analyticsRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard
          title="Revenue source mix"
          description="Revenue split by source for the selected time window."
        >
          {sourceBreakdown.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No source mix yet"
              description="When subscription, shop, or service revenue is recorded, the split will appear here."
            />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={sourceBreakdown}
                    dataKey="value"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={4}
                  >
                    {sourceBreakdown.map((entry, index) => (
                      <Cell key={entry.key || entry.label} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {sourceBreakdown.map((entry, index) => (
                  <div key={entry.key || entry.label} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    />
                    <p className="flex-1 text-sm font-medium text-gray-900">{entry.label}</p>
                    <p className="text-sm text-gray-500">{formatCurrency(entry.value)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-primary-50 px-4 py-3 text-sm text-primary-900">
                Average daily revenue: {formatCurrency(averageDailyRevenue)}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <SectionCard
          title="Revenue breakdown"
          description="See exactly how much each platform revenue source contributed in this period."
        >
          {sourceBreakdown.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No revenue source data"
              description="Once platform revenue arrives, each source total will be summarized here."
            />
          ) : (
            <div className="space-y-4">
              {sourceBreakdown.map((entry, index) => {
                const share = data?.totalRevenue
                  ? ((Number(entry.value || 0) / Number(data.totalRevenue)) * 100).toFixed(1)
                  : '0.0'

                return (
                  <div key={`${entry.key || entry.label}-${index}`} className="rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Source #{index + 1}</p>
                        <p className="mt-2 text-sm font-semibold text-gray-900">{entry.label}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(entry.value)}</p>
                        <p className="mt-1 text-xs text-gray-400">{share}% of platform revenue</p>
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Revenue by tenant"
          description="Quick visual comparison of the strongest tenant-linked contributors."
        >
          {topTenants.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No chart data available"
              description="As tenant-linked revenue records come in, the comparison chart will light up."
            />
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={topTenants.slice(0, 6)}>
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
                  tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ borderRadius: 16, border: '1px solid #e5e7eb', fontSize: 13 }}
                />
                <Bar dataKey="revenue" radius={[10, 10, 0, 0]} fill="#1D9E75" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
