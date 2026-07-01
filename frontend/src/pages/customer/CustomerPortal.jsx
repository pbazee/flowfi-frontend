import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock3, Loader2, Search, Wifi } from 'lucide-react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatDateTime } from '@/lib/formatters'

export default function CustomerPortal() {
  const { tenantId } = useParams()
  const [identifier, setIdentifier] = useState('')
  const [submittedIdentifier, setSubmittedIdentifier] = useState('')

  const statusQuery = useQuery({
    queryKey: ['customer-session-status', tenantId, submittedIdentifier],
    enabled: Boolean(submittedIdentifier),
    queryFn: () =>
      api
        .get(`/portal/${tenantId}/session-status`, {
          params: submittedIdentifier.includes('ff_')
            ? { username: submittedIdentifier }
            : { phone: submittedIdentifier },
        })
        .then((response) => response.data),
  })

  function handleSubmit(event) {
    event.preventDefault()
    if (!identifier.trim()) {
      toast.error('Enter your phone number or session username')
      return
    }

    setSubmittedIdentifier(identifier.trim())
  }

  const status = statusQuery.data

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[32px] bg-white p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600">
              <Wifi size={22} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold font-display text-gray-900">My WiFi session</h1>
            <p className="mt-2 text-sm text-gray-500">
              Check whether your FlowFi session is still active using your phone number or session username.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            <div className="flex gap-3">
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="input flex-1"
                placeholder="0712345678 or ff_reference"
              />
              <button type="submit" className="btn-primary flex items-center gap-2">
                <Search size={16} />
                Check
              </button>
            </div>
          </form>

          <div className="mt-8">
            {statusQuery.isLoading ? (
              <div className="rounded-3xl bg-gray-50 p-6 text-center text-gray-500">
                <Loader2 size={18} className="mx-auto animate-spin text-primary-600" />
                <p className="mt-3 text-sm">Checking your session status...</p>
              </div>
            ) : statusQuery.isError ? (
              <div className="rounded-3xl bg-red-50 p-6 text-center text-sm text-red-700">
                We couldn&apos;t load your session right now. Please try again.
              </div>
            ) : statusQuery.data ? (
              status.active ? (
                <div className="rounded-3xl border border-green-100 bg-green-50 p-6">
                  <div className="flex items-center gap-3 text-green-700">
                    <Clock3 size={18} />
                    <p className="font-semibold">Session active</p>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Package</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{status.package || 'Current package'}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Time left</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{status.remaining_minutes} min</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Expires</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(status.expires_at)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl bg-gray-50 p-6 text-center">
                  <p className="text-lg font-semibold text-gray-900">No active session found</p>
                  <p className="mt-2 text-sm text-gray-500">
                    If your time has expired, return to the captive portal to buy another package or redeem your points reward.
                  </p>
                </div>
              )
            ) : (
              <div className="rounded-3xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                Enter your details above to check your current session.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
