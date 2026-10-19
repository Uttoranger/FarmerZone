import type { MetadataRoute } from 'next'
import { unstable_rethrow } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { ladeSitemapHoefe, type SitemapHof } from '@/server/queries/seo'
import { absoluteAdresse } from '@/lib/json-ld'
import { produktPfad } from '@/lib/produktdetail'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { metadatenBasis } from '@/lib/vorschaubild'

/**
 * /sitemap.xml (Nr. 117) — welche Seiten Suchmaschinen kennen sollen.
 *
 * Statisch, stündlich neu gebaut: Ein neuer Hof erscheint spätestens nach
 * einer Stunde. Drin stehen nur die festen öffentlichen Seiten und die Höfe,
 * die auch indexiert werden (öffentlich, mindestens ein Produkt im Shop, nicht
 * ausgenommen — `ladeSitemapHoefe`), mit ihren Produkten im Shop. Nie eine
 * private Seite, eine Seite mit Token oder eine Adresse mit Parametern
 * (tests/sitemap.test.ts gleicht mit `PRIVATE_BEREICHE` aus src/lib/robots.ts ab).
 *
 * Volle Adressen aus derselben Basis wie `metadataBase` im Root-Layout.
 */
export const revalidate = 3600

/** Die festen öffentlichen Seiten — in der Reihenfolge der Freigabe Nr. 117. */
const FESTE_SEITEN = ['/', '/hoefe', '/fuer-hoefe', '/konditionen', '/agb', '/datenschutz', '/impressum'] as const

/** Das jüngere von zwei Daten: Eine Hofseite ändert sich auch, wenn sich eines ihrer Produkte ändert. */
function juenger(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b
}

/**
 * Die Höfe; scheitert die Abfrage, bleiben die festen Seiten (gemeldet) — wie
 * auf der Startseite: Beim Bau ohne Datenbank (CI) bräche ein Wurf sonst den
 * ganzen Build ab. Der nächste Neubau holt die Höfe nach.
 */
async function ladeHoefe(): Promise<SitemapHof[]> {
  try {
    return await ladeSitemapHoefe()
  } catch (err) {
    unstable_rethrow(err)
    Sentry.captureException(err, { tags: { bereich: 'sitemap' } })
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const basis = metadatenBasis(UMGEBUNG.appUrl)
  const hoefe = await ladeHoefe()
  return [
    ...FESTE_SEITEN.map((pfad) => ({ url: absoluteAdresse(pfad, basis) })),
    ...hoefe.flatMap((hof) => [
      {
        url: absoluteAdresse(`/${hof.slug}`, basis),
        lastModified: hof.produkte.reduce((datum, p) => juenger(datum, p.updatedAt), hof.updatedAt),
      },
      ...hof.produkte.map((p) => ({ url: absoluteAdresse(produktPfad(hof.slug, p.id), basis), lastModified: p.updatedAt })),
    ]),
  ]
}
