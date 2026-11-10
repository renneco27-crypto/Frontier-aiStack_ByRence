'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useStatsStore } from '@/store/statsStore'
import { Bell } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useProcessingJobsStore } from '@/store/processingJobsStore'
import { fetchLeaderboardFromSupabase, LeaderboardUser } from '@/features/stats/supabaseSync'
import { maskName } from '@/lib/maskName'
import { soundEngine } from '@/utils/soundEngine'

type SortTab = 'correct' | 'streak' | 'mastery'

const FALLBACK_AVATARS = [
  '/assets/avatars/01.png',
  '/assets/avatars/02.png',
  '/assets/avatars/03.png',
  '/assets/avatars/04.png',
  '/assets/avatars/05.png',
  '/assets/avatars/06.png',
  '/assets/avatars/07.png',
  '/assets/avatars/08.png',
  '/assets/avatars/09.png',
  '/assets/avatars/10.png',
]

export default function LeaderboardPage() {
  const router = useRouter()
  const stats = useStatsStore((s) => s.stats)
  const { selectedDeckId, openDrawer, openNotificationPanel } = useUIStore()
  const hasActiveJobs = useProcessingJobsStore((s) => s.jobs.some((j) => j.status === 'processing'))
  const [activeTab, setActiveTab] = useState<SortTab>('correct')
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [weeklyBaseline, setWeeklyBaseline] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    // Load cached leaderboard immediately if offline or fast-rendering
    try {
      const cached = localStorage.getItem('studyup_cached_leaderboard')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUsers(parsed)
          setLoading(false)
        }
      }
    } catch {}

    fetchLeaderboardFromSupabase(stats)
      .then((data) => {
        if (data && data.length > 0) {
          setUsers((prev) => {
            if (data.length <= 1 && prev.length > 1) {
              return prev
            }
            return data
          })
          if (data.length > 1) {
            try {
              localStorage.setItem('studyup_cached_leaderboard', JSON.stringify(data))
            } catch {}
          }
        }

        // Snapshot every user's metrics once per 7 days; deltas are measured against it
        try {
          const KEY = 'studyup_lb_weekly_baseline'
          const WEEK_MS = 7 * 24 * 60 * 60 * 1000
          const raw = localStorage.getItem(KEY)
          let saved: { takenAt: number; values: Record<string, Record<string, number>> } | null = raw ? JSON.parse(raw) : null
          if (!saved || Date.now() - saved.takenAt >= WEEK_MS) {
            saved = { takenAt: Date.now(), values: { correct: {}, streak: {}, mastery: {} } }
          }
          for (const u of data) {
            if (saved.values.correct[u.userId] === undefined) {
              saved.values.correct[u.userId] = (u.totalCorrect || 0) * 15 + (u.dayStreak || 0) * 50
              saved.values.streak[u.userId] = u.dayStreak || 0
              saved.values.mastery[u.userId] = u.masteryPercent || 0
            }
          }
          localStorage.setItem(KEY, JSON.stringify(saved))
          setWeeklyBaseline(saved.values)
        } catch {}
      })
      .finally(() => setLoading(false))
  }, [stats])

  const getXP = (u?: LeaderboardUser) => {
    if (!u) return 0
    return (u.totalCorrect || 0) * 15 + (u.dayStreak || 0) * 50
  }

  // Deduplicate users (e.g. from multiple DBs or local cache): always keep the HIGHER stats
  const dedupedUsers = useMemo(() => {
    const map = new Map<string, LeaderboardUser>()
    for (const u of users) {
      const name = (u.displayName || '').toLowerCase().trim()
      const key = (name && name !== 'learner' && name !== 'you') ? `name:${name}` : u.userId
      if (!map.has(key)) {
        map.set(key, u)
      } else {
        const existing = map.get(key)!
        map.set(key, {
          ...existing,
          userId: existing.isCurrentUser ? existing.userId : u.userId,
          displayName: existing.displayName && existing.displayName !== 'Learner' ? existing.displayName : u.displayName,
          avatarUrl: existing.avatarUrl || u.avatarUrl,
          totalCorrect: Math.max(existing.totalCorrect || 0, u.totalCorrect || 0),
          masteryPercent: Math.max(existing.masteryPercent || 0, u.masteryPercent || 0),
          dayStreak: Math.max(existing.dayStreak || 0, u.dayStreak || 0),
          isCurrentUser: existing.isCurrentUser || u.isCurrentUser,
        })
      }
    }
    return Array.from(map.values())
  }, [users])

  const sortedUsers = [...dedupedUsers].sort((a, b) => {
    if (activeTab === 'streak') {
      return (b.dayStreak || 0) - (a.dayStreak || 0) || getXP(b) - getXP(a)
    }
    if (activeTab === 'mastery') {
      return (b.masteryPercent || 0) - (a.masteryPercent || 0) || getXP(b) - getXP(a)
    }
    return getXP(b) - getXP(a) || (b.totalCorrect || 0) - (a.totalCorrect || 0)
  })

  const formatMetric = (u?: LeaderboardUser) => {
    if (!u) return '0'
    if (activeTab === 'streak') return `${u.dayStreak || 0}d`
    if (activeTab === 'mastery') return `${u.masteryPercent || 0}%`
    return String(getXP(u))
  }

  const getAvatar = (u: LeaderboardUser | undefined, idx: number) => {
    if (u?.avatarUrl) return u.avatarUrl
    return FALLBACK_AVATARS[idx % FALLBACK_AVATARS.length]
  }

  const rank1 = sortedUsers[0]
  const rank2 = sortedUsers[1]
  const rank3 = sortedUsers[2]
  const restUsers = sortedUsers.slice(3)

  // Weekly won/lost: compare each user's current metric against a 7-day baseline snapshot
  const metricValue = (u: LeaderboardUser) => {
    if (activeTab === 'streak') return u.dayStreak || 0
    if (activeTab === 'mastery') return u.masteryPercent || 0
    return (u.totalCorrect || 0) * 15 + (u.dayStreak || 0) * 50
  }

  const weeklyDelta = (u: LeaderboardUser) => {
    const base = weeklyBaseline[activeTab]?.[u.userId]
    if (base === undefined) return 0
    return metricValue(u) - base
  }

  const formatDelta = (delta: number) => {
    const sign = delta > 0 ? '+' : delta < 0 ? '-' : ''
    const abs = Math.abs(delta)
    return `${sign}${abs}${activeTab === 'streak' ? 'd' : activeTab === 'mastery' ? '%' : ''}`
  }

  return (
    <div id="tab-league" className="tab-pane flex-1 flex flex-col pb-4 relative z-10">
      {/* Top Pointed Shield Banner Header (1:1 Reference) */}
      <div className="leaderboard-shield-header pt-3 pb-9 px-4 relative overflow-hidden select-none">
        {/* Top Bar: Back / Title / Menu (Bare top icons - no card divs) */}
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

          <h2 className="text-[18px] font-extrabold text-white tracking-tight">Leader Board</h2>

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

        {/* Pill Tab Switcher with smooth sliding transition */}
        <div className="p-1 rounded-full bg-[#3b0764]/65 border-2 border-white/20 flex items-center max-w-xs mx-auto mb-3 relative z-20">
          {/* Sliding active pill indicator */}
          <div
            className="absolute top-1 bottom-1 rounded-full bg-white shadow-[0px_3px_0px_0px_#cbd5e1] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] pointer-events-none"
            style={{
              width: 'calc((100% - 8px) / 3)',
              left:
                activeTab === 'correct'
                  ? '4px'
                  : activeTab === 'streak'
                    ? 'calc(4px + (100% - 8px) / 3)'
                    : 'calc(4px + (100% - 8px) * 2 / 3)',
            }}
          />
          {(['correct', 'streak', 'mastery'] as SortTab[]).map((tab) => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  soundEngine.play('thocky')
                  setActiveTab(tab)
                }}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs uppercase tracking-wider transition-colors duration-200 cursor-pointer relative z-10 text-center ${
                  isActive
                    ? 'text-[#0b0c14] font-black'
                    : 'text-white/80 hover:text-white font-bold'
                }`}
              >
                {tab === 'correct' ? 'XP' : tab === 'streak' ? 'Streak' : 'Mastery'}
              </button>
            )
          })}
        </div>

        {/* Top 3 Podium (#2 Left, #1 Center Elevated, #3 Right) */}
        <div className="flex items-end justify-center gap-5 pt-2 pb-1 px-1 relative z-20">
          {/* Rank 2 (Left) */}
          <div className="flex flex-col items-center min-w-[76px]">
            <div className="relative mb-1.5">
              <div className="w-[66px] h-[66px] rounded-full overflow-hidden border-2 border-white/60 shadow-md bg-[#151722]">
                <img
                  src={getAvatar(rank2, 1)}
                  alt={rank2?.displayName || 'Rank 2'}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_AVATARS[1 % FALLBACK_AVATARS.length] }}
                />
              </div>
              <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-white text-black font-extrabold text-[11px] flex items-center justify-center shadow-md">
                2
              </div>
            </div>
            <span className="text-[14px] font-extrabold text-white tracking-tight leading-tight max-w-[84px] truncate">
              {rank2 ? maskName(rank2.displayName) : '—'}
            </span>
            <span className="text-[11.5px] font-semibold text-white/80 tracking-wide mt-0.5">
              {formatMetric(rank2)}
            </span>
          </div>

          {/* Rank 1 (Center, Elevated & Larger) */}
          <div className="flex flex-col items-center -mt-4 min-w-[88px]">
            <div className="relative mb-1.5">
              <div className="w-[82px] h-[82px] rounded-full overflow-hidden border-[2.5px] border-white shadow-lg ring-4 ring-white/20 bg-[#151722]">
                <img
                  src={getAvatar(rank1, 0)}
                  alt={rank1?.displayName || 'Rank 1'}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_AVATARS[0] }}
                />
              </div>
              <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-white text-black font-extrabold text-[12px] flex items-center justify-center shadow-md">
                1
              </div>
            </div>
            <span className="text-[15.5px] font-extrabold text-white tracking-tight leading-tight max-w-[96px] truncate">
              {rank1 ? maskName(rank1.displayName) : '—'}
            </span>
            <span className="text-[12px] font-semibold text-white/85 tracking-wide mt-0.5">
              {formatMetric(rank1)}
            </span>
          </div>

          {/* Rank 3 (Right) */}
          <div className="flex flex-col items-center min-w-[76px]">
            <div className="relative mb-1.5">
              <div className="w-[66px] h-[66px] rounded-full overflow-hidden border-2 border-white/60 shadow-md bg-[#151722]">
                <img
                  src={getAvatar(rank3, 2)}
                  alt={rank3?.displayName || 'Rank 3'}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_AVATARS[2 % FALLBACK_AVATARS.length] }}
                />
              </div>
              <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-white text-black font-extrabold text-[11px] flex items-center justify-center shadow-md">
                3
              </div>
            </div>
            <span className="text-[14px] font-extrabold text-white tracking-tight leading-tight max-w-[84px] truncate">
              {rank3 ? maskName(rank3.displayName) : '—'}
            </span>
            <span className="text-[11.5px] font-semibold text-white/80 tracking-wide mt-0.5">
              {formatMetric(rank3)}
            </span>
          </div>
        </div>
      </div>

      {/* Ranks List (Surface Data Rows - No Card Divs) */}
      <div className="px-4 pt-3 flex-1 flex flex-col justify-between">
        <div id="leaderboardList" className="divide-y divide-[#222536] pb-3">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="py-3 px-2 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3.5">
                  <div className="w-5 h-4 bg-[#222536] rounded" />
                  <div className="w-9 h-9 rounded-full bg-[#222536]" />
                  <div className="w-28 h-4 bg-[#222536] rounded" />
                </div>
                <div className="w-14 h-4 bg-[#222536] rounded" />
              </div>
            ))
          ) : (
            (restUsers.length > 0 ? restUsers : sortedUsers).map((user, idx) => {
              const rank = restUsers.length > 0 ? idx + 4 : idx + 1
              const isSelf = user.isCurrentUser
              const delta = weeklyDelta(user)

              return (
                <div
                  key={user.userId}
                  className={`py-3 px-2.5 flex items-center justify-between ${
                    isSelf ? 'bg-[#9333ea]/10 border-l-2 border-[#a855f7]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-5 text-center text-[14px] font-bold text-[#9ca0b5]">{rank}</span>
                    <img
                      src={getAvatar(user, rank - 1)}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10"
                      alt={user.displayName}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_AVATARS[(rank - 1) % FALLBACK_AVATARS.length] }}
                    />
                    <span className="text-[14.5px] font-bold text-white truncate">
                      {maskName(user.displayName)}
                      {isSelf && <span className="text-[#c084fc] ml-1">(You)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[14px] font-extrabold text-white">{formatMetric(user)}</span>
                    <span
                      className={`text-[11px] font-black ml-1 min-w-[34px] text-right ${
                        delta > 0 ? 'text-[#10B981]' : delta < 0 ? 'text-[#EF4444]' : 'text-[#8e92a8]'
                      }`}
                      title="This week"
                    >
                      {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {delta !== 0 ? formatDelta(delta) : ''}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
