/*
 * Bestandsliste der Werkzeug-Kopf-Wache (tests/werkzeug-kopf-wache.test.ts, G1, Nr. 245): Dateien unter
 * src/, die heute noch den alten Kopf `UnterseitenKopf` bzw. seine Ladeansicht `UnterseitenKopfLaden`
 * rendern oder unterseiten-kopf.tsx importieren.
 *
 * Die Liste darf nur schrumpfen: Jede Seiten-Nummer stellt ihre Route auf `WerkzeugKopf`
 * (ui/werkzeug-kopf.tsx) um und nimmt die Datei heraus. Ist die Liste leer, löscht der Dirigent im
 * Sammel-PR unterseiten-kopf.tsx und unterseiten-kopf-stil.ts (Auftrag Lauf 32, G1).
 */
export const UNTERSEITEN_KOPF_BESTAND: readonly string[] = [
  'src/app/(hof)/fehler-melden/page.tsx',
  'src/app/(hof)/postfach/[id]/loading.tsx',
  'src/app/(hof)/postfach/[id]/page.tsx',
  'src/components/hof-einstellungen/einstellungen-laden.tsx',
  'src/components/hof-einstellungen/konditionen-ansicht.tsx',
  'src/components/hof-hilfe/hilfe-laden.tsx',
  'src/components/hof-kunden/kunden-detail.tsx',
  'src/components/hof-kunden/kunden-laden.tsx',
  'src/components/hofbereich/hof-laden.tsx',
]
