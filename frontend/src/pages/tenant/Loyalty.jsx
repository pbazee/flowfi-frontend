import { useEffect, useMemo, useState } from 'react'
import { useIsDemo } from '@/hooks/useIsDemo'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, Medal, Sparkles, Star, Trash2, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatNumber, titleize } from '@/lib/formatters'

const rewardTypes = [
  { value: 'free_package', label: 'Free package' },
  { value: 'discount', label: 'Discount reward' },
  { value: 'custom', label: 'Custom reward' },
]

const initialRewardForm = {
  id: null,
  name: '',
  description: '',
  points_required: 100,
  reward_type: 'free_package',
  package_id: '',
  discount_percent: '',
  is_active: true,
}

export default function Loyalty() {
  const isDemo = useIsDemo()
  const queryClient = useQueryClient()
  const [settingsForm, setSettingsForm] = useState({
    loyalty_enabled: false,
    loyalty_points_per_kes: 1,
  })
  const [rewardForm, setRewardForm] = useState(initialRewardForm)

  const { data: settings } = useQuery({
    queryKey: ['tenant-loyalty-settings'],
    queryFn: () => api.get('/loyalty/settings').then((response) => response.data),
  })

  const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ['tenant-loyalty-rewards'],
    queryFn: () => api.get('/loyalty/rewards').then((response) => response.data),
  })

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['tenant-loyalty-leaderboard'],
    queryFn: () => api.get('/loyalty/leaderboard').then((response) => response.data),
  })

  const { data: packages = [] } = useQuery({
    queryKey: ['tenant-packages'],
    queryFn: () => api.get('/packages').then((response) => response.data),
  })

  useEffect(() => {
    if (!settings) return

    setSettingsForm({
      loyalty_enabled: Boolean(settings.loyalty_enabled),
      loyalty_points_per_kes: Number(settings.loyalty_points_per_kes || 1),
    })
  }, [settings])

  const settingsMutation = useMutation({
    mutationFn: (payload) => api.put('/loyalty/settings', payload).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-loyalty-settings'] })
      toast.success('Loyalty settings saved')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not save loyalty settings')
    },
  })

  const rewardMutation = useMutation({
    mutationFn: (payload) => {
      if (payload.id) {
        return api.put(`/loyalty/rewards/${payload.id}`, payload).then((response) => response.data)
      }

      return api.post('/loyalty/rewards', payload).then((response) => response.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-loyalty-rewards'] })
      setRewardForm(initialRewardForm)
      toast.success('Reward saved')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not save reward')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (rewardId) => api.delete(`/loyalty/rewards/${rewardId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-loyalty-rewards'] })
      toast.success('Reward deactivated')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not deactivate reward')
    },
  })

  const activeRewards = rewards.filter((reward) => reward.is_active)
  const totalCurrentPoints = leaderboard.reduce((sum, customer) => sum + Number(customer.total_points || 0), 0)
  const totalLifetimePoints = leaderboard.reduce((sum, customer) => sum + Number(customer.lifetime_points || 0), 0)
  const averageLifetimePoints = leaderboard.length
    ? Math.round(totalLifetimePoints / leaderboard.length)
    : 0

  const rewardTypeSummary = useMemo(() => {
    return activeRewards.reduce((summary, reward) => {
      summary[reward.reward_type] = (summary[reward.reward_type] || 0) + 1
      return summary
    }, {})
  }, [activeRewards])

  function updateSettings(key, value) {
    setSettingsForm((current) => ({ ...current, [key]: value }))
  }

  function updateRewardForm(key, value) {
    setRewardForm((current) => ({ ...current, [key]: value }))
  }

  function handleSettingsSubmit(event) {
    event.preventDefault()

    settingsMutation.mutate({
      loyalty_enabled: settingsForm.loyalty_enabled,
      loyalty_points_per_kes: Number(settingsForm.loyalty_points_per_kes),
    })
  }

  function handleRewardSubmit(event) {
    event.preventDefault()

    rewardMutation.mutate({
      id: rewardForm.id,
      name: rewardForm.name.trim(),
      description: rewardForm.description.trim() || undefined,
      points_required: Number(rewardForm.points_required),
      reward_type: rewardForm.reward_type,
      package_id:
        rewardForm.reward_type === 'free_package' && rewardForm.package_id
          ? rewardForm.package_id
          : undefined,
      discount_percent:
        rewardForm.reward_type === 'discount' && rewardForm.discount_percent !== ''
          ? Number(rewardForm.discount_percent)
          : undefined,
      is_active: Boolean(rewardForm.is_active),
    })
  }

  function startEditing(reward) {
    setRewardForm({
      id: reward.id,
      name: reward.name || '',
      description: reward.description || '',
      points_required: Number(reward.points_required || 0),
      reward_type: reward.reward_type || 'free_package',
      package_id: reward.package_id || '',
      discount_percent: reward.discount_percent ?? '',
      is_active: Boolean(reward.is_active),
    })
  }

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Retention"
        title="Loyalty program"
        description="Control how customers earn points, curate redemptions, and keep an eye on your most valuable repeat buyers."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Members" value={formatNumber(leaderboard.length)} icon={Star} />
        <StatTile label="Current points" value={formatNumber(totalCurrentPoints)} icon={Sparkles} tone="green" />
        <StatTile label="Active rewards" value={formatNumber(activeRewards.length)} icon={Gift} tone="amber" />
        <StatTile label="Avg. lifetime points" value={formatNumber(averageLifetimePoints)} icon={Trophy} tone="purple" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <SectionCard
          title="Program settings"
          description="Decide whether the program is live and how many points customers earn for every Kenya shilling spent."
        >
          <form onSubmit={handleSettingsSubmit} className="space-y-5">
            <label className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4">
              <input
                type="checkbox"
                checked={settingsForm.loyalty_enabled}
                onChange={(event) => updateSettings('loyalty_enabled', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">Enable loyalty rewards</p>
                <p className="mt-1 text-sm text-gray-500">
                  When active, successful transactions can convert into customer points.
                </p>
              </div>
            </label>

            <div>
              <label className="label">Points per KES</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={settingsForm.loyalty_points_per_kes}
                onChange={(event) => updateSettings('loyalty_points_per_kes', event.target.value)}
                className="input"
              />
            </div>

            <div className="rounded-2xl bg-primary-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-700">
                Program note
              </p>
              <p className="mt-2 text-sm leading-relaxed text-primary-900">
                Customers currently earn {settingsForm.loyalty_points_per_kes || 0} point(s) per KES when
                qualifying purchases are recorded.
              </p>
            </div>

            <button type="submit" disabled={settingsMutation.isPending} className={`btn-primary w-full ${isDemo ? 'opacity-80' : ''}`}>
              {settingsMutation.isPending ? 'Saving settings...' : 'Save loyalty settings'}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title={rewardForm.id ? 'Edit reward' : 'Create reward'}
          description="Mix free package redemptions with discounts or custom perks for your most engaged customers."
        >
          <form onSubmit={handleRewardSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Reward name</label>
                <input
                  value={rewardForm.name}
                  onChange={(event) => updateRewardForm('name', event.target.value)}
                  className="input"
                  placeholder="Free day pass"
                  required
                />
              </div>
              <div>
                <label className="label">Points required</label>
                <input
                  type="number"
                  min={1}
                  value={rewardForm.points_required}
                  onChange={(event) => updateRewardForm('points_required', event.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Reward type</label>
              <select
                value={rewardForm.reward_type}
                onChange={(event) => updateRewardForm('reward_type', event.target.value)}
                className="input"
              >
                {rewardTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {rewardForm.reward_type === 'free_package' ? (
              <div>
                <label className="label">Package reward</label>
                <select
                  value={rewardForm.package_id}
                  onChange={(event) => updateRewardForm('package_id', event.target.value)}
                  className="input"
                >
                  <option value="">Select package</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {rewardForm.reward_type === 'discount' ? (
              <div>
                <label className="label">Discount percent</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={rewardForm.discount_percent}
                  onChange={(event) => updateRewardForm('discount_percent', event.target.value)}
                  className="input"
                  placeholder="10"
                />
              </div>
            ) : null}

            <div>
              <label className="label">Description</label>
              <textarea
                value={rewardForm.description}
                onChange={(event) => updateRewardForm('description', event.target.value)}
                className="input min-h-28"
                placeholder="What the customer gets and any redemption conditions..."
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
              <input
                type="checkbox"
                checked={rewardForm.is_active}
                onChange={(event) => updateRewardForm('is_active', event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Reward is available for redemption</span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={rewardMutation.isPending} className={`btn-primary flex-1 ${isDemo ? 'opacity-80' : ''}`}>
                {rewardMutation.isPending ? 'Saving reward...' : rewardForm.id ? 'Update reward' : 'Create reward'}
              </button>
              {rewardForm.id ? (
                <button
                  type="button"
                  onClick={() => setRewardForm(initialRewardForm)}
                  className="btn-ghost"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <SectionCard
          title="Reward catalogue"
          description="Keep your redemption mix balanced so customers always have a next milestone to aim for."
        >
          {rewardsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : rewards.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="No rewards configured yet"
              description="Add your first loyalty reward to let customers exchange points for packages, discounts, or custom perks."
            />
          ) : (
            <div className="space-y-4">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="rounded-3xl border border-gray-100 bg-gray-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{reward.name}</h3>
                        <StatusBadge status={reward.is_active ? 'active' : 'inactive'} />
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        {reward.description || 'No extra description provided yet.'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Points required</p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900">
                        {formatNumber(reward.points_required)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Type</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {titleize(reward.reward_type)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Package</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {reward.packages?.name || 'Not package-based'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Discount</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {reward.discount_percent ? `${reward.discount_percent}%` : 'None'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={() => startEditing(reward)} className="btn-outline">
                      Edit reward
                    </button>
                    {reward.is_active ? (
                      <button
                        type="button"
                        onClick={() => deactivateMutation.mutate(reward.id)}
                        className="btn-ghost flex items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                        Deactivate
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Reward mix"
            description="A quick view of which redemption types dominate your current catalogue."
          >
            {Object.keys(rewardTypeSummary).length === 0 ? (
              <EmptyState
                icon={Medal}
                title="No active rewards"
                description="Create or reactivate rewards to see your catalogue mix here."
              />
            ) : (
              <div className="space-y-3">
                {Object.entries(rewardTypeSummary).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{titleize(type)}</p>
                    <StatusBadge tone="info">{count} reward(s)</StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Top members"
            description="These customers have accumulated the most lifetime points in your program."
          >
            {leaderboard.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No loyalty members yet"
                description="As customers transact and collect points, the leaderboard will start filling in."
              />
            ) : (
              <div className="space-y-3">
                {leaderboard.map((customer, index) => (
                  <div key={customer.phone} className="rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Rank #{index + 1}</p>
                        <p className="mt-2 text-sm font-semibold text-gray-900">{customer.phone}</p>
                      </div>
                      <StatusBadge tone="success">
                        {formatNumber(customer.total_points)} current points
                      </StatusBadge>
                    </div>
                    <p className="mt-3 text-sm text-gray-500">
                      Lifetime points: {formatNumber(customer.lifetime_points)}
                    </p>
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
