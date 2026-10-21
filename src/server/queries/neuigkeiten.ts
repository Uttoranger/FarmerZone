import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { NEUIGKEITEN_CACHE_TAG, NEUIGKEITEN_TAGE, waehleNeuigkeiten, type Neuigkeit } from '@/lib/startseite-gestalten'
import { leseAusschnitt } from '@/schemas/bild-ausschnitt'
import { leseOeffentlichMitWiederholung } from '@/server/oeffentlich-lesen'
import { AKTIVER_BEITRAG } from '@/server/queries/status-posts'
import { IN_LISTEN_SICHTBAR } from '@/server/queries/farm'
import { PRODUCT_ORDER_BY } from '@/server/queries/products'

/**
 * „Neu bei den Höfen“ auf der Startseite (Register N16, Ergänzung Nr. 129):
 * die neuesten aktiven Beiträge (AKTIVER_BEITRAG: veröffentlicht, nicht
 * abgelaufen, „Auf der Hofseite zeigen“) der letzten 14 Tage, nur von Höfen in
 * den Listen (IN_LISTEN_SICHTBAR, nie ein Testhof, Register N21) und nicht
 * pausiert — höchstens einer je Hof, höchstens sechs, nach Zeit.
 *
 * Gelesen wird ohne Deckel: Ein Hof mit vielen Beiträgen darf die übrigen
 * nicht aus der Reihe drängen, die Auswahl trifft danach waehleNeuigkeiten.
 * Aktive Beiträge der letzten 14 Tage sind wenige.
 */
export async function leseNeuigkeiten(jetzt: Date): Promise<Neuigkeit[]> {
  const ab = new Date(jetzt.getTime() - NEUIGKEITEN_TAGE * 24 * 60 * 60_000)
  const beitraege = await prisma.statusPost.findMany({
    // AKTIVER_BEITRAG trägt ein eigenes OR — darum als Element der AND-Liste.
    where: { AND: [AKTIVER_BEITRAG(jetzt), { publishedAt: { gte: ab } }, { farm: { ...IN_LISTEN_SICHTBAR, isPaused: false } }] },
    // Bei gleicher Zeit fest geordnet, sonst wechselte der Beitrag eines Hofs zwischen zwei Abfragen.
    orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
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
          // Die Kategorien der Bildfläche ohne Foto: nur Produkte im Shop, wie auf /hoefe.
          products: {
            where: { isAvailable: true, category: { not: null } },
            orderBy: PRODUCT_ORDER_BY,
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
        kategorien: [...new Set(b.farm.products.flatMap((p) => (p.category ? [p.category] : [])))],
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
