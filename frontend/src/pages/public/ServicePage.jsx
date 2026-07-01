import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Headphones, ScanSearch, Sparkles, Wrench } from 'lucide-react'
import PublicShell from '@/components/public/PublicShell'
import ReviewSection from '@/components/public/ReviewSection'
import { usePlatformContent } from '@/hooks/usePlatformContent'

const serviceIconMap = {
  installation: Wrench,
  consulting: ScanSearch,
  support: Headphones,
}

export default function ServicePage() {
  const { serviceId } = useParams()
  const { data: content } = usePlatformContent()
  const service = (content?.services || []).find((entry) => entry.id === serviceId)
  const whatsapp = String(content?.contact?.whatsapp || '').replace(/[^\d]/g, '')
  const Icon = service ? serviceIconMap[service.category] || Sparkles : Sparkles

  if (!service) {
    return (
      <PublicShell>
        <section className="mx-auto max-w-5xl px-6 py-20">
          <div className="rounded-[32px] border border-gray-100 bg-white p-10 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Service not found</p>
            <h1 className="mt-4 text-4xl font-bold text-gray-900">That service is no longer available.</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-900">
              Return to the landing page to browse the current service catalog or contact FlowFi directly.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/#services" className="btn-primary">Back to services</Link>
              <Link to="/contact" className="btn-outline">Contact FlowFi</Link>
            </div>
          </div>
        </section>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16">
        <Link to="/#services" className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 transition-colors hover:text-gray-900">
          <ArrowLeft size={16} />
          Back to services
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[32px] bg-[radial-gradient(circle_at_top,#e1f5ee,white_55%)] p-8 shadow-sm ring-1 ring-gray-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white">
              <Icon size={24} />
            </div>
            <p className="mt-6 text-xs font-medium uppercase tracking-[0.22em] text-primary-700">{service.category}</p>
            <h1 className="mt-4 text-4xl font-bold text-gray-900 md:text-5xl">{service.name}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-900">{service.description}</p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-100">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Starting at</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{service.startingPrice || 'Custom quote'}</p>
              </div>
              <div className="rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-100">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Turnaround</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{service.turnaround || 'To be agreed'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900">What this service includes</h2>
              <p className="mt-4 whitespace-pre-line text-base leading-8 text-gray-900">
                {service.longDescription || service.description}
              </p>
            </div>

            <div className="rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900">How teams usually engage FlowFi</h2>
              <div className="mt-5 space-y-4">
                {[
                  'Share your venue details and rollout goals with the FlowFi team.',
                  'Align on scope, timeline, and the best-fit combination of software, hardware, and support.',
                  'Move into implementation with a clearer operational handoff and customer journey.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary-600" />
                    <p className="text-sm leading-relaxed text-gray-900">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-[32px] bg-primary-600 px-8 py-10 text-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-100">Next step</p>
              <h2 className="mt-3 text-3xl font-bold">Talk to FlowFi about this service</h2>
              <p className="mt-3 text-base leading-relaxed text-primary-100">
                Reach out for a tailored quote, hardware advice, or rollout guidance for your venue.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/contact" className="rounded-xl bg-white px-5 py-3 font-semibold text-primary-800 shadow-sm transition-colors hover:bg-primary-50">
                Request service
              </Link>
              <Link to="/shop" className="rounded-xl border border-white/40 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10">
                Browse shop
              </Link>
              {whatsapp ? (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/40 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Chat on WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <ReviewSection
          scope="service"
          targetId={service.id}
          targetLabel={service.name}
          heading={`Customer reviews for ${service.name}`}
          intro="See what customers have said about this service and add your own review after delivery or rollout."
          emptyTitle="No service reviews yet"
          emptyDescription="Once customers share rollout feedback for this service, it will appear here."
          submitTitle="Write a service review"
        />
      </section>
    </PublicShell>
  )
}
