import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import PublicShell from '@/components/public/PublicShell'
import { usePlatformContent } from '@/hooks/usePlatformContent'

export default function AboutPage() {
  const { data: content } = usePlatformContent()
  const about = content?.about

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16">
        <div className="grid gap-10 lg:grid-cols-[1fr,0.92fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">
              {about?.eyebrow || 'About FlowFi'}
            </p>
            <h1 className="mt-4 text-4xl font-bold text-gray-900 md:text-5xl">
              {about?.headline}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-900">
              {about?.summary}
            </p>

            <div className="mt-8 whitespace-pre-line rounded-[28px] border border-gray-100 bg-white p-8 text-sm leading-7 text-gray-900 shadow-sm">
              {about?.story}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] bg-gray-50 p-8">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-gray-400">What we value</p>
              <div className="mt-5 space-y-3">
                {(about?.values || []).map((value) => (
                  <div key={value} className="flex items-start gap-3 rounded-2xl bg-white p-4">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary-600" />
                    <p className="text-sm leading-relaxed text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-gray-100 bg-white p-8 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-gray-400">Operating focus</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {(about?.stats || []).map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{stat.label}</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 rounded-[28px] bg-primary-600 px-8 py-10 text-white">
          <h2 className="text-3xl font-bold">Build your workspace with FlowFi</h2>
          <p className="mt-3 max-w-2xl text-primary-100">
            Start with a paid workspace, connect your routers, publish packages, and run the entire guest WiFi operation from one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/register" className="rounded-xl bg-white px-5 py-3 font-semibold text-primary-800 shadow-sm transition-colors hover:bg-primary-50">
              Choose a plan
            </Link>
            <Link to="/contact" className="rounded-xl border border-white/40 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10">
              Contact FlowFi
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
