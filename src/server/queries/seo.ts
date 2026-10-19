import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { RESERVED_SLUGS } from '@/lib/slug'
import { ansichtsModus, type AnsichtsQuellen, type Suchparameter } from '@/lib/ansichts-modus'
import { hofSlugSchema } from '@/schemas/hof-adresse'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { OEFFENTLICH_SICHTBAR } from './farm'
import { IM_SHOP_WHERE } from './einstellungen'

/**
 * Suchmaschinen und echte 404 (Nr. 117): ob es unter einer Adresse überhaupt
 * eine Hofseite gibt, und welche Höfe in die Sitemap gehören.
 *
 * Warum vor allem anderen: Jede Adresse `/<irgendwas>` landet in
 * `[farmSlug]`. Bis Nr. 117 lud die Seite dafür erst den ganzen Hof samt
 * Fristfreigabe (Datenbank, ggf. Schreiben) — auch für `/wp-login.php` — und
 * antwortete hinter dem Ladebild mit Status 200. Jetzt entscheidet erst die
 * Form (ohne Datenbank), dann EINE schlanke Abfrage; erst danach lädt die Seite.
 */

/** Ein Produkt steht im Shop — EINE Quelle mit den Einstellungen (IM_SHOP_WHERE). */
const IM_SHOP = IM_SHOP_WHERE satisfies Prisma.ProductWhereInput

/**
 * Kann diese Adresse ein Hof sein? Ohne Datenbank: Form und Länge wie beim
 * Anlegen (hofSlugSchema, src/lib/slug.ts), kein fester Routenordner.
 * `/gibt-es-nicht.php` scheitert am Punkt, `/Hof` am Großbuchstaben.
 */
export function kannHofSlugSein(slug: string): boolean {
  return hofSlugSchema.safeParse(slug).success && !RESERVED_SLUGS.has(slug)
}

export type HofSeo = {
  /**
   * In Suchmaschinen und Sitemap: mindestens ein Produkt im Shop und nicht
   * ausgenommen (Testhof). Dieselbe Regel wie `SITEMAP_HOF` unten.
   */
  indexieren: boolean
  /** Für das JSON-LD (`geo`); nur, wenn der Hof beide Koordinaten hat. */
  geo: { latitude: number; longitude: number } | null
}

/**
 * Die schlanke Abfrage: Ist der Hof öffentlich (`OEFFENTLICH_SICHTBAR`)? null,
 * wenn nicht. Einmal je Anfrage (React `cache`): Metadaten und Seite fragen
 * beide. `findFirst` statt `findUnique`, damit Prisma sie nicht mit einer
 * anderen Abfrage desselben Takts zu einem Batch bündelt (siehe
 * getPublicFarmGeteilt in ./farm.ts).
 */
export const hofIstOeffentlich = cache(async (slug: string): Promise<HofSeo | null> => {
  const hof = await prisma.farm.findFirst({
    where: { slug, ...OEFFENTLICH_SICHTBAR },
    select: {
      gruendungAusgenommen: true,
      latitude: true,
      longitude: true,
      _count: { select: { products: { where: IM_SHOP } } },
    },
  })
  if (!hof) return null
  return {
    indexieren: !hof.gruendungAusgenommen && hof._count.products > 0,
    geo: hof.latitude !== null && hof.longitude !== null ? { latitude: hof.latitude, longitude: hof.longitude } : null,
  }
})

export type ProduktSeo = {
  /** In Suchmaschinen und Sitemap: nicht bei einem ausgenommenen Hof (Testhof) — wie dessen Hofseite. */
  indexieren: boolean
}

/** Die schlanke Abfrage der Produktseite: ein Produkt im Shop eines öffentlichen Hofs unter diesem Slug; null, wenn nicht. */
export const produktIstOeffentlich = cache(async (slug: string, id: string): Promise<ProduktSeo | null> => {
  const produkt = await prisma.product.findFirst({
    where: { id, ...IM_SHOP, farm: { slug, ...OEFFENTLICH_SICHTBAR } },
    select: { id: true, farm: { select: { gruendungAusgenommen: true } } },
  })
  return produkt ? { indexieren: !produkt.farm.gruendungAusgenommen } : null
})

/**
 * Quellen, die so tun, als frage der Besitzer selbst — ohne Sitzung, ohne
 * Datenbank. Damit beantwortet `ansichtsModus` allein die Frage, ob die Adresse
 * die Vorschau VERLANGT (genau ?vorschau=1); ob wirklich der Besitzer fragt,
 * prüft danach der Lader mit den echten Quellen.
 */
const ALS_BESITZER: AnsichtsQuellen = {
  angemeldeterNutzer: async () => 'angenommen',
  besitzer: async () => 'angenommen',
}

/**
 * Zeigt die Adresse die Vorschau des Besitzers (?vorschau=1)? Sie lädt bewusst
 * auch noch nicht freigegebene Höfe — die schlanke Prüfung darf sie nicht
 * abweisen. Den Parameter liest nur `ansichtsModus` (tests/hofseite-einmal.test.ts).
 * Verlangt die Adresse keine Vorschau (?reiter=, ?utm_…, ?vorschau=0), bleibt es
 * bei der einen Abfrage: kein Lader, keine Fristfreigabe. Sonst entscheidet der
 * Lader — je Anfrage geteilt, die Seite bekommt danach dieselbe Antwort.
 */
async function istVorschauDesBesitzers(slug: string, suche: Suchparameter): Promise<boolean> {
  if ((await ansichtsModus(suche, ALS_BESITZER)).art !== 'vorschau') return false
  const { farm, ansicht } = await ladeHofseiteGeteilt(slug, suche)
  return farm !== null && ansicht.art === 'vorschau'
}

/** In der Vorschau des Besitzers: nie in den Index (das sagt dort schon `ansicht.noindex`), keine Koordinaten. */
const IN_DER_VORSCHAU: HofSeo = { indexieren: false, geo: null }

/**
 * Darf unter `/<slug>` eine Hofseite entstehen? Die Angaben des Hofs; null →
 * `notFound()`, bevor irgendetwas anderes lädt.
 */
async function pruefeHofseite(slug: string, suche: Suchparameter): Promise<HofSeo | null> {
  if (!kannHofSlugSein(slug)) return null
  const hof = await hofIstOeffentlich(slug)
  if (hof) return hof
  return (await istVorschauDesBesitzers(slug, suche)) ? IN_DER_VORSCHAU : null
}

/** Dasselbe für `/<slug>/produkt/<id>`: null → `notFound()`. */
async function pruefeProduktseite(slug: string, id: string, suche: Suchparameter): Promise<ProduktSeo | null> {
  if (!kannHofSlugSein(slug)) return null
  const produkt = await produktIstOeffentlich(slug, id)
  if (produkt) return produkt
  return (await istVorschauDesBesitzers(slug, suche)) ? IN_DER_VORSCHAU : null
}

// Metadaten und Seite prüfen beide, parallel — einmal je Anfrage. Schlüssel ist
// der Text der Suchparameter wie bei ladeHofseiteGeteilt (src/server/hofseite-vorschau.ts):
// React `cache` vergleicht Objekte nach Identität. Der Text stammt aus
// JSON.stringify darunter, nie von außen — deshalb der Cast statt einer Prüfung.
const hofseiteGeprueft = cache((slug: string, sucheAlsText: string) => pruefeHofseite(slug, JSON.parse(sucheAlsText) as Suchparameter))
const produktseiteGeprueft = cache((slug: string, id: string, sucheAlsText: string) =>
  pruefeProduktseite(slug, id, JSON.parse(sucheAlsText) as Suchparameter)
)

/** `pruefeHofseite` einmal je Anfrage, für Metadaten und Seite. */
export function pruefeHofseiteGeteilt(slug: string, suche: Suchparameter): Promise<HofSeo | null> {
  return hofseiteGeprueft(slug, JSON.stringify(suche))
}

/** `pruefeProduktseite` einmal je Anfrage, für Metadaten und Seite. */
export function pruefeProduktseiteGeteilt(slug: string, id: string, suche: Suchparameter): Promise<ProduktSeo | null> {
  return produktseiteGeprueft(slug, id, JSON.stringify(suche))
}

/** Was in die Sitemap darf: öffentlich, nicht ausgenommen, mindestens ein Produkt im Shop (wie `indexieren`). */
const SITEMAP_HOF = {
  ...OEFFENTLICH_SICHTBAR,
  gruendungAusgenommen: false,
  products: { some: IM_SHOP },
} as const satisfies Prisma.FarmWhereInput

export type SitemapHof = {
  slug: string
  updatedAt: Date
  produkte: { id: string; updatedAt: Date }[]
}

/** Die Höfe der Sitemap mit ihren Produkten im Shop — nur Slug, ID und Änderungsdatum. */
export async function ladeSitemapHoefe(): Promise<SitemapHof[]> {
  const hoefe = await prisma.farm.findMany({
    where: SITEMAP_HOF,
    orderBy: { slug: 'asc' },
    select: {
      slug: true,
      updatedAt: true,
      products: { where: IM_SHOP, orderBy: { id: 'asc' }, select: { id: true, updatedAt: true } },
    },
  })
  return hoefe.map(({ products, ...hof }) => ({ ...hof, produkte: products }))
}
