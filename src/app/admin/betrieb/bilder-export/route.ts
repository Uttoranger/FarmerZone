import { NextResponse } from 'next/server'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { listeBilder, zaehleAuflistungen } from '@/server/betrieb'
import { bilderOhneVerwendungCsv, findeBilderOhneVerwendung } from '@/server/betrieb-bilder'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { utcTag } from '@/lib/betrieb'

/*
 * „Liste als CSV“ der Bilder ohne Verwendung (Register N18, Nr. 104): Art,
 * Pfad ohne Domain, Größe, hochgeladen — keine Personendaten. Ein Route
 * Handler hängt unter keinem Layout, darum prüft er selbst mit derselben
 * Wache wie jede Admin-Aktion (`verlangeAdminAktion`): ohne Admin-Recht 403
 * ohne Inhalt. Nur in der Produktion — Vorschau und Produktion teilen sich
 * den Bild-Speicher, die Vorschau kennt die Höfe der Produktion nicht; sonst
 * 404. Jede Seite der Auflistung ist ein Bild-Vorgang bei Vercel und zählt
 * mit (`zaehleAuflistungen`). Gelöscht wird nichts. Vorbild:
 * src/app/admin/betrieb/export/route.ts.
 */
const KOPF = { 'Cache-Control': 'no-store' } as const
const TEXT = { ...KOPF, 'Content-Type': 'text/plain; charset=utf-8' } as const

export async function GET(): Promise<NextResponse> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return new NextResponse('Kein Zugriff.', { status: 403, headers: TEXT })
  if (!UMGEBUNG.vercelProduktion) return new NextResponse('Nur in der Produktion.', { status: 404, headers: TEXT })

  const jetzt = new Date()
  const { dateien, auflistungen } = await listeBilder()
  await zaehleAuflistungen(utcTag(jetzt), auflistungen, jetzt)
  const liste = await findeBilderOhneVerwendung(dateien, jetzt)
  return new NextResponse(bilderOhneVerwendungCsv(liste), {
    status: 200,
    headers: {
      ...KOPF,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bilder-ohne-verwendung-${utcTag(jetzt)}.csv"`,
    },
  })
}
