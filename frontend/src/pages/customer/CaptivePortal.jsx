import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Star,
  Wifi,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

const DEVICE_PARAM_KEYS = {
  mac_address: ['mac_address', 'mac-address', 'mac', 'client_mac', 'clientMac', 'macAddress'],
  ip_address: ['ip_address', 'ip-address', 'ip', 'client_ip', 'clientIp', 'ipAddress'],
}

function readSearchParam(searchParams, keys = []) {
  for (const key of keys) {
    const value = searchParams.get(key)
    if (value) return value
  }

  return ''
}

function readStoredDeviceContext(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0))
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(safeSeconds % 60).padStart(2, '0')

  return `${hours} : ${minutes} : ${seconds}`
}

function SessionCountdownCard({ primaryColor, session, remainingSeconds, onBuyAnother }) {
  const routerHost = session.router_dns_name || session.router_ip
  const redirectUrl = routerHost
    ? `http://${routerHost}/login?username=${session.username}&password=${session.password || ''}`
    : null

  function handleConnect() {
    if (redirectUrl) {
      window.location.href = redirectUrl
    } else {
      toast.error('Router connection details missing. Please contact support.')
    }
  }

  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Session active</p>

      {redirectUrl && (
        <button
          type="button"
          onClick={handleConnect}
          className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-4 text-base shadow-lg transition-transform hover:scale-[1.02]"
          style={{ background: primaryColor }}
        >
          <Wifi size={20} />
          Connect to WiFi
        </button>
      )}

      <div className="mt-5 rounded-[28px] bg-gray-50 p-5 text-center">
        <p className="text-sm font-medium text-gray-500">Time remaining</p>
        <p className="mt-4 font-display text-4xl font-bold text-gray-900">
          {formatCountdown(remainingSeconds)}
        </p>
        <p className="mt-4 text-sm font-medium text-gray-900">
          {session.package_name} - {session.package_speed}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Loyalty earned: {session.loyalty_points_earned || 0} point(s)
        </p>
      </div>

      <button
        type="button"
        onClick={onBuyAnother}
        className="mt-5 w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
      >
        Buy another package
      </button>
      <p className="mt-3 text-xs leading-relaxed text-gray-500 text-center">
        {redirectUrl ? 'Click Connect above if you are not already browsing.' : 'Your timer is synced to your active session on FlowFi.'}
      </p>
    </div>
  )
}

export default function CaptivePortal() {
  const { tenantId } = useParams()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState('pay')
  const [selectedPkg, setSelectedPkg] = useState(null)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [pollRef, setPollRef] = useState(null)
  const [completionState, setCompletionState] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [showBuyAnother, setShowBuyAnother] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [expiredSessionSummary, setExpiredSessionSummary] = useState(null)

  const storageKey = `flowfi-portal-device:${tenantId}`
  const referenceFromUrl = searchParams.get('reference') || searchParams.get('trxref') || ''

  const storedDeviceContext = useMemo(() => readStoredDeviceContext(storageKey), [storageKey])
  const deviceContext = useMemo(
    () => ({
      mac_address: readSearchParam(searchParams, DEVICE_PARAM_KEYS.mac_address) || storedDeviceContext.mac_address || '',
      ip_address: readSearchParam(searchParams, DEVICE_PARAM_KEYS.ip_address) || storedDeviceContext.ip_address || '',
      device_type: storedDeviceContext.device_type || navigator.userAgent || 'browser',
    }),
    [searchParams, storedDeviceContext]
  )

  const lookupReference = referenceFromUrl || storedDeviceContext.reference || ''

  const { data: config, isLoading } = useQuery({
    queryKey: ['portal-config', tenantId],
    queryFn: () => api.get(`/portal/${tenantId}/config`).then((response) => response.data),
  })

  const sessionStatusQuery = useQuery({
    queryKey: ['portal-session-status', tenantId, deviceContext.mac_address, lookupReference, phone.trim()],
    enabled: Boolean(tenantId && (deviceContext.mac_address || lookupReference || phone.trim())),
    queryFn: () =>
      api
        .get(`/portal/${tenantId}/session-status`, {
          params: {
            mac_address: deviceContext.mac_address || undefined,
            reference: lookupReference || undefined,
            phone: !deviceContext.mac_address && !lookupReference ? phone.trim() || undefined : undefined,
          },
        })
        .then((response) => response.data),
    refetchInterval: (query) => (query.state.data?.active ? 15000 : false),
  })

  const tenant = config?.tenant
  const packages = config?.packages || []
  const paymentMethods = config?.payment_methods || {}
  const portalState = config?.portal_state || {}
  const primaryColor = tenant?.portal_primary_color || '#0F6E56'
  const activeSession = sessionStatusQuery.data?.active ? sessionStatusQuery.data : null
  const countdownVisible = tab === 'pay' && activeSession && !sessionEnded && !showBuyAnother
  const mpesaEnabled = Boolean(paymentMethods.mpesa)
  const paystackEnabled = Boolean(paymentMethods.paystack)
  const acceptsPayments = Boolean(portalState.accepts_payments)

  useEffect(() => {
    try {
      const payload = {
        ...storedDeviceContext,
        ...deviceContext,
        reference: lookupReference || storedDeviceContext.reference || '',
      }

      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // Ignore local storage issues in captive portal mode.
    }
  }, [deviceContext, lookupReference, storageKey, storedDeviceContext])

  useEffect(() => {
    if (!tenantId || (!deviceContext.mac_address && !deviceContext.ip_address)) return

    api.post(`/portal/${tenantId}/check-in`, deviceContext).catch(() => {})
  }, [deviceContext, tenantId])

  useEffect(() => {
    if (!activeSession?.session_id) return

    setRemainingSeconds(Number(activeSession.remaining_seconds || 0))
    setSessionEnded(false)
    setExpiredSessionSummary(null)
    setShowBuyAnother(false)
  }, [activeSession?.remaining_seconds, activeSession?.session_end, activeSession?.session_id])

  useEffect(() => {
    if (!activeSession?.session_end || showBuyAnother) return undefined

    const tick = () => {
      const nextRemaining = Math.max(
        0,
        Math.floor((new Date(activeSession.session_end).getTime() - Date.now()) / 1000)
      )

      setRemainingSeconds(nextRemaining)

      if (nextRemaining === 0) {
        setSessionEnded(true)
        setExpiredSessionSummary(activeSession)
        setTab('pay')
        sessionStatusQuery.refetch()
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)

    return () => window.clearInterval(interval)
  }, [activeSession, sessionStatusQuery, showBuyAnother])

  function getPrice(pkg) {
    if (!pkg.happy_hour_start || !pkg.happy_hour_discount) return pkg.price

    const now = new Date()
    const [startHour, startMinute] = pkg.happy_hour_start.split(':').map(Number)
    const [endHour, endMinute] = pkg.happy_hour_end.split(':').map(Number)
    const minutes = now.getHours() * 60 + now.getMinutes()

    if (minutes >= startHour * 60 + startMinute && minutes <= endHour * 60 + endMinute) {
      return pkg.price * (1 - pkg.happy_hour_discount / 100)
    }

    return pkg.price
  }

  const stkMutation = useMutation({
    mutationFn: (payload) => api.post('/payments/mpesa/initiate', payload).then((response) => response.data),
    onSuccess: (data) => {
      toast.success('Check your phone for the M-Pesa prompt.', { duration: 6000 })
      setPollRef(data.checkoutRequestId)
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Payment failed'),
  })

  const paystackMutation = useMutation({
    mutationFn: (payload) => api.post('/payments/paystack/initialize', payload).then((response) => response.data),
    onSuccess: (data) => {
      if (data.authorization_url) {
        window.location.href = data.authorization_url
      }
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not redirect to Paystack'),
  })

  useEffect(() => {
    if (!pollRef) return undefined

    const interval = window.setInterval(async () => {
      try {
        const { data } = await api.post('/payments/mpesa/query', { checkoutRequestId: pollRef })
        if (data.ResultCode === 0) {
          setPollRef(null)
          setSessionEnded(false)
          setShowBuyAnother(false)
          await sessionStatusQuery.refetch()
          toast.success('Payment confirmed. Your session is now active.')
        } else if (data.ResultCode && data.ResultCode !== 0) {
          setPollRef(null)
          toast.error('Payment was not completed')
        }
      } catch {
        // Keep polling until a terminal response is returned.
      }
    }, 5000)

    return () => window.clearInterval(interval)
  }, [pollRef, sessionStatusQuery])

  function handlePay() {
    if (!mpesaEnabled) {
      toast.error('This venue has not enabled M-Pesa payments yet')
      return
    }

    if (!selectedPkg) {
      toast.error('Select a package first')
      return
    }

    if (!phone || phone.length < 9) {
      toast.error('Enter a valid phone number')
      return
    }

    stkMutation.mutate({
      phone,
      package_id: selectedPkg.id,
      tenant_id: tenantId,
      mac_address: deviceContext.mac_address || undefined,
      ip_address: deviceContext.ip_address || undefined,
      device_type: deviceContext.device_type || undefined,
    })
  }

  function handleOtherPaymentMethods() {
    if (!paystackEnabled) {
      toast.error('This venue has not enabled Paystack payments yet')
      return
    }

    if (!selectedPkg) {
      toast.error('Select a package first')
      return
    }

    if (!email.trim()) {
      toast.error('Enter your email to continue with Paystack')
      return
    }

    paystackMutation.mutate({
      email: email.trim(),
      customer_phone: phone.trim(),
      package_id: selectedPkg.id,
      tenant_id: tenantId,
      mac_address: deviceContext.mac_address || undefined,
      ip_address: deviceContext.ip_address || undefined,
      device_type: deviceContext.device_type || undefined,
      callback_url: `${window.location.origin}/payment/callback?flow=wifi&tenantId=${tenantId}`,
    })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Portal not found</p>
      </div>
    )
  }

  if (completionState) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-md">
          <div className="card p-8 text-center">
            <div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: `${primaryColor}20` }}
            >
              <CheckCircle2 size={32} style={{ color: primaryColor }} />
            </div>
            <h2 className="font-display text-xl font-bold text-gray-900">{completionState.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">{completionState.description}</p>

            {(completionState.meta || []).length > 0 ? (
              <div className="mt-6 grid gap-3">
                {completionState.meta.map((item) => (
                  <div key={item.label} className="rounded-2xl bg-gray-50 px-4 py-3 text-left">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{item.label}</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setCompletionState(null)}
              className="btn-primary mt-6 w-full"
            >
              Return to portal
            </button>
            <p className="mt-5 text-xs text-gray-500">Powered by <strong>FlowFi</strong></p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} className="mx-auto mb-3 h-12 object-contain" />
          ) : (
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: primaryColor }}>
              <Wifi size={24} className="text-white" />
            </div>
          )}
          <h1 className="font-display text-xl font-bold text-gray-900">{tenant.name}</h1>
          <p className="mt-1 text-sm text-gray-700">{tenant.portal_welcome_message}</p>
        </div>

        <div className="card mb-5 flex gap-1 p-1">
          {[
            { key: 'pay', label: 'Buy WiFi', icon: Wifi },
            { key: 'points', label: 'My Points', icon: Star },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all ${
                tab === key ? 'text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              style={tab === key ? { background: primaryColor } : {}}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {tab === 'pay' ? (
          portalState.suspended ? (
            <div className="card p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle size={24} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-gray-900">Service temporarily unavailable</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {portalState.message || 'New connections are temporarily disabled by the provider. Existing active sessions will continue to work until they expire.'}
              </p>
            </div>
          ) : countdownVisible ? (
            <SessionCountdownCard
              primaryColor={primaryColor}
              session={activeSession}
              remainingSeconds={remainingSeconds}
              onBuyAnother={() => setShowBuyAnother(true)}
            />
          ) : (
            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Choose a package</h2>

              {showBuyAnother && activeSession ? (
                <div className="mb-4 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-900">
                  Your current session is still active. You can buy another package now to top up before it expires.
                </div>
              ) : null}

              {sessionEnded ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Your session has ended.</p>
                  <p className="mt-1">Buy a new package to get back online.</p>
                  {(expiredSessionSummary?.loyalty_points_earned || 0) > 0 ? (
                    <button
                      type="button"
                      onClick={() => setTab('points')}
                      className="mt-3 text-sm font-semibold underline"
                    >
                      You have loyalty points available. Check My Points.
                    </button>
                  ) : null}
                </div>
              ) : null}

              {!acceptsPayments ? (
                <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {portalState.message || 'This venue is not yet accepting online payments. Contact the venue for assistance.'}
                </div>
              ) : null}

              {packages.length > 0 ? (
                <div className="mb-5 grid grid-cols-2 gap-3">
                  {packages.map((pkg) => {
                    const price = getPrice(pkg)
                    const isHappyHour = price < pkg.price
                    const isSelected = selectedPkg?.id === pkg.id
                    const duration = pkg.duration_minutes >= 1440
                      ? `${pkg.duration_minutes / 1440} day`
                      : pkg.duration_minutes >= 60
                        ? `${pkg.duration_minutes / 60} hr`
                        : `${pkg.duration_minutes} min`
                    const allowance = pkg.data_limit_mb ? `${pkg.data_limit_mb}MB` : 'Unlimited'
                    const speed = pkg.speed_limit || allowance

                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPkg(pkg)}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          isSelected ? 'border-current bg-primary-50/60' : 'border-gray-100 hover:border-gray-200'
                        }`}
                        style={isSelected ? { borderColor: primaryColor } : {}}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-900">{pkg.name}</p>
                            <p className="mt-1 text-xs text-gray-500">{duration}</p>
                            <p className="mt-1 text-xs text-gray-500">{speed}</p>
                          </div>
                          {isHappyHour ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                              Happy hour
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-5">
                          <p className="text-xl font-bold text-gray-900" style={isSelected ? { color: primaryColor } : {}}>
                            KES {Math.ceil(price)}
                          </p>
                          {pkg.points_reward > 0 ? (
                            <p className="mt-1 text-xs font-medium text-gray-500">+{pkg.points_reward} pts</p>
                          ) : null}
                          <p className="mt-1 text-[11px] text-gray-400">{allowance}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="mb-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                  {!acceptsPayments
                    ? 'New connections are temporarily disabled by the provider. Existing active sessions will continue to work until they expire.'
                    : 'No WiFi packages are available for this venue yet.'}
                </div>
              )}

              {mpesaEnabled ? (
                <div className="mb-4">
                  <label className="label">Your M-Pesa number</label>
                  <input
                    className="input"
                    placeholder="e.g. 0712345678"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    type="tel"
                  />
                </div>
              ) : null}

              {paystackEnabled ? (
                <div className="mb-4">
                  <label className="label">Email for Paystack</label>
                  <input
                    className="input"
                    placeholder="e.g. you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                  />
                </div>
              ) : null}

              {mpesaEnabled ? (
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={stkMutation.isPending || Boolean(pollRef) || packages.length === 0 || !acceptsPayments}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: primaryColor }}
                >
                  {stkMutation.isPending || pollRef ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Waiting for payment...
                    </>
                  ) : (
                    `Pay KES ${selectedPkg ? Math.ceil(getPrice(selectedPkg)) : '-'} via M-Pesa`
                  )}
                </button>
              ) : null}

              {paystackEnabled ? (
                <button
                  type="button"
                  onClick={handleOtherPaymentMethods}
                  disabled={paystackMutation.isPending || packages.length === 0 || !acceptsPayments}
                  className={`${mpesaEnabled ? 'mt-3' : ''} w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50`}
                >
                  {paystackMutation.isPending ? 'Redirecting to Paystack...' : 'Pay with card or other methods'}
                </button>
              ) : null}

              {paystackEnabled ? (
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  This opens Paystack so customers can use card plus any supported bank transfer and mobile money methods enabled on the venue account.
                </p>
              ) : null}
            </div>
          )
        ) : null}

        {tab === 'points' ? (
          <PointsTab
            tenantId={tenantId}
            primaryColor={primaryColor}
            onRedeemSuccess={(result) => {
              if (result?.expires_at || result?.reward?.reward_type === 'free_package') {
                setCompletionState({
                  title: 'Reward redeemed',
                  description: result.message || 'Your points reward has been redeemed successfully.',
                  meta: [
                    { label: 'Reward', value: result.reward?.name || 'Points reward' },
                    { label: 'Expires', value: result.expires_at ? new Date(result.expires_at).toLocaleString() : 'Check with the venue' },
                  ],
                })
              }
            }}
          />
        ) : null}

        {tenant.contact_phone || tenant.contact_email ? (
          <div className="mt-5 rounded-2xl border border-gray-100 bg-white px-4 py-4 text-center text-sm text-gray-700">
            <p className="font-semibold text-gray-900">Need help? Contact us.</p>
            <div className="mt-2 flex flex-col gap-1">
              {tenant.contact_phone ? (
                <a href={`tel:${tenant.contact_phone}`} className="font-medium text-primary-700 hover:underline">
                  {tenant.contact_phone}
                </a>
              ) : null}
              {tenant.contact_email ? (
                <a href={`mailto:${tenant.contact_email}`} className="font-medium text-primary-700 hover:underline">
                  {tenant.contact_email}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-gray-500">
          Powered by <span className="font-medium text-gray-700">FlowFi</span>
        </p>
      </div>
    </div>
  )
}

function PointsTab({ tenantId, primaryColor, onRedeemSuccess }) {
  const [phone, setPhone] = useState('')
  const [checked, setChecked] = useState(false)

  const balanceQuery = useQuery({
    queryKey: ['loyalty-balance', tenantId, phone],
    queryFn: () => api.get(`/loyalty/balance/${tenantId}/${phone}`).then((response) => response.data),
    enabled: false,
  })

  const { data: rewards } = useQuery({
    queryKey: ['loyalty-rewards-public', tenantId],
    queryFn: () => api.get(`/loyalty/rewards/${tenantId}`).then((response) => response.data),
  })

  const redeemMutation = useMutation({
    mutationFn: (rewardId) =>
      api
        .post('/loyalty/redeem', {
          tenant_id: tenantId,
          phone: phone.trim(),
          reward_id: rewardId,
        })
        .then((response) => response.data),
    onSuccess: (data) => {
      toast.success(data.message || 'Reward redeemed')
      balanceQuery.refetch()
      onRedeemSuccess?.(data)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not redeem reward')
    },
  })

  function checkBalance() {
    if (!phone.trim()) {
      toast.error('Enter your phone number')
      return
    }

    setChecked(true)
    balanceQuery.refetch()
  }

  const balance = balanceQuery.data || { total_points: 0, lifetime_points: 0 }

  return (
    <div className="card p-5">
      <h2 className="mb-2 text-sm font-semibold text-gray-900">Check and redeem your loyalty points</h2>
      <p className="mb-4 text-xs text-gray-500">
        Use the same phone number you used when buying packages. After checking your balance, you can redeem available rewards right here.
      </p>

      <div className="mb-5 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Your phone number"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          type="tel"
        />
        <button type="button" onClick={checkBalance} className="btn-primary shrink-0" style={{ background: primaryColor }}>
          Check
        </button>
      </div>

      {checked ? (
        <div className="mb-5 rounded-2xl bg-gray-50 p-4">
          {balanceQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              Checking your points...
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500">Your FlowFi points</p>
                <p className="font-display text-3xl font-bold" style={{ color: primaryColor }}>
                  {balance.total_points}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Lifetime earned</p>
                <p className="text-lg font-semibold text-gray-700">{balance.lifetime_points}</p>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {(rewards || []).length > 0 ? (
        <>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Available rewards</p>
          <div className="space-y-3">
            {rewards.map((reward) => {
              const canRedeem = checked && balance.total_points >= reward.points_required
              const redeemingThisReward = redeemMutation.isPending && redeemMutation.variables === reward.id

              return (
                <div key={reward.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white">
                      <Sparkles size={16} style={{ color: primaryColor }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900">{reward.name}</p>
                        <span className="text-xs font-medium" style={{ color: primaryColor }}>
                          {reward.points_required} pts
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">
                        {reward.description || 'Redeem this reward from the portal once you have enough points.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => redeemMutation.mutate(reward.id)}
                        disabled={!canRedeem || redeemMutation.isPending}
                        className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ background: primaryColor }}
                      >
                        {redeemingThisReward ? 'Redeeming...' : canRedeem ? 'Redeem here' : checked ? 'Not enough points yet' : 'Check balance first'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
          No rewards are available for this venue yet.
        </div>
      )}
    </div>
  )
}
