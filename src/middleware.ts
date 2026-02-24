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

// Routes that require authentication — prevents vanity URL passthrough
// from accidentally opening these to unauthenticated users
const PROTECTED_ROOT_ROUTES = [
  '/dashboard', '/action-plan', '/matching', '/questionnaire',
  '/results', '/rolodex', '/change-password', '/platform',
]

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
    !PROTECTED_ROOT_ROUTES.includes(pathname) &&
    !pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('vc-session')?.value
  const signInUrl = pathname.startsWith('/events')
    ? new URL('/sign-in?product=events', request.url)
    : new URL('/sign-in', request.url)

  if (!token) {
    // Store the intended destination so auth flow can redirect back
    const response = NextResponse.redirect(signInUrl)
    response.cookies.set('vc-return-url', pathname, {
      path: '/',
      sameSite: 'lax',
      maxAge: 1800, // 30 minutes
    })
    return response
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me')
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(signInUrl)
    response.cookies.set('vc-return-url', pathname, {
      path: '/',
      sameSite: 'lax',
      maxAge: 1800, // 30 minutes
    })
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|apple-touch-icon\\.png|logo\\.png|hero-.*\\.jpg|sw\\.js).*)'],
}
