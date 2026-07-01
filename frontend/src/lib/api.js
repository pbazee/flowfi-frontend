import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
})

// Inject auth token
api.interceptors.request.use((config) => {
  // Get token from zustand persisted store
  const stored = localStorage.getItem('flowfi-auth')
  if (stored) {
    try {
      const { state } = JSON.parse(stored)
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`
      }
    } catch {}
  }
  return config
})

// Handle 401 — auto refresh
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    if (err.response?.status === 401) {
      if (!original._retry && err.response?.data?.code === 'TOKEN_EXPIRED') {
        original._retry = true

        try {
          const stored = localStorage.getItem('flowfi-auth')
          const { state } = JSON.parse(stored)
          const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {
            refreshToken: state.refreshToken,
          })

          const parsed = JSON.parse(stored)
          parsed.state.accessToken = data.accessToken
          parsed.state.refreshToken = data.refreshToken
          localStorage.setItem('flowfi-auth', JSON.stringify(parsed))

          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        } catch {
          localStorage.removeItem('flowfi-auth')
          const redirect = `${window.location.pathname}${window.location.search}`
          window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`
        }
      }

      if (err.response?.data?.error === 'Invalid token') {
        localStorage.removeItem('flowfi-auth')
        if (window.location.pathname !== '/login') {
          const redirect = `${window.location.pathname}${window.location.search}`
          window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`
        }
      }
    }

    return Promise.reject(err)
  }
)

export default api
