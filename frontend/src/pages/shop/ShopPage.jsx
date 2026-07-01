import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Sparkles, SlidersHorizontal, ShoppingBag } from 'lucide-react'
import StorefrontShell from '@/components/shop/StorefrontShell'
import ProductCard from '@/components/shop/ProductCard'
import EmptyState from '@/components/ui/EmptyState'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

export default function ShopPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const { data: categories = [] } = useQuery({
    queryKey: ['shop-categories'],
    queryFn: () => api.get('/shop/categories').then((response) => response.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['shop-products', category, search],
    queryFn: () =>
      api
        .get('/shop/products', {
          params: {
            category: category || undefined,
            search: search || undefined,
            limit: 24,
          },
        })
        .then((response) => response.data),
  })

  const products = data?.products || []
  const featuredProduct = products.find((product) => product.is_featured) || products[0]

  function handleSearchSubmit(event) {
    event.preventDefault()
    setSearch(searchInput.trim())
  }

  const headerActions = (
    <>
      <form onSubmit={handleSearchSubmit} className="relative min-w-[280px]">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search routers, antennas, accessories..."
          className="input pl-9"
        />
      </form>
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
        <SlidersHorizontal size={15} />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="bg-transparent text-sm text-gray-700 outline-none"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </>
  )

  return (
    <StorefrontShell
      title="FlowFi hardware and accessories"
      description="Routers, antennas, accessories, and service bundles curated for fast venue deployments."
      actions={headerActions}
    >
      {featuredProduct ? (
        <section className="mb-8 grid gap-6 lg:grid-cols-[1.5fr,0.9fr]">
          <div className="card overflow-hidden border-primary-100 bg-gradient-to-br from-primary-50 via-white to-white">
            <div className="grid gap-6 p-6 md:grid-cols-[1.2fr,0.8fr] md:p-8">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">
                  <Sparkles size={12} />
                  Featured pick
                </div>
                <h2 className="text-3xl font-bold font-display text-gray-900">{featuredProduct.name}</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-600">
                  {featuredProduct.description || 'A proven favorite for fast, reliable WiFi deployments across retail, hospitality, and education venues.'}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Starting at</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(featuredProduct.price)}</p>
                  </div>
                  <a href={`#product-${featuredProduct.id}`} className="btn-primary">
                    View in grid
                  </a>
                </div>
              </div>

              <img
                src={featuredProduct.images?.[0] || 'https://placehold.co/900x640/e5f7f0/0f6e56?text=FlowFi+Featured'}
                alt={featuredProduct.name}
                className="h-64 w-full rounded-3xl object-cover shadow-lg shadow-primary-100/60"
              />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="stat-card">
              <span className="stat-label">Products in catalog</span>
              <p className="stat-value">{data?.total || 0}</p>
              <p className="text-xs text-gray-500">Live and ready to order</p>
            </div>
            <div className="stat-card">
              <span className="stat-label">Categories</span>
              <p className="stat-value">{categories.length}</p>
              <p className="text-xs text-gray-500">Routers, accessories, services and more</p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-gray-400">Popular categories</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.slice(0, 6).map((item) => (
                  <button
                    key={item}
                    onClick={() => setCategory(item)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      item === category ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setCategory('')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            !category ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          All
        </button>
        {categories.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              category === item ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {item}
          </button>
        ))}
      </section>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="card h-[420px] animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No products match your filters"
          description="Try clearing the category filter or using a broader search term."
          action={
            <button
              onClick={() => {
                setCategory('')
                setSearch('')
                setSearchInput('')
              }}
              className="btn-primary"
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <div key={product.id} id={`product-${product.id}`}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </StorefrontShell>
  )
}
