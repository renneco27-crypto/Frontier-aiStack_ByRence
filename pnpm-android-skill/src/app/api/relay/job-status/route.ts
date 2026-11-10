import { NextRequest, NextResponse } from 'next/server'
import { getRelayJob } from '@/lib/relayQueue'
import { checkRateLimit } from '@/lib/rateLimiter'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-relay-sha',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id') || searchParams.get('id')

  if (!jobId) {
    return NextResponse.json({ error: 'Missing job_id' }, { status: 400, headers: corsHeaders })
  }

  // Extract client IP for rate limiting
  const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  const clientIp = forwardedFor.split(',')[0]?.trim() || '127.0.0.1'

  // Apply SQL-based rate limiting (3 requests per 5 hours)
  const rateLimitResult = await checkRateLimit(clientIp, '/api/relay/job-status')
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

  const job = getRelayJob(jobId)
  if (!job) {
    return NextResponse.json({ error: 'Job not found or expired' }, { status: 404, headers: corsHeaders })
  }

  return NextResponse.json({
    id: job.id,
    deckId: job.deckId,
    status: job.status,
    progress: job.progressInfo || '',
    topic: job.topic,
    createdAt: job.createdAt,
    lastHeartbeat: job.lastHeartbeat,
    resultCsv: job.status === 'completed' ? job.resultCsv : undefined,
    images: job.status === 'completed' ? job.images : undefined,
    error: job.status === 'failed' ? job.error : undefined,
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
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export const dynamic = 'force-dynamic'
