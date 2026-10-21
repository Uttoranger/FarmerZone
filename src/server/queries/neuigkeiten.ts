import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { NEUIGKEITEN_CACHE_TAG, NEUIGKEITEN_TAGE, waehleNeuigkeiten, type Neuigkeit } from '@/lib/startseite-gestalten'
import { leseAusschnitt } from '@/schemas/bild-ausschnitt'
import { leseOeffentlichMitWiederholung } from '@/server/oeffentlich-lesen'
import { AKTIVER_BEITRAG, NEUESTER_BEITRAG_ZUERST } from '@/server/queries/status-posts'
import { IN_LISTEN_SICHTBAR } from '@/server/queries/farm'
import { PRODUCT_ORDER_BY } from '@/server/queries/products'

/**
 * So viele Beiträge liest die Abfrage höchstens, der neueste zuerst. Prisma
 * rechnet `distinct` hier im Speicher (das Schema hat keine `previewFeatures`):
 * Eine Abfrage ohne `take` lüde bei jedem Neuaufbau des Zwischenspeichers jeden
 * aktiven Beitrag der letzten 14 Tage samt Produktzeilen. Die Grenze ist groß
 * genug für sechs Höfe auch bei vielen Beiträgen eines Hofs: Der sechste Hof
 * fehlte erst, wenn die fünf neueren Höfe zusammen mehr als 200 Beiträge in 14
 * Tagen veröffentlichten (14 am Tag) — für die Region ein Vielfaches des Möglichen.
 */
const LESE_MAX = 200

/**
 * „Neu bei den Höfen“ auf der Startseite (Register N16, Ergänzung Nr. 129):
 * die neuesten aktiven Beiträge (AKTIVER_BEITRAG: veröffentlicht, nicht
 * abgelaufen, „Auf der Hofseite zeigen“) der letzten 14 Tage, nur von Höfen in
 * den Listen (IN_LISTEN_SICHTBAR, nie ein Testhof, Register N21) und nicht
 * pausiert — höchstens einer je Hof, höchstens sechs, nach Zeit.
 *
 * Die Abfrage schneidet nicht je Hof, die Auswahl trifft danach
 * waehleNeuigkeiten (je Hof der neueste, höchstens sechs). Die Kategorien je
 * Hof kommen nur als Feld `category`, je Kategorie einmal (`distinct`), nicht
 * als ganze Produktliste (Nr. 134).
 */
export async function leseNeuigkeiten(jetzt: Date): Promise<Neuigkeit[]> {
  const ab = new Date(jetzt.getTime() - NEUIGKEITEN_TAGE * 24 * 60 * 60_000)
  const beitraege = await prisma.statusPost.findMany({
    // AKTIVER_BEITRAG trägt ein eigenes OR — darum als Element der AND-Liste.
    where: { AND: [AKTIVER_BEITRAG(jetzt), { publishedAt: { gte: ab } }, { farm: { ...IN_LISTEN_SICHTBAR, isPaused: false } }] },
    // Bei gleicher Zeit wie auf der Hofseite geordnet: Je Hof zählt derselbe Beitrag, der dort oben steht.
    orderBy: NEUESTER_BEITRAG_ZUERST,
    take: LESE_MAX,
    select: {
      id: true,
      title: true,
      anlass: true,
      photoUrl: true,
      fotoAusschnitt: true,
      publishedAt: true,
      expiresAt: true,
      farm: {
        select: {
          name: true,
          slug: true,
          // Die Kategorien der Bildfläche ohne Foto: nur Produkte im Shop, wie auf /hoefe — je Kategorie
          // einmal, in der Reihenfolge des ersten Produkts (distinct nimmt den ersten je Wert der Ordnung nach).
          products: {
            where: { isAvailable: true, category: { not: null } },
            orderBy: PRODUCT_ORDER_BY,
            distinct: ['category'],
            select: { category: true },
          },
        },
      },
    },
  })

  return waehleNeuigkeiten(
    beitraege.map((b) => ({
      id: b.id,
      titel: b.title,
      anlass: b.anlass,
      foto: b.photoUrl,
      fotoAusschnitt: leseAusschnitt(b.fotoAusschnitt),
      // Sicher: AKTIVER_BEITRAG verlangt `publishedAt: { lte: jetzt }` und schließt Entwürfe (null) aus.
      veroeffentlicht: b.publishedAt!.toISOString(),
      endet: b.expiresAt?.toISOString() ?? null,
      hof: {
        name: b.farm.name,
        slug: b.farm.slug,
        kategorien: b.farm.products.flatMap((p) => (p.category ? [p.category] : [])),
      },
    }))
  )
}

/**
 * Fünf Minuten zwischengespeichert wie die Hofliste (N19) — mit zwei
 * Etiketten: dem eigenen (Beitrag veröffentlicht, deaktiviert, gelöscht) und
 * HOEFE_CACHE_TAG (Pausieren, Testhof, Freischaltung entzogen). Das
 * automatische Ablaufen eines Beitrags blendet der Browser über `endet` aus.
 * Der Schlüsselteil 'v1' trägt die Form; jede neue Form bekommt einen neuen,
 * denn der Datenspeicher überlebt Deploys.
 */
export const ladeNeuigkeiten = unstable_cache(
  () => leseOeffentlichMitWiederholung('neuigkeiten', () => leseNeuigkeiten(new Date())),
  [NEUIGKEITEN_CACHE_TAG, 'v1'],
  { revalidate: 300, tags: [NEUIGKEITEN_CACHE_TAG, HOEFE_CACHE_TAG] }
)
