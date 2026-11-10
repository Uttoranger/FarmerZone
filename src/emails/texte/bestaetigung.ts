/**
 * Die Sätze der Bestätigungsmail „Danke für deine Bestellung!“ (src/emails/order-confirmation.tsx) an EINER Stelle
 * (Nr. 255, DESIGN_SYSTEM „E-Mails“). Nicht hier: AGB-Zeile (MAIL_AGB_ZEILE), Belehrung, Muster-Formular und
 * „Vertrag widerrufen“ (src/lib/widerruf.ts, N39), der 5-b-Satz (Nr. 214) und der Gebührensatz (konditionen.ts).
 */
export type BestaetigungZahlart = 'online' | 'bar' | 'karte'

export const BESTAETIGUNG_TEXT = {
  titel: 'Danke für deine Bestellung!',
  vorschauzeile: (nummer: string, abholung: string) => `Bestellung ${nummer} – Abholung ${abholung}`,
  satz: (zahlart: BestaetigungZahlart, hof: string) =>
    zahlart === 'online' ? `Deine Zahlung ist angekommen – ${hof} packt deine Sachen.` : `Deine Bestellung ist bestätigt – ${hof} packt deine Sachen.`,
  nenneNummer: 'Nenn bei der Abholung einfach deine Bestellnummer:',
  gesamt: { online: 'Online bezahlt', bar: 'Bar bei Abholung', karte: 'Karte bei Abholung' } satisfies Record<BestaetigungZahlart, string>,
  /** „Bring bitte <Betrag fett> in bar mit.“ — Anfang und Ende um den fetten Betrag. */
  barMitbringen: ['Bring bitte ', ' in bar mit.'] as const,
  karteZahlen: ['Bitte zahle ', ' bei der Abholung mit Karte.'] as const,
  knopfBestellung: 'Bestellung ansehen',
  knopfRoute: 'Route planen',
  fragen: 'Fragen? Ruf direkt beim Hof an: ',
} as const
