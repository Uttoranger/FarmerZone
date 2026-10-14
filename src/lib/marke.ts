/**
 * Der Name der Plattform (Register M1) — die EINE Stelle im Code, an der er
 * steht. Seitentitel, Wortmarke, Manifest, Mails, Teilen-Bild, Rechtstexte und
 * Hilfetexte nehmen ihn von hier; „bei MARKE" liest sich wie jeder Name.
 *
 * Nicht verwechseln mit der Marke als Zustandswort (src/lib/marke-art.ts,
 * Register G5) — das ist ein Baustein der Oberfläche, kein Name.
 *
 * Die Domain steht getrennt an ihrer eigenen einen Stelle (PRODUKTION_HOST in
 * src/lib/umgebung.ts), Adressen wie support@ leiten sich daraus ab. Repo- und
 * Vercel-Projektname bleiben technische Namen und folgen dem Namen nicht.
 * tests/marke-name-wache.test.ts schlägt an, sobald der Name anderswo als
 * Literal steht — auch in Tests (dort MARKE importieren).
 */
export const MARKE = 'Agrilo'

/** Absender im Postfach und in Texten, die vom Team sprechen („Agrilo-Team"). */
export const MARKE_TEAM = `${MARKE}-Team`
