'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useProcessingJobsStore } from '@/store/processingJobsStore'
import { createBrowserSupabase } from '@/lib/supabase'
import { soundEngine } from '@/utils/soundEngine'
import SignOutButton from '@/components/SignOutButton'

interface BuildStatus {
  built: boolean
  timestamp: string | null
  sizeBytes: number | null
  sizeFormatted: string | null
  downloadUrl: string
  githubRepo: string | null
  releaseTag: string | null
  playStoreUrl: string | null
  apkUrl: string | null
}

const STATIC_QR_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 33 33" shape-rendering="crispEdges"><path fill="#FFFFFF" d="M0 0h33v33H0z"/><path stroke="#0F172A" d="M2 2.5h7m3 0h1m2 0h1m2 0h5m1 0h7M2 3.5h1m5 0h1m2 0h3m2 0h2m1 0h1m4 0h1m5 0h1M2 4.5h1m1 0h3m1 0h1m1 0h1m2 0h2m3 0h1m3 0h1m1 0h1m1 0h3m1 0h1M2 5.5h1m1 0h3m1 0h1m1 0h1m4 0h2m2 0h1m1 0h1m2 0h1m1 0h3m1 0h1M2 6.5h1m1 0h3m1 0h1m1 0h2m3 0h1m2 0h1m2 0h2m1 0h1m1 0h3m1 0h1M2 7.5h1m5 0h1m1 0h1m2 0h6m3 0h1m1 0h1m5 0h1M2 8.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 9.5h4m2 0h1m1 0h1m2 0h1M2 10.5h1m1 0h5m2 0h1m1 0h7m4 0h5M2 11.5h3m4 0h2m2 0h1m4 0h1m1 0h3m1 0h3m3 0h1M5 12.5h1m1 0h2m1 0h3m1 0h1m2 0h2m4 0h1M2 13.5h1m8 0h1m4 0h1m1 0h1m1 0h3m1 0h2m1 0h1m1 0h1M2 14.5h1m5 0h1m1 0h2m1 0h4m2 0h3m5 0h2M2 15.5h1m1 0h2m3 0h1m1 0h4m3 0h4m2 0h1m1 0h1m3 0h1M2 16.5h1m2 0h2m1 0h1m1 0h1m5 0h2m7 0h1m1 0h2M3 17.5h2m1 0h1m5 0h1m1 0h1m2 0h2m4 0h1m1 0h2m2 0h1M2 18.5h1m2 0h1m1 0h2m1 0h3m1 0h1m2 0h1m1 0h1m2 0h1m2 0h1m1 0h2M2 19.5h2m5 0h1m2 0h1m2 0h1m2 0h5m1 0h3m1 0h1m1 0h1M2 20.5h1m2 0h1m2 0h1m1 0h1m1 0h1m1 0h5m1 0h1m1 0h1m2 0h1m2 0h1M2 21.5h1m6 0h1m3 0h3m2 0h1m3 0h1m2 0h2m2 0h1M2 22.5h1m2 0h1m1 0h2m1 0h1m1 0h1m1 0h1m1 0h1m2 0h1m2 0h5m1 0h3M10 23.5h1m10 0h2m3 0h5M2 24.5h7m3 0h1m1 0h1m2 0h2m1 0h3m1 0h1m1 0h3M2 25.5h1m5 0h1m1 0h1m5 0h1m3 0h3m3 0h1m2 0h1M2 26.5h1m1 0h3m1 0h1m1 0h1m1 0h2m3 0h1m1 0h2m1 0h5m1 0h3M2 27.5h1m1 0h3m1 0h1m1 0h1m1 0h3m1 0h1m1 0h4m3 0h1m1 0h4M2 28.5h1m1 0h3m1 0h1m1 0h1m2 0h1m2 0h4m2 0h8M2 29.5h1m5 0h1m3 0h2m1 0h2m3 0h3m2 0h1m1 0h1m1 0h1M2 30.5h7m1 0h1m2 0h3m1 0h1m1 0h1m1 0h1m1 0h1m1 0h4"/></svg>'
)}`

export default function DownloadPage() {
  const router = useRouter()
  const { openDrawer, openNotificationPanel } = useUIStore()
  const hasActiveJobs = useProcessingJobsStore((s) => s.jobs.some((j) => j.status === 'processing'))
  const [status, setStatus] = useState<BuildStatus | null>(null)
  const [userAvatar, setUserAvatar] = useState<string>('/assets/avatars/01.png')
  const [userName, setUserName] = useState<string>('Learner')
  const [userHandle, setUserHandle] = useState<string>('@learner')
  const [showQrModal, setShowQrModal] = useState(false)

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
      supabase.auth.getSession().then(({ data }: any) => {
        const user = data?.session?.user
        if (!user) return
        const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || '/assets/avatars/01.png'
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Learner'
        const handle = '@' + (user.email?.split('@')[0] || 'studyup').toLowerCase().replace(/[^a-z0-9_]/g, '')
        setUserAvatar(avatar)
        setUserName(name)
        setUserHandle(handle)
        if (typeof window !== 'undefined') {
          localStorage.setItem('studyup_cached_user_avatar', avatar)
          localStorage.setItem('studyup_user_name', name)
        }
      })
    } catch {}

    fetch('/api/download/status', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: BuildStatus) => setStatus(data))
      .catch(() => {})
  }, [])

  const primaryDownloadHref = status?.apkUrl || '/api/download/apk'

  return (
    <div id="tab-android" className="tab-pane flex-1 flex flex-col pb-4 relative z-10">
      {/* Purple Wavy Header (1:1 Reference) */}
      <div className="purple-wave-header pb-8 pt-3 px-5 relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10" viewBox="0 0 356 200" preserveAspectRatio="none">
          <path d="M0,0 L356,0 L356,86 C285,106 235,38 140,24 C65,12 25,34 0,48 Z" fill="#0B0320" fillOpacity="0.48" />
        </svg>

        <div className="h-10 flex items-center justify-between relative z-20 mb-2 text-white">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('thocky')
              router.push('/')
            }}
            className="w-9 h-9 flex items-center justify-center text-white/90 hover:text-white active:scale-90 transition cursor-pointer"
            title="Back to Library"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <h2 className="text-[18px] font-extrabold text-white tracking-tight">Android App</h2>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('thocky')
              openNotificationPanel()
            }}
            className="relative w-9 h-9 flex items-center justify-center text-white/90 hover:text-white active:scale-90 transition cursor-pointer"
            title="Download & Processing Queue"
          >
            <Bell className="w-5 h-5 text-white/90" />
            {hasActiveJobs && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse ring-2 ring-[#0F0E17]" />
            )}
          </button>
        </div>

        <div className="relative z-20 pt-1.5 pb-4 flex items-center gap-3.5">
          <img
            src={userAvatar || '/assets/avatars/01.png'}
            alt={userName}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).src = '/assets/avatars/01.png'
            }}
            className="w-12 h-12 rounded-full object-cover border-2 border-white/40 shadow-md shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-display text-white text-[19px] font-extrabold tracking-tight truncate">{userName}</h1>
            <p className="text-[#C4B5FD] text-[12px] font-medium truncate">{userHandle} &bull; Android Sync Active</p>
          </div>
        </div>

        <svg className="absolute -bottom-[2px] left-0 w-full h-[40px] pointer-events-none z-10 block overflow-visible" viewBox="0 0 356 40" fill="none" preserveAspectRatio="none">
          <path d="M0,16 C38,0 78,0 118,16 C158,32 198,32 238,16 C278,0 318,0 356,16 L356,42 L0,42 Z" fill="#DDD6FE" fillOpacity="0.32" />
          <path d="M0,21 C38,5 78,5 118,21 C158,37 198,37 238,21 C278,5 318,5 356,21 L356,42 L0,42 Z" fill="#0b0c14" />
        </svg>
      </div>

      {/* Content Below Wave (Unboxed Preferences + Interactive Client Rows) */}
      <div className="px-5 pt-2.5 pb-4 space-y-5 relative z-20 -mt-[1px] bg-gradient-to-b from-[#0b0c14] via-[#0b0c14]/40 to-transparent">
        <div>
          <h2 className="font-display text-[17px] font-extrabold text-white tracking-tight mb-2.5">Preferences</h2>
          <div className="divide-y divide-[#222536]">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[14px] font-bold text-white">Offline Syllabus Cache</span>
              <span className="text-[12px] font-semibold text-[#8e92a8]">Enabled</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[14px] font-bold text-white">Haptic Feedback</span>
              <span className="text-[12px] font-semibold text-[#8e92a8]">On</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display text-[17px] font-extrabold text-white tracking-tight mb-2.5">Client &amp; Settings</h2>
          <div className="divide-y divide-[#222536]">
            <a
              href={primaryDownloadHref}
              download="StudyUp.apk"
              onClick={() => soundEngine.playBrush(0.5)}
              className="group py-3 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#201833] text-[#A78BFA] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div>
                  <div className="text-[14px] font-bold text-white relative inline-block after:content-[''] after:absolute after:-bottom-0.5 after:left-0 after:w-0 after:h-[2px] after:bg-[#A78BFA] group-hover:after:w-full after:transition-all after:duration-300">
                    Direct APK Download
                  </div>
                  <div className="text-[11px] text-[#8e92a8]">
                    Offline standalone package for Android {status?.sizeFormatted ? `(${status.sizeFormatted})` : ''}
                  </div>
                </div>
              </div>
              <span className="relative text-[12px] font-extrabold text-[#A78BFA] after:content-[''] after:absolute after:-bottom-0.5 after:left-0 after:w-0 after:h-[2px] after:bg-[#A78BFA] group-hover:after:w-full after:transition-all after:duration-300">
                Download
              </span>
            </a>

            <div
              onClick={() => {
                soundEngine.playBrush(0.5)
                setShowQrModal(true)
              }}
              className="group py-3 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#201833] text-[#A78BFA] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </div>
                <div>
                  <div className="text-[14px] font-bold text-white relative inline-block after:content-[''] after:absolute after:-bottom-0.5 after:left-0 after:w-0 after:h-[2px] after:bg-[#A78BFA] group-hover:after:w-full after:transition-all after:duration-300">
                    QR Code Install
                  </div>
                  <div className="text-[11px] text-[#8e92a8]">Scan with phone camera</div>
                </div>
              </div>
              <svg className="w-4 h-4 text-[#8e92a8] group-hover:text-white transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Account / Session Sign Out */}
        <div className="pt-2">
          <SignOutButton className="w-full" />
        </div>
      </div>

      {/* APK QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => setShowQrModal(false)}>
          <div className="w-full max-w-[340px] rounded-2xl border-2 border-[#222536] bg-[#151722] shadow-[0px_6px_0px_0px_#141622] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold text-white mb-1">StudyUp for Android</h2>
            <p className="text-[13px] text-[#8e92a8] mb-4">Scan or tap below for offline study.</p>

            <div className="bg-white p-3 rounded-[18px] inline-block mb-4">
              <img src={STATIC_QR_SVG} alt="QR Code" className="w-44 h-44 object-contain" />
            </div>

            <div className="flex flex-col gap-2">
              <a
                data-slot="button"
                data-variant="default"
                href={primaryDownloadHref}
                download="StudyUp.apk"
                className="h-11 px-5 rounded-[14px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-[14px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#6b21a8] tactile-btn flex items-center justify-center w-full"
              >
                Download StudyUp.apk
              </a>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full py-2 text-[13px] font-extrabold text-[#8e92a8] hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>&larr;</span>
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
