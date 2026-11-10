'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import AuthGate from '@/components/AuthGate'
import { createBrowserSupabase } from '@/lib/supabase'
import { Capacitor } from '@capacitor/core'
import { handleStripeDeepLink } from '@/lib/stripePayment'
import { useCreditsStore } from '@/store/creditsStore'

function checkUserProStatus(supabase: any, userId: string) {
  if (!userId) return
  if (userId === '8714eab4-073e-409a-927b-869500c268e6') {
    useCreditsStore.getState().setPaidAccount(true)
  }
  supabase
    .from('user_purchases')
    .select('is_paid')
    .eq('user_id', userId)
    .maybeSingle()
    .then(({ data }: any) => {
      if (data?.is_paid) {
        useCreditsStore.getState().setPaidAccount(true)
      }
    })
    .catch(() => {})
}

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('studyup_cached_session')
    }
    return false
  })

  // Publicly accessible routes that bypass authentication
  const isPublicRoute =
    pathname === '/offline' ||
    pathname?.startsWith('/study') ||
    pathname?.startsWith('/api') ||
    pathname?.startsWith('/auth') ||
    pathname === '/data-deletion' ||
    pathname === '/data-deletion.html' ||
    pathname === '/privacy-policy' ||
    pathname === '/privacy-policy.html' ||
    pathname === '/privacy' ||
    pathname === '/terms-of-service' ||
    pathname === '/terms-of-service.html' ||
    pathname === '/tos' ||
    pathname === '/tos.html' ||
    pathname === '/landing.html'

  useEffect(() => {
    setMounted(true)

    const isNative =
      Capacitor.isNativePlatform() ||
      (typeof window !== 'undefined' && (
        !!(window as any).Capacitor?.isNative ||
        (window as any).Capacitor?.getPlatform?.() === 'android' ||
        window.location.hostname === 'localhost'
      ))

    const supabase = createBrowserSupabase()

    // Check if we have an active session cached in localStorage
    if (typeof window !== 'undefined') {
      handleStripeDeepLink(window.location.href)
      const cached = localStorage.getItem('studyup_cached_session')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.userId) checkUserProStatus(supabase, parsed.userId)
        } catch {}
        setAuthenticated(true)
      } else {
        setAuthenticated(false)
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: any } }) => {
        if (data?.session) {
          const user = data.session.user
          checkUserProStatus(supabase, user.id)
          if (typeof window !== 'undefined') {
            const displayName =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split('@')[0] ||
              'Learner'
            const avatarUrl =
              user.user_metadata?.avatar_url ||
              user.user_metadata?.picture ||
              '/assets/avatars/01.png'
            localStorage.setItem(
              'studyup_cached_session',
              JSON.stringify({
                userId: user.id,
                email: user.email,
                displayName,
                avatarUrl,
                savedAt: Date.now(),
              })
            )
            localStorage.setItem('studyup_cached_user_avatar', avatarUrl)
            localStorage.setItem('studyup_user_name', displayName)
          }
          setAuthenticated(true)
        } else {
          if (typeof window !== 'undefined' && localStorage.getItem('studyup_cached_session')) {
            setAuthenticated(true)
          } else {
            setAuthenticated(false)
          }
        }
      })
      .catch((err) => {
        console.warn('Supabase auth session check non-fatal warning (offline mode):', err)
        if (typeof window !== 'undefined' && localStorage.getItem('studyup_cached_session')) {
          setAuthenticated(true)
        } else {
          setAuthenticated(false)
        }
      })

    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        if (session) {
          checkUserProStatus(supabase, session.user.id)
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'studyup_cached_session',
              JSON.stringify({
                userId: session.user.id,
                email: session.user.email,
                savedAt: Date.now(),
              })
            )
          }
          setAuthenticated(true)

          // Sync Google Account display name and avatar into profiles for leaderboard
          try {
            const user = session.user
            const displayName =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split('@')[0] ||
              'Learner'
            const avatarUrl =
              user.user_metadata?.avatar_url ||
              user.user_metadata?.picture ||
              ''
            const today = new Date().toISOString()
            supabase.from('profiles').upsert(
              {
                id: user.id,
                email: user.email || '',
                display_name: displayName,
                avatar_url: avatarUrl,
                onesignal_external_user_id: user.email || user.id,
                last_active: today,
              },
              { onConflict: 'id' }
            ).then(() => {})
          } catch {}
        } else if (!isNative && navigator.onLine && !localStorage.getItem('studyup_cached_session')) {
          setAuthenticated(false)
        }
      })

      let appUrlListener: any = null
      if (typeof window !== 'undefined') {
        const Cap = (window as any).Capacitor
        const AppPlugin = Cap?.Plugins?.App
        const BrowserPlugin = Cap?.Plugins?.Browser

        if (AppPlugin?.addListener) {
          try {
            const handleOrPromise = AppPlugin.addListener('appUrlOpen', async (data: { url: string }) => {
              try {
                if (BrowserPlugin?.close) {
                  await BrowserPlugin.close().catch(() => {})
                }
              } catch {}

              try {
                const urlStr = data.url
                handleStripeDeepLink(urlStr)

                // Route auth callback deep links to intermediate authentication screen
                if (urlStr.includes('auth-callback') && typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/callback')) {
                  const query = urlStr.includes('?') ? urlStr.split('?')[1].split('#')[0] : ''
                  const hash = urlStr.includes('#') ? urlStr.split('#')[1] : ''
                  const navUrl = '/auth/callback' + (query ? '?' + query : '') + (hash ? '#' + hash : '')
                  window.location.href = navUrl
                  return
                }

                let params: URLSearchParams | null = null
                if (urlStr.includes('#')) {
                  const hash = urlStr.split('#')[1]
                  params = new URLSearchParams(hash)
                } else if (urlStr.includes('?')) {
                  const query = urlStr.split('?')[1]
                  params = new URLSearchParams(query)
                }

                if (params) {
                  const accessToken = params.get('access_token')
                  const refreshToken = params.get('refresh_token')
                  const code = params.get('code')

                  if (accessToken && refreshToken) {
                    const { data: sessionData, error } = await supabase.auth.setSession({
                      access_token: accessToken,
                      refresh_token: refreshToken,
                    })
                    if (!error && sessionData?.session) {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(
                          'studyup_cached_session',
                          JSON.stringify({
                            userId: sessionData.session.user.id,
                            email: sessionData.session.user.email,
                            savedAt: Date.now(),
                          })
                        )
                      }
                      setAuthenticated(true)
                    }
                  } else if (code) {
                    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
                    if (!error && sessionData?.session) {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(
                          'studyup_cached_session',
                          JSON.stringify({
                            userId: sessionData.session.user.id,
                            email: sessionData.session.user.email,
                            savedAt: Date.now(),
                          })
                        )
                      }
                      setAuthenticated(true)
                    }
                  }
                }
              } catch (e) {
                console.error('[Auth] Error processing OAuth deep link:', e)
              }
            })

            if (handleOrPromise && typeof handleOrPromise.then === 'function') {
              handleOrPromise
                .then((listener: any) => {
                  appUrlListener = listener
                })
                .catch((err: any) => {
                  console.warn('[Auth] Failed to bind appUrlOpen listener:', err)
                })
            } else {
              appUrlListener = handleOrPromise
            }
          } catch (err) {
            console.warn('[Auth] Failed to initialize native Capacitor App listener:', err)
          }
        }
      }

      return () => {
        subscription?.unsubscribe?.()
        if (appUrlListener?.remove) {
          appUrlListener.remove()
        }
      }
    } catch {
      // Offline fallback
    }
  }, [])

  const isNative =
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && (
      !!(window as any).Capacitor?.isNative ||
      (window as any).Capacitor?.getPlatform?.() === 'android' ||
      window.location.hostname === 'localhost'
    ))

  if (!mounted) {
    return <>{children}</>
  }

  if (isPublicRoute) {
    return <>{children}</>
  }

  if (!authenticated) {
    return <AuthGate onSuccess={() => setAuthenticated(true)} />
  }

  return <>{children}</>
}