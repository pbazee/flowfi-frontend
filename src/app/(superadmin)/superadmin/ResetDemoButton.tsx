'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'

export function ResetDemoButton() {
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    if (!window.confirm('This will delete all current demo data and re-seed fresh data. Are you sure?')) {
      return
    }

    setLoading(true)
    const tId = toast.loading('Resetting demo data...')

    try {
      const res = await fetch('/api/superadmin/reset-demo', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset demo data')
      }

      toast.success('Demo data has been reset successfully', { id: tId })
      // Optionally refresh the page to show new timestamp
      window.location.reload()
    } catch (error: any) {
      toast.error(error.message, { id: tId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Resetting...' : 'Reset Demo Data'}
    </button>
  )
}
