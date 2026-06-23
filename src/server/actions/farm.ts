'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getAuthFarm() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return prisma.farm.findUnique({ where: { ownerId: session.user.id } })
}

// ─── Profile ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben'),
  ownerName: z.string().min(2, 'Name muss mindestens 2 Zeichen haben'),
  description: z.string().min(10, 'Beschreibung muss mindestens 10 Zeichen haben'),
  address: z.string().min(3),
  postalCode: z.string().min(4),
  city: z.string().min(2),
  phone: z.string().min(4),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  logoUrl: z.string().url().optional().or(z.literal('')),
  bannerUrl: z.string().url().optional().or(z.literal('')),
})

export type ProfileFormData = z.infer<typeof profileSchema>
export type ProfileResult = { error?: string }

export async function updateProfile(data: ProfileFormData): Promise<ProfileResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const parsed = profileSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Daten' }

  const { logoUrl, bannerUrl, ...rest } = parsed.data

  await prisma.farm.update({
    where: { id: farm.id },
    data: {
      ...rest,
      logoUrl: logoUrl || null,
      bannerUrl: bannerUrl || null,
    },
  })

  revalidatePath('/settings/profile')
  revalidatePath(`/${farm.slug}`)
  return {}
}

// ─── Pickup Slots ────────────────────────────────────────────────────────────

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  maxOrders: z.number().int().positive().optional().nullable(),
})

export type SlotFormData = z.infer<typeof slotSchema>
export type SlotResult = { error?: string }

export async function addPickupSlot(data: SlotFormData): Promise<SlotResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const parsed = slotSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Daten' }

  await prisma.pickupSlot.create({
    data: { farmId: farm.id, ...parsed.data },
  })

  revalidatePath('/settings/pickup-slots')
  revalidatePath(`/${farm.slug}`)
  return {}
}

export async function deletePickupSlot(slotId: string): Promise<SlotResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  await prisma.pickupSlot.deleteMany({
    where: { id: slotId, farmId: farm.id },
  })

  revalidatePath('/settings/pickup-slots')
  revalidatePath(`/${farm.slug}`)
  return {}
}

export async function togglePickupSlotActive(slotId: string, isActive: boolean): Promise<SlotResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  await prisma.pickupSlot.updateMany({
    where: { id: slotId, farmId: farm.id },
    data: { isActive },
  })

  revalidatePath('/settings/pickup-slots')
  revalidatePath(`/${farm.slug}`)
  return {}
}

// ─── Pause ───────────────────────────────────────────────────────────────────

export type PauseResult = { error?: string }

export async function setPause(isPaused: boolean, pauseMessage: string): Promise<PauseResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  await prisma.farm.update({
    where: { id: farm.id },
    data: {
      isPaused,
      pauseMessage: isPaused ? (pauseMessage.trim() || null) : null,
    },
  })

  revalidatePath('/settings/pause')
  revalidatePath(`/${farm.slug}`)
  return {}
}
