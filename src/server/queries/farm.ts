import { prisma } from '@/lib/prisma'
import { categoryImagePath } from '@/lib/product-image'
import { DEFAULT_SECTIONS, type SectionConfig } from './appearance'
import { PRODUCT_ORDER_BY } from './products'
import type { ProductCategory } from '@prisma/client'
import { PRODUCT_CATEGORY_VALUES } from '@/schemas/product'
import {
  naechsteAbholung,
  sammleKategorien,
  wienJetzt,
  type NaechsteAbholung,
  type OrtsZeit,
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
      products: {
        where: { isAvailable: true, category: { not: null } },
        select: { category: true },
      },
      pickupSlots: {
        where: { isActive: true },
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
  })

  return hoefe.map((hof) => ({
    slug: hof.slug,
    name: hof.name,
    postalCode: hof.postalCode,
    city: hof.city,
    logoUrl: hof.logoUrl,
    latitude: hof.latitude,
    longitude: hof.longitude,
    isPaused: hof.isPaused,
    kategorien: sammleKategorien(hof.products, PRODUCT_CATEGORY_VALUES),
    naechsteAbholung: naechsteAbholung(hof.pickupSlots, jetzt),
  }))
}
