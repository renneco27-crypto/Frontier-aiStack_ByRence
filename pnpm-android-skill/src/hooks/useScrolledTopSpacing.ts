'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect when the user has scrolled down (threshold in px).
 * Uses capture-phase listener so it detects scrolling on `window`, `document`,
 * or any inner scroll container (such as `<div className="overflow-auto">`).
 */
export function useScrolledTopSpacing(threshold = 4) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = (e?: Event) => {
      let scrollY = 0
      if (typeof window !== 'undefined') {
        scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
      }
      if (!scrollY && e?.target) {
        const el = e.target as HTMLElement
        if (el && typeof el.scrollTop === 'number') {
          scrollY = el.scrollTop
        }
      }
      setIsScrolled(scrollY > threshold)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [threshold])

  return isScrolled
}
