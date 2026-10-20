import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { frischOderBestaetigen, verlangeAdminAktion } from '@/server/admin-wache'
import { listeBilder, zaehleAuflistungen } from '@/server/betrieb'
import { bilderOhneVerwendungCsv, findeBilderOhneVerwendung } from '@/server/betrieb-bilder'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { fehlerKlasse, utcTag } from '@/lib/betrieb'
import { ohneAnfrage } from '@/lib/sentry-hygiene'

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
 *
 * Fehlerpfad (Nr. 113): Scheitert die Auflistung oder eine Abfrage, antwortet
 * die Route 500 mit einem festen Satz statt der Fehlerseite; nach Sentry geht
 * nur die Fehlerklasse unter einem festen Satz, ohne Anfrage-Daten — kein
 * Pfad, keine Adresse, kein Fehlertext.
 */
const KOPF = { 'Cache-Control': 'no-store' } as const
const TEXT = { ...KOPF, 'Content-Type': 'text/plain; charset=utf-8' } as const

export async function GET(): Promise<NextResponse> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return new NextResponse('Kein Zugriff.', { status: 403, headers: TEXT })
  // Heikler Download (Register N20, Nr. 115): ohne frische Bestätigung 303 auf /admin/bestaetigen.
  const bestaetigen = await frischOderBestaetigen('/admin/betrieb/bilder-export')
  if (bestaetigen) return bestaetigen
  if (!UMGEBUNG.vercelProduktion) return new NextResponse('Nur in der Produktion.', { status: 404, headers: TEXT })

  const jetzt = new Date()
  let csv: string
  try {
    const { dateien, auflistungen } = await listeBilder()
    await zaehleAuflistungen(utcTag(jetzt), auflistungen, jetzt)
    csv = bilderOhneVerwendungCsv(await findeBilderOhneVerwendung(dateien, jetzt))
  } catch (err) {
    const meldung = new Error('Betrieb: Liste der Bilder ohne Verwendung gescheitert')
    meldung.name = fehlerKlasse(err)
    Sentry.captureException(meldung, (scope) => scope.setLevel('warning').setTags({ bereich: 'betrieb', quelle: 'bilderExport' }).addEventProcessor(ohneAnfrage))
    return new NextResponse('Die Liste ließ sich gerade nicht erstellen. Versuch es in ein paar Minuten noch einmal.', { status: 500, headers: TEXT })
  }
  return new NextResponse(csv, {
    status: 200,
    headers: {
      ...KOPF,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bilder-ohne-verwendung-${utcTag(jetzt)}.csv"`,
    },
  })
}
