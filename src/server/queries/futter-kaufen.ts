import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { umkreisBox, waehleHoefeImUmkreis, UMFELD_KM } from '@/lib/umfeld'
import { PRODUCT_CATEGORY_VALUES, betriebsnummerFuerAnzeige, istFuttermittel } from '@/lib/taxonomie'
import { wienJetzt } from '@/lib/hofuebersicht'
import { categoryImagePath } from '@/lib/product-image'
import type { EigenerFutterHof, FutterHof, FutterProdukt } from '@/lib/futter-kaufen'
import { leseAusschnitt } from '@/schemas/bild-ausschnitt'
import { IN_LISTEN_SICHTBAR, UEBERSICHT_HOF_SELECT, UEBERSICHT_ZEILEN_SELECT, baueHofUebersicht } from './farm'
import { ausgebuchteTage } from '@/server/abholfenster'
import { PRODUCT_ORDER_BY } from './products'

/**
 * Region › Futter kaufen (Nachtlauf Nr. 22c, Gate 8; seit Nr. 123 nach N23):
 * Futter von Höfen mit LFBIS-Nummer im Umkreis des eigenen Hofs.
 *
 * Wie das Umfeld (src/server/queries/umfeld.ts) liest diese Abfrage fremde
 * Höfe — und genau so nur mit IN_LISTEN_SICHTBAR (aktiv, nicht stillgelegt,
 * freigeschaltet, kein Testhof), dazu nicht pausiert und nie der eigene Hof.
 * Vorfilter `betriebsnummer` nicht leer; ob der Hof zählt, ob eine Größe
 * erscheint und ob sie kaufbar ist, entscheidet src/lib/futter-kaufen.ts.
 *
 * Geladen wird EINMAL der größte Umkreis (50 km: Box als Vorfilter, dann die
 * genaue Entfernung) — die Zahl je Stufe und der gewählte Umkreis entstehen in
 * der reinen Funktion. Je Hof kommen PLZ, Ort, Fotos, Kategorien und
 * Abholzeiten genau wie auf /hoefe (UEBERSICHT_*_SELECT, baueHofUebersicht);
 * die Größen in der Reihenfolge der Produktseite (PRODUCT_ORDER_BY).
 *
 * Was den Server NICHT verlässt: Adresse, Telefon, E-Mail, Bestand. Den
 * Bestand braucht nur `istKaufbar`; Koordinaten nur die Entfernung und die
 * Pins (wie auf /hoefe). Die farmId kommt aus der Sitzung, nie aus dem Client.
 */

/** Die Kategorien des Bereichs Futtermittel samt Altlast — Bestandsfutter bleibt auffindbar. */
const FUTTER_KATEGORIEN = PRODUCT_CATEGORY_VALUES.filter((k) => istFuttermittel(k))

/** Der größte Umkreis — geladen wird immer er (Konzept Umfeld §4, N23). */
const GROESSTER_UMKREIS = UMFELD_KM[UMFELD_KM.length - 1]

const FUTTER_PRODUKT_SELECT = {
  id: true,
  farmId: true,
  name: true,
  familieId: true,
  category: true,
  subcategory: true,
  price: true,
  isAvailable: true,
  stock: true,
  reservedStock: true,
  verpackung: true,
  abholhinweise: true,
  imageUrl: true,
  bildAusschnitt: true,
  futter: { select: { nettoMenge: true, nettoEinheit: true, registrierungsnummer: true } },
} as const satisfies Prisma.ProductSelect

type RohesFutter = Prisma.ProductGetPayload<{ select: typeof FUTTER_PRODUKT_SELECT }>

/** Decimal → Zahl an der Servergrenze: Preis und Grundpreis sind hier nur Anzeige (wie Umfeld und /hoefe). */
function alsFutterProdukt(p: RohesFutter, hofNummer: string | null): FutterProdukt {
  return {
    id: p.id,
    farmId: p.farmId,
    name: p.name,
    familieId: p.familieId,
    category: p.category,
    subcategory: p.subcategory,
    price: p.price.toNumber(),
    isAvailable: p.isAvailable,
    stock: p.stock,
    reservedStock: p.reservedStock,
    verpackung: p.verpackung,
    abholhinweise: p.abholhinweise,
    foto: p.imageUrl,
    fotoAusschnitt: p.imageUrl ? leseAusschnitt(p.bildAusschnitt) : null,
    illustration: categoryImagePath(p.category, p.subcategory),
    futter: p.futter
      ? {
          nettoMenge: p.futter.nettoMenge.toNumber(),
          nettoEinheit: p.futter.nettoEinheit,
          // Die Nummer am Schild: die des Hofs, sonst die Altlast aus der Kennzeichnung —
          // dieselbe Auflösung wie die öffentliche Hofseite (betriebsnummerFuerAnzeige).
          betriebsnummer: betriebsnummerFuerAnzeige({ betriebsnummer: hofNummer }, p.futter),
        }
      : null,
  }
}

export type FutterKaufenDaten =
  | { eigenerStandort: false }
  | {
      eigenerStandort: true
      hoefe: FutterHof[]
      ohneStandort: Array<Pick<FutterHof, 'id' | 'betriebsnummer' | 'betriebsstatus'>>
      produkte: FutterProdukt[]
      abgeschnitten: boolean
      eigen: EigenerFutterHof
    }

/** null, wenn es den Hof nicht gibt. */
export async function getFutterKaufen(farmId: string, jetzt: Date): Promise<FutterKaufenDaten | null> {
  const [eigen, eigenSichtbar] = await Promise.all([
    prisma.farm.findUnique({
      where: { id: farmId },
      select: { name: true, latitude: true, longitude: true, isPaused: true, betriebsnummer: true, betriebsstatus: true },
    }),
    // Würde der eigene Hof bei anderen erscheinen? Dieselbe Sichtbarkeit wie die Liste (N21: nie als Testhof).
    prisma.farm.findFirst({ where: { ...IN_LISTEN_SICHTBAR, id: farmId }, select: { id: true } }),
  ])
  if (!eigen) return null
  if (!Number.isFinite(eigen.latitude) || !Number.isFinite(eigen.longitude)) return { eigenerStandort: false }

  const punkt = { lat: eigen.latitude as number, lon: eigen.longitude as number }
  const box = umkreisBox(punkt, GROESSTER_UMKREIS)
  const kandidaten = await prisma.farm.findMany({
    where: {
      ...IN_LISTEN_SICHTBAR,
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
    select: { ...UEBERSICHT_HOF_SELECT, betriebsnummer: true, betriebsstatus: true },
  })

  const { nah, ohneStandort, abgeschnitten } = waehleHoefeImUmkreis(punkt, kandidaten, GROESSTER_UMKREIS, farmId)
  const ids = [...nah, ...ohneStandort].map((h) => h.id)
  const [produkte, zeilen, eigenesFutter, ausgebucht] = await Promise.all([
    ids.length === 0
      ? []
      : prisma.product.findMany({
          where: { farmId: { in: ids }, isAvailable: true, category: { in: FUTTER_KATEGORIEN } },
          orderBy: PRODUCT_ORDER_BY,
          select: FUTTER_PRODUKT_SELECT,
        }),
    // Fotos, Kategorien und Abholzeiten genau wie /hoefe: dieselben Zeilen für baueHofUebersicht.
    nah.length === 0
      ? []
      : prisma.product.findMany({
          where: { farmId: { in: nah.map((h) => h.id) }, isAvailable: true },
          orderBy: PRODUCT_ORDER_BY,
          select: UEBERSICHT_ZEILEN_SELECT,
        }),
    prisma.product.findMany({
      where: { farmId, isAvailable: true, category: { in: FUTTER_KATEGORIEN } },
      orderBy: PRODUCT_ORDER_BY,
      select: FUTTER_PRODUKT_SELECT,
    }),
    // Volle Abholfenster genau wie /hoefe (Register N19, Ergänzung 21.10.2026), nur für die Höfe der Liste.
    ausgebuchteTage(
      nah.map((h) => h.id),
      jetzt
    ),
  ])

  const uebersicht = new Map(baueHofUebersicht(nah, zeilen, wienJetzt(jetzt), ausgebucht).map((e) => [e.slug, e]))
  const nummerJeHof = new Map([...nah, ...ohneStandort].map((h) => [h.id, h.betriebsnummer]))

  return {
    eigenerStandort: true,
    hoefe: nah.map((h) => {
      const eintrag = uebersicht.get(h.slug)
      return {
        id: h.id,
        slug: h.slug,
        name: h.name,
        postalCode: h.postalCode,
        city: h.city,
        latitude: h.latitude as number,
        longitude: h.longitude as number,
        entfernungKm: h.entfernungKm,
        betriebsnummer: h.betriebsnummer,
        betriebsstatus: h.betriebsstatus,
        // Ohne Eintrag gilt „keine Abholzeit“, wie auf /hoefe — nie die rohen Zeilen ohne volle Tage (Nr. 131).
        abholfenster: eintrag?.abholfenster ?? [],
        fotos: eintrag?.fotos ?? [],
        kategorien: eintrag?.kategorien ?? [],
      }
    }),
    ohneStandort: ohneStandort.map((h) => ({ id: h.id, betriebsnummer: h.betriebsnummer, betriebsstatus: h.betriebsstatus })),
    produkte: produkte.map((p) => alsFutterProdukt(p, nummerJeHof.get(p.farmId) ?? null)),
    abgeschnitten,
    eigen: {
      name: eigen.name,
      latitude: punkt.lat,
      longitude: punkt.lon,
      sichtbar: eigenSichtbar !== null && !eigen.isPaused,
      betriebsnummer: eigen.betriebsnummer,
      betriebsstatus: eigen.betriebsstatus,
      futter: eigenesFutter.map((p) => alsFutterProdukt(p, eigen.betriebsnummer)),
    },
  }
}
