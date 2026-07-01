import { CheckCircle2, Plus, Save } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import { useAdminContentSettings } from '@/hooks/useAdminContentSettings'
import { formatNumber } from '@/lib/formatters'

export default function About() {
  const {
    form,
    isLoading,
    saveMutation,
    updateAboutField,
    updateAboutValue,
    addAboutValue,
    removeAboutValue,
    updateAboutStat,
    addAboutStat,
    removeAboutStat,
    saveSettings,
  } = useAdminContentSettings()

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Public Content"
        title="About page"
        description="Shape the company story, proof points, and value statements without scrolling through unrelated settings."
        actions={(
          <button
            type="button"
            onClick={saveSettings}
            disabled={isLoading || saveMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Saving...' : 'Save about page'}
          </button>
        )}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatTile label="Value statements" value={formatNumber(form.about.values.length)} icon={CheckCircle2} />
        <StatTile label="Proof stats" value={formatNumber(form.about.stats.length)} icon={CheckCircle2} tone="green" />
        <StatTile label="Story editor" value="Dedicated" icon={CheckCircle2} tone="blue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <SectionCard title="Story content" description="Headline, summary, and story copy used on the public about page.">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Eyebrow</label>
                <input
                  value={form.about.eyebrow}
                  onChange={(event) => updateAboutField('eyebrow', event.target.value)}
                  className="input"
                  placeholder="About FlowFi"
                />
              </div>
              <div>
                <label className="label">Headline</label>
                <input
                  value={form.about.headline}
                  onChange={(event) => updateAboutField('headline', event.target.value)}
                  className="input"
                  placeholder="We help venues monetize connectivity."
                />
              </div>
            </div>

            <div>
              <label className="label">Summary</label>
              <textarea
                value={form.about.summary}
                onChange={(event) => updateAboutField('summary', event.target.value)}
                className="input min-h-24"
              />
            </div>

            <div>
              <label className="label">Story</label>
              <textarea
                value={form.about.story}
                onChange={(event) => updateAboutField('story', event.target.value)}
                className="input min-h-40"
              />
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Values"
            description="Short statements that communicate how FlowFi works with customers."
            action={(
              <button type="button" onClick={addAboutValue} className="btn-outline flex items-center gap-2">
                <Plus size={14} />
                Add value
              </button>
            )}
          >
            <div className="space-y-3">
              {form.about.values.map((value, index) => (
                <div key={`about-value-${index}`} className="flex gap-3">
                  <input
                    value={value}
                    onChange={(event) => updateAboutValue(index, event.target.value)}
                    className="input flex-1"
                    placeholder="Simple setup that gets tenants live fast"
                  />
                  <button
                    type="button"
                    onClick={() => removeAboutValue(index)}
                    className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Proof stats"
            description="Short proof points shown as cards on the about page."
            action={(
              <button type="button" onClick={addAboutStat} className="btn-outline flex items-center gap-2">
                <Plus size={14} />
                Add stat
              </button>
            )}
          >
            <div className="space-y-3">
              {form.about.stats.map((stat) => (
                <div key={stat.id} className="grid gap-3 md:grid-cols-[0.9fr,1.1fr,auto]">
                  <input
                    value={stat.label}
                    onChange={(event) => updateAboutStat(stat.id, 'label', event.target.value)}
                    className="input"
                    placeholder="Launch speed"
                  />
                  <input
                    value={stat.value}
                    onChange={(event) => updateAboutStat(stat.id, 'value', event.target.value)}
                    className="input"
                    placeholder="Under 1 hour"
                  />
                  <button
                    type="button"
                    onClick={() => removeAboutStat(stat.id)}
                    className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
