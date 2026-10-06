import { z } from 'zod'

/**
 * Der Merker „wieder da gezeigt" im localStorage (src/lib/wieder-da-moment.ts):
 * der Montag der Wiener Woche, in der der Moment kam. Fremddaten
 * (CODING_STANDARDS §3) — alles andere heißt „noch nicht gezeigt".
 */
export const wiederDaWocheSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
