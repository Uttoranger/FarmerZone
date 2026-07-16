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
  revalidatePath('/farm-page')
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
      category: v.category ?? null,
      countsTowardLimit: v.countsTowardLimit,
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
      category: v.category ?? null,
      countsTowardLimit: v.countsTowardLimit,
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

export async function updateProductImageAction(
  productId: string,
  imageUrl: string | null,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden' }

  const existing = await prisma.product.findFirst({ where: { id: productId, farmId: farm.id } })
  if (!existing) return { error: 'Produkt nicht gefunden' }

  await prisma.product.update({ where: { id: productId }, data: { imageUrl } })

  revalidate(farm.slug)
  return {}
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

// Sprint 18: manuelle Reihenfolge per Drag & Drop.
// ids muss GENAU die Produktmenge der eigenen Farm sein (Permutation) —
// fremde, fehlende oder doppelte IDs → Fehler ohne Teiländerung (Transaktion).
export async function reorderProductsAction(ids: string[]): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht eingeloggt' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden' }

  const own = await prisma.product.findMany({
    where: { farmId: farm.id },
    select: { id: true },
  })
  const ownIds = new Set(own.map((p) => p.id))
  const uniqueIds = new Set(ids)

  if (
    ids.length !== uniqueIds.size ||
    ids.length !== ownIds.size ||
    ids.some((id) => !ownIds.has(id))
  ) {
    return { error: 'Ungültige Produktliste' }
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.product.update({ where: { id }, data: { sortOrder: index } })
    )
  )

  revalidate(farm.slug)
  return {}
}
