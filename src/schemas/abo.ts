import { z } from 'zod'

/**
 * Ein Abo an- oder abschalten (`/account`, `updateSubscription`). Die
 * Hof-Kennung kommt aus dem Browser: nur Länge und Zeichen einer Prisma-cuid
 * (wie `kennung` in hof-bestellungen.ts) — ob es den Hof gibt, entscheidet
 * die Datenbank, wem das Abo gehört, die bewiesene Adresse.
 */
export const aboAenderungSchema = z.object({
  farmId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  optInEmail: z.boolean(),
  optInWhatsApp: z.boolean(),
})

export type AboAenderung = z.infer<typeof aboAenderungSchema>

/**
 * Der Knopf „Anmeldung bestätigen" (Double-Opt-in, S11, Nr. 38). Hier nur
 * die Form; Signatur, Zweck und Ablauf prüft `pruefeAboBestaetigungsToken`.
 * Echte Token sind rund 120 Zeichen lang — die Grenze hält Unsinn fern.
 */
export const ABO_TOKEN_MAX = 512

export const aboTokenSchema = z.string().trim().min(1).max(ABO_TOKEN_MAX)

export const aboBestaetigenSchema = z.object({ token: aboTokenSchema })
