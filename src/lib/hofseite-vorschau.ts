/**
 * Rund um die Vorschau der Hofseite (/[farmSlug]?vorschau=1): Adresse,
 * Korb-Regel, Nachrichten zwischen Editor und Rahmen, Maße. WER die Vorschau
 * bekommt und was dann anders ist, entscheidet nicht diese Datei, sondern
 * `ansichtsModus` (src/lib/ansichts-modus.ts) — nur dort wird der Parameter
 * gelesen. Dazu die Spaltenbreiten des Editors am breiten Bildschirm
 * (`editorSpalten`, Register N7). Rein und ohne Datenbank prüfbar
 * (tests/hofseite-vorschau.test.ts).
 */
import { bereitSchema, markierungSchema, type HofseiteZeileId } from '@/schemas/hofseite-vorschau'

/** Der Name des Parameters — zum Schreiben von Adressen. Gelesen wird er nur in ansichtsModus. */
export const VORSCHAU_PARAMETER = 'vorschau'

/**
 * Der kurze Tipp, wenn jemand in der Vorschau im Rahmen auf die blasse Leiste
 * der Kundschaft tippt (Register N4, Ergänzung Nr. 107; kunde-shell.tsx).
 */
export const VORSCHAU_LEISTE_HINWEIS = 'Vorschau – hier geht es nicht weiter'

/** So lange steht der Tipp, dann geht er von selbst. */
export const VORSCHAU_LEISTE_HINWEIS_MS = 2200

/** Statt „In den Warenkorb" — im Vorschau-Modus wird nichts bestellt und kein Korb angelegt. */
export const VORSCHAU_KAUF_HINWEIS = 'Vorschau — hier wird nichts bestellt'

/**
 * Ob die Hofseite überhaupt einen Warenkorb führen darf. EINE Regel für
 * jeden Weg in den Korb — Kaufknopf, Nachbestell-Link, #warenkorb-Anker,
 * Korb-Knopf und Sheet (product-grid.tsx). Der Bearbeitungsmodus des Hofs
 * kennt keinen Korb; ob Kaufen überhaupt wirkt, sagt `ansichtsModus` —
 * in der Vorschau nie, denn ein Korb reserviert Bestand.
 */
export function korbErlaubt(lage: { isEditMode: boolean; kaufen: boolean }): boolean {
  return !lage.isEditMode && lage.kaufen
}

/**
 * Die Markierungs-Nachricht des Editors, aus dem Ereignis der Vorschau
 * gelesen: nur vom eigenen Ursprung und nur in der vereinbarten Form, sonst
 * null. Eine fremde Seite im Browser kann jedem Fenster Nachrichten schicken.
 */
export function leseMarkierung(ereignis: { origin: string; data: unknown }, eigenerUrsprung: string): HofseiteZeileId | null {
  if (ereignis.origin !== eigenerUrsprung) return null
  const gelesen = markierungSchema.safeParse(ereignis.data)
  return gelesen.success ? gelesen.data.abschnitt : null
}

/**
 * Die Bereit-Meldung der Hofseite im Rahmen, aus dem Ereignis des Editors
 * gelesen — dieselbe Vorsicht wie bei der Markierung: nur der eigene Ursprung,
 * nur die vereinbarte Form.
 */
export function leseBereit(ereignis: { origin: string; data: unknown }, eigenerUrsprung: string): boolean {
  if (ereignis.origin !== eigenerUrsprung) return false
  return bereitSchema.safeParse(ereignis.data).success
}

/**
 * Ob ein Klick auf einen Link die Hofseite im Rahmen verlässt — dann öffnet
 * die Vorschau ihn in einem neuen Tab, weil die Zielseite sich nicht einbetten
 * lässt (X-Frame-Options DENY). Bleibt: ein Link, der ohnehin einen neuen Tab
 * öffnet; tel:, mailto: und alles, was nicht http(s) ist (das regelt der
 * Browser); Anker und andere Bereiche derselben Seite (`#fotos`,
 * `?bereich=futter`); eine Adresse, die sich nicht lesen lässt.
 */
export function verlaesstRahmen(link: { href: string; target: string }, hier: string): boolean {
  if (link.target === '_blank') return false
  let ziel: URL
  let jetzt: URL
  try {
    ziel = new URL(link.href, hier)
    jetzt = new URL(hier)
  } catch {
    return false
  }
  if (ziel.protocol !== 'http:' && ziel.protocol !== 'https:') return false
  return ziel.origin !== jetzt.origin || ziel.pathname !== jetzt.pathname
}

/** Das Gerät, das die Vorschau nachstellt — der Umschalter im Editor (DESIGN_SYSTEM „Vorschau im Hofbereich"). */
export type VorschauGeraet = 'handy' | 'web'

/** Breite der Kundenseite je Gerät in CSS-Pixeln: Handy rendert ihr Handy-Layout, Web das Browser-Layout der Mockups. */
export const VORSCHAU_SEITENBREITE: Record<VorschauGeraet, number> = { handy: 390, web: 1440 }

/** Die Höhe eines Handy-Bildschirms in der Vorschau — der Rahmen zeigt genau diesen Ausschnitt. */
export const VORSCHAU_HANDY_HOEHE = 844

/** Ab dieser Fensterbreite passt die Web-Vorschau neben die Bearbeitung (useMindestbreite); darunter öffnet „Web" das Overlay. */
export const VORSCHAU_WEB_MINDESTBREITE = 1280

/** So schmal darf die Bearbeitung neben der Web-Vorschau werden — die Vorschau nimmt den Rest der Breite, bis die Seite ganz hineinpasst (`editorSpalten`). */
export const VORSCHAU_BEARBEITUNG_BREITE = 400

/**
 * Der Editor — Liste und Vorschau zusammen — ist nie breiter als das. Auf
 * größeren Bildschirmen steht er zentriert, der Rest bleibt links und rechts
 * leer (Register N7): Sonst bliebe rechts der Web-Vorschau Leere bzw. würde die
 * Liste neben der Handy-Vorschau so breit, dass keine Zeile mehr lesbar ist.
 */
export const EDITOR_BREITE_MAX = 2000

/** Der Zwischenraum zwischen Liste und Vorschau. */
export const EDITOR_ABSTAND = 32

/** Neben der Web-Vorschau ist die Liste höchstens so breit (mindestens `VORSCHAU_BEARBEITUNG_BREITE`). */
export const EDITOR_LISTE_WEB_MAX = 560

/**
 * So breit wird die Web-Vorschau höchstens: nie breiter als die Seite, und so,
 * dass bei voller Editorbreite die breiteste Liste daneben passt (2 000 − 32 −
 * 560 = 1 408). Ohne die zweite Grenze nahm die Vorschau 1 440 und ließ der
 * Liste höchstens 528 — EDITOR_LISTE_WEB_MAX griff nie (Nacharbeit Nr. 73 in Nr. 75).
 */
const VORSCHAU_WEB_MAX = Math.min(VORSCHAU_SEITENBREITE.web, EDITOR_BREITE_MAX - EDITOR_ABSTAND - EDITOR_LISTE_WEB_MAX)

/** Neben der Handy-Vorschau ist die Liste höchstens so breit — breitere Zeilen lesen sich nicht mehr. */
export const EDITOR_LISTE_HANDY_MAX = 720

/** Die Spalte der Handy-Vorschau: 320 px, ab `VORSCHAU_WEB_MINDESTBREITE` (Tailwind xl) 360 px. */
export const EDITOR_HANDY_SPALTE = 320
export const EDITOR_HANDY_SPALTE_BREIT = 360

/** Die Breiten der beiden Spalten des Editors in CSS-Pixeln. */
export type EditorSpalten = { liste: number; vorschau: number }

/**
 * Wie breit Liste und Vorschau sind, wenn dem Editor `gesamtbreite` zur
 * Verfügung steht — EINE Regel für beide Geräte (Register N7):
 *
 * - Mehr als `EDITOR_BREITE_MAX` nutzt der Editor nie.
 * - Web: Die Vorschau bekommt, was neben der schmalsten Liste frei bleibt, nie
 *   mehr als `VORSCHAU_WEB_MAX` (1 408 px: die Seite ist 1 440 breit, aber bei
 *   voller Breite soll die Liste ihre 560 px haben); die Liste bekommt den Rest,
 *   mindestens 400 und höchstens 560 px. Beides zusammen füllt die
 *   Gesamtbreite.
 * - Handy: Die Vorschau hat ihre feste Spalte; die Liste bekommt den Rest,
 *   höchstens 720 px. Das Paar steht zentriert, der Rest bleibt links und rechts.
 *
 * `breit` sagt, ob das Fenster mindestens `VORSCHAU_WEB_MINDESTBREITE` breit ist
 * — das weiß nur der Browser, die Spalte der Handy-Vorschau wächst dort auf 360 px.
 */
export function editorSpalten(gesamtbreite: number, modus: VorschauGeraet, breit = false): EditorSpalten {
  const gesamt = Math.min(gesamtbreite, EDITOR_BREITE_MAX)
  if (modus === 'web') {
    const vorschau = Math.min(VORSCHAU_WEB_MAX, Math.max(0, gesamt - EDITOR_ABSTAND - VORSCHAU_BEARBEITUNG_BREITE))
    const liste = Math.min(EDITOR_LISTE_WEB_MAX, Math.max(VORSCHAU_BEARBEITUNG_BREITE, gesamt - EDITOR_ABSTAND - vorschau))
    return { liste, vorschau }
  }
  const vorschau = breit ? EDITOR_HANDY_SPALTE_BREIT : EDITOR_HANDY_SPALTE
  return { liste: Math.min(EDITOR_LISTE_HANDY_MAX, Math.max(0, gesamt - EDITOR_ABSTAND - vorschau)), vorschau }
}

/**
 * Der Maßstab, mit dem die Seite in einen Rahmen passt — berechnet aus der
 * Rahmenbreite, nie hart codiert; nie größer als 1 (eine Seite wird nicht
 * aufgeblasen). Für das Handy zählt auch die Höhe, wenn der Rahmen eine hat
 * (Overlay); die Web-Seite scrollt im Rahmen und braucht keine.
 */
export function vorschauMassstab(rahmen: { breite: number; hoehe?: number }, geraet: VorschauGeraet): number {
  if (rahmen.breite <= 0) return 1
  let massstab = Math.min(1, rahmen.breite / VORSCHAU_SEITENBREITE[geraet])
  if (geraet === 'handy' && rahmen.hoehe !== undefined && rahmen.hoehe > 0) {
    massstab = Math.min(massstab, rahmen.hoehe / VORSCHAU_HANDY_HOEHE)
  }
  return massstab
}

/**
 * Die Adresse der Vorschau zu einem Hof — für „In neuem Tab öffnen". Wer eine
 * Vorschau-Adresse braucht, nimmt diese oder `vorschauAdresse`; die Konstante
 * selbst steht nur hier und in ansichtsModus (tests/hofseite-einmal.test.ts).
 */
export function vorschauLink(slug: string, unterseite?: string): string {
  // Eine Unterseite des Hofs (die Produktseite, Nr. 11) bleibt in der Vorschau:
  // Der Lader dort fragt ansichtsModus wie die Hofseite.
  return `/${slug}${unterseite ? `/${unterseite}` : ''}?${VORSCHAU_PARAMETER}=1`
}

/** Die Adresse der Vorschau im Editor-Rahmen — `stand` erzwingt ein Neuladen nach dem Speichern. */
export function vorschauAdresse(slug: string, stand: number): string {
  return `${vorschauLink(slug)}&stand=${stand}`
}
