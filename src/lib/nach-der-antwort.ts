import { after } from 'next/server'

/**
 * Etwas erledigen, NACHDEM die Antwort beim Browser ist (Bug-Report Befund 4).
 *
 * Gedacht für Arbeit, auf die niemand wartet — vor allem den Mailversand, der
 * bisher synchron im Checkout-Request lief und ihn auf zehn bis fünfzehn
 * Sekunden zog.
 *
 * WARUM NICHT DIREKT `after()`: Die Funktion verlangt einen laufenden Request.
 * Wird der Routen-Handler außerhalb davon aufgerufen — in den Tests wird er
 * direkt importiert und gerufen —, wirft sie. Ein geworfener Fehler im
 * Nachlauf soll aber weder einen Test zum Scheitern bringen noch in der
 * Produktion eine gültige Bestellung gefährden. Deshalb: versuchen, und wenn
 * kein Request-Kontext da ist, die Aufgabe schlicht starten.
 *
 * Der Rückfall greift ausschließlich außerhalb eines Requests, also praktisch
 * nur im Test. In der Produktion läuft immer der echte `after()`-Weg, und nur
 * der hält die Instanz am Leben, bis die Aufgabe fertig ist.
 */
export function nachDerAntwort(aufgabe: () => Promise<void>): void {
  try {
    after(aufgabe)
  } catch {
    // Kein Request-Kontext (Test, Skript): Aufgabe starten und Fehler
    // schlucken — der Aufrufer protokolliert selbst, was schiefging.
    void aufgabe().catch(() => {})
  }
}
