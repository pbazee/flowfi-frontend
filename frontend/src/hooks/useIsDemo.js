import { useAuthStore } from '@/store/auth'

export function useIsDemo() {
  const { user } = useAuthStore()
  return user?.email === 'demo@flowfi.app'
}
