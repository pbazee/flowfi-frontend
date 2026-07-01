import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Minus, Plus, ShieldCheck, ShoppingCart, Star, Truck, Share2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import ReviewSection from '@/components/public/ReviewSection'
import ProductCard from '@/components/shop/ProductCard'
import StorefrontShell from '@/components/shop/StorefrontShell'
import EmptyState from '@/components/ui/EmptyState'
import api from '@/lib/api'
import {
  formatCurrency,
  getPrimaryImage,
  normalizeArray,
  normalizeObject,
} from '@/lib/formatters'
import { useCartStore } from '@/store/cart'

export default function ProductPage() {
  const { slug } = useParams()
  const addItem = useCartStore((state) => state.addItem)
  const [quantity, setQuantity] = useState(1)

  const { data: product, isLoading } = useQuery({
    queryKey: ['shop-product', slug],
    queryFn: () => api.get(`/shop/products/${slug}`).then((response) => response.data),
  })

  const { data: related } = useQuery({
    queryKey: ['shop-related-products', product?.category],
    enabled: Boolean(product?.category),
    queryFn: () =>
      api
        .get('/shop/products', {
          params: {
            category: product.category,
            limit: 4,
          },
        })
        .then((response) => response.data),
  })

  if (isLoading) {
    return (
      <StorefrontShell backHref="/shop" backLabel="Back to shop">
        <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="card h-[520px] animate-pulse bg-gray-100" />
          <div className="card h-[520px] animate-pulse bg-gray-100" />
        </div>
      </StorefrontShell>
    )
  }

  if (!product) {
    return (
      <StorefrontShell backHref="/shop" backLabel="Back to shop">
        <EmptyState
          title="Product not found"
          description="This product may have been removed or is no longer active in the catalog."
          action={<Link to="/shop" className="btn-primary">Return to shop</Link>}
        />
      </StorefrontShell>
    )
  }

  const images = normalizeArray(product.images)
  const specs = Object.entries(normalizeObject(product.specifications))
  const tags = normalizeArray(product.tags)
  const isOutOfStock = product.stock_qty === 0 || product.status === 'out_of_stock'
  const relatedProducts = (related?.products || []).filter((item) => item.id !== product.id).slice(0, 3)

  function handleAddToCart() {
    if (isOutOfStock) return
    addItem(product, quantity)
    toast.success(`${product.name} added to cart`)
  }

  return (
    <StorefrontShell
      backHref="/shop"
      backLabel="Back to catalog"
      title={product.name}
      description={product.category ? `${product.category} collection` : 'Product detail'}
      actions={
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: product.name,
                  url: window.location.href,
                })
              } else {
                navigator.clipboard.writeText(window.location.href)
                toast.success('Link copied to clipboard')
              }
            }}
            className="btn-outline flex items-center gap-2"
          >
            <Share2 size={16} />
            Share
          </button>
          <Link to="/shop/cart" className="btn-primary flex items-center gap-2 text-white">
            <ShoppingCart size={16} />
            Review cart
          </Link>
        </div>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="space-y-4">
          <div className="card overflow-hidden">
            <img
              src={getPrimaryImage(images)}
              alt={product.name}
              className="h-[460px] w-full object-cover"
            />
          </div>

          {images.length > 1 ? (
            <div className="grid grid-cols-3 gap-4">
              {images.slice(1, 4).map((image) => (
                <div key={image} className="card overflow-hidden">
                  <img src={image} alt={product.name} className="h-32 w-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="card p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {product.is_featured ? (
                <span className="badge-success">Featured</span>
              ) : null}
              {isOutOfStock ? (
                <span className="badge-danger">Out of stock</span>
              ) : (
                <span className="badge-info">Ready to order</span>
              )}
              {Number(product.rating || 0) > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  <Star size={12} className="fill-current" />
                  {Number(product.rating).toFixed(1)} ({product.review_count || 0})
                </span>
              ) : null}
            </div>

            <p className="text-3xl font-bold text-gray-900">{formatCurrency(product.price)}</p>
            {product.compare_price ? (
              <div className="mt-2 flex items-center gap-3">
                <p className="text-sm text-gray-400 line-through">{formatCurrency(product.compare_price)}</p>
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  Save {formatCurrency(Number(product.compare_price) - Number(product.price))}
                </span>
              </div>
            ) : null}

            <p className="mt-5 text-sm leading-relaxed text-gray-600">
              {product.description || 'Designed for durable, high-uptime venue deployments with FlowFi’s operational playbook in mind.'}
            </p>

            {tags.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Availability</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {product.stock_qty == null ? 'Unlimited stock' : `${product.stock_qty} units remaining`}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Category</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">{product.category || 'General'}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <div className="inline-flex items-center rounded-2xl border border-gray-200 bg-white">
                <button
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  className="p-3 text-gray-500 hover:text-gray-900"
                >
                  <Minus size={16} />
                </button>
                <span className="min-w-12 text-center text-sm font-semibold text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity((current) => current + 1)}
                  className="p-3 text-gray-500 hover:text-gray-900"
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="btn-primary flex-1 justify-center disabled:bg-gray-200 disabled:text-gray-500"
              >
                Add to cart
              </button>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900">Why teams choose this</h2>
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary-50 p-2 text-primary-600">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Deployment-ready reliability</p>
                  <p className="mt-1 text-sm text-gray-500">Curated for busy venue environments where uptime and simplicity matter.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary-50 p-2 text-primary-600">
                  <Truck size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Fast regional fulfilment</p>
                  <p className="mt-1 text-sm text-gray-500">Orders are logged instantly and your team can follow up with delivery details right away.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-10 grid gap-8 lg:grid-cols-[0.9fr,1.1fr]">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900">Specifications</h2>
          {specs.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Detailed specifications will appear here as products are enriched in the storefront catalog.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {specs.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 text-sm last:border-0 last:pb-0">
                  <span className="font-medium text-gray-500">{key}</span>
                  <span className="text-right text-gray-900">{String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold font-display text-gray-900">You may also like</h2>
            <Link to="/shop" className="inline-flex items-center gap-2 text-sm font-medium text-primary-600">
              Browse all
              <ArrowRight size={15} />
            </Link>
          </div>
          {relatedProducts.length === 0 ? (
            <EmptyState
              title="No similar products yet"
              description="Once more items are added to this category, they’ll show up here automatically."
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {relatedProducts.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      <ReviewSection
        scope="product"
        targetId={product.id}
        targetLabel={product.name}
        heading={`Customer reviews for ${product.name}`}
        intro="Read published customer reviews for this product and leave your own feedback after purchase."
        emptyTitle="No product reviews yet"
        emptyDescription="Once customers publish feedback for this product, it will appear here."
        submitTitle="Write a product review"
      />
    </StorefrontShell>
  )
}
