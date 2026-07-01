import { useEffect, useMemo, useState } from 'react'
import { useIsDemo } from '@/hooks/useIsDemo'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Gift,
  History,
  Loader2,
  RefreshCcw,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatusBadge from '@/components/ui/StatusBadge'
import api from '@/lib/api'
import { formatDateTime, formatDurationMinutes } from '@/lib/formatters'

function getSessionSummary(session) {
  const tracking = session?.guest_tracking || {}
  const purchased = Number(tracking.time_purchased || session?.packages?.duration_minutes || 0)
  const used = Number(
    tracking.time_used !== undefined && tracking.time_used !== null
      ? tracking.time_used
      : Math.max(purchased - Number(tracking.time_remaining || 0), 0)
  )
  const credited = Number(tracking.time_credited || 0)
  const remaining = Number(tracking.time_remaining || 0)
  const recoverable = Math.max(remaining, purchased + credited - used, 0)

  return {
    purchased,
    used,
    credited,
    remaining,
    recoverable,
  }
}

export default function SessionCreditsPage() {
  const isDemo = useIsDemo()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [selectedGuest, setSelectedGuest] = useState(null)
  const [creditMinutes, setCreditMinutes] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [creditError, setCreditError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  const searchQuery = useQuery({
    queryKey: ['tenant-session-credit-search-page', searchInput],
    enabled: searchInput.trim().length >= 2,
    queryFn: () =>
      api
        .get('/tenant/session-credits/search', {
          params: {
            query: searchInput,
            limit: 8,
          },
        })
        .then((response) => response.data),
  })

  const historyQuery = useQuery({
    queryKey: ['tenant-session-credit-history'],
    queryFn: () => api.get('/tenant/session-credits/history').then((response) => response.data),
  })

  const grantMutation = useMutation({
    mutationFn: ({ sessionId, payload }) =>
      api.post(`/tenant/sessions/${sessionId}/credit`, payload).then((response) => response.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-session-credit-search-page'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-session-credit-history'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-sessions'] })
      setSelectedGuest({ ...result.session, guest_tracking: result.tracking })
      setSuccessMessage(result.message)
      setCreditError(null)
      setCreditReason('')
      toast.success(result.message)
    },
    onError: (error) => {
      const payload = error.response?.data || {}
      setSuccessMessage('')
      setCreditError({
        message: payload.error || 'Could not credit this guest session.',
        creditLogId: payload.creditLogId || null,
      })
      toast.error(payload.error || 'Could not credit this guest session.')
    },
  })

  const retryMutation = useMutation({
    mutationFn: (creditLogId) =>
      api.post(`/tenant/session-credits/${creditLogId}/retry`).then((response) => response.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-session-credit-history'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-session-credit-search-page'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-sessions'] })
      setSelectedGuest({ ...result.session, guest_tracking: result.tracking })
      setSuccessMessage(result.message)
      setCreditError(null)
      toast.success(result.message)
    },
    onError: (error) => {
      const payload = error.response?.data || {}
      setSuccessMessage('')
      setCreditError({
        message: payload.error || 'Could not retry the MikroTik sync.',
        creditLogId: payload.creditLogId || null,
      })
      toast.error(payload.error || 'Could not retry the MikroTik sync.')
    },
  })

  const searchResults = searchQuery.data?.sessions || []
  const creditHistory = historyQuery.data?.history || []
  const selectedSummary = useMemo(() => getSessionSummary(selectedGuest), [selectedGuest])

  useEffect(() => {
    if (!selectedGuest) return

    const suggestedMinutes = selectedSummary.recoverable > 0 ? String(selectedSummary.recoverable) : ''
    setCreditMinutes(suggestedMinutes)
    setCreditReason(
      selectedSummary.recoverable > 0
        ? `Power outage - ${selectedSummary.recoverable} minutes lost`
        : ''
    )
  }, [selectedGuest, selectedSummary.recoverable])

  function chooseGuest(session) {
    setSelectedGuest(session)
    setCreditError(null)
    setSuccessMessage('')
  }

  function handleGrantSubmit(event) {
    event.preventDefault()

    if (!selectedGuest?.id) {
      toast.error('Choose a guest session first')
      return
    }

    if (!Number.isFinite(Number(creditMinutes)) || Number(creditMinutes) <= 0) {
      toast.error('Enter a valid number of minutes to credit')
      return
    }

    if (!creditReason.trim()) {
      toast.error('Reason is required')
      return
    }

    grantMutation.mutate({
      sessionId: selectedGuest.id,
      payload: {
        minutes: Number(creditMinutes),
        reason: creditReason.trim(),
      },
    })
  }

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Guests"
        title="Session credits"
        description="Compensate guests who lost time because of outages or operational issues, then retry MikroTik syncs from the same workspace."
      />

      <SectionCard
        title="Grant time"
        description="Search by phone number or MAC address, review the latest guest session, and grant minutes back when a session is interrupted."
      >
        <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="input pl-9"
                placeholder="Search phone or MAC address..."
              />
            </div>

            {searchInput.trim().length < 2 ? (
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Type at least two characters to search recent guest sessions.
              </div>
            ) : searchQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-2xl bg-gray-100" />
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="No matching guest found"
                description="Try a different phone number or MAC address."
              />
            ) : (
              <div className="space-y-3">
                {searchResults.map((session) => {
                  const summary = getSessionSummary(session)
                  const isSelected = selectedGuest?.id === session.id

                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => chooseGuest(session)}
                      className={`w-full rounded-3xl border p-4 text-left transition-colors ${
                        isSelected
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {session.phone || session.mac_address || session.username || 'Guest session'}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {session.packages?.name || 'Custom access'} - {session.mac_address || 'No MAC recorded'}
                          </p>
                        </div>
                        <StatusBadge status={session.status} />
                      </div>
                      <p className="mt-3 text-xs text-gray-600">
                        Remaining or lost {formatDurationMinutes(summary.recoverable)} - Started {formatDateTime(session.created_at)}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleGrantSubmit} className="rounded-3xl border border-gray-100 p-5">
            {!selectedGuest ? (
              <EmptyState
                icon={Gift}
                title="Choose a guest session"
                description="The latest active or recently expired guest session will appear here with the credit form."
              />
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl bg-gray-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Selected guest</p>
                      <p className="mt-2 text-xl font-semibold text-gray-900">
                        {selectedGuest.phone || selectedGuest.mac_address || selectedGuest.username}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {selectedGuest.packages?.name || 'Custom access'} - {selectedGuest.mac_address || 'No MAC recorded'}
                      </p>
                    </div>
                    <StatusBadge status={selectedGuest.status} />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Time purchased</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{formatDurationMinutes(selectedSummary.purchased)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Time used</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{formatDurationMinutes(selectedSummary.used)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Time remaining or lost</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{formatDurationMinutes(selectedSummary.recoverable)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Session start</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(selectedGuest.created_at)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Session end</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(selectedGuest.expires_at)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Previous credits</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{formatDurationMinutes(selectedSummary.credited)}</p>
                    </div>
                  </div>
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
                      placeholder="40"
                    />
                  </div>
                  <div>
                    <label className="label">Reason</label>
                    <input
                      value={creditReason}
                      onChange={(event) => setCreditReason(event.target.value)}
                      className="input"
                      placeholder="Power outage - 40 minutes lost"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={grantMutation.isPending}
                  className={`btn-primary flex w-full items-center justify-center gap-2 ${isDemo ? 'opacity-80' : ''}`}
                >
                  {grantMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
                  Grant Time Credit
                </button>

                {successMessage ? (
                  <div className="rounded-3xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                      <p>{successMessage}</p>
                    </div>
                  </div>
                ) : null}

                {creditError ? (
                  <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={18} className="mt-0.5 shrink-0" />
                      <div className="space-y-3">
                        <p>{creditError.message}</p>
                        {creditError.creditLogId ? (
                          <button
                            type="button"
                            onClick={() => retryMutation.mutate(creditError.creditLogId)}
                            disabled={retryMutation.isPending}
                            className="btn-outline flex items-center gap-2 border-red-200 bg-white text-red-700 hover:bg-red-100"
                          >
                            {retryMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
                            Retry
                          </button>
                        ) : null}
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
        title="Credit history"
        description="See every session credit issued by this tenant and whether MikroTik sync completed successfully."
      >
        {historyQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : creditHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title="No credits issued yet"
            description="When you grant time credits, the full MikroTik sync history will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-[0.18em] text-gray-400">
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Guest</th>
                  <th className="px-3 py-3 font-medium">Minutes</th>
                  <th className="px-3 py-3 font-medium">Reason</th>
                  <th className="px-3 py-3 font-medium">MikroTik</th>
                  <th className="px-3 py-3 font-medium">Granted by</th>
                </tr>
              </thead>
              <tbody>
                {creditHistory.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 text-gray-700">
                    <td className="px-3 py-4 whitespace-nowrap">{formatDateTime(entry.created_at)}</td>
                    <td className="px-3 py-4">
                      <div className="font-medium text-gray-900">{entry.phone || entry.mac_address || 'Guest session'}</div>
                      <div className="mt-1 text-xs text-gray-400">{entry.mac_address || 'No MAC recorded'}</div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">{entry.minutes_credited} min</td>
                    <td className="px-3 py-4">{entry.reason}</td>
                    <td className="px-3 py-4">
                      <StatusBadge status={entry.mikrotik_success ? 'success' : 'failed'}>
                        {entry.mikrotik_success ? 'Success' : 'Failed'}
                      </StatusBadge>
                      {!entry.mikrotik_success && entry.mikrotik_error ? (
                        <p className="mt-2 max-w-xs text-xs text-red-600">{entry.mikrotik_error}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">{entry.users?.name || entry.users?.email || 'Tenant user'}</td>
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
