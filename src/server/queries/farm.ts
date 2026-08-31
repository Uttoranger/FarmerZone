import { prisma } from '@/lib/prisma'
import { categoryImagePath } from '@/lib/product-image'
import { DEFAULT_SECTIONS, type SectionConfig } from './appearance'
import { PRODUCT_ORDER_BY } from './products'
import type { ProductCategory } from '@prisma/client'
import { PRODUCT_CATEGORY_VALUES } from '@/schemas/product'
import {
  baueFotostreifen,
  naechsteAbholung,
  sammleKategorien,
  wienJetzt,
  type NaechsteAbholung,
  type OrtsZeit,
  type VorschauProdukt,
} from '@/lib/hofuebersicht'

export type PublicProduct = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
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
}

export type PublicPickupSlot = {
  dayOfWeek: number
  startTime: string
  endTime: string
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
  phone: string
  email: string
  logoUrl: string | null
  bannerUrl: string | null
  // Presentation fields
  tagline: string | null
  foundedYear: number | null
  aboutText: string | null
  bannerType: 'GRADIENT' | 'PHOTO'
  bannerValue: string | null
  bannerFocusY: number
  sectionsConfig: SectionConfig[]
  farmValues: PublicFarmValue[]
  farmPhotos: PublicFarmPhoto[]
  acceptsOnline: boolean
  acceptsOnsite: boolean
  stripeAccountReady: boolean
  isPaused: boolean
  pauseMessage: string | null
  products: PublicProduct[]
  pickupSlots: PublicPickupSlot[]
}

const FARM_PHOTO_SELECT = {
  orderBy: { sortOrder: 'asc' as const },
  select: { id: true, url: true, caption: true, sortOrder: true },
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

export async function getPublicFarm(slug: string): Promise<PublicFarm | null> {
  // Die Filterung sitzt bewusst hier in der Query und nicht in den Seiten:
  // jede öffentliche Unterseite, die über getPublicFarm lädt, ist damit
  // automatisch mitgesperrt und läuft in ihren bestehenden notFound-Pfad.
  const farm = await prisma.farm.findUnique({
    where: { slug, ...OEFFENTLICH_SICHTBAR },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerName: true,
      description: true,
      address: true,
      postalCode: true,
      city: true,
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
      sectionsConfig: true,
      acceptsOnline: true,
      acceptsOnsite: true,
      stripeAccountReady: true,
      isPaused: true,
      pauseMessage: true,
      farmValues: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, icon: true, title: true, subtitle: true },
      },
      farmPhotos: FARM_PHOTO_SELECT,
      products: {
        orderBy: PRODUCT_ORDER_BY,
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          category: true,
          price: true,
          unit: true,
          unitSize: true,
          stock: true,
          isAvailable: true,
          allergens: true,
          isOrganic: true,
          requiresCool: true,
          requiresFreezer: true,
          seasonStart: true,
          seasonEnd: true,
          unavailableReason: true,
        },
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

  return {
    ...farm,
    bannerType: farm.bannerType as 'GRADIENT' | 'PHOTO',
    sectionsConfig: sections,
    farmPhotos: farm.farmPhotos,
    products: farm.products.map((p) => ({
      ...p,
      price: Number(p.price),
      unitSize: p.unitSize ? Number(p.unitSize) : null,
      categoryImageUrl: categoryImagePath(p.category),
    })),
  }
}

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
      sectionsConfig: true,
      acceptsOnline: true,
      acceptsOnsite: true,
      stripeAccountReady: true,
      isPaused: true,
      pauseMessage: true,
      farmValues: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, icon: true, title: true, subtitle: true },
      },
      farmPhotos: FARM_PHOTO_SELECT,
      products: {
        orderBy: PRODUCT_ORDER_BY,
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          category: true,
          price: true,
          unit: true,
          unitSize: true,
          stock: true,
          isAvailable: true,
          allergens: true,
          isOrganic: true,
          requiresCool: true,
          requiresFreezer: true,
          seasonStart: true,
          seasonEnd: true,
          unavailableReason: true,
        },
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

  return {
    ...farm,
    bannerType: farm.bannerType as 'GRADIENT' | 'PHOTO',
    sectionsConfig: sections,
    farmPhotos: farm.farmPhotos,
    products: farm.products.map((p) => ({
      ...p,
      price: Number(p.price),
      unitSize: p.unitSize ? Number(p.unitSize) : null,
      categoryImageUrl: categoryImagePath(p.category),
    })),
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
      latitude: true,
      longitude: true,
      phone: true,
      email: true,
      logoUrl: true,
      bannerUrl: true,
      isPaused: true,
      pauseMessage: true,
      slug: true,
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
): Promise<{ id: string; name: string; slug: string; archivedAt: Date | null; approvedAt: Date | null } | null> {
  return prisma.farm.findUnique({
    where: { ownerId },
    select: { id: true, name: true, slug: true, archivedAt: true, approvedAt: true },
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
  latitude: number | null
  longitude: number | null
  isPaused: boolean
  /** Distinct-Kategorien der VERFÜGBAREN Produkte, in Schema-Reihenfolge. */
  kategorien: ProductCategory[]
  /** Der nächste anstehende Abholtermin — null ohne aktive Fenster. */
  naechsteAbholung: NaechsteAbholung | null
  /** Die Produktvorschau der Karte: höchstens VORSCHAU_LADE_DECKEL Zeilen,
   *  in der Reihenfolge der Hofseite. Die Auswahl daraus trifft
   *  waehleVorschauProdukte (src/lib/hofuebersicht.ts). */
  produkte: VorschauProdukt[]
  /** ALLE verfügbar geschalteten Produkte des Hofes — Grundlage für
   *  „+ n weitere", auch wenn oben gedeckelt wurde. */
  produkteGesamt: number
  /** Die Namen ALLER verfügbaren Produkte (Bestand abzüglich Reservierung
   *  über null), UNGEDECKELT — die Grundlage der Produktsuche: Auf den acht
   *  Vorschau-Zeilen wäre ein Hof mit dem Gesuchten ab Platz neun ein
   *  falsches Negativ. Aus der schmalen Zeilen-Abfrage, wie die Kategorien. */
  suchNamen: string[]
  /** Der Fotostreifen: nur URLs, Titelbild zuerst, höchstens fünf
   *  (baueFotostreifen in src/lib/hofuebersicht.ts). Leer = keine Fotos,
   *  die Karte bleibt kompakt. */
  fotos: string[]
}

/**
 * ALLE öffentlich sichtbaren Höfe — Filter EXAKT wie getPublicFarm oben
 * (isActive, archivedAt: null, approvedAt not null): Was dort die Einzelseite
 * sperrt, hält den Hof auch aus der Übersicht. EINE Query mit Einbindungen,
 * kein N+1; die Kategorie- und Termin-Ableitung ist reine, getestete Logik
 * (src/lib/hofuebersicht.ts).
 */
export async function getOeffentlicheHoefe(
  jetzt: OrtsZeit = wienJetzt()
): Promise<HofUebersichtEintrag[]> {
  // Läuft PARALLEL zur Hauptabfrage — sie hängt nicht von deren Ergebnis ab,
  // und /hoefe ist statisch mit kurzer Revalidierung: Der Aufwand fällt
  // höchstens alle fünf Minuten an, nicht je Besuch.
  const zeilenJeHof = prisma.product.findMany({
    where: { isAvailable: true, farm: OEFFENTLICH_SICHTBAR },
    orderBy: PRODUCT_ORDER_BY,
    // name/stock/reservedStock speisen die PRODUKTSUCHE (suchNamen unten):
    // Sie muss ALLE verfügbaren Produkte eines Hofes kennen — die auf acht
    // gedeckelten Vorschau-Zeilen würden einen Hof, der das Gesuchte erst
    // ab Platz neun führt, als falsches Negativ verstecken. Der
    // Kategoriefilter hat genau dieses Loch bewusst nicht (siehe unten) —
    // die Suche bekommt dieselbe Vollständigkeit aus DERSELBEN Abfrage,
    // keine zweite Server-Runde.
    select: {
      farmId: true,
      category: true,
      imageUrl: true,
      name: true,
      stock: true,
      reservedStock: true,
    },
  })

  const hoefe = await prisma.farm.findMany({
    where: OEFFENTLICH_SICHTBAR,
    // Freischalt-Reihenfolge, die ältesten zuerst — stabil und fair, ohne
    // eine Rangfrage zu eröffnen, die diese Fassung nicht beantworten will.
    orderBy: { approvedAt: 'asc' },
    select: {
      // id/approvedAt/createdAt werden (noch) NICHT angezeigt: Zusammen mit
      // archivedAt (hier durch den Filter konstant null) sind sie die
      // Eingabe von gruendungsplaetze() (src/lib/gruendungshof.ts,
      // HofFuerPlatz) — die spätere Gründungshof-Kennzeichnung braucht damit
      // KEINEN Query-Umbau, nur eine Anzeige.
      id: true,
      approvedAt: true,
      createdAt: true,
      slug: true,
      name: true,
      postalCode: true,
      city: true,
      logoUrl: true,
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
          imageUrl: true,
        },
      },
      // Die Gesamtzahl der verfügbar geschalteten Produkte — die Zeile
      // „+ n weitere" muss auch dann stimmen, wenn oben gedeckelt wurde.
      _count: { select: { products: { where: { isAvailable: true } } } },
      pickupSlots: {
        where: { isActive: true },
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
  })

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
  const schmaleZeilen = await zeilenJeHof
  const kategorienJeHof = new Map<string, ProductCategory[]>()
  const produktFotosJeHof = new Map<string, string[]>()
  const suchNamenJeHof = new Map<string, string[]>()
  for (const zeile of schmaleZeilen) {
    if (zeile.category) {
      const bisher = kategorienJeHof.get(zeile.farmId) ?? []
      bisher.push(zeile.category)
      kategorienJeHof.set(zeile.farmId, bisher)
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
    if (zeile.stock - zeile.reservedStock > 0) {
      const bisher = suchNamenJeHof.get(zeile.farmId) ?? []
      bisher.push(zeile.name)
      suchNamenJeHof.set(zeile.farmId, bisher)
    }
  }

  return hoefe.map((hof) => ({
    slug: hof.slug,
    name: hof.name,
    postalCode: hof.postalCode,
    city: hof.city,
    logoUrl: hof.logoUrl,
    latitude: hof.latitude,
    longitude: hof.longitude,
    isPaused: hof.isPaused,
    kategorien: sammleKategorien(
      (kategorienJeHof.get(hof.id) ?? []).map((category) => ({ category })),
      PRODUCT_CATEGORY_VALUES
    ),
    produkte: hof.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      unit: p.unit,
      unitSize: p.unitSize === null ? null : Number(p.unitSize),
      imageUrl: p.imageUrl,
      category: p.category,
      // „Verfügbar" heißt: Es ist noch etwas da, das nicht schon reserviert
      // ist. Siehe VORSCHAU-VERFÜGBARKEIT im Kopf dieser Datei.
      verfuegbar: p.stock - p.reservedStock > 0,
    })),
    produkteGesamt: hof._count.products,
    suchNamen: suchNamenJeHof.get(hof.id) ?? [],
    naechsteAbholung: naechsteAbholung(hof.pickupSlots, jetzt),
    fotos: baueFotostreifen({
      bannerUrl: hof.bannerUrl,
      bannerType: hof.bannerType,
      galerie: hof.farmPhotos.map((f) => f.url),
      // Aus der schmalen Abfrage, NICHT aus den gedeckelten Vorschau-Zeilen:
      // sonst verlöre ein Hof, dessen vordere Produkte kein Bild haben,
      // seinen Fotostreifen (Verhalten unverändert gegenüber #83).
      produktFotos: produktFotosJeHof.get(hof.id) ?? [],
    }),
  }))
}
