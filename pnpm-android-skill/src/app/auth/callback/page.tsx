'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'
import { Sparkles, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import MatrixRainBackground from '@/components/MatrixRainBackground'
import { soundEngine } from '@/utils/soundEngine'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState('')
  const [deepLinkUrl, setDeepLinkUrl] = useState('')
  const [isNativeApp, setIsNativeApp] = useState(false)

  useEffect(() => {
    async function handleAuth() {
      try {
        const supabase = createBrowserSupabase()
        const search = typeof window !== 'undefined' ? window.location.search : ''
        const hash = typeof window !== 'undefined' ? window.location.hash : ''

        // Format custom scheme app deep link URL
        const appUrl = `studyup://auth-callback${search}${hash}`
        setDeepLinkUrl(appUrl)

        const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
        const isNative =
          !!(cap?.isNativePlatform?.()) ||
          !!(cap?.getPlatform && cap.getPlatform() !== 'web') ||
          (typeof window !== 'undefined' && window.location.hostname === 'localhost') ||
          ua.includes('; wv)') ||
          /\bStudyUpApp\b/i.test(ua)

        setIsNativeApp(isNative)

        let activeSession: any = null
        const searchParams = new URLSearchParams(search)
        const ticketId = searchParams.get('ticketId')
        const code = searchParams.get('code')

        // 1. Process PKCE code flow if code is present in searchParams
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('Supabase code exchange error:', error)
          } else if (data?.session) {
            activeSession = data.session
            if (typeof window !== 'undefined') {
              localStorage.setItem(
                'studyup_cached_session',
                JSON.stringify({
                  userId: data.session.user.id,
                  email: data.session.user.email,
                  savedAt: Date.now(),
                })
              )
            }
          }
        }

        // 2. Process hash token flow if tokens are present in hash
        if (hash && hash.includes('access_token=')) {
          const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (error) {
              console.error('Supabase setSession error:', error)
            } else if (data?.session) {
              activeSession = data.session
              if (typeof window !== 'undefined') {
                localStorage.setItem(
                  'studyup_cached_session',
                  JSON.stringify({
                    userId: data.session.user.id,
                    email: data.session.user.email,
                    savedAt: Date.now(),
                  })
                )
              }
            }
          }
        }

        if (!activeSession) {
          const { data: sessData } = await supabase.auth.getSession()
          if (sessData?.session) {
            activeSession = sessData.session
          }
        }

        // 3. Post session to Handshake Relay if running in external browser with ticketId
        if (activeSession && ticketId) {
          try {
            await fetch('/api/auth/handshake', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ticketId,
                accessToken: activeSession.access_token,
                refreshToken: activeSession.refresh_token,
                userId: activeSession.user.id,
                email: activeSession.user.email,
                displayName: activeSession.user.user_metadata?.full_name || activeSession.user.user_metadata?.name || activeSession.user.email?.split('@')[0],
                avatarUrl: activeSession.user.user_metadata?.avatar_url || activeSession.user.user_metadata?.picture || '',
              }),
            })
          } catch (e) {
            console.warn('Handshake store non-fatal error:', e)
          }
        }

        // 4. If running inside native app WebView:
        if (isNative) {
          if (activeSession) {
            const finalUserId = activeSession.user?.id
            const finalEmail = activeSession.user?.email
            const finalName = activeSession.user?.user_metadata?.full_name || activeSession.user?.user_metadata?.name || finalEmail?.split('@')[0] || 'Learner'
            const finalAvatar = activeSession.user?.user_metadata?.avatar_url || activeSession.user?.user_metadata?.picture || '/assets/avatars/01.png'
            if (typeof window !== 'undefined' && finalUserId) {
              localStorage.setItem('studyup_cached_session', JSON.stringify({
                userId: finalUserId,
                email: finalEmail,
                displayName: finalName,
                avatarUrl: finalAvatar,
                savedAt: Date.now(),
              }))
              localStorage.setItem('studyup_user_id', finalUserId)
              localStorage.setItem('studyup_cached_user_avatar', finalAvatar)
              localStorage.setItem('studyup_user_name', finalName)
            }
            setStatus('success')
            setTimeout(() => {
              router.replace('/')
            }, 800)
            return
          }

          // In native app without active session, check ticket handshake relay
          if (ticketId) {
            const appBaseUrl = 'https://www.studyup.cloud-ip.cc'
            for (let attempt = 1; attempt <= 6; attempt++) {
              try {
                const res = await fetch(`${appBaseUrl}/api/auth/handshake?ticketId=${ticketId}`, { cache: 'no-store' })
                const data = await res.json()
                if (data?.authenticated && data?.session?.accessToken) {
                  const { accessToken, refreshToken, userId, email, displayName, avatarUrl } = data.session
                  const { data: sessionData } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || '',
                  })
                  const finalUserId = userId || sessionData?.session?.user?.id
                  const finalEmail = email || sessionData?.session?.user?.email
                  const finalName = displayName || sessionData?.session?.user?.user_metadata?.full_name || finalEmail?.split('@')[0] || 'Learner'
                  const finalAvatar = avatarUrl || sessionData?.session?.user?.user_metadata?.avatar_url || '/assets/avatars/01.png'

                  if (typeof window !== 'undefined' && finalUserId) {
                    localStorage.setItem('studyup_cached_session', JSON.stringify({
                      userId: finalUserId,
                      email: finalEmail,
                      displayName: finalName,
                      avatarUrl: finalAvatar,
                      savedAt: Date.now(),
                    }))
                    localStorage.setItem('studyup_user_id', finalUserId)
                    localStorage.setItem('studyup_cached_user_avatar', finalAvatar)
                    localStorage.setItem('studyup_user_name', finalName)
                  }
                  setStatus('success')
                  setTimeout(() => {
                    router.replace('/')
                  }, 800)
                  return
                }
              } catch (err) {
                console.warn(`Handshake check attempt ${attempt} warning:`, err)
              }
              if (attempt < 6) {
                await new Promise((r) => setTimeout(r, 600))
              }
            }
          }
        }

        // 5. If running in external browser, deep-link back to the native app
        setStatus('success')

        const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        if (isMobile) {
          const isAndroid = /Android/i.test(navigator.userAgent)
          if (isAndroid) {
            const playStoreFallback = 'https://play.google.com/store/apps/details?id=com.studyup.app'
            const intentUrl = `intent://auth-callback${search}${hash}#Intent;scheme=studyup;package=com.studyup.app;S.browser_fallback_url=${encodeURIComponent(playStoreFallback)};end`
            window.location.href = intentUrl
          } else {
            window.location.href = appUrl
          }
        }

        // Web browser fallback redirect
        setTimeout(() => {
          router.replace('/')
        }, 1200)
      } catch (err: any) {
        console.error('OAuth Callback processing error:', err)
        setStatus('error')
        setErrorMessage(err?.message || 'Failed to complete sign in.')
      }
    }

    handleAuth()
  }, [router])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#050508] overflow-hidden">
      <MatrixRainBackground opacity={0.4} />

      <div className="relative z-10 bg-[#151722] w-full max-w-sm rounded-2xl border border-[var(--color-border)] p-8 text-center shadow-2xl">
        <div className="flex justify-center mb-4">
          <img
            src="/icon.png"
            alt="Logo"
            className="w-14 h-14 rounded-2xl shadow-[0_0_25px_rgba(168,85,247,0.5)] object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/images/mascot_with_hat.png'
            }}
          />
        </div>

        <h1 className="text-2xl font-display font-bold text-[var(--color-text-primary)]">
          Study<span className="text-[var(--color-accent)]">Up</span>
        </h1>

        {status === 'processing' && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-[var(--color-accent)]" />
            <p className="text-sm text-[var(--color-text-muted)]">Authenticating and verifying session...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <span>Authentication successful!</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Redirecting you to StudyUp...
            </p>

            {!isNativeApp && deepLinkUrl && (
              <div className="w-full flex flex-col gap-2 mt-2">
                <a
                  href={deepLinkUrl}
                  onClick={() => soundEngine.playBrush(0.5)}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity squishy-btn shadow-lg cursor-pointer"
                >
                  <ExternalLink size={15} /> Open StudyUp App
                </a>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="text-xs text-[var(--color-dontknow)] leading-relaxed">{errorMessage}</p>
            <button
              onClick={() => router.replace('/')}
              className="mt-3 w-full bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-border)] px-4 py-2 rounded-xl text-sm hover:border-[var(--color-accent)] transition-colors"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
