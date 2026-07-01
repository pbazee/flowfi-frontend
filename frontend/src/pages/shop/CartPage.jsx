import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import StorefrontShell from '@/components/shop/StorefrontShell'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency, getPrimaryImage } from '@/lib/formatters'
import { useAuthStore } from '@/store/auth'
import { useCartStore } from '@/store/cart'

export default function CartPage() {
  const items = useCartStore((state) => state.items)
  const updateQty = useCartStore((state) => state.updateQty)
  const removeItem = useCartStore((state) => state.removeItem)
  const clear = useCartStore((state) => state.clear)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const checkoutHref = isAuthenticated ? '/shop/checkout' : '/login?redirect=/shop/checkout'

  return (
    <StorefrontShell
      backHref="/shop"
      backLabel="Continue shopping"
      title="Your cart"
      description="Review the hardware, accessories, and services you're about to order."
      actions={items.length > 0 ? <button onClick={clear} className="btn-ghost">Clear cart</button> : null}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Add a few products to build your FlowFi deployment kit before checking out."
          action={<Link to="/shop" className="btn-primary">Browse products</Link>}
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.4fr,0.8fr]">
          <section className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="card flex flex-col gap-4 p-5 md:flex-row">
                <img
                  src={getPrimaryImage(item.images)}
                  alt={item.name}
                  className="h-36 w-full rounded-2xl object-cover md:w-44"
                />

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-gray-400">{item.category || 'General'}</p>
                      <h2 className="mt-1 text-lg font-semibold text-gray-900">{item.name}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">{item.description || 'Deployment-ready hardware for FlowFi venues.'}</p>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Unit price</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(item.price)}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="inline-flex items-center rounded-2xl border border-gray-200 bg-white">
                        <button
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="p-3 text-gray-500 hover:text-gray-900"
                        >
                          <Minus size={15} />
                        </button>
                        <span className="min-w-12 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="p-3 text-gray-500 hover:text-gray-900"
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-400">Line total</p>
                        <p className="text-lg font-bold text-primary-600">
                          {formatCurrency(Number(item.price) * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <aside className="space-y-4">
            <div className="card p-6">
              <h2 className="text-base font-semibold text-gray-900">Order summary</h2>
              <div className="mt-5 space-y-3 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Items</span>
                  <span>{count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Delivery</span>
                  <span className="text-gray-500">Calculated at checkout</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
                  <span>Estimated total</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </div>

              <Link to={checkoutHref} className="btn-primary mt-6 block w-full text-center">
                {isAuthenticated ? 'Proceed to checkout' : 'Sign in to checkout'}
              </Link>
              <p className="mt-3 text-xs leading-relaxed text-gray-600">
                {isAuthenticated
                  ? 'Orders are submitted to the FlowFi team and stock is validated again on the server before confirmation.'
                  : 'Checkout now requires a signed-in FlowFi account before an order can be submitted.'}
              </p>
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-semibold text-gray-900">Need a custom bundle?</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">
                Add the closest items to your cart, then use the notes section at checkout to request installation, site surveys, or multi-venue packages.
              </p>
            </div>
          </aside>
        </div>
      )}
    </StorefrontShell>
  )
}
