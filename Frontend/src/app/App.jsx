import React, { useEffect, useState } from 'react'
import AppRoutes from './routes'
import SplashScreen from '@/shared/components/SplashScreen.jsx'
import { publicGetOnce } from '@food/api'

function isReloadNavigation() {
  if (typeof window === 'undefined') return false
  try {
    const navEntries = window.performance?.getEntriesByType?.('navigation')
    if (navEntries && navEntries.length > 0) {
      return navEntries[0].type === 'reload'
    }
    return window.performance?.navigation?.type === 1
  } catch {
    return false
  }
}

function shouldSkipSplashScreen() {
  if (typeof window === 'undefined') return false

  // 1. Skip if page was reloaded / refreshed
  if (isReloadNavigation()) return true

  // 2. Skip if splash screen was already displayed in this browser session
  try {
    if (sessionStorage.getItem('splash_shown') === 'true') {
      return true
    }
  } catch {}

  // 3. Skip if on Delivery, Kitchen / Restaurant, Admin, Auth, or partner routes
  const pathname = String(window.location.pathname || '').toLowerCase()
  const hash = String(window.location.hash || '').toLowerCase()
  const search = String(window.location.search || '').toLowerCase()
  const fullPath = `${pathname} ${hash} ${search}`

  const isPartnerOrAdminRoute =
    fullPath.includes('/delivery') ||
    fullPath.includes('/signup') ||
    fullPath.includes('/register') ||
    fullPath.includes('/admin') ||
    fullPath.includes('/restaurant') ||
    fullPath.includes('/kitchen') ||
    fullPath.includes('/terms') ||
    fullPath.includes('/privacy') ||
    fullPath.includes('/support')

  if (isPartnerOrAdminRoute) {
    return true
  }

  // 4. Skip if authenticated as restaurant, delivery, or admin
  try {
    const restaurantToken = localStorage.getItem('restaurant_token') || localStorage.getItem('auth_token_restaurant')
    const adminToken = localStorage.getItem('admin_token') || localStorage.getItem('auth_token_admin')
    const deliveryToken = localStorage.getItem('delivery_token') || localStorage.getItem('auth_token_delivery')
    if (restaurantToken || adminToken || deliveryToken) {
      return true
    }
  } catch {}

  return false
}

function App() {
  const [showSplash, setShowSplash] = useState(() => !shouldSkipSplashScreen())
  const [isSplashDecisionReady, setIsSplashDecisionReady] = useState(() => shouldSkipSplashScreen())
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    if (shouldSkipSplashScreen()) {
      try {
        sessionStorage.setItem('splash_shown', 'true')
      } catch {}
      setShowSplash(false)
      setIsSplashDecisionReady(true)
      return
    }

    publicGetOnce('/food/landing/settings/public')
      .then((response) => {
        if (!mounted) return
        const settings = response?.data?.data || {}
        const enabled = settings.showSplashScreen !== false
        setShowSplash(enabled)
        if (!enabled) {
          try {
            sessionStorage.setItem('splash_shown', 'true')
          } catch {}
        }
      })
      .catch(() => {
        if (!mounted) return
        setShowSplash(true)
      })
      .finally(() => {
        if (mounted) setIsSplashDecisionReady(true)
      })

    return () => {
      mounted = false
    }
  }, [])

  const handleSplashFinish = () => {
    try {
      sessionStorage.setItem('splash_shown', 'true')
    } catch {}
    setShowSplash(false)
  }

  // Normal Loading Spinner (if needed in future)
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white dark:bg-[#0a0a0a]">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-[#7e3866]/10 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-[#7e3866] rounded-full animate-spin" />
        </div>
        <h1 className="text-2xl font-black text-[#7e3866] italic uppercase tracking-tighter mt-6">ZIGGYBITES</h1>
      </div>
    )
  }

  if (!isSplashDecisionReady) {
    return null
  }

  return (
    <>
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      <AppRoutes />
    </>
  )
}

export default App

