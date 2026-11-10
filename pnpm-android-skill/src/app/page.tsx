'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useStatsStore } from '@/store/statsStore'
import { useUIStore } from '@/store/uiStore'
import { useProcessingJobsStore } from '@/store/processingJobsStore'
import PastDecks from '@/features/upload/PastDecks'
import ShootingStarsBackground from '@/components/ShootingStarsBackground'
import { getStreakStatus } from '@/features/stats/statsCalculator'
import { fetchStatsFromSupabase, syncStatsToSupabase } from '@/features/stats/supabaseSync'
import { soundEngine } from '@/utils/soundEngine'

export default function Home() {
  const stats = useStatsStore((s) => s.stats)
  const { openNotificationPanel } = useUIStore()
  const jobs = useProcessingJobsStore((s) => s.jobs)
  const hasActiveJobs = jobs.some((j) => j.status === 'processing' || j.status === 'queued')
  const [dbTotalStreak, setDbTotalStreak] = useState<number | null>(null)

  const deckStats = Object.values(stats).filter((s) => s && s.lastStudied)
  const localTotalStreak = deckStats.reduce(
    (max, s) => Math.max(max, s.studyStreak ?? 0),
    0
  )
  const localStudiedToday = deckStats.filter(
    (s) => getStreakStatus(s.lastStudied) === 'today'
  ).length

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    }
  }, [])

  useEffect(() => {
    fetchStatsFromSupabase().then((dbStats) => {
      if (dbStats) {
        setDbTotalStreak(dbStats.total_streak)
      }
    })
  }, [])

  useEffect(() => {
    syncStatsToSupabase(stats).then(async () => {
      const dbStats = await fetchStatsFromSupabase()
      if (dbStats) {
        setDbTotalStreak(dbStats.total_streak)
      }
    })
  }, [stats, localStudiedToday])

  const totalStreak = dbTotalStreak !== null ? Math.max(dbTotalStreak, localTotalStreak) : localTotalStreak

  return (
    <div id="tab-library" className="tab-pane flex-1 flex flex-col pb-4 relative z-10 snap-y snap-proximity">
      {/* Purple Wavy Header Block (Same wave position as Public Feed) */}
      <div className="purple-wave-header pb-10 pt-3 px-5 relative overflow-hidden snap-start">
          {/* Internal Deep Indigo S-Curve Wave Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10" viewBox="0 0 356 200" preserveAspectRatio="none">
            <path d="M0,0 L356,0 L356,86 C285,106 235,38 140,24 C65,12 25,34 0,48 Z" fill="#0B0320" fillOpacity="0.48" />
          </svg>

          {/* Topbar Row: Glowing Gradient STUDYUP (Left) and Notification Bell (Right matching Public Feed) */}
          <div className="h-10 flex items-center justify-between relative z-20 mb-2 text-white">
            {/* Glowing Smooth Gradient STUDYUP on the left */}
            <div className="flex items-center drop-shadow-[0_2px_12px_rgba(244,63,94,0.45)]">
              <span className="text-[19px] font-black tracking-widest uppercase select-none bg-gradient-to-r from-[#38bdf8] via-[#ff385c] to-[#c084fc] bg-clip-text text-transparent inline-block">
                STUDYUP
              </span>
            </div>

            {/* Notification Bell on the right */}
            <button
              type="button"
              onClick={() => {
                soundEngine.play('thocky')
                openNotificationPanel()
              }}
              className="w-9 h-9 flex items-center justify-center text-white/90 hover:text-white active:scale-90 transition cursor-pointer relative"
              title="Processing Decks & Activity"
            >
              <Bell size={21} className="stroke-[2.2]" />
              {hasActiveJobs && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#c084fc] ring-2 ring-[#0B0320] animate-pulse" />
              )}
            </button>
          </div>

          {/* Header Row: "My Library" Title on Left + Raw Unboxed Fire Streak directly below */}
          <div className="relative z-20 pt-1 pb-2">
            <h1 className="font-display text-[27px] font-extrabold text-white tracking-tight leading-tight mb-1">
              My Library
            </h1>

            {/* Fire Streak transferred directly below My Library (Raw / Unboxed, No wrapper div styling) */}
            <div className="relative flex items-center justify-start w-fit select-none">
              <img
                src="/assets/images/fire-transparent.gif"
                alt="Fire Streak"
                className="object-contain drop-shadow-[0_2px_14px_rgba(249,115,22,0.55)]"
                style={{ width: '44px', height: '44px' }}
              />
              <span className="absolute inset-0 flex items-center justify-center pt-2 translate-y-[2px] text-[12px] font-black text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)] tracking-tighter">
                {totalStreak}
              </span>
            </div>
            <span className="text-[12.5px] font-black text-[#FB923C] tracking-wide block drop-shadow-[0_2px_8px_rgba(249,115,22,0.35)]">
              Day Streak
            </span>
          </div>

          {/* Mascot peeking over the wave line */}
          <div className="absolute right-2 -bottom-[28px] w-[165px] h-[165px] z-0 pointer-events-none">
            <img
              src="/assets/images/mascot_with_hat.png"
              alt=""
              className="w-full h-full object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.6)] mascot-float-idle"
            />
          </div>

          {/* Signature Wavy Fill Divider at Header Base (Same position and curve as Public Feed) */}
          <svg className="absolute -bottom-[2px] left-0 w-full h-[40px] pointer-events-none z-10 block overflow-visible" viewBox="0 0 356 40" fill="none" preserveAspectRatio="none">
            <path d="M0,16 C38,0 78,0 118,16 C158,32 198,32 238,16 C278,0 318,0 356,16 L356,42 L0,42 Z" fill="#DDD6FE" fillOpacity="0.32" />
            <path d="M0,21 C38,5 78,5 118,21 C158,37 198,37 238,21 C278,5 318,5 356,21 L356,42 L0,42 Z" fill="#0b0c14" />
          </svg>
        </div>

      {/* Below the Wiggly Line: UP NEXT + Choose Deck to Study */}
      <div className="relative z-20 -mt-[1px] pt-[1px] bg-gradient-to-b from-[#0b0c14] via-[#0b0c14]/40 to-transparent flex-1">
        <ShootingStarsBackground />
        <div className="relative z-10 pb-4">
          <PastDecks />
        </div>
      </div>
    </div>
  )
}
