import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { TopBar } from '@/components/dashboard/TopBar'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          cookies().getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          })),
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const isDemo = session.user.email === 'demo@flowfi.app'

  // Fetch profile for TopBar
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', session.user.id)
    .single()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Demo Banner */}
      {isDemo && (
        <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-3 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-sm backdrop-blur">
          <span className="text-amber-300">
            🎮 You're viewing the FlowFi demo. Data resets when an admin triggers it.
          </span>
          <a
            href="/register"
            className="font-semibold text-amber-400 underline underline-offset-2 hover:text-amber-300 transition-colors"
          >
            Create a free account →
          </a>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar tenantName={isDemo ? 'Demo Workspace' : undefined} />

      {/* Main content area */}
      <div className={`flex flex-col ${isDemo ? 'pt-10' : ''} md:pl-64`}>
        <TopBar profile={profile ? { full_name: profile.full_name, role: profile.role } : undefined} />
        <main className="flex-1 px-4 py-6 pt-20 md:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
