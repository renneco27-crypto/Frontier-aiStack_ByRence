import { NextRequest, NextResponse } from 'next/server'
import { heartbeatRelayJob } from '@/lib/relayQueue'
import { checkRateLimit } from '@/lib/rateLimiter'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-relay-sha',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id, relay_sha, progress, chars_count, worker_id } = body
    const configuredSha = process.env.RELAY_SHA

    if (configuredSha && relay_sha !== configuredSha) {
      return NextResponse.json({ error: 'Unauthorized: Invalid relay_sha' }, { status: 401, headers: corsHeaders })
    }

    if (!job_id) {
      return NextResponse.json({ error: 'Missing job_id' }, { status: 400, headers: corsHeaders })
    }

    // Extract client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    const clientIp = forwardedFor.split(',')[0]?.trim() || '127.0.0.1'

    // Apply SQL-based rate limiting (3 requests per 5 hours)
    const rateLimitResult = await checkRateLimit(clientIp, '/api/relay/heartbeat')
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: rateLimitResult.error,
          rateLimit: {
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt
          }
        }, 
        { 
          status: 429, 
          headers: {
            ...corsHeaders,
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
            'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000))
          }
        }
      )
    }

    const progressInfo = progress || (chars_count ? `Scraped ${chars_count} chars` : 'Active generation')
    const updated = heartbeatRelayJob(job_id, progressInfo, worker_id)

    return NextResponse.json({
      success: true,
      job_id,
      acknowledged: updated,
      status: updated ? 'heartbeat_received' : 'job_not_found_or_finished',
      rateLimit: {
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt
      }
    }, { 
      headers: {
        ...corsHeaders,
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.resetAt)
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export const dynamic = 'force-dynamic'
