import type { Metadata } from 'next'
import Link from 'next/link'
import { getOeffentlicheHoefe } from '@/server/queries/farm'
import { HoefeClient } from '@/components/hoefe/hoefe-client'

export const metadata: Metadata = {
  title: 'Höfe in deiner Nähe — FarmerZone',
  description:
    'Alle Höfe auf FarmerZone: was sie verkaufen, wo sie sind und wann du abholen kannst — direkt vom Hof, ohne Umwege.',
}

// Statisch mit kurzer Revalidierung: Die Übersicht ändert sich, wenn ein Hof
// freigeschaltet wird oder Produkte/Abholzeiten pflegt — fünf Minuten Verzug
// sind dafür unerheblich, jeder Aufruf bleibt eine fertige Seite.
// BEWUSST IN KAUF GENOMMEN: Auch die „Heute/Morgen"-Angabe der nächsten
// Abholung wird beim Rendern gebacken und altert mit der Seite — auf einer
// ruhigen Seite kann der erste Besuch nach einer Pause noch den Stand von
// davor sehen (stale-while-revalidate), der nächste Aufruf stimmt wieder.
// Wochentags-Angaben bleiben dabei immer korrekt.
export const revalidate = 300

export default async function HoefePage() {
  let hoefe: Awaited<ReturnType<typeof getOeffentlicheHoefe>>
  try {
    hoefe = await getOeffentlicheHoefe()
  } catch (fehler) {
    // NUR während `next build` ohne erreichbare Datenbank (der Prüf-Build
    // läuft mit Attrappen-Env): Dann wird der Leerzustand vorgerendert; auf
    // Vercel hat der Build die echte Datenbank und rendert echte Höfe. Zur
    // LAUFZEIT fliegt der Fehler weiter — eine scheiternde Revalidierung
    // behält so die letzte gute Seite, statt still eine leere auszuliefern.
    if (process.env.NEXT_PHASE !== 'phase-production-build') throw fehler
    hoefe = []
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Kopfzeile wie auf der Startseite: Wortmarke zurück zum Anfang. */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <svg width="32" height="32" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="40" cy="40" r="40" fill="#E8F0E8" />
            <path
              d="M40 64 C40 64 22 53 22 35 C22 24 30 16 40 16 C50 16 58 24 58 35 C58 53 40 64 40 64Z"
              fill="#2D5F3F"
            />
            <path d="M40 64 L40 44" stroke="#7BAE85" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="font-heading text-lg font-bold whitespace-nowrap" style={{ color: '#2D5F3F' }}>
            FarmerZone
          </span>
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:pt-10">
        {/* Editorial-Kopf im Stil der Startseite: Kicker + Fraunces. */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#4F6F57' }}>
          Direkt vom Hof
        </p>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-foreground text-balance">
          Höfe in deiner Nähe
        </h1>

        {hoefe.length === 0 ? (
          // Leerzustand: kein Fehler, keine leere Karte — eine ruhige Zeile.
          <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
            Die ersten Höfe kommen gerade dazu.
          </p>
        ) : (
          <HoefeClient hoefe={hoefe} />
        )}
      </main>
    </div>
  )
}
