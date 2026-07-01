import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { seedDemoData } from '@/lib/seedDemoData'

export async function POST(req: Request) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookies().getAll().map((c) => ({ name: c.name, value: c.value })),
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await seedDemoData()

    // Update demo meta inside seedDemoData already handles the reset timestamp.
    // However, if we wanted to specifically log the superadmin email:
    const supabaseService = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => [],
        },
      }
    )

    const { data: existingMeta } = await supabaseService
      .from('demo_meta')
      .select('id')
      .limit(1)
      .single()

    if (existingMeta) {
      await supabaseService
        .from('demo_meta')
        .update({
          last_reset_at: new Date().toISOString(),
          reset_by: session.user.email,
        })
        .eq('id', existingMeta.id)
    }

    return NextResponse.json({ success: true, reset_at: new Date().toISOString() })

  } catch (error: any) {
    console.error('Reset demo error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
