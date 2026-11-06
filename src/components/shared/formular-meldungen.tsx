import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/** Die Kennung des Satzes unter einem Feld – Feld und Satz verbindet `aria-describedby`. */
export function fehlerKennung(feldId: string): string {
  return `${feldId}-fehler`
}

/** Die Kennung der Hilfe unter einem Feld. */
export function hilfeKennung(feldId: string): string {
  return `${feldId}-hilfe`
}

/**
 * Die Attribute, die ein Feld mit seinem Fehlersatz verbinden (Nr. 174, WCAG
 * 3.3.1): `aria-invalid` und `aria-describedby` auf Fehler und – wenn da – Hilfe.
 */
export function feldFehlerAttribute(
  feldId: string,
  hatFehler: boolean,
  hatHilfe = false
): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  const ids = [hatFehler ? fehlerKennung(feldId) : null, hatHilfe ? hilfeKennung(feldId) : null].filter(Boolean)
  return {
    ...(hatFehler ? { 'aria-invalid': true as const } : {}),
    ...(ids.length > 0 ? { 'aria-describedby': ids.join(' ') } : {}),
  }
}

/**
 * Der Fehlersatz unter einem Feld: orange (Register O1), `role="alert"`, damit
 * ihn der Screenreader beim Erscheinen vorliest. Ohne Text nichts. Seit Nr. 246
 * (G6; Boards s2-passwort, s2-hofdaten-zahlung) in Fließtextgröße fett — 14 px
 * halbfett wie in `FeldMitFehler`, nicht mehr 12 px.
 */
export function FeldFehlerSatz({ feldId, text, className }: { feldId: string; text?: string | null; className?: string }): React.JSX.Element | null {
  if (!text) return null
  return (
    <p id={fehlerKennung(feldId)} role="alert" className={cn('mt-1 text-[14px] leading-snug font-semibold text-status-offen', className)}>
      {text}
    </p>
  )
}

/**
 * Die Zusammenfassung über einem Formular mit Feldfehlern (G6, Nr. 246; Boards s2-hofdaten-zahlung
 * „Bitte prüfe das markierte Feld.", s1-produkt-neu „Bitte prüfe die markierten Felder."): ein Feld
 * in der Einzahl, mehrere in der Mehrzahl. Gezählt wird, was das Schema beim Absenden meldet.
 */
export function formularPruefenSatz(anzahl: number): string {
  return anzahl === 1 ? FORMULAR_PRUEFEN_EIN : FORMULAR_PRUEFEN_MEHR
}

/** Die Zusammenfassung bei genau einem Feldfehler (Liste Lauf 32, G6). */
export const FORMULAR_PRUEFEN_EIN = 'Bitte prüfe das markierte Feld.'
/** Die Zusammenfassung bei mehreren Feldfehlern (Board s1-produkt-neu Bild 5). */
export const FORMULAR_PRUEFEN_MEHR = 'Bitte prüfe die markierten Felder.'

/**
 * Die Zeile über dem Formular, solange Felder markiert sind (G6): Fläche und Schrift aus dem Paar
 * „tun", 14 px halbfett, `RUNDUNG.hinweis`, `role="alert"`. Ohne Fehler nichts. Der Fokus springt
 * nicht hierher, sondern ins erste Fehlerfeld (`fokussiereErstesFehlerfeld`).
 */
export function FormularPruefen({ anzahl, className }: { anzahl: number; className?: string }): React.JSX.Element | null {
  if (anzahl <= 0) return null
  return (
    <p
      role="alert"
      data-slot="formular-pruefen"
      className={cn('bg-zustand-tun-grund px-3 py-2.5 text-[14px] font-semibold text-zustand-tun', RUNDUNG.hinweis, className)}
    >
      {formularPruefenSatz(anzahl)}
    </p>
  )
}

/**
 * Setzt den Fokus ins erste Feld mit `aria-invalid` im Formular (G6: „Fokus ins erste Fehlerfeld") —
 * nach dem Absenden, wenn das Schema Fehler meldet. Gibt zurück, ob es ein solches Feld gab. Für
 * react-hook-form reicht oft `shouldFocusError`; dieser Griff ist für Formulare ohne es (eigene
 * Prüfung, `FeldMitFehler`) und sucht in der Reihenfolge des Dokuments.
 */
export function fokussiereErstesFehlerfeld(formular: ParentNode | null): boolean {
  const feld = formular?.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (!feld) return false
  feld.focus()
  return true
}

/**
 * Ein Speicherfehler, der kein Feld betrifft: der Fehlerkasten am Formular statt eines Toasts
 * (DESIGN_SYSTEM, „Zustände"). Scheiterte der Aufruf am Netz (`nochmal`), steht der Knopf „Nochmal"
 * darunter (Register N29) – die Eingabe bleibt stehen, ein Tipp wiederholt das Speichern. Seit Nr. 246
 * (G6) zeichnet ihn `HinweiskarteFehler`: Warnfarbe, „Nochmal" klein und linksbündig mit dem Fokus,
 * nie deaktiviert. Ob „Nochmal" erscheint, entscheidet der Aufrufer (`nochmal`): nie bei
 * NETZ_SATZ_UNSICHER, nie in Verkäufe, nie beim Anlegen eines Produkts.
 */
export function SpeicherFehler({
  text,
  nochmal,
  onNochmal,
  laeuft,
  className,
}: {
  text: string | null | undefined
  nochmal?: boolean
  onNochmal?: () => void
  laeuft?: boolean
  className?: string
}): React.JSX.Element | null {
  if (!text) return null
  return (
    <HinweiskarteFehler className={className} nochmal={nochmal && onNochmal ? onNochmal : undefined} laeuft={laeuft}>
      {text}
    </HinweiskarteFehler>
  )
}
