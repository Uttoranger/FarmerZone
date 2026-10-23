import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { HOF_PFAD_KOPF, istHofPfad } from '@/lib/hof-pfade'
import { hofAnmeldeAdresse } from '@/lib/anmeldecode'

// Die Pfade stehen in src/lib/hof-pfade.ts (FARMER_PATHS); tests/proxy-pfade.test.ts
// hält Liste und matcher vollständig. Die Seiten prüfen die Anmeldung zusätzlich selbst.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!istHofPfad(pathname)) return NextResponse.next()

  // Optimistisch — nur Cookie-Präsenz statt HTTP-Roundtrip zur Auth-API bei
  // jeder Navigation; echte Validierung in jeder Query/Action
  // (Ownership-Muster: Session serverseitig + farmId-/ownerId-Scope).
  // Auch die frühere Rollen-Prüfung liegt dort: verlangeHofDerSitzung in jeder
  // Seite (src/server/hofbereich.ts). Ohne Cookie geht es zur Anmeldung und
  // danach zurück (Nr. 156) — der Pfad nur geprüft, ohne Query-Teil.
  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) return NextResponse.redirect(new URL(hofAnmeldeAdresse(pathname), request.url))

  const kopf = new Headers(request.headers)
  kopf.set(HOF_PFAD_KOPF, pathname)
  return NextResponse.next({ request: { headers: kopf } })
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/orders/:path*',
    '/products/:path*',
    '/sales/:path*',
    '/analytics/:path*',
    '/settings/:path*',
    '/customers/:path*',
    '/farm-page/:path*',
    '/status/:path*',
    '/fehler-melden/:path*',
    '/meldungen/:path*',
    '/region/:path*',
    '/postfach/:path*',
  ],
}
