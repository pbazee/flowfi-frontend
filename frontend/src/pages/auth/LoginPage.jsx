import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Wifi, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/auth'

export default function LoginPage() {
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)

    try {
      const data = await login(email, password)
      toast.success(`Welcome back, ${data.user.name}!`)

      const redirectTo = searchParams.get('redirect')
      if (redirectTo && redirectTo.startsWith('/')) {
        navigate(redirectTo)
      } else {
        navigate(data.user.role === 'super_admin' ? '/admin' : '/tenant')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600">
            <Wifi size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold font-display text-gray-900">FlowFi</h1>
          <p className="mt-1 text-sm text-gray-700">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-7">
          <div className="mb-4">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="mb-6">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <div className="mt-2 flex justify-end">
              <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Sign in
          </button>

          <p className="mt-5 text-center text-sm text-gray-700">
            No account? <Link to="/register" className="text-primary-600 font-medium hover:underline">Register your venue</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
