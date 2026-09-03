'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findSlotError } from '@/lib/pickup-slot-rules'
import {
  geokodiereAdresse,
  istImErlaubtenGebiet,
  rueckwaertsGeokodiere,
  rundeKoordinate,
  type GeokodierungsErgebnis,
  type RueckwaertsAdresse,
} from '@/lib/geokodierung'
import { LAENDER, LAND_GENITIV, alsLand, type Land } from '@/lib/laender'

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
  // Die Spalte ist ein String mit Default (prisma/schema.prisma) — ERLAUBT
  // sind aber nur AT und DE, und das erzwingt genau diese Zeile. Ein drittes
  // Land kostet damit einen Eintrag in src/lib/laender.ts, keine Migration.
  country: z.enum(LAENDER, { message: 'Bitte Österreich oder Deutschland wählen' }),
  phone: z.string().min(4),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  // Der Kartenpunkt wird MIT dem Profil gespeichert — es gibt keinen eigenen
  // Bestätigen-Schritt mehr. null heißt: (noch) kein Punkt gesetzt; ein
  // gespeicherter Punkt wird dann NICHT angerührt (siehe updateProfile).
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  // Logo und Titelbild gehören zu „Mein Auftritt" (echter Datei-Upload) und
  // stehen bewusst NICHT mehr im Profil-Formular. Sie fehlen hier auch im
  // Schreibpfad: sonst würde jedes Profil-Speichern die dort hochgeladenen
  // Bilder auf null zurücksetzen. Die DB-Felder selbst bleiben unverändert.
})

export type ProfileFormData = z.infer<typeof profileSchema>
export type ProfileResult = { error?: string }

/** Der ruhige Hinweis bei einem Punkt außerhalb des gewählten Landes —
 *  Wortlaut wie bisher, nur das Land wechselt mit. */
function aussenhalbHinweis(land: Land): string {
  return `Der Punkt liegt außerhalb ${LAND_GENITIV[land]} — bitte schieb die Karte auf deinen Hof.`
}

export async function updateProfile(data: ProfileFormData): Promise<ProfileResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const parsed = profileSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Daten' }

  const { latitude, longitude, ...profil } = parsed.data
  const hatPunkt = latitude != null && longitude != null
  // Plausibilisiert grob auf das LAND DES HOFES — ein Punkt in Italien oder
  // bei 0/0 ist kein Hofstandort, sondern eine verrutschte Karte. Dann wird
  // NICHTS gespeichert, und der Bauer schiebt den Punkt zurück. Geprüft wird
  // gegen das gerade gewählte Land, nicht gegen das gespeicherte: Wer sein
  // Land umstellt UND den Punkt verschiebt, speichert beides in einem Zug.
  if (hatPunkt && !istImErlaubtenGebiet(latitude, longitude, profil.country)) {
    return { error: aussenhalbHinweis(profil.country) }
  }
  // UND die Gegenrichtung: Wer nur das LAND umstellt, ohne den Punkt
  // anzufassen, ließe sonst einen gespeicherten Punkt zurück, den die
  // Prüfung des neuen Landes nie durchgelassen hätte — Land und Punkt
  // liefen auseinander. Der Hinweis ist derselbe; zu tun ist auch dasselbe.
  const alterPunkt = farm.latitude != null && farm.longitude != null
  if (
    !hatPunkt &&
    alterPunkt &&
    !istImErlaubtenGebiet(farm.latitude!, farm.longitude!, profil.country)
  ) {
    return { error: aussenhalbHinweis(profil.country) }
  }

  await prisma.farm.update({
    where: { id: farm.id },
    data: {
      ...profil,
      // Ohne Punkt bleiben gespeicherte Koordinaten unangetastet — das
      // Profil-Speichern darf einen gesetzten Standort nie löschen.
      ...(hatPunkt
        ? { latitude: rundeKoordinate(latitude), longitude: rundeKoordinate(longitude) }
        : {}),
    },
  })

  revalidatePath('/settings/profile')
  // Der Kartenpunkt zählt in die Erste-Schritte-Liste der Übersicht.
  revalidatePath('/dashboard')
  revalidatePath(`/${farm.slug}`)
  return {}
}

/** Was die Schaltfläche „Auf der Karte suchen" zurückbekommt. */
export type StandortSuche = { error: string } | { ergebnis: GeokodierungsErgebnis }

/**
 * Auslöser ist AUSSCHLIESSLICH die Schaltfläche „Auf der Karte suchen" im
 * Hofprofil — keine Suche beim Tippen, kein Aufruf beim Speichern. Es wird
 * IMMER geokodiert: Die Karte ist dauerhaft sichtbar, die Suche fährt sie
 * auf den Vorschlag; gespeichert wird der Punkt erst mit dem Profil.
 */
export async function sucheHofStandort(adresse: {
  address: string
  postalCode: string
  city: string
  country?: string
}): Promise<StandortSuche> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const parsed = profileSchema
    .pick({ address: true, postalCode: true, city: true })
    .safeParse(adresse)
  if (!parsed.success) {
    return { error: 'Bitte zuerst Straße, PLZ und Ort ausfüllen.' }
  }

  // Das im FORMULAR gewählte Land, nicht das gespeicherte: Wer gerade auf
  // Deutschland umstellt, sucht seine Adresse sofort in Deutschland — sonst
  // führe die erste Suche nach dem Wechsel noch nach Österreich. Durch
  // DASSELBE Zod-Schema wie beim Speichern: Dieser zweite Eingang darf die
  // Länderprüfung nicht umgehen. Fehlt die Angabe (Altaufruf), gilt das
  // gespeicherte Land des Hofes.
  const gewaehlt = profileSchema.shape.country.safeParse(adresse.country)
  const land = gewaehlt.success ? gewaehlt.data : alsLand(farm.country)
  return { ergebnis: await geokodiereAdresse(parsed.data, land) }
}

/**
 * Rückwärts: Der geschobene Kartenpunkt wird zu Adressfeldern. Gebremst wird
 * clientseitig in der Karte (erstelleKartenBremse: Anfrage erst nach 1,2 s
 * Ruhe und nur bei >~25 m seit der letzten Anfrage). Scheitert die Suche,
 * kommt leise null — die Felder bleiben unverändert, die Koordinaten gelten
 * trotzdem.
 */
export async function holeAdresseZumPunkt(
  lat: number,
  lon: number
): Promise<RueckwaertsAdresse | null> {
  const farm = await getAuthFarm()
  if (!farm) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  return rueckwaertsGeokodiere(lat, lon)
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
