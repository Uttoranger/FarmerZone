/**
 * Hofseite am Handy: immer wissen, wo man ist (Nr. 177, Register N30; Board
 * docs/mockups/system-sterne-hofseite-orientierung.html). Rein, ohne DOM —
 * die Komponenten (hofseite-kunde.tsx, produkt-abschnitte.tsx,
 * product-grid.tsx) zeigen nur an, was hier entschieden wird.
 */
import { kaufSperreHinweis, type KaufSperre } from '@/lib/bereiche-anzeige'
import { mengeAbgelehntText } from '@/lib/hofseite-kunde'
import { NETZ_SATZ } from '@/lib/netz'
import { SHOP_PAUSED_BUTTON_LABEL } from '@/lib/shop-pause'

// ─── Der klebende Block unter dem Kopf (nur unter md) ───────────────────────

/*
 * Hofzeile, Reiter und Kategorie-Chips kleben als EIN Block unter dem Kopf der
 * KundeShell (Freigabe 177 Punkt 2): ein Element mit `sticky`, die drei Teile
 * darin im Fluss. Wächst ein Teil (größere Schrift, umbrechende Reiter), wächst
 * der Block mit — nichts überlappt, keine Lücke. Die Chips stecken im
 * Produktraster und kommen über ein Portal in ihren Platz im Block
 * (produkt-abschnitte.tsx). Die Zahlen unten sind nur der Ausgangswert des
 * scroll-padding in globals.css, bis die Hofseite die echte Höhe gemessen hat
 * (KLEBE_BLOCK_VAR); tests/hofseite-orientierung.test.ts koppelt sie.
 */

/** Die Hofzeile: 48 px (nur unter md). */
export const HOFZEILE_PX = 48
/** Die Reiterleiste: 48 px Reiter plus 1 px Linie. */
export const REITER_PX = 49
/** Die Chip-Zeile: 36 px Chips, 4 px Luft oben und unten, 1 px Linie (nur unter md, nur im Reiter Produkte). */
export const CHIPS_PX = 45

/** Der klebende Block: am Handy unter dem 56-px-Kopf (`top-14`), ab md unter dem 64-px-Kopf (`top-16`), wie bisher die Reiter. */
export const KLEBE_BLOCK = 'sticky top-14 z-30 bg-background md:top-16'

/** Die gemessene Höhe des Blocks am Wurzelelement — globals.css rechnet scroll-padding damit. */
export const KLEBE_BLOCK_VAR = '--hof-klebeblock'

// ─── Hofzeile ───────────────────────────────────────────────────────────────

/** Der Name des Rückwegs für den Screenreader — sichtbar ist nur der Pfeil. */
export const HOFZEILE_ZURUECK = 'Zurück zu allen Höfen'

/**
 * Der Name des Zurück-Knopfs im Titelbild für den Screenreader (Entscheidung 5,
 * Morgenbericht 25) — sichtbar ist nur der Pfeil. Er ersetzt am Handy die Hofzeile,
 * solange diese noch nicht klebt (am Seitenanfang steht sie noch im Fluss unter
 * dem Titelbild); danach übernimmt sie (HOFZEILE_ZURUECK).
 */
export const TITELBILD_ZURUECK = 'Zu allen Höfen'

/**
 * Steht der klebende Block schon oben? Dann ist die Hofzeile mit ihrem eigenen
 * Zurück da, und der Knopf im Titelbild geht weg (wer weiter oben scrollt, hat
 * ihn gleich wieder; die Hofzeile klebt oben, der Knopf bliebe ohnehin zurück).
 * `blockOben` ist die Oberkante des Blocks im Fenster, `kopfHoehe` die Höhe des
 * Seitenkopfs, unter dem er klebt (0, wenn es keinen gibt). Eine halbe Pixelzeile
 * Luft, weil die Messung beim Kleben auf Bruchteile rundet.
 */
export function hofzeileSteht(blockOben: number, kopfHoehe: number): boolean {
  return blockOben <= kopfHoehe + 0.5
}

/** Der Zustand des Hofs, wenn er Bestellungen annimmt (Wortlaut des Boards). */
export const NIMMT_BESTELLUNGEN_AN = 'Nimmt Bestellungen an'

/**
 * Der Zustand in der Hofzeile — aus derselben Quelle wie das Schild der
 * Hofseite (die Kaufsperre, Register N24, und deren Wortlaut aus
 * `kaufSperreHinweis` bzw. „Pausiert"). Nie die Pause selbst lesen.
 */
export function hofZeileZustand(sperre: KaufSperre): string {
  if (sperre === null) return NIMMT_BESTELLUNGEN_AN
  if (sperre === 'pause') return SHOP_PAUSED_BUTTON_LABEL
  // „Noch nicht bestellbar." → ohne Schlusspunkt: Die Zeile ist kein Satz.
  return kaufSperreHinweis(sperre, '').titel.replace(/\.$/, '')
}

/** „Musterort · Nimmt Bestellungen an" — ohne Ort nur der Zustand. */
export function hofZeileUnterzeile(ort: string, sperre: KaufSperre): string {
  const zustand = hofZeileZustand(sperre)
  return ort.trim() ? `${ort.trim()} · ${zustand}` : zustand
}

// ─── Korb ohne Blatt-Pingpong (Register N30) ────────────────────────────────

/** Wie lange die Bestätigungszeile nach einem „In den Korb" steht. */
export const BESTAETIGUNG_MS = 6000

/** Der Merker im sessionStorage: In dieser Sitzung hat das Korb-Blatt sich schon einmal geöffnet. */
export const BLATT_MERKER = 'korb-blatt-gezeigt'

/** „Heumilch ist im Warenkorb". */
export function imKorbText(name: string): string {
  return `${name} ist im Warenkorb`
}

export const RUECKGAENGIG = 'Rückgängig'

type Speicher = Pick<Storage, 'getItem' | 'setItem'>

// Ohne Speicher (privates Fenster, gesperrt) gilt der Merker, solange das Dokument lebt.
let gezeigtOhneSpeicher = false

/**
 * Soll dieses „In den Korb" das Korb-Blatt öffnen? Nur das erste einer
 * Sitzung (Register N30) — danach bestätigt eine kurze Zeile. Merkt sich die
 * Antwort gleich mit. Wirft nie: Ohne Speicher zählt das Dokument.
 */
export function blattBeimErstenMal(speicher: () => Speicher | null): boolean {
  try {
    const s = speicher()
    if (s) {
      if (s.getItem(BLATT_MERKER) !== null) return false
      s.setItem(BLATT_MERKER, '1')
      return true
    }
  } catch {
    // Kein Zugriff (gesperrter Speicher): weiter mit dem Merker im Dokument.
  }
  if (gezeigtOhneSpeicher) return false
  gezeigtOhneSpeicher = true
  return true
}

/** Nur für Tests: den Merker im Dokument zurücksetzen. */
export function vergissBlattMerker(): void {
  gezeigtOhneSpeicher = false
}

/** Wie ein Griff in den Korb ausging (KorbErgebnis aus use-cart.ts, ohne den Hook zu laden). */
type Ergebnis = { ok: boolean; error?: string; nochmal?: true }

const NICHT_IN_DEN_KORB = 'Wir konnten das Produkt nicht in den Warenkorb legen. Versuch es gleich noch einmal.'
/** Sätze von /api/reserve bzw. use-cart.ts beim Legen, die eine Kundin versteht und die bleiben. */
const VERSTAENDLICH_BEIM_LEGEN = new Set(['Produkt nicht verfügbar', 'Produkt nicht mehr verfügbar', 'Bitte eine Menge bis 10.000.'])

/**
 * Was die Bestätigungszeile sagt, wenn ein Griff in den Korb scheitert —
 * nie ein roher Servertext („Serverfehler bei der Reservierung", „Ungültige
 * Parameter"; Übergabe aus Nr. 175). Am Netz der Satz aus N29 (dazu bietet
 * die Zeile „Nochmal" an). Beim Ändern der Menge gilt `mengeAbgelehntText`;
 * beim Legen dieselben verständlichen Sätze, sonst ein eigener allgemeiner.
 */
export function korbFehlerText(ergebnis: Ergebnis, art: 'legen' | 'menge'): string {
  if (ergebnis.nochmal) return NETZ_SATZ
  const geglaettet = mengeAbgelehntText(ergebnis.error)
  if (art === 'menge') return geglaettet
  // mengeAbgelehntText gibt für jeden unverständlichen Text seinen allgemeinen Satz — derselbe wie ohne Text.
  if (geglaettet !== mengeAbgelehntText(undefined)) return geglaettet
  if (ergebnis.error && VERSTAENDLICH_BEIM_LEGEN.has(ergebnis.error)) return `${ergebnis.error}.`.replace(/\.\.$/, '.')
  return NICHT_IN_DEN_KORB
}
