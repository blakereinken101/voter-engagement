import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = [
  '/sign-in',
  '/sign-up',
  '/verify-code',
  '/forgot-password',
  '/reset-password',
  '/invite/',
  '/api/auth/',
  '/api/invitations/accept',
  '/events',
  '/api/events',
  '/api/subscriptions',
  '/api/stripe/webhook',
  '/api/cron/',
]

// Routes that require the 'relational' product
const RELATIONAL_ROUTES = [
  '/dashboard', '/action-plan', '/matching', '/questionnaire',
  '/results', '/rolodex', '/change-password',
]

// Routes that require the 'events' product (protected, not public /events browsing)
const EVENTS_PROTECTED_ROUTES = [
  '/events/manage', '/events/create',
]

// Platform admin only
const PLATFORM_ROUTES = ['/platform']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (
    pathname === '/' ||
    pathname === '/privacy' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/contact') ||
    PUBLIC_PATHS.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  // Allow potential vanity URL paths (single segment, e.g. /team-blue)
  // The [accountname] page handles 404 for non-existent slugs
  const segments = pathname.split('/').filter(Boolean)
  if (
    segments.length === 1 &&
    ![...RELATIONAL_ROUTES, ...PLATFORM_ROUTES].includes(pathname) &&
    !pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('vc-session')?.value

  // Determine the right sign-in URL based on what path they're trying to reach
  const signInUrl = pathname.startsWith('/events')
    ? new URL('/sign-in?product=events', request.url)
    : new URL('/sign-in', request.url)

  if (!token) {
    const response = NextResponse.redirect(signInUrl)
    response.cookies.set('vc-return-url', pathname, {
      path: '/',
      sameSite: 'lax',
      maxAge: 1800, // 30 minutes
    })
    return response
  }

  let payload: Record<string, unknown>
  try {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret && process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production.')
    }
    const secret = new TextEncoder().encode(jwtSecret || 'dev-secret-change-me')
    const { payload: p } = await jwtVerify(token, secret)
    payload = p as Record<string, unknown>
  } catch {
    const response = NextResponse.redirect(signInUrl)
    response.cookies.set('vc-return-url', pathname, {
      path: '/',
      sameSite: 'lax',
      maxAge: 1800, // 30 minutes
    })
    return response
  }

  const products: string[] = Array.isArray(payload.products) ? payload.products as string[] : []
  const isPlatformAdmin = !!(payload as Record<string, unknown>).isPlatformAdmin

  // Force re-login for old tokens without products claim (backward compat safety net)
  if (products.length === 0 && !isPlatformAdmin) {
    // Check if this might be an old token — look for userId to confirm it's a session token
    if (payload.userId && !payload.products) {
      const response = NextResponse.redirect(signInUrl)
      response.cookies.set('vc-session', '', { path: '/', maxAge: 0 })
      return response
    }
  }

  // ── Product-level access checks ──────────────────────────────────

  // Relational routes require 'relational' product
  if (RELATIONAL_ROUTES.some(r => pathname.startsWith(r))) {
    if (!products.includes('relational') && !isPlatformAdmin) {
      // Redirect to their product's home
      if (products.includes('events')) {
        return NextResponse.redirect(new URL('/events/manage', request.url))
      }
      return NextResponse.redirect(new URL('/sign-in', request.url))
    }
  }

  // Events protected routes require 'events' product
  if (EVENTS_PROTECTED_ROUTES.some(r => pathname.startsWith(r))) {
    if (!products.includes('events') && !isPlatformAdmin) {
      if (products.includes('relational')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/sign-in?product=events', request.url))
    }
  }

  // Events slug edit routes: /events/[slug]/edit
  if (/^\/events\/[^/]+\/edit$/.test(pathname)) {
    if (!products.includes('events') && !isPlatformAdmin) {
      return NextResponse.redirect(new URL('/events/manage', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|apple-touch-icon\\.png|logo\\.png|hero-.*\\.jpg|sw\\.js).*)'],
}
