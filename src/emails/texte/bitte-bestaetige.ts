/**
 * Die Sätze der Mail „Bitte bestätige deine Bestellung“ (src/emails/onsite-confirmation.tsx) an EINER Stelle
 * (Nr. 255, DESIGN_SYSTEM „E-Mails“). Nicht hier: AGB-Zeile (MAIL_AGB_ZEILE, src/lib/rechtstexte), Belehrung
 * und Muster-Formular (BelehrungTeil, src/lib/widerruf.ts), Gebührensatz (konditionen.ts) — Recht bleibt in seiner Quelle.
 */
export const BITTE_BESTAETIGE_TEXT = {
  titel: 'Bitte bestätige deine Bestellung',
  vorschauzeile: (hof: string, abholung: string) => `Bestellung bei ${hof} bestätigen – Abholung ${abholung}`,
  einleitung: 'Erst mit deiner Bestätigung packt der Hof deine Sachen.',
  fristBis: (bis: string) => `Bitte bestätige bis ${bis}.`,
  fristFolge: 'Danach geben wir die Ware wieder frei – ohne Kosten für dich.',
  fristOhneZeit: 'Bitte bestätige bald – sonst geben wir die Ware wieder frei.',
  knopf: 'Bestellung bestätigen',
  gesamt: 'Bar bei Abholung',
} as const
