import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, Search, Sparkles, Store, Tag, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import { filesToDataUrls } from '@/lib/fileUploads'
import {
  formatCurrency,
  formatNumber,
  getPrimaryImage,
  normalizeArray,
} from '@/lib/formatters'

const initialForm = {
  id: null,
  slug: '',
  name: '',
  description: '',
  price: '',
  compare_price: '',
  category: '',
  stock_qty: '',
  imagesText: '',
  tagsText: '',
  specificationsText: '{\n  \n}',
  is_featured: false,
  status: 'active',
}

function toForm(product) {
  return {
    id: product.id || null,
    slug: product.slug || '',
    name: product.name || '',
    description: product.description || '',
    price: product.price ?? '',
    compare_price: product.compare_price ?? '',
    category: product.category || '',
    stock_qty: product.stock_qty ?? '',
    imagesText: normalizeArray(product.images).join('\n'),
    tagsText: normalizeArray(product.tags).join(', '),
    specificationsText: JSON.stringify(product.specifications || {}, null, 2),
    is_featured: Boolean(product.is_featured),
    status: product.status || 'active',
  }
}

export default function ShopProducts() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [form, setForm] = useState(initialForm)
  const [editingSlug, setEditingSlug] = useState('')

  const { data: categories = [] } = useQuery({
    queryKey: ['shop-categories-admin'],
    queryFn: () => api.get('/shop/categories').then((response) => response.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-shop-products', search, category],
    queryFn: () =>
      api
        .get('/shop/products', {
          params: {
            search: search || undefined,
            category: category || undefined,
            limit: 48,
          },
        })
        .then((response) => response.data),
  })

  const { data: detailProduct } = useQuery({
    queryKey: ['admin-shop-product-detail', editingSlug],
    enabled: Boolean(editingSlug),
    queryFn: () => api.get(`/shop/products/${editingSlug}`).then((response) => response.data),
  })

  useEffect(() => {
    if (!detailProduct) return
    setForm(toForm(detailProduct))
  }, [detailProduct])

  const products = data?.products || []
  const productCategories = useMemo(() => {
    return Array.from(new Set([...categories, ...products.map((product) => product.category).filter(Boolean)]))
  }, [categories, products])

  const activeFeatured = products.filter((product) => product.is_featured).length
  const totalStock = products.reduce((sum, product) => sum + Number(product.stock_qty || 0), 0)
  const totalCatalogValue = products.reduce(
    (sum, product) => sum + Number(product.price || 0) * Number(product.stock_qty || 0),
    0
  )

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      let specifications = {}

      if (payload.specificationsText.trim()) {
        try {
          specifications = JSON.parse(payload.specificationsText)
        } catch {
          throw new Error('Specifications must be valid JSON')
        }
      }

      const requestPayload = {
        name: payload.name.trim(),
        description: payload.description.trim() || undefined,
        price: Number(payload.price),
        compare_price: payload.compare_price !== '' ? Number(payload.compare_price) : undefined,
        category: payload.category.trim() || undefined,
        stock_qty: payload.stock_qty !== '' ? Number(payload.stock_qty) : null,
        images: normalizeArray(payload.imagesText),
        tags: normalizeArray(payload.tagsText),
        specifications,
        is_featured: Boolean(payload.is_featured),
      }

      if (payload.id) {
        return api
          .put(`/shop/products/${payload.id}`, {
            ...requestPayload,
            status: payload.status,
          })
          .then((response) => response.data)
      }

      return api.post('/shop/products', requestPayload).then((response) => response.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shop-products'] })
      queryClient.invalidateQueries({ queryKey: ['shop-categories-admin'] })
      if (editingSlug) {
        queryClient.invalidateQueries({ queryKey: ['admin-shop-product-detail', editingSlug] })
      }
      setForm(initialForm)
      setEditingSlug('')
      toast.success('Product saved')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || error.message || 'Could not save product')
    },
  })

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    saveMutation.mutate(form)
  }

  function handleCreateNew() {
    setEditingSlug('')
    setForm(initialForm)
  }

  function handleEdit(product) {
    setEditingSlug(product.slug)
    setForm(toForm(product))
  }

  async function handleImageUpload(event) {
    try {
      const urls = await filesToDataUrls(event.target.files, { maxSizeBytes: 3 * 1024 * 1024 })
      if (urls.length === 0) return

      const currentImages = normalizeArray(form.imagesText)
      updateField('imagesText', [...currentImages, ...urls].join('\n'))
      toast.success(`${urls.length} image${urls.length > 1 ? 's' : ''} added`)
    } catch (error) {
      toast.error(error.message || 'Could not upload image')
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Commerce"
        title="Shop products"
        description="Create, refine, and feature products in the FlowFi storefront. The current read API exposes active catalog items, while updates can also set a product inactive."
        actions={
          <button type="button" onClick={handleCreateNew} className="btn-primary flex items-center gap-2">
            <Plus size={14} />
            New product
          </button>
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Visible products" value={formatNumber(products.length)} icon={Package} />
        <StatTile label="Featured" value={formatNumber(activeFeatured)} icon={Sparkles} tone="green" />
        <StatTile label="Categories" value={formatNumber(productCategories.length)} icon={Tag} tone="amber" />
        <StatTile label="Visible stock value" value={formatCurrency(totalCatalogValue)} icon={Store} tone="blue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <SectionCard
          title={form.id ? 'Edit product' : 'Create product'}
          description="Capture media, pricing, tags, and structured specs in one place."
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Product name</label>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  className="input"
                  placeholder="Dual-band router kit"
                  required
                />
              </div>
              <div>
                <label className="label">Category</label>
                <input
                  list="shop-product-categories"
                  value={form.category}
                  onChange={(event) => updateField('category', event.target.value)}
                  className="input"
                  placeholder="Routers"
                />
                <datalist id="shop-product-categories">
                  {productCategories.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                className="input min-h-28"
                placeholder="What makes this product useful for hotspot deployments?"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label">Price</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price}
                  onChange={(event) => updateField('price', event.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Compare price</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.compare_price}
                  onChange={(event) => updateField('compare_price', event.target.value)}
                  className="input"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="label">Stock quantity</label>
                <input
                  type="number"
                  min={0}
                  value={form.stock_qty}
                  onChange={(event) => updateField('stock_qty', event.target.value)}
                  className="input"
                  placeholder="Leave blank for unlimited"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Image URLs</label>
                <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary-200 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100">
                  <Upload size={14} />
                  Upload from device
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
                <textarea
                  value={form.imagesText}
                  onChange={(event) => updateField('imagesText', event.target.value)}
                  className="input min-h-24"
                  placeholder="One URL per line or comma-separated"
                />
                {normalizeArray(form.imagesText).length > 0 ? (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {normalizeArray(form.imagesText).slice(0, 6).map((image) => (
                      <img key={image} src={image} alt="Product preview" className="h-20 w-full rounded-2xl object-cover" />
                    ))}
                  </div>
                ) : null}
              </div>
              <div>
                <label className="label">Tags</label>
                <textarea
                  value={form.tagsText}
                  onChange={(event) => updateField('tagsText', event.target.value)}
                  className="input min-h-24"
                  placeholder="indoor, enterprise, mesh"
                />
              </div>
            </div>

            <div>
              <label className="label">Specifications JSON</label>
              <textarea
                value={form.specificationsText}
                onChange={(event) => updateField('specificationsText', event.target.value)}
                className="input min-h-40 font-mono text-xs"
                spellCheck="false"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(event) => updateField('is_featured', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Feature this product on the storefront</span>
              </label>

              {form.id ? (
                <div>
                  <label className="label">Status</label>
                  <select
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value)}
                    className="input"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              ) : (
                <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  New products are published as active by the current API.
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1">
                {saveMutation.isPending ? 'Saving product...' : form.id ? 'Update product' : 'Create product'}
              </button>
              {form.id ? (
                <button type="button" onClick={handleCreateNew} className="btn-ghost">
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Active catalog"
          description="Search the visible storefront, review stock, and select a product for editing."
        >
          <div className="mb-5 grid gap-3 lg:grid-cols-[1.1fr,0.7fr,auto]">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-9"
                placeholder="Search product name..."
              />
            </div>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="input">
              <option value="">All categories</option>
              {productCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
              {formatNumber(totalStock)} units in visible stock
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No active products found"
              description="Clear the current filters or create a new product to populate the storefront."
            />
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <div key={product.id} className="rounded-3xl border border-gray-100 p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <img
                      src={getPrimaryImage(product.images)}
                      alt={product.name}
                      className="h-24 w-24 rounded-2xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                        {product.is_featured ? <StatusBadge tone="info">Featured</StatusBadge> : null}
                        <StatusBadge status="active" />
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        {product.description || 'No description added yet.'}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-gray-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Price</p>
                          <p className="mt-2 text-sm font-medium text-gray-900">{formatCurrency(product.price)}</p>
                        </div>
                        <div className="rounded-2xl bg-gray-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Category</p>
                          <p className="mt-2 text-sm font-medium text-gray-900">{product.category || 'Uncategorized'}</p>
                        </div>
                        <div className="rounded-2xl bg-gray-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Stock</p>
                          <p className="mt-2 text-sm font-medium text-gray-900">
                            {product.stock_qty ?? 'Unlimited'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button type="button" onClick={() => handleEdit(product)} className="btn-outline">
                        Edit product
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
