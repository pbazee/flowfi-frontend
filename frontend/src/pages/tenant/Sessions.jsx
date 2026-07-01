import { useMemo, useState } from 'react'
import { useIsDemo } from '@/hooks/useIsDemo'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Clock3, Gift, Search, ShieldCheck, Wifi } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import {
  formatCurrency,
  formatDateTime,
  formatDurationMinutes,
  formatNumber,
} from '@/lib/formatters'

function getTrackingSummary(session) {
  const tracking = session.guest_tracking
  if (!tracking) return null

  return {
    purchased: tracking.time_purchased || 0,
    credited: tracking.time_credited || 0,
    remaining: tracking.time_remaining || 0,
  }
}

export default function Sessions() {
  const isDemo = useIsDemo()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [creditSearch, setCreditSearch] = useState('')
  const [selectedGuest, setSelectedGuest] = useState(null)
  const [fallbackVoucher, setFallbackVoucher] = useState(null)
  const [creditMinutes, setCreditMinutes] = useState('30')
  const [creditReason, setCreditReason] = useState('')
  const limit = 50

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-sessions', statusFilter, page],
    queryFn: () =>
      api
        .get('/tenant/sessions', {
          params: {
            status: statusFilter || undefined,
            page,
            limit,
          },
        })
        .then((response) => response.data),
  })

  const creditSearchQuery = useQuery({
    queryKey: ['tenant-session-credit-search', creditSearch],
    enabled: creditSearch.trim().length >= 2,
    queryFn: () =>
      api
        .get('/tenant/sessions/search', {
          params: {
            query: creditSearch,
            limit: 8,
          },
        })
        .then((response) => response.data),
  })

  const creditMutation = useMutation({
    mutationFn: ({ sessionId, payload }) =>
      api.post(`/tenant/sessions/${sessionId}/credit`, payload).then((response) => response.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-session-credit-search'] })
      setSelectedGuest({ ...result.session, guest_tracking: result.tracking })
      setFallbackVoucher(result.voucher || null)
      setCreditReason('')
      toast.success(result.warning || 'Guest time credited successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not credit this guest session')
    },
  })

  const sessions = data?.sessions || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const searchResults = creditSearchQuery.data?.sessions || []

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return sessions

    return sessions.filter((session) => {
      const haystack = [
        session.phone,
        session.username,
        session.password,
        session.packages?.name,
        session.note,
        session.mac_address,
        session.ip_address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [search, sessions])

  const activeCount = sessions.filter((session) => session.status === 'active').length
  const expiredCount = sessions.filter((session) => session.status === 'expired').length
  const terminatedCount = sessions.filter((session) => session.status === 'terminated').length
  const expiringSoon = sessions.filter((session) => {
    if (!session.expires_at || session.status !== 'active') return false
    const expiresIn = new Date(session.expires_at).getTime() - Date.now()
    return expiresIn > 0 && expiresIn <= 60 * 60 * 1000
  }).length

  function handleCreditSubmit(event) {
    event.preventDefault()

    if (!selectedGuest?.id) {
      toast.error('Choose a guest session first')
      return
    }

    creditMutation.mutate({
      sessionId: selectedGuest.id,
      payload: {
        minutes: Number(creditMinutes),
        reason: creditReason,
      },
    })
  }

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Operations"
        title="WiFi sessions"
        description="Track who is online, restore lost minutes for affected guests, and see how much time each session still has available."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total on page" value={formatNumber(sessions.length)} icon={Activity} />
        <StatTile label="Active" value={formatNumber(activeCount)} icon={Wifi} tone="green" />
        <StatTile label="Expiring soon" value={formatNumber(expiringSoon)} icon={Clock3} tone="amber" />
        <StatTile label="Ended" value={formatNumber(expiredCount + terminatedCount)} icon={ShieldCheck} tone="blue" />
      </div>

      <SectionCard
        title="Restore guest time"
        description="Search by phone number, MAC address, or session username, then credit minutes back to the guest when they lose access time."
      >
        <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <div className="space-y-4">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={creditSearch}
                onChange={(event) => setCreditSearch(event.target.value)}
                className="input pl-9"
                placeholder="Search phone, MAC, or username..."
              />
            </div>

            {creditSearch.trim().length < 2 ? (
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Type at least two characters to search recent guest sessions.
              </div>
            ) : creditSearchQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="No matching guests found"
                description="Try a different phone number, MAC address, or username."
              />
            ) : (
              <div className="space-y-3">
                {searchResults.map((session) => {
                  const tracking = getTrackingSummary(session)
                  const isSelected = selectedGuest?.id === session.id

                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => {
                        setSelectedGuest(session)
                        setFallbackVoucher(null)
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                        isSelected
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {session.phone || session.username || 'Guest session'}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {session.mac_address || 'No MAC captured'} • {session.packages?.name || 'Custom access'}
                          </p>
                        </div>
                        <StatusBadge status={session.status} />
                      </div>
                      {tracking ? (
                        <p className="mt-3 text-xs text-gray-600">
                          Remaining {formatDurationMinutes(tracking.remaining)} • Credited {formatDurationMinutes(tracking.credited)}
                        </p>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleCreditSubmit} className="rounded-3xl border border-gray-100 p-5">
            {!selectedGuest ? (
              <EmptyState
                icon={Gift}
                title="Choose a guest session"
                description="The selected guest will appear here with the current remaining time before you apply a credit."
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Selected guest</p>
                  <p className="mt-2 text-lg font-semibold text-gray-900">
                    {selectedGuest.phone || selectedGuest.username}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedGuest.mac_address || 'No MAC captured'} • {selectedGuest.packages?.name || 'Custom access'}
                  </p>
                  <p className="mt-3 text-sm text-gray-700">
                    Current expiry: {formatDateTime(selectedGuest.expires_at)}
                  </p>
                  {selectedGuest.guest_tracking ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Purchased</p>
                        <p className="mt-2 text-sm font-semibold text-gray-900">
                          {formatDurationMinutes(selectedGuest.guest_tracking.time_purchased)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Credited</p>
                        <p className="mt-2 text-sm font-semibold text-gray-900">
                          {formatDurationMinutes(selectedGuest.guest_tracking.time_credited)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Remaining</p>
                        <p className="mt-2 text-sm font-semibold text-gray-900">
                          {formatDurationMinutes(selectedGuest.guest_tracking.time_remaining)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Minutes to credit</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={creditMinutes}
                      onChange={(event) => setCreditMinutes(event.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Reason</label>
                    <input
                      value={creditReason}
                      onChange={(event) => setCreditReason(event.target.value)}
                      className="input"
                      placeholder="Power outage, ISP issue..."
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creditMutation.isPending}
                  className={`btn-primary flex w-full items-center justify-center gap-2 ${isDemo ? 'opacity-80' : ''}`}
                >
                  <Gift size={15} />
                  {creditMutation.isPending ? 'Applying credit...' : 'Credit this guest'}
                </button>

                {fallbackVoucher ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Fallback voucher ready</p>
                    <p className="mt-2">
                      Router sync could not complete, so FlowFi generated a complimentary voucher for{' '}
                      <strong>{formatDurationMinutes(fallbackVoucher.duration_minutes)}</strong>.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Voucher code</p>
                        <p className="mt-2 font-mono text-sm font-semibold text-gray-900">{fallbackVoucher.code}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Username</p>
                        <p className="mt-2 font-mono text-sm font-semibold text-gray-900">{fallbackVoucher.username}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Password</p>
                        <p className="mt-2 font-mono text-sm font-semibold text-gray-900">{fallbackVoucher.password}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Package</p>
                        <p className="mt-2 text-sm font-semibold text-gray-900">{fallbackVoucher.package_name}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </form>
        </div>
      </SectionCard>

      <SectionCard
        title="Session ledger"
        description="Filter by session status and search by customer phone, credentials, or package name."
      >
        <div className="mb-5 grid gap-3 lg:grid-cols-[1.2fr,0.7fr,auto]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input pl-9"
              placeholder="Search phone, username, package, note..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value)
              setPage(1)
            }}
            className="input"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="terminated">Terminated</option>
          </select>

          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
            {formatNumber(total)} total session records
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No sessions found"
            description="Try another search term or clear the current status filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-left">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  <th className="pb-3 pr-4 font-medium">Customer</th>
                  <th className="pb-3 pr-4 font-medium">Access</th>
                  <th className="pb-3 pr-4 font-medium">Package</th>
                  <th className="pb-3 pr-4 font-medium">Time ledger</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Expires</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSessions.map((session) => {
                  const tracking = session.guest_tracking

                  return (
                    <tr key={session.id} className="align-top">
                      <td className="py-4 pr-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {session.phone || 'No phone captured'}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {session.mac_address || session.ip_address || 'No device details'}
                        </p>
                      </td>
                      <td className="py-4 pr-4 text-sm text-gray-600">
                        <p className="font-medium text-gray-900">{session.username}</p>
                        <p className="mt-1 font-mono text-xs text-gray-400">{session.password}</p>
                      </td>
                      <td className="py-4 pr-4 text-sm text-gray-600">
                        <p className="font-medium text-gray-900">{session.packages?.name || 'Custom access'}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatDurationMinutes(session.packages?.duration_minutes)} at {formatCurrency(session.packages?.price)}
                        </p>
                        {session.note ? <p className="mt-2 text-xs text-gray-500">{session.note}</p> : null}
                      </td>
                      <td className="py-4 pr-4 text-sm text-gray-600">
                        {tracking ? (
                          <>
                            <p className="font-medium text-gray-900">
                              Remaining {formatDurationMinutes(tracking.time_remaining)}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              Purchased {formatDurationMinutes(tracking.time_purchased)}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              Credited {formatDurationMinutes(tracking.time_credited)}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Not tracked yet</span>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        <StatusBadge status={session.status} />
                      </td>
                      <td className="py-4 pr-4 text-sm text-gray-600">
                        {formatDateTime(session.expires_at)}
                      </td>
                      <td className="py-4 text-sm text-gray-500">
                        {formatDateTime(session.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="btn-outline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
