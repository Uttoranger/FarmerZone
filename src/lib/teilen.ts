/**
 * Einen Link teilen: über das Teilen-Menü des Geräts (Web Share API), sonst
 * in die Zwischenablage. Die Browser-Zugriffe kommen als Umgebung herein —
 * so ist der Ablauf ohne Browser prüfbar (tests/teilen.test.ts).
 *
 * Vorher stand das in farm-page-view.tsx, und jeder Fehler des Teilen-Menüs
 * führte zum Kopieren — auch das Schließen des Menüs durch den Kunden. Wer
 * „doch nicht teilen" wollte, bekam trotzdem „Link kopiert".
 */

export type TeilenAusgang = 'geteilt' | 'abgebrochen' | 'kopiert' | 'fehlgeschlagen'

export type TeilenDaten = { title: string; text: string; url: string }

export type TeilenUmgebung = {
  /** navigator.share, wo es das gibt. */
  teilen?: (daten: TeilenDaten) => Promise<void>
  /** navigator.clipboard.writeText. */
  kopieren: (text: string) => Promise<void>
}

/** Der Kunde hat das Teilen-Menü geschlossen — das ist eine Entscheidung, kein Fehler. */
function istAbbruch(fehler: unknown): boolean {
  return typeof fehler === 'object' && fehler !== null && (fehler as { name?: unknown }).name === 'AbortError'
}

export async function teileOderKopiere(daten: TeilenDaten, umgebung: TeilenUmgebung): Promise<TeilenAusgang> {
  if (umgebung.teilen) {
    try {
      await umgebung.teilen(daten)
      return 'geteilt'
    } catch (fehler) {
      if (istAbbruch(fehler)) return 'abgebrochen'
      // Sonst verweigert (ohne Nutzergeste, in manchen In-App-Browsern) — der
      // Link soll trotzdem beim Kunden ankommen: kopieren.
    }
  }
  try {
    await umgebung.kopieren(daten.url)
    return 'kopiert'
  } catch {
    // Keine Zwischenablage (unsicherer Kontext, verweigert) — der Ausgang sagt es.
    return 'fehlgeschlagen'
  }
}

/** Die echte Umgebung im Browser. */
export function browserTeilen(): TeilenUmgebung {
  return {
    teilen: typeof navigator.share === 'function' ? (daten) => navigator.share(daten) : undefined,
    kopieren: (text) => navigator.clipboard.writeText(text),
  }
}
