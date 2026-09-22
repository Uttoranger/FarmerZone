'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  productFormSchema,
  type FutterKennzeichnungFormData,
  type ProductFormData,
} from '@/schemas/product'
import { bereinigeSiegel } from '@/lib/taxonomie'
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

export type ProduktErgebnis = { ok: true } | { error: string }

/** Die Produktspalten aus dem geprüften Formular — für create und update dieselben. */
function produktDaten(v: ProductFormData) {
  return {
    name: v.name,
    description: v.description || null,
    imageUrl: v.imageUrl || null,
    category: v.category ?? null,
    subcategory: v.subcategory ?? null,
    labels: bereinigeSiegel(v.labels),
    countsTowardLimit: v.countsTowardLimit,
    price: v.price,
    vatRate: v.vatRate,
    unit: v.unit,
    unitSize: v.unitSize ?? null,
    stock: v.stock,
    isAvailable: v.isAvailable,
    allergens: v.allergens,
    // isOrganic wird bewusst NICHT mehr geschrieben — Bio lebt in labels.
    requiresCool: v.requiresCool,
    requiresFreezer: v.requiresFreezer,
    seasonStart: v.seasonStart ?? null,
    seasonEnd: v.seasonEnd ?? null,
    unavailableReason: v.unavailableReason || null,
  }
}

/**
 * Die Kennzeichnungsspalten. Der Haken „entspricht dem Sackanhänger" wird
 * bei JEDEM Speichern neu gesetzt (bestaetigtAm = jetzt): Wer die Kennzeichnung
 * ändert, bestätigt sie neu — das Formular verlangt den Haken ohnehin.
 */
function futterDaten(f: FutterKennzeichnungFormData, jetzt: Date) {
  return {
    zielTierarten: f.zielTierarten,
    zusammensetzung: f.zusammensetzung,
    analytischeBestandteile: f.analytischeBestandteile,
    zusatzstoffe: f.zusatzstoffe || null,
    registrierungsnummer: f.registrierungsnummer || null,
    gebrauchshinweis: f.gebrauchshinweis || null,
    bestaetigtAm: jetzt,
  }
}

/** Das Schema hat schon entschieden: futter gibt es genau dann, wenn FUTTERMITTEL. */
function futterAus(v: ProductFormData): FutterKennzeichnungFormData | null {
  return v.category === 'FUTTERMITTEL' && v.futter ? v.futter : null
}

export async function createProduct(data: ProductFormData): Promise<ProduktErgebnis> {
  const farm = await getAuthenticatedFarm()
  const geprueft = productFormSchema.safeParse(data)
  if (!geprueft.success) return { error: 'Bitte prüfe deine Eingaben.' }
  const v = geprueft.data
  const futter = futterAus(v)

  await prisma.product.create({
    data: {
      farmId: farm.id,
      ...produktDaten(v),
      ...(futter ? { futter: { create: futterDaten(futter, new Date()) } } : {}),
    },
  })

  revalidate(farm.slug)
  return { ok: true }
}

/**
 * Speichert das Produkt und hält die Futter-Kennzeichnung konsistent: bei
 * FUTTERMITTEL wird sie angelegt oder aktualisiert, bei jeder anderen
 * Kategorie GELÖSCHT — auch dann, wenn das Produkt vorher ein Futtermittel
 * war (Kategoriewechsel; das Formular fragt vorher nach). Beides in EINER
 * Transaktion, damit nie ein Produkt ohne Kategorie Futtermittel eine
 * Kennzeichnung behält. Der Besitz steht in der WHERE-Klausel des Updates.
 */
export async function updateProduct(productId: string, data: ProductFormData): Promise<ProduktErgebnis> {
  const farm = await getAuthenticatedFarm()
  const geprueft = productFormSchema.safeParse(data)
  if (!geprueft.success) return { error: 'Bitte prüfe deine Eingaben.' }
  const v = geprueft.data
  const futter = futterAus(v)

  const ergebnis = await prisma.$transaction(async (tx) => {
    const { count } = await tx.product.updateMany({
      where: { id: productId, farmId: farm.id },
      data: produktDaten(v),
    })
    if (count === 0) return 'nicht-gefunden' as const

    if (futter) {
      const daten = futterDaten(futter, new Date())
      await tx.futterKennzeichnung.upsert({
        where: { productId },
        create: { productId, ...daten },
        update: daten,
      })
    } else {
      // deleteMany statt delete: wirft nicht, wenn es nie eine Kennzeichnung gab.
      await tx.futterKennzeichnung.deleteMany({ where: { productId } })
    }
    return 'ok' as const
  })

  if (ergebnis === 'nicht-gefunden') return { error: 'Produkt nicht gefunden.' }

  revalidate(farm.slug)
  return { ok: true }
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
