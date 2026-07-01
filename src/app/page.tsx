import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

export default async function Home() {
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

  if (session) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-[#0a0f1e] text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-24 px-6 py-10 lg:px-8">
        <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#0a0f1e]/95 px-4 py-4 backdrop-blur md:px-6">
          <div className="text-xl font-semibold tracking-tight text-white">FlowFi</div>
          <div className="hidden items-center gap-10 text-sm text-slate-300 md:flex">
            <a href="/demo" className="hover:text-white">Demo</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </div>
          <a
            href="/register"
            className="rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
          >
            Get Started
          </a>
        </nav>

        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-2xl space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-cyan-300 ring-1 ring-white/10">
              Built for local ISPs and growing WiFi providers
            </div>
            <div className="space-y-6">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Automate Your WiFi Billing. Grow Your ISP.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-300">
                FlowFi helps local Internet providers manage customers, collect payments, and control Mikrotik routers — all from one dashboard.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-col gap-4 sm:flex-row">
                <a
                  href="/register"
                  className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
                >
                  Start for Free
                </a>
                <a
                  href="/shop"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-200"
                >
                  Visit Shop
                </a>
              </div>
              <a
                href="/demo"
                className="text-sm text-slate-400 transition hover:text-slate-200"
              >
                View Live Demo →
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Instant automation</p>
                <p className="mt-3 text-xl font-semibold text-white">Onboard customers in minutes</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Secure billing</p>
                <p className="mt-3 text-xl font-semibold text-white">Payments in KES and USD</p>
              </div>
            </div>
          </div>

          <div id="demo" className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-cyan-500/20 via-slate-800/0 to-slate-950 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-2xl shadow-black/40">
              <div className="mb-6 flex items-center justify-between rounded-3xl bg-slate-900/90 p-4 text-sm text-slate-300">
                <span>FlowFi Dashboard</span>
                <span className="rounded-full bg-white/5 px-3 py-1">Live</span>
              </div>
              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-3xl bg-slate-900/80 px-4 py-5">
                  <div>
                    <p className="text-sm text-slate-400">Monthly Revenue</p>
                    <p className="mt-2 text-3xl font-semibold text-white">KES 1.4M</p>
                  </div>
                  <div className="rounded-2xl bg-cyan-500/10 px-3 py-2 text-cyan-300">+18%</div>
                </div>
                <div className="grid gap-4 rounded-3xl border border-white/5 bg-slate-900/80 p-4 sm:grid-cols-2">
                  <div className="space-y-3 rounded-3xl border border-white/5 bg-slate-950/90 p-4">
                    <p className="text-sm text-slate-400">Active Customers</p>
                    <p className="text-xl font-semibold text-white">268</p>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-4/5 rounded-full bg-cyan-500" />
                    </div>
                  </div>
                  <div className="space-y-3 rounded-3xl border border-white/5 bg-slate-950/90 p-4">
                    <p className="text-sm text-slate-400">Routers Online</p>
                    <p className="text-xl font-semibold text-white">12</p>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-3/4 rounded-full bg-sky-400" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-3xl bg-slate-900/80 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>Recent Payment</span>
                      <span className="text-cyan-300">KES 32,000</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-3/4 rounded-full bg-cyan-500" />
                    </div>
                  </div>
                  <div className="rounded-3xl bg-slate-900/80 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>Router Health</span>
                      <span className="text-emerald-300">99.8%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 text-center shadow-2xl shadow-black/20">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Trusted by growing ISPs across Africa</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {['BirdNet', 'SwiftNet', 'Nakuru ISP', 'MarulaLink', 'Kijani Connect'].map((name) => (
              <span key={name} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                {name}
              </span>
            ))}
          </div>
        </section>

        <section id="features" className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Everything You Need to Run Your ISP</p>
            <h2 className="text-3xl font-semibold text-white">Everything You Need to Run Your ISP</h2>
            <p className="max-w-xl text-slate-400">
              A unified platform for billing, customer management, router control, and payment automation — built for service providers who want to scale.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: 'Hotspot Management', desc: 'Create and manage captive portals with ease.', icon: '📡' },
              { title: 'PPPoE Integration', desc: 'Connect Mikrotik PPPoE users and manage sessions.', icon: '🔗' },
              { title: 'Automated Billing', desc: 'Recurring invoicing and payment reminders.', icon: '💳' },
              { title: 'Remote Mikrotik Control', desc: 'Start, suspend, and monitor routers remotely.', icon: '🖥️' },
              { title: 'Package Management', desc: 'Create plans with speed and pricing rules.', icon: '📦' },
              { title: 'Customer Portal', desc: 'Give users a self-service interface for payments.', icon: '👤' },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-white/10 bg-slate-900/90 p-6"
              >
                <div className="text-2xl">{feature.icon}</div>
                <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Real-Time Insights for Smarter Decisions</p>
            <h2 className="text-3xl font-semibold text-white">Real-Time Insights for Smarter Decisions</h2>
            <div className="space-y-4 text-slate-400">
              <p>• Real-Time Revenue Tracking</p>
              <p>• Automated Payment Collection</p>
              <p>• Bandwidth Monitoring</p>
            </div>
          </div>
          <div className="space-y-4 rounded-[2rem] border border-white/10 bg-slate-900/90 p-8">
            <div className="flex items-center justify-between rounded-3xl bg-slate-950/80 p-5">
              <div>
                <p className="text-sm text-slate-400">Total Revenue</p>
                <p className="mt-2 text-3xl font-semibold text-white">KES 1.2M</p>
              </div>
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">+12% MoM</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-5">
                <p className="text-sm text-slate-400">Active Customers</p>
                <p className="mt-3 text-2xl font-semibold text-white">360</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-5">
                <p className="text-sm text-slate-400">Payments Today</p>
                <p className="mt-3 text-2xl font-semibold text-white">124</p>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-5">
              <p className="text-sm text-slate-400">Bandwidth Use</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-4/5 rounded-full bg-cyan-500" />
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="space-y-8">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Simple, Transparent Pricing</p>
            <h2 className="mt-4 text-3xl font-semibold text-white">Simple, Transparent Pricing</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              {
                plan: 'Hotspot Plan',
                price: '3% of hotspot revenue',
                features: ['Unlimited Mikrotiks', 'No user limit', 'Voucher Management', 'Multiple payment gateways'],
              },
              {
                plan: 'PPPoE Plan',
                price: 'KES 30/user/month',
                features: ['Unlimited users', 'Automated invoicing', 'Real-time notifications', 'No revenue cap'],
              },
            ].map((plan) => (
              <div
                key={plan.plan}
                className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-8"
              >
                <p className="text-sm text-slate-400">{plan.plan}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{plan.price}</p>
                <ul className="mt-6 space-y-3 text-slate-400">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <a
                  href="/register"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Get Started Free
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">What ISPs Are Saying</p>
            <h2 className="mt-4 text-3xl font-semibold text-white">What ISPs Are Saying</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              {
                quote: 'FlowFi helped us automate billing and reduce manual work by 80%. Our customers love the self-service portal.',
                name: 'Frank',
                company: 'Wattex',
              },
              {
                quote: 'We launched faster than expected and now manage all Mikrotik routers from one place.',
                name: 'Mary',
                company: 'SwiftNet Kenya',
              },
            ].map((testimonial) => (
              <div key={testimonial.name} className="rounded-[2rem] border border-white/10 bg-slate-900/90 p-8">
                <p className="text-lg text-slate-100">“{testimonial.quote}”</p>
                <div className="mt-6 text-sm text-slate-400">
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p>{testimonial.company}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="space-y-8 rounded-[2rem] border border-white/10 bg-slate-950/90 p-8">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">FAQ</p>
            <h2 className="mt-4 text-3xl font-semibold text-white">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {[
              {
                question: 'Is there a free trial?',
                answer: 'Yes, you can start with a free onboarding plan and upgrade as your ISP grows.',
              },
              {
                question: 'Do you support Mikrotik devices?',
                answer: 'Absolutely. FlowFi integrates with Mikrotik routers for PPPoE, hotspot, and remote control.',
              },
              {
                question: 'Which payment methods are supported?',
                answer: 'M-Pesa, Paystack, and other local integrations can be configured for automated collection.',
              },
              {
                question: 'Can I manage multiple locations?',
                answer: 'Yes. Manage multiple router sites, packages, and customer segments from one account.',
              },
              {
                question: 'Do you support captive portals?',
                answer: 'Yes. Hotspot and captive portal flows are built for local ISPs and shared WiFi networks.',
              },
            ].map((item) => (
              <details
                key={item.question}
                className="group rounded-3xl border border-white/10 bg-slate-900/80 p-5"
              >
                <summary className="cursor-pointer text-lg font-semibold text-white">
                  {item.question}
                </summary>
                <p className="mt-3 text-slate-400">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-8 text-slate-400">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xl font-semibold text-white">FlowFi</p>
              <p className="mt-2 text-sm">© 2026 FlowFi. All rights reserved.</p>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-sm text-slate-300">
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#pricing" className="hover:text-white">Pricing</a>
              <a href="#faq" className="hover:text-white">FAQ</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
