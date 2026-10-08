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

// ─── Hof-Konto, das Stripe nicht kennt (Register Z2, Nachtlauf Nr. 42) ─────

/**
 * Kennt Stripe das gespeicherte Konto eines Hofs nicht (mehr)? Typischer
 * Fall: ein Konto aus dem Testmodus, nachdem die Produktion auf den
 * Live-Schlüssel umgestellt ist — Stripe antwortet dann mit `resource_missing`
 * („No such account" bzw. beim Zielkonto eines PaymentIntents „No such
 * destination").
 *
 * NUR an Stellen fragen, an denen das Hof-Konto die einzige Kennung im Aufruf
 * ist: Zielkonto des PaymentIntents im Checkout, Kontostatus, Einrichtungs-
 * und Login-Link, Rückkehr aus dem Onboarding. Bei einem Aufruf mit
 * PaymentIntent- oder Erstattungs-Kennung meinte derselbe Code etwas anderes.
 *
 * Geprüft wird die Form, nicht die Klasse: So erkennt die Regel auch die
 * Fehler aus den Test-Mocks, und sie bleibt ohne Stripe-SDK.
 */
export function istUnbekanntesStripeKonto(fehler: unknown): boolean {
  if (typeof fehler !== 'object' || fehler === null) return false
  const { code, message } = fehler as { code?: unknown; message?: unknown }
  if (code === 'resource_missing') return true
  return typeof message === 'string' && /\bNo such (account|destination)\b/i.test(message)
}

/**
 * Antwort des Checkouts, wenn Stripe das Konto des Hofs nicht kennt. Kein
 * „versuch es später": Online kommt bei diesem Hof erst zurück, wenn er
 * Stripe neu einrichtet. Ohne Barzahlung verspricht der Satz sie nicht.
 */
export function hofKontoUnbekanntText(barMoeglich: boolean): string {
  return barMoeglich
    ? 'Online-Zahlung ist bei diesem Hof gerade nicht möglich. Bitte wähle Bar bei Abholung.'
    : 'Online-Zahlung ist bei diesem Hof gerade nicht möglich. Frag am besten direkt beim Hof nach.'
}

/** Was der Hof sieht (Einstellungen → Zahlung): Titel und Satz der Hinweiskarte, Knopf. */
export const NEU_EINRICHTEN_TITEL = 'Online-Zahlung neu einrichten'
export const NEU_EINRICHTEN_SATZ =
  'Stripe kennt dein bisheriges Konto nicht mehr. Richte die Online-Zahlung bitte neu ein – das dauert etwa 10 Minuten. ' +
  'Bis dahin bieten wir deinen Kundinnen nur Barzahlung an.'
/** Die Marke an der Karte „Online-Zahlung (Stripe)". */
export const NEU_EINRICHTEN_MARKE = 'Nicht mehr verbunden'
/** Kurzfassung für Stellen außerhalb der Zahlungs-Einstellungen (Verkäufe, Aktionen). */
export const NEU_EINRICHTEN_KURZ =
  'Stripe kennt dein bisheriges Konto nicht mehr. Richte die Online-Zahlung unter Einstellungen → Zahlung neu ein.'
