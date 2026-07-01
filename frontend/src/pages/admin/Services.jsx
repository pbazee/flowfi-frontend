import { Plus, Save, Trash2, Wrench } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import { useAdminContentSettings } from '@/hooks/useAdminContentSettings'
import { formatNumber } from '@/lib/formatters'

export default function Services() {
  const {
    form,
    isLoading,
    saveMutation,
    featuredServices,
    updateService,
    addService,
    removeService,
    saveSettings,
  } = useAdminContentSettings()

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Public Content"
        title="Services catalog"
        description="Publish installation, rollout, consulting, and managed support offers without mixing them into the rest of the platform settings."
        actions={(
          <button
            type="button"
            onClick={saveSettings}
            disabled={isLoading || saveMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Saving...' : 'Save services'}
          </button>
        )}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatTile label="Published services" value={formatNumber(form.services.length)} icon={Wrench} />
        <StatTile label="Featured services" value={formatNumber(featuredServices)} icon={Wrench} tone="green" />
        <StatTile label="Menu split" value="Dedicated" icon={Wrench} tone="blue" />
      </div>

      <SectionCard
        title="Service offers"
        description="These cards feed the public landing page, service detail pages, and contact flow."
        action={(
          <button type="button" onClick={addService} className="btn-outline flex items-center gap-2">
            <Plus size={14} />
            Add service
          </button>
        )}
      >
        <div className="space-y-5">
          {form.services.map((service, index) => (
            <div key={service.id} className="rounded-3xl border border-gray-100 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Service #{index + 1}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{service.name || 'Untitled service'}</h3>
                    {service.featured ? <StatusBadge tone="info">Featured</StatusBadge> : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeService(service.id)}
                  className="btn-ghost flex items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Service name</label>
                  <input
                    value={service.name}
                    onChange={(event) => updateService(service.id, 'name', event.target.value)}
                    className="input"
                    placeholder="Installation & setup"
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    value={service.category}
                    onChange={(event) => updateService(service.id, 'category', event.target.value)}
                    className="input"
                  >
                    <option value="installation">Installation</option>
                    <option value="consulting">Consulting</option>
                    <option value="support">Support</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Starting price</label>
                  <input
                    value={service.startingPrice}
                    onChange={(event) => updateService(service.id, 'startingPrice', event.target.value)}
                    className="input"
                    placeholder="KES 7,500"
                  />
                </div>
                <div>
                  <label className="label">Turnaround</label>
                  <input
                    value={service.turnaround}
                    onChange={(event) => updateService(service.id, 'turnaround', event.target.value)}
                    className="input"
                    placeholder="1-2 business days"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="label">Description</label>
                <textarea
                  value={service.description}
                  onChange={(event) => updateService(service.id, 'description', event.target.value)}
                  className="input min-h-24"
                  placeholder="What does this service include for the client?"
                />
              </div>

              <div className="mt-4">
                <label className="label">More description</label>
                <textarea
                  value={service.longDescription}
                  onChange={(event) => updateService(service.id, 'longDescription', event.target.value)}
                  className="input min-h-32"
                  placeholder="Add fuller detail for the service page so visitors can read more before contacting you."
                />
              </div>

              <label className="mt-4 flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={service.featured}
                  onChange={(event) => updateService(service.id, 'featured', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Feature this service on the public site</span>
              </label>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
