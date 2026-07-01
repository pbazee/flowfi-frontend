import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { DEFAULT_PLATFORM_CONTENT } from '@/lib/defaultPlatformContent'

export function usePlatformContent() {
  return useQuery({
    queryKey: ['platform-content'],
    queryFn: async () => {
      try {
        const response = await api.get('/platform/content')
        return {
          ...DEFAULT_PLATFORM_CONTENT,
          ...response.data,
          hero: response.data?.hero || DEFAULT_PLATFORM_CONTENT.hero,
          services: Array.isArray(response.data?.services) ? response.data.services : DEFAULT_PLATFORM_CONTENT.services,
          blogPosts: Array.isArray(response.data?.blogPosts) ? response.data.blogPosts : DEFAULT_PLATFORM_CONTENT.blogPosts,
          workspacePlans: Array.isArray(response.data?.workspacePlans)
            ? response.data.workspacePlans
            : DEFAULT_PLATFORM_CONTENT.workspacePlans,
          trustedVenues: Array.isArray(response.data?.trustedVenues)
            ? response.data.trustedVenues
            : DEFAULT_PLATFORM_CONTENT.trustedVenues,
          reviews: Array.isArray(response.data?.reviews)
            ? response.data.reviews
            : DEFAULT_PLATFORM_CONTENT.reviews,
          about: response.data?.about || DEFAULT_PLATFORM_CONTENT.about,
          contact: response.data?.contact || DEFAULT_PLATFORM_CONTENT.contact,
          socials: response.data?.socials || DEFAULT_PLATFORM_CONTENT.socials,
          paymentMethods: response.data?.paymentMethods || DEFAULT_PLATFORM_CONTENT.paymentMethods,
        }
      } catch {
        return DEFAULT_PLATFORM_CONTENT
      }
    },
    retry: 0,
    staleTime: 1000 * 60 * 10,
  })
}
