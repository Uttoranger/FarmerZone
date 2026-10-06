import { z } from 'zod'

/**
 * Der Merker „Freischaltungs-Moment gezeigt" im localStorage
 * (src/lib/freischalt-moment.ts). Fremddaten (CODING_STANDARDS §3): Jeder
 * kann ihn im Browser ändern. Gilt nur genau dieser Wert — alles andere heißt
 * „noch nicht gezeigt".
 */
export const freischaltGesehenSchema = z.literal('1')
