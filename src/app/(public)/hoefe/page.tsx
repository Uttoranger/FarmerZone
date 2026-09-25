import type { Metadata } from 'next'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { getOeffentlicheHoefe } from '@/server/queries/farm'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { HoefeClient } from '@/components/hoefe/hoefe-client'

export const metadata: Metadata = {
  title: 'Höfe in deiner Nähe — FarmerZone',
  description:
    'Alle Höfe auf FarmerZone: was sie verkaufen, wo sie sind und wann du abholen kannst — direkt vom Hof, ohne Umwege.',
}

// Dynamisch seit Bereiche 2: Die Filter stehen in der URL
// (src/schemas/hoefe-filter.ts), und ein geteilter Link soll schon im
// Server-HTML so aussehen, wie er gemeint ist — nicht erst nach der
// Hydration. Die HOFDATEN bleiben trotzdem fünf Minuten gecacht (wie vorher
// mit revalidate = 300): Gefiltert wird im Browser auf demselben Datensatz,
// jeder Aufruf kostet also keine Datenbankabfrage.
// BEWUSST IN KAUF GENOMMEN: Auch die „Heute/Morgen"-Angabe der nächsten
// Abholung wird mit den Daten gecacht und altert höchstens fünf Minuten.
export const dynamic = 'force-dynamic'

// `tags` ist nicht Zierde: OHNE Etikett gibt es keinen Weg, diesen Eintrag
// vorzeitig zu leeren — `revalidatePath` erreicht einen Dateneintrag nicht, und
// `updateTag`/`revalidateTag` brauchen ein Etikett. Genau deshalb blieb ein
// ausgeblendetes Produkt hier bis zu fünf Minuten stehen, obwohl die
// Produktaktionen längst revalidierten (Sprint Sichtbarkeits-Schalter).
const ladeHoefe = unstable_cache(() => getOeffentlicheHoefe(), [HOEFE_CACHE_TAG], {
  revalidate: 300,
  tags: [HOEFE_CACHE_TAG],
})

export default async function HoefePage() {
  const hoefe = await ladeHoefe()

  return (
    <div className="min-h-screen bg-background">
      {/* Kopfzeile wie auf der Startseite: Wortmarke zurück zum Anfang. */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          {/* Bildmarke unverändert in beiden Modi — siehe landing-nav.tsx. */}
          <svg width="32" height="32" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="40" cy="40" r="40" fill="#E8F0E8" />
            <path
              d="M40 64 C40 64 22 53 22 35 C22 24 30 16 40 16 C50 16 58 24 58 35 C58 53 40 64 40 64Z"
              fill="#2D5F3F"
            />
            <path d="M40 64 L40 44" stroke="#7BAE85" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="font-heading text-lg font-bold whitespace-nowrap text-brand-text">
            FarmerZone
          </span>
        </Link>
      </header>

      {/* Ab lg trägt die Seite den Splitscreen (Liste links, Karte rechts)
          und braucht dafür die volle Breite. */}
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:pt-10 lg:max-w-6xl">
        {/* Editorial-Kopf im Stil der Startseite: Kicker + Fraunces. */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
