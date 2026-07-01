import PublicShell from '@/components/public/PublicShell'
import { usePlatformContent } from '@/hooks/usePlatformContent'

const sections = [
  {
    title: 'Using the platform',
    body:
      'FlowFi helps venues manage guest WiFi operations, storefront sales, rollout services, and platform operations. You agree to use the platform lawfully and not to interfere with service availability, payment flows, or other users.',
  },
  {
    title: 'Accounts and workspace access',
    body:
      'Workspace owners are responsible for protecting their login credentials, keeping billing and contact details current, and ensuring that router, hotspot, and customer data entered into the platform is accurate.',
  },
  {
    title: 'Payments and orders',
    body:
      'Storefront orders, workspace subscriptions, and connected payment flows may rely on third-party providers such as Paystack and M-Pesa. Payment confirmation, refunds, delivery terms, and operational follow-up may depend on the specific service or product purchased.',
  },
  {
    title: 'Reviews and public submissions',
    body:
      'Reviews, contact messages, and other public submissions may be moderated before publication. By submitting feedback, you confirm that it is accurate, lawful, and may be displayed on the FlowFi platform after review.',
  },
  {
    title: 'Service availability',
    body:
      'We work to keep FlowFi available and reliable, but uptime can be affected by internet service, payment providers, router connectivity, third-party APIs, and maintenance activity. We may update or suspend features when operationally necessary.',
  },
]

export default function TermsPage() {
  const { data: content } = usePlatformContent()

  return (
    <PublicShell>
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Terms of service</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 md:text-5xl">
            Terms for using {content?.platformName || 'FlowFi'}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-gray-900">
            These terms explain the basic responsibilities and expectations for customers, tenants, and teams using the platform.
          </p>
        </div>

        <div className="mt-12 space-y-6">
          {sections.map((section) => (
            <article key={section.title} className="rounded-[28px] border border-gray-100 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-900">{section.title}</h2>
              <p className="mt-4 text-base leading-8 text-gray-900">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  )
}
