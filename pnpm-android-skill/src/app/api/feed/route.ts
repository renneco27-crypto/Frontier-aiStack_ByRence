import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase, createAdminSupabaseB } from '@/lib/supabaseServer'

const titleKey = (title: string) => title.trim().normalize('NFKC').toLocaleLowerCase()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject')
    const sort = searchParams.get('sort') || 'newest'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100', 10)), 200)
    const offset = (page - 1) * limit

    const clientA = createAdminSupabase()
    const clientB = createAdminSupabaseB()
    if (!clientA && !clientB) {
      return NextResponse.json({ error: 'Feed database credentials are unavailable' }, { status: 503 })
    }

    const buildQuery = (client: any) => {
      let query = client
        .from('decks')
        .select('id, title, subject, author_name, published_at, download_count')
        .is('folder_id', null)
      if (subject && subject !== 'all') query = query.eq('subject', subject)
      if (sort === 'popular') query = query.order('download_count', { ascending: false })
      return query.order('published_at', { ascending: false }).limit(200)
    }

    const [resA, resB] = await Promise.all([
      clientA ? buildQuery(clientA) : Promise.resolve({ data: [] }),
      clientB ? buildQuery(clientB) : Promise.resolve({ data: [] }),
    ])

    const merged = [...(resA.data || []), ...(resB.data || [])].sort((a, b) => {
      if (sort === 'popular' && (b.download_count || 0) !== (a.download_count || 0)) {
        return (b.download_count || 0) - (a.download_count || 0)
      }
      return (Date.parse(b.published_at || '') || 0) - (Date.parse(a.published_at || '') || 0)
    })

    const seen = new Set<string>()
    const unique = merged.filter((deck) => {
      if (!deck.id) return false
      const idKey = `id:${deck.id}`
      const tKey = `t:${titleKey(deck.title || '')}`
      if (seen.has(idKey) || (deck.title && seen.has(tKey))) return false
      seen.add(idKey)
      if (deck.title) seen.add(tKey)
      return true
    })

    const decks = unique.slice(offset, offset + limit)
    const hasMore = unique.length > offset + limit

    const response = NextResponse.json({
      decks,
      total: unique.length,
      page,
      limit,
      hasMore,
      source: 'database_union',
    })
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    return response
  } catch (err) {
    console.error('feed error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load feed' },
      { status: 500 }
    )
  }
}
