import { z } from 'zod'
import { emailSchema } from '@/schemas/email'
import { WIDERRUF_GRENZEN } from '@/lib/widerruf'

/**
 * Die Eingaben des Widerrufs (Nr. 200, Register N39) — geprüft in den Server
 * Actions (src/server/actions/widerruf.ts). Feste deutsche Sätze je Feld
 * (CODING_STANDARDS §3). Kennungen nur als cuid-artige Zeichen: nie eine
 * Adresse, nie Text.
 */
const kennung = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)

const name = z.string().trim().min(1, 'Bitte gib deinen Namen ein.').max(WIDERRUF_GRENZEN.name, 'Der Name ist zu lang.')
const nachricht = z
  .string()
  .trim()
  .max(WIDERRUF_GRENZEN.nachricht, `Höchstens ${WIDERRUF_GRENZEN.nachricht} Zeichen.`)
  .optional()
  .transform((t) => (t ? t : undefined))

/** Mit signiertem Link: die Bestellung steht fest, gewählt werden ganze Bestellung oder Positionen. */
export const widerrufMitLinkSchema = z
  .object({
    bestellung: kennung,
    sig: z.string().min(1).max(200),
    umfang: z.enum(['ganz', 'teil']),
    positionen: z.array(kennung).max(100).default([]),
    name,
    nachricht,
  })
  .refine((e) => e.umfang === 'ganz' || e.positionen.length > 0, { message: 'Bitte wähl mindestens einen Artikel.', path: ['positionen'] })

/** Ohne Link (Fuß, direkt): Name, E-Mail, Bestellnummer und „ganze Bestellung“ oder Freitext. */
export const widerrufOhneLinkSchema = z
  .object({
    name,
    email: emailSchema('Bitte gib eine gültige E-Mail-Adresse ein.'),
    bestellnummer: z.string().trim().min(1, 'Bitte gib die Bestellnummer ein.').max(WIDERRUF_GRENZEN.bestellnummer, 'Die Bestellnummer ist zu lang.'),
    umfang: z.enum(['ganz', 'teil']),
    nachricht,
  })
  .refine((e) => e.umfang === 'ganz' || Boolean(e.nachricht), { message: 'Bitte schreib, welche Artikel du zurückgeben willst.', path: ['nachricht'] })

export type WiderrufMitLink = z.infer<typeof widerrufMitLinkSchema>
export type WiderrufOhneLink = z.infer<typeof widerrufOhneLinkSchema>

/** Hof: Rückgabe erhalten – erstatten. */
export const widerrufErstattenSchema = z.object({ widerrufId: kennung })

/** Hof: Ablehnen — Grund Pflicht (Freigabe 200 Punkt 5), höchstens 300 Zeichen. */
export const widerrufAblehnenSchema = z.object({
  widerrufId: kennung,
  grund: z.string().trim().min(1, 'Bitte schreib einen Grund.').max(WIDERRUF_GRENZEN.grund, `Höchstens ${WIDERRUF_GRENZEN.grund} Zeichen.`),
})
