import { ShoppingCart, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getPrimaryImage, formatCurrency, normalizeArray } from '@/lib/formatters'
import { useCartStore } from '@/store/cart'

export default function ProductCard({ product }) {
  const addItem = useCartStore((state) => state.addItem)
  const image = getPrimaryImage(product.images)
  const tags = normalizeArray(product.tags).slice(0, 2)
  const isOutOfStock = product.stock_qty === 0 || product.status === 'out_of_stock'

  function handleAddToCart() {
    if (isOutOfStock) return
    addItem(product, 1)
    toast.success(`${product.name} added to cart`)
  }

  return (
    <div className="card group overflow-hidden">
      <Link to={`/shop/${product.slug}`} className="block overflow-hidden">
        <img
          src={image}
          alt={product.name}
          className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </Link>

      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-gray-400">
              {product.category || 'General'}
            </p>
            <Link to={`/shop/${product.slug}`} className="mt-1 block text-lg font-semibold text-gray-900 hover:text-primary-600">
              {product.name}
            </Link>
          </div>
          {Number(product.rating || 0) > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
              <Star size={12} className="fill-current" />
              {Number(product.rating).toFixed(1)}
            </div>
          ) : null}
        </div>

        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-gray-500">
          {product.description || 'Purpose-built hardware and accessories for fast, reliable venue WiFi.'}
        </p>

        {tags.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(product.price)}</p>
            {product.compare_price ? (
              <p className="text-xs text-gray-400 line-through">{formatCurrency(product.compare_price)}</p>
            ) : null}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="btn-primary flex items-center gap-2 disabled:bg-gray-200 disabled:text-gray-500"
          >
            <ShoppingCart size={14} />
            {isOutOfStock ? 'Sold out' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
