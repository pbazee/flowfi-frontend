import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  Eye,
  Network,
  Plus,
  RefreshCcw,
  Router,
  Search,
  Server,
  Settings,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import { usePlatformContent } from '@/hooks/usePlatformContent'
import api from '@/lib/api'
import { formatDateTime } from '@/lib/formatters'
import { useIsDemo } from '@/hooks/useIsDemo'
import { useAuthStore } from '@/store/auth'
import { getPlanRouterLabel, getPlanRouterLimit } from '@/lib/workspacePlans'

const initialForm = {
  name: '',
  ip_address: '',
  port: '8728',
  api_username: '',
  api_password: '',
  location: '',
  dns_name: '',
}

export default function Routers() {
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()
  const { tenant } = useAuthStore()
  const { data: content } = usePlatformContent()
  const [form, setForm] = useState(initialForm)
  const [search, setSearch] = useState('')
  const [selectedRouter, setSelectedRouter] = useState(null)

  const { data: routers = [], isLoading } = useQuery({
    queryKey: ['tenant-routers'],
    queryFn: () => api.get('/routers').then((response) => response.data),
  })

  const { data: routerSessions = [], isFetching: sessionsLoading } = useQuery({
    queryKey: ['tenant-router-sessions', selectedRouter?.id],
    enabled: Boolean(selectedRouter?.id),
    queryFn: () => api.get(`/routers/${selectedRouter.id}/sessions`).then((response) => response.data),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/routers', payload).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-routers'] })
      setForm(initialForm)
      toast.success('Router added successfully')
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not add router'),
  })

  const testMutation = useMutation({
    mutationFn: (routerId) => api.post(`/routers/${routerId}/test`).then((response) => response.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-routers'] })
      if (result.success) {
        toast.success(`Connection successful${result.identity ? `: ${result.identity}` : ''}`)
      } else {
        toast.error(result.error || 'Router test failed')
      }
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Router test failed'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }) => api.put(`/routers/${id}`, payload).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-routers'] })
      setForm(initialForm)
      setSelectedRouter(null)
      toast.success('Router updated successfully')
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not update router'),
  })

  const deleteMutation = useMutation({
    mutationFn: (routerId) => api.delete(`/routers/${routerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-routers'] })
      setSelectedRouter(null)
      toast.success('Router removed')
    },
    onError: () => toast.error('Could not remove router'),
  })

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isDemo) return toast('This is a live demo — sign up to save changes', { icon: '🔒' })
    
    // DNS Name validation (optional but follows domain pattern if set)
    if (form.dns_name && !/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(form.dns_name)) {
      toast.error('Invalid Hotspot DNS format. Use e.g. login.venue.com')
      return
    }

    if (form.id) {
      updateMutation.mutate({
        ...form,
        port: Number(form.port || 8728),
      })
    } else {
      createMutation.mutate({
        ...form,
        port: Number(form.port || 8728),
      })
    }
  }

  function handleEdit(routerItem) {
    setForm({
      id: routerItem.id,
      name: routerItem.name,
      ip_address: routerItem.ip_address,
      port: String(routerItem.port),
      api_username: routerItem.api_username || '',
      api_password: '', // Keep password empty unless changing
      location: routerItem.location || '',
      dns_name: routerItem.dns_name || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleDelete(routerItem) {
    if (isDemo) return toast('This is a live demo — sign up to save changes', { icon: '🔒' })
    if (!window.confirm(`Remove ${routerItem.name}? This cannot be undone.`)) return
    deleteMutation.mutate(routerItem.id)
  }

  const filteredRouters = routers.filter((routerItem) =>
    [routerItem.name, routerItem.ip_address, routerItem.location]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search.toLowerCase()))
  )

  const onlineRouters = routers.filter((routerItem) => routerItem.status === 'online').length
  const offlineRouters = routers.filter((routerItem) => routerItem.status === 'offline').length
  const workspacePlan = (content?.workspacePlans || []).find(
    (plan) => plan.id === tenant?.workspace_plan_id || plan.name === tenant?.workspace_plan_name
  )
  const routerLimit = getPlanRouterLimit(workspacePlan)

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Tenant Ops"
        title="Routers"
        description="Connect MikroTik devices, test their health, and inspect active hotspot sessions in one place."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatTile label="Total routers" value={routers.length} icon={Router} />
        <StatTile label="Online" value={onlineRouters} sub={`${offlineRouters} offline`} icon={Activity} tone="green" />
        <StatTile
          label="Plan allowance"
          value={workspacePlan ? getPlanRouterLabel(workspacePlan) : 'No plan limit'}
          sub={
            Number.isFinite(routerLimit)
              ? `${routers.length} of ${routerLimit} router slots used`
              : selectedRouter
                ? `Watching ${selectedRouter.name}`
                : 'Select a router to inspect'
          }
          icon={Eye}
          tone="blue"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.35fr]">
        <SectionCard
          title={form.id ? 'Update router' : 'Add a router'}
          description={form.id ? 'Modify connection settings or the hotspot DNS name.' : 'FlowFi tests the MikroTik API connection before saving the router to your tenant.'}
          action={form.id && (
            <button onClick={() => setForm(initialForm)} className="btn-ghost text-xs">Cancel edit</button>
          )}
        >
          {workspacePlan && Number.isFinite(routerLimit) ? (
            <div className="mb-5 rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900">
              Your {workspacePlan.name} plan supports {getPlanRouterLabel(workspacePlan).toLowerCase()}.
              {routers.length >= routerLimit ? (
                <span className="block mt-1 font-semibold">Router limit reached. Upgrade your plan to connect more devices.</span>
              ) : (
                 ' Upgrade your workspace if you need more devices.'
              )}
            </div>
          ) : null}

          {workspacePlan && Number.isFinite(routerLimit) && routers.length >= routerLimit ? (
             <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                <Network size={40} className="text-gray-300 mb-3" />
                <p className="text-gray-600 mb-6">You have reached the maximum number of routers allowed for your current plan.</p>
                <Link to="/tenant/billing" className="btn-primary w-full">
                  Upgrade Workspace
                </Link>
             </div>
          ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="label">Router name</label>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="input"
                placeholder="Main lobby hotspot"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">IP address</label>
                <input
                  value={form.ip_address}
                  onChange={(event) => updateField('ip_address', event.target.value)}
                  className="input"
                  placeholder="192.168.88.1"
                  required
                />
              </div>
              <div>
                <label className="label">API port</label>
                <input
                  value={form.port}
                  onChange={(event) => updateField('port', event.target.value)}
                  className="input"
                  placeholder="8728"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">API username</label>
                <input
                  value={form.api_username}
                  onChange={(event) => updateField('api_username', event.target.value)}
                  className="input"
                  placeholder="api-user"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label className="label">API password</label>
                <input
                  type="password"
                  value={form.api_password}
                  onChange={(event) => updateField('api_password', event.target.value)}
                  className="input"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Location</label>
              <input
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
                className="input"
                placeholder="West wing, third floor"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label">Hotspot DNS Name</label>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">MikroTik Local DNS</span>
              </div>
              <input
                value={form.dns_name}
                onChange={(event) => updateField('dns_name', event.target.value)}
                className="input"
                placeholder="e.g. login.flowfi.com"
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                The local DNS name configured in your router&apos;s Hotspot Server Profile. This ensures the sign-in popup appears correctly on mobile devices.
              </p>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className={`btn-primary flex items-center justify-center gap-2 ${isDemo ? 'opacity-80' : ''}`}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                'Saving...'
              ) : form.id ? (
                <>
                  <Server size={15} />
                  Update Router
                </>
              ) : (
                <>
                  <Plus size={15} />
                  Add Router
                </>
              )}
              {isDemo && <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">(Demo)</span>}
            </button>
          </form>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Connected routers"
            description="Track online status, re-run connectivity checks, and drill into live client sessions."
            action={
              <div className="relative min-w-[240px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="input pl-9"
                  placeholder="Search routers..."
                />
              </div>
            }
          >
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
                ))}
              </div>
            ) : filteredRouters.length === 0 ? (
              <EmptyState
                icon={Network}
                title="No routers found"
                description="Add your first MikroTik device or broaden the search query."
              />
            ) : (
              <div className="space-y-4">
                {filteredRouters.map((routerItem) => (
                  <div key={routerItem.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">{routerItem.name}</h3>
                          <StatusBadge status={routerItem.status} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                          <span>{routerItem.ip_address}:{routerItem.port}</span>
                          {routerItem.dns_name && (
                            <span className="font-medium text-primary-600">{routerItem.dns_name}</span>
                          )}
                          <span>{routerItem.location || 'Location not set'}</span>
                          <span>Last seen {routerItem.last_seen ? formatDateTime(routerItem.last_seen) : '—'}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedRouter(routerItem)}
                          className="btn-outline flex items-center gap-2"
                        >
                          <Eye size={14} />
                          Sessions
                        </button>
                        <button
                          onClick={() => testMutation.mutate(routerItem.id)}
                          className="btn-ghost flex items-center gap-2"
                        >
                          <RefreshCcw size={14} />
                          Test
                        </button>
                        <button
                          onClick={() => handleEdit(routerItem)}
                          className="btn-ghost flex items-center gap-2"
                        >
                          <Settings size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(routerItem)}
                          className={`rounded-xl p-2 text-red-600 transition-colors hover:bg-red-50 ${isDemo ? 'opacity-80' : ''}`}
                          title="Remove router"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={selectedRouter ? `Live sessions on ${selectedRouter.name}` : 'Live sessions'}
            description={
              selectedRouter
                ? 'Pulled directly from the MikroTik hotspot active table.'
                : 'Select a router above to inspect its current hotspot activity.'
            }
          >
            {!selectedRouter ? (
              <EmptyState
                icon={Server}
                title="Choose a router first"
                description="Once selected, this panel will show live usernames, addresses, uptime, and MAC data from the router."
              />
            ) : sessionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
                ))}
              </div>
            ) : routerSessions.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No active hotspot sessions"
                description="The router is online, but there are currently no clients authenticated on the hotspot."
              />
            ) : (
              <div className="space-y-3">
                {routerSessions.map((session, index) => (
                  <div key={`${session['.id'] || session.user || index}`} className="grid gap-3 rounded-2xl border border-gray-100 p-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Username</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{session.user || session.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-gray-400">IP / MAC</p>
                      <p className="mt-1 text-sm text-gray-700">{session.address || '—'}</p>
                      <p className="text-xs text-gray-400">{session['mac-address'] || 'No MAC detected'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Uptime</p>
                      <p className="mt-1 text-sm text-gray-700">{session.uptime || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Server</p>
                      <p className="mt-1 text-sm text-gray-700">{session.server || session['login-by'] || 'Hotspot'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
