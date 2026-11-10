'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check initial online status
    setIsOffline(!navigator.onLine)

    const handleOnline = () => {
      setIsOffline(false)
      setShowBanner(true)
      setTimeout(() => setShowBanner(false), 3000)
    }

    const handleOffline = () => {
      setIsOffline(true)
      setShowBanner(true)
    }

    const handleAppOnline = () => {
      setIsOffline(false)
      setShowBanner(true)
      setTimeout(() => setShowBanner(false), 3000)
    }

    const handleAppOffline = () => {
      setIsOffline(true)
      setShowBanner(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('app-online', handleAppOnline)
    window.addEventListener('app-offline', handleAppOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('app-online', handleAppOnline)
      window.removeEventListener('app-offline', handleAppOffline)
    }
  }, [])

  if (!showBanner) return null

  return (
    <div
      className={`fixed top-2 right-2 sm:right-4 z-50 px-2.5 py-1 rounded-full shadow-md text-xs font-medium  flex items-center gap-1.5 transition-all duration-300 pointer-events-none ${
        isOffline
          ? 'bg-red-950/80 text-red-200 border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
          : 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/40 shadow-[0_0_12px_rgba(34,197,94,0.25)]'
      }`}
    >
      {isOffline ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <WifiOff size={12} className="text-red-400" />
          <span className="text-[11px]">Offline · Cached</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <Wifi size={12} className="text-emerald-400" />
          <span className="text-[11px]">Online</span>
        </>
      )}
    </div>
  )
}
