import { NextResponse, type NextRequest } from 'next/server'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { eingangMeldungAdresse } from '@/lib/postfach'

/*
 * /admin/meldungen/[id] — seit Nr. 95 (Register N12-Änderung) die Spalte
 * „Meldung entscheiden" im Eingang des Admin-Postfachs: dauerhafte Umleitung
 * nach /admin/postfach?art=meldung&meldung=<id>. Lesezeichen, die Links
 * älterer Mails und die Kurznummer bleiben gültig (der Eingang löst sie über
 * getMeldungDetail auf; die Kennung liest dort ein Zod-Schema). Seit Nr. 101
 * ein Route Handler mit echtem 308 statt einer Seite: Die Ladeansicht davor
 * ließ die Seite per Streaming mit HTTP 200 antworten (Nacharbeit Lauf 14).
 * Zuerst die Admin-Prüfung: nicht angemeldet → /login, ohne Recht → 404.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  await verlangeAdminSeite()
  const { id } = await params
  return NextResponse.redirect(new URL(eingangMeldungAdresse(id), request.nextUrl), 308)
}
