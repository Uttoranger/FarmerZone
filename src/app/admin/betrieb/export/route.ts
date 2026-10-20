import { NextResponse } from 'next/server'
import { frischOderBestaetigen, verlangeAdminAktion } from '@/server/admin-wache'
import { ladeAlleMessungen } from '@/server/queries/betrieb'
import { messungenAlsCsv, utcTag } from '@/lib/betrieb'

/*
 * „Messungen als CSV“ aus Admin › Betrieb (Register N18, Nr. 103): je Tag und
 * Wert eine Zahl, 400 Tage lang. Ein Route Handler, keine Seite — er hängt
 * unter keinem Layout und damit nicht unter der Admin-Prüfung der Seiten;
 * darum prüft er selbst mit derselben Wache wie jede Admin-Aktion
 * (`verlangeAdminAktion`, Recht frisch aus der Datenbank): ohne Anmeldung oder
 * ohne Admin-Recht 403 ohne Inhalt. Nur Zahlen — keine Personendaten, keine
 * Inhalte; trotzdem `no-store`, und die Datei wird gespeichert (`attachment`).
 * Vorbild: src/app/admin/finanzen/export/route.ts.
 */
const KOPF = { 'Cache-Control': 'no-store' } as const

export async function GET(): Promise<NextResponse> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return new NextResponse('Kein Zugriff.', { status: 403, headers: { ...KOPF, 'Content-Type': 'text/plain; charset=utf-8' } })
  // Heikler Download (Register N20, Nr. 115): ohne frische Bestätigung 303 auf /admin/bestaetigen.
  const bestaetigen = await frischOderBestaetigen('/admin/betrieb/export')
  if (bestaetigen) return bestaetigen

  const messungen = await ladeAlleMessungen()
  return new NextResponse(messungenAlsCsv(messungen), {
    status: 200,
    headers: {
      ...KOPF,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="betrieb-messungen-${utcTag(new Date())}.csv"`,
    },
  })
}
