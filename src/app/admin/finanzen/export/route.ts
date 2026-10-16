import { NextResponse, type NextRequest } from 'next/server'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { aktuellerFinanzMonat, getFinanzenJahr } from '@/server/queries/finanzen'
import { jahrAlsCsv } from '@/lib/finanzen'
import { finanzenJahrAus } from '@/schemas/admin-reiter'

/*
 * „CSV <Jahr>" aus Admin › Finanzen (Register N15, Ergänzung Nr. 100): alle
 * Monate und Kostenposten des Jahres für die Steuerberatung. Ein Route Handler,
 * keine Seite — er hängt unter keinem Layout und damit nicht unter der
 * Admin-Prüfung der Seiten (src/app/admin/layout.tsx); darum prüft er selbst,
 * und zwar mit derselben Wache wie jede Admin-Aktion (`verlangeAdminAktion`,
 * Recht frisch aus der Datenbank): ohne Anmeldung oder ohne Admin-Recht
 * 403 ohne Inhalt, nie eine Umleitung auf eine Seite mit Zahlen.
 *
 * Die Zahlen sind die der Jahresansicht (`getFinanzenJahr` → `jahrAlsCsv`), keine
 * zweite Rechnung. Keine personenbezogenen Daten: Bestellungen nur als Zahl,
 * von den Kostenposten nur die Namen. Geld gehört in keinen Zwischenspeicher
 * (`no-store`), und die Datei wird gespeichert, nicht angezeigt (`attachment`).
 */
const KOPF = { 'Cache-Control': 'no-store' } as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return new NextResponse('Kein Zugriff.', { status: 403, headers: { ...KOPF, 'Content-Type': 'text/plain; charset=utf-8' } })

  const jetzt = new Date()
  const laufendesJahr = Number(aktuellerFinanzMonat(jetzt).slice(0, 4))
  // Das Jahr aus der Adresse ist Fremdtext: Ungültiges ist das laufende, ein Jahr vor den ersten Daten zeigt `getFinanzenJahr` ebenso.
  const daten = await getFinanzenJahr(finanzenJahrAus(request.nextUrl.searchParams.get('jahr') ?? undefined, laufendesJahr), jetzt)

  return new NextResponse(jahrAlsCsv(daten.rechnung), {
    status: 200,
    headers: {
      ...KOPF,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finanzen-${daten.jahr}.csv"`,
    },
  })
}
