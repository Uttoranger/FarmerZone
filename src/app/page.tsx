import { Suspense, cache } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { getOeffentlicheHoefe } from '@/server/queries/farm'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { beispielRechnung, waehleStartseitenHoefe, type StartseitenHof } from '@/lib/startseite'
import { istBrennmaterialSaison } from '@/lib/brennmaterial-saison'
import { istKundensitzung } from '@/lib/kunden-navigation'
import { STARTSEITE_VORSCHAUBILD } from '@/lib/vorschaubild'
import { KundeShell } from '@/components/shells/kunde-shell'
import { StartseiteKopf } from '@/components/startseite/startseite-kopf'
import {
  HoefeInDerNaehe,
  HofKarten,
  HofKartenFehler,
  HofKartenSkelett,
  KartenHof,
} from '@/components/startseite/hoefe-in-der-naehe'
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

// Dieselbe Hofliste wie /hoefe, fünf Minuten gecacht und unter demselben
// Etikett — wer dort den Cache leert (Produkt aus-/eingeblendet, Hof
// freigeschaltet), leert ihn hier mit. Wie dort altert die „Heute"-Angabe der
// nächsten Abholung höchstens fünf Minuten.
const ladeHoefe = unstable_cache(() => getOeffentlicheHoefe(), ['startseite-hoefe'], {
  revalidate: 300,
  tags: [HOEFE_CACHE_TAG],
})

/**
 * Die Höfe der Startseite — einmal je Anfrage (cache), obwohl Kopf und
 * Abschnitt sie beide brauchen. Scheitert das Laden, zeigt die Seite den
 * Fehler inline an den Karten (DESIGN_SYSTEM, „Zustände") statt der 500 für
 * die ganze Startseite; der Fehler geht trotzdem nach Sentry.
 */
const ladeStartseitenHoefe = cache(async (): Promise<StartseitenHof[] | 'fehler'> => {
  try {
    return waehleStartseitenHoefe(await ladeHoefe())
  } catch (err) {
    // Nexts eigene Steuersignale (Umleitung, dynamisches Rendern) gehören
    // nicht in die Fehleranzeige.
    unstable_rethrow(err)
    Sentry.captureException(err, { tags: { bereich: 'startseite-hoefe' } })
    return 'fehler'
  }
})

async function HofKartenGeladen() {
  const hoefe = await ladeStartseitenHoefe()
  return hoefe === 'fehler' ? <HofKartenFehler /> : <HofKarten hoefe={hoefe} />
}

async function KartenHofGeladen() {
  const hoefe = await ladeStartseitenHoefe()
  return hoefe === 'fehler' ? null : <KartenHof hof={hoefe[0] ?? null} />
}

/**
 * Die Startseite im neuen Design (Gate 4, Mockups web-k0-startseite und
 * mobil-k0-startseite) in der KundeShell: Kopfzeile im Browser, Unterleiste
 * am Handy.
 *
 * Gewartet wird nur auf die Sitzung (für die Kopfzeile; ohne Anmelde-Cookie
 * antwortet sie ohne Datenbank, mit Cookie aus dem Sitzungs-Cache). Die Höfe
 * laden hinter Suspense-Grenzen mit eigenem Skelett — Kopf, Video und Suche
 * stehen sofort. Deshalb gibt es keine src/app/loading.tsx: Sie gälte für
 * jede Route ohne eigene Ladeansicht (DESIGN_SYSTEM, „Ladeansicht").
 */
export default async function HomePage() {
  const sitzung = await auth.api.getSession({ headers: await headers() })
  const jetzt = new Date()

  return (
    <KundeShell angemeldet={istKundensitzung(sitzung?.user)}>
      <StartseiteKopf
        kartenHof={
          <Suspense fallback={null}>
            <KartenHofGeladen />
          </Suspense>
        }
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
      <Fragen />
      <StartseiteFuss jahr={jetzt.getFullYear()} />
    </KundeShell>
  )
}
