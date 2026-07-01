import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Analytics and insights</p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <h2 className="text-lg font-semibold text-foreground">Reporting module coming soon</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Detailed financial reports, bandwidth usage, and customer retention metrics will be available here.
        </p>
      </div>
    </div>
  )
}
