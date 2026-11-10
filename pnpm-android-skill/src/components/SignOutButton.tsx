'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase'
import { Capacitor } from '@capacitor/core'

export default function SignOutButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    try {
      const isNative =
        Capacitor.isNativePlatform() ||
        (typeof window !== 'undefined' && (
          (window as any).Capacitor?.isNative ||
          (window as any).Capacitor?.getPlatform?.() === 'android' ||
          window.location.hostname === 'localhost'
        ))

      // 1. Sign out of native Android Google Client if present
      try {
        const GoogleAuthBridge = typeof window !== 'undefined' ? (window as any).Capacitor?.Plugins?.GoogleAuthBridge : null
        if (GoogleAuthBridge?.signOut) {
          await GoogleAuthBridge.signOut().catch(() => {})
        }
      } catch {}

      // 2. Sign out of Supabase
      try {
        const supabase = createBrowserSupabase()
        if (supabase) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
          await supabase.auth.signOut().catch(() => {})
        }
      } catch {}

      // Clear cloud and local session tokens
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('studyup_cached_session')
          localStorage.removeItem('studyup_offline_user_session')
          localStorage.removeItem('studyup_user_id')
          localStorage.removeItem('studyup_user_email')
          localStorage.removeItem('studyup_cached_user_avatar')

          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i)
            if (key && (key.includes('sb-') || key.includes('supabase') || key.includes('token') || key.includes('session'))) {
              localStorage.removeItem(key)
            }
          }
          sessionStorage.clear()

          // Wipe client cookies
          const cookieList = document.cookie.split(';')
          for (const c of cookieList) {
            const eq = c.indexOf('=')
            const name = eq > -1 ? c.slice(0, eq).trim() : c.trim()
            if (name.includes('sb-') || name.includes('supabase') || name.includes('token')) {
              document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
              document.cookie = `${name}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
            }
          }
        }
      } catch {}

      // Hard redirect to root so the sign-in screen is cleanly rendered
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      data-slot="button"
      data-variant="secondary"
      onClick={handleSignOut}
      disabled={loading}
      className={`h-11 px-5 rounded-[16px] border-2 border-[#222536] bg-[#1c1f2e] text-white font-extrabold text-[14px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#121420] hover:opacity-90 tactile-btn flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${className}`}
      aria-label="Sign out"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
      <span className={iconOnly ? 'hidden lg:inline' : ''}>Sign out</span>
    </button>
  )
}