import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollManager() {
  const location = useLocation()

  useEffect(() => {
    window.history.scrollRestoration = 'manual'
  }, [])

  useEffect(() => {
    const scrollToTarget = () => {
      if (location.hash) {
        const target = document.querySelector(location.hash)
        if (target) {
          target.scrollIntoView({ block: 'start' })
          return
        }
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToTarget)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname, location.search, location.hash])

  return null
}
