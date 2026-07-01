import { useState } from 'react'
import { useIsDemo } from '@/hooks/useIsDemo'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  History,
  Info,
  Package,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import api from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/formatters'
import { getPlanDisplayFeatures, getPlanRouterLabel } from '@/lib/workspacePlans'

export default function Billing() {
  const isDemo = useIsDemo()
  const queryClient = useQueryClient()
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('mpesa')
  const [isUpgrading, setIsUpgrading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-billing'],
    queryFn: () => api.get('/tenant/billing/current').then((res) => res.data),
  })

  const { data: upgradeMath, isFetching: isCalculating } = useQuery({
    queryKey: ['upgrade-math', selectedPlan?.id],
    enabled: Boolean(selectedPlan?.id),
    queryFn: () => api.post('/tenant/billing/calculate-upgrade', { newPlanId: selectedPlan.id }).then((res) => res.data),
  })

  const upgradeMutation = useMutation({
    mutationFn: (payload) => api.post('/tenant/billing/upgrade-checkout', payload).then((res) => res.data),
    onSuccess: (result) => {
      if (result.authorization_url) {
        window.location.href = result.authorization_url
      } else if (result.checkoutRequestId) {
        setIsUpgrading(false)
        setSelectedPlan(null)
        toast.success(result.message || 'STK Push sent to your phone')
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not initiate upgrade')
    },
  })

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-32 bg-gray-100 rounded-2xl" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-gray-100 rounded-3xl" />)}
        </div>
      </div>
    )
  }

  const subscription = data?.subscription
  const availablePlans = data?.availablePlans || []
  
  // Only show higher priced plans as upgrades
  const upgradeOptions = availablePlans.filter(plan => plan.price > (subscription?.amount || 0))

  function handleUpgradeClick(plan) {
    setSelectedPlan(plan)
    setIsUpgrading(true)
  }

  function handleCheckout() {
    upgradeMutation.mutate({
      newPlanId: selectedPlan.id,
      paymentMethod
    })
  }

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Workspace"
        title="Billing & Subscription"
        description="Manage your FlowFi plan, view usage limits, and upgrade your scale as your business grows."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatTile
          label="Current Plan"
          value={subscription?.plan_name || 'Free Trial'}
          icon={Package}
          tone="primary"
          sub={subscription?.status === 'active' ? 'Active subscription' : 'Subscription pending'}
        />
        <StatTile
          label="Next Billing Date"
          value={subscription?.next_billing_date ? formatDateTime(subscription.next_billing_date).split(',')[0] : '—'}
          icon={History}
          sub={subscription?.billing_period ? `Billed ${subscription.billing_period}` : 'No recurring billing'}
        />
        <StatTile
          label="Monthly Commitment"
          value={formatCurrency(subscription?.amount || 0)}
          icon={CreditCard}
          tone="green"
          sub="Subject to usage limits"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr,320px]">
        <div className="space-y-8">
          <SectionCard
            title="Available Upgrades"
            description="Choose a higher tier to increase your router limits and access advanced features."
          >
            {upgradeOptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200 text-center">
                <ShieldCheck size={48} className="text-primary-200 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">You're on the top tier!</h3>
                <p className="text-gray-500 max-w-sm mt-1">You are already on our highest available plan. Contact support if you need a custom enterprise solution.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {upgradeOptions.map((plan) => (
                  <div key={plan.id} className="relative flex flex-col rounded-[2.5rem] border border-gray-100 bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-lg">
                    <div className="mb-4">
                      <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-700">
                        {plan.name}
                      </span>
                    </div>
                    
                    <div className="mb-4 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-gray-900">{formatCurrency(plan.price)}</span>
                      <span className="text-sm text-gray-500">/{plan.period || 'month'}</span>
                    </div>

                    <ul className="mb-8 space-y-3 flex-grow">
                      {getPlanDisplayFeatures(plan).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-gray-600">
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary-600" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleUpgradeClick(plan)}
                      className={`btn-primary flex items-center justify-center gap-2 py-3 ${isDemo ? 'opacity-80' : ''}`}
                    >
                      Upgrade to {plan.name}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Usage Limits">
            <div className="space-y-6">
               <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Router Slots</p>
                    <p className="text-sm font-semibold text-gray-900">{getPlanRouterLabel(subscription)}</p>
                  </div>
                  <div className="relative h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-primary-600 transition-all duration-500" style={{ width: '100%' }} />
                  </div>
               </div>
               
               <div className="rounded-2xl bg-blue-50 p-4 border border-blue-100">
                 <div className="flex gap-3">
                   <Info size={18} className="text-blue-600 shrink-0" />
                   <div>
                     <p className="text-sm font-semibold text-blue-900">Prorated Billing</p>
                     <p className="text-xs text-blue-700 mt-1">When you upgrade, we instantly credit you for the unused time on your current plan.</p>
                   </div>
                 </div>
               </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {isUpgrading && selectedPlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Confirm Upgrade</h3>
                  <p className="text-gray-500">You are switching to the {selectedPlan.name} plan.</p>
                </div>
                <button onClick={() => setIsUpgrading(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  ✕
                </button>
              </div>

              {isCalculating ? (
                <div className="py-12 flex flex-col items-center gap-4">
                  <Zap size={32} className="text-primary-600 animate-bounce" />
                  <p className="text-sm text-gray-500 font-medium">Calculating prorated credit...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-[2rem] bg-gray-50 border border-gray-100 p-6 space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">New Plan ({selectedPlan.name})</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(selectedPlan.price)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-medium underline decoration-dashed underline-offset-4 cursor-help" title={`Based on ${upgradeMath?.daysRemaining} days remaining in your current cycle`}>
                          Unused credit from {subscription?.plan_name}
                        </span>
                      </div>
                      <span className="font-semibold text-green-600">-{formatCurrency(upgradeMath?.unusedCredit || 0)}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                      <span className="text-base font-bold text-gray-900">Amount due today</span>
                      <span className="text-2xl font-black text-primary-600">{formatCurrency(upgradeMath?.amountToPay || 0)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1">Select Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setPaymentMethod('mpesa')}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'mpesa' ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'}`}
                      >
                        <Smartphone size={20} />
                        <span className="font-bold">M-Pesa</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('paystack')}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'paystack' ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'}`}
                      >
                        <CreditCard size={20} />
                        <span className="font-bold">Paystack</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={upgradeMutation.isPending}
                    className={`btn-primary w-full py-4 text-lg font-bold shadow-xl shadow-primary-200 ${isDemo ? 'opacity-80' : ''}`}
                  >
                    {upgradeMutation.isPending ? 'Processing...' : `Pay ${formatCurrency(upgradeMath?.amountToPay || 0)}`}
                  </button>
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 p-6 text-center">
              <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5">
                <ShieldCheck size={14} className="text-green-600" />
                Payments are securely processed via {paymentMethod === 'mpesa' ? 'Safaricom Daraja' : 'Paystack API'}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
