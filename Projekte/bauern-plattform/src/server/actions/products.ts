'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { productFormSchema, type ProductFormData } from '@/schemas/product'
import { getFarmForUser } from '@/server/queries/dashboard'

async function getAuthenticatedFarm() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Nicht eingeloggt')
  const farm = await getFarmForUser(session.user.id)
  if (!farm) throw new Error('Kein Hof gefunden')
  return farm
}

function revalidate(farmSlug: string) {
  revalidatePath('/products')
  revalidatePath(`/${farmSlug}`)
}

export async function createProduct(data: ProductFormData) {
  const farm = await getAuthenticatedFarm()
  const v = productFormSchema.parse(data)

  await prisma.product.create({
    data: {
      farmId: farm.id,
      name: v.name,
      description: v.description || null,
      imageUrl: v.imageUrl || null,
      price: v.price,
      vatRate: v.vatRate,
      unit: v.unit,
      unitSize: v.unitSize ?? null,
      stock: v.stock,
      isAvailable: v.isAvailable,
      allergens: v.allergens,
      isOrganic: v.isOrganic,
      requiresCool: v.requiresCool,
      requiresFreezer: v.requiresFreezer,
      seasonStart: v.seasonStart ?? null,
      seasonEnd: v.seasonEnd ?? null,
      unavailableReason: v.unavailableReason || null,
    },
  })

  revalidate(farm.slug)
}

export async function updateProduct(productId: string, data: ProductFormData) {
  const farm = await getAuthenticatedFarm()
  const v = productFormSchema.parse(data)

  const existing = await prisma.product.findFirst({
    where: { id: productId, farmId: farm.id },
  })
  if (!existing) throw new Error('Produkt nicht gefunden')

  await prisma.product.update({
    where: { id: productId },
    data: {
      name: v.name,
      description: v.description || null,
      imageUrl: v.imageUrl || null,
      price: v.price,
      vatRate: v.vatRate,
      unit: v.unit,
      unitSize: v.unitSize ?? null,
      stock: v.stock,
      isAvailable: v.isAvailable,
      allergens: v.allergens,
      isOrganic: v.isOrganic,
      requiresCool: v.requiresCool,
      requiresFreezer: v.requiresFreezer,
      seasonStart: v.seasonStart ?? null,
      seasonEnd: v.seasonEnd ?? null,
      unavailableReason: v.unavailableReason || null,
    },
  })

  revalidate(farm.slug)
}

export async function updateStock(productId: string, delta: number): Promise<number> {
  const farm = await getAuthenticatedFarm()

  const existing = await prisma.product.findFirst({
    where: { id: productId, farmId: farm.id },
  })
  if (!existing) throw new Error('Produkt nicht gefunden')

  const newStock = Math.max(0, existing.stock + delta)
  await prisma.product.update({
    where: { id: productId },
    data: { stock: newStock },
  })

  revalidate(farm.slug)
  return newStock
}

export async function setStock(productId: string, newStock: number): Promise<number> {
  const farm = await getAuthenticatedFarm()

  const existing = await prisma.product.findFirst({
    where: { id: productId, farmId: farm.id },
  })
  if (!existing) throw new Error('Produkt nicht gefunden')

  const clamped = Math.max(0, Math.round(newStock))
  await prisma.product.update({
    where: { id: productId },
    data: { stock: clamped },
  })

  revalidate(farm.slug)
  return clamped
}

export async function deleteProduct(productId: string) {
  const farm = await getAuthenticatedFarm()

  const existing = await prisma.product.findFirst({
    where: { id: productId, farmId: farm.id },
  })
  if (!existing) throw new Error('Produkt nicht gefunden')

  await prisma.product.delete({ where: { id: productId } })

  revalidate(farm.slug)
}
