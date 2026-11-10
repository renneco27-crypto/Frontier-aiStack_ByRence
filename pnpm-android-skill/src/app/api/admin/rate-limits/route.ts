import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabaseServer'
import { blockIp, unblockIp, resetRateLimit } from '@/lib/rateLimiter'

// GET /api/admin/rate-limits - View all rate limits and blocked IPs
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    // Get rate limits
    const { data: rateLimits, error: rateError } = await supabase
      .from('rate_limits')
      .select('*')
      .order('window_end', { ascending: false })
      .limit(50)

    // Get blocked IPs
    const { data: blockedIps, error: blockError } = await supabase
      .from('blocked_ips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      rate_limits: rateLimits || [],
      blocked_ips: blockedIps || [],
      errors: {
        rateLimits: rateError?.message,
        blockedIps: blockError?.message
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/admin/rate-limits - Block IP or reset rate limit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ip, userAgent, note } = body

    if (!ip) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 })
    }

    if (action === 'block') {
      const success = await blockIp(ip, userAgent, note || 'Blocked by admin')
      if (success) {
        return NextResponse.json({ success: true, message: `IP ${ip} blocked successfully` })
      }
      return NextResponse.json({ error: 'Failed to block IP' }, { status: 500 })
    }

    if (action === 'unblock') {
      const success = await unblockIp(ip)
      if (success) {
        return NextResponse.json({ success: true, message: `IP ${ip} unblocked successfully` })
      }
      return NextResponse.json({ error: 'Failed to unblock IP' }, { status: 500 })
    }

    if (action === 'reset_rate_limit') {
      const success = await resetRateLimit(ip)
      if (success) {
        return NextResponse.json({ success: true, message: `Rate limit reset for IP ${ip}` })
      }
      return NextResponse.json({ error: 'Failed to reset rate limit' }, { status: 500 })
    }

    return NextResponse.json({ error: 'Invalid action. Use: block, unblock, or reset_rate_limit' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'