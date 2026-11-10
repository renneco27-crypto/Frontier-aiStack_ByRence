import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabaseServer'

// GET /api/admin/publishers?name=<author_name>
// Returns IPs and publish history for a publisher name.
// Omit ?name to list all distinct publishers.
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    const authorName = request.nextUrl.searchParams.get('name')?.trim() || null
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)

    if (authorName) {
      // Get all IPs for a specific publisher
      const { data: ips, error: ipsError } = await supabase.rpc('get_publisher_ips', {
        p_author_name: authorName,
      })

      // Get full publish history for that publisher
      const { data: history, error: histError } = await supabase.rpc('get_publisher_history', {
        p_author_name: authorName,
        p_limit: limit,
      })

      // Check if any of their IPs are currently blocked
      const ipList = (ips || []).map((r: any) => r.ip)
      let blockedStatus: Record<string, boolean> = {}
      if (ipList.length > 0) {
        const { data: blocked } = await supabase
          .from('blocked_ips')
          .select('ip')
          .in('ip', ipList)
        const blockedSet = new Set((blocked || []).map((b: any) => b.ip))
        ipList.forEach((ip: string) => { blockedStatus[ip] = blockedSet.has(ip) })
      }

      return NextResponse.json({
        author_name: authorName,
        ips: ips || [],
        blocked_status: blockedStatus,
        history: history || [],
        errors: {
          ips: ipsError?.message,
          history: histError?.message,
        },
      })
    }

    // No name — list all distinct publishers with their last publish time and IP count
    const { data: publishers, error } = await supabase
      .from('publisher_ips')
      .select('author_name, ip, published_at')
      .order('published_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Aggregate in JS: unique author names → { last_publish, unique_ip_count }
    const map: Record<string, { last_publish: string; ips: Set<string> }> = {}
    for (const row of publishers || []) {
      if (!map[row.author_name]) {
        map[row.author_name] = { last_publish: row.published_at, ips: new Set() }
      }
      map[row.author_name].ips.add(row.ip)
      if (row.published_at > map[row.author_name].last_publish) {
        map[row.author_name].last_publish = row.published_at
      }
    }

    const result = Object.entries(map).map(([name, data]) => ({
      author_name: name,
      unique_ip_count: data.ips.size,
      last_publish: data.last_publish,
    }))

    return NextResponse.json({ publishers: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/admin/publishers
// Actions:
//   { action: "block",   author_name: "...", note?: "..." }  → block all IPs used by this publisher
//   { action: "unblock", author_name: "..." }                → unblock all IPs for this publisher
//   { action: "info",    author_name: "..." }                → return IPs without blocking
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { action, author_name, note } = body

    if (!author_name?.trim()) {
      return NextResponse.json({ error: 'author_name is required' }, { status: 400 })
    }

    const name = author_name.trim()

    if (action === 'block') {
      const { data, error } = await supabase.rpc('block_publisher_by_name', {
        p_author_name: name,
        p_note: note || `Blocked by admin — publisher: ${name}`,
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Blocked ${data ?? 0} IP(s) for publisher "${name}". ` +
          `Their account still works from new IPs — only logged publish IPs are blocked.`,
        blocked_count: data ?? 0,
      })
    }

    if (action === 'unblock') {
      const { data, error } = await supabase.rpc('unblock_publisher_by_name', {
        p_author_name: name,
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Unblocked ${data ?? 0} IP(s) for publisher "${name}".`,
        unblocked_count: data ?? 0,
      })
    }

    if (action === 'info') {
      const { data: ips, error } = await supabase.rpc('get_publisher_ips', {
        p_author_name: name,
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ author_name: name, ips: ips || [] })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: block, unblock, or info' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
