/**
 * Die Sätze der Mail „Zahlung kam zu spät“ (src/emails/zahlung-zu-spaet.tsx) an EINER Stelle (Nr. 255,
 * DESIGN_SYSTEM „E-Mails“): Wer den Wortlaut ändert, ändert nur diese Datei; die Vorlage setzt nur ein.
 */
export const ZAHLUNG_ZU_SPAET_TEXT = {
  titel: 'Zahlung kam zu spät',
  vorschauzeile: (betrag: string) => `Zurück an dich ${betrag}.`,
  satz: (hof: string) =>
    `Deine Zahlung für deine Bestellung bei ${hof} ist erst angekommen, als die Bestellung schon abgelaufen war. Wir haben dir das Geld sofort zurückgeschickt.`,
  erstattungZeile: 'erscheint in 5–10 Werktagen auf deinem Konto',
  fragen: (supportEmail: string) => `Bei Fragen schreib uns an ${supportEmail}.`,
} as const
