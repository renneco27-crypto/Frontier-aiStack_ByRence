'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import SignOutButton from '@/components/SignOutButton'
import NotificationPanel from '@/components/NotificationPanel'
import { useUIStore } from '@/store/uiStore'
import { getDeckBlanks, DeckBlank } from '@/features/blanks/deckBlanksApi'
import { createBrowserSupabase } from '@/lib/supabase'
import { getAllDecks } from '@/db/deckRepository'
import type { Deck } from '@/lib/zodSchemas'
import { soundEngine } from '@/utils/soundEngine'
import { safeNavigate } from '@/lib/offlineNavigation'

function getUPath(left: number, right: number, isHole = false): string {
  const top = isHole ? -15 : 0
  const straightY = 48
  const bottomY = 64
  const cornerR = Math.min(18, Math.max(4, (right - left) / 2))
  if (isHole) {
    return `M ${left},${top} L ${left},${straightY} Q ${left},${bottomY} ${left + cornerR},${bottomY} L ${right - cornerR},${bottomY} Q ${right},${bottomY} ${right},${straightY} L ${right},${top} Z`
  }
  const startPart = left <= 1 ? `M ${left},${straightY}` : `M ${left},${top} L ${left},${straightY}`
  const endPart = right >= 355 ? `` : ` L ${right},${top}`
  return `${startPart} Q ${left},${bottomY} ${left + cornerR},${bottomY} L ${right - cornerR},${bottomY} Q ${right},${bottomY} ${right},${straightY}${endPart}`
}

function getInitialCutout(tab: string) {
  switch (tab) {
    case 'search':
      return { left: 78, right: 142 }
    case 'league':
      return { left: 214, right: 278 }
    case 'android':
      return { left: 276, right: 356 }
    default:
      return { left: 0, right: 80 }
  }
}

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()

  // Hide the navbar completely on authentication screens
  if (pathname?.startsWith('/auth')) {
    return null
  }

  const {
    openUploadModal,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    isSettingsModalOpen,
    openSettingsModal,
    closeSettingsModal,
    selectedDeckId,
  } = useUIStore()

  const [blanksDropdownOpen, setBlanksDropdownOpen] = useState(false)
  const [savedBlanks, setSavedBlanks] = useState<DeckBlank[]>([])
  const [userAvatar, setUserAvatar] = useState<string>('/assets/avatars/01.png')
  const [userName, setUserName] = useState<string>('Learner')
  const [userHandle, setUserHandle] = useState<string>('@studyup')
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null)
  const [fabSpinning, setFabSpinning] = useState(false)
  const [hapticOn, setHapticOn] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const [isNavVisible, setIsNavVisible] = useState(false)

  const deckMatch = pathname.match(/^\/study\/([^/]+)/)
  const currentDeckId = deckMatch ? deckMatch[1] : null

  const activeTabId =
    pathname === '/feed' || pathname.startsWith('/search')
      ? 'search'
      : pathname === '/leaderboard'
        ? 'league'
        : pathname === '/download'
          ? 'android'
          : 'library'

  const initCutout = getInitialCutout(activeTabId)
  const navWrapRef = useRef<HTMLDivElement | null>(null)
  const holeRef = useRef<SVGPathElement | null>(null)
  const baseRef = useRef<SVGPathElement | null>(null)
  const fillRef = useRef<SVGPathElement | null>(null)
  const rimRef = useRef<SVGPathElement | null>(null)
  const cutoutStateRef = useRef(initCutout)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSound = localStorage.getItem('studyup_sound_enabled')
      const savedHaptic = localStorage.getItem('studyup_haptic_enabled')
      setSoundOn(savedSound === null ? true : savedSound === 'true')
      setHapticOn(savedHaptic === null ? true : savedHaptic === 'true')
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === 'undefined') return
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight || document.documentElement.clientHeight
      const maxScroll = scrollHeight - clientHeight

      // When deck is empty or content fits entirely on screen, ALWAYS show the navbar immediately
      if (maxScroll <= 0 || !activeDeck) {
        setIsNavVisible(true)
        return
      }

      // Slide up ONLY when scrolling 3/4 (75%) down the page; otherwise hide it
      const progress = scrollTop / maxScroll
      setIsNavVisible(progress >= 0.75)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    // Recalculate whenever content (async decks, images, list items) updates
    const observer = new MutationObserver(() => {
      handleScroll()
    })
    if (typeof document !== 'undefined' && document.body) {
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      observer.disconnect()
    }
  }, [pathname])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('studyup_cached_session')
        const cachedAvatar = localStorage.getItem('studyup_cached_user_avatar')
        const cachedName = localStorage.getItem('studyup_user_name')
        if (cachedAvatar) setUserAvatar(cachedAvatar)
        if (cachedName) {
          setUserName(cachedName)
          setUserHandle('@' + cachedName.toLowerCase().replace(/[^a-z0-9_]/g, ''))
        }
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (parsed.avatarUrl) setUserAvatar(parsed.avatarUrl)
            if (parsed.displayName) {
              setUserName(parsed.displayName)
              setUserHandle('@' + parsed.displayName.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            }
          } catch {}
        }
      }

      const supabase = createBrowserSupabase()
      const applyUser = (user: any) => {
        if (!user) return
        const avatar =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          '/assets/avatars/01.png'
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Learner'
        const handle = '@' + (user.email?.split('@')[0] || 'learner').toLowerCase().replace(/[^a-z0-9_]/g, '')
        setUserAvatar(avatar)
        setUserName(name)
        setUserHandle(handle)
        if (typeof window !== 'undefined') {
          localStorage.setItem('studyup_cached_user_avatar', avatar)
          localStorage.setItem('studyup_user_name', name)
        }
      }

      supabase.auth.getSession().then(({ data }: any) => {
        if (data?.session?.user) applyUser(data.session.user)
      })

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        if (session?.user) applyUser(session.user)
      })

      return () => subscription?.unsubscribe?.()
    } catch {}
  }, [])

  useEffect(() => {
    async function loadActiveDeck() {
      try {
        const decks = await getAllDecks()
        if (decks.length === 0) {
          setActiveDeck(null)
          setIsNavVisible(true)
          return
        }
        const found = selectedDeckId ? decks.find((d) => d.id === selectedDeckId) : decks[0]
        setActiveDeck(found || decks[0])
      } catch {}
    }
    loadActiveDeck()
  }, [selectedDeckId, pathname, isDrawerOpen])

  useEffect(() => {
    async function loadBlanks() {
      if (!currentDeckId) {
        setSavedBlanks([])
        return
      }
      const blanks = await getDeckBlanks(currentDeckId)
      setSavedBlanks(blanks)
    }
    loadBlanks()

    const handleUpdate = () => loadBlanks()
    window.addEventListener('blanks-updated', handleUpdate)
    return () => window.removeEventListener('blanks-updated', handleUpdate)
  }, [currentDeckId])

  useEffect(() => {
    const handleCloseDrawer = () => closeDrawer()
    window.addEventListener('close-mobile-drawer', handleCloseDrawer)
    return () => window.removeEventListener('close-mobile-drawer', handleCloseDrawer)
  }, [closeDrawer])

  const animateCutoutTo = useCallback((targetLeft: number, targetRight: number, durationMs = 280) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    const startLeft = cutoutStateRef.current.left
    const startRight = cutoutStateRef.current.right
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(1, elapsed / durationMs)
      const ease = 1 - Math.pow(1 - t, 3)
      const curLeft = startLeft + (targetLeft - startLeft) * ease
      const curRight = startRight + (targetRight - startRight) * ease
      cutoutStateRef.current = { left: curLeft, right: curRight }

      if (holeRef.current) {
        holeRef.current.setAttribute('d', getUPath(curLeft, curRight, true))
      }
      if (baseRef.current) {
        baseRef.current.setAttribute('d', getUPath(curLeft, curRight, true))
      }
      if (fillRef.current) {
        fillRef.current.setAttribute('d', getUPath(curLeft, curRight, true))
      }
      if (rimRef.current) {
        rimRef.current.setAttribute('d', getUPath(curLeft, curRight, false))
      }

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step)
      }
    }

    animFrameRef.current = requestAnimationFrame(step)
  }, [])

  const updateNavCutout = useCallback(
    (tabId: string) => {
      const navWrap = navWrapRef.current
      if (!navWrap) return
      const activeBtn = navWrap.querySelector(`.nav-tab-btn[data-tab="${tabId}"]`) as HTMLElement | null
      if (!activeBtn) return

      const wrapRect = navWrap.getBoundingClientRect()
      if (!wrapRect.width) return

      const scaleX = 356 / wrapRect.width
      const btnRect = activeBtn.getBoundingClientRect()
      const center = ((btnRect.left + btnRect.right) / 2 - wrapRect.left) * scaleX

      // Standard identical cutout width for middle tabs (Public Feed & Ranks: 64 width)
      const cutoutWidth = 64
      const halfWidth = cutoutWidth / 2

      // Symmetrically center the cutout around the active button
      let targetLeft = center - halfWidth
      let targetRight = center + halfWidth

      // First and last tabs anchor to the outer edge of the navbar
      if (tabId === 'library') {
        targetLeft = 0
        targetRight = Math.min((btnRect.right - wrapRect.left) * scaleX + 6, 80)
      } else if (tabId === 'android') {
        targetLeft = Math.max((btnRect.left - wrapRect.left) * scaleX - 6, 276)
        targetRight = 356
      }

      animateCutoutTo(targetLeft, targetRight, 280)
    },
    [animateCutoutTo]
  )

  useEffect(() => {
    const timer = setTimeout(() => updateNavCutout(activeTabId), 40)
    const onResize = () => updateNavCutout(activeTabId)
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [activeTabId, updateNavCutout])

  const handleNavClick = (tabId: string, href: string) => {
    soundEngine.play('thocky')
    updateNavCutout(tabId)
    safeNavigate(router, href)
  }

  const handleCreateFab = () => {
    soundEngine.play('poppy', 25)
    setFabSpinning(true)
    setTimeout(() => setFabSpinning(false), 680)
    openUploadModal()
  }

  const isStudyPlayer = pathname.startsWith('/study/') && pathname.split('/').filter(Boolean).length >= 3

  return (
    <>
      {/* ==================== NOTIFICATION PANEL (PROCESSING JOBS) ==================== */}
      <NotificationPanel />

      {/* ==================== LEFT SIDE DRAWER OVERLAY (1:1 Reference) ==================== */}
      {isDrawerOpen && (
        <div id="drawerOverlay" className="fixed inset-0 z-50 flex max-w-[520px] mx-auto">
          <div className="w-[82%] h-full bg-[#0b0c14] border-r border-[#1c1e2a] flex flex-col justify-between p-4 z-10 shadow-2xl">
            <div>
              {/* User Profile Row */}
              <div className="flex items-center justify-between mb-6 pt-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-[#171925] flex items-center justify-center overflow-hidden border border-[#25283a] shrink-0">
                    <img
                      src={userAvatar || '/assets/avatars/01.png'}
                      alt={userName}
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).src = '/assets/avatars/01.png'
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[16px] font-bold text-white leading-tight truncate">{userName}</div>
                    <div className="text-[13px] text-[#8e92a8] truncate">{userHandle}</div>
                  </div>
                </div>

                <button
                  data-slot="button"
                  data-variant="secondary"
                  data-size="icon-sm"
                  onClick={() => {
                    soundEngine.play('thocky')
                    openSettingsModal()
                  }}
                  className="w-9 h-9 rounded-[12px] border-2 border-[#222536] bg-[#1c1f2e] flex items-center justify-center text-white shadow-[0px_3px_0px_0px_#121420] tactile-btn shrink-0 cursor-pointer"
                  title="Settings"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>

              {/* Menu Links */}
              <div className="space-y-4 mb-5 px-1">
                <button
                  onClick={() => {
                    soundEngine.play('thocky')
                    closeDrawer()
                    safeNavigate(router, '/')
                  }}
                  className="flex items-center gap-3.5 text-white font-semibold text-[15.5px] w-full text-left"
                >
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>My Library</span>
                </button>

                <button
                  onClick={() => {
                    soundEngine.play('thocky')
                    closeDrawer()
                    safeNavigate(router, '/feed')
                  }}
                  className="flex items-center gap-3.5 text-white font-semibold text-[15.5px] w-full text-left"
                >
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                    <path d="M2 12h20" />
                  </svg>
                  <span>Public Feed</span>
                </button>

                <button
                  onClick={() => {
                    soundEngine.play('thocky')
                    closeDrawer()
                    safeNavigate(router, '/leaderboard')
                  }}
                  className="flex items-center gap-3.5 text-white font-semibold text-[15.5px] w-full text-left"
                >
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="13" r="8" />
                    <path d="M12 9v4l2 2M9 2h6" />
                  </svg>
                  <span>Leaderboard</span>
                </button>

                <button
                  onClick={() => {
                    soundEngine.play('thocky')
                    closeDrawer()
                    safeNavigate(router, '/download')
                  }}
                  className="flex items-center gap-3.5 text-white font-semibold text-[15.5px] w-full text-left"
                >
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download Android APK</span>
                </button>

                {/* Saved Blanks Dropdown if inside a deck */}
                {savedBlanks.length > 0 && (
                  <div className="pt-1">
                    <button
                      onClick={() => setBlanksDropdownOpen(!blanksDropdownOpen)}
                      className="flex items-center justify-between text-white font-semibold text-[15px] w-full text-left"
                    >
                      <div className="flex items-center gap-3.5">
                        <FileText size={18} className="text-[#8e65f7]" />
                        <span>Saved Blanks</span>
                      </div>
                      {blanksDropdownOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {blanksDropdownOpen && (
                      <div className="mt-2 pl-6 space-y-1.5 border-l border-[#222536] ml-2">
                        {savedBlanks.map((blank) => (
                          <button
                            key={blank.id}
                            onClick={() => {
                              closeDrawer()
                              router.push(`/study/${blank.deck_id}/blanks?blankId=${blank.id}`)
                            }}
                            className="block text-[13px] text-[#8e92a8] hover:text-white truncate w-full text-left py-1"
                          >
                            {blank.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="h-[1px] bg-[#1c1e2a] -mx-4 mb-4" />
            </div>
          </div>
          <div onClick={closeDrawer} className="flex-1 h-full bg-black/60" />
        </div>
      )}

      {/* ==================== SETTINGS OVERLAY MODAL (1:1 Reference) ==================== */}
      {isSettingsModalOpen && (
        <div id="settingsModal" className="fixed inset-0 z-50 bg-[#0b0b0e] flex flex-col max-w-[520px] mx-auto overflow-hidden">
          <div className="senthora-bottom-glow" />

          <div className="relative z-10 h-14 px-4 flex items-center justify-between shrink-0 bg-transparent border-b border-white/10">
            <button
              onClick={() => {
                soundEngine.play('thocky')
                closeSettingsModal()
              }}
              className="w-9 h-9 flex items-center justify-center text-white active:scale-90 transition"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <span className="text-[17px] font-bold text-white tracking-tight">Settings</span>
            <div className="w-9" />
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto no-scrollbar px-4 pt-4 pb-6 space-y-6">
            {/* YOU section */}
            <div>
              <div className="text-[11px] font-bold text-purple-300/80 tracking-wider uppercase mb-2 px-1">YOU</div>
              <div className="space-y-2.5">
                <div className="p-4 rounded-[18px] bg-[#151722] border border-[#222536] flex items-center justify-between">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={userAvatar || '/assets/avatars/01.png'}
                      alt={userName}
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).src = '/assets/avatars/01.png'
                      }}
                      className="w-10 h-10 rounded-full object-cover border border-[#25283a] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[15.5px] font-bold text-white truncate">{userName}</div>
                      <div className="text-[12.5px] text-purple-200/70 truncate">{userHandle}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* APP section */}
            <div>
              <div className="text-[11px] font-bold text-purple-300/80 tracking-wider uppercase mb-2 px-1">APP</div>
              <div className="space-y-2.5">
                <div className="p-4 rounded-[18px] bg-[#151722] border border-[#222536] flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="4" y1="10" x2="4" y2="14" />
                      <line x1="8" y1="7" x2="8" y2="17" />
                      <line x1="12" y1="4" x2="12" y2="20" />
                      <line x1="16" y1="7" x2="16" y2="17" />
                      <line x1="20" y1="10" x2="20" y2="14" />
                    </svg>
                    <div className="text-[15.5px] font-bold text-white">Haptic feedback</div>
                  </div>
                  <div
                    onClick={() => {
                      const next = !hapticOn
                      setHapticOn(next)
                      soundEngine.setHapticEnabled(next)
                      soundEngine.play('thocky')
                    }}
                    className={`ios-switch ${hapticOn ? '' : 'off'}`}
                  >
                    <div className="ios-switch-thumb" />
                  </div>
                </div>

                <div className="p-4 rounded-[18px] bg-[#151722] border border-[#222536] flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                    <div className="text-[15.5px] font-bold text-white">Sound effects</div>
                  </div>
                  <div
                    onClick={() => {
                      const next = !soundOn
                      setSoundOn(next)
                      soundEngine.setSoundEnabled(next)
                      if (next) soundEngine.play('thocky')
                    }}
                    className={`ios-switch ${soundOn ? '' : 'off'}`}
                  >
                    <div className="ios-switch-thumb" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <SignOutButton className="w-full" />
            </div>
          </div>
        </div>
      )}

      {/* ==================== WAVY NOTCHED BOTTOM NAVIGATION BAR (1:1 Reference) ==================== */}
      {!isStudyPlayer && (
        <>
          <div className="h-[70px] w-full shrink-0 pointer-events-none" aria-hidden="true" />
          <div id="bottomAppNav" ref={navWrapRef} className={`notched-navbar-wrap ${isNavVisible ? 'nav-visible' : ''}`}>
          <svg className="notched-navbar-svg" viewBox="0 0 356 70" preserveAspectRatio="none" fill="none" aria-hidden="true">
            <defs>
              {/* Opaque Velvety Purple Gradient for the active cutout tab */}
              <linearGradient id="navCutoutPurpleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#221147" stopOpacity="1" />
                <stop offset="45%" stopColor="#4c2299" stopOpacity="1" />
                <stop offset="85%" stopColor="#7c4ddb" stopOpacity="1" />
                <stop offset="100%" stopColor="#9d6ef7" stopOpacity="1" />
              </linearGradient>

              <mask id="navbarCutoutMask">
                <rect width="356" height="70" fill="white" />
                <path
                  ref={holeRef}
                  id="navCutoutHole"
                  d={getUPath(initCutout.left, initCutout.right, true)}
                  fill="black"
                />
              </mask>
            </defs>

            {/* Solid blocker path so scrolled page cards/elements NEVER show through the cutout */}
            <path
              ref={baseRef}
              id="navCutoutBase"
              d={getUPath(initCutout.left, initCutout.right, true)}
              fill="#0b0c14"
            />

            {/* Active Cutout Tab Background Fill (100% Opaque Velvety Purple Gradient) */}
            <path
              ref={fillRef}
              id="navCutoutFill"
              d={getUPath(initCutout.left, initCutout.right, true)}
              fill="url(#navCutoutPurpleGrad)"
            />

            <path
              d="M 0,22 Q 0,0 22,0 L 334,0 Q 356,0 356,22 L 356,70 L 0,70 Z"
              fill="#14141D"
              mask="url(#navbarCutoutMask)"
            />

            <path
              ref={rimRef}
              id="navCutoutRim"
              d={getUPath(initCutout.left, initCutout.right, false)}
              fill="none"
              stroke="rgba(165, 117, 255, 0.45)"
              strokeWidth="1.3"
            />

            <path
              d="M 0,22 Q 0,0 22,0 L 334,0 Q 356,0 356,22"
              stroke="rgba(165, 117, 255, 0.22)"
              strokeWidth="1.2"
              fill="none"
              mask="url(#navbarCutoutMask)"
            />
          </svg>

          {/* Center Glowing Create Orb */}
          <button
            type="button"
            id="mainCreateFab"
            onClick={handleCreateFab}
            aria-label="Create new study deck"
            className={`notched-fab ${fabSpinning ? 'spinning' : ''}`}
            title="Create New Study Set"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            <span className="text-[11px] font-extrabold tracking-tight leading-none mt-0.5">Create</span>
          </button>

          <div className="notched-nav-items">
            <button
              type="button"
              onClick={() => handleNavClick('library', '/')}
              data-tab="library"
              className={`nav-tab-btn ${activeTabId === 'library' ? 'active' : ''}`}
              aria-current={activeTabId === 'library' ? 'page' : undefined}
              title="My Library"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
                <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <span className="nav-tab-label">My Library</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('search', '/feed')}
              data-tab="search"
              className={`nav-tab-btn ${activeTabId === 'search' ? 'active' : ''}`}
              aria-current={activeTabId === 'search' ? 'page' : undefined}
              title="Public Feed"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
              <span className="nav-tab-label">Public Feed</span>
            </button>

            {/* Center Notch Clearance */}
            <div className="w-16 shrink-0" />

            <button
              type="button"
              onClick={() => handleNavClick('league', '/leaderboard')}
              data-tab="league"
              className={`nav-tab-btn ${activeTabId === 'league' ? 'active' : ''}`}
              aria-current={activeTabId === 'league' ? 'page' : undefined}
              title="Ranks"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978" />
                <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978" />
                <path d="M18 9h1.5a1 1 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" />
                <path d="M6 9H4.5a1 1 0 0 1 0-5H6" />
              </svg>
              <span className="nav-tab-label">Ranks</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('android', '/download')}
              data-tab="android"
              className={`nav-tab-btn ${activeTabId === 'android' ? 'active' : ''}`}
              aria-current={activeTabId === 'android' ? 'page' : undefined}
              title="Android App"
            >
              <div className="relative">
                <img
                  src={userAvatar || '/assets/avatars/01.png'}
                  alt={userName}
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).src = '/assets/avatars/01.png'
                  }}
                  className="w-5 h-5 rounded-full object-cover border border-[#9d62f7]"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#9d62f7] ring-1 ring-[#14141D]" />
              </div>
              <span className="nav-tab-label">Android App</span>
            </button>
          </div>

          <div className="home-indicator" />
        </div>
        </>
      )}
    </>
  )
}
