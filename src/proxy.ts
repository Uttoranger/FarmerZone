import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

const FARMER_PATHS = ['/dashboard', '/orders', '/products', '/sales', '/analytics', '/settings']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isFarmerPath = FARMER_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!isFarmerPath) return NextResponse.next()

  // Optimistisch — nur Cookie-Präsenz statt HTTP-Roundtrip zur Auth-API bei
  // jeder Navigation; echte Validierung in jeder Query/Action
  // (Ownership-Muster: Session serverseitig + farmId-/ownerId-Scope).
  // Auch die frühere Rollen-Prüfung liegt dort: ohne eigene Farm leiten die
  // Seiten selbst auf /login bzw. /onboarding um.
  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) return NextResponse.redirect(new URL('/login', request.url))

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/orders/:path*',
    '/products/:path*',
    '/sales/:path*',
    '/analytics/:path*',
    '/settings/:path*',
  ],
}
