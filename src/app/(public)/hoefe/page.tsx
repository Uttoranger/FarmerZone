import type { Metadata } from 'next'
import { unstable_rethrow } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { ladeOeffentlicheHoefe } from '@/server/queries/oeffentliche-hoefe'
import type { HofUebersichtEintrag } from '@/server/queries/farm'
import { ENTDECKEN_KOPF } from '@/lib/hoefe-entdecken'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { HoefeClient } from '@/components/hoefe/hoefe-client'
import { HoefeFehler, KeineHoefe } from '@/components/hoefe/entdecken-teile'

export const metadata: Metadata = {
  title: 'Höfe in deiner Nähe — FarmerZone',
  description:
    'Alle Höfe auf FarmerZone: was sie verkaufen, wo sie sind und wann du abholen kannst — direkt vom Hof, ohne Umwege.',
}

// Dynamisch seit Bereiche 2: Die Filter stehen in der URL
// (src/schemas/hoefe-filter.ts), und ein geteilter Link soll schon im
// Server-HTML so aussehen, wie er gemeint ist — nicht erst nach der
// Hydration. Die HOFDATEN bleiben trotzdem fünf Minuten gecacht
// (src/server/queries/oeffentliche-hoefe.ts — derselbe Eintrag wie auf der
// Startseite): Gefiltert wird im Browser auf demselben Datensatz, jeder
// Aufruf kostet also keine Datenbankabfrage.
// Die Sitzung für die Kopfzeile liest KundeShellMitSitzung im Browser
// (Nr. 09): Die Sitzung auf dem Server zu lesen kostete je Aufruf eine
// Sitzungsabfrage — für nichts als „Anmelden" ↔ „Mein Konto".
// BEWUSST IN KAUF GENOMMEN: Auch die „Heute/Morgen"-Angabe der nächsten
// Abholung wird mit den Daten gecacht und altert höchstens fünf Minuten.
export const dynamic = 'force-dynamic'

/**
 * Lädt die Höfe; scheitert es, zeigt die Seite den Fehler inline (DESIGN_SYSTEM,
 * „Zustände") statt der 500 für die ganze Seite — Kopfzeile und Unterleiste
 * bleiben bedienbar. Der Fehler geht nach Sentry.
 */
async function ladeHoefe(): Promise<HofUebersichtEintrag[] | 'fehler'> {
  try {
    return await ladeOeffentlicheHoefe()
  } catch (err) {
    // Nexts eigene Steuersignale gehören nicht in die Fehleranzeige.
    unstable_rethrow(err)
    Sentry.captureException(err, { tags: { bereich: 'hoefe-entdecken' } })
    return 'fehler'
  }
}

/** Kopf und Zustand ohne Liste — Fehler oder noch kein Hof. */
function OhneListe({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pt-5 pb-12 md:px-6 md:pt-7">
      <div>
        <h1 className="font-heading text-[26px] leading-tight font-semibold text-foreground md:text-[30px]">
          {ENTDECKEN_KOPF.hoefe.titel}
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">{ENTDECKEN_KOPF.hoefe.unterzeile}</p>
      </div>
      {children}
    </div>
  )
}

/**
 * Entdecken (/hoefe) im neuen Design in der KundeShell (Gate 4, Nachtlauf
 * Nr. 09; Mockups web-k1-* und mobil-k1-*). Gefüllt, leer (Leerzustand mit
 * Ausweg im Client bzw. „Die ersten Höfe kommen gerade dazu"), laden
 * (loading.tsx) und Fehler (inline).
 */
export default async function HoefePage() {
  const hoefe = await ladeHoefe()

  return (
    <KundeShellMitSitzung>
      {hoefe === 'fehler' ? (
        <OhneListe>
          <HoefeFehler />
        </OhneListe>
      ) : hoefe.length === 0 ? (
        <OhneListe>
          <KeineHoefe />
        </OhneListe>
      ) : (
        <HoefeClient hoefe={hoefe} />
      )}
    </KundeShellMitSitzung>
  )
}
