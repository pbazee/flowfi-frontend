import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const DEMO_EMAIL = 'demo@flowfi.app'
const DEMO_PASSWORD = 'flowfi_demo_2024'
const DEMO_TENANT_NAME = 'FlowFi Demo ISP'

export async function seedDemoData(): Promise<{ success: boolean; message: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ─── 1. Create or reuse demo auth user ─────────────────────
  let demoUserId: string

  const { data: listData } = await supabase.auth.admin.listUsers()
  const existing = listData?.users?.find((u) => u.email === DEMO_EMAIL)

  if (existing) {
    demoUserId = existing.id
    // Update password in case it changed
    await supabase.auth.admin.updateUserById(demoUserId, { password: DEMO_PASSWORD })
  } else {
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (createErr || !newUser?.user) {
      throw new Error(`Failed to create demo user: ${createErr?.message}`)
    }
    demoUserId = newUser.user.id
  }

  // ─── 2. Create or reuse demo tenant ────────────────────────
  let tenantId: string

  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('name', DEMO_TENANT_NAME)
    .single()

  if (existingTenant) {
    tenantId = existingTenant.id
  } else {
    const { data: newTenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name: DEMO_TENANT_NAME,
        business_type: 'isp',
        status: 'active',
        contact_email: DEMO_EMAIL,
        contact_phone: '+254700000000',
        address: 'Nairobi, Kenya',
      })
      .select('id')
      .single()

    if (tenantErr || !newTenant) {
      throw new Error(`Failed to create demo tenant: ${tenantErr?.message}`)
    }
    tenantId = newTenant.id
  }

  // ─── 3. Upsert profile with tenant_id ──────────────────────
  await supabase.from('profiles').upsert({
    id: demoUserId,
    role: 'tenant_admin',
    full_name: 'Demo User',
    email: DEMO_EMAIL,
    tenant_id: tenantId,
  })

  // ─── 3b. Upsert users row for Express backend login ────────
  // The Express /api/auth/login route queries the `users` table,
  // not auth.users or profiles. Without this row the demo login
  // fails with 401 "Invalid credentials".
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)

  const { data: existingUserRow } = await supabase
    .from('users')
    .select('id')
    .ilike('email', DEMO_EMAIL)
    .maybeSingle()

  if (existingUserRow) {
    await supabase
      .from('users')
      .update({ password_hash: passwordHash, status: 'active', tenant_id: tenantId })
      .eq('id', existingUserRow.id)
  } else {
    await supabase.from('users').insert({
      email: DEMO_EMAIL,
      password_hash: passwordHash,
      name: 'Demo User',
      role: 'tenant_admin',
      status: 'active',
      tenant_id: tenantId,
    })
  }

  // ─── 4. Wipe existing demo data for this tenant ────────────
  await supabase.from('demo_customers').delete().eq('tenant_id', tenantId)
  await supabase.from('transactions').delete().eq('tenant_id', tenantId)
  await supabase.from('packages').delete().eq('tenant_id', tenantId)
  await supabase.from('routers').delete().eq('tenant_id', tenantId)

  // ─── 5. Seed Packages ───────────────────────────────────────
  const { data: insertedPackages, error: pkgErr } = await supabase
    .from('packages')
    .insert([
      {
        tenant_id: tenantId,
        name: 'Basic Hotspot',
        description: 'Entry-level hotspot access for casual users',
        price: 500,
        duration_minutes: 43200, // 30 days
        speed_limit: '5M/5M',
        status: 'active',
        sort_order: 1,
      },
      {
        tenant_id: tenantId,
        name: 'Standard Home',
        description: 'Home broadband with reliable speeds',
        price: 1200,
        duration_minutes: 43200,
        speed_limit: '15M/15M',
        status: 'active',
        sort_order: 2,
      },
      {
        tenant_id: tenantId,
        name: 'Business PPPoE',
        description: 'High-speed business connection with SLA',
        price: 3500,
        duration_minutes: 43200,
        speed_limit: '50M/50M',
        status: 'active',
        sort_order: 3,
      },
      {
        tenant_id: tenantId,
        name: 'Premium Fiber',
        description: 'Ultra-fast fiber for power users',
        price: 6000,
        duration_minutes: 43200,
        speed_limit: '100M/100M',
        status: 'active',
        sort_order: 4,
      },
    ])
    .select('id, name, price')

  if (pkgErr || !insertedPackages) {
    throw new Error(`Failed to seed packages: ${pkgErr?.message}`)
  }

  const [pkgBasic, pkgStandard, pkgBusiness, pkgPremium] = insertedPackages

  // ─── 6. Seed Routers ────────────────────────────────────────
  await supabase.from('routers').insert([
    {
      tenant_id: tenantId,
      name: 'Mikrotik RB750Gr3',
      ip_address: '192.168.1.1',
      port: 8728,
      api_username: 'admin',
      api_password: 'demo_password',
      location: 'Westlands',
      identity: 'RB750Gr3-Westlands',
      status: 'online',
      last_seen: new Date().toISOString(),
    },
    {
      tenant_id: tenantId,
      name: 'Mikrotik hAP ac²',
      ip_address: '192.168.2.1',
      port: 8728,
      api_username: 'admin',
      api_password: 'demo_password',
      location: 'Kasarani',
      identity: 'hAP-ac2-Kasarani',
      status: 'online',
      last_seen: new Date().toISOString(),
    },
    {
      tenant_id: tenantId,
      name: 'Mikrotik CCR1009',
      ip_address: '192.168.3.1',
      port: 8728,
      api_username: 'admin',
      api_password: 'demo_password',
      location: 'Thika Road',
      identity: 'CCR1009-ThikaRd',
      status: 'offline',
      last_seen: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ])

  // ─── 7. Seed Customers ───────────────────────────────────────
  const customerDefs = [
    { name: 'Alice Wanjiru',  phone: '+254711000001', email: 'alice@demo.com',  pkg: pkgStandard,  status: 'active',    joinDaysAgo: 90 },
    { name: 'Brian Omondi',   phone: '+254711000002', email: 'brian@demo.com',  pkg: pkgBasic,     status: 'active',    joinDaysAgo: 75 },
    { name: 'Carol Njeri',    phone: '+254711000003', email: 'carol@demo.com',  pkg: pkgPremium,   status: 'active',    joinDaysAgo: 60 },
    { name: 'David Mwangi',   phone: '+254711000004', email: 'david@demo.com',  pkg: pkgBusiness,  status: 'active',    joinDaysAgo: 55 },
    { name: 'Esther Akinyi',  phone: '+254711000005', email: 'esther@demo.com', pkg: pkgStandard,  status: 'suspended', joinDaysAgo: 50 },
    { name: 'Felix Kamau',    phone: '+254711000006', email: 'felix@demo.com',  pkg: pkgBasic,     status: 'active',    joinDaysAgo: 45 },
    { name: 'Grace Otieno',   phone: '+254711000007', email: 'grace@demo.com',  pkg: pkgPremium,   status: 'active',    joinDaysAgo: 40 },
    { name: 'Hassan Mwenda',  phone: '+254711000008', email: 'hassan@demo.com', pkg: pkgBusiness,  status: 'expired',   joinDaysAgo: 35 },
    { name: 'Irene Wambui',   phone: '+254711000009', email: 'irene@demo.com',  pkg: pkgStandard,  status: 'active',    joinDaysAgo: 20 },
    { name: 'James Kariuki',  phone: '+254711000010', email: 'james@demo.com',  pkg: pkgBasic,     status: 'active',    joinDaysAgo: 10 },
  ]

  const customerRows = customerDefs.map((c) => {
    const joinDate = new Date(Date.now() - c.joinDaysAgo * 86400000)
    const nextBilling = new Date(joinDate)
    nextBilling.setDate(nextBilling.getDate() + 30)
    return {
      tenant_id: tenantId,
      name: c.name,
      phone: c.phone,
      email: c.email,
      package_id: c.pkg.id,
      status: c.status,
      join_date: joinDate.toISOString().split('T')[0],
      next_billing_date: nextBilling.toISOString().split('T')[0],
    }
  })

  const { data: insertedCustomers } = await supabase
    .from('demo_customers')
    .insert(customerRows)
    .select('id, name, phone, package_id')

  // ─── 8. Seed Payments (Transactions) ────────────────────────
  const methods = ['mpesa', 'mpesa', 'mpesa', 'bank', 'bank']
  const statuses = ['success', 'success', 'success', 'pending', 'failed']

  const paymentRows = []
  const now = Date.now()

  const customers = insertedCustomers ?? customerRows.map((c, i) => ({ ...c, id: `demo-${i}` }))
  const allPackages = [pkgBasic, pkgStandard, pkgBusiness, pkgPremium]

  for (let i = 0; i < 20; i++) {
    const customer = customers[i % customers.length]
    const pkg = allPackages[i % allPackages.length]
    const daysAgo = Math.floor(Math.random() * 90) // last 3 months
    const createdAt = new Date(now - daysAgo * 86400000)
    const method = methods[i % methods.length]
    const status = statuses[i % statuses.length]

    paymentRows.push({
      reference: `DEMO-${Date.now()}-${i}`,
      tenant_id: tenantId,
      package_id: pkg.id,
      phone: customer.phone ?? '+254711000000',
      customer_email: customer.email ?? DEMO_EMAIL,
      amount: pkg.price,
      payment_method: method,
      status: status === 'success' ? 'success' : status,
      mpesa_receipt: method === 'mpesa' && status === 'success' ? `QKA${Math.random().toString(36).substring(2, 9).toUpperCase()}` : null,
      paid_at: status === 'success' ? createdAt.toISOString() : null,
      created_at: createdAt.toISOString(),
    })
  }

  await supabase.from('transactions').insert(paymentRows)

  // ─── 9. Update demo_meta ─────────────────────────────────────
  const { data: existingMeta } = await supabase
    .from('demo_meta')
    .select('id')
    .limit(1)
    .single()

  if (existingMeta) {
    await supabase
      .from('demo_meta')
      .update({ last_reset_at: new Date().toISOString(), reset_by: 'seed-script' })
      .eq('id', existingMeta.id)
  } else {
    await supabase
      .from('demo_meta')
      .insert({ last_reset_at: new Date().toISOString(), reset_by: 'seed-script' })
  }

  return { success: true, message: `Demo data seeded successfully for tenant ${tenantId}` }
}
