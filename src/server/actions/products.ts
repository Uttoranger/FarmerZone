'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  productAnlegenSchema,
  productFormSchema,
  kategorieSetzenSchema,
  type FutterKennzeichnungFormData,
  type ProductFormData,
} from '@/schemas/product'
import { bereinigeSiegel, istFuttermittel } from '@/lib/taxonomie'
import { mwstStandard } from '@/lib/mwst'
import { dualUseHinweis, normiereProduktname, DUAL_USE_MIN_ZEICHEN } from '@/lib/dual-use'
import { dualUseAnfrageSchema } from '@/schemas/product'
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
    abgabe: v.abgabe,
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

/** Eine Kennzeichnung, die das Schema durchgelassen hat — dort ist die Futtermittelart gesetzt. */
type GepruefteKennzeichnung = FutterKennzeichnungFormData & {
  futtermittelart: NonNullable<FutterKennzeichnungFormData['futtermittelart']>
}

/**
 * Die Kennzeichnungsspalten. Der Haken „entspricht dem Sackanhänger" wird
 * bei JEDEM Speichern neu gesetzt (bestaetigtAm = jetzt): Wer die Kennzeichnung
 * ändert, bestätigt sie neu — das Formular verlangt den Haken ohnehin.
 *
 * registrierungsnummer wird bewusst NICHT geschrieben (Rückfrage F6): Die
 * Nummer gehört dem Hof. Beim Update bleibt ein Altbestand so unangetastet —
 * er dient nur noch als Rückfall zum Lesen.
 */
function futterDaten(f: GepruefteKennzeichnung, jetzt: Date) {
  return {
    futtermittelart: f.futtermittelart,
    zielTierarten: f.zielTierarten,
    zusammensetzung: f.zusammensetzung,
    analytischeBestandteile: f.analytischeBestandteile,
    nettoMenge: f.nettoMenge,
    nettoEinheit: f.nettoEinheit,
    rohprotein: f.rohprotein,
    rohfaser: f.rohfaser,
    rohfett: f.rohfett,
    rohasche: f.rohasche,
    zusatzstoffe: f.zusatzstoffe || null,
    gebrauchshinweis: f.gebrauchshinweis || null,
    bestaetigtAm: jetzt,
  }
}

/**
 * Das Schema hat schon entschieden: futter gibt es genau dann, wenn der
 * Bereich Futtermittel ist, und dann mit einer passenden Futtermittelart.
 */
function futterAus(v: ProductFormData): GepruefteKennzeichnung | null {
  if (!istFuttermittel(v.category) || !v.futter) return null
  const { futtermittelart } = v.futter
  if (futtermittelart === null) return null
  return { ...v.futter, futtermittelart }
}

export async function createProduct(data: ProductFormData): Promise<ProduktErgebnis> {
  const farm = await getAuthenticatedFarm()
  // Anlegen ist strenger als Bearbeiten: Kategorie Pflicht, Futter ohne Gebindegröße.
  const geprueft = productAnlegenSchema.safeParse(data)
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
 * Speichert das Produkt und hält die Futter-Kennzeichnung konsistent: im
 * Bereich Futtermittel wird sie angelegt oder aktualisiert, bei jeder anderen
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

/**
 * Kategorie eines Bestandsprodukts ohne Kategorie setzen — der Chip
 * „… übernehmen" in der Produktliste. Bewusst NICHT über updateProduct: Das
 * schriebe das ganze Produkt aus den Listendaten zurück, samt einem Bestand,
 * den eine Bestellung inzwischen gesenkt haben kann.
 *
 * Schreibt nur, solange die Kategorie noch leer ist (Bedingung in der
 * WHERE-Klausel, zusammen mit dem Besitz) — ein zweiter Tipp oder eine
 * inzwischen gewählte Kategorie wird nie überschrieben. Futtermittel sind
 * ausgeschlossen (Schema): Sie brauchen eine Kennzeichnung, die nur der
 * Dialog erfasst.
 */
export async function setzeKategorie(input: unknown): Promise<ProduktErgebnis> {
  const geprueft = kategorieSetzenSchema.safeParse(input)
  if (!geprueft.success) return { error: 'Diese Kategorie passt nicht. Bitte wähle sie im Produkt selbst.' }
  const { productId, category, subcategory } = geprueft.data

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  // MwSt wie im Formular: Stand noch der Vorschlag für „ohne Kategorie", gilt
  // jetzt der der neuen Kategorie. Einen selbst gesetzten Satz fasst das nicht an.
  const basis = { id: productId, farmId: farm.id, category: null }
  const mitMwst = await prisma.product.updateMany({
    where: { ...basis, vatRate: mwstStandard(null) },
    data: { category, subcategory, vatRate: mwstStandard(category) },
  })
  if (mitMwst.count === 0) {
    const ohneMwst = await prisma.product.updateMany({ where: basis, data: { category, subcategory } })
    if (ohneMwst.count === 0) return { error: 'Das Produkt hat schon eine Kategorie. Lade die Seite neu.' }
  }

  revalidate(farm.slug)
  return { ok: true }
}

export type DualUseErgebnis = { hinweis: string | null } | { error: string }

/**
 * Dual-Use-Hinweis beim Tippen des Namens (Konzept 6.1): Gibt es im EIGENEN
 * Hof schon ein Produkt gleichen Namens in einem anderen Bereich? Nur lesend.
 * Das Formular ruft das verzögert auf, nicht je Tastendruck. Der Hof steht in
 * der WHERE-Klausel — fremde Höfe sieht diese Abfrage nie.
 */
export async function pruefeDualUse(eingabe: unknown): Promise<DualUseErgebnis> {
  const geprueft = dualUseAnfrageSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: 'Ungültige Eingabe.' }
  const { name, category, productId } = geprueft.data

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  if (category == null || normiereProduktname(name).length < DUAL_USE_MIN_ZEICHEN) return { hinweis: null }

  const vorhandene = await prisma.product.findMany({
    where: {
      farmId: farm.id,
      name: { equals: name.trim(), mode: 'insensitive' },
      // Beim Bearbeiten ist das Produkt selbst kein Zwilling.
      ...(productId ? { id: { not: productId } } : {}),
    },
    select: { name: true, category: true },
    take: 5,
  })

  return { hinweis: dualUseHinweis({ name, category }, vorhandene) }
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
