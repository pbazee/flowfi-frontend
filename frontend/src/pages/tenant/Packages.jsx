import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, Plus, Tag, Timer, Trash2, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import api from '@/lib/api'
import { formatCurrency, formatDurationMinutes } from '@/lib/formatters'
import { useIsDemo } from '@/hooks/useIsDemo'

const initialForm = {
  name: '',
  description: '',
  price: '',
  duration_minutes: '',
  data_limit_mb: '',
  speed_limit: '',
  mikrotik_profile: 'default',
  points_reward: '0',
  happy_hour_start: '',
  happy_hour_end: '',
  happy_hour_discount: '0',
  status: 'active',
}

export default function Packages() {
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['tenant-packages'],
    queryFn: () => api.get('/packages').then((response) => response.data),
  })

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      if (editingId) {
        return api.put(`/packages/${editingId}`, payload).then((response) => response.data)
      }
      return api.post('/packages', payload).then((response) => response.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-packages'] })
      setEditingId(null)
      setForm(initialForm)
      toast.success(editingId ? 'Package updated' : 'Package created')
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not save package'),
  })

  const deleteMutation = useMutation({
    mutationFn: (packageId) => api.delete(`/packages/${packageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-packages'] })
      toast.success('Package deactivated')
    },
    onError: () => toast.error('Could not deactivate package'),
  })

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function resetForm() {
    setEditingId(null)
    setForm(initialForm)
  }

  function handleEdit(packageItem) {
    setEditingId(packageItem.id)
    setForm({
      name: packageItem.name || '',
      description: packageItem.description || '',
      price: String(packageItem.price || ''),
      duration_minutes: String(packageItem.duration_minutes || ''),
      data_limit_mb: packageItem.data_limit_mb == null ? '' : String(packageItem.data_limit_mb),
      speed_limit: packageItem.speed_limit || '',
      mikrotik_profile: packageItem.mikrotik_profile || 'default',
      points_reward: String(packageItem.points_reward || 0),
      happy_hour_start: packageItem.happy_hour_start ? packageItem.happy_hour_start.slice(0, 5) : '',
      happy_hour_end: packageItem.happy_hour_end ? packageItem.happy_hour_end.slice(0, 5) : '',
      happy_hour_discount: String(packageItem.happy_hour_discount || 0),
      status: packageItem.status || 'active',
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isDemo) return toast('This is a live demo — sign up to save changes', { icon: '🔒' })

    saveMutation.mutate({
      name: form.name,
      description: form.description || null,
      price: Number(form.price),
      duration_minutes: Number(form.duration_minutes),
      data_limit_mb: form.data_limit_mb ? Number(form.data_limit_mb) : null,
      speed_limit: form.speed_limit || null,
      mikrotik_profile: form.mikrotik_profile || 'default',
      points_reward: Number(form.points_reward || 0),
      happy_hour_start: form.happy_hour_start || null,
      happy_hour_end: form.happy_hour_end || null,
      happy_hour_discount: Number(form.happy_hour_discount || 0),
      status: form.status,
    })
  }

  function handleDelete(id) {
    if (isDemo) return toast('This is a live demo — sign up to save changes', { icon: '🔒' })
    if (window.confirm('Are you sure you want to deactivate this package?')) {
      deleteMutation.mutate(id)
    }
  }

  const activePackages = packages.filter((packageItem) => packageItem.status === 'active').length
  const avgPrice = packages.length
    ? Math.round(packages.reduce((sum, packageItem) => sum + Number(packageItem.price || 0), 0) / packages.length)
    : 0

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Tenant Ops"
        title="Packages"
        description="Design WiFi plans, reward customers with points, and automate happy-hour pricing windows."
        actions={editingId ? <button onClick={resetForm} className="btn-ghost">Cancel edit</button> : null}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatTile label="Total packages" value={packages.length} icon={Tag} />
        <StatTile label="Active" value={activePackages} sub={`${packages.length - activePackages} inactive`} icon={Zap} tone="green" />
        <StatTile label="Average price" value={formatCurrency(avgPrice)} icon={Gift} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.35fr]">
        <SectionCard
          title={editingId ? 'Edit package' : 'Create a package'}
          description="Packages map directly to your customer-facing captive portal pricing cards."
        >
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="label">Package name</label>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="input"
                placeholder="1 Hour Fast Pass"
                required
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                className="input min-h-24"
                placeholder="High-speed guest WiFi with room for meetings and streaming"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Price (KES)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => updateField('price', event.target.value)}
                  className="input"
                  placeholder="100"
                  required
                />
              </div>
              <div>
                <label className="label">Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={form.duration_minutes}
                  onChange={(event) => updateField('duration_minutes', event.target.value)}
                  className="input"
                  placeholder="60"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Data limit (MB)</label>
                <input
                  type="number"
                  min="0"
                  value={form.data_limit_mb}
                  onChange={(event) => updateField('data_limit_mb', event.target.value)}
                  className="input"
                  placeholder="Leave blank for unlimited"
                />
              </div>
              <div>
                <label className="label">Speed limit</label>
                <input
                  value={form.speed_limit}
                  onChange={(event) => updateField('speed_limit', event.target.value)}
                  className="input"
                  placeholder="5M/5M"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">MikroTik profile</label>
                <input
                  value={form.mikrotik_profile}
                  onChange={(event) => updateField('mikrotik_profile', event.target.value)}
                  className="input"
                  placeholder="default"
                />
              </div>
              <div>
                <label className="label">Reward points</label>
                <input
                  type="number"
                  min="0"
                  value={form.points_reward}
                  onChange={(event) => updateField('points_reward', event.target.value)}
                  className="input"
                  placeholder="10"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label">Happy hour start</label>
                <input
                  type="time"
                  value={form.happy_hour_start}
                  onChange={(event) => updateField('happy_hour_start', event.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Happy hour end</label>
                <input
                  type="time"
                  value={form.happy_hour_end}
                  onChange={(event) => updateField('happy_hour_end', event.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.happy_hour_discount}
                  onChange={(event) => updateField('happy_hour_discount', event.target.value)}
                  className="input"
                  placeholder="15"
                />
              </div>
            </div>

            <div>
              <label className="label">Status</label>
              <select value={form.status} onChange={(event) => updateField('status', event.target.value)} className="input">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className={`btn-primary flex items-center gap-2 ${isDemo ? 'opacity-80' : ''}`}
              title={isDemo ? 'Demo accounts cannot save' : ''}
            >
              {saveMutation.isPending ? 'Saving...' : editingId ? 'Save Changes' : 'Create Package'}
              {isDemo && <span className="ml-1 text-[10px] font-bold uppercase tracking-wider opacity-80">(Demo)</span>}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="Package catalog"
          description="These plans power the captive portal pricing and loyalty flow."
        >
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <EmptyState
              icon={Timer}
              title="No packages yet"
              description="Create your first WiFi package to start selling access on the captive portal."
            />
          ) : (
            <div className="space-y-4">
              {packages.map((packageItem) => (
                <div key={packageItem.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{packageItem.name}</h3>
                        <StatusBadge status={packageItem.status} />
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                        {packageItem.description || 'No description added yet.'}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                        <span>{formatCurrency(packageItem.price)}</span>
                        <span>{formatDurationMinutes(packageItem.duration_minutes)}</span>
                        <span>{packageItem.data_limit_mb ? `${packageItem.data_limit_mb} MB` : 'Unlimited data'}</span>
                        <span>{packageItem.speed_limit || 'Default speed'}</span>
                        <span>{packageItem.points_reward || 0} reward points</span>
                      </div>
                      {(packageItem.happy_hour_start && packageItem.happy_hour_end) ? (
                        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          <Zap size={12} />
                          Happy hour {packageItem.happy_hour_start.slice(0, 5)} - {packageItem.happy_hour_end.slice(0, 5)} ({packageItem.happy_hour_discount || 0}% off)
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleEdit(packageItem)} className="btn-outline">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(packageItem.id)}
                        className={`rounded-xl p-2 text-red-600 transition-colors hover:bg-red-50 ${isDemo ? 'opacity-80' : ''}`}
                        title={isDemo ? "Demo accounts cannot delete" : "Deactivate package"}
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
      </div>
    </div>
  )
}
