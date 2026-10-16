import { z } from 'zod'
import { BETRIEB_ARTEN } from '@/lib/betrieb'

/**
 * Die Art einer Zeile aus BetriebMessung (Register N18, Nr. 103) — gelesen aus
 * der Datenbank, also an der Systemgrenze geprüft: Nur Arten aus der Liste in
 * src/lib/betrieb.ts zählen; eine fremde Zeile (von Hand angelegt, aus einem
 * späteren Stand) fällt still weg, statt eine Kachel zu verfälschen.
 * (Nicht src/schemas/betrieb.ts — die gilt der Betriebsnummer.)
 */
export const betriebArtSchema = z.enum(BETRIEB_ARTEN)
