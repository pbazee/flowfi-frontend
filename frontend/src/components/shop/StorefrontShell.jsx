import { ArrowLeft, Search, ShoppingCart, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import WhatsAppWidget from '@/components/public/WhatsAppWidget'
import { usePlatformContent } from '@/hooks/usePlatformContent'
import { useCartStore } from '@/store/cart'

export default function StorefrontShell({
  title,
  description,
  actions,
  backHref,
  backLabel = 'Back to shop',
  children,
}) {
  const items = useCartStore((state) => state.items)
  const { data: content } = usePlatformContent()
  const count = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed w-full top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-600 text-white">
              <Wifi size={18} />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-gray-900">{content?.platformName || 'FlowFi'}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-900">Storefront</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/shop/track" className="btn-ghost flex items-center gap-1.5">
              <Search size={14} />
              Track Order
            </Link>
            <Link to="/shop/cart" className="btn-outline flex items-center gap-2">
              <ShoppingCart size={16} />
              Cart
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-600">
                {count}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-24 pb-10">
        {backHref ? (
          <Link to={backHref} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-900 transition-colors hover:text-gray-900">
            <ArrowLeft size={16} />
            {backLabel}
          </Link>
        ) : null}

        {(title || description || actions) && (
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              {title ? <h1 className="text-3xl font-bold font-display text-gray-900">{title}</h1> : null}
              {description ? <p className="mt-2 max-w-2xl text-sm text-gray-900">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
        )}

        {children}
      </main>
      <WhatsAppWidget />
    </div>
  )
}
