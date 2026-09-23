/**
 * Dual-Use-Hinweis im Produktformular (Sprint Bereiche 1, Konzept 2.5 und 6.1).
 *
 * Mais als Lebensmittel und Mais als Futter sind ZWEI Produkte mit zwei
 * Beständen. Legt ein Hof ein Produkt an, das es bei ihm schon in einem
 * anderen Bereich gibt, sagt ihm das Formular, dass hier ein zweites, eigenes
 * Produkt entsteht. Ein Hinweis, kein Fehler, keine Sperre.
 *
 * Rein: Die Server Action liefert die namensgleichen Produkte des EIGENEN
 * Hofs, diese Funktion entscheidet. Gleicher Bereich → kein Hinweis (das ist
 * ein Doppel, kein Dual-Use, und dafür gibt es keine Regel).
 */
import { bereichVon, type Bereich, type ProductCategoryValue } from '@/lib/taxonomie'

const BEREICH_NAME: Record<Bereich, string> = {
  LEBENSMITTEL: 'Lebensmittel',
  FUTTERMITTEL: 'Futtermittel',
  SONSTIGES: 'Sonstiges',
}

/** Ab so vielen Zeichen lohnt die Abfrage — wie die Mindestlänge des Namens im Schema. */
export const DUAL_USE_MIN_ZEICHEN = 2

/** Wie lange das Formular nach dem letzten Tastendruck wartet, bevor es fragt. */
export const DUAL_USE_VERZOEGERUNG_MS = 400

/** Gleicher Name heißt: gleich nach Trimmen, ohne Groß- und Kleinschreibung. */
export function normiereProduktname(name: string): string {
  return name.trim().toLocaleLowerCase('de')
}

export function dualUseHinweis(
  eingabe: { name: string; category: ProductCategoryValue | null },
  vorhandene: ReadonlyArray<{ name: string; category: ProductCategoryValue | null }>
): string | null {
  // Ohne Kategorie gibt es noch keinen Bereich, gegen den man vergleichen könnte.
  if (eingabe.category == null) return null
  const gesucht = normiereProduktname(eingabe.name)
  if (gesucht.length < DUAL_USE_MIN_ZEICHEN) return null
  const bereich = bereichVon(eingabe.category)

  const treffer = vorhandene.find(
    (p) => normiereProduktname(p.name) === gesucht && bereichVon(p.category) !== bereich
  )
  if (!treffer) return null
  return `Du hast schon ein Produkt namens ${treffer.name.trim()} im Bereich ${
    BEREICH_NAME[bereichVon(treffer.category)]
  }. Das hier wird ein zweites, eigenes Produkt mit eigenem Bestand.`
}
