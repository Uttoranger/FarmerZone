import { z } from 'zod'
import { BETRIEB_ARTEN } from '@/lib/betrieb'

/**
 * Die Art einer Zeile aus BetriebMessung (Register N18, Nr. 103) — gelesen aus
 * der Datenbank, also an der Systemgrenze geprüft: Nur Arten aus der Liste in
 * src/lib/betrieb.ts zählen; eine fremde Zeile (von Hand angelegt, aus einem
 * späteren Stand) fällt still weg, statt eine Kachel zu verfälschen.
 * (Nicht src/schemas/betrieb.ts — die gilt der Betriebsnummer.) Seit Nr. 113 auch
 * die Vercel-Ausgaben (`vercelAusgaben`, `vercelLimit`).
 */
export const betriebArtSchema = z.enum(BETRIEB_ARTEN)

/**
 * Was Spend Management von Vercel bei 50, 75 und 100 % des Ausgabenlimits
 * schickt (Nr. 113, `POST /api/webhooks/vercel-ausgaben`) — erst NACH der
 * Prüfung der Signatur gelesen. Beträge in Dollar als Zahl; die Route macht
 * daraus einmal ganze Cent. `teamId` wird geprüft, aber nicht gespeichert.
 */
export const vercelAusgabenSchema = z.object({
  budgetAmount: z.number().finite().nonnegative(),
  currentSpend: z.number().finite().nonnegative(),
  teamId: z.string().max(200),
  thresholdPercent: z.number().finite().nonnegative(),
})
