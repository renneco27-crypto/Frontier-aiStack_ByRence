'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { createBrowserSupabase } from '@/lib/supabase'
import { soundEngine } from '@/utils/soundEngine'

interface AuthGateProps {
  onSuccess?: () => void
}

export default function AuthGate({ onSuccess }: AuthGateProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [welcome, setWelcome] = useState('')

  const syncGoogleProfile = async (session: any, fallbackName?: string) => {
    try {
      if (!session?.user) return
      const supabase = createBrowserSupabase()
      const user = session.user
      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        fallbackName ||
        user.email?.split('@')[0] ||
        'Learner'
      const avatarUrl =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        ''

      const today = new Date().toISOString()
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          email: user.email || '',
          display_name: displayName,
          avatar_url: avatarUrl,
          last_active: today,
        },
        { onConflict: 'id' }
      )

      await supabase.from('user_stats').upsert(
        {
          user_id: user.id,
          last_studied: today,
        },
        { onConflict: 'user_id' }
      )
    } catch (e) {
      console.warn('Profile sync warning:', e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return

    soundEngine.play('thocky')
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const supabase = createBrowserSupabase()

      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      if (typeof window !== 'undefined' && data?.session) {
        const displayName =
          data.session.user.user_metadata?.full_name ||
          data.session.user.user_metadata?.name ||
          email.trim().split('@')[0] ||
          'Learner'
        const avatarUrl =
          data.session.user.user_metadata?.avatar_url ||
          data.session.user.user_metadata?.picture ||
          '/assets/avatars/01.png'

        localStorage.setItem(
          'studyup_cached_session',
          JSON.stringify({
            userId: data.session.user.id,
            email: data.session.user.email,
            displayName,
            avatarUrl,
            savedAt: Date.now(),
          })
        )
        localStorage.setItem('studyup_user_id', data.session.user.id)
        localStorage.setItem('studyup_cached_user_avatar', avatarUrl)
        localStorage.setItem('studyup_user_name', displayName)
        syncGoogleProfile(data.session, displayName)
      }
      const name = email.trim().split('@')[0]
      setWelcome(`Hi ${name}`)
      setTimeout(() => {
        setWelcome('')
        if (onSuccess) onSuccess()
      }, 800)
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
        setError('Network error. Check your internet connection and try again.')
      } else if (errMsg.includes('Invalid login credentials')) {
        setError('Incorrect email or password. Please check your details and try again.')
      } else {
        setError(errMsg || 'Sign in failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    soundEngine.play('thocky', 15)
    setGoogleLoading(true)
    setError('')
    try {
      const isNative =
        Capacitor.isNativePlatform() ||
        (typeof window !== 'undefined' && (
          !!(window as any).Capacitor?.isNative ||
          (window as any).Capacitor?.getPlatform?.() === 'android' ||
          !!(window as any).Capacitor?.Plugins?.Browser ||
          window.location.hostname === 'localhost'
        ))
      const supabase = createBrowserSupabase()
      const ticketId = 'tk_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36)
      const appBaseUrl = 'https://www.studyup.cloud-ip.cc'
      const callbackUrl = `${appBaseUrl}/auth/callback?ticketId=${ticketId}`

      let pollActive = true
      let pollCount = 0
      const pollInterval = setInterval(async () => {
        if (!pollActive) {
          clearInterval(pollInterval)
          return
        }
        pollCount++
        if (pollCount > 85) {
          pollActive = false
          clearInterval(pollInterval)
          setGoogleLoading(false)
          return
        }

        try {
          const res = await fetch(`${appBaseUrl}/api/auth/handshake?ticketId=${ticketId}`, { cache: 'no-store' })
          const resData = await res.json()

          if (resData?.authenticated && resData?.session?.accessToken) {
            pollActive = false
            clearInterval(pollInterval)
            setGoogleLoading(false)

            const { accessToken, refreshToken, userId, email, displayName, avatarUrl } = resData.session
            const { data: sessionData } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            })

            const finalUserId = userId || sessionData?.session?.user?.id
            const finalEmail = email || sessionData?.session?.user?.email
            const finalName = displayName || sessionData?.session?.user?.user_metadata?.full_name || finalEmail?.split('@')[0] || 'Learner'
            const finalAvatar = avatarUrl || sessionData?.session?.user?.user_metadata?.avatar_url || '/assets/avatars/01.png'

            if (typeof window !== 'undefined' && finalUserId) {
              localStorage.setItem(
                'studyup_cached_session',
                JSON.stringify({
                  userId: finalUserId,
                  email: finalEmail,
                  displayName: finalName,
                  avatarUrl: finalAvatar,
                  savedAt: Date.now(),
                })
              )
              localStorage.setItem('studyup_user_id', finalUserId)
              localStorage.setItem('studyup_cached_user_avatar', finalAvatar)
              localStorage.setItem('studyup_user_name', finalName)
            }

            try {
              const BrowserPlugin = (window as any).Capacitor?.Plugins?.Browser
              if (BrowserPlugin?.close) {
                await BrowserPlugin.close().catch(() => {})
              }
            } catch {}

            syncGoogleProfile(sessionData?.session, finalName)
            setWelcome(`Hi ${finalName}`)
            setTimeout(() => {
              setWelcome('')
              if (onSuccess) onSuccess()
            }, 600)
          }
        } catch (pollErr) {
          console.warn('Handshake polling check warning:', pollErr)
        }
      }, 1200)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: isNative,
        },
      })
      if (error) {
        pollActive = false
        clearInterval(pollInterval)
        throw error
      }

      if (isNative && data?.url) {
        const BrowserPlugin = (window as any).Capacitor?.Plugins?.Browser
        if (BrowserPlugin?.open) {
          await BrowserPlugin.open({ url: data.url, windowName: '_blank' })
        } else {
          window.location.href = data.url
        }
      } else if (data?.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      setError(errMsg || 'Google sign-in failed')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#06070b] flex flex-col items-center justify-start overflow-y-auto no-scrollbar">
      {welcome && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#151722] rounded-full border border-[#222536] px-6 py-2.5 shadow-xl">
          <p className="text-white font-bold text-sm">{welcome}</p>
        </div>
      )}

      <div className="w-full max-w-[440px] min-h-screen flex flex-col justify-between relative z-10 bg-[#0b0c14] pb-8 overflow-hidden shadow-[0_20px_50px_-10px_rgba(0,0,0,0.65)]">
        <div className="senthora-bottom-glow" />
        <div className="relative z-10">
          {/* Purple Wavy Header Block (Same wave position as Public Feed) */}
          <div className="purple-wave-header pb-10 pt-5 px-6 relative overflow-hidden">
            <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10" viewBox="0 0 356 200" preserveAspectRatio="none">
              <path d="M0,0 L356,0 L356,86 C285,106 235,38 140,24 C65,12 25,34 0,48 Z" fill="#0B0320" fillOpacity="0.48" />
            </svg>

            <div className="h-9 flex items-center justify-between relative z-20 mb-3 text-white">
              <span className="text-[13px] font-extrabold text-white tracking-widest uppercase">STUDYUP</span>
            </div>

            <div className="relative z-20 pt-2 pb-3">
              <h1 className="font-display text-[28px] font-extrabold text-white tracking-tight leading-tight">
                Sign In
              </h1>
            </div>

            {/* Mascot Peeking over the wave line */}
            <div className="absolute right-2 -bottom-[28px] w-[165px] h-[165px] z-0 pointer-events-none">
              <img
                src="/assets/images/mascot_with_hat.png"
                alt="StudyUp Mascot"
                className="w-full h-full object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.6)] mascot-float-idle"
              />
            </div>

            {/* Signature Wavy Fill Divider at Header Base */}
            <svg className="absolute -bottom-[2px] left-0 w-full h-[40px] pointer-events-none z-10 block overflow-visible" viewBox="0 0 356 40" fill="none" preserveAspectRatio="none">
              <path d="M0,16 C38,0 78,0 118,16 C158,32 198,32 238,16 C278,0 318,0 356,16 L356,42 L0,42 Z" fill="#DDD6FE" fillOpacity="0.32" />
              <path d="M0,21 C38,5 78,5 118,21 C158,37 198,37 238,21 C278,5 318,5 356,21 L356,42 L0,42 Z" fill="#0b0c14" />
            </svg>
          </div>

          {/* Auth Controls Below the Wave (Official assets.html 3D Maia Buttons & Inputs) */}
          <form onSubmit={handleSubmit} className="px-6 pt-5 space-y-3.5 relative z-20 -mt-[1px] bg-gradient-to-b from-[#0b0c14] via-[#0b0c14] to-transparent">
            {/* Primary Action: Continue with Google (Secondary 3D Button) */}
            <button
              data-slot="button"
              data-variant="secondary"
              data-size="default"
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full h-12 px-5 rounded-[16px] border-2 border-[#222536] bg-[#1c1f2e] text-white font-extrabold text-[15px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#121420] hover:opacity-90 tactile-btn flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              )}
              <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-[#222536]" />
              <span className="text-[11.5px] font-bold text-[#8e92a8] uppercase tracking-wider">Email</span>
              <div className="flex-1 h-px bg-[#222536]" />
            </div>

            <input
              data-slot="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="h-12 w-full rounded-[16px] border-2 border-[#222536] bg-[#1a1c29] px-4 py-1 text-base text-white placeholder:text-[#8e92a8] focus:outline-none focus:border-[#9333ea] transition"
            />

            <input
              data-slot="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-12 w-full rounded-[16px] border-2 border-[#222536] bg-[#1a1c29] px-4 py-1 text-base text-white placeholder:text-[#8e92a8] focus:outline-none focus:border-[#9333ea] transition"
            />

            {error && <p className="text-[12.5px] font-semibold text-[#ff5252] text-center">{error}</p>}
            {message && <p className="text-[12.5px] font-semibold text-[#1ed760] text-center">{message}</p>}

            <button
              data-slot="button"
              data-variant="default"
              data-size="default"
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full h-12 px-5 rounded-[16px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-[15px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#6b21a8] hover:opacity-95 tactile-btn flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span>{loading ? 'Wait...' : 'Sign In'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
