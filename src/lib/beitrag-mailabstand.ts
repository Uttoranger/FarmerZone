import type { Prisma } from '@prisma/client'
import { formatZahl } from '@/lib/format'

/**
 * Frequenzschutz für Beiträge per E-Mail: Ein Hof schreibt seinen
 * Abonnentinnen höchstens eine Mail je sieben mal 24 Stunden. Das Fenster
 * gleitet ab dem Zeitpunkt der Anfrage und zählt Stunden, keine Wiener
 * Kalendertage. Rein: `jetzt` bestimmt die Seite einmal auf dem Server
 * (CODING_STANDARDS §2), der Assistent bekommt ihn als ISO-Text.
 */
export const MAILABSTAND_TAGE = 7

/**
 * Wie lange ein Beitrag läuft (`expiresAt`). Eine eigene Zahl, kein
 * Mailabstand (Nr. 149): Beide sind heute sieben Tage, hängen aber nicht
 * zusammen — ändert sich die Laufzeit, bleibt die Sperre, wie sie ist.
 */
export const BEITRAG_LAUFZEIT_TAGE = 7

const TAG_MS = 24 * 60 * 60 * 1000

/** Ab diesem Zeitpunkt (einschließlich) sperrt eine versendete Mail den Kanal „E-Mail". */
export function berechneMailabstandBeginn(jetzt: Date): Date {
  return new Date(jetzt.getTime() - MAILABSTAND_TAGE * TAG_MS)
}

/** Bis wann ein jetzt veröffentlichter Beitrag läuft. */
export function beitragLaeuftBis(jetzt: Date): Date {
  return new Date(jetzt.getTime() + BEITRAG_LAUFZEIT_TAGE * TAG_MS)
}

/**
 * Die EINE Bedingung der Mail-Sperre (Nr. 149) — für die Action beim
 * Versand und für die Seite „Neuer Beitrag", die danach den Schalter
 * abstellt. Es sperrt ein Beitrag, sobald er Aufträge in der Mail-Warteschlange
 * hat (Nr. 159): `emailRecipientCount` ist die Zahl der Aufträge, geschrieben in
 * derselben Transaktion wie sie. Ohne Abo (0) darf der Hof es gleich noch
 * einmal versuchen. Wie viele davon hinausgingen, zählt
 * `gesendeteBeitragsMails` (src/server/mail-arten/beitrag.ts).
 */
export function mailSperreWo(farmId: string, jetzt: Date): Prisma.StatusPostWhereInput {
  return {
    farmId,
    sentViaEmail: true,
    emailRecipientCount: { gt: 0 },
    publishedAt: { gte: berechneMailabstandBeginn(jetzt) },
  }
}

/**
 * Was der Hof nach dem Veröffentlichen liest. Die Mails gehen erst nach der
 * Antwort hinaus (Nr. 149) — deshalb „wird verschickt", nicht „verschickt".
 */
export function mailVersandMeldung(anzahl: number): string {
  return `wird an ${formatZahl(anzahl)} ${anzahl === 1 ? 'Abo' : 'Abos'} verschickt`
}
