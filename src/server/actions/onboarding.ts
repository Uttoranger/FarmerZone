'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findBatchSlotError } from '@/lib/pickup-slot-rules'
import { ProductUnit } from '@prisma/client'
import { generateSlug, RESERVED_SLUGS } from '@/lib/slug'

export async function checkSlugAvailability(name: string): Promise<{ available: boolean; slug: string }> {
  const slug = generateSlug(name)
  if (RESERVED_SLUGS.has(slug)) return { available: false, slug }
  const existing = await prisma.farm.findUnique({ where: { slug }, select: { id: true } })
  return { available: !existing, slug }
}

export async function createFarm(data: {
  name: string
  ownerName: string
  description: string
  address: string
  postalCode: string
  city: string
  phone: string
  email: string
}): Promise<{ farmId: string; farmSlug: string } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet.' }

  const existingFarm = await prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, slug: true },
  })
  if (existingFarm) return { farmId: existingFarm.id, farmSlug: existingFarm.slug }

  const baseSlug = generateSlug(data.name)
  let slug = baseSlug
  let suffix = 2
  while (RESERVED_SLUGS.has(slug) || await prisma.farm.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix++}`
  }

  try {
    const farm = await prisma.farm.create({
      data: {
        slug,
        name: data.name.trim(),
        ownerName: data.ownerName.trim(),
        description: data.description.trim(),
        address: data.address.trim(),
        postalCode: data.postalCode.trim(),
        city: data.city.trim(),
        phone: data.phone.trim(),
        email: data.email.trim(),
        ownerId: session.user.id,
      },
    })
    return { farmId: farm.id, farmSlug: farm.slug }
  } catch (err) {
    console.error('[createFarm] error:', err)
    return { error: 'Hof konnte nicht erstellt werden. Bitte versuche es erneut.' }
  }
}

export async function createOnboardingProducts(
  farmId: string,
  products: Array<{ name: string; price: number; unit: string; stock: number }>
): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet.' }

  const farm = await prisma.farm.findUnique({
    where: { id: farmId, ownerId: session.user.id },
    select: { id: true },
  })
  if (!farm) return { error: 'Hof nicht gefunden.' }

  try {
    await prisma.product.createMany({
      data: products.map((p) => ({
        farmId,
        name: p.name.trim(),
        price: p.price,
        unit: p.unit as ProductUnit,
        stock: p.stock,
        isAvailable: true,
      })),
    })
    return { ok: true }
  } catch (err) {
    console.error('[createOnboardingProducts] error:', err)
    return { error: 'Produkte konnten nicht erstellt werden.' }
  }
}

export async function createOnboardingSlots(
  farmId: string,
  slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>
): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet.' }

  const farm = await prisma.farm.findUnique({
    where: { id: farmId, ownerId: session.user.id },
    select: { id: true },
  })
  if (!farm) return { error: 'Hof nicht gefunden.' }

  // Dieselben Regeln wie in den Einstellungen: Bis > Von, exakte Dubletten
  // gesperrt, keine Überschneidung — gegen Bestand UND innerhalb des Aufrufs
  const existing = await prisma.pickupSlot.findMany({
    where: { farmId },
    select: { dayOfWeek: true, startTime: true, endTime: true, isActive: true },
  })
  const slotError = findBatchSlotError(slots, {
    all: existing,
    active: existing.filter((s) => s.isActive),
  })
  if (slotError) {
    return { error: slotError }
  }

  try {
    await prisma.pickupSlot.createMany({
      data: slots.map((s) => ({
        farmId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: true,
      })),
    })
    return { ok: true }
  } catch (err) {
    console.error('[createOnboardingSlots] error:', err)
    return { error: 'Abholzeiten konnten nicht erstellt werden.' }
  }
}
