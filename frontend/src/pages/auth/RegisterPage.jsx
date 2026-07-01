import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Sparkles, Wifi } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePlatformContent } from '@/hooks/usePlatformContent'
import { formatCurrency } from '@/lib/formatters'
import { getPlanDisplayFeatures, getPlanRouterLabel } from '@/lib/workspacePlans'
import { useAuthStore } from '@/store/auth'

const initialForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  business_name: '',
  business_type: 'other',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const register = useAuthStore((state) => state.register)
  const { data: content } = usePlatformContent()
  const workspacePlans = content?.workspacePlans || []
  const featuredPlan = workspacePlans.find((plan) => plan.featured) || workspacePlans[0]
  const [form, setForm] = useState(initialForm)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!selectedPlanId && featuredPlan?.id) {
      setSelectedPlanId(featuredPlan.id)
    }
  }, [featuredPlan, selectedPlanId])

  const selectedPlan = useMemo(
    () => workspacePlans.find((plan) => plan.id === selectedPlanId) || featuredPlan,
    [featuredPlan, selectedPlanId, workspacePlans]
  )

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!selectedPlan?.id) {
      toast.error('Select a workspace plan first')
      return
    }

    try {
      setIsSubmitting(true)
      await register({
        ...form,
        plan_id: selectedPlan.id,
      })

      if (selectedPlan.trial_days > 0) {
        toast.success(`${selectedPlan.trial_days}-day trial started for ${selectedPlan.name}`)
      } else {
        toast.success(`${selectedPlan.name} workspace created`)
      }

      navigate('/tenant')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not create your workspace')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[0.92fr,1.08fr]">
          <div className="space-y-6">
            <div className="rounded-[32px] bg-white p-8 shadow-sm">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600">
                  <Wifi size={22} className="text-white" />
                </div>
                <h1 className="text-3xl font-bold font-display text-gray-900">Start your FlowFi workspace</h1>
                <p className="mt-2 text-sm text-gray-500">
                  Create your account, choose a plan, and launch on a free trial before billing begins.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Your name</label>
                  <input
                    className="input"
                    placeholder="Jane Mwangi"
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Business name</label>
                  <input
                    className="input"
                    placeholder="Garden City Mall"
                    value={form.business_name}
                    onChange={(event) => updateField('business_name', event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Business type</label>
                  <select
                    className="input"
                    value={form.business_type}
                    onChange={(event) => updateField('business_type', event.target.value)}
                  >
                    <option value="mall">Mall</option>
                    <option value="market">Market</option>
                    <option value="hotel">Hotel</option>
                    <option value="school">School / University</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Phone number</label>
                  <input
                    className="input"
                    placeholder="0712345678"
                    value={form.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    required
                    type="tel"
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    placeholder="jane@venue.com"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    required
                    type="email"
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    className="input"
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    required
                    type="password"
                    minLength={8}
                  />
                </div>

                <div className="rounded-3xl border border-primary-100 bg-primary-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-2 text-primary-600 shadow-sm">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Billing starts after your trial</p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-600">
                        {selectedPlan?.trial_days > 0
                          ? `The ${selectedPlan.name} plan includes ${selectedPlan.trial_days} free day(s). Your first invoice is created only after the trial ends.`
                          : 'This plan does not include a free trial, so billing starts as soon as the workspace is created.'}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-3"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {selectedPlan?.trial_days > 0
                    ? `Start ${selectedPlan.trial_days}-day trial`
                    : 'Create workspace'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-primary-600 font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-primary-600">Workspace plans</p>
                  <h2 className="mt-2 text-2xl font-semibold text-gray-900">Choose the right setup for your venue</h2>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {workspacePlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full rounded-[28px] border p-6 text-left transition-all ${
                      selectedPlan?.id === plan.id
                        ? 'border-primary-300 bg-primary-50 shadow-sm'
                        : 'border-gray-100 hover:border-primary-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                          {plan.featured ? (
                            <span className="rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white">
                              Recommended
                            </span>
                          ) : null}
                          {plan.trial_days > 0 ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-primary-700 ring-1 ring-primary-200">
                              {plan.trial_days}-day trial
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-gray-600">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(plan.price)}</p>
                        <p className="text-xs text-gray-400">{plan.period}</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      {getPlanDisplayFeatures(plan).map((feature) => (
                        <div key={feature} className="rounded-2xl bg-white px-4 py-3 text-sm text-gray-600">
                          {feature}
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] bg-primary-600 p-8 text-white shadow-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-primary-100">Selected plan</p>
              <h2 className="mt-2 text-3xl font-bold">{selectedPlan?.name || 'Choose a plan'}</h2>
              <p className="mt-3 text-primary-100">
                {selectedPlan?.description || 'Select a plan to review the workspace offer.'}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-primary-100">Price</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {selectedPlan ? formatCurrency(selectedPlan.price) : 'KES 0'}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-primary-100">Billing</p>
                  <p className="mt-2 text-lg font-semibold text-white">{selectedPlan?.period || 'monthly'}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-primary-100">Free trial</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {selectedPlan?.trial_days ? `${selectedPlan.trial_days} day(s)` : 'No trial'}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-primary-100">Router allowance</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {selectedPlan ? getPlanRouterLabel(selectedPlan) : 'Set by plan'}
                  </p>
                </div>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-primary-100">
                Your workspace is created immediately after signup, and FlowFi emails the trial details so you know exactly when billing starts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
