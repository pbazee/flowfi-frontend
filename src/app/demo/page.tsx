'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const DEMO_EMAIL = 'demo@flowfi.app'
const DEMO_PASSWORD = 'flowfi_demo_2024'

export default function DemoPage() {
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    const loginDemo = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Sign out any existing session first
      await supabase.auth.signOut()

      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      })

      if (error) {
        console.error('Demo login failed:', error.message)
        setError(true)
      } else {
        router.push('/dashboard')
      }
    }

    loginDemo()
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1e]">
        <div className="max-w-md text-center space-y-4 px-6">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold text-white">Demo Unavailable</h1>
          <p className="text-slate-400">
            Demo is temporarily unavailable. Please try again later.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-200"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1e]">
      <div className="text-center space-y-6 px-6">
        {/* Spinner */}
        <div className="mx-auto h-12 w-12 rounded-full border-4 border-slate-700 border-t-cyan-500 animate-spin" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">Loading demo workspace...</h1>
          <p className="text-sm text-slate-400">Signing you in automatically</p>
        </div>
      </div>
    </div>
  )
}
