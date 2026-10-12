import { Suspense, cache } from 'react'
import type { Metadata } from 'next'
import { unstable_rethrow } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { ladeOeffentlicheHoefe } from '@/server/queries/oeffentliche-hoefe'
import { schonGemeldet } from '@/server/oeffentlich-lesen'
import {
  beispielRechnung,
  waehleKartenHoefe,
  waehleStartseitenHoefe,
  type StartseitenHof,
  type StartseitenKarte,
} from '@/lib/startseite'
import type { KartenForm } from '@/lib/regionskarte'
import { istBrennmaterialSaison } from '@/lib/brennmaterial-saison'
import { STARTSEITE_VORSCHAUBILD } from '@/lib/vorschaubild'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { RegionsKarte, StartseiteKopf } from '@/components/startseite/startseite-kopf'
import { HoefeInDerNaehe, HofKarten, HofKartenFehler, HofKartenSkelett } from '@/components/startseite/hoefe-in-der-naehe'
import {
  BrennmaterialBand,
  Fragen,
  FuerHoefeBand,
  FutterAbschnitt,
  SoFunktionierts,
  StartseiteFuss,
} from '@/components/startseite/startseite-abschnitte'

// Futter steht im Titel und in der Beschreibung: Wer „Heu kaufen" sucht, soll
// die Startseite finden, nicht erst eine Hofseite. Open Graph und die
// X-/Twitter-Karte sagen dasselbe und zeigen das große Vorschaubild
// (src/lib/vorschaubild.ts), damit ein geteilter Link dieselbe Karte zeigt.
const SEITEN_TITEL = 'FarmerZone — Lebensmittel und Futter direkt vom Hof'
const SEITEN_BESCHREIBUNG =
  'Lebensmittel für die Küche, Heu, Stroh und Futter für den Stall — direkt von den Höfen der Region bestellen und abholen. Pilotbetrieb mit ausgewählten Höfen.'

export const metadata: Metadata = {
  title: SEITEN_TITEL,
  description: SEITEN_BESCHREIBUNG,
  openGraph: {
    title: SEITEN_TITEL,
    description: SEITEN_BESCHREIBUNG,
    type: 'website',
    siteName: 'FarmerZone',
    images: [STARTSEITE_VORSCHAUBILD],
  },
  twitter: {
    card: 'summary_large_image',
    title: SEITEN_TITEL,
    description: SEITEN_BESCHREIBUNG,
    images: [STARTSEITE_VORSCHAUBILD],
  },
}

// Statisch vom CDN, alle fünf Minuten neu gebaut (ISR) — im selben Takt wie
// die Hofliste (src/server/queries/oeffentliche-hoefe.ts). Leert eine
// Produktaktion deren Etikett, baut Next die Seite sofort neu. Deshalb liest
// die Seite NICHTS aus der Anfrage (kein headers(), cookies(), auth.api): Das
// machte sie dynamisch, und jeder Besuch wartete auf eine Serverless-Funktion.
// Die Sitzung für die Kopfzeile liest KundeShellMitSitzung im Browser.
// „Saison" des Brennmaterial-Bands, Beispielrechnung und Jahr im Fuß gelten
// damit je Bau — höchstens fünf Minuten alt.
export const revalidate = 300

/**
 * Die Höfe der Startseite — einmal je Bau (cache), obwohl die Karte im Kopf
 * (zweimal: Browser und Handy) und die Hofkarten sie brauchen. Karte und
 * Hofkarten kommen aus DERSELBEN Liste, auch die Koordinaten der Pins — keine
 * zweite Abfrage (Nr. 59). Scheitert das Laden, zeigt die Seite den
 * Fehler inline an den Karten (DESIGN_SYSTEM, „Zustände") statt der 500 für
 * die ganze Startseite; der Fehler geht trotzdem nach Sentry. BEWUSST IN KAUF
 * GENOMMEN: Diese Fassung bleibt dann bis zum nächsten Bau stehen (höchstens
 * fünf Minuten) — ein Wurf statt der Startseite wäre schlimmer, und beim Bau
 * ohne Datenbank (Build-Umgebung) bräche er den ganzen Build ab.
 */
const ladeStartseitenHoefe = cache(async (): Promise<{ hoefe: StartseitenHof[]; karte: StartseitenKarte } | 'fehler'> => {
  try {
    const liste = await ladeOeffentlicheHoefe()
    return { hoefe: waehleStartseitenHoefe(liste), karte: waehleKartenHoefe(liste) }
  } catch (err) {
    // Nexts eigene Steuersignale (Umleitung, dynamisches Rendern) gehören
    // nicht in die Fehleranzeige.
    unstable_rethrow(err)
    // Einen Verbindungsabbruch hat die Wiederholung schon gemeldet (Nr. 47).
    if (!schonGemeldet(err)) Sentry.captureException(err, { tags: { bereich: 'startseite-hoefe' } })
    return 'fehler'
  }
})

async function HofKartenGeladen() {
  const daten = await ladeStartseitenHoefe()
  return daten === 'fehler' ? <HofKartenFehler /> : <HofKarten hoefe={daten.hoefe} />
}

/** Ohne Daten (Fehler) nur das Land — den Fehler sagen die Hofkarten darunter. */
async function RegionsKarteGeladen({ form }: { form: KartenForm }) {
  const daten = await ladeStartseitenHoefe()
  return <RegionsKarte form={form} karte={daten === 'fehler' ? null : daten.karte} />
}

/**
 * Die Startseite im neuen Design (Gate 4, Mockups web-k0-startseite und
 * mobil-k0-startseite) in der KundeShell: Kopfzeile im Browser, Unterleiste
 * am Handy.
 *
 * Die Seite wartet auf nichts: Die Höfe laden hinter Suspense-Grenzen mit
 * eigenem Skelett, die Sitzung liest der Browser. Deshalb gibt es keine
 * src/app/loading.tsx: Sie gälte für jede Route ohne eigene Ladeansicht
 * (DESIGN_SYSTEM, „Ladeansicht").
 */
export default function HomePage() {
  const jetzt = new Date()

  return (
    <KundeShellMitSitzung>
      <StartseiteKopf
        karte={(form) => (
          <Suspense fallback={<RegionsKarte form={form} karte={null} />}>
            <RegionsKarteGeladen form={form} />
          </Suspense>
        )}
      />
      <HoefeInDerNaehe>
        <Suspense fallback={<HofKartenSkelett />}>
          <HofKartenGeladen />
        </Suspense>
      </HoefeInDerNaehe>
      <FutterAbschnitt />
      {istBrennmaterialSaison(jetzt) && <BrennmaterialBand />}
      <SoFunktionierts rechnung={beispielRechnung(jetzt)} />
      <FuerHoefeBand />
      <Fragen jetzt={jetzt} />
      <StartseiteFuss jahr={jetzt.getFullYear()} />
    </KundeShellMitSitzung>
  )
}
