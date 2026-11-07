/*
 * Der Zeitpunkt in der Eingangsbestätigung auf /widerruf, wie das Board
 * s3-/w3-widerruf Bild 4 ihn schreibt: „Mi, 3. März 2027, 19:40“ — mit
 * Wochentag, ohne „Uhr“ (V9; Liste Lauf 32, widerruf „Datum ohne Wochentag,
 * mit ‚Uhr‘“). Nur die Anzeige der Seite: Mails und Admin behalten
 * `eingangZeitpunkt` aus src/lib/widerruf.ts (dort steht der Wortlaut nach
 * N39, der nicht angefasst wird). Wiener Zeit wie überall.
 */
const ZONE = 'Europe/Vienna'

export function eingangZeitpunktSeite(am: Date): string {
  const wochentag = am.toLocaleDateString('de-AT', { weekday: 'short', timeZone: ZONE }).replace(/\.$/, '')
  const datum = am.toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONE })
  const zeit = am.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', timeZone: ZONE })
  return `${wochentag}, ${datum}, ${zeit}`
}
