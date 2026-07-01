import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
import { Plus, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PackagesPage() {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', session.user.id)
    .single()

  const { data: packages } = profile?.tenant_id
    ? await supabase
        .from('packages')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('sort_order', { ascending: true })
    : { data: [] }

  const rows = packages ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Packages</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} active plans</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          New Package
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((pkg: any) => (
          <div
            key={pkg.id}
            className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <span
                className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${
                  pkg.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {pkg.status}
              </span>
            </div>
            <h3 className="font-semibold text-foreground">{pkg.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>
            <div className="mt-4 border-t border-border pt-4 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-semibold text-foreground">
                  KES {Number(pkg.price).toLocaleString()}/mo
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Speed</span>
                <span className="font-medium text-foreground">{pkg.speed_limit ?? '—'}</span>
              </div>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No packages yet. Create your first plan.</p>
          </div>
        )}
      </div>
    </div>
  )
}
