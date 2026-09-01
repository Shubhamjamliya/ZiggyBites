import { useNavigate, useLocation } from "react-router-dom"
import { useMemo, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText,
  Package,
  MessageSquare,
  Compass,
} from "lucide-react"
import useNotificationInbox from "@food/hooks/useNotificationInbox"
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications"

const getOrdersTabs = (basePath = "/food/restaurant") => [
  { id: "orders", label: "Orders", icon: FileText, route: `${basePath}` },
  { id: "inventory", label: "Inventory", icon: Package, route: `${basePath}/inventory` },
  { id: "feedback", label: "Feedback", icon: MessageSquare, route: `${basePath}/feedback` },
  { id: "explore", label: "Explore", icon: Compass, route: `${basePath}/explore` },
]

const findActiveTab = (tabs, pathname) =>
  tabs
    .slice()
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => pathname === tab.route || pathname.startsWith(tab.route + "/"))

export default function BottomNavOrders() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  // Hide bottom nav when keyboard is open or when mobile inputs are focused
  useEffect(() => {
    if (typeof window === "undefined") return

    const checkKeyboardState = () => {
      // 1. Visual Viewport check
      if (window.visualViewport) {
        const isShrunk = window.visualViewport.height < window.innerHeight * 0.85
        if (isShrunk) {
          setIsKeyboardVisible(true)
          return
        }
      }

      // 2. Focused editable element check on mobile/touch screens
      const activeEl = document.activeElement
      const isInputActive =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable)

      const isMobile = window.innerWidth < 768
      if (isMobile && isInputActive) {
        setIsKeyboardVisible(true)
        return
      }

      setIsKeyboardVisible(false)
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", checkKeyboardState)
    }
    window.addEventListener("focusin", checkKeyboardState)
    window.addEventListener("focusout", checkKeyboardState)
    window.addEventListener("resize", checkKeyboardState)

    // Initial check
    checkKeyboardState()

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", checkKeyboardState)
      }
      window.removeEventListener("focusin", checkKeyboardState)
      window.removeEventListener("focusout", checkKeyboardState)
      window.removeEventListener("resize", checkKeyboardState)
    }
  }, [])


  const basePath = pathname.includes("/food/restaurant")
    ? "/food/restaurant"
    : pathname.includes("/restaurant")
    ? "/food/restaurant"
    : "/food/restaurant"

  const { unreadCount } = useNotificationInbox("restaurant", { limit: 20, pollMs: 60 * 1000 })
  const { newOrder, newReservation } = useRestaurantNotifications();

  const tabs = useMemo(() => getOrdersTabs(basePath), [basePath])

  const isInternalPage = pathname.includes("/create-offers")
  if (isInternalPage || isKeyboardVisible) {
    return null
  }

  const activeTab = useMemo(() => {
    const match = findActiveTab(tabs, pathname)
    return match?.id || "orders"
  }, [tabs, pathname])

  const handleTabClick = (tab) => {
    if (tab.route && tab.route !== pathname) {
      navigate(tab.route)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary border-t border-primary/20 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-md items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <motion.button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              aria-current={isActive ? "page" : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer"
              whileTap={{ scale: 0.95 }}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavActive"
                  className="absolute inset-0 rounded-xl bg-white/20 shadow-sm"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <div className="relative">
                <Icon
                  className={`h-5 w-5 transition-colors duration-200 ${
                    isActive ? "text-white scale-105" : "text-white/70 hover:text-white"
                  }`}
                />
                {/* Notification Dot */}
                {((tab.id === 'orders' && (newOrder || newReservation)) || 
                  (tab.id === 'feedback' && unreadCount > 0)) && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 border border-white shadow-sm" />
                  </span>
                )}
              </div>
              <span
                className={`relative z-10 whitespace-nowrap text-[11px] leading-tight transition-colors duration-200 ${
                  isActive ? "text-white font-extrabold" : "text-white/70 font-medium"
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
