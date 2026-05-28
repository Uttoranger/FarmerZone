import { NextRequest, NextResponse } from 'next/server'
import type { Session } from '@/lib/auth'

const FARMER_PATHS = ['/dashboard', '/orders', '/products', '/sales', '/analytics', '/settings']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isFarmerPath = FARMER_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!isFarmerPath) return NextResponse.next()

  try {
    const res = await fetch(new URL('/api/auth/get-session', request.url), {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    })
    if (!res.ok) return NextResponse.redirect(new URL('/login', request.url))

    const session = (await res.json()) as Session | null
    if (!session?.user) return NextResponse.redirect(new URL('/login', request.url))

    const role = (session.user as Session['user'] & { role: string }).role
    if (role !== 'FARMER') return NextResponse.redirect(new URL('/login', request.url))
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }

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
