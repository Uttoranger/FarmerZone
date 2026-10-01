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
 * Der Hof will online kassieren, aber Stripe lässt es gerade nicht zu (Angaben
 * fehlen, Konto in Prüfung). Dann bietet der Checkout Online nicht an, und
 * Heute zeigt den Hinweis mit dem Weg zu Stripe.
 */
export function onlineZahlungPausiert(hof: { acceptsOnline: boolean; stripeAccountReady: boolean }): boolean {
  return hof.acceptsOnline && !hof.stripeAccountReady
}

/** Der Hinweis auf Heute — ein Satz, ohne Fachbegriffe. */
export const ONLINE_PAUSIERT_TEXT =
  'Online-Zahlung ist pausiert – Stripe braucht noch Angaben von dir. Bis dahin können Kunden nur bar bei Abholung bestellen.'
