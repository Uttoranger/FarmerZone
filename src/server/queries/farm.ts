import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { abzeichenSeit, zeigtAbzeichen, type AbzeichenBlatt } from '@/lib/gruendungshof'
import { hofAdresse, hofZustand, titelbildFoto, type HofZustand } from '@/lib/mein-hof'
import { APP_URL } from '@/lib/umgebung-server'
import { categoryImagePath } from '@/lib/product-image'
import { zuProduktDto } from '@/lib/produkt-dto'
import { alsCents } from '@/lib/order-totals'
import type { VerpackungValue } from '@/lib/futter-registrierung'
import type { AbholhinweisValue } from '@/lib/abholhinweise'
import { DEFAULT_SECTIONS, type SectionConfig } from './appearance'
import { leseAusschnitt, type BildAusschnitt } from '@/schemas/bild-ausschnitt'
import { PRODUCT_ORDER_BY } from './products'
import type {
  Abgabe,
  Betriebsstatus,
  Futtermittelart,
  NettoEinheit,
  Prisma,
  ProductCategory,
  ProductLabel,
  ProductSubcategory,
  Tierart,
  Trocknung,
} from '@prisma/client'
import { baueAngebotsZeile, fasseAngebotZusammen, type AngebotsProdukt } from '@/lib/bereiche-anzeige'
import { anzeigeBereichVon, betriebsnummerFuerAnzeige, type AnzeigeBereich } from '@/lib/taxonomie'
import {
  NEUER_BEITRAG_TAGE,
  baueFotostreifen,
  naechsteAbholung,
  wienJetzt,
  type AbholFenster,
  type NaechsteAbholung,
  type NeuerBeitrag,
  type OrtsZeit,
  type VorschauProdukt,
} from '@/lib/hofuebersicht'
import { AKTIVER_BEITRAG, NEUESTER_BEITRAG_ZUERST } from './status-posts'
import { alsAbholFenster, ausgebuchteTage, type AusgebuchteTage } from '@/server/abholfenster'

export type PublicProduct = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  /** Ausschnitt und Filter des Produktfotos (Register N17, Nr. 98) — schon geprüft; null = wie heute (Mitte). Nur zusammen mit `imageUrl`. */
  bildAusschnitt: BildAusschnitt | null
  category: ProductCategory | null
  categoryImageUrl: string | null
  price: number
  unit: string
  unitSize: number | null
  stock: number
  isAvailable: boolean
  allergens: string[]
  isOrganic: boolean
  requiresCool: boolean
  requiresFreezer: boolean
  seasonStart: number | null
  seasonEnd: number | null
  unavailableReason: string | null
  // Seit Bereiche 2: für Sektionen, Siegel-Badges und das Produktdetail.
  subcategory: ProductSubcategory | null
  labels: ProductLabel[]
  abgabe: Abgabe
  futter: PublicFutter | null
  /**
   * Seit Nr. 11 (E3): Verkaufsgrößen als Produktfamilie — was dieselbe
   * familieId trägt, zeigt die Produktseite als Größenkacheln. null =
   * Einzelprodukt (heute alle, bis das Formular in Gate 6 sie setzt).
   */
  familieId: string | null
  /** Seit Nr. 11 (E11): Angaben zu Brennmaterial, null ohne. */
  brennmaterial: PublicBrennmaterial | null
  /** Seit Nr. 123 (N23): Abholhinweise eines Futters für die Produktseite; sonst leer. */
  abholhinweise: AbholhinweisValue[]
}

/**
 * Was die Kundin über Brennmaterial liest (Produktseite, Nr. 11). Ohne
 * Kennungen und ohne Datum — `gelagertSeit` bleibt auf dem Server, bis eine
 * Anzeige es braucht (dann als Wiener Tag, CODING_STANDARDS §2).
 */
export type PublicBrennmaterial = {
  holzart: string
  scheitlaengeCm: number | null
  trocknung: Trocknung
  restfeuchteMax: number | null
  wassergehalt: number | null
  koernung: number | null
  ueberdacht: boolean
}

/**
 * Die Futter-Kennzeichnung, wie Kundinnen sie vor dem Kauf sehen (Fernabsatz,
 * Konzept 6.3). Decimal und Date sind schon gewandelt — dieser Typ geht an
 * Client-Komponenten. Die Betriebsnummer ist bereits aufgelöst (Hof, sonst
 * Altlast der Kennzeichnung); die Altlast-Spalte selbst verlässt den Server nie.
 */
export type PublicFutter = {
  futtermittelart: Futtermittelart
  zielTierarten: Tierart[]
  zusammensetzung: string
  analytischeBestandteile: string
  zusatzstoffe: string | null
  gebrauchshinweis: string | null
  nettoMenge: number
  nettoEinheit: NettoEinheit
  rohprotein: number | null
  rohfaser: number | null
  rohfett: number | null
  rohasche: number | null
  betriebsnummer: string | null
  /** ISO-Zeitpunkt der letzten Bestätigung durch den Hof. */
  bestaetigtAm: string
}

export type PublicPickupSlot = {
  dayOfWeek: number
  startTime: string
  endTime: string
  /** Die vollen Wiener Kalendertage im Vorlauf (Register N19, Ergänzung 21.10.2026) — nur auf der Hof- und Produktseite gefüllt (`ladeHofseite`), nie von `getPublicFarm`/`getOwnerFarm` selbst. */
  ausgebuchtAm?: readonly string[]
}

export type PublicFarmValue = {
  id: string
  icon: string
  title: string
  subtitle: string | null
}

export type PublicFarmPhoto = {
  id: string
  url: string
  caption: string | null
  sortOrder: number
  /** Ausschnitt und Filter der Kachel (Register N17, Nr. 98) — schon geprüft; null = wie heute. */
  ausschnitt: BildAusschnitt | null
}

export type PublicFarm = {
  id: string
  slug: string
  name: string
  ownerName: string
  description: string
  address: string
  postalCode: string
  city: string
  /** "AT" oder "DE" (Farm.country) — für addressCountry im JSON-LD (Nr. 164). */
  country: string
  phone: string
  email: string
  logoUrl: string | null
  /** Ausschnitt des Logos, ohne Filter (Register N17, Nr. 98) — schon geprüft; null = wie heute. */
  logoAusschnitt: BildAusschnitt | null
  bannerUrl: string | null
  // Presentation fields
  tagline: string | null
  foundedYear: number | null
  aboutText: string | null
  bannerType: 'GRADIENT' | 'PHOTO'
  bannerValue: string | null
  bannerFocusY: number
  /** Ausschnitt, Zoom, Filter und Wahl füllen/ganz des Titelbilds (Register N13, Nr. 97) — schon geprüft; null = wie vorher. */
  bannerAusschnitt: BildAusschnitt | null
  sectionsConfig: SectionConfig[]
  farmValues: PublicFarmValue[]
  farmPhotos: PublicFarmPhoto[]
  acceptsOnline: boolean
  acceptsOnsite: boolean
  stripeAccountReady: boolean
  isPaused: boolean
  pauseMessage: string | null
  // Servicegebühr-Einstellung des Hofes (Sprint servicegebuehr): Der Checkout
  // zeigt die Gebühr VORAB mit derselben Rechnung wie der Server
  // (src/lib/servicegebuehr.ts). Prozent als Zahl (Decimal ist nicht über die
  // RSC-Grenze serialisierbar), Datum als ISO-Text oder null (= gebührenfrei)
  // — dieser Typ geht an Client-Komponenten (CODING_STANDARDS: Date nicht roh);
  // servicegebuehr.ts nimmt Date und Text gleich.
  serviceFeePercent: number
  serviceFeeMinCents: number
  serviceFeeActiveFrom: string | null
  /**
   * Welche Nummer in Farm.betriebsnummer steht (Nr. 11): Das Schild
   * „Futtermittelbetrieb · LFBIS …" (E9) braucht den Status Primärproduktion.
   * Die Nummer selbst geht nur aufgelöst in der Kennzeichnung mit.
   */
  betriebsstatus: Betriebsstatus | null
  products: PublicProduct[]
  pickupSlots: PublicPickupSlot[]
  /** Abzeichen „Gründungshof“ (Register K2, Nr. 116) — nur Ja/Nein, nie die Nummer des Platzes. */
  gruendungshof: boolean
  /** Testhof (Register N21, Nr. 119): Die Hofseite zeigt oben „Testhof – nur zum Ausprobieren“. */
  istTesthof: boolean
  /** „Oktober 2026“ — der Monat der Freischaltung fürs Erklär-Blatt; null ohne Abzeichen. */
  gruendungSeit: string | null
  /** Die Zahlen des Erklär-Blatts — die Abfrage liefert null, die Hofseite füllt sie (ladeHofseite). */
  abzeichenBlatt: AbzeichenBlatt | null
}

/**
 * Was das Abzeichen braucht (Register K2, Änderung Nr. 116). Gelesen wird der
 * festgeschriebene Platz, gegeben wird nur das Ja/Nein (`abzeichenDaten`) —
 * jede Abfrage, die diese Felder liest, nimmt sie vor dem Rückgabewert heraus.
 */
export const ABZEICHEN_SELECT = {
  approvedAt: true,
  gruendungPlatz: true,
  gruendungAusgenommen: true,
  gruendungAbzeichenZeigen: true,
} satisfies Prisma.FarmSelect

/**
 * Der Schalter „Abzeichen zeigen“ unter Konditionen und Tarif (Nr. 116): nur
 * der eigene Hof (ownerId), nur ob er ein Gründungshof ist (festgeschriebener
 * Platz, nicht ausgenommen) und wie der Schalter steht — nie die Nummer.
 * null heißt „kein Gründungshof“ (dann kein Schalter).
 */
export async function ladeAbzeichenSchalter(ownerId: string): Promise<{ zeigen: boolean } | null> {
  const hof = await prisma.farm.findUnique({ where: { ownerId }, select: ABZEICHEN_SELECT })
  return hof && zeigtAbzeichen({ ...hof, gruendungAbzeichenZeigen: true }) ? { zeigen: hof.gruendungAbzeichenZeigen } : null
}

/** Aus den Feldern von ABZEICHEN_SELECT das, was an den Browser darf. */
function abzeichenDaten(
  hof: Prisma.FarmGetPayload<{ select: typeof ABZEICHEN_SELECT }>
): Pick<PublicFarm, 'gruendungshof' | 'gruendungSeit' | 'abzeichenBlatt'> {
  const gruendungshof = zeigtAbzeichen(hof)
  return { gruendungshof, gruendungSeit: gruendungshof && hof.approvedAt ? abzeichenSeit(hof.approvedAt) : null, abzeichenBlatt: null }
}

const FARM_PHOTO_SELECT = {
  orderBy: { sortOrder: 'asc' as const },
  select: { id: true, url: true, caption: true, sortOrder: true, ausschnitt: true },
}

/** Json aus der Datenbank nur über leseAusschnitt: Ein ungültiger Wert ergibt null, nie einen Fehler auf der Hofseite. */
function alsOeffentlichesFoto({ ausschnitt, ...foto }: { id: string; url: string; caption: string | null; sortOrder: number; ausschnitt: Prisma.JsonValue }): PublicFarmPhoto {
  return { ...foto, ausschnitt: leseAusschnitt(ausschnitt) }
}

/**
 * DIE öffentliche Sichtbarkeits-Bedingung — eine Quelle für Einzelseite UND
 * Übersicht, damit die beiden nie auseinanderlaufen können:
 * archivedAt: null — ein stillgelegter Hof ist öffentlich nicht auffindbar;
 * approvedAt: { not: null } — dasselbe für einen noch nicht vom Betreiber
 * freigeschalteten Hof (src/lib/farm-approval.ts).
 */
export const OEFFENTLICH_SICHTBAR = {
  isActive: true,
  archivedAt: null,
  approvedAt: { not: null },
} as const

/**
 * Die zweite Stufe der Sichtbarkeit (Register N21, Nr. 119): Was ein Link
 * direkt öffnet (Hofseite, Produktseite, Teilen-Bild, Plakat, Teilen-Zählung),
 * fragt OEFFENTLICH_SICHTBAR; jede Liste, Karte, Zählung und Auswahl fragt
 * DIESE Bedingung — ein Testhof erscheint dort nie. Eine Quelle, damit keine
 * Liste den Testhof vergisst (Wache: tests/testhof-sichtbarkeit-wache.test.ts).
 */
export const IN_LISTEN_SICHTBAR = {
  ...OEFFENTLICH_SICHTBAR,
  istTesthof: false,
} as const

/** Die Produktfelder der Hofseite — EINE Liste für Kundenansicht und Hof-Vorschau. */
const OEFFENTLICHES_PRODUKT_SELECT = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  bildAusschnitt: true,
  category: true,
  subcategory: true,
  price: true,
  unit: true,
  unitSize: true,
  stock: true,
  isAvailable: true,
  allergens: true,
  // Bio kommt seit Sprint Taxonomie 1 aus labels, nicht aus der
  // Altlast-Spalte isOrganic — die Abbildung unten macht daraus das
  // Boolean, das die Hofseite kennt.
  labels: true,
  abgabe: true,
  requiresCool: true,
  requiresFreezer: true,
  seasonStart: true,
  seasonEnd: true,
  unavailableReason: true,
  futter: {
    select: {
      futtermittelart: true,
      zielTierarten: true,
      zusammensetzung: true,
      analytischeBestandteile: true,
      zusatzstoffe: true,
      gebrauchshinweis: true,
      nettoMenge: true,
      nettoEinheit: true,
      rohprotein: true,
      rohfaser: true,
      rohfett: true,
      rohasche: true,
      registrierungsnummer: true,
      bestaetigtAm: true,
    },
  },
  // Seit Nr. 11: Produktfamilie (E3) und Brennmaterial (E11) für die Produktseite.
  familieId: true,
  // Seit Nr. 123: Abholhinweise eines Futters für die Produktseite (N23).
  abholhinweise: true,
  brennmaterial: {
    select: {
      holzart: true,
      scheitlaengeCm: true,
      trocknung: true,
      restfeuchteMax: true,
      wassergehalt: true,
      koernung: true,
      ueberdacht: true,
    },
  },
} satisfies Prisma.ProductSelect

type RohesOeffentlichesProdukt = Prisma.ProductGetPayload<{ select: typeof OEFFENTLICHES_PRODUKT_SELECT }>

const zahlOderNull = (d: { toString(): string } | null): number | null => (d === null ? null : Number(d))

function alsOeffentlichesProdukt(
  { futter, ...p }: RohesOeffentlichesProdukt,
  hof: { betriebsnummer: string | null }
): PublicProduct {
  return {
    ...zuProduktDto(p),
    bildAusschnitt: leseAusschnitt(p.bildAusschnitt),
    categoryImageUrl: categoryImagePath(p.category, p.subcategory),
    isOrganic: p.labels.includes('BIO'),
    futter: futter
      ? {
          futtermittelart: futter.futtermittelart,
          zielTierarten: futter.zielTierarten,
          zusammensetzung: futter.zusammensetzung,
          analytischeBestandteile: futter.analytischeBestandteile,
          zusatzstoffe: futter.zusatzstoffe,
          gebrauchshinweis: futter.gebrauchshinweis,
          // Nur Anzeige (Nettomenge, Kilopreis) — abgerechnet wird je Gebinde.
          nettoMenge: Number(futter.nettoMenge),
          nettoEinheit: futter.nettoEinheit,
          rohprotein: zahlOderNull(futter.rohprotein),
          rohfaser: zahlOderNull(futter.rohfaser),
          rohfett: zahlOderNull(futter.rohfett),
          rohasche: zahlOderNull(futter.rohasche),
          betriebsnummer: betriebsnummerFuerAnzeige(hof, futter),
          bestaetigtAm: futter.bestaetigtAm.toISOString(),
        }
      : null,
  }
}

/**
 * Was nur der Server vom öffentlichen Hof braucht: die Rohwerte des
 * Teilen-Bilds (Nr. 196). Die Betriebsnummer entscheidet die Sperre je
 * Gebinde, der Preis kommt als Cent aus dem Decimal derselben Zeile (kein
 * Umweg über `price: number`). Geht nie an den Browser.
 */
export type TeilenRoh = {
  betriebsnummer: string | null
  produkte: ReadonlyMap<string, { preisCents: number; verpackung: VerpackungValue | null }>
}

/** Der öffentliche Hof und seine Rohwerte fürs Teilen-Bild — aus EINER Abfrage. */
export type OeffentlicherHof = { farm: PublicFarm; teilen: TeilenRoh }

/**
 * Der öffentliche Hof samt Rohwerten des Teilen-Bilds (Nr. 196): Hofseite
 * (Metadaten), Teilen-Bild-Route und Teilen-Fenster bauen das Bild aus
 * derselben Abfrage wie die Seite (getPublicFarm), statt eine eigene zu stellen.
 */
export async function getPublicFarmMitTeilen(wo: { slug: string } | { id: string }): Promise<OeffentlicherHof | null> {
  // Die Filterung sitzt bewusst hier in der Query und nicht in den Seiten:
  // jede öffentliche Unterseite, die über getPublicFarm lädt, ist damit
  // automatisch mitgesperrt und läuft in ihren bestehenden notFound-Pfad.
  const farm = await prisma.farm.findUnique({
    where: { ...wo, ...OEFFENTLICH_SICHTBAR },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerName: true,
      description: true,
      address: true,
      postalCode: true,
      city: true,
      country: true,
      phone: true,
      email: true,
      logoUrl: true,
      bannerUrl: true,
      tagline: true,
      foundedYear: true,
      aboutText: true,
      bannerType: true,
      bannerValue: true,
      bannerFocusY: true,
      bannerAusschnitt: true,
      logoAusschnitt: true,
      sectionsConfig: true,
      acceptsOnline: true,
      acceptsOnsite: true,
      stripeAccountReady: true,
      isPaused: true,
      pauseMessage: true,
      serviceFeePercent: true,
      serviceFeeMinCents: true,
      serviceFeeActiveFrom: true,
      farmValues: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, icon: true, title: true, subtitle: true },
      },
      farmPhotos: FARM_PHOTO_SELECT,
      // Die Betriebsnummer des Hofs zeigt das Produktdetail in der
      // Futter-Kennzeichnung (Rückfrage F6); sie geht nur aufgelöst weiter.
      betriebsnummer: true,
      // Abzeichen (Nr. 116): gelesen, aber nur als Ja/Nein weitergegeben (abzeichenDaten).
      ...ABZEICHEN_SELECT,
      // Für das Schild nach E9 (Nr. 11): welche Nummer das ist.
      betriebsstatus: true,
      // Testhof (Register N21, Nr. 119): der Hinweis oben auf der Hofseite.
      istTesthof: true,
      products: {
        orderBy: PRODUCT_ORDER_BY,
        // Seit Nr. 196 mit der Verpackung — nur für das Teilen-Bild (Sperre je Gebinde), nie an den Browser.
        select: { ...OEFFENTLICHES_PRODUKT_SELECT, verpackung: true },
      },
      pickupSlots: {
        where: { isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
  })

  if (!farm) return null

  const rawSections = farm.sectionsConfig
  const sections: SectionConfig[] =
    Array.isArray(rawSections) && rawSections.length > 0
      ? (rawSections as SectionConfig[])
      : DEFAULT_SECTIONS

  // Die Felder des Abzeichens (auch die Nummer des Platzes) fallen hier heraus — nur das Ja/Nein geht weiter.
  const { betriebsnummer, approvedAt, gruendungPlatz, gruendungAusgenommen, gruendungAbzeichenZeigen, ...rest } = farm
  // Die Verpackung bleibt auf dem Server: Sie geht nur in die Rohwerte des Teilen-Bilds.
  const produkte = farm.products.map(({ verpackung, ...p }) => ({ verpackung, p }))
  const teilen: TeilenRoh = {
    betriebsnummer,
    produkte: new Map(produkte.map(({ verpackung, p }) => [p.id, { preisCents: alsCents(p.price), verpackung }])),
  }
  const oeffentlich: PublicFarm = {
    ...rest,
    ...abzeichenDaten({ approvedAt, gruendungPlatz, gruendungAusgenommen, gruendungAbzeichenZeigen }),
    bannerType: farm.bannerType as 'GRADIENT' | 'PHOTO',
    // Json aus der Datenbank nur über leseAusschnitt: Ein ungültiger Wert ergibt null, nie einen Fehler auf der Hofseite.
    bannerAusschnitt: leseAusschnitt(farm.bannerAusschnitt),
    logoAusschnitt: leseAusschnitt(farm.logoAusschnitt),
    sectionsConfig: sections,
    farmPhotos: farm.farmPhotos.map(alsOeffentlichesFoto),
    serviceFeePercent: Number(farm.serviceFeePercent),
    serviceFeeActiveFrom: farm.serviceFeeActiveFrom?.toISOString() ?? null,
    products: produkte.map(({ p }) => alsOeffentlichesProdukt(p, { betriebsnummer })),
  }
  return { farm: oeffentlich, teilen }
}

export async function getPublicFarm(slug: string): Promise<PublicFarm | null> {
  return (await getPublicFarmMitTeilen({ slug }))?.farm ?? null
}

/**
 * `getPublicFarm` einmal je Anfrage (React `cache`) — für Seiten, deren
 * Metadaten und Inhalt denselben Hof brauchen (die Kasse; die Hofseite teilt
 * über `ladeHofseiteGeteilt`).
 *
 * Nicht nur gespart, sondern nötig (Nr. 47): Zwei getrennte Aufrufe im
 * selben Takt bündelt Prisma 7 zu einem Batch — `approvedAt: { not: null }`
 * verhindert, dass er sie zu einer Abfrage zusammenlegt — und führt ihn in
 * EINER Transaktion aus. Darin laufen die Teilabfragen der Relationen (Werte,
 * Fotos, Produkte samt Futter und Brennmaterial, Abholzeiten) gleichzeitig
 * über dieselbe Verbindung: pg warnt „Calling client.query() when the client
 * is already executing a query", ab pg@9 ist es ein Fehler.
 */
export const getPublicFarmGeteilt: typeof getPublicFarm = cache(getPublicFarm)

export async function getOwnerFarm(ownerId: string): Promise<PublicFarm | null> {
  const farm = await prisma.farm.findUnique({
    where: { ownerId },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerName: true,
      description: true,
      address: true,
      postalCode: true,
      city: true,
      country: true,
      phone: true,
      email: true,
      logoUrl: true,
      bannerUrl: true,
      tagline: true,
      foundedYear: true,
      aboutText: true,
      bannerType: true,
      bannerValue: true,
      bannerFocusY: true,
      bannerAusschnitt: true,
      logoAusschnitt: true,
      sectionsConfig: true,
      acceptsOnline: true,
      acceptsOnsite: true,
      stripeAccountReady: true,
      isPaused: true,
      pauseMessage: true,
      serviceFeePercent: true,
      serviceFeeMinCents: true,
      serviceFeeActiveFrom: true,
      farmValues: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, icon: true, title: true, subtitle: true },
      },
      farmPhotos: FARM_PHOTO_SELECT,
      // Die Betriebsnummer des Hofs zeigt das Produktdetail in der
      // Futter-Kennzeichnung (Rückfrage F6); sie geht nur aufgelöst weiter.
      betriebsnummer: true,
      // Abzeichen (Nr. 116): gelesen, aber nur als Ja/Nein weitergegeben (abzeichenDaten).
      ...ABZEICHEN_SELECT,
      // Für das Schild nach E9 (Nr. 11): welche Nummer das ist.
      betriebsstatus: true,
      // Testhof (Register N21, Nr. 119): der Hinweis oben auf der Hofseite.
      istTesthof: true,
      products: {
        orderBy: PRODUCT_ORDER_BY,
        select: OEFFENTLICHES_PRODUKT_SELECT,
      },
      pickupSlots: {
        where: { isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
  })

  if (!farm) return null

  const rawSections = farm.sectionsConfig
  const sections: SectionConfig[] =
    Array.isArray(rawSections) && rawSections.length > 0
      ? (rawSections as SectionConfig[])
      : DEFAULT_SECTIONS

  // Die Felder des Abzeichens (auch die Nummer des Platzes) fallen hier heraus — nur das Ja/Nein geht weiter.
  const { betriebsnummer, approvedAt, gruendungPlatz, gruendungAusgenommen, gruendungAbzeichenZeigen, ...rest } = farm
  return {
    ...rest,
    ...abzeichenDaten({ approvedAt, gruendungPlatz, gruendungAusgenommen, gruendungAbzeichenZeigen }),
    bannerType: farm.bannerType as 'GRADIENT' | 'PHOTO',
    // Json aus der Datenbank nur über leseAusschnitt: Ein ungültiger Wert ergibt null, nie einen Fehler auf der Hofseite.
    bannerAusschnitt: leseAusschnitt(farm.bannerAusschnitt),
    logoAusschnitt: leseAusschnitt(farm.logoAusschnitt),
    sectionsConfig: sections,
    farmPhotos: farm.farmPhotos.map(alsOeffentlichesFoto),
    serviceFeePercent: Number(farm.serviceFeePercent),
    serviceFeeActiveFrom: farm.serviceFeeActiveFrom?.toISOString() ?? null,
    products: farm.products.map((p) => alsOeffentlichesProdukt(p, { betriebsnummer })),
  }
}

export type FarmSettings = {
  id: string
  name: string
  ownerName: string
  description: string
  address: string
  postalCode: string
  city: string
  /** "AT" oder "DE" — die Länderauswahl im Hofprofil (src/lib/laender.ts). */
  country: string
  /** Bestätigter Kartenpunkt — steuert die Beschriftung der Standort-Schaltfläche. */
  latitude: number | null
  longitude: number | null
  phone: string
  email: string
  logoUrl: string | null
  bannerUrl: string | null
  isPaused: boolean
  pauseMessage: string | null
  slug: string
  /** Betriebsnummer und -status (Sprint Bereiche 1, Rückfrage F6). */
  betriebsnummer: string | null
  betriebsstatus: Betriebsstatus | null
  pickupSlots: Array<{
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    maxOrders: number | null
    isActive: boolean
  }>
}

export async function getFarmSettings(ownerId: string): Promise<FarmSettings | null> {
  return prisma.farm.findUnique({
    where: { ownerId },
    select: {
      id: true,
      name: true,
      ownerName: true,
      description: true,
      address: true,
      postalCode: true,
      city: true,
      country: true,
      latitude: true,
      longitude: true,
      phone: true,
      email: true,
      logoUrl: true,
      bannerUrl: true,
      isPaused: true,
      pauseMessage: true,
      slug: true,
      betriebsnummer: true,
      betriebsstatus: true,
      pickupSlots: {
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          maxOrders: true,
          isActive: true,
        },
      },
    },
  })
}

/**
 * Stilllegungs-Zustand des eigenen Hofs — für den Kasten auf /settings/account
 * und den Owner-Balken im Farmer-Layout.
 */
export async function getFarmArchiveState(
  ownerId: string
): Promise<{ slug: string; archivedAt: Date | null } | null> {
  return prisma.farm.findUnique({
    where: { ownerId },
    select: { slug: true, archivedAt: true },
  })
}

/**
 * Zustands-Felder für die Balken im Farmer-Layout: Stilllegung UND Freigabe
 * in EINER Abfrage — das Layout rendert bei jedem Seitenaufruf, zwei Queries
 * dafür wären verschenkt. Wortlaute: src/lib/farm-archive.ts bzw. farm-approval.ts.
 */
export async function getFarmBannerState(
  ownerId: string
): Promise<{
  id: string
  name: string
  slug: string
  archivedAt: Date | null
  approvedAt: Date | null
  /** Für den Zusatzsatz im Warte-Balken: Deutschland ist in Vorbereitung. */
  country: string
} | null> {
  return prisma.farm.findUnique({
    where: { ownerId },
    select: { id: true, name: true, slug: true, archivedAt: true, approvedAt: true, country: true },
  })
}

// Sprint 19: braucht die Verkauf-Seite für den Stripe-Auszahlungs-Link
export async function getStripeReadiness(ownerId: string): Promise<boolean> {
  const farm = await prisma.farm.findUnique({
    where: { ownerId },
    select: { stripeAccountReady: true },
  })
  return farm?.stripeAccountReady ?? false
}

// ─── Öffentliche Hofübersicht (/hoefe) ──────────────────────────────────────

/**
 * So viele Produktzeilen lädt die Übersicht je Hof — gezeigt werden davon
 * höchstens drei (VORSCHAU_ZEILEN). Der Vorrat darüber hinaus lässt der
 * Kategoriefilter passende Produkte nach vorn ziehen, ohne nachzuladen.
 *
 * GRENZE, bewusst: Der Filter arbeitet clientseitig auf genau diesen Zeilen.
 * Führt ein Hof seine Honig-Produkte erst ab Platz neun, erscheint er beim
 * Filtern nach Honig weiterhin in der Liste (die Kategorien sind vollständig,
 * siehe unten) — sein Schaufenster zeigt dann aber die vorderen Produkte
 * statt des Honigs. Das aufzulösen hieße, den Filter serverseitig zu machen
 * oder das ganze Sortiment zu laden; beides wäre ein eigener Sprint.
 */
export const VORSCHAU_LADE_DECKEL = 8

/**
 * VORSCHAU-VERFÜGBARKEIT — und eine Abweichung, die hier festgehalten gehört:
 *
 * Die Vorschau kennzeichnet ein Produkt als „derzeit aus", wenn
 * `stock - reservedStock <= 0` ist. Die öffentliche Hofseite entscheidet das
 * heute anders: Sie prüft allein den Bestand
 * (src/components/farm/product-grid.tsx:68 `stock === 0`, :275 `stock > 0`,
 * :421 dasselbe im Warenkorb-Abgleich).
 *
 * Beides führt derzeit zum SELBEN Ergebnis, weil `Product.reservedStock`
 * (prisma/schema.prisma:249) im ganzen Repo nirgends beschrieben wird — die
 * Spalte steht auf ihrer Vorgabe 0. Echte Reservierungen liegen in
 * `StockReservation` (schema:392) und werden ausschließlich beim Bestellen
 * live zusammengezählt (api/checkout/route.ts:120–131, api/reserve:78–88).
 *
 * Wird die Spalte je gefüllt, MÜSSEN Vorschau und Hofseite gemeinsam auf
 * dieselbe Regel gezogen werden — sonst verspricht die eine, was die andere
 * verweigert.
 */

export type HofUebersichtEintrag = {
  slug: string
  name: string
  /** Nur PLZ und Ort — die Straße gehört nicht in die Übersicht, sie steht
   *  auf der Hofseite. */
  postalCode: string
  city: string
  logoUrl: string | null
  /** Ausschnitt des Logos (Register N17, Nr. 98) — schon geprüft; null = wie heute. */
  logoAusschnitt: BildAusschnitt | null
  latitude: number | null
  longitude: number | null
  isPaused: boolean
  /** Distinct-Kategorien der KAUFBAREN Produkte (istKaufbar), in
   *  Schema-Reihenfolge, über beide Bereiche — aus demselben Angebot wie
   *  suchNamen, deshalb zählen Chips und Suche dasselbe. */
  kategorien: ProductCategory[]
  /** Jedes KAUFBARE Produkt als schmale Zeile — Grundlage für Bereich,
   *  Facetten, Karte und Kilopreis-Sortierung (src/lib/bereiche-anzeige.ts)
   *  und seit Nr. 09 für die Produkttreffer der Suche (produktTreffer in
   *  src/lib/hoefe-entdecken.ts). */
  angebot: AngebotsProdukt[]
  /** Der nächste Abholtermin, den man noch bestellen kann — null ohne aktive Fenster. */
  naechsteAbholung: NaechsteAbholung | null
  /** Die aktiven Abholzeiten (Wochentag, Beginn, Ende): Daraus rechnet der
   *  Browser die Abholzeile und den Filter „Abholung" mit SEINER Uhr neu
   *  (Register N22) — die Seite ist bis zu zehn Minuten alt. */
  abholfenster: AbholFenster[]
  /** Die Produktvorschau der Karte: höchstens VORSCHAU_LADE_DECKEL Zeilen,
   *  in der Reihenfolge der Hofseite. Die Auswahl daraus trifft
   *  waehleVorschauProdukte (src/lib/hofuebersicht.ts). */
  produkte: VorschauProdukt[]
  /** ALLE verfügbar geschalteten Produkte des Hofes — Grundlage für
   *  „+ n weitere", auch wenn oben gedeckelt wurde. */
  produkteGesamt: number
  /** Dieselbe Zahl je Bereich — „+ n weitere" zählt auf der Karte nur den
   *  gezeigten Bereich, sonst verspräche der Hofladen Heu. */
  produkteJeBereich: Record<AnzeigeBereich, number>
  /** Die Namen ALLER verfügbaren Produkte (Bestand abzüglich Reservierung
   *  über null), UNGEDECKELT — die Grundlage der Produktsuche: Auf den acht
   *  Vorschau-Zeilen wäre ein Hof mit dem Gesuchten ab Platz neun ein
   *  falsches Negativ. Aus der schmalen Zeilen-Abfrage, wie die Kategorien. */
  suchNamen: string[]
  /** Der Fotostreifen: nur URLs, Titelbild zuerst, höchstens fünf
   *  (baueFotostreifen in src/lib/hofuebersicht.ts). Leer = keine Fotos,
   *  die Karte bleibt kompakt. */
  fotos: string[]
  /** Abzeichen „Gründungshof“ (Register K2, Nr. 116) — nur Ja/Nein, nie die Nummer. */
  gruendungshof: boolean
  /** Der neueste aktive Beitrag, höchstens sieben Tage alt (Register N22, Ergänzung Nr. 129) — die Marke „Neu · vor …“ an der Hofkarte; null ohne. */
  neuerBeitrag: NeuerBeitrag | null
}

/**
 * Der neueste aktive Beitrag (AKTIVER_BEITRAG) eines Hofs, höchstens
 * NEUER_BEITRAG_TAGE alt — als Einbindung der Hof-Abfrage der Hofliste (kein
 * N+1, keine zweite Abfrage). Nur Titel und Zeitpunkte, kein Text.
 */
function neuerBeitragEinbindung(jetzt: Date) {
  return {
    where: { AND: [AKTIVER_BEITRAG(jetzt), { publishedAt: { gte: new Date(jetzt.getTime() - NEUER_BEITRAG_TAGE * 24 * 60 * 60_000) } }] },
    orderBy: NEUESTER_BEITRAG_ZUERST,
    take: 1,
    select: { title: true, publishedAt: true, expiresAt: true },
  } satisfies Prisma.Farm$statusPostsArgs
}

type NeuerBeitragRoh = { title: string; publishedAt: Date | null; expiresAt: Date | null }

function alsNeuerBeitrag(roh: NeuerBeitragRoh | undefined): NeuerBeitrag | null {
  if (!roh?.publishedAt) return null
  return { titel: roh.title, veroeffentlicht: roh.publishedAt.toISOString(), endet: roh.expiresAt?.toISOString() ?? null }
}

/** Die schmalen Zeilen ALLER verfügbaren Produkte — Inhalt der Abfrage `zeilenJeHof` in getOeffentlicheHoefe (seit Nr. 122 benannt, damit Region den eigenen Eintrag genau so baut). */
export const UEBERSICHT_ZEILEN_SELECT = {
  farmId: true,
  category: true,
  subcategory: true,
  labels: true,
  imageUrl: true,
  bildAusschnitt: true,
  name: true,
  price: true,
  stock: true,
  reservedStock: true,
  futter: { select: { zielTierarten: true, nettoMenge: true, nettoEinheit: true } },
  // Seit Nr. 09 zeigt die Produktsuche Produkte statt Höfe: Kennung,
  // Einheit und Gebinde für die Preiszeile — aus DIESER ungedeckelten
  // Abfrage, nicht aus den acht Vorschau-Zeilen (falsches Negativ ab
  // Platz neun, wie oben bei den Suchnamen).
  id: true,
  unit: true,
  unitSize: true,
} as const satisfies Prisma.ProductSelect

/** Die Felder je Hof — Inhalt der Hof-Abfrage in getOeffentlicheHoefe (seit Nr. 122 benannt, wie oben). */
export const UEBERSICHT_HOF_SELECT = {
  // id/approvedAt/createdAt werden (noch) NICHT angezeigt: Zusammen mit
  // archivedAt (hier durch den Filter konstant null) sind sie die
  // Eingabe von gruendungsplaetze() (src/lib/gruendungshof.ts,
  // HofFuerPlatz) — die spätere Gründungshof-Kennzeichnung braucht damit
  // KEINEN Query-Umbau, nur eine Anzeige.
  id: true,
  approvedAt: true,
  createdAt: true,
  // Abzeichen (Nr. 116): nur für das Ja/Nein unten, die Nummer verlässt die Abfrage nicht.
  gruendungPlatz: true,
  gruendungAusgenommen: true,
  gruendungAbzeichenZeigen: true,
  slug: true,
  name: true,
  postalCode: true,
  city: true,
  logoUrl: true,
  logoAusschnitt: true,
  latitude: true,
  longitude: true,
  isPaused: true,
  bannerUrl: true,
  bannerType: true,
  // Die ersten vier Galerie-Fotos für den Fotostreifen — mehr lädt die
  // Query nie (Deckel siehe baueFotostreifen).
  farmPhotos: {
    orderBy: { sortOrder: 'asc' },
    take: 4,
    select: { url: true },
  },
  // EINE products-Einbindung für DREI Ableitungen: Produktfotos des
  // Streifens, die Produktvorschau der Karte und (bis zu ihrer Deckelung,
  // siehe unten) die Kategorien — Prisma erlaubt dieselbe Relation nicht
  // zweimal im selben select. Sie wurde ERWEITERT, nicht dupliziert.
  products: {
    where: { isAvailable: true },
    // Stabile Reihenfolge (Repo-Konvention der Hofseite): Ohne orderBy
    // wären „die ersten drei" Produktfotos DB-launisch und der Streifen
    // wechselte zwischen zwei Ladevorgängen sein Gesicht.
    orderBy: PRODUCT_ORDER_BY,
    take: VORSCHAU_LADE_DECKEL,
    select: {
      id: true,
      name: true,
      price: true,
      unit: true,
      unitSize: true,
      stock: true,
      reservedStock: true,
      category: true,
      // Nr. 127: Ohne Foto zeigt die Produktzeile die Illustration der Unterkategorie (illustrationPfad).
      subcategory: true,
      imageUrl: true,
      bildAusschnitt: true,
    },
  },
  // Die Gesamtzahl der verfügbar geschalteten Produkte — die Zeile
  // „+ n weitere" muss auch dann stimmen, wenn oben gedeckelt wurde.
  _count: { select: { products: { where: { isAvailable: true } } } },
  pickupSlots: {
    where: { isActive: true },
    select: { dayOfWeek: true, startTime: true, endTime: true },
  },
} as const satisfies Prisma.FarmSelect

type UebersichtZeile = Prisma.ProductGetPayload<{ select: typeof UEBERSICHT_ZEILEN_SELECT }>
type UebersichtHof = Prisma.FarmGetPayload<{ select: typeof UEBERSICHT_HOF_SELECT }>

/**
 * Baut aus den Höfen und ihren schmalen Zeilen die Einträge der Hofliste —
 * der Zusammenbau von getOeffentlicheHoefe, seit Nr. 122 benannt: Region baut
 * den eigenen Eintrag damit genau so wie /hoefe (src/server/queries/region.ts).
 * `ausgebucht` sind die vollen Abholfenster derselben Höfe (`ausgebuchteTage`,
 * Register N19, Ergänzung 21.10.2026) — alle drei Aufrufer zählen damit.
 */
export function baueHofUebersicht(
  // statusPosts nur aus getOeffentlicheHoefe (neuerBeitragEinbindung); ohne sie kein neuer Beitrag.
  hoefe: readonly (UebersichtHof & { statusPosts?: NeuerBeitragRoh[] })[],
  schmaleZeilen: readonly UebersichtZeile[],
  jetzt: OrtsZeit,
  ausgebucht: AusgebuchteTage
): HofUebersichtEintrag[] {
  // Was die Deckelung oben NICHT verlieren darf: Kategorien, Produktfotos
  // und Suchnamen hängen an ALLEN verfügbaren Produkten, nicht an den
  // ersten acht.
  //   - Kategorien: Ein Hof mit mehr Produkten verlöre sonst die Kategorien
  //     seiner hinteren Ware — und wäre beim Filtern danach unauffindbar,
  //     obwohl er sie führt.
  //   - Produktfotos: Der Fotostreifen (#83) nahm bisher die ersten drei
  //     Bilder aus ALLEN Produkten; mit Deckel verlöre ein Hof, dessen
  //     vordere Produkte kein Bild haben, seinen Streifen.
  //   - Suchnamen: Die Produktsuche verspricht „was es gerade wirklich
  //     gibt“ — auf den gedeckelten Zeilen wäre ein Hof, der das Gesuchte
  //     erst ab Platz neun führt, ein falsches Negativ (dasselbe Loch, das
  //     bei den Kategorien bewusst gestopft wurde). Verfügbar heißt hier
  //     wie überall stock - reservedStock > 0 (VORSCHAU-VERFÜGBARKEIT oben).
  // Alles liefert EINE schmale Zeilen-Abfrage über alle Höfe (kein N+1) —
  // und keine zweite Einbindung derselben Relation, die Prisma im selben
  // select ohnehin verbietet.
  const angebotJeHof = new Map<string, AngebotsProdukt[]>()
  const produktFotosJeHof = new Map<string, string[]>()
  const jeBereich = new Map<string, Record<AnzeigeBereich, number>>()
  for (const zeile of schmaleZeilen) {
    const zaehler = jeBereich.get(zeile.farmId) ?? { LEBENSMITTEL: 0, FUTTERMITTEL: 0 }
    zaehler[anzeigeBereichVon(zeile.category)] += 1
    jeBereich.set(zeile.farmId, zaehler)
    // Kategorien, Suche, Facetten und Karte hängen an EINER Regel
    // (istKaufbar in baueAngebotsZeile). Vorher zählten die Chips jedes
    // sichtbare Produkt, die Suche nur solche mit freiem Bestand.
    const dto = zuProduktDto(zeile)
    const angebot = baueAngebotsZeile({
      ...dto,
      isAvailable: true, // die Abfrage liest nur sichtbare Produkte
      futter: zeile.futter ? { ...zeile.futter, nettoMenge: Number(zeile.futter.nettoMenge) } : null,
    })
    if (angebot) {
      const bisher = angebotJeHof.get(zeile.farmId) ?? []
      // Ausdrücklich gebaut, nie {...zeile}: In den Browser geht nur, was die
      // Produktzeile auf /hoefe zeigt (Bestand und Reservierung bleiben hier).
      bisher.push({
        ...angebot,
        id: zeile.id,
        price: dto.price,
        unit: zeile.unit,
        unitSize: dto.unitSize,
        imageUrl: zeile.imageUrl,
        bildAusschnitt: leseAusschnitt(zeile.bildAusschnitt),
      })
      angebotJeHof.set(zeile.farmId, bisher)
    }
    if (zeile.imageUrl) {
      const bisher = produktFotosJeHof.get(zeile.farmId) ?? []
      // Der Streifen zeigt höchstens drei Produktfotos — mehr zu sammeln
      // wäre Ballast (baueFotostreifen deckelt ohnehin bei fünf gesamt).
      if (bisher.length < 3) {
        bisher.push(zeile.imageUrl)
        produktFotosJeHof.set(zeile.farmId, bisher)
      }
    }
  }

  return hoefe.map((hof) => {
    const angebot = angebotJeHof.get(hof.id) ?? []
    const { kategorien, suchNamen } = fasseAngebotZusammen(angebot)
    // Ausdrücklich gebaut statt der rohen Zeilen: Wochentag, Beginn, Ende und
    // nur bei vollen Abholzeiten `ausgebuchtAm` — der Zwischenspeicher wächst sonst nicht.
    const abholfenster = hof.pickupSlots.map((s) => alsAbholFenster(s, ausgebucht.get(hof.id)))
    return {
      slug: hof.slug,
      name: hof.name,
      postalCode: hof.postalCode,
      city: hof.city,
      logoUrl: hof.logoUrl,
      logoAusschnitt: leseAusschnitt(hof.logoAusschnitt),
      latitude: hof.latitude,
      longitude: hof.longitude,
      isPaused: hof.isPaused,
      kategorien,
      angebot,
      produkte: hof.products.map((p) => ({
        id: p.id,
        name: p.name,
        ...zuProduktDto({ price: p.price, unitSize: p.unitSize }),
        unit: p.unit,
        imageUrl: p.imageUrl,
        bildAusschnitt: leseAusschnitt(p.bildAusschnitt),
        category: p.category,
        subcategory: p.subcategory,
        // „Verfügbar" heißt: Es ist noch etwas da, das nicht schon reserviert
        // ist. Siehe VORSCHAU-VERFÜGBARKEIT im Kopf dieser Datei.
        verfuegbar: p.stock - p.reservedStock > 0,
      })),
      produkteGesamt: hof._count.products,
      produkteJeBereich: jeBereich.get(hof.id) ?? { LEBENSMITTEL: 0, FUTTERMITTEL: 0 },
      suchNamen,
      naechsteAbholung: naechsteAbholung(abholfenster, jetzt),
      abholfenster,
      fotos: baueFotostreifen({
        bannerUrl: hof.bannerUrl,
        bannerType: hof.bannerType,
        galerie: hof.farmPhotos.map((f) => f.url),
        // Aus der schmalen Abfrage, NICHT aus den gedeckelten Vorschau-Zeilen:
        // sonst verlöre ein Hof, dessen vordere Produkte kein Bild haben,
        // seinen Fotostreifen (Verhalten unverändert gegenüber #83).
        produktFotos: produktFotosJeHof.get(hof.id) ?? [],
      }),
      gruendungshof: zeigtAbzeichen(hof),
      neuerBeitrag: alsNeuerBeitrag(hof.statusPosts?.[0]),
    }
  })
}

/**
 * ALLE öffentlich sichtbaren Höfe — Filter wie getPublicFarm oben
 * (isActive, archivedAt: null, approvedAt not null), dazu kein Testhof
 * (IN_LISTEN_SICHTBAR, Register N21): Was dort die Einzelseite sperrt, hält
 * den Hof auch aus der Übersicht. EINE Query mit Einbindungen,
 * kein N+1; die Kategorie- und Termin-Ableitung ist reine, getestete Logik
 * (src/lib/hofuebersicht.ts).
 */
export async function getOeffentlicheHoefe(
  jetzt: OrtsZeit = wienJetzt(),
  // Für den neuen Beitrag (Nr. 129): Die Frist von AKTIVER_BEITRAG gilt beim Lesen.
  zeitpunkt: Date = new Date()
): Promise<HofUebersichtEintrag[]> {
  // Läuft PARALLEL zur Hauptabfrage — sie hängt nicht von deren Ergebnis ab,
  // und /hoefe cacht das Ergebnis fünf Minuten (unstable_cache in der Seite):
  // Der Aufwand fällt höchstens alle fünf Minuten an, nicht je Besuch.
  const zeilenJeHof = prisma.product.findMany({
    where: { isAvailable: true, farm: IN_LISTEN_SICHTBAR },
    orderBy: PRODUCT_ORDER_BY,
    // name/stock/reservedStock speisen die PRODUKTSUCHE (suchNamen unten):
    // Sie muss ALLE verfügbaren Produkte eines Hofes kennen — die auf acht
    // gedeckelten Vorschau-Zeilen würden einen Hof, der das Gesuchte erst
    // ab Platz neun führt, als falsches Negativ verstecken. Der
    // Kategoriefilter hat genau dieses Loch bewusst nicht (siehe unten) —
    // die Suche bekommt dieselbe Vollständigkeit aus DERSELBEN Abfrage,
    // keine zweite Server-Runde.
    // Seit Bereiche 2 zusätzlich alles, was Facetten und Kilopreis brauchen:
    // Sorte, Siegel, Preis und aus der Kennzeichnung Tiere und Nettomenge.
    select: UEBERSICHT_ZEILEN_SELECT,
  })

  const hoefe = await prisma.farm.findMany({
    where: IN_LISTEN_SICHTBAR,
    // Freischalt-Reihenfolge, die ältesten zuerst — stabil und fair, ohne
    // eine Rangfrage zu eröffnen, die diese Fassung nicht beantworten will.
    orderBy: { approvedAt: 'asc' },
    select: { ...UEBERSICHT_HOF_SELECT, statusPosts: neuerBeitragEinbindung(zeitpunkt) },
  })
  // Volle Abholfenster nur der Höfe dieser Abfrage — die Zählung filtert die
  // Sichtbarkeit nicht selbst (Register N19, Ergänzung 21.10.2026; N21).
  const ausgebucht = await ausgebuchteTage(
    hoefe.map((h) => h.id),
    zeitpunkt
  )

  return baueHofUebersicht(hoefe, await zeilenJeHof, jetzt, ausgebucht)
}

/** Was der Kopf von „Mein Hof" zeigt (components/mein-hof/seitenkopf.tsx). */
export type MeinHofKopfDaten = {
  name: string
  slug: string
  /** Die öffentliche Adresse der Hofseite — zum Anzeigen ohne Protokoll, zum Öffnen und Kopieren vollständig. */
  adresse: { anzeige: string; url: string }
  logoUrl: string | null
  /** Ausschnitt des Logos (Register N17, Nr. 98) — schon geprüft; null = wie heute. */
  logoAusschnitt: BildAusschnitt | null
  /** Ein hochgeladenes Titelbild; null = Verlauf (bannerValue). */
  titelbildUrl: string | null
  bannerValue: string | null
  bannerFocusY: number
  zustand: HofZustand
}

/** Der Hof des angemeldeten Bauern für den Kopf — über ownerId, nie über eine ID aus der Anfrage. */
export async function getMeinHofKopf(ownerId: string): Promise<MeinHofKopfDaten | null> {
  const hof = await prisma.farm.findUnique({
    where: { ownerId },
    select: {
      name: true,
      slug: true,
      logoUrl: true,
      logoAusschnitt: true,
      bannerType: true,
      bannerUrl: true,
      bannerValue: true,
      bannerFocusY: true,
      isActive: true,
      isPaused: true,
      approvedAt: true,
      archivedAt: true,
    },
  })
  if (!hof) return null
  return {
    name: hof.name,
    slug: hof.slug,
    adresse: hofAdresse(APP_URL, hof.slug),
    logoUrl: hof.logoUrl,
    logoAusschnitt: leseAusschnitt(hof.logoAusschnitt),
    titelbildUrl: titelbildFoto(hof),
    bannerValue: hof.bannerValue,
    bannerFocusY: hof.bannerFocusY,
    zustand: hofZustand(hof),
  }
}

/**
 * Der Besitzer eines Hofs zu seinem Slug — nur die Kennung, für den
 * Vorschau-Zugriff der Hofseite (`ansichtsModus`, src/lib/ansichts-modus.ts). null, wenn es
 * den Hof nicht gibt; ob er freigegeben ist, spielt hier keine Rolle: Der
 * Besitzer darf seine Seite auch vorher sehen.
 */
export async function getHofBesitzer(slug: string): Promise<string | null> {
  const hof = await prisma.farm.findUnique({ where: { slug }, select: { ownerId: true } })
  return hof?.ownerId ?? null
}
