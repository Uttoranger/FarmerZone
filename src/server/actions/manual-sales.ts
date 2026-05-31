'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { manualSaleFormSchema, type ManualSaleFormData } from '@/schemas/manual-sale'
import { getFarmForUser } from '@/server/queries/dashboard'

async function getAuthenticatedFarm() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Nicht eingeloggt')
  const farm = await getFarmForUser(session.user.id)
  if (!farm) throw new Error('Kein Hof gefunden')
  return farm
}

function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

function revalidate() {
  revalidatePath('/sales')
  revalidatePath('/analytics')
  revalidatePath('/dashboard')
}

export async function createManualSale(data: ManualSaleFormData) {
  const farm = await getAuthenticatedFarm()
  const v = manualSaleFormSchema.parse(data)

  await prisma.manualSale.create({
    data: {
      farmId: farm.id,
      productId: v.productId || null,
      productName: v.productName,
      quantity: v.quantity,
      unit: (v.unit as 'STUECK' | 'KG' | 'G' | 'LITER' | 'ML' | 'M3' | 'PAKET') ?? null,
      totalAmount: v.totalAmount,
      channel: v.channel,
      saleDate: toDate(v.saleDate),
      note: v.note || null,
    },
  })

  revalidate()
}

export async function updateManualSale(saleId: string, data: ManualSaleFormData) {
  const farm = await getAuthenticatedFarm()
  const v = manualSaleFormSchema.parse(data)

  const existing = await prisma.manualSale.findFirst({
    where: { id: saleId, farmId: farm.id },
  })
  if (!existing) throw new Error('Verkauf nicht gefunden')

  await prisma.manualSale.update({
    where: { id: saleId },
    data: {
      productId: v.productId || null,
      productName: v.productName,
      quantity: v.quantity,
      unit: (v.unit as 'STUECK' | 'KG' | 'G' | 'LITER' | 'ML' | 'M3' | 'PAKET') ?? null,
      totalAmount: v.totalAmount,
      channel: v.channel,
      saleDate: toDate(v.saleDate),
      note: v.note || null,
    },
  })

  revalidate()
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
