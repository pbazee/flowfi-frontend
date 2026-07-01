import { BookOpen, Landmark, Plus, Save, Settings2, Wrench } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import { useAdminContentSettings } from '@/hooks/useAdminContentSettings'
import { formatNumber } from '@/lib/formatters'

export default function Settings() {
  const {
    form,
    isLoading,
    saveMutation,
    updateField,
    updateHeroField,
    updateTrustedVenue,
    addTrustedVenue,
    removeTrustedVenue,
    saveSettings,
  } = useAdminContentSettings()

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Platform Controls"
        title="Core settings and landing proof"
        description="Keep shared platform defaults tidy, manage the landing hero, public contact details, and control the venues shown in the trusted-by marquee."
        actions={(
          <button
            type="button"
            onClick={saveSettings}
            disabled={isLoading || saveMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Saving...' : 'Save changes'}
          </button>
        )}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Published services" value={formatNumber(form.services.length)} icon={Wrench} />
        <StatTile label="Blog posts" value={formatNumber(form.blogPosts.length)} icon={BookOpen} tone="green" />
        <StatTile label="Trusted venues" value={formatNumber(form.trustedVenues.length)} icon={Landmark} tone="blue" />
        <StatTile label="Maintenance mode" value={form.maintenance_mode ? 'On' : 'Off'} icon={Settings2} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <div className="space-y-6">
          <SectionCard
            title="Core platform settings"
            description="These values are shared across the platform and power the public contact details, WhatsApp support, and workspace signup flow."
          >
            <div className="space-y-4">
              <div>
                <label className="label">Platform name</label>
                <input
                  value={form.platform_name}
                  onChange={(event) => updateField('platform_name', event.target.value)}
                  className="input"
                  placeholder="FlowFi"
                />
              </div>

              <div>
                <label className="label">M-Pesa environment</label>
                <select
                  value={form.mpesa_env}
                  onChange={(event) => updateField('mpesa_env', event.target.value)}
                  className="input"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Support phone</label>
                  <input
                    value={form.support_phone}
                    onChange={(event) => updateField('support_phone', event.target.value)}
                    className="input"
                    placeholder="+254700000000"
                  />
                </div>
                <div>
                  <label className="label">Support email</label>
                  <input
                    type="email"
                    value={form.support_email}
                    onChange={(event) => updateField('support_email', event.target.value)}
                    className="input"
                    placeholder="support@flowfi.co.ke"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Support WhatsApp</label>
                  <input
                    value={form.support_whatsapp}
                    onChange={(event) => updateField('support_whatsapp', event.target.value)}
                    className="input"
                    placeholder="+254700000000"
                  />
                </div>
                <div>
                  <label className="label">Support address</label>
                  <input
                    value={form.support_address}
                    onChange={(event) => updateField('support_address', event.target.value)}
                    className="input"
                    placeholder="Nairobi, Kenya"
                  />
                </div>
              </div>

              <div>
                <label className="label">Contact page intro</label>
                <textarea
                  value={form.contact_intro}
                  onChange={(event) => updateField('contact_intro', event.target.value)}
                  className="input min-h-24"
                  placeholder="Talk to us about deployments, storefront products, support retainers, or a custom rollout."
                />
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={form.maintenance_mode}
                  onChange={(event) => updateField('maintenance_mode', event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Enable maintenance mode</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Use this when the platform needs a temporary operational freeze.
                  </p>
                </div>
              </label>
            </div>
          </SectionCard>

          <SectionCard
            title="Landing hero"
            description="Control the first message visitors see on the landing page without editing code."
          >
            <div className="space-y-4">
              <div>
                <label className="label">Eyebrow</label>
                <input
                  value={form.hero.eyebrow}
                  onChange={(event) => updateHeroField('eyebrow', event.target.value)}
                  className="input"
                  placeholder="Guest WiFi, payments, loyalty, and rollout support"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Headline</label>
                  <input
                    value={form.hero.headline}
                    onChange={(event) => updateHeroField('headline', event.target.value)}
                    className="input"
                    placeholder="Turn your venue WiFi into"
                  />
                </div>
                <div>
                  <label className="label">Highlight line</label>
                  <input
                    value={form.hero.highlight}
                    onChange={(event) => updateHeroField('highlight', event.target.value)}
                    className="input"
                    placeholder="a measurable business channel"
                  />
                </div>
              </div>

              <div>
                <label className="label">Summary</label>
                <textarea
                  value={form.hero.summary}
                  onChange={(event) => updateHeroField('summary', event.target.value)}
                  className="input min-h-24"
                  placeholder="Describe what the platform helps venues do."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Primary CTA label</label>
                  <input
                    value={form.hero.primaryCtaLabel}
                    onChange={(event) => updateHeroField('primaryCtaLabel', event.target.value)}
                    className="input"
                    placeholder="Start a workspace"
                  />
                </div>
                <div>
                  <label className="label">Secondary CTA label</label>
                  <input
                    value={form.hero.secondaryCtaLabel}
                    onChange={(event) => updateHeroField('secondaryCtaLabel', event.target.value)}
                    className="input"
                    placeholder="Visit storefront"
                  />
                </div>
              </div>

              <div>
                <label className="label">Helper text</label>
                <textarea
                  value={form.hero.helperText}
                  onChange={(event) => updateHeroField('helperText', event.target.value)}
                  className="input min-h-24"
                  placeholder="Short reassurance under the hero CTAs."
                />
              </div>

              <div className="rounded-3xl border border-primary-100 bg-[radial-gradient(circle_at_top,#e1f5ee,white_58%)] p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-700">{form.hero.eyebrow}</p>
                <h3 className="mt-3 text-3xl font-bold text-gray-900">
                  {form.hero.headline}
                  <span className="block text-primary-600">{form.hero.highlight}</span>
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-900">{form.hero.summary}</p>
                <p className="mt-4 text-xs font-medium text-gray-900">{form.hero.helperText}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Sidebar split"
            description="The heavy content editors now live in their own menu items so the platform workflow stays easier to scan."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                'Services now have a dedicated editor page.',
                'Plans and subscriptions have their own screen.',
                'Blog posts are managed separately from core settings.',
                'About page content is isolated for cleaner publishing.',
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Trusted by venues marquee"
            description="These names appear on the public landing page and scroll from right to left as social proof."
            action={(
              <button type="button" onClick={addTrustedVenue} className="btn-outline flex items-center gap-2">
                <Plus size={14} />
                Add venue
              </button>
            )}
          >
            <div className="space-y-3">
              {form.trustedVenues.map((venue, index) => (
                <div key={`trusted-venue-${index}`} className="grid gap-3 md:grid-cols-[1fr,auto]">
                  <input
                    value={venue}
                    onChange={(event) => updateTrustedVenue(index, event.target.value)}
                    className="input"
                    placeholder="Garden City Mall"
                  />
                  <button
                    type="button"
                    onClick={() => removeTrustedVenue(index)}
                    className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-primary-50 p-4 text-sm text-primary-900">
              Keep the list short and credible. These names are strongest when they match real venues and recognizable rollout wins.
            </div>
          </SectionCard>

          <SectionCard
            title="Social media links"
            description="These links power the footer social icons across the public website."
          >
            <div className="grid gap-4">
              <div>
                <label className="label">Facebook URL</label>
                <input
                  value={form.social_facebook}
                  onChange={(event) => updateField('social_facebook', event.target.value)}
                  className="input"
                  placeholder="https://facebook.com/your-page"
                />
              </div>
              <div>
                <label className="label">Instagram URL</label>
                <input
                  value={form.social_instagram}
                  onChange={(event) => updateField('social_instagram', event.target.value)}
                  className="input"
                  placeholder="https://instagram.com/your-page"
                />
              </div>
              <div>
                <label className="label">X URL</label>
                <input
                  value={form.social_x}
                  onChange={(event) => updateField('social_x', event.target.value)}
                  className="input"
                  placeholder="https://x.com/your-page"
                />
              </div>
              <div>
                <label className="label">LinkedIn URL</label>
                <input
                  value={form.social_linkedin}
                  onChange={(event) => updateField('social_linkedin', event.target.value)}
                  className="input"
                  placeholder="https://linkedin.com/company/your-page"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Save changes"
            description="These updates apply to public contact details, shared defaults, and the landing-page trust marquee."
          >
            <button
              type="button"
              onClick={saveSettings}
              disabled={isLoading || saveMutation.isPending}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              <Save size={15} />
              {saveMutation.isPending ? 'Saving platform settings...' : 'Save platform settings'}
            </button>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
