import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password })
        set({
          user: data.user,
          tenant: data.tenant,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        })
        return data
      },

      register: async (payload) => {
        const { data } = await api.post('/auth/register', payload)
        set({
          user: data.user,
          tenant: data.tenant,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        })
        return data
      },

      logout: () => {
        set({ user: null, tenant: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },

      refreshAuth: async () => {
        try {
          const { refreshToken } = get()
          if (!refreshToken) return
          const { data } = await api.post('/auth/refresh', { refreshToken })
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken })
        } catch {
          get().logout()
        }
      },

      updateTenant: (tenant) => set({ tenant }),
    }),
    {
      name: 'flowfi-auth',
      partialize: (s) => ({
        user: s.user,
        tenant: s.tenant,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
)
