import { prisma } from '@/lib/prisma'
import { DEFAULT_SECTIONS, type SectionConfig } from './appearance'

export type PublicProduct = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
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
  sectionsConfig: SectionConfig[]
  farmValues: PublicFarmValue[]
  acceptsOnline: boolean
  acceptsOnsite: boolean
  stripeAccountReady: boolean
  isPaused: boolean
  pauseMessage: string | null
  products: PublicProduct[]
  pickupSlots: PublicPickupSlot[]
}

export async function getPublicFarm(slug: string): Promise<PublicFarm | null> {
  const farm = await prisma.farm.findUnique({
    where: { slug, isActive: true },
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
      products: {
        orderBy: [{ isAvailable: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
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
    products: farm.products.map((p) => ({
      ...p,
      price: Number(p.price),
      unitSize: p.unitSize ? Number(p.unitSize) : null,
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
      products: {
        orderBy: [{ isAvailable: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
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
    products: farm.products.map((p) => ({
      ...p,
      price: Number(p.price),
      unitSize: p.unitSize ? Number(p.unitSize) : null,
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
