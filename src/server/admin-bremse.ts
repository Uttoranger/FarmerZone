import * as Sentry from '@sentry/nextjs'
import { DB_BREMSE_ZEITLIMIT_MS, innerhalbDerGrenze, type DbBremse } from '@/lib/bremse-datenbank'
import { zaehleVersuche } from '@/server/bremse-datenbank'

/**
 * Eine Bremse der Admin-Anmeldung, FAIL-CLOSED (Register N20, Nr. 126): Jeder
 * Versuch zählt; antwortet die Datenbank nicht (oder nicht innerhalb der
 * Frist), gilt die Bremse als voll — `true` heißt „gesperrt“. Das ist das
 * Gegenstück zur zweiten Stufe der Bremse über alle Instanzen
 * (src/server/bremse-datenbank.ts, FAIL-OPEN): Dort würde ein Ausfall
 * Kundinnen aussperren, hier würde er jedem erlauben, Ersatzcodes und
 * E-Mail-Codes des Admin-Kontos ohne Grenze zu raten.
 *
 * EINE Stelle für beide Wege: die Anmeldung mit Ersatzcode (src/lib/auth.ts,
 * je Adresse) und der E-Mail-Code der Einrichtung
 * (src/server/actions/admin-anmeldung.ts, je Konto). Gemeldet wird nur die
 * Art des Fehlers und der Zweck der Bremse, nie das Merkmal (Adresse, Konto)
 * und nie der Text des Fehlers — er könnte die Adresse des Datenbank-Servers
 * tragen.
 */
export async function adminBremseVoll(bremse: DbBremse, merkmal: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const frist = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Bremse: Zeitlimit')), DB_BREMSE_ZEITLIMIT_MS)
    })
    const [stand] = await Promise.race([zaehleVersuche([{ bremse, merkmal }]), frist])
    return !innerhalbDerGrenze(stand, bremse.max)
  } catch (err) {
    const meldung = new Error('Bremse der Admin-Anmeldung nicht gezählt')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { level: 'warning', tags: { aufgabe: 'admin-bremse', zweck: bremse.zweck } })
    return true
  } finally {
    clearTimeout(timer)
  }
}
