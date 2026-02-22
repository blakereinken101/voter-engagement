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

  const token = request.cookies.get('vc-session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me')
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|apple-touch-icon\\.png|logo\\.png|hero-.*\\.jpg|sw\\.js).*)'],
}
