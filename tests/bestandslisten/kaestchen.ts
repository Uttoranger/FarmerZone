/*
 * Bestandsliste der Kästchen-Wache (tests/kaestchen-wache.test.ts, A-8, Morgenbericht 32 A, freigegeben 7.11.2026;
 * Nr. 269): Dateien unter src/, die heute noch ein eigenes `<input type="checkbox">` zeichnen statt des Bausteins
 * `Kaestchen` (src/components/ui/kaestchen.tsx). Startbestand beim Start von Nr. 269: 20 Dateien laut
 * `git grep -l 'type="checkbox"' src/`.
 *
 * Die Liste darf nur schrumpfen: Umgestellt wird nur in Nummern, die die Datei ohnehin ändern, und nur
 * verhaltensgleich (A-8: übermittelter Wert vor und nach dem Klick gleich, Test vorher und nachher). Lässt sich
 * ein Kästchen nicht verhaltensgleich umstellen, bleibt die Datei hier stehen.
 */
export const KAESTCHEN_BESTAND: readonly string[] = [
  'src/app/(public)/widerruf/widerruf-formular.tsx',
  'src/app/admin/bestellungen/page.tsx',
  'src/app/admin/betrieb/mails-alle.tsx',
  'src/app/admin/betrieb/protokoll-ansicht.tsx',
  'src/app/admin/einrichten/ersatzcodes-anzeige.tsx',
  'src/app/admin/postfach/rundschreiben-formular.tsx',
  'src/app/admin/postfach/team-antwort.tsx',
  'src/components/admin/gruendung-ausnehmen-dialog.tsx',
  'src/components/admin/gruendung-bis-dialog.tsx',
  'src/components/admin/heute-routine.tsx',
  'src/components/admin/hof-akte-plattformgebuehr.tsx',
  'src/components/admin/postfach-zustellung.tsx',
  'src/components/admin/startseite-block-formular.tsx',
  'src/components/admin/testhof-dialog.tsx',
  'src/components/checkout/checkout-form.tsx',
  'src/components/hof-bestellungen/bestell-detail.tsx',
  'src/components/products/product-dialog.tsx',
  'src/components/products/ruecktritt-felder.tsx',
  'src/components/produkte/familien-teile.tsx',
  'src/components/produkte/futter-formular.tsx',
]
