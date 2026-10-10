import { prisma } from '@/lib/prisma'
import { decimalZuCents } from '@/lib/order-totals'
import type { HeuteFenster } from '@/lib/heute'
import { plakatBezahlen, teilenAuswahl, teilenBildDaten, teilenBildVersion, teilenTextVorschlag, type TeilenBildDaten, type TeilenBildHof, type TeilenBildProdukt } from '@/lib/teilen-bild'
import { hofAdresse } from '@/lib/mein-hof'
import type { TeilenFensterDaten } from '@/lib/teilen-fenster'
import { APP_URL } from '@/lib/umgebung-server'
import { teilenLink } from '@/lib/teilen-kanal'
import { abholzeitenKurz } from '@/lib/hofseite-fortschritt'
import { einzeiligerFremdtext } from '@/lib/fremdtext'
import { HOFNAME_MAX } from '@/lib/eingabegrenzen'
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

/**
 * Die Daten des Teilen-Fensters für den eigenen Hof (Heute): Auswahl „Im
 * Bild", vorgeschlagener Text, Adresse. Nur, solange der Hof öffentlich ist —
 * sonst null, und es gibt nichts zu teilen. Die Seite fragt mit der farmId
 * aus der Sitzung, nie aus der Eingabe.
 */
export async function getTeilenFensterDaten(farmId: string, jetzt: Date): Promise<TeilenFensterDaten | null> {
  const quelle = await ladeTeilenBildQuelle({ id: farmId })
  if (!quelle) return null
  const adresse = hofAdresse(APP_URL, quelle.hof.slug).anzeige
  const daten = teilenBildDaten({ hof: quelle.hof, produkte: quelle.produkte, slots: quelle.slots, auswahl: null, adresse, jetzt })
  return {
    hofName: daten.hofName,
    slug: quelle.hof.slug,
    basis: APP_URL,
    adresse,
    auswahl: quelle.hof.isPaused ? [] : teilenAuswahl(quelle.produkte, quelle.hof),
    textVorschlag: teilenTextVorschlag(
      daten.produkte.map((p) => p.name),
      daten.abholung
    ),
  }
}

export type PlakatDaten = {
  hofName: string
  ort: string
  /** „farmerzone.at/hof-test" — gedruckt unter dem Code. */
  adresse: string
  /** Die statische Hofseiten-Adresse mit `?k=qr` — Inhalt des QR-Codes. */
  link: string
  /** „Mi 15–18 · Sa 9–12 Uhr"; null ohne Abholzeiten. */
  abholzeiten: string | null
  bezahlen: string | null
}

/**
 * Die Daten des QR-Plakats (Gate 7 Aufgabe 3) für den eigenen Hof — nur
 * öffentliche Angaben und nur, solange der Hof öffentlich ist (S9). Der
 * QR-Code trägt die feste Adresse der Hofseite mit `?k=qr`; ein gedrucktes
 * Plakat bleibt so gültig, egal was sich am Angebot ändert.
 */
export async function getPlakatDaten(farmId: string): Promise<PlakatDaten | null> {
  const farm = await prisma.farm.findFirst({
    where: { id: farmId, ...OEFFENTLICH_SICHTBAR },
    select: {
      name: true,
      slug: true,
      city: true,
      acceptsOnline: true,
      acceptsOnsite: true,
      stripeAccountReady: true,
      pickupSlots: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  })
  if (!farm) return null
  const zeiten = abholzeitenKurz(farm.pickupSlots)
  return {
    hofName: einzeiligerFremdtext(farm.name, HOFNAME_MAX),
    ort: einzeiligerFremdtext(farm.city, HOFNAME_MAX),
    adresse: hofAdresse(APP_URL, farm.slug).anzeige,
    link: teilenLink(APP_URL, farm.slug, 'qr'),
    abholzeiten: zeiten ? `${zeiten} Uhr` : null,
    // Online nur, wenn Stripe fertig ist — sonst stünde auf dem Plakat etwas, das gerade nicht geht.
    bezahlen: plakatBezahlen({ online: farm.acceptsOnline && farm.stripeAccountReady, bar: farm.acceptsOnsite }),
  }
}
