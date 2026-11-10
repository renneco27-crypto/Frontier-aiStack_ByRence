'use client'

import React, { useEffect, useState } from 'react'
import { RefreshCw, Sparkles, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'

export default function VersionUpdateModal() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [serverVersion, setServerVersion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const clientVersion = process.env.NEXT_PUBLIC_BUILD_VERSION || 'v_initial'

  useEffect(() => {
    const isNative =
      Capacitor.isNativePlatform() ||
      (typeof window !== 'undefined' && (
        (window as any).Capacitor?.isNativePlatform?.() ||
        window.location.hostname === 'localhost'
      ))

    // Standalone native Android APK never shows browser web reload prompts
    if (isNative) return

    // Only check once on app launch
    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        })

        if (!res.ok) return
        const data = await res.json()

        if (data?.version && data.version !== clientVersion) {
          console.log(`[VersionCheck] Update available: server=${data.version}, client=${clientVersion}`)
          setServerVersion(data.version)
          setUpdateAvailable(true)
        }
      } catch (e) {
        // Silently catch fetch errors when offline
      }
    }

    // Give the app 1.5s after launch to settle before checking
    const timer = setTimeout(checkVersion, 1500)
    return () => clearTimeout(timer)
  }, [clientVersion])

  const isNative =
    typeof window !== 'undefined' &&
    (Capacitor.isNativePlatform() ||
      (window as any).Capacitor?.isNativePlatform?.() ||
      window.location.hostname === 'localhost')

  if (isNative || !updateAvailable || dismissed) {
    return null
  }

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60  animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-6 overflow-hidden border rounded-3xl bg-[var(--color-surface-1,#0f172a)] border-[var(--color-border,rgba(255,255,255,0.12))] shadow-2xl text-white">
        {/* Accent gradient strip */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[var(--color-accent,#ff2d85)] via-pink-500 to-indigo-500" />

        {/* Close Button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X size={18} />
        </button>

        {/* Modal Content */}
        <div className="flex flex-col items-center text-center mt-2">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent,#ff2d85)]/15 text-[var(--color-accent,#ff2d85)] flex items-center justify-center mb-4 border border-[var(--color-accent,#ff2d85)]/30">
            <Sparkles size={24} className="animate-pulse" />
          </div>

          <h3 className="text-lg font-bold text-white tracking-tight mb-2">
            New Content Available!
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
            A new update has been deployed to the app. Reload to get the latest features and content.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              Later
            </button>

            <button
              onClick={handleReload}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--color-accent,#ff2d85)] hover:brightness-110 text-xs font-semibold text-white shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw size={14} />
              Reload Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
