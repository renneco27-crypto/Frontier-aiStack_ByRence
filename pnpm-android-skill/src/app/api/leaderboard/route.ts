import { NextResponse } from 'next/server'
import { createAdminSupabase, createAdminSupabaseB } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

interface LeaderboardEntry {
  user_id: string
  display_name: string
  email: string
  avatar_url: string
  total_streak: number
  longest_streak: number
  total_correct: number
  total_cards_studied: number
  studied_today: number
  last_studied: string
}

interface ProfileRecord {
  id: string
  display_name?: string
  email?: string
  avatar_url?: string
  last_active?: string
}

export async function GET() {
  try {
    const clientA = createAdminSupabase()
    const clientB = createAdminSupabaseB()

    // 1. Concurrently fetch all stats, profiles, handshakes, and auth users across both databases
    const [
      statsARes,
      statsBRes,
      profARes,
      profBRes,
      handshakesBRes,
      sessionsBRes,
      authAUsers,
    ] = await Promise.allSettled([
      clientA
        ? clientA.from('user_stats').select('*').order('total_streak', { ascending: false }).limit(200)
        : Promise.resolve({ data: [] }),
      clientB
        ? clientB.from('user_stats').select('*').order('total_streak', { ascending: false }).limit(200)
        : Promise.resolve({ data: [] }),
      clientA
        ? clientA.from('profiles').select('id, display_name, email, avatar_url, last_active').limit(200)
        : Promise.resolve({ data: [] }),
      // DB B profiles table does not have email or avatar_url columns; select safe schema columns
      clientB
        ? clientB.from('profiles').select('id, display_name, streak, longest_streak, created_at').limit(200)
        : Promise.resolve({ data: [] }),
      clientB
        ? clientB.from('auth_handshakes').select('user_id, email, display_name, avatar_url').limit(200)
        : Promise.resolve({ data: [] }),
      clientB
        ? clientB.from('auth_ip_sessions').select('user_id, email, display_name, avatar_url').limit(200)
        : Promise.resolve({ data: [] }),
      clientA?.auth?.admin
        ? clientA.auth.admin.listUsers({ page: 1, perPage: 100 }).then((r: any) => r.data?.users || []).catch(() => [])
        : Promise.resolve([]),
    ])

    const statsA = (statsARes.status === 'fulfilled' && (statsARes.value as any)?.data) || []
    const statsB = (statsBRes.status === 'fulfilled' && (statsBRes.value as any)?.data) || []
    const profA = (profARes.status === 'fulfilled' && (profARes.value as any)?.data) || []
    const profB = (profBRes.status === 'fulfilled' && (profBRes.value as any)?.data) || []
    const handshakesB = (handshakesBRes.status === 'fulfilled' && (handshakesBRes.value as any)?.data) || []
    const sessionsB = (sessionsBRes.status === 'fulfilled' && (sessionsBRes.value as any)?.data) || []
    const authA = (authAUsers.status === 'fulfilled' && Array.isArray(authAUsers.value) ? authAUsers.value : [])

    // 2. Build Canonical Identity Index
    // Any record sharing the same email belongs to the SAME user across databases.
    const idToCanonical = new Map<string, string>()
    const emailToCanonical = new Map<string, string>()
    const profileDetails = new Map<string, {
      id?: string
      displayName?: string
      email?: string
      avatarUrl?: string
      lastActive?: string
    }>()

    function registerIdentity(
      id?: string | null,
      email?: string | null,
      displayName?: string | null,
      avatarUrl?: string | null,
      lastActive?: string | null
    ) {
      const cleanId = (id || '').trim()
      const normEmail = (email || '').toLowerCase().trim()
      if (!cleanId && !normEmail) return

      let targetKey = normEmail || cleanId
      if (cleanId && idToCanonical.has(cleanId)) {
        targetKey = idToCanonical.get(cleanId)!
      } else if (normEmail && emailToCanonical.has(normEmail)) {
        targetKey = emailToCanonical.get(normEmail)!
      }

      // Upgrade ID-only keys to canonical email key whenever an email becomes known
      if (normEmail && targetKey !== normEmail) {
        if (profileDetails.has(targetKey)) {
          const oldData = profileDetails.get(targetKey)!
          profileDetails.delete(targetKey)
          profileDetails.set(normEmail, oldData)
        }
        for (const [k, v] of idToCanonical.entries()) {
          if (v === targetKey) idToCanonical.set(k, normEmail)
        }
        targetKey = normEmail
      }

      if (cleanId) idToCanonical.set(cleanId, targetKey)
      if (normEmail) emailToCanonical.set(normEmail, targetKey)

      const prev = profileDetails.get(targetKey) || {}
      const cleanName = displayName && displayName.trim().toLowerCase() !== 'learner' ? displayName.trim() : ''
      const name = cleanName || (prev.displayName && prev.displayName.toLowerCase() !== 'learner' ? prev.displayName : '') || (normEmail ? normEmail.split('@')[0] : '')
      const mail = normEmail || prev.email || ''
      const avatar = (avatarUrl && avatarUrl.trim()) || prev.avatarUrl || ''
      const active = lastActive || prev.lastActive || ''

      profileDetails.set(targetKey, {
        id: cleanId || prev.id,
        displayName: name,
        email: mail,
        avatarUrl: avatar,
        lastActive: active,
      })
    }

    // Pass 1: High-confidence identities (Supabase Auth and Handshakes)
    for (const u of authA) {
      const meta = u.user_metadata || {}
      const name = meta.full_name || meta.name || meta.display_name
      const avatar = meta.avatar_url || meta.picture
      registerIdentity(u.id, u.email, name, avatar, u.last_sign_in_at || u.created_at)
    }
    for (const h of handshakesB) {
      registerIdentity(h.user_id, h.email, h.display_name, h.avatar_url)
    }
    for (const s of sessionsB) {
      registerIdentity(s.user_id, s.email, s.display_name, s.avatar_url)
    }
    for (const p of profA) {
      registerIdentity(p.id, p.email, p.display_name, p.avatar_url, p.last_active)
    }
    for (const p of profB) {
      registerIdentity(p.id, '', p.display_name, '', p.created_at)
    }

    // Pass 2: Stats records (might contain display_name/email or just user_id)
    const allStats = [...statsA, ...statsB]
    for (const s of allStats) {
      registerIdentity(
        s.user_id,
        s.email,
        s.display_name,
        s.avatar_url,
        s.last_studied_date || s.last_studied || s.last_active
      )
    }

    function getCanonicalKey(userId?: string | null, email?: string | null): string | null {
      const cleanId = (userId || '').trim()
      const normEmail = (email || '').toLowerCase().trim()
      if (normEmail && emailToCanonical.has(normEmail)) {
        return emailToCanonical.get(normEmail)!
      }
      if (cleanId && idToCanonical.has(cleanId)) {
        return idToCanonical.get(cleanId)!
      }
      return normEmail || cleanId || null
    }

    // 3. Merge stats into unified Leaderboard entries
    const mergedMap = new Map<string, LeaderboardEntry>()

    for (const s of allStats) {
      const key = getCanonicalKey(s.user_id, s.email)
      if (!key) continue

      const profile = profileDetails.get(key)
      const cleanStatName = s.display_name && s.display_name.trim().toLowerCase() !== 'learner' ? s.display_name.trim() : ''
      const profName = profile?.displayName && profile.displayName.trim().toLowerCase() !== 'learner' ? profile.displayName.trim() : ''
      const displayName =
        cleanStatName ||
        profName ||
        (profile?.email ? profile.email.split('@')[0] : '') ||
        (s.email ? s.email.split('@')[0] : '') ||
        (key.includes('@') ? key.split('@')[0] : '')

      const avatarUrl = s.avatar_url || profile?.avatarUrl || ''
      const email = s.email || profile?.email || (key.includes('@') ? key : '')
      const currentStreak = Number(s.total_streak) || 0
      const longestStreak = Number(s.longest_streak) || currentStreak
      const totalCorrect = Number(s.total_correct) || 0
      const totalCards = Number(s.total_cards_studied) || 0
      const studiedToday = Number(s.studied_today) || 0
      const lastStudied =
        s.last_studied_date ||
        s.last_studied ||
        s.last_active ||
        profile?.lastActive ||
        new Date().toISOString()

      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          user_id: s.user_id || profile?.id || key,
          display_name: displayName,
          email,
          avatar_url: avatarUrl,
          total_streak: currentStreak,
          longest_streak: longestStreak,
          total_correct: totalCorrect,
          total_cards_studied: totalCards,
          studied_today: studiedToday,
          last_studied: lastStudied,
        })
      } else {
        const existing = mergedMap.get(key)!
        const finalDisplayName =
          existing.display_name && existing.display_name.trim().toLowerCase() !== 'learner'
            ? existing.display_name
            : displayName

        mergedMap.set(key, {
          user_id: existing.user_id || s.user_id || profile?.id || key,
          display_name: finalDisplayName,
          email: existing.email || email,
          avatar_url: existing.avatar_url || avatarUrl,
          total_streak: Math.max(existing.total_streak, currentStreak),
          longest_streak: Math.max(existing.longest_streak, longestStreak),
          total_correct: Math.max(existing.total_correct, totalCorrect),
          total_cards_studied: Math.max(existing.total_cards_studied, totalCards),
          studied_today: Math.max(existing.studied_today, studiedToday),
          last_studied:
            new Date(existing.last_studied).getTime() > new Date(lastStudied).getTime()
              ? existing.last_studied
              : lastStudied,
        })
      }
    }

    // 4. Also include registered users who have not recorded stats yet (streak = 0)
    for (const [key, prof] of profileDetails.entries()) {
      if (!mergedMap.has(key)) {
        const name = prof.displayName && prof.displayName.trim().toLowerCase() !== 'learner' ? prof.displayName.trim() : ''
        const email = prof.email || (key.includes('@') ? key : '')
        const displayName = name || (email ? email.split('@')[0] : '')
        // Skip ghost/anonymous placeholder records without a real display name or email
        if (!displayName || displayName.toLowerCase() === 'learner') continue

        mergedMap.set(key, {
          user_id: prof.id || key,
          display_name: displayName,
          email: prof.email || '',
          avatar_url: prof.avatarUrl || '',
          total_streak: 0,
          longest_streak: 0,
          total_correct: 0,
          total_cards_studied: 0,
          studied_today: 0,
          last_studied: prof.lastActive || new Date().toISOString(),
        })
      }
    }

    // 5. Convert map to array and sort globally, filtering out placeholder 'Learner' or ghost entries
    const leaderboard = Array.from(mergedMap.values())
      .filter((entry) => {
        const name = (entry.display_name || '').trim().toLowerCase()
        const email = (entry.email || '').trim().toLowerCase()
        if (name === 'learner' || name.startsWith('learner') || name === 'anonymous') return false
        if (email.startsWith('learner@')) return false
        if (!name && !email) return false
        return true
      })
      .sort((a, b) => {
      if (b.total_streak !== a.total_streak) {
        return b.total_streak - a.total_streak
      }
      if (b.total_correct !== a.total_correct) {
        return b.total_correct - a.total_correct
      }
      return b.total_cards_studied - a.total_cards_studied
    })

    const allProfiles: ProfileRecord[] = Array.from(profileDetails.values()).map((p) => ({
      id: p.id || '',
      display_name: p.displayName || '',
      email: p.email || '',
      avatar_url: p.avatarUrl || '',
      last_active: p.lastActive || '',
    }))

    return NextResponse.json(
      { leaderboard, profiles: allProfiles },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    )
  } catch (err: any) {
    console.error('Leaderboard API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
