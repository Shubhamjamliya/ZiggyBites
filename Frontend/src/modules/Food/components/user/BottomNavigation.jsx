import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { CalendarDays, History, Home, User } from "lucide-react"

const normalizePath = (pathname) => {
  if (!pathname) return "/"
  if (pathname.startsWith("/food")) {
    return pathname.substring(5) || "/"
  }
  return pathname
}

const navItems = [
  {
    label: "Home",
    to: "/food/user",
    icon: Home,
    active: (pathname) => {
      const p = normalizePath(pathname)
      return p === "/" || p === "/user" || p === "/user/"
    },
  },
  {
    label: "Subscription",
    to: "/food/user/profile/subscriptions",
    icon: CalendarDays,
    active: (pathname) => {
      const p = normalizePath(pathname)
      return (
        p.startsWith("/user/profile/subscriptions") ||
        p.startsWith("/profile/subscriptions") ||
        p.startsWith("/user/choose-meal") ||
        p.startsWith("/user/subscription-plans") ||
        p.startsWith("/user/checkout") ||
        p.startsWith("/subscriptions")
      )
    },
  },
  {
    label: "History",
    to: "/food/user/orders",
    icon: History,
    active: (pathname) => {
      const p = normalizePath(pathname)
      return p.startsWith("/user/orders") || p.startsWith("/orders")
    },
  },
  {
    label: "Profile",
    to: "/food/user/profile",
    icon: User,
    active: (pathname) => {
      const p = normalizePath(pathname)
      return (
        (p.startsWith("/user/profile") || p.startsWith("/profile")) &&
        !p.includes("/subscriptions")
      )
    },
  },
]

export default function BottomNavigation() {
  const { pathname } = useLocation()
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    let initialHeight = window.innerHeight

    const checkKeyboardState = () => {
      // 1. Check if any input/textarea/editable element is currently focused
      const activeEl = document.activeElement
      const isInputActive = Boolean(
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.isContentEditable ||
          activeEl.getAttribute?.("contenteditable") === "true")
      )

      if (isInputActive) {
        setIsKeyboardOpen(true)
        return
      }

      // 2. Check visualViewport height reduction (iOS & Android)
      if (window.visualViewport) {
        const visualHeight = window.visualViewport.height
        if (visualHeight < window.innerHeight * 0.82 || visualHeight < initialHeight * 0.82) {
          setIsKeyboardOpen(true)
          return
        }
      }

      // 3. Check innerHeight reduction compared to max height
      if (window.innerHeight < initialHeight * 0.82) {
        setIsKeyboardOpen(true)
        return
      }

      // Update baseline if window enlarged (e.g. orientation change)
      if (window.innerHeight > initialHeight) {
        initialHeight = window.innerHeight
      }

      setIsKeyboardOpen(false)
    }

    const handleFocusIn = (e) => {
      const target = e?.target
      const isInput = Boolean(
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.getAttribute?.("contenteditable") === "true")
      )

      if (isInput) {
        setIsKeyboardOpen(true)
      }
      setTimeout(checkKeyboardState, 50)
      setTimeout(checkKeyboardState, 150)
    }

    const handleFocusOut = () => {
      setTimeout(checkKeyboardState, 50)
      setTimeout(checkKeyboardState, 150)
    }

    document.addEventListener("focusin", handleFocusIn, true)
    document.addEventListener("focusout", handleFocusOut, true)
    window.addEventListener("resize", checkKeyboardState)

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", checkKeyboardState)
      window.visualViewport.addEventListener("scroll", checkKeyboardState)
    }

    return () => {
      document.removeEventListener("focusin", handleFocusIn, true)
      document.removeEventListener("focusout", handleFocusOut, true)
      window.removeEventListener("resize", checkKeyboardState)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", checkKeyboardState)
        window.visualViewport.removeEventListener("scroll", checkKeyboardState)
      }
    }
  }, [])

  if (isKeyboardOpen) return null

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md shadow-[0_-2px_10px_rgba(15,23,42,0.06)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.5)] transition-colors duration-200">
      <div className="mx-auto grid h-[54px] max-w-md grid-cols-4 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.active(pathname)

          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-all active:scale-95 active:opacity-70 ${
                isActive
                  ? "text-[#e32c31] dark:text-[#ff5257]"
                  : "text-[#4f4b5c] dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "fill-[#e32c31]/10 dark:fill-[#ff5257]/10" : ""}`}
                strokeWidth={isActive ? 2.8 : 2.2}
              />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
