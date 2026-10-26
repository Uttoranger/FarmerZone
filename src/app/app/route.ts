import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { isAdminUser } from '@/server/queries/admin'

/**
 * App-Start (Register N31, Nr. 172): Die installierte App startet auf /app
 * (start_url im Manifest, ein Manifest für beide Welten) und wird nach der
 * Sitzung weitergeleitet. Hof → /dashboard, Admin ohne Hof → /admin, sonst /.
 *
 * "Hof" heißt hier wie in der Wache der Hofseiten (verlangeHofDerSitzung): Rolle
 * FARMER. Ein Hof ohne angelegten Hof landet über /dashboard im Onboarding.
 * Die Weiterleitung hängt von der Sitzung ab und darf nie zwischengespeichert
 * werden; die Adresse selbst gehört in keinen Suchindex.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  const nutzer = session?.user
  let ziel = '/'
  if (nutzer) {
    const rolle = (nutzer as typeof nutzer & { role?: string }).role
    if (rolle === 'FARMER') ziel = '/dashboard'
    else if (await isAdminUser(nutzer.id)) ziel = '/admin'
  }
  const antwort = NextResponse.redirect(new URL(ziel, request.url), 307)
  antwort.headers.set('Cache-Control', 'private, no-store, max-age=0')
  antwort.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return antwort
}
