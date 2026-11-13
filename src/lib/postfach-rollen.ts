/**
 * Rollen zur eigenen Antwort im Postfach (Nachtlauf 34 Nr. 308, F052 Hürde 10).
 *
 * Am Handy klebt das Antwortfeld über der Unterleiste; die neue Nachricht am
 * Ende des Fadens lag nach dem Senden dahinter. Die Seite setzt unter den Faden
 * einen Anker mit dieser Kennung, das Formular rollt nach dem Senden zu ihm.
 * Reine Rechnung, ohne DOM — testbar ohne Browser.
 */

/** Kennung des leeren Ankers direkt unter dem Faden. */
export const FADEN_ENDE_ID = 'postfach-faden-ende'

/**
 * Wie die Seite zur neuen Nachricht rollt: Wer im System „weniger Bewegung“
 * eingestellt hat, springt sofort hin, sonst gleitet sie.
 */
export function rollVerhalten(wenigerBewegung: boolean): 'auto' | 'smooth' {
  return wenigerBewegung ? 'auto' : 'smooth'
}
