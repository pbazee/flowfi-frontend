import { Link } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Headphones,
  MonitorSmartphone,
  Router,
  ScanSearch,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react'
import PublicShell from '@/components/public/PublicShell'
import { usePlatformContent } from '@/hooks/usePlatformContent'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { getPlanDisplayFeatures } from '@/lib/workspacePlans'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const fade = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }

const serviceIconMap = {
  installation: Wrench,
  consulting: ScanSearch,
  support: Headphones,
}

const platformHighlights = [
  {
    icon: Router,
    title: 'Router operations',
    description: 'Connect MikroTik routers, monitor uptime, and manage hotspot operations from one tenant workspace.',
  },
  {
    icon: CreditCard,
    title: 'Payment collection',
    description: 'Customers pay from the captive portal using M-Pesa or Paystack without leaving the FlowFi journey.',
  },
  {
    icon: Star,
    title: 'Loyalty and retention',
    description: 'Reward repeat customers with points and redemption flows that live inside the same portal experience.',
  },
  {
    icon: BarChart3,
    title: 'Business reporting',
    description: 'Track sessions, revenue, customers, and performance trends across tenants and time periods.',
  },
  {
    icon: ShoppingBag,
    title: 'Storefront and services',
    description: 'Sell hardware and rollout support from the same public site instead of splitting the buying experience.',
  },
  {
    icon: Shield,
    title: 'Platform control',
    description: 'Give platform teams a cleaner place to manage plans, content, reviews, and shared settings.',
  },
]

function ReviewStars({ rating }) {
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} size={15} className={index < Number(rating || 0) ? 'fill-current' : ''} />
      ))}
    </div>
  )
}

export default function Landing() {
  const { data: content } = usePlatformContent()
  const [activeHowTab, setActiveHowTab] = useState('isps')
  const [openFaqIndex, setOpenFaqIndex] = useState(null)

  const { data: demoStatus } = useQuery({
    queryKey: ['demo-status'],
    queryFn: () => api.get('/platform/demo-status').then((res) => res.data),
  })

  const { data: faqs = [] } = useQuery({
    queryKey: ['public-faqs'],
    queryFn: () => api.get('/platform/faqs').then((res) => res.data),
  })

  const hero = content?.hero || {}
  const services = content?.services || []
  const blogPosts = (content?.blogPosts || []).slice(0, 3)
  const workspacePlans = content?.workspacePlans || []
  const contact = content?.contact
  const trustedVenues = content?.trustedVenues || []
  const reviews = content?.reviews || []
  const landingReviews = reviews.slice(0, 3)

  return (
    <PublicShell>
      {/* 1. Hero — headline, subtext, CTAs, demo link */}
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,#e1f5ee,white_48%)]">
        <div className="mx-auto max-w-6xl px-6 pb-12 pt-6 md:pt-8">
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
            <motion.div variants={fade} className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700 shadow-sm ring-1 ring-primary-100">
                <Wifi size={12} />
                {hero.eyebrow}
              </span>

              <h1 className="mt-4 text-3xl font-bold leading-[1.15] text-gray-900 md:text-4xl lg:text-[3.25rem] lg:leading-[1.05]">
                {hero.headline}
                <span className="block text-primary-600">{hero.highlight}</span>
              </h1>

              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
                {hero.summary}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <Link to="/register" className="btn-primary flex items-center gap-2 px-6 py-2.5 text-base shadow-lg shadow-primary-100">
                  {hero.primaryCtaLabel}
                  <ArrowRight size={16} />
                </Link>
                <Link to="/shop" className="btn-outline flex items-center gap-2 px-6 py-2.5 text-base">
                  <ShoppingBag size={16} />
                  {hero.secondaryCtaLabel}
                </Link>
              </div>

              {(!demoStatus || demoStatus.is_enabled) && (
                <div className="mt-3 text-center">
                  <Link
                    to="/demo"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-primary-600"
                  >
                    View Live Demo →
                  </Link>
                </div>
              )}

              <p className="mt-4 text-sm font-medium text-gray-600">
                {hero.helperText}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 2. Trusted by venues strip */}
      {trustedVenues.length > 0 ? (
        <section className="border-y border-gray-100 bg-gray-50 py-6">
          <div className="mx-auto max-w-6xl px-6">
            <p className="mb-5 text-center text-xs font-medium uppercase tracking-[0.24em] text-gray-500">
              Trusted by venues across Kenya
            </p>
            <div className="overflow-hidden rounded-full border border-gray-200 bg-white py-3">
              <div className="marquee-track">
                {[...trustedVenues, ...trustedVenues].map((venue, index) => (
                  <span key={`${venue}-${index}`} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm">
                    {venue}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* 3. Three highlight cards */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: 'Venue onboarding',
              value: 'One clear flow',
              note: 'Pick a plan, pay, get activated, connect routers, then send customers to your portal.',
            },
            {
              label: 'Customer payment',
              value: 'Portal-first',
              note: 'Buy WiFi and redeem loyalty rewards from the same branded entry point.',
            },
            {
              label: 'Operational support',
              value: 'Centralized',
              note: 'Combine services, hardware, reporting, and tenant controls without switching systems.',
            },
          ].map((item) => (
            <div key={item.label} className="card p-6 text-left">
              <p className="text-xs uppercase tracking-[0.22em] text-gray-500">{item.label}</p>
              <p className="mt-3 font-display text-2xl font-semibold text-gray-900">{item.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-900">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. How It Works — tabbed */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">How it works</p>
          <h2 className="mt-4 text-4xl font-bold text-gray-900">A flow that makes sense for operators and customers</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-gray-900">
            FlowFi keeps the venue setup path and the customer payment path easy to follow, so teams know exactly what happens from signup to live WiFi access.
          </p>
        </div>

        <div className="mt-10 flex justify-center gap-2">
          <button
            onClick={() => setActiveHowTab('isps')}
            className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${
              activeHowTab === 'isps'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-100'
                : 'bg-white text-gray-600 ring-1 ring-gray-100 hover:bg-primary-50 hover:text-primary-700'
            }`}
          >
            For ISPs &amp; Venues
          </button>
          <button
            onClick={() => setActiveHowTab('customers')}
            className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${
              activeHowTab === 'customers'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-100'
                : 'bg-white text-gray-600 ring-1 ring-gray-100 hover:bg-primary-50 hover:text-primary-700'
            }`}
          >
            For Customers
          </button>
        </div>

        {activeHowTab === 'isps' && (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Register your workspace',
                desc: 'Sign up, choose a plan, and your tenant workspace is created instantly.',
              },
              {
                step: '02',
                title: 'Connect your MikroTik router',
                desc: "Add your router's IP and API credentials in the Routers section. FlowFi tests the connection and confirms when it's live.",
              },
              {
                step: '03',
                title: 'Connect your payment method',
                desc: 'Add your own Paystack and/or M-Pesa credentials in Settings, so customer payments go directly into your business account.',
              },
              {
                step: '04',
                title: 'Create your packages',
                desc: "Set pricing tiers with speed and data limits matching your venue's needs.",
              },
              {
                step: '05',
                title: 'Brand and launch your captive portal',
                desc: 'Customize colors, welcome message, and logo so the WiFi login page reflects your business.',
              },
              {
                step: '06',
                title: 'Go live and track performance',
                desc: 'Customers connect and pay; monitor revenue, sessions, and activity in real time.',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">{item.step}</p>
                <h3 className="mt-3 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        )}

        {activeHowTab === 'customers' && (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                step: '01',
                title: "Connect to the venue's WiFi",
                desc: 'Customer joins the network as usual.',
              },
              {
                step: '02',
                title: 'The branded portal opens automatically',
                desc: "They see the venue's own captive portal, not a generic page.",
              },
              {
                step: '03',
                title: 'Choose a package or redeem a reward',
                desc: 'Pick a time/data plan, or redeem a loyalty reward if eligible.',
              },
              {
                step: '04',
                title: 'Pay instantly via M-Pesa or card',
                desc: 'Quick payment without leaving the WiFi login screen.',
              },
              {
                step: '05',
                title: 'Get online immediately',
                desc: 'Access is granted automatically the moment payment confirms.',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">{item.step}</p>
                <h3 className="mt-3 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* CTA below How It Works */}
        <div className="mt-14 text-center">
          <Link
            to="/register"
            className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base shadow-lg shadow-primary-100"
          >
            Get Started Today
            <ArrowRight size={16} />
          </Link>
          <p className="mt-3 text-sm text-gray-500">
            Pick a plan, connect your router, and go live in under an hour.
          </p>
        </div>
      </section>

      {/* 5. Platform Features */}
      <section id="features" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Platform features</p>
            <h2 className="mt-4 text-4xl font-bold text-gray-900">Everything your venue team needs in one platform</h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-900">
              Focus on the capabilities that change the customer experience and make the operation easier to run.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {platformHighlights.map(({ icon: Icon, title, description }) => (
              <motion.div
                key={title}
                variants={fade}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="card p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-900">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-900">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Pricing */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Pricing</p>
            <h2 className="mt-4 text-4xl font-bold text-gray-900">Workspace plans built for venue teams</h2>
            <p className="mt-4 text-gray-900">Simple plan choices keep the signup path clearer and make the activation flow easier to trust.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {workspacePlans.map((plan) => (
              <div
                key={plan.id || plan.name}
                className={`relative card p-7 ${
                  plan.featured ? 'border-2 border-primary-600 shadow-lg shadow-primary-100' : ''
                }`}
              >
                {plan.featured ? (
                  <div className="absolute left-1/2 top-[-14px] -translate-x-1/2 rounded-full bg-primary-600 px-4 py-1 text-xs font-medium text-white">
                    Recommended
                  </div>
                ) : null}

                <p className="text-sm font-medium text-gray-900">{plan.name}</p>
                <p className="mt-2 font-display text-3xl font-bold text-gray-900">
                  {typeof plan.price === 'number' ? formatCurrency(plan.price) : plan.price}
                </p>
                <p className="mt-1 text-xs text-gray-500">{plan.period}</p>
                {plan.trial_days > 0 ? (
                  <p className="mt-3 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                    {plan.trial_days}-day free trial
                  </p>
                ) : null}
                <p className="mt-4 text-sm leading-relaxed text-gray-900">{plan.description}</p>

                <ul className="mt-6 space-y-3">
                  {getPlanDisplayFeatures(plan).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-900">
                      <CheckCircle2 size={14} className="shrink-0 text-primary-600" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className={`mt-8 block w-full text-center ${plan.featured ? 'btn-primary' : 'btn-outline'}`}
                >
                  Choose {plan.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Reviews / Testimonials */}
      {landingReviews.length > 0 ? (
        <section className="bg-gray-50 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Reviews</p>
                <h2 className="mt-4 text-4xl font-bold text-gray-900">Teams trust FlowFi with real venue operations</h2>
                <p className="mt-4 max-w-2xl text-gray-900">
                  Clear proof from operators helps visitors understand that FlowFi is built for real deployment work, not just demos.
                </p>
              </div>
              {reviews.length > 3 ? (
                <Link to="/reviews" className="btn-outline">
                  View more
                </Link>
              ) : null}
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {landingReviews.map((review) => (
                <article key={review.id} className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                  <ReviewStars rating={review.rating} />
                  <p className="mt-5 text-base leading-8 text-gray-900">"{review.quote}"</p>
                  <div className="mt-6 border-t border-gray-100 pt-4">
                    <p className="text-lg font-semibold text-gray-900">{review.name}</p>
                    <p className="mt-1 text-sm text-gray-900">{review.role || 'Venue team member'}</p>
                    <p className="mt-1 text-sm font-medium text-primary-700">{review.venue || 'FlowFi customer'}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 8. Services */}
      <section id="services" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Services</p>
            <h2 className="mt-4 text-4xl font-bold text-gray-900">Need rollout help beyond the software?</h2>
            <p className="mt-4 max-w-2xl text-gray-900">
              FlowFi can also present installation, support, and consulting offers so operators know where to start even before they buy hardware.
            </p>
          </div>
          <Link to="/contact" className="btn-outline">
            Contact the team
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {services.map((service) => {
            const Icon = serviceIconMap[service.category] || Sparkles

            return (
              <div
                key={service.id || service.name}
                className={`card p-6 transition-shadow hover:shadow-md ${
                  service.featured ? 'border-primary-100 bg-primary-50/40' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm">
                    <Icon size={18} />
                  </div>
                  {service.featured ? (
                    <span className="rounded-full bg-primary-600 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white">
                      Featured
                    </span>
                  ) : null}
                </div>

                <p className="mt-5 text-xs uppercase tracking-[0.18em] text-gray-500">{service.category || 'service'}</p>
                <Link to={`/services/${service.id}`} className="mt-2 block text-xl font-semibold text-gray-900 transition-colors hover:text-primary-600">
                  {service.name}
                </Link>
                <p className="mt-3 text-sm leading-relaxed text-gray-900">{service.description}</p>

                <div className="mt-6 grid gap-3">
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Starting at</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">{service.startingPrice || 'Custom quote'}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Turnaround</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">{service.turnaround || 'To be agreed'}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to={`/services/${service.id}`} className="btn-primary">
                    Read more
                  </Link>
                  <Link to="/contact" className="btn-outline">
                    Request service
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 9. Blog preview */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Blog</p>
            <h2 className="mt-4 text-4xl font-bold text-gray-900">Field notes and rollout guides</h2>
            <p className="mt-4 max-w-2xl text-gray-900">
              Public WiFi is easier to trust when visitors can see the thinking behind the product and how real deployments are handled.
            </p>
          </div>
          <Link to="/blog" className="btn-outline">
            View the blog
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {blogPosts.map((post) => (
            <article key={post.id} className="card overflow-hidden transition-shadow hover:shadow-md">
              <img src={post.image} alt={post.title} className="h-56 w-full object-cover" />
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-primary-700">{post.category}</span>
                  <span>{post.readTime}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{post.title}</h3>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-900">{post.excerpt}</p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{formatDate(post.publishedAt)}</span>
                  <Link to="/blog" className="text-sm font-medium text-primary-600 hover:underline">
                    Read more
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 10. FAQ Accordion */}
      {faqs.length > 0 && (
        <section className="bg-gray-50 py-24">
          <div className="mx-auto max-w-3xl px-6">
            <div className="mb-12 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">FAQ</p>
              <h2 className="mt-4 text-4xl font-bold text-gray-900">Frequently asked questions</h2>
              <p className="mt-4 text-gray-600">Everything you need to know about FlowFi before getting started.</p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={faq.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="font-semibold text-gray-900">{faq.question}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-gray-400 transition-transform duration-200 ${
                        openFaqIndex === idx ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaqIndex === idx && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-5 text-sm leading-relaxed text-gray-600">{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <p className="text-sm text-gray-500">
                Still have questions?{' '}
                <Link to="/contact" className="font-medium text-primary-600 hover:underline">
                  Contact us →
                </Link>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 11. Final CTA */}
      <section className="bg-primary-600 py-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-100">Ready to launch?</p>
            <h2 className="mt-4 text-4xl font-bold text-white">Build your guest WiFi workflow with FlowFi</h2>
            <p className="mt-4 text-base leading-relaxed text-primary-100">
              Reach out for rollout help, or go straight to pricing and start a workspace when you are ready.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link to="/register" className="rounded-xl bg-white px-6 py-3 font-semibold text-primary-800 shadow-sm transition-colors hover:bg-primary-50">
              Start a workspace
            </Link>
            <Link to="/contact" className="rounded-xl border border-white/40 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10">
              Contact FlowFi
            </Link>
            {contact?.whatsapp ? (
              <a
                href={`https://wa.me/${String(contact.whatsapp).replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/40 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
              >
                Chat on WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
