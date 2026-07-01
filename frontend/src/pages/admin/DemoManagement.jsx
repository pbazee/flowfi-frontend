import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gamepad2,
  Loader2,
  RefreshCw,
  User,
  Eye,
  X,
  Save,
} from 'lucide-react'
import api from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'

function formatDateLong(iso) {
  if (!iso) return 'Never'
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function ConfirmModal({ onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle size={22} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Reset demo data?</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          This will <strong>delete all current demo tenant data</strong> — customers, packages,
          routers, and transactions — and re-seed fresh records. The demo user password will also be
          reset. This cannot be undone.
        </p>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-outline flex flex-1 items-center justify-center gap-2"
          >
            <X size={15} />
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {loading ? 'Resetting…' : 'Yes, reset demo'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DemoManagement() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [result, setResult] = useState(null) // { success, message }
  
  const [settingsForm, setSettingsForm] = useState({
    is_enabled: true,
    banner_message: "You're viewing the FlowFi demo—feel free to explore the platform."
  })

  const { data: demoInfo, isLoading: infoLoading } = useQuery({
    queryKey: ['admin-demo'],
    queryFn: async () => {
      const { data } = await api.get('/admin/demo')
      return data
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => api.post('/admin/demo/reset'),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-demo'] })
      setShowModal(false)
      setResult({ success: true, message: data.message || 'Demo data reset successfully.' })
      setTimeout(() => setResult(null), 6000)
    },
    onError: (err) => {
      setShowModal(false)
      setResult({
        success: false,
        message: err.response?.data?.error || 'Reset failed. Check the backend logs.',
      })
      setTimeout(() => setResult(null), 8000)
    },
  })

  const settingsMutation = useMutation({
    mutationFn: (payload) => api.put('/admin/demo/settings', payload).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-demo'] })
      setResult({ success: true, message: 'Demo settings saved.' })
      setTimeout(() => setResult(null), 6000)
    },
    onError: (err) => {
      setResult({
        success: false,
        message: err.response?.data?.error || 'Failed to save settings.',
      })
      setTimeout(() => setResult(null), 8000)
    },
  })

  useEffect(() => {
    if (demoInfo) {
      setSettingsForm({
        is_enabled: demoInfo.is_enabled ?? true,
        banner_message: demoInfo.banner_message || "You're viewing the FlowFi demo—feel free to explore the platform."
      })
    }
  }, [demoInfo])

  function handleSaveSettings(e) {
    e.preventDefault()
    settingsMutation.mutate(settingsForm)
  }

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Platform Controls"
        title="Demo Management"
        description="Manage the live demo environment visible at /demo. Resetting wipes all demo tenant data and re-seeds fresh records — the login credentials stay the same."
      />

      {result ? (
        <div
          className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
            result.success
              ? 'border-green-100 bg-green-50 text-green-800'
              : 'border-red-100 bg-red-50 text-red-800'
          }`}
        >
          {result.success ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <span>{result.message}</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Demo info card */}
        <SectionCard
          title="Demo account"
          description="These are the public credentials for the live demo workspace. Anyone can use these to explore the tenant dashboard."
        >
          {infoLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4">
                <User size={16} className="mt-0.5 shrink-0 text-primary-600" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Demo email</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-gray-900">
                    {demoInfo?.email || 'demo@flowfi.app'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4">
                <Gamepad2 size={16} className="mt-0.5 shrink-0 text-primary-600" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Demo password</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-gray-900">flowfi_demo_2024</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4">
                <Clock size={16} className="mt-0.5 shrink-0 text-primary-600" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Last reset</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatDateLong(demoInfo?.last_reset_at)}
                  </p>
                  {demoInfo?.reset_by ? (
                    <p className="mt-0.5 text-xs text-gray-500">By: {demoInfo.reset_by}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4">
                <Eye size={16} className="mt-0.5 shrink-0 text-primary-600" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Total Views</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {demoInfo?.views_count || 0} views
                  </p>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Reset card */}
        <SectionCard
          title="Reset demo data"
          description="Use this when the demo workspace has been polluted with test data, or to roll the dataset back to a clean state before a demo call."
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-gray-600">
              Clicking reset will:
            </p>
            <ul className="space-y-2">
              {[
                'Delete all packages, routers, customers, and transactions for the demo tenant',
                'Re-seed the same representative dataset (10 customers, 4 packages, 3 routers, 20 transactions)',
                'Rehash the demo password in the users table so login always works',
                'Record the reset timestamp and your email in demo_meta',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary-600" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={resetMutation.isPending}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
            >
              <RefreshCw size={15} />
              Reset Demo Data
            </button>
          </div>
        </SectionCard>

        {/* Demo Settings */}
        <SectionCard
          title="Demo Access & Banner"
          description="Control public access to the demo workspace and customize the banner shown to demo users."
          className="xl:col-span-2"
        >
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={settingsForm.is_enabled}
                onChange={(e) => setSettingsForm({ ...settingsForm, is_enabled: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
              />
              <div>
                <span className="block text-sm font-medium text-gray-900">Enable live demo</span>
                <span className="block text-sm text-gray-500">
                  When disabled, the demo login will reject users and the CTA will be hidden from the landing page.
                </span>
              </div>
            </label>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Banner message</label>
              <input
                type="text"
                value={settingsForm.banner_message}
                onChange={(e) => setSettingsForm({ ...settingsForm, banner_message: e.target.value })}
                className="input"
                placeholder="Message shown at the top of the demo portal..."
                disabled={!settingsForm.is_enabled}
              />
            </div>

            <button
              type="submit"
              disabled={settingsMutation.isPending}
              className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Save size={15} />
              {settingsMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </SectionCard>
      </div>

      {showModal ? (
        <ConfirmModal
          onConfirm={() => resetMutation.mutate()}
          onCancel={() => setShowModal(false)}
          loading={resetMutation.isPending}
        />
      ) : null}
    </div>
  )
}
