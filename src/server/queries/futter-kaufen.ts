import { prisma } from '@/lib/prisma'
import { umkreisBox, waehleHoefeImUmkreis, type UmfeldKm } from '@/lib/umfeld'
import { PRODUCT_CATEGORY_VALUES, betriebsnummerFuerAnzeige, istFuttermittel } from '@/lib/taxonomie'
import type { FutterHof, FutterProdukt } from '@/lib/futter-kaufen'
import { OEFFENTLICH_SICHTBAR } from './farm'

/**
 * Region › Futter kaufen (Nachtlauf Nr. 22c, Gate 8): Futter registrierter
 * Futtermittelbetriebe im Umkreis des eigenen Hofs.
 *
 * Wie das Umfeld (src/server/queries/umfeld.ts) liest diese Abfrage fremde
 * Höfe — und genau so nur mit OEFFENTLICH_SICHTBAR (aktiv, nicht stillgelegt,
 * freigeschaltet), dazu nicht pausiert: ein pausierter Hof verkauft gerade
 * nicht. Vorfilter `betriebsnummer` nicht leer; ob der Hof als registriert
 * gilt, ob eine Größe kaufbar und nicht gesperrt ist, entscheidet
 * src/lib/futter-kaufen.ts.
 *
 * Was den Server NICHT verlässt: Adresse, Telefon, E-Mail, Koordinaten,
 * Bestand. Die Koordinaten braucht nur die Entfernung (hier gerechnet), den
 * Bestand nur `istKaufbar` — an die Seite gehen Name, Slug, Entfernung,
 * Abholzeiten und die Nummer, die das Schild auf der Produktseite ohnehin
 * zeigt. Die farmId kommt aus der Sitzung, nie aus dem Client.
 */

/** Die Kategorien des Bereichs Futtermittel samt Altlast — Bestandsfutter bleibt auffindbar. */
const FUTTER_KATEGORIEN = PRODUCT_CATEGORY_VALUES.filter((k) => istFuttermittel(k))

export type FutterKaufenDaten =
  | { eigenerStandort: false }
  | {
      eigenerStandort: true
      hoefe: FutterHof[]
      ohneStandort: Array<Pick<FutterHof, 'id' | 'betriebsnummer' | 'betriebsstatus'>>
      produkte: FutterProdukt[]
      abgeschnitten: boolean
    }

/** null, wenn es den Hof nicht gibt. */
export async function getFutterKaufen(farmId: string, km: UmfeldKm): Promise<FutterKaufenDaten | null> {
  const eigen = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { latitude: true, longitude: true },
  })
  if (!eigen) return null
  if (!Number.isFinite(eigen.latitude) || !Number.isFinite(eigen.longitude)) return { eigenerStandort: false }

  const punkt = { lat: eigen.latitude as number, lon: eigen.longitude as number }
  const box = umkreisBox(punkt, km)
  const kandidaten = await prisma.farm.findMany({
    where: {
      ...OEFFENTLICH_SICHTBAR,
      isPaused: false,
      id: { not: farmId },
      betriebsnummer: { not: null },
      OR: [
        {
          latitude: { gte: box.breiteVon, lte: box.breiteBis },
          longitude: { gte: box.laengeVon, lte: box.laengeBis },
        },
        // Ohne Standort: nur, um sie zu zählen.
        { latitude: null },
        { longitude: null },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      latitude: true,
      longitude: true,
      betriebsnummer: true,
      betriebsstatus: true,
      pickupSlots: {
        where: { isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
  })

  const { nah, ohneStandort, abgeschnitten } = waehleHoefeImUmkreis(punkt, kandidaten, km, farmId)
  const ids = [...nah, ...ohneStandort].map((h) => h.id)
  const produkte =
    ids.length === 0
      ? []
      : await prisma.product.findMany({
          where: { farmId: { in: ids }, isAvailable: true, category: { in: FUTTER_KATEGORIEN } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            farmId: true,
            name: true,
            familieId: true,
            category: true,
            price: true,
            isAvailable: true,
            stock: true,
            reservedStock: true,
            verpackung: true,
            futter: { select: { nettoMenge: true, nettoEinheit: true, registrierungsnummer: true } },
          },
        })

  // Die Nummer am Schild: die des Hofs, sonst die Altlast aus der Kennzeichnung —
  // dieselbe Auflösung wie die öffentliche Hofseite (betriebsnummerFuerAnzeige).
  const nummerJeHof = new Map([...nah, ...ohneStandort].map((h) => [h.id, h.betriebsnummer]))

  return {
    eigenerStandort: true,
    hoefe: nah.map((h) => ({
      id: h.id,
      slug: h.slug,
      name: h.name,
      entfernungKm: h.entfernungKm,
      betriebsnummer: h.betriebsnummer,
      betriebsstatus: h.betriebsstatus,
      abholfenster: h.pickupSlots,
    })),
    ohneStandort: ohneStandort.map((h) => ({ id: h.id, betriebsnummer: h.betriebsnummer, betriebsstatus: h.betriebsstatus })),
    // Decimal → Zahl an der Servergrenze: Preis und Grundpreis sind hier nur Anzeige (wie Umfeld und /hoefe).
    produkte: produkte.map((p) => ({
      id: p.id,
      farmId: p.farmId,
      name: p.name,
      familieId: p.familieId,
      category: p.category,
      price: p.price.toNumber(),
      isAvailable: p.isAvailable,
      stock: p.stock,
      reservedStock: p.reservedStock,
      verpackung: p.verpackung,
      futter: p.futter
        ? {
            nettoMenge: p.futter.nettoMenge.toNumber(),
            nettoEinheit: p.futter.nettoEinheit,
            betriebsnummer: betriebsnummerFuerAnzeige({ betriebsnummer: nummerJeHof.get(p.farmId) ?? null }, p.futter),
          }
        : null,
    })),
    abgeschnitten,
  }
}
