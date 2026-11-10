import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Determine version from Render environment variable, git commit, or build time
const SERVER_VERSION =
  process.env.RENDER_GIT_COMMIT ||
  process.env.GIT_COMMIT ||
  process.env.NEXT_PUBLIC_BUILD_VERSION ||
  process.env.NEXT_PUBLIC_APP_CACHE_SHA ||
  'v_initial'

export async function GET() {
  return NextResponse.json(
    {
      version: SERVER_VERSION,
      deployedAt: process.env.RENDER_BUILD_TIMESTAMP || null,
      timestamp: Date.now(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  )
}
