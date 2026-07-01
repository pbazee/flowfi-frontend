import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Briefcase, Clock3, Plus, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import api from '@/lib/api'
import { formatNumber } from '@/lib/formatters'

function createPlanId() {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function createEmptyPlan() {
  return {
    id: createPlanId(),
    name: '',
    price: '',
    period: 'monthly',
    trial_days: 14,
    router_limit: '',
    description: '',
    featuresText: '',
    featured: false,
    is_active: true,
  }
}

function hydratePlan(plan = {}, index = 0) {
  return {
    ...createEmptyPlan(),
    ...plan,
    id: plan.id || createPlanId(),
    price: plan.price ?? '',
    trial_days: Number(plan.trial_days ?? 0),
    router_limit:
      plan.router_limit === null
        ? 'unlimited'
        : plan.router_limit === undefined || plan.router_limit === ''
          ? ''
          : String(plan.router_limit),
    featuresText: Array.isArray(plan.features) ? plan.features.join('\n') : '',
    sort_order: Number.isFinite(Number(plan.sort_order)) ? Number(plan.sort_order) : index,
    is_active: plan.is_active !== false,
  }
}

function preparePlan(plan, index) {
  const rawRouterLimit = String(plan.router_limit || '').trim().toLowerCase()
  const parsedRouterLimit = Number(rawRouterLimit)

  return {
    id: plan.id || createPlanId(),
    name: String(plan.name || '').trim(),
    price: Number(plan.price || 0),
    period: String(plan.period || 'monthly').trim() || 'monthly',
    trial_days: Math.max(0, Number(plan.trial_days || 0) || 0),
    router_limit:
      rawRouterLimit === 'unlimited'
        ? null
        : rawRouterLimit && Number.isFinite(parsedRouterLimit) && parsedRouterLimit > 0
          ? parsedRouterLimit
          : undefined,
    description: String(plan.description || '').trim(),
    features: String(plan.featuresText || '')
      .split(/\r?\n/)
      .map((feature) => feature.trim())
      .filter(Boolean),
    featured: Boolean(plan.featured),
    is_active: plan.is_active !== false,
    sort_order: index,
  }
}

export default function Plans() {
  const queryClient = useQueryClient()
  const [plans, setPlans] = useState([])

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api.get('/admin/plans').then((response) => response.data),
  })

  useEffect(() => {
    setPlans((data || []).map((plan, index) => hydratePlan(plan, index)))
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/admin/plans', { plans: payload }).then((response) => response.data),
    onSuccess: (savedPlans) => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] })
      queryClient.invalidateQueries({ queryKey: ['platform-content'] })
      setPlans((savedPlans || []).map((plan, index) => hydratePlan(plan, index)))
      toast.success('Workspace plans saved')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not save workspace plans')
    },
  })

  function updatePlan(planId, key, value) {
    setPlans((current) => current.map((plan) => (plan.id === planId ? { ...plan, [key]: value } : plan)))
  }

  function addPlan() {
    setPlans((current) => [...current, createEmptyPlan()])
  }

  function removePlan(planId) {
    setPlans((current) => current.filter((plan) => plan.id !== planId))
  }

  function savePlans() {
    const payload = plans
      .map((plan, index) => preparePlan(plan, index))
      .filter((plan) => plan.name)

    saveMutation.mutate(payload)
  }

  const featuredPlans = useMemo(
    () => plans.filter((plan) => plan.featured).length,
    [plans]
  )
  const trialEnabledPlans = useMemo(
    () => plans.filter((plan) => Number(plan.trial_days || 0) > 0).length,
    [plans]
  )

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Public Content"
        title="Workspace plans and trials"
        description="Keep plan pricing, feature lists, router allowances, and free-trial days aligned with the public signup flow."
        actions={(
          <button
            type="button"
            onClick={savePlans}
            disabled={isLoading || saveMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Saving...' : 'Save plans'}
          </button>
        )}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatTile label="Published plans" value={formatNumber(plans.length)} icon={Briefcase} />
        <StatTile label="Featured plans" value={formatNumber(featuredPlans)} icon={Briefcase} tone="green" />
        <StatTile label="Plans with trials" value={formatNumber(trialEnabledPlans)} icon={Clock3} tone="blue" />
      </div>

      <SectionCard
        title="Workspace plans"
        description="These plans power the landing-page pricing cards, the workspace signup flow, and tenant subscription setup."
        action={(
          <button type="button" onClick={addPlan} className="btn-outline flex items-center gap-2">
            <Plus size={14} />
            Add plan
          </button>
        )}
      >
        <div className="space-y-5">
          {plans.map((plan, index) => (
            <div key={plan.id} className="rounded-3xl border border-gray-100 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Plan #{index + 1}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{plan.name || 'Untitled plan'}</h3>
                    {plan.featured ? <StatusBadge tone="info">Featured</StatusBadge> : null}
                    {plan.is_active === false ? <StatusBadge tone="warning">Hidden</StatusBadge> : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePlan(plan.id)}
                  className="btn-ghost flex items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-5">
                <div>
                  <label className="label">Plan name</label>
                  <input
                    value={plan.name}
                    onChange={(event) => updatePlan(plan.id, 'name', event.target.value)}
                    className="input"
                    placeholder="Starter"
                  />
                </div>
                <div>
                  <label className="label">Price (KES)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={plan.price}
                    onChange={(event) => updatePlan(plan.id, 'price', event.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Billing period</label>
                  <input
                    value={plan.period}
                    onChange={(event) => updatePlan(plan.id, 'period', event.target.value)}
                    className="input"
                    placeholder="monthly"
                  />
                </div>
                <div>
                  <label className="label">Trial days</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={plan.trial_days}
                    onChange={(event) => updatePlan(plan.id, 'trial_days', event.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Router limit</label>
                  <input
                    value={plan.router_limit}
                    onChange={(event) => updatePlan(plan.id, 'router_limit', event.target.value)}
                    className="input"
                    placeholder="1 or unlimited"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="label">Description</label>
                <textarea
                  value={plan.description}
                  onChange={(event) => updatePlan(plan.id, 'description', event.target.value)}
                  className="input min-h-24"
                  placeholder="Who is this plan for?"
                />
              </div>

              <div className="mt-4">
                <label className="label">Features</label>
                <textarea
                  value={plan.featuresText}
                  onChange={(event) => updatePlan(plan.id, 'featuresText', event.target.value)}
                  className="input min-h-28"
                  placeholder={'One feature per line\nUnlimited routers\nPriority support'}
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
                  <input
                    type="checkbox"
                    checked={plan.featured}
                    onChange={(event) => updatePlan(plan.id, 'featured', event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Highlight this plan publicly</span>
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
                  <input
                    type="checkbox"
                    checked={plan.is_active !== false}
                    onChange={(event) => updatePlan(plan.id, 'is_active', event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show this plan in public pricing</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
