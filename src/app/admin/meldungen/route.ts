import { NextResponse, type NextRequest } from 'next/server'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { meldungenImPostfach } from '@/lib/postfach'

/*
 * /admin/meldungen — seit Nr. 101 (Register N14, Ergänzung) der Reiter
 * „Meldungen" im Admin-Postfach: dauerhafte Umleitung mit echtem 308 auf
 * /admin/postfach?reiter=meldungen. Ein Route Handler statt einer Seite, weil
 * eine Seite mit Ladeansicht per Streaming mit HTTP 200 antwortet und die
 * Weiterleitung erst im Dokument steht (Nacharbeit Lauf 14). Zuerst die
 * Admin-Prüfung wie auf jeder Admin-Seite: nicht angemeldet → /login, ohne
 * Recht → 404 — Unbefugten verrät auch die Umleitung nicht, wohin es geht.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  await verlangeAdminSeite()
  return NextResponse.redirect(new URL(meldungenImPostfach(request.nextUrl.pathname), request.nextUrl), 308)
}
