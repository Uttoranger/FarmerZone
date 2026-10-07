import { prisma } from '@/lib/prisma'
import { decimalZuCents } from '@/lib/order-totals'
import type { HeuteFenster } from '@/lib/heute'
import { teilenBildDaten, teilenBildVersion, type TeilenBildDaten, type TeilenBildHof, type TeilenBildProdukt } from '@/lib/teilen-bild'
import { hofAdresse } from '@/lib/mein-hof'
import { APP_URL } from '@/lib/umgebung-server'
import { OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'
import { PRODUCT_ORDER_BY } from '@/server/queries/products'

export type TeilenBildQuelle = {
  farmId: string
  hof: TeilenBildHof
  produkte: TeilenBildProdukt[]
  slots: HeuteFenster[]
}

/**
 * Die Rohdaten für Teilen-Bild, Teilen-Fenster und Plakat (Gate 7) — NUR
 * öffentlich sichtbare Höfe (dieselbe Bedingung wie die Hofseite,
 * OEFFENTLICH_SICHTBAR). Ein nicht freigeschalteter oder stillgelegter Hof
 * ergibt null: Für ihn gibt es kein Bild und nichts zu teilen (S9). Was davon
 * ins Bild darf, entscheidet `src/lib/teilen-bild.ts`.
 *
 * Nur öffentliche Felder; Geld einmal an der Servergrenze in Cent.
 */
export async function ladeTeilenBildQuelle(wo: { slug: string } | { id: string }): Promise<TeilenBildQuelle | null> {
  const farm = await prisma.farm.findFirst({
    where: { ...wo, ...OEFFENTLICH_SICHTBAR },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      isPaused: true,
      betriebsnummer: true,
      betriebsstatus: true,
      products: {
        orderBy: PRODUCT_ORDER_BY,
        select: {
          id: true,
          name: true,
          price: true,
          isAvailable: true,
          stock: true,
          familieId: true,
          category: true,
          verpackung: true,
        },
      },
      pickupSlots: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  })
  if (!farm) return null
  return {
    farmId: farm.id,
    hof: {
      name: farm.name,
      slug: farm.slug,
      city: farm.city,
      isPaused: farm.isPaused,
      betriebsnummer: farm.betriebsnummer,
      betriebsstatus: farm.betriebsstatus,
    },
    produkte: farm.products.map((p) => ({
      id: p.id,
      name: p.name,
      preisCents: decimalZuCents(p.price),
      isAvailable: p.isAvailable,
      stock: p.stock,
      familieId: p.familieId,
      category: p.category,
      verpackung: p.verpackung,
    })),
    slots: farm.pickupSlots,
  }
}

/**
 * Was das Teilen-Bild eines öffentlichen Hofs gerade zeigt, samt Prüfsumme
 * für die Bildadresse in den Metadaten der Hofseite (`?v=`). Dieselben Daten
 * und dieselbe Regel wie die Bild-Route — so ändert sich die Adresse genau
 * dann, wenn sich das Bild ändert (S9). null: kein öffentlicher Hof.
 */
export async function ladeTeilenVorschau(slug: string, jetzt: Date): Promise<{ daten: TeilenBildDaten; version: string } | null> {
  const quelle = await ladeTeilenBildQuelle({ slug })
  if (!quelle) return null
  const daten = teilenBildDaten({
    hof: quelle.hof,
    produkte: quelle.produkte,
    slots: quelle.slots,
    auswahl: null,
    adresse: hofAdresse(APP_URL, quelle.hof.slug).anzeige,
    jetzt,
  })
  return { daten, version: teilenBildVersion(daten) }
}
