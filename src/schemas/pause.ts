import { z } from 'zod'
import { PAUSENACHRICHT_MAX, ZU_LANG, passtInGrenze } from '@/lib/eingabegrenzen'

/** Für alles, was kein Mensch tippt (falscher Typ aus einer gebauten Anfrage). */
const PAUSE_UNGUELTIG = 'Ungültige Daten'

/** Was setPause nach der Prüfung bekommt — die Nachricht schon ohne Ränder. */
export type PauseEingabe = { isPaused: boolean; pauseMessage: string }

/**
 * Pause umschalten und Pausen-Nachricht speichern (setPause in
 * src/server/actions/farm.ts; Register N24-Ergänzung 22.10.2026, Nr. 137).
 *
 * Mit der gespeicherten Nachricht: Ein Altwert über PAUSENACHRICHT_MAX darf
 * unverändert bleiben (CODING_STANDARDS §8) — PauseClient schickt die
 * Nachricht beim Umschalten mit, ohne die Ausnahme sperrte ein langer Altwert
 * das Fortsetzen. Geprüft wird der Text ohne Ränder, so wie er gespeichert wird.
 */
export function pauseSchema(gespeicherteNachricht: string | null): z.ZodType<PauseEingabe> {
  return z.object({
    isPaused: z.boolean({ message: PAUSE_UNGUELTIG }),
    pauseMessage: z
      .string({ message: PAUSE_UNGUELTIG })
      .trim()
      .refine((v) => passtInGrenze(v, PAUSENACHRICHT_MAX, gespeicherteNachricht), ZU_LANG.pausenachricht),
  })
}
