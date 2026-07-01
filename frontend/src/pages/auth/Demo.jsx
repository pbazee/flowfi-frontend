import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Wifi } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

const DEMO_EMAIL = 'demo@flowfi.app'
const DEMO_PASSWORD = 'flowfi_demo_2024'

export default function Demo() {
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function signInDemo() {
      try {
        const data = await login(DEMO_EMAIL, DEMO_PASSWORD)
        if (cancelled) return
        navigate(data.user.role === 'super_admin' ? '/admin' : '/tenant', { replace: true })
      } catch (err) {
        if (cancelled) return
        console.error('[Demo] auto-login failed:', err)
        setError(err.response?.data?.error || 'Demo is temporarily unavailable. Please try again later.')
      }
    }

    signInDemo()

    return () => {
      cancelled = true
    }
  }, [login, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600">
        <Wifi size={22} className="text-white" />
      </div>

      {error ? (
        <div className="w-full max-w-sm rounded-[28px] border border-red-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-gray-900">Oops, something went wrong</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{error}</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 size={28} className="animate-spin text-primary-600" />
          <p className="text-base font-semibold text-gray-900">Loading demo workspace…</p>
          <p className="text-sm text-gray-500">Signing you in automatically — just a moment.</p>
        </div>
      )}
    </div>
  )
}
