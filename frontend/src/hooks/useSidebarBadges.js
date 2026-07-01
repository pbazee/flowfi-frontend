import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '@/lib/api'

export function useSidebarBadges(isAdmin = false) {
  const { pathname } = useLocation()
  const storageKey = isAdmin ? 'admin_panel_views' : 'tenant_panel_views'

  const [lastViewed, setLastViewed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || {}
    } catch {
      return {}
    }
  })

  // Update last viewed timestamp when visiting a section
  useEffect(() => {
    const newViews = { ...lastViewed, [pathname]: new Date().toISOString() }
    localStorage.setItem(storageKey, JSON.stringify(newViews))
    setLastViewed(newViews)
  }, [pathname])

  const { data: badges = {} } = useQuery({
    queryKey: [isAdmin ? 'admin-badges' : 'tenant-badges'],
    queryFn: async () => {
      if (isAdmin) {
        const sinceTenants = lastViewed['/admin/tenants'] || ''
        const { data } = await api.get('/admin/badges', {
          params: { since_tenants: sinceTenants }
        })
        return data || {}
      } else {
        const sinceCustomers = lastViewed['/tenant/customers'] || ''
        const { data } = await api.get('/platform/tenant-badges', {
          params: { since_customers: sinceCustomers }
        })
        return data || {}
      }
    },
    refetchInterval: 30000, // Poll every 30s
  })

  return badges
}
