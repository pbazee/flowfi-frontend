import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Mail, Wifi } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)

    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setSent(true)
      toast.success(data.message || 'Reset link sent if your account exists')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not send reset link')
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
          <h1 className="text-2xl font-bold font-display text-gray-900">Forgot password</h1>
          <p className="mt-1 text-sm text-gray-700">Enter your email and we’ll send you a reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-7">
          <div className="mb-6">
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Send reset link
          </button>

          <div className="mt-5 text-center text-sm text-gray-700">
            {sent ? (
              <p>Check your inbox for the reset email. The link expires in 1 hour.</p>
            ) : null}
            <p className={sent ? 'mt-3' : ''}>
              Remembered it? <Link to="/login" className="font-medium text-primary-600 hover:underline">Back to sign in</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
