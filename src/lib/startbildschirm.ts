/**
 * Die Karte „Leg FarmerZone auf den Startbildschirm" ganz unten auf Heute
 * (Register N1, Nachtlauf Nr. 41) — Texte und Regel aus EINER Quelle; die
 * Karte (src/components/heute/startbildschirm-karte.tsx) zeigt nur an.
 *
 * Das Manifest (src/app/manifest.ts) macht FarmerZone schon installierbar und
 * startet auf /dashboard; die Karte erklärt nur, wie man es tut. Gespeichert
 * wird nichts im Browser (Register T1) — wer die App installiert hat, sieht
 * die Karte dort von selbst nicht mehr.
 */

export type Anleitung = {
  geraet: string
  /** Genau zwei Sätze. */
  saetze: readonly [string, string]
}

export const STARTBILDSCHIRM_KARTE: { titel: string; anleitungen: readonly Anleitung[] } = {
  titel: 'Mit einem Tipp in deinem Hof: Leg FarmerZone auf den Startbildschirm',
  anleitungen: [
    {
      geraet: 'iPhone',
      saetze: [
        'Öffne FarmerZone in Safari und tippe auf „Teilen“ – das Viereck mit dem Pfeil nach oben.',
        'Wähle „Zum Home-Bildschirm“ und tippe auf „Hinzufügen“.',
      ],
    },
    {
      geraet: 'Android',
      saetze: [
        'Öffne FarmerZone in Chrome und tippe oben rechts auf die drei Punkte.',
        'Wähle „Zum Startbildschirm hinzufügen“ oder „App installieren“ und bestätige.',
      ],
    },
  ],
}

/**
 * Ob FarmerZone als installierte App läuft: vom Startbildschirm geöffnet
 * (`display-mode: standalone`, wie das Manifest es verlangt) oder auf dem
 * iPhone über `navigator.standalone`, das ältere iOS-Versionen statt der
 * Medienabfrage melden. Dann braucht es die Karte nicht.
 */
export function laeuftAlsApp({ standalone, iosStandalone }: { standalone: boolean; iosStandalone?: boolean }): boolean {
  return standalone || iosStandalone === true
}
