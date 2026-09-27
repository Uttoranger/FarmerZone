import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { getOeffentlicheHoefe } from '@/server/queries/farm'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { HoefeClient } from '@/components/hoefe/hoefe-client'
import { KundenKopf } from '@/components/shared/kunden-kopf'

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
      <KundenKopf seite={{ art: 'hofuebersicht' }} titel="Höfe entdecken" />

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
