import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, LockKeyhole, Wifi } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = String(searchParams.get('token') || '').trim()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    if (!token) {
      toast.error('Reset token is missing')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { data } = await api.post('/auth/reset-password', {
        token,
        password,
      })
      setSuccess(true)
      setPassword('')
      setConfirmPassword('')
      toast.success(data.message || 'Password reset successfully')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not reset password')
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
          <h1 className="text-2xl font-bold font-display text-gray-900">Reset password</h1>
          <p className="mt-1 text-sm text-gray-700">Choose a new password for your FlowFi account.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-7">
          {!token ? (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              This reset link is missing its token. Request a new password reset email.
            </div>
          ) : null}

          <div className="mb-4">
            <label className="label">New password</label>
            <div className="relative">
              <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="label">Confirm password</label>
            <div className="relative">
              <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading || !token} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Reset password
          </button>

          <div className="mt-5 text-center text-sm text-gray-700">
            {success ? <p>Your password has been updated. You can sign in now.</p> : null}
            <p className={success ? 'mt-3' : ''}>
              <Link to={success ? '/login' : '/forgot-password'} className="font-medium text-primary-600 hover:underline">
                {success ? 'Go to sign in' : 'Request a new reset link'}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
