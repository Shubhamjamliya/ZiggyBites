// Smooth, blink-free AnimatedPage
import { useEffect, useRef } from "react"

export default function AnimatedPage({ children, className = "" }) {
  const containerRef = useRef(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div
      ref={containerRef}
      className={`animate-in fade-in duration-200 ${className} md:pb-0`}
    >
      {children}
    </div>
  )
}
