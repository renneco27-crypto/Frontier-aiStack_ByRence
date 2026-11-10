import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || ''

  // 1. Google AdSense / Search Bot exemptions
  if (
    userAgent.includes('Mediapartners-Google') ||
    userAgent.includes('Google-AdSense-Robot') ||
    userAgent.includes('Googlebot')
  ) {
    return NextResponse.next()
  }

  const { pathname, searchParams } = request.nextUrl

  // 2. Static and system files exemptions
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.png' ||
    pathname === '/manifest.webmanifest' ||
    pathname.endsWith('.webmanifest') ||
    pathname === '/sw.js' ||
    pathname.startsWith('/swe-worker') ||
    pathname.startsWith('/workbox-') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|apk|zip|pdf|txt|css|js|map|json|webmanifest|woff|woff2|ttf|eot)$/i)
  ) {
    const response = NextResponse.next()
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-relay-sha, x-active-jobs, x-worker-id')

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: response.headers })
    }
    return response
  }

  const configuredAppSha = process.env.NEXT_PUBLIC_APP_CACHE_SHA || process.env.APP_ACCESS_SHA || 'sha_7b39a8c'
  const configuredRelaySha = process.env.RELAY_SHA || 'sha_ab87db5ada563783231f8fa76a4c762d'
  const adminBypassKey = process.env.ADMIN_BYPASS_KEY || 'studyup_admin_secret_2026'

  // 3. Secret URL bypass: /site?sha_7b39a8c, /?sha_7b39a8c, /download?sha_7b39a8c or any URL with sha_7b39a8c
  const rawSearch = request.nextUrl.search.replace(/^\?/, '').trim()
  const searchKeys = Array.from(searchParams.keys())
  const firstKeyWithoutVal = searchKeys.length > 0 ? searchKeys[0] : ''

  const candidateKeys = [
    searchParams.get('key'),
    searchParams.get('sha'),
    searchParams.get('token'),
    firstKeyWithoutVal,
    rawSearch,
    pathname.replace(/^\/site\/?/, '').trim(),
  ].filter(Boolean) as string[]

  const hasSecretAccess =
    candidateKeys.some(
      (k) =>
        k === adminBypassKey ||
        k === configuredRelaySha ||
        k === configuredAppSha ||
        k === 'sha_7b39a8c' ||
        k.includes('sha_7b39a8c')
    ) ||
    rawSearch.includes('sha_7b39a8c') ||
    pathname.includes('sha_7b39a8c')

  if (hasSecretAccess) {
    const isHttps = request.nextUrl.protocol === 'https:'
    const response =
      pathname === '/site' || pathname.startsWith('/site/') || pathname === '/download'
        ? NextResponse.redirect(new URL('/', request.url))
        : NextResponse.next()

    response.cookies.set('studyup_app_access', 'authorized_admin', {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false,
      secure: isHttps,
      sameSite: 'lax',
    })
    return response
  }

  // 4. Public web pages (no gate required)
  const isPublicPage =
    pathname === '/' ||
    pathname === '/download' ||
    pathname.startsWith('/download/') ||
    pathname.startsWith('/auth') ||
    pathname === '/offline' ||
    pathname === '/data-deletion' ||
    pathname === '/data-deletion.html' ||
    pathname === '/privacy-policy' ||
    pathname === '/privacy-policy.html' ||
    pathname === '/privacy' ||
    pathname === '/terms-of-service' ||
    pathname === '/terms-of-service.html' ||
    pathname === '/tos' ||
    pathname === '/tos.html' ||
    pathname === '/landing.html'

  if (isPublicPage) {
    return NextResponse.next()
  }

  // 5. Admin /site secret URL fallback
  if (pathname === '/site' || pathname.startsWith('/site/')) {
    return NextResponse.redirect(new URL('/download', request.url))
  }

  // 5. Validated Cookie Check
  const accessCookie = request.cookies.get('studyup_app_access')?.value
  if (
    accessCookie &&
    (accessCookie === 'authorized_admin' ||
      accessCookie === 'authorized_app' ||
      accessCookie === 'authorized_relay' ||
      accessCookie === configuredAppSha ||
      accessCookie === configuredRelaySha)
  ) {
    return NextResponse.next()
  }

  // 6. Header or App User-Agent Check (Android App or Relay Extension)
  const appSha = request.headers.get('x-app-sha') || request.headers.get('X-App-SHA')
  const relaySha = request.headers.get('x-relay-sha') || request.headers.get('X-Relay-SHA')
  const isAppUserAgent = userAgent.includes(configuredAppSha)

  if (
    isAppUserAgent ||
    (appSha && appSha === configuredAppSha) ||
    (relaySha && relaySha === configuredRelaySha)
  ) {
    const response = NextResponse.next()
    const tokenType = (isAppUserAgent || appSha === configuredAppSha) ? 'authorized_app' : 'authorized_relay'
    response.cookies.set('studyup_app_access', tokenType, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })
    return response
  }

  // 7. Block unauthorized browser access -> Redirect to /download
  return NextResponse.redirect(new URL('/download', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
