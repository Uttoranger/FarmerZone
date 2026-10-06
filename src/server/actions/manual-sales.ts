'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { manualSaleFormSchema, verkaufIdSchema } from '@/schemas/manual-sale'
import { getFarmForUser } from '@/server/queries/dashboard'
import { verkaufOhneAngaben } from '@/lib/verkauf-eintragen'
import { wienKalendertag } from '@/lib/kalender'

/*
 * Direktverkäufe (Verkauf eintragen, ändern, löschen). Ein Direktverkauf ist
 * nur Umsatz: Er bucht keinen Bestand ab und keinen zurück — auch nicht mit
 * verknüpftem Produkt. Ändern und Löschen brauchen deshalb keine Gegenbuchung.
 */

export type VerkaufAntwort = { ok: true } | { error: string }

const NICHT_ANGEMELDET = 'Bitte melde dich neu an.'
const NICHT_MEHR_DA = 'Diesen Verkauf gibt es nicht mehr. Lade die Seite neu.'

/** Der Hof der Sitzung — oder null, dann antwortet die Action mit einem Satz statt abzustürzen. */
async function eigenerHof(): Promise<{ id: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return getFarmForUser(session.user.id)
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

  // Das Feld lässt keinen künftigen Tag zu — der Server prüft trotzdem
  // (Wiener Tag, Textvergleich JJJJ-MM-TT): Ein Verkauf von morgen zählte
  // heute noch nirgends und morgen plötzlich doppelt im Kopf des Hofs.
  if (v.saleDate > wienKalendertag(new Date())) {
    return { error: 'Ein Verkauf in der Zukunft geht nicht. Wähl heute oder einen Tag davor.' }
  }

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

export async function createManualSale(data: unknown): Promise<VerkaufAntwort> {
  const farm = await eigenerHof()
  if (!farm) return { error: NICHT_ANGEMELDET }
  const ergebnis = await verkaufsDaten(farm.id, data)
  if ('error' in ergebnis) return { error: ergebnis.error }

  await prisma.manualSale.create({ data: { farmId: farm.id, ...ergebnis.daten } })

  revalidate()
  return { ok: true }
}

export async function updateManualSale(saleId: unknown, data: unknown): Promise<VerkaufAntwort> {
  const id = verkaufIdSchema.safeParse(saleId)
  if (!id.success) return { error: NICHT_MEHR_DA }
  const farm = await eigenerHof()
  if (!farm) return { error: NICHT_ANGEMELDET }
  const ergebnis = await verkaufsDaten(farm.id, data)
  if ('error' in ergebnis) return { error: ergebnis.error }

  // Besitz und Schreiben in einem: nur ein Verkauf des eigenen Hofs.
  const { count } = await prisma.manualSale.updateMany({
    where: { id: id.data, farmId: farm.id },
    data: ergebnis.daten,
  })
  if (count === 0) return { error: NICHT_MEHR_DA }

  revalidate()
  return { ok: true }
}

export async function deleteManualSale(saleId: unknown): Promise<VerkaufAntwort> {
  const id = verkaufIdSchema.safeParse(saleId)
  if (!id.success) return { error: NICHT_MEHR_DA }
  const farm = await eigenerHof()
  if (!farm) return { error: NICHT_ANGEMELDET }

  // Besitz in der WHERE-Klausel statt Lesen-dann-Löschen: zwischen Prüfung
  // und Schreiben bleibt keine Lücke, und ein fremder Verkauf ist schlicht 0.
  const { count } = await prisma.manualSale.deleteMany({ where: { id: id.data, farmId: farm.id } })
  if (count === 0) return { error: NICHT_MEHR_DA }

  revalidate()
  return { ok: true }
}
