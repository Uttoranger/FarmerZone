'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findSlotError } from '@/lib/pickup-slot-rules'
import {
  geokodiereAdresse,
  istInOesterreich,
  rundeKoordinate,
  type GeokodierungsErgebnis,
} from '@/lib/geokodierung'

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
  // Logo und Titelbild gehören zu „Mein Auftritt" (echter Datei-Upload) und
  // stehen bewusst NICHT mehr im Profil-Formular. Sie fehlen hier auch im
  // Schreibpfad: sonst würde jedes Profil-Speichern die dort hochgeladenen
  // Bilder auf null zurücksetzen. Die DB-Felder selbst bleiben unverändert.
})

export type ProfileFormData = z.infer<typeof profileSchema>
export type ProfileResult = { error?: string }

export async function updateProfile(data: ProfileFormData): Promise<ProfileResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const parsed = profileSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Daten' }

  await prisma.farm.update({
    where: { id: farm.id },
    data: parsed.data,
  })

  revalidatePath('/settings/profile')
  revalidatePath(`/${farm.slug}`)
  return {}
}

/** Was die Standort-Schaltfläche zurückbekommt. */
export type StandortPruefung =
  | { error: string }
  /** Es gibt schon bestätigte Koordinaten: Karte öffnet direkt darauf —
   *  gespeichert ist gespeichert, es wird NICHT neu geokodiert. */
  | { art: 'vorhanden'; lat: number; lon: number }
  /** Noch keine Koordinaten: der Kaskaden-Vorschlag. */
  | { art: 'vorschlag'; ergebnis: GeokodierungsErgebnis }

/**
 * Auslöser ist AUSSCHLIESSLICH die Schaltfläche „Standort auf der Karte
 * prüfen" im Hofprofil — keine Suche beim Tippen, kein Aufruf beim Speichern.
 * Geokodiert wird nur, solange noch keine Koordinaten existieren; danach
 * gilt der gespeicherte Punkt (Schaltfläche „Standort ändern" öffnet ihn).
 */
export async function pruefeHofStandort(adresse: {
  address: string
  postalCode: string
  city: string
}): Promise<StandortPruefung> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  if (farm.latitude != null && farm.longitude != null) {
    return { art: 'vorhanden', lat: farm.latitude, lon: farm.longitude }
  }

  const parsed = profileSchema
    .pick({ address: true, postalCode: true, city: true })
    .safeParse(adresse)
  if (!parsed.success) {
    return { error: 'Bitte zuerst Straße, PLZ und Ort ausfüllen.' }
  }

  return { art: 'vorschlag', ergebnis: await geokodiereAdresse(parsed.data) }
}

/**
 * Speichert die auf der Minikarte bestätigten Koordinaten (Kartenmitte).
 *
 * Plausibilisiert grob auf Österreich — ein Punkt in Italien oder bei 0/0
 * ist kein Hofstandort, sondern eine verrutschte Karte. Dann bleibt der
 * alte Stand, und der Bauer setzt den Punkt neu.
 */
export async function speichereHofStandort(lat: number, lon: number): Promise<{ error?: string }> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  if (!istInOesterreich(lat, lon)) {
    return { error: 'Der Punkt liegt außerhalb Österreichs — bitte schieb die Karte auf deinen Hof.' }
  }

  await prisma.farm.update({
    where: { id: farm.id },
    data: { latitude: rundeKoordinate(lat), longitude: rundeKoordinate(lon) },
  })

  revalidatePath('/settings/profile')
  revalidatePath('/dashboard')
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

  // Zeitlogik + Dublettensperre: Bis > Von, exakte Dubletten gesperrt,
  // keine Überschneidung mit aktiven Fenstern desselben Wochentags
  const existing = await prisma.pickupSlot.findMany({
    where: { farmId: farm.id },
    select: { dayOfWeek: true, startTime: true, endTime: true, isActive: true },
  })
  const slotError = findSlotError(parsed.data, {
    all: existing,
    active: existing.filter((s) => s.isActive),
  })
  if (slotError) {
    return { error: slotError }
  }

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
