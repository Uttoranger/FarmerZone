import { z } from 'zod'
import { TEILEN_BILD_FORMATE, TEILEN_KANAL_CODES } from '@/lib/teilen-kanal'
import { hofSlugSchema } from '@/schemas/hof-adresse'

/**
 * Teilen-Zählung (Gate 7, S8) — die Systemgrenzen: Kürzel aus der Adresse,
 * aus dem sessionStorage und aus dem Checkout-Body. Nur die sieben Kürzel
 * sind gültig; alles andere wird verworfen, nie korrigiert.
 */
export const teilenKanalCodeSchema = z.enum(TEILEN_KANAL_CODES)

/**
 * Im Checkout-Body: Ein fehlender oder ungültiger Wert darf die Bestellung
 * NIE scheitern lassen (Geldpfad) — `catch` macht daraus undefined, die Route
 * speichert dann null.
 */
export const checkoutTeilenKanalSchema = teilenKanalCodeSchema.optional().catch(undefined)

/** Der Besuch über einen geteilten Link — POST /api/teilen/besuch. Strikt: ein unbekanntes Feld ist 400. */
export const teilenBesuchSchema = z
  .object({
    // Dieselbe Form wie ein Hof-Slug; ob es den Hof gibt und ob er
    // öffentlich ist, prüft die Route.
    farmSlug: hofSlugSchema,
    kanal: teilenKanalCodeSchema,
  })
  .strict()

export type TeilenBesuch = z.infer<typeof teilenBesuchSchema>

/**
 * Die Adresse des Teilen-Bilds: `?format=quadrat|story` und `?p=<id>,<id>` —
 * die im Teilen-Fenster gewählten Produkte. Was nicht passt, fällt still weg
 * (Standard: quadrat, alle kaufbaren); ob ein Produkt ins Bild darf,
 * entscheidet trotzdem `bildProdukte` (nie ausverkauft, nie gesperrt).
 * `v` ist nur die Prüfsumme für den Zwischenspeicher und wird nicht gelesen.
 */
export const teilenBildSucheSchema = z.object({
  format: z.enum(TEILEN_BILD_FORMATE).catch('quadrat'),
  p: z
    .string()
    .max(400)
    .transform((s) =>
      s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => /^[A-Za-z0-9_-]{1,40}$/.test(t))
        // Nie mehr als ins Bild passen (TEILEN_BILD_PRODUKTE_MAX) — die Route
        // behält danach nur Kennungen, die wirklich ins Bild dürfen.
        .slice(0, 3)
    )
    .optional()
    .catch(undefined),
})

export type TeilenBildSuche = z.infer<typeof teilenBildSucheSchema>
