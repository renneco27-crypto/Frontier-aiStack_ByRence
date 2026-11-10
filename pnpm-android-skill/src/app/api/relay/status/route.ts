import { NextRequest, NextResponse } from 'next/server'
import { isWorkerActive, getActiveWorkerCount, getAllActiveWorkers, registerWorkerPing } from '@/lib/relayQueue'
import { checkRateLimit } from '@/lib/rateLimiter'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-relay-sha',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const isClientCheck = searchParams.get('type') === 'client' || searchParams.get('check') === 'true'

  if (isClientCheck) {
    const extensionOnline = isWorkerActive()
    const workerCount = getActiveWorkerCount()
    const workers = getAllActiveWorkers().map(w => ({
      workerId: w.workerId,
      ip: w.ip,
      activeJobs: w.activeJobsCount,
      completedJobs: w.completedJobsCount,
      lastSeen: w.lastSeen,
    }))

    return NextResponse.json(
      {
        serverOnline: true,
        extensionOnline,
        workerCount,
        workers,
        timestamp: Date.now(),
      },
      { headers: corsHeaders }
    )
  }

  const relaySha = searchParams.get('relay_sha') || request.headers.get('x-relay-sha') || ''
  const configuredSha = process.env.RELAY_SHA

  if (configuredSha && relaySha && relaySha !== configuredSha) {
    return NextResponse.json({ error: 'Unauthorized: Invalid relay_sha' }, { status: 401, headers: corsHeaders })
  }

  const workerId = searchParams.get('worker_id') || relaySha || 'worker_default'
  const userAgent = request.headers.get('user-agent') || 'Extension Worker'
  const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  const clientIp = forwardedFor.split(',')[0]?.trim() || '127.0.0.1'

  // Apply SQL-based rate limiting (3 requests per 5 hours)
  const rateLimitResult = await checkRateLimit(clientIp, '/api/relay/status')
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

  registerWorkerPing(workerId, relaySha, clientIp, 0, userAgent)

  const active = isWorkerActive(relaySha || undefined)
  const workerCount = getActiveWorkerCount()
  const workers = getAllActiveWorkers().map(w => ({
    workerId: w.workerId,
    ip: w.ip,
    activeJobs: w.activeJobsCount,
    completedJobs: w.completedJobsCount,
    lastSeen: w.lastSeen,
  }))

  return NextResponse.json(
    {
      active,
      workerCount,
      workers,
      relayEnabled: true,
      timestamp: Date.now(),
      rateLimit: {
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt
      }
    },
    { 
      headers: {
        ...corsHeaders,
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.resetAt)
      }
    }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export const dynamic = 'force-dynamic'
