import { NextRequest, NextResponse } from 'next/server'

interface HandshakeRecord {
  accessToken: string
  refreshToken?: string
  userId: string
  email?: string
  displayName?: string
  avatarUrl?: string
  createdAt: number
  ip: string
}

// In-memory global store with 3-minute TTL
const handshakeStore = new Map<string, HandshakeRecord>()

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

function cleanExpired() {
  const now = Date.now()
  for (const [key, val] of handshakeStore.entries()) {
    if (now - val.createdAt > 180000) {
      handshakeStore.delete(key)
    }
  }
}

// POST: Called by /auth/callback when user logs in via browser
export async function POST(req: NextRequest) {
  try {
    cleanExpired()
    const body = await req.json()
    const { ticketId, accessToken, refreshToken, userId, email, displayName, avatarUrl } = body

    if (!accessToken || !userId) {
      return NextResponse.json({ error: 'Missing token or user' }, { status: 400 })
    }

    const ip = getClientIp(req)
    const record: HandshakeRecord = {
      accessToken,
      refreshToken,
      userId,
      email,
      displayName,
      avatarUrl,
      createdAt: Date.now(),
      ip,
    }

    if (ticketId) {
      handshakeStore.set(ticketId, record)
    }

    if (ip && ip !== 'unknown') {
      handshakeStore.set(`ip_${ip}`, record)
    }

    return NextResponse.json({ success: true, stored: true, ip })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET: Called by App polling loop to retrieve authenticated session
export async function GET(req: NextRequest) {
  try {
    cleanExpired()
    const ticketId = req.nextUrl.searchParams.get('ticketId')
    const ip = getClientIp(req)

    let found: HandshakeRecord | undefined

    if (ticketId && handshakeStore.has(ticketId)) {
      found = handshakeStore.get(ticketId)
      handshakeStore.delete(ticketId)
    } else if (ip && ip !== 'unknown' && handshakeStore.has(`ip_${ip}`)) {
      found = handshakeStore.get(`ip_${ip}`)
      if (found && Date.now() - found.createdAt > 8000) {
        handshakeStore.delete(`ip_${ip}`)
      }
    }

    if (found) {
      return NextResponse.json({
        authenticated: true,
        session: {
          accessToken: found.accessToken,
          refreshToken: found.refreshToken,
          userId: found.userId,
          email: found.email,
          displayName: found.displayName,
          avatarUrl: found.avatarUrl,
        },
      })
    }

    return NextResponse.json({ authenticated: false, pending: true, ip })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
