import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import api from '@/lib/api'

export default function PaymentCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reference = searchParams.get('reference') || searchParams.get('trxref')
  const flow = searchParams.get('flow') || 'payment'
  const tenantId = searchParams.get('tenantId')

  const verificationQuery = useQuery({
    queryKey: ['paystack-callback', reference],
    enabled: Boolean(reference),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data
      if (query.state.error) return false
      if (data?.verified) return false
      if (data?.status && data.status !== 'pending') return false
      return 2500
    },
    queryFn: () => api.get(`/payments/paystack/verify/${reference}`).then((response) => response.data),
  })

  const resolvedFlow = verificationQuery.data?.flow || flow
  const resolvedTenantId = verificationQuery.data?.transaction?.tenant_id || tenantId

  useEffect(() => {
    if (!verificationQuery.data?.verified) return

    const timer = window.setTimeout(() => {
      if (resolvedFlow === 'workspace') {
        navigate(`/login?payment=success&reference=${reference}`, { replace: true })
        return
      }

      if (resolvedFlow === 'shop') {
        navigate(`/shop/order-confirmed?ref=${reference}`, { replace: true })
        return
      }

      if (resolvedFlow === 'wifi' && resolvedTenantId) {
        navigate(`/portal/${resolvedTenantId}?reference=${reference}&payment=confirmed`, { replace: true })
        return
      }

      navigate('/', { replace: true })
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [navigate, reference, resolvedFlow, resolvedTenantId, verificationQuery.data?.verified])

  function renderActions() {
    if (resolvedFlow === 'workspace') {
      return (
        <Link to="/login" className="btn-primary">
          Go to login
        </Link>
      )
    }

    if (resolvedFlow === 'shop') {
      return (
        <Link to={`/shop/track?ref=${reference}`} className="btn-primary">
          Track order
        </Link>
      )
    }

    if (resolvedTenantId) {
      return (
        <Link to={`/portal/${resolvedTenantId}`} className="btn-primary">
          Return to portal
        </Link>
      )
    }

    return (
      <Link to="/" className="btn-primary">
        Back home
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[32px] bg-white p-8 text-center shadow-sm">
          {!reference ? (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertCircle size={30} />
              </div>
              <h1 className="mt-5 text-3xl font-bold text-gray-900">Payment reference missing</h1>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                We couldn&apos;t find a Paystack reference in this callback URL.
              </p>
              <div className="mt-6">
                <Link to="/" className="btn-primary">
                  Back home
                </Link>
              </div>
            </>
          ) : verificationQuery.isLoading ? (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <Loader2 size={30} className="animate-spin" />
              </div>
              <h1 className="mt-5 text-3xl font-bold text-gray-900">Verifying payment</h1>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                We&apos;re confirming your Paystack payment and updating the FlowFi platform now.
              </p>
            </>
          ) : verificationQuery.isError || !verificationQuery.data?.verified ? (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertCircle size={30} />
              </div>
              <h1 className="mt-5 text-3xl font-bold text-gray-900">Payment not confirmed yet</h1>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                The payment for reference <strong>{reference}</strong> is still pending or could not be verified.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button onClick={() => verificationQuery.refetch()} className="btn-primary">
                  Check again
                </button>
                {renderActions()}
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <Loader2 size={30} className="animate-spin" />
              </div>
              <h1 className="mt-5 text-3xl font-bold text-gray-900">Payment confirmed</h1>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                Reference <strong>{reference}</strong> has been verified successfully. Redirecting you now.
              </p>
              <div className="mt-6 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {resolvedFlow === 'workspace' && 'Your workspace is activated. Sign in to finish setup.'}
                {resolvedFlow === 'shop' && 'Your shop order is now marked as paid. We are opening your confirmation page now.'}
                {resolvedFlow === 'wifi' && 'Your WiFi access has been activated. Return to the captive portal to continue.'}
                {!['workspace', 'shop', 'wifi'].includes(resolvedFlow) && 'Your payment has been processed successfully.'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
