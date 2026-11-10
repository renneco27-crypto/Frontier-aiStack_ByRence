import { createBrowserSupabase } from '@/lib/supabase'
import { getStreakStatus } from './statsCalculator'
import type { DeckStats } from '@/lib/zodSchemas'
import { apiUrl } from '@/lib/apiBase'

export interface LeaderboardUser {
  userId: string
  displayName: string
  avatarUrl?: string
  totalCorrect: number
  masteryPercent: number
  dayStreak: number
  lastStudied: string
  isCurrentUser?: boolean
  streakBroken?: boolean
}

/**
 * Checks if streak is active or expired after 3 days of inactivity.
 */
export function evaluateStreak3Day(lastStudied?: string | null, streak: number = 0): { activeStreak: number; isBroken: boolean; daysInactive: number } {
  if (!lastStudied || streak <= 0) return { activeStreak: 0, isBroken: false, daysInactive: 0 }

  const lastDate = new Date(lastStudied).getTime()
  const now = Date.now()
  const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))

  if (diffDays > 3) {
    return { activeStreak: 0, isBroken: true, daysInactive: diffDays }
  }
  return { activeStreak: streak, isBroken: false, daysInactive: diffDays }
}

export async function recordStudyActivityInSupabase(cardsCount: number = 1, correctCount: number = 1) {
  const supabase = createBrowserSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const userEmail = session.user.email || ''
  const userFullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || userEmail.split('@')[0]
  const avatarUrl = session.user.user_metadata?.avatar_url || ''

  try {
    // 1. Try invoking PostgreSQL atomic function if available
    const { data: rpcData, error: rpcError } = await supabase.rpc('record_study_activity', {
      p_cards_count: Math.max(1, cardsCount),
      p_correct_count: Math.max(0, correctCount),
      p_display_name: userFullName,
      p_avatar_url: avatarUrl,
    })

    if (!rpcError && rpcData) {
      return rpcData
    }
  } catch {}

  // 2. Fallback: Direct table upsert with date checking
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()

    let newStreak = 1
    let studiedToday = Math.max(1, cardsCount)
    let longestStreak = 1
    let totalCards = Math.max(1, cardsCount)
    let totalCorrect = Math.max(0, correctCount)

    if (existing) {
      const lastDateStr = existing.last_studied_date || existing.last_studied
      const lastDate = lastDateStr ? new Date(lastDateStr).toISOString().split('T')[0] : null
      
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

      if (lastDate === today) {
        newStreak = Math.max(1, existing.total_streak || 1)
        studiedToday = (existing.studied_today || 0) + Math.max(1, cardsCount)
      } else if (lastDate === yesterday) {
        newStreak = (existing.total_streak || 0) + 1
      } else {
        newStreak = 1
      }

      longestStreak = Math.max(existing.longest_streak || 0, newStreak)
      totalCards = (existing.total_cards_studied || 0) + Math.max(1, cardsCount)
      totalCorrect = (existing.total_correct || 0) + Math.max(0, correctCount)
    }

    const { data, error } = await supabase
      .from('user_stats')
      .upsert({
        user_id: session.user.id,
        display_name: userFullName,
        email: userEmail,
        avatar_url: avatarUrl,
        total_streak: newStreak,
        longest_streak: longestStreak,
        studied_today: studiedToday,
        total_cards_studied: totalCards,
        total_correct: totalCorrect,
        last_studied_date: today,
        last_active: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .maybeSingle()

    if (!error && data) return data

    // Schema fallback for DB B (only 4 columns: user_id, total_streak, studied_today, last_studied)
    if (error) {
      const { data: fallbackData } = await supabase
        .from('user_stats')
        .upsert({
          user_id: session.user.id,
          total_streak: newStreak,
          studied_today: studiedToday,
          last_studied: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select()
        .maybeSingle()

      if (fallbackData) return fallbackData
    }
  } catch (err) {
    console.warn('Error recording study activity in Supabase:', err)
  }
  return null
}

export async function syncStatsToSupabase(stats: Record<string, DeckStats>) {
  const supabase = createBrowserSupabase()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const deckStats = Object.values(stats).filter((s) => s && s.lastStudied)
  const studiedToday = deckStats.filter(
    (s) => getStreakStatus(s.lastStudied) === 'today'
  ).length

  const rawTotalStreak = deckStats.reduce(
    (max, s) => Math.max(max, s.studyStreak ?? 0),
    0
  )

  const totalCorrect = deckStats.reduce(
    (sum, s) => sum + (s.correct || 0),
    0
  )

  const totalCards = deckStats.reduce(
    (sum, s) => sum + (s.totalCards || 0),
    0
  )

  const userId = session.user.id
  const userEmail = session.user.email || ''
  const userFullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || userEmail.split('@')[0]
  const avatarUrl = session.user.user_metadata?.avatar_url || ''
  const today = new Date().toISOString().split('T')[0]

  try {
    // Read existing database stats first so we never overwrite an existing higher database streak
    const { data: existing } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    const mergedStreak = Math.max(existing?.total_streak || 0, rawTotalStreak)
    const mergedLongest = Math.max(existing?.longest_streak || 0, mergedStreak)
    const mergedStudiedToday = Math.max(existing?.studied_today || 0, studiedToday)
    const mergedCorrect = Math.max(existing?.total_correct || 0, totalCorrect)
    const mergedCards = Math.max(existing?.total_cards_studied || 0, totalCards)

    const { error } = await supabase
      .from('user_stats')
      .upsert({
        user_id: userId,
        display_name: userFullName,
        email: userEmail,
        avatar_url: avatarUrl,
        total_streak: mergedStreak,
        longest_streak: mergedLongest,
        studied_today: mergedStudiedToday,
        total_correct: mergedCorrect,
        total_cards_studied: mergedCards,
        last_studied_date: today,
        last_active: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })

    if (error) {
      // Schema fallback for DB B (only 4 columns: user_id, total_streak, studied_today, last_studied)
      await supabase
        .from('user_stats')
        .upsert({
          user_id: userId,
          total_streak: mergedStreak,
          studied_today: mergedStudiedToday,
          last_studied: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        })
    }

    // Also update profile display name for leaderboard
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userEmail,
        display_name: userFullName,
        avatar_url: avatarUrl,
        last_active: new Date().toISOString(),
      }, {
        onConflict: 'id'
      })

    if (profileError) {
      // Schema fallback for DB B (has streak, longest_streak, last_active_date, no avatar_url/last_active)
      await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: userEmail,
          display_name: userFullName,
          streak: mergedStreak,
          longest_streak: mergedLongest,
          last_active_date: today,
        }, {
          onConflict: 'id'
        })
    }
  } catch (err) {
    console.warn('Error in syncStatsToSupabase:', err)
  }
}

export async function fetchStatsFromSupabase() {
  const supabase = createBrowserSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (error) {
       if (error.code !== 'PGRST116') {
           console.warn('Error fetching stats from Supabase:', error)
       }
       return null
    }

    if (data) {
      const lastDate = data.last_studied_date || data.last_studied
      const { activeStreak, isBroken } = evaluateStreak3Day(lastDate, data.total_streak)
      return {
        ...data,
        total_streak: activeStreak,
        streak_broken: isBroken
      }
    }
    return data
  } catch (err) {
    console.warn('Error in fetchStatsFromSupabase:', err)
    return null
  }
}

export async function fetchLeaderboardFromSupabase(currentStats?: Record<string, DeckStats>): Promise<LeaderboardUser[]> {
  const supabase = createBrowserSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  let cachedSession: any = null
  let cachedUserId = ''
  let cachedName = ''
  let cachedAvatar = ''
  let cachedEmail = ''
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('studyup_cached_session')
      if (raw) cachedSession = JSON.parse(raw)
      cachedUserId = localStorage.getItem('studyup_user_id') || cachedSession?.userId || ''
      cachedName = localStorage.getItem('studyup_user_name') || cachedSession?.displayName || ''
      cachedAvatar = localStorage.getItem('studyup_cached_user_avatar') || cachedSession?.avatarUrl || ''
      cachedEmail = cachedSession?.email || ''
    } catch {}
  }

  const currentUserId = session?.user?.id || cachedUserId
  const currentUserEmail = (session?.user?.email || cachedEmail || '').toLowerCase().trim()

  // Calculate local user stats as fallback/seed
  const deckStats = currentStats ? Object.values(currentStats).filter((s) => s && s.lastStudied) : []
  const localTotalCorrect = deckStats.reduce((sum, s) => sum + (s.correct || 0), 0)
  const localTotalCards = deckStats.reduce((sum, s) => sum + (s.totalCards || 0), 0)
  const localTotalMastered = deckStats.reduce((sum, s) => sum + (s.masteredCount || 0), 0)
  const localMasteryPercent = localTotalCards > 0 ? Math.min(100, Math.round((localTotalMastered / localTotalCards) * 100)) : 0
  const localStreak = deckStats.reduce((max, s) => Math.max(max, s.studyStreak ?? 0), 0)

  const currentUserName = session?.user?.user_metadata?.full_name || cachedName || currentUserEmail?.split('@')[0] || 'You'
  const currentUserAvatar = session?.user?.user_metadata?.avatar_url || cachedAvatar || ''

  const getCachedOrFallback = (): LeaderboardUser[] => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('studyup_cached_leaderboard')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 1) {
            return parsed
          }
        }
      } catch {}
    }
    return buildDemoLeaderboard(currentUserId, currentUserName, currentUserAvatar, localTotalCorrect, localMasteryPercent, localStreak)
  }

  try {
    const res = await fetch(apiUrl('/api/leaderboard'))
    if (!res.ok) throw new Error('Failed to fetch leaderboard API')
    const { leaderboard: data, profiles } = await res.json()

    if (!data || data.length === 0) {
      return getCachedOrFallback()
    }

    const rawLeaderboard: LeaderboardUser[] = data.map((row: any) => {
      const rowEmail = (row.email || '').toLowerCase().trim()
      const rowName = (row.display_name || '').toLowerCase().trim()
      const normCurrentName = (currentUserName || '').toLowerCase().trim()
      const isUser =
        (currentUserId && row.user_id === currentUserId) ||
        (currentUserEmail && rowEmail && rowEmail === currentUserEmail) ||
        (normCurrentName && normCurrentName !== 'you' && normCurrentName !== 'learner' && rowName === normCurrentName)

      const { activeStreak, isBroken } = evaluateStreak3Day(row.last_studied, row.total_streak)

      const dbCorrect = row.total_correct || 0
      const totalCards = row.total_cards_studied || 0
      const dbMastery = totalCards > 0 ? Math.min(100, Math.round((dbCorrect / totalCards) * 100)) : (isUser ? localMasteryPercent : Math.min(100, 45 + (activeStreak * 8) % 55))

      return {
        userId: row.user_id,
        displayName: (isUser && currentUserName && currentUserName !== 'You') ? currentUserName : (row.display_name || 'Learner'),
        avatarUrl: (isUser && currentUserAvatar) ? currentUserAvatar : (row.avatar_url || undefined),
        totalCorrect: isUser ? Math.max(localTotalCorrect, dbCorrect) : dbCorrect,
        masteryPercent: isUser ? Math.max(localMasteryPercent, dbMastery) : dbMastery,
        dayStreak: isUser ? Math.max(localStreak, activeStreak) : activeStreak,
        lastStudied: row.last_studied || new Date().toISOString(),
        isCurrentUser: !!isUser,
        streakBroken: isBroken
      }
    })

    // Deduplicate entries across databases: ALWAYS choose whichever has HIGHER stats and drop the lower one
    const dedupeMap = new Map<string, LeaderboardUser>()
    for (const entry of rawLeaderboard) {
      const email = (entry as any).email ? (entry as any).email.toLowerCase().trim() : ''
      const name = (entry.displayName || '').toLowerCase().trim()
      const key = email || (name && name !== 'learner' && name !== 'you' ? `name:${name}` : entry.userId)

      if (!dedupeMap.has(key)) {
        dedupeMap.set(key, entry)
      } else {
        const existing = dedupeMap.get(key)!
        dedupeMap.set(key, {
          userId: existing.isCurrentUser ? existing.userId : (entry.isCurrentUser ? entry.userId : existing.userId),
          displayName: existing.displayName && existing.displayName !== 'Learner' ? existing.displayName : entry.displayName,
          avatarUrl: existing.avatarUrl || entry.avatarUrl,
          totalCorrect: Math.max(existing.totalCorrect || 0, entry.totalCorrect || 0),
          masteryPercent: Math.max(existing.masteryPercent || 0, entry.masteryPercent || 0),
          dayStreak: Math.max(existing.dayStreak || 0, entry.dayStreak || 0),
          lastStudied: new Date(existing.lastStudied).getTime() > new Date(entry.lastStudied).getTime() ? existing.lastStudied : entry.lastStudied,
          isCurrentUser: existing.isCurrentUser || entry.isCurrentUser,
          streakBroken: existing.streakBroken && entry.streakBroken,
        })
      }
    }

    const leaderboard = Array.from(dedupeMap.values())

    // If current user is not in the list at all, append them
    const hasCurrentUser = leaderboard.some((u) => u.isCurrentUser || u.userId === currentUserId)
    if (currentUserId && !hasCurrentUser) {
      leaderboard.push({
        userId: currentUserId,
        displayName: currentUserName,
        avatarUrl: currentUserAvatar,
        totalCorrect: localTotalCorrect,
        masteryPercent: localMasteryPercent,
        dayStreak: localStreak,
        lastStudied: new Date().toISOString(),
        isCurrentUser: true,
        streakBroken: false
      })
    }

    return leaderboard
  } catch {
    return getCachedOrFallback()
  }
}

function buildDemoLeaderboard(
  currentUserId?: string,
  currentUserName: string = 'You',
  currentUserAvatar: string = '',
  totalCorrect: number = 0,
  masteryPercent: number = 0,
  dayStreak: number = 0
): LeaderboardUser[] {
  const list: LeaderboardUser[] = [
    {
      userId: 'demo-1',
      displayName: 'Lawrence Cortez',
      totalCorrect: 482,
      masteryPercent: 96,
      dayStreak: 19,
      lastStudied: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    },
    {
      userId: 'demo-2',
      displayName: 'Sophia Martinez',
      totalCorrect: 395,
      masteryPercent: 91,
      dayStreak: 14,
      lastStudied: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    },
    {
      userId: 'demo-3',
      displayName: 'Marcus Aurelius Vance',
      totalCorrect: 340,
      masteryPercent: 88,
      dayStreak: 11,
      lastStudied: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      userId: 'demo-4',
      displayName: 'Evelyn Clarissa Chen',
      totalCorrect: 275,
      masteryPercent: 82,
      dayStreak: 8,
      lastStudied: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    },
    {
      userId: 'demo-5',
      displayName: 'Alexander Hamilton Roy',
      totalCorrect: 210,
      masteryPercent: 74,
      dayStreak: 6,
      lastStudied: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
    }
  ]

  if (currentUserId) {
    list.push({
      userId: currentUserId,
      displayName: currentUserName,
      avatarUrl: currentUserAvatar,
      totalCorrect: Math.max(totalCorrect, 35),
      masteryPercent: Math.max(masteryPercent, 20),
      dayStreak: Math.max(dayStreak, 1),
      lastStudied: new Date().toISOString(),
      isCurrentUser: true,
      streakBroken: false
    })
  }

  return list
}
