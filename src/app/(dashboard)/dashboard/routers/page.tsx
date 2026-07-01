import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
import { Plus, Router as RouterIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RoutersPage() {
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

  const { data: routers } = profile?.tenant_id
    ? await supabase
        .from('routers')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false })
    : { data: [] }

  const rows = routers ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Routers</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} devices connected</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Add Router
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Location</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">IP Address</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Identity</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No routers configured
                  </td>
                </tr>
              ) : (
                rows.map((router: any) => (
                  <tr key={router.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded p-2 bg-primary/10">
                          <RouterIcon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{router.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{router.location ?? '—'}</td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{router.ip_address}</td>
                    <td className="px-6 py-4 text-muted-foreground">{router.identity ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            router.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="capitalize">{router.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {router.last_seen ? new Date(router.last_seen).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
