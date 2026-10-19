import type { Metadata } from 'next'
import { unstable_rethrow } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { ladeOeffentlicheHoefe } from '@/server/queries/oeffentliche-hoefe'
import { meldeFehleranzeige, schonGemeldet } from '@/server/oeffentlich-lesen'
import type { HofUebersichtEintrag } from '@/server/queries/farm'
import { ENTDECKEN_KOPF } from '@/lib/hoefe-entdecken'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { HoefeClient } from '@/components/hoefe/hoefe-client'
import { HoefeFehler, KeineHoefe } from '@/components/hoefe/entdecken-teile'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = {
  title: `Höfe in deiner Nähe — ${MARKE}`,
  description:
    `Alle Höfe auf ${MARKE}: was sie verkaufen, wo sie sind und wann du abholen kannst — direkt vom Hof, ohne Umwege.`,
  // Jede Filteradresse (/hoefe?kat=…) verweist auf die eine Seite (Register N19); metadataBase steht im Root-Layout.
  alternates: { canonical: '/hoefe' },
}

// Statisch vom CDN, alle fünf Minuten neu gebaut — wie die Startseite
// (Register N19). Bis 19.10.2026 war die Seite dynamisch, damit ein geteilter
// Filter-Link schon im Server-HTML gefiltert aussah. Dann folgte ein Crawler
// den Filter-Links: Jede Kombination ist eine eigene Adresse, jede kostete
// einen Server-Render — 622.000 an einem Tag, das Kontingent war aufgebraucht.
// Jetzt steht im Server-HTML immer die ganze Liste, ungefiltert, mit den Links
// auf die Hofseiten; die Filter liest der Browser aus der Adresse
// (use-hoefe-adresse.ts). Deshalb liest diese Seite weder Suchparameter noch
// Anfrage-Kopf, Cookies oder die Sitzung — jedes davon machte sie dynamisch.
// Die Sitzung für die Kopfzeile liest KundeShellMitSitzung im Browser (Nr. 09).
// BEWUSST IN KAUF GENOMMEN: Ein geteilter Filter-Link zeigt kurz die ganze
// Liste und dann die gefilterte. Die „Heute/Morgen"-Angabe der nächsten
// Abholung altert höchstens fünf Minuten (Seite) plus fünf (Datencache,
// src/server/queries/oeffentliche-hoefe.ts). Scheitert das Laden bei einem
// Bau, bleibt die Fehleranzeige bis zum nächsten stehen — wie auf der
// Startseite; beim Bau ohne Datenbank bricht der Build so nicht ab.
export const revalidate = 300

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
    // Einen Verbindungsabbruch hat die Wiederholung schon gemeldet (Nr. 47).
    if (!schonGemeldet(err)) Sentry.captureException(err, { tags: { bereich: 'hoefe-entdecken' } })
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
  // Erst hier steht fest, dass die Fehleranzeige in die Seite kommt — ein
  // Abbruch beim Neubau des Datencaches im Hintergrund kommt nie hierher (Nr. 56).
  if (hoefe === 'fehler') meldeFehleranzeige('hoefe-entdecken')

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
