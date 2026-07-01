import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPinned, Plus, Save, Trash2, Truck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import api from '@/lib/api'
import { formatCurrency, formatNumber } from '@/lib/formatters'

const KENYA_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay',
  'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu',
  'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru',
  'Migori', 'Mombasa', 'Murang\'a', 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua',
  'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans-Nzoia',
  'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'
]

function createEmptyZone() {
  return {
    id: crypto.randomUUID(),
    name: '',
    counties: [],
    price: '',
    free_shipping_above: '',
    estimated_days: '',
    is_active: true,
  }
}

function hydrateZone(zone = {}) {
  // If old data used 'countries', map it to 'counties' for simplicity
  const existingCounties = Array.isArray(zone.counties) ? zone.counties : (Array.isArray(zone.countries) ? zone.countries : [])
  return {
    id: zone.id || crypto.randomUUID(),
    name: zone.name || '',
    counties: existingCounties,
    price: zone.price ?? '',
    free_shipping_above: zone.free_shipping_above ?? '',
    estimated_days: zone.estimated_days ?? '',
    is_active: zone.is_active !== false,
  }
}

function prepareZone(zone) {
  return {
    id: zone.id,
    name: String(zone.name || '').trim(),
    counties: zone.counties || [],
    countries: zone.counties || [], // Sync to old schema field for safety
    price: Number(zone.price || 0),
    free_shipping_above: zone.free_shipping_above === '' || zone.free_shipping_above == null ? null : Number(zone.free_shipping_above),
    estimated_days: zone.estimated_days === '' ? null : Number(zone.estimated_days || 0),
    is_active: zone.is_active !== false,
  }
}

export default function ShippingRules() {
  const queryClient = useQueryClient()
  const [zones, setZones] = useState([])

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-shipping-zones'],
    queryFn: () => api.get('/admin/shipping-zones').then((response) => response.data),
  })

  useEffect(() => {
    setZones((data || []).map((zone) => hydrateZone(zone)))
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/admin/shipping-zones', { zones: payload }).then((response) => response.data),
    onSuccess: (savedZones) => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-zones'] })
      toast.success('Shipping rules saved')
      setZones((savedZones || []).map((zone) => hydrateZone(zone)))
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not save shipping rules')
    },
  })

  function updateZone(zoneId, key, value) {
    setZones((current) => current.map((zone) => (zone.id === zoneId ? { ...zone, [key]: value } : zone)))
  }

  function addCountyToZone(zoneId, county) {
    if (!county) return
    setZones((current) =>
      current.map((zone) => {
        if (zone.id !== zoneId) return zone
        if (zone.counties.includes(county)) return zone
        return { ...zone, counties: [...zone.counties, county] }
      })
    )
  }

  function removeCountyFromZone(zoneId, county) {
    setZones((current) =>
      current.map((zone) => {
        if (zone.id !== zoneId) return zone
        return { ...zone, counties: zone.counties.filter((c) => c !== county) }
      })
    )
  }

  function addZone() {
    setZones((current) => [...current, createEmptyZone()])
  }

  function removeZone(zoneId) {
    setZones((current) => current.filter((zone) => zone.id !== zoneId))
  }

  function saveZones() {
    const payload = zones.map(prepareZone).filter((zone) => zone.name)
    saveMutation.mutate(payload)
  }

  const activeZones = useMemo(() => zones.filter((zone) => zone.is_active !== false).length, [zones])
  const averagePrice = useMemo(() => {
    if (zones.length === 0) return 0
    return zones.reduce((sum, zone) => sum + Number(zone.price || 0), 0) / zones.length
  }, [zones])

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Store"
        title="Shipping rules"
        description="Configure delivery prices by Kenyan counties."
        actions={
          <button
            type="button"
            onClick={saveZones}
            disabled={isLoading || saveMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Saving...' : 'Save shipping rules'}
          </button>
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatTile label="Configured zones" value={formatNumber(zones.length)} icon={MapPinned} />
        <StatTile label="Active zones" value={formatNumber(activeZones)} icon={Truck} tone="green" />
        <StatTile label="Average delivery fee" value={formatCurrency(averagePrice)} icon={Truck} tone="blue" />
      </div>

      <SectionCard
        title="Delivery zones"
        description="Customers will automatically match to a zone based on the county they select at checkout."
        action={
          <button type="button" onClick={addZone} className="btn-outline flex items-center gap-2">
            <Plus size={14} />
            Add zone
          </button>
        }
      >
        <div className="space-y-5">
          {zones.map((zone, index) => (
            <div key={zone.id} className="rounded-3xl border border-gray-100 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Zone #{index + 1}</p>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">{zone.name || 'Untitled zone'}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => removeZone(zone.id)}
                  className="btn-ghost flex items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-1">
                  <label className="label">Zone name</label>
                  <input
                    value={zone.name}
                    onChange={(event) => updateZone(zone.id, 'name', event.target.value)}
                    className="input"
                    placeholder="e.g. Nairobi Metro"
                  />
                </div>
                <div>
                  <label className="label">Delivery fee (KES)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={zone.price}
                    onChange={(event) => updateZone(zone.id, 'price', event.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Free shipping above (KES)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={zone.free_shipping_above || ''}
                    onChange={(event) => updateZone(zone.id, 'free_shipping_above', event.target.value)}
                    className="input"
                    placeholder="e.g. 5000"
                  />
                </div>
                <div>
                  <label className="label">Estimated days</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={zone.estimated_days}
                    onChange={(event) => updateZone(zone.id, 'estimated_days', event.target.value)}
                    className="input"
                    placeholder="2"
                  />
                </div>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4">
                <label className="label">Target Counties</label>
                <div className="flex flex-col gap-3">
                  <select
                    className="input w-full md:w-1/3"
                    value=""
                    onChange={(e) => addCountyToZone(zone.id, e.target.value)}
                  >
                    <option value="" disabled>Select a county to add...</option>
                    {KENYA_COUNTIES.filter(c => !zone.counties.includes(c)).map(county => (
                      <option key={county} value={county}>{county}</option>
                    ))}
                  </select>

                  {zone.counties.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {zone.counties.map((county) => (
                        <span key={county} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 border border-blue-100">
                          {county}
                          <button
                            type="button"
                            onClick={() => removeCountyFromZone(zone.id, county)}
                            className="ml-1 hover:text-blue-900 focus:outline-none"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No counties selected. This zone will not match any orders.</p>
                  )}
                </div>
              </div>

              <label className="mt-6 flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={zone.is_active !== false}
                  onChange={(event) => updateZone(zone.id, 'is_active', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Use this rule during checkout</span>
              </label>
            </div>
          ))}
          {zones.length === 0 && (
            <div className="rounded-3xl border border-dashed border-gray-200 p-8 text-center text-gray-500">
              No delivery zones configured.
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
