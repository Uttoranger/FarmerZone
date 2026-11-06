/*
 * Bestandsliste der `[&>`-Wache (tests/kind-selektoren-wache.test.ts, Nr. 246): Dateien unter src/, die heute
 * Kind-Selektoren `[&>…]` schreiben (Kommentare zählen nicht), je mit der Zahl der Stellen von heute. Stand
 * Nr. 246: 22 Dateien, wie in der Ausgangslage von freigabe.md §36 gezählt.
 *
 * Die Liste darf nur schrumpfen: Wer einen Baustein von außen umbaut, braucht eine Variante oder ein Prop am
 * Baustein, keine Klassen, die in seine Kinder greifen. Eine Seiten-Nummer nimmt ihre Datei heraus bzw. senkt
 * die Zahl. Mehr Stellen, eine neue Datei oder ein veralteter Eintrag machen die Wache rot. Eigene Datei, damit
 * spätere Nummern die Wache selbst nicht anfassen müssen.
 */
export const KIND_SELEKTOR_BESTAND: Readonly<Record<string, number>> = {
  'src/app/admin/finanzen/kosten-liste.tsx': 2,
  'src/app/admin/geld/monatsabschluss.tsx': 2,
  'src/app/admin/geld/page.tsx': 4,
  'src/components/admin/briefkasten-teile.tsx': 10,
  'src/components/admin/einstellungen-team.tsx': 2,
  'src/components/admin/hoefe-ansicht.tsx': 2,
  'src/components/admin/hof-akte-ansicht.tsx': 4,
  'src/components/admin/hof-akte-plattformgebuehr.tsx': 2,
  'src/components/admin/hof-akte-widerrufe.tsx': 2,
  'src/components/admin/meldungen-teile.tsx': 4,
  'src/components/admin/meldungen-werkzeug.tsx': 2,
  'src/components/auswertung/auswertung-teile.tsx': 2,
  'src/components/bestellungen/bestellungen-ansicht.tsx': 1,
  'src/components/farm/cart-sheet.tsx': 24,
  'src/components/hof-einstellungen/barzahlung.tsx': 2,
  'src/components/hof-einstellungen/einstellungen-uebersicht.tsx': 2,
  'src/components/hof-kunden/kunden-ansicht.tsx': 2,
  'src/components/produkte/wieder-da-moment.tsx': 3,
  'src/components/shells/kunde-shell.tsx': 1,
  'src/components/ui/badge.tsx': 2,
  'src/components/ui/list-row.tsx': 2,
  'src/components/ui/table.tsx': 1,
}
