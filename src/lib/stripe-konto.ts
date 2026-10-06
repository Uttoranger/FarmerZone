/**
 * Wann das Stripe-Konto eines Hofs Online-Zahlungen tragen kann — EINE Regel
 * für alle, die `Farm.stripeAccountReady` schreiben: die Rückkehr aus dem
 * Onboarding (api/stripe/return), „Status prüfen" (actions/stripe-connect.ts)
 * und das Ereignis `account.updated` (api/stripe/webhook).
 *
 * Vorher galt beim Onboarding `charges_enabled && details_submitted`. Zwei
 * Regeln an zwei Stellen hätten den Wert je nach Schreiber hin- und
 * herspringen lassen. Fachlich festgelegt: Das Konto muss Zahlungen annehmen
 * UND auszahlen dürfen.
 *
 * Rein, ohne Stripe-SDK (tests/stripe-konto.test.ts).
 */
export function stripeKontoBereit(konto: {
  charges_enabled?: boolean | null
  payouts_enabled?: boolean | null
}): boolean {
  return konto.charges_enabled === true && konto.payouts_enabled === true
}

/**
 * Der Hof will online kassieren, hat ein Stripe-Konto, aber Stripe lässt es
 * gerade nicht zu (Angaben fehlen, Konto gesperrt oder in Prüfung). Dann
 * bietet der Checkout Online nicht an, und Heute zeigt den Hinweis mit dem Weg
 * zu Stripe.
 *
 * NUR MIT KONTO: `acceptsOnline` steht für jeden neuen Hof vorbelegt auf true.
 * Ohne die Bedingung stünde „pausiert" ab Tag eins bei jedem Hof, der Stripe
 * nie eingerichtet hat — dafür hat die Erste-Schritte-Karte ihren eigenen
 * Schritt „Online-Zahlung einrichten".
 */
export function onlineZahlungPausiert(hof: {
  acceptsOnline: boolean
  stripeAccountReady: boolean
  stripeAccountId: string | null
}): boolean {
  return hof.acceptsOnline && !hof.stripeAccountReady && hof.stripeAccountId !== null
}

/**
 * Antwort des Checkouts, wenn Stripe den Zahlungsvorgang nicht anlegen
 * konnte — Code für den Browser, Satz für die Kundin.
 */
export const CODE_ZAHLUNG_NICHT_MOEGLICH = 'ZAHLUNG_NICHT_MOEGLICH'

export function zahlungNichtMoeglichText(barMoeglich: boolean): string {
  return barMoeglich
    ? 'Online-Zahlung ist gerade nicht möglich. Bitte versuch es später oder wähle Barzahlung.'
    : 'Online-Zahlung ist gerade nicht möglich. Bitte versuch es später noch einmal.'
}

/**
 * Der Hinweis auf Heute als Titel und Satz für die Hinweiskarte (Mockup
 * „Online-Zahlung pausiert", Nachtlauf Nr. 17), ohne Fachbegriffe. Ohne
 * Barzahlung gibt es keinen Ausweg für die Kunden; dann darf der Satz ihn
 * nicht versprechen.
 */
export function onlinePausiertHinweis(barMoeglich: boolean): { titel: string; satz: string } {
  return {
    titel: 'Online-Zahlung ist pausiert',
    satz: barMoeglich
      ? 'Stripe braucht noch Angaben von dir. Bis dahin können Kunden nur bar bei Abholung bestellen.'
      : 'Stripe braucht noch Angaben von dir. Bis dahin können Kunden bei dir nicht bestellen.',
  }
}
