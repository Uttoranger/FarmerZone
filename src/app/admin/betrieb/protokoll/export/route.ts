import { NextResponse, type NextRequest } from 'next/server'
import { frischOderBestaetigen, verlangeAdminAktion } from '@/server/admin-wache'
import { ladeProtokoll, PROTOKOLL_EXPORT_HOECHSTENS } from '@/server/queries/admin-protokoll'
import { protokollFilterAus } from '@/schemas/betrieb-mails'
import { utcTag } from '@/lib/betrieb'
import { protokollAlsCsv, protokollExportAdresse } from '@/app/admin/betrieb/protokoll'

/*
 * „CSV mit Passkey“ aus Admin › Betrieb › Protokoll (Register N33, Nr. 193):
 * dieselben Einträge wie die Seite mit demselben Filter, bis 5000 Zeilen.
 * Recht „ansehen“, aber nur frisch mit Passkey bestätigt (sonst 303 auf
 * /admin/bestaetigen und danach zurück hierher). Ein Route Handler hängt unter
 * keinem Layout — darum zuerst dieselbe Wache wie jede Admin-Aktion. Nur
 * Kennungen, Hofnamen und Bestellnummern, nie eine Adresse; `no-store`,
 * gespeichert als Datei. Vorbild: src/app/admin/betrieb/export/route.ts.
 */
const KOPF = { 'Cache-Control': 'no-store' } as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return new NextResponse('Kein Zugriff.', { status: 403, headers: { ...KOPF, 'Content-Type': 'text/plain; charset=utf-8' } })
  const filter = protokollFilterAus(Object.fromEntries(request.nextUrl.searchParams))
  const bestaetigen = await frischOderBestaetigen(protokollExportAdresse(filter))
  if (bestaetigen) return bestaetigen

  const jetzt = new Date()
  const { zeilen, namen } = await ladeProtokoll(filter, wache.userId, jetzt, PROTOKOLL_EXPORT_HOECHSTENS)
  return new NextResponse(protokollAlsCsv(zeilen, namen, wache.userId), {
    status: 200,
    headers: {
      ...KOPF,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="admin-protokoll-${utcTag(jetzt)}.csv"`,
    },
  })
}
