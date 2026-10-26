import type { Metadata } from 'next'
import { ladeStartseite } from '@/server/queries/startseite'
import { zuRendern } from '@/lib/startseite-gestalten'
import { istBrennmaterialSaison } from '@/lib/brennmaterial-saison'
import { STARTSEITE_VORSCHAUBILD } from '@/lib/vorschaubild'
import { OG_LOCALE } from '@/lib/json-ld'
import { MARKE } from '@/lib/marke'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { STARTSEITE_BESCHREIBUNG, STARTSEITE_TITEL, StartseitenInhalt } from '@/components/startseite/startseiten-inhalt'

export const metadata: Metadata = {
  title: STARTSEITE_TITEL,
  description: STARTSEITE_BESCHREIBUNG,
  // Die eine Adresse dieser Seite (Nr. 117); auch /startseite-vorschau nennt sie als Canonical.
  alternates: { canonical: '/' },
  openGraph: {
    title: STARTSEITE_TITEL,
    description: STARTSEITE_BESCHREIBUNG,
    type: 'website',
    siteName: MARKE,
    images: [STARTSEITE_VORSCHAUBILD],
    locale: OG_LOCALE,
  },
  twitter: {
    card: 'summary_large_image',
    title: STARTSEITE_TITEL,
    description: STARTSEITE_BESCHREIBUNG,
    images: [STARTSEITE_VORSCHAUBILD],
  },
}

// Statisch vom CDN, alle fünf Minuten neu gebaut (ISR) — im selben Takt wie
// die Hofliste (src/server/queries/oeffentliche-hoefe.ts). Leert eine
// Produktaktion deren Etikett, baut Next die Seite sofort neu. Deshalb liest
// die Seite NICHTS aus der Anfrage (keine Parameter der Adresse, keine Header,
// keine Cookies, keine Sitzung): Das machte sie dynamisch, und jeder Besuch
// wartete auf eine Serverless-Funktion. Die Sitzung für die Kopfzeile liest
// KundeShellMitSitzung im Browser.
// „Saison" des Brennmaterial-Bands, Beispielrechnung, Jahr im Fuß und der
// Zeitraum der Blöcke (Admin › Startseite) gelten damit je Bau — höchstens
// fünf Minuten alt; „Veröffentlichen“ in Admin › Startseite baut sofort neu
// (Nr. 99: das Speichern des Entwurfs nie, eine geplante Fassung gilt ab ihrer Zeit).
//
// Die Vorschau aus Admin › Startseite ist NICHT diese Seite, sondern die
// eigene dynamische Route src/app/startseite-vorschau/page.tsx (Register N16,
// Ergänzung 25.10.2026; Nr. 182): Vercel gibt einer Route mit `revalidate`
// keinen Query-Parameter weiter, auch nicht im Draft Mode. Beide rendern
// denselben Baustein (StartseitenInhalt). tests/isr-liest-keine-anfrage-wache.test.ts.
export const revalidate = 300

/**
 * Die Startseite in der KundeShell: Kopfzeile im Browser, Unterleiste am
 * Handy. Seit Nr. 96 (Register N16) in der Reihenfolge aus Admin ›
 * Startseite — EINE Abfrage für die Liste samt Blöcken (ladeStartseite, die
 * Live-Fassung aus dem Cache); ohne Zeilen oder bei einem Lesefehler die
 * heutige Reihenfolge (zuRendern). Blöcke nur in ihrem Zeitraum, verglichen
 * hier am Server.
 *
 * Die Seite wartet auf nichts sonst: Die Höfe laden hinter Suspense-Grenzen
 * mit eigenem Skelett (StartseitenInhalt), die Sitzung liest der Browser.
 * Deshalb gibt es keine src/app/loading.tsx: Sie gälte für jede Route ohne
 * eigene Ladeansicht (DESIGN_SYSTEM, „Ladeansicht").
 */
export default async function HomePage(): Promise<React.JSX.Element> {
  const jetzt = new Date()
  const eintraege = zuRendern(await ladeStartseite(), jetzt, {
    brennmaterialSaison: istBrennmaterialSaison(jetzt),
    blockEntwurfId: null,
  })

  return (
    <KundeShellMitSitzung>
      <StartseitenInhalt eintraege={eintraege} jetzt={jetzt} />
    </KundeShellMitSitzung>
  )
}
