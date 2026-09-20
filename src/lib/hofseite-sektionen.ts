/**
 * Sektionen der öffentlichen Hofseite und die Frage, welcher Reiter gerade
 * markiert gehört.
 *
 * Warum als eigene Fachregel statt in der Komponente: Die Reiterleiste und der
 * IntersectionObserver hatten je eine eigene, voneinander abweichende Vorstellung
 * von der Reihenfolge — die Leiste listete Produkte vor Fotos, im Dokument stand
 * Fotos vor Produkte. Ein Tipp auf den letzten Reiter scrollte deshalb nach oben
 * (Meldung cmua8bof). Beide lesen jetzt aus derselben Liste; in der Node-Umgebung
 * der Tests ist das ohne Browser prüfbar.
 */

export type HofsektionId = 'uebersicht' | 'fotos' | 'produkte'

export type Hofsektion = {
  id: HofsektionId
  label: string
}

/** Nur die Sichtbarkeit interessiert hier — strukturell, damit `src/lib` nichts vom Server importiert. */
export type SektionSichtbarkeit = {
  key: string
  visible: boolean
}

/**
 * Reihenfolge der Sprungziele im Dokument. Maßgeblich für Reiterleiste UND
 * Beobachter. Deckt sich mit DEFAULT_SECTIONS in src/server/queries/appearance.ts,
 * wo gallery (4) vor products (5) steht.
 */
const REIHENFOLGE: readonly HofsektionId[] = ['uebersicht', 'fotos', 'produkte']

const LABEL: Record<HofsektionId, string> = {
  uebersicht: 'Übersicht',
  fotos: 'Fotos',
  produkte: 'Produkte',
}

/** Fehlt ein Schlüssel in der Konfiguration, gilt die Sektion als sichtbar — wie isSectionVisible auf der Seite. */
function istSichtbar(sektionen: readonly SektionSichtbarkeit[], key: string): boolean {
  const treffer = sektionen.find((s) => s.key === key)
  return treffer ? treffer.visible : true
}

/**
 * Die Sektionen, die die Hofseite anbietet — in Dokumentreihenfolge.
 *
 * Übersicht und Produkte gibt es immer: Die Produktsektion lässt sich in den
 * Einstellungen gar nicht abschalten, und die Übersicht trägt Kopf und Kontakt.
 * Fotos nur, wenn die Galerie sichtbar geschaltet ist und es überhaupt Fotos gibt —
 * sonst böte die Leiste ein Sprungziel an, das im Dokument fehlt.
 */
export function hofseiteSektionen(
  sektionen: readonly SektionSichtbarkeit[],
  hatFotos: boolean
): readonly Hofsektion[] {
  const zeigeFotos = istSichtbar(sektionen, 'gallery') && hatFotos
  return REIHENFOLGE.filter((id) => id !== 'fotos' || zeigeFotos).map((id) => ({
    id,
    label: LABEL[id],
  }))
}

/**
 * Welcher Reiter gehört markiert?
 *
 * Drei Regeln, in dieser Reihenfolge:
 *  1. Läuft gerade ein Sprung, den jemand angetippt hat, gewinnt dessen Ziel.
 *     Ohne diese Sperre überschreibt der Beobachter unterwegs genau den Reiter,
 *     den die Person eben gedrückt hat — der Unterstrich springt zurück.
 *  2. Sonst der UNTERSTE der gerade sichtbaren Abschnitte. Beim Herunterscrollen
 *     ist das der, in den man hineinfährt. Entscheidend ist die Dokumentreihenfolge,
 *     nicht die Reihenfolge der Beobachter-Einträge: die ist nicht zugesichert.
 *  3. Ist gerade keiner im Erkennungsstreifen (zwischen zwei Abschnitten), bleibt
 *     die bisherige Markierung stehen, statt zu flackern.
 */
export function naechsterAktiverReiter(input: {
  sichtbare: readonly string[]
  reihenfolge: readonly string[]
  bisher: string
  gesperrtAuf?: string | null
}): string {
  const { sichtbare, reihenfolge, bisher, gesperrtAuf } = input

  if (gesperrtAuf && reihenfolge.includes(gesperrtAuf)) return gesperrtAuf

  const imStreifen = reihenfolge.filter((id) => sichtbare.includes(id))
  if (imStreifen.length > 0) return imStreifen[imStreifen.length - 1]

  return bisher
}
