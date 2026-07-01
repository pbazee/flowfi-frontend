import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, qty = 1) => {
        const items = get().items
        const existing = items.find((i) => i.id === product.id)
        if (existing) {
          set({ items: items.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + qty } : i) })
        } else {
          set({ items: [...items, { ...product, quantity: qty }] })
        }
      },

      updateQty: (id, qty) => {
        if (qty <= 0) return get().removeItem(id)
        set({ items: get().items.map((i) => i.id === id ? { ...i, quantity: qty } : i) })
      },

      removeItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),

      clear: () => set({ items: [] }),

      get total() {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
      },

      get count() {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },
    }),
    { name: 'flowfi-cart' }
  )
)
