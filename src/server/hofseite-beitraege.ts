import { cache } from 'react'
import { unstable_rethrow } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { ladeAktivenBeitrag, getActiveStatusPosts, type ActiveStatusPost } from '@/server/queries/status-posts'
import { HOFSEITE_BEITRAEGE_MAX } from '@/lib/hofseite-kunde'
import type { Suchparameter } from '@/lib/ansichts-modus'
import { BEITRAG_PARAMETER, beitragKennungSchema } from '@/schemas/hofseite-reiter'

export type HofseiteBeitraege = { beitraege: ActiveStatusPost[]; fehler: boolean }

/**
 * Die aktiven Beiträge des Hofs für „Aktuell vom Hof“ (Register F8: höchstens
 * fünf, der neueste zuerst). Trägt die Adresse `?beitrag=<id>` (geprüft) und
 * ist der Beitrag nicht unter den fünf, kommt er — nur wenn er aktiv ist und
 * GENAU diesem Hof gehört (ladeAktivenBeitrag) — hinten dazu; die Seite stellt
 * ihn oben hin (ordneBeitraege). Scheitert das Laden, fehlt nur der Abschnitt —
 * die Seite mit Produkten und Korb bleibt (Fehler inline statt der 500 für
 * alles); der Fehler geht nach Sentry, und `fehler` sagt der Seite, dass sie zu
 * `?beitrag=` nichts sagen kann („nicht mehr aktuell“ stimmte nicht: Der
 * Beitrag kann aktiv sein, Nr. 134). Die Vorschau im Bauern-Bereich ist
 * dieselbe Route (?vorschau=1) und bekommt deshalb dieselbe Liste.
 *
 * Einmal je Anfrage (React `cache`, Schlüssel sind zwei Texte): Der Lader der
 * Hofseite startet sie, sobald der Hof bekannt ist (Nr. 180), die Seite liest
 * dieselbe Antwort danach ohne zweite Abfrage.
 */
export const ladeBeitraege = cache(async (farmId: string, kennung: string | null): Promise<HofseiteBeitraege> => {
  try {
    const neueste = await getActiveStatusPosts(farmId, HOFSEITE_BEITRAEGE_MAX)
    if (kennung === null || neueste.some((beitrag) => beitrag.id === kennung)) return { beitraege: neueste, fehler: false }
    const geteilt = await ladeAktivenBeitrag(farmId, kennung)
    return { beitraege: geteilt ? [...neueste, geteilt] : neueste, fehler: false }
  } catch (err) {
    unstable_rethrow(err)
    Sentry.captureException(err, { tags: { bereich: 'hofseite-beitrag' } })
    return { beitraege: [], fehler: true }
  }
})

/** `?beitrag=` ist eine Systemgrenze: Was nicht passt, wird verworfen (Zod). */
export function beitragKennungAus(suche: Suchparameter): string | null {
  return beitragKennungSchema.parse(suche[BEITRAG_PARAMETER])
}
