'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { manualSaleFormSchema } from '@/schemas/manual-sale'
import { getFarmForUser } from '@/server/queries/dashboard'
import { verkaufOhneAngaben } from '@/lib/verkauf-eintragen'

type Antwort = { ok: true } | { error: string }

async function getAuthenticatedFarm() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Nicht eingeloggt')
  const farm = await getFarmForUser(session.user.id)
  if (!farm) throw new Error('Kein Hof gefunden')
  return farm
}

// 12:00 UTC des gewählten Tages: liegt in Wien sicher auf demselben Tag
// (13 bzw. 14 Uhr) — die Umsatzregel zählt manuelle Verkäufe nach ihrem
// Wiener Tag (src/lib/umsatz.ts). Früher 12:00 Serverzeit, was auf Vercel
// dasselbe ist.
function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

function revalidate() {
  revalidatePath('/sales')
  revalidatePath('/analytics')
  revalidatePath('/dashboard')
}

/**
 * Prüft die Eingabe und baut die Zeile. Ein gewähltes Produkt muss dem
 * eigenen Hof gehören — sonst hinge ein Verkauf an einem fremden Produkt und
 * tauchte in dessen Grenzwert-Zählung auf.
 */
async function verkaufsDaten(
  farmId: string,
  data: unknown
): Promise<{ error: string } | { daten: Omit<Prisma.ManualSaleUncheckedCreateInput, 'farmId'> }> {
  const geprueft = manualSaleFormSchema.safeParse(data)
  if (!geprueft.success) return { error: geprueft.error.issues[0]?.message ?? 'Bitte prüf deine Eingaben.' }
  const v = geprueft.data

  const produkt = v.productId
    ? await prisma.product.findFirst({
        where: { id: v.productId, farmId },
        select: { id: true, name: true, unit: true },
      })
    : null
  if (v.productId && !produkt) {
    return { error: 'Dieses Produkt gibt es auf deinem Hof nicht mehr. Wähl ein anderes oder „Anderes".' }
  }

  const { productName, quantity } = verkaufOhneAngaben({
    productName: v.productName || produkt?.name,
    quantity: v.quantity,
  })

  return {
    daten: {
      productId: produkt?.id ?? null,
      productName,
      quantity,
      unit: v.unit ?? produkt?.unit ?? null,
      // Zwei Nachkommastellen, wie die Spalte — ein getipptes 24,555 wird nicht still von der Datenbank gerundet.
      totalAmount: new Prisma.Decimal(v.totalAmount).toDecimalPlaces(2),
      channel: v.channel,
      saleDate: toDate(v.saleDate),
      note: v.note || null,
    },
  }
}

export async function createManualSale(data: unknown): Promise<Antwort> {
  const farm = await getAuthenticatedFarm()
  const ergebnis = await verkaufsDaten(farm.id, data)
  if ('error' in ergebnis) return { error: ergebnis.error }

  await prisma.manualSale.create({ data: { farmId: farm.id, ...ergebnis.daten } })

  revalidate()
  return { ok: true }
}

export async function updateManualSale(saleId: string, data: unknown): Promise<Antwort> {
  const farm = await getAuthenticatedFarm()
  const ergebnis = await verkaufsDaten(farm.id, data)
  if ('error' in ergebnis) return { error: ergebnis.error }

  // Besitz und Schreiben in einem: nur ein Verkauf des eigenen Hofs.
  const { count } = await prisma.manualSale.updateMany({
    where: { id: saleId, farmId: farm.id },
    data: ergebnis.daten,
  })
  if (count === 0) return { error: 'Diesen Verkauf gibt es nicht mehr. Lade die Seite neu.' }

  revalidate()
  return { ok: true }
}

export async function deleteManualSale(saleId: string) {
  const farm = await getAuthenticatedFarm()

  const existing = await prisma.manualSale.findFirst({
    where: { id: saleId, farmId: farm.id },
  })
  if (!existing) throw new Error('Verkauf nicht gefunden')

  await prisma.manualSale.delete({ where: { id: saleId } })

  revalidate()
}
