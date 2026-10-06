import { z } from 'zod'

/**
 * Der Bestätigungs-Link (S3, Nr. 17b): `/verify?token=…`. Der Token ist ein
 * von Better Auth signierter JWT — hier wird nur die Form geprüft, die
 * Signatur prüft Better Auth (`auth.api.verifyEmail`). Die Grenze hält
 * Unsinn aus der Adresszeile von Better Auth fern; echte Token sind weit
 * kürzer.
 */
export const TOKEN_MAX = 2048

export const bestaetigungsTokenSchema = z.string().trim().min(1).max(TOKEN_MAX)

export const emailBestaetigenSchema = z.object({ token: bestaetigungsTokenSchema })
