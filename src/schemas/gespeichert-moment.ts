import { z } from 'zod'

/**
 * Der Merker „gespeichert gezeigt" im localStorage (src/lib/gespeichert-moment.ts,
 * Nr. 30). Fremddaten (CODING_STANDARDS §3): Jeder kann ihn im Browser ändern.
 * Nur genau dieser Wert heißt „schon gezeigt".
 */
export const gespeichertGezeigtSchema = z.literal('1')
