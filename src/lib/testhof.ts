/**
 * Der Hinweis auf einem Testhof (Register N21; Nachtlauf Nr. 207, Auftrag
 * Punkt 3): EINE Quelle für Hofseite, Produktseite und Kasse. Ein Testhof
 * (Farm.istTesthof) ist nur zum Ausprobieren; wer ihn per Link öffnet, soll
 * oben sehen, dass dort keine echte Ware verkauft wird. Für echte Höfe steht
 * nichts. Bestellen bleibt möglich — Testbestellungen sind der Zweck.
 */
import { MARKE } from '@/lib/marke'

/** Wortlaut des Auftrags 207 (Name aus MARKE, Register M1). */
export const TESTHOF_HINWEIS = `Testhof von ${MARKE} – Bestellungen hier sind Testbestellungen, es gibt keine Ware.`

/** Zeigt die Seite den Hinweis? Nur bei einem Testhof — eine Regel für alle drei Seiten. */
export function zeigtTesthofHinweis(farm: { istTesthof: boolean }): boolean {
  return farm.istTesthof === true
}
