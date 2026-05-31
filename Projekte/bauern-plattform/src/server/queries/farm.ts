import { prisma } from '@/lib/prisma'

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
  acceptsOnline: boolean
  acceptsOnsite: boolean
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
      acceptsOnline: true,
      acceptsOnsite: true,
      isPaused: true,
      pauseMessage: true,
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

  return {
    ...farm,
    products: farm.products.map((p) => ({
      ...p,
      price: Number(p.price),
      unitSize: p.unitSize ? Number(p.unitSize) : null,
    })),
  }
}
