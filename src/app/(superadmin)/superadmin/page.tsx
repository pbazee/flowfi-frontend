import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
import { ResetDemoButton } from './ResetDemoButton'

export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookies().getAll().map((c) => ({ name: c.name, value: c.value })),
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  // We must use the service role to read profiles to bypass RLS, OR rely on our RLS policies.
  // Since RLS on profiles allows users to read their own, we can use the regular client.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (profile?.role !== 'superadmin') {
    redirect('/')
  }

  // Fetch demo meta
  const { data: demoMeta } = await supabase
    .from('demo_meta')
    .select('last_reset_at, reset_by')
    .limit(1)
    .single()

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Superadmin Panel</h1>
          <p className="mt-2 text-muted-foreground">Manage platform settings and demo data.</p>
        </div>

        <section className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Demo Management</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage the Live Demo environment. Resetting will wipe all demo tenant data and re-seed it.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Demo Account</p>
              <p className="mt-1 font-mono text-sm">demo@flowfi.app</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Last Reset</p>
              <p className="mt-1 font-mono text-sm">
                {demoMeta?.last_reset_at ? new Date(demoMeta.last_reset_at).toLocaleString() : 'Never'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">By: {demoMeta?.reset_by ?? 'system'}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <ResetDemoButton />
          </div>
        </section>
      </div>
    </div>
  )
}
