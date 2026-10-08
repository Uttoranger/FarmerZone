/**
 * Die eine Regel für `Farm.stripeAccountReady` (src/lib/stripe-konto.ts) und
 * wann Heute den Hinweis „Online-Zahlung ist pausiert" zeigt. Seit Nr. 42
 * (Register Z2) auch: Woran erkennt die App ein Hof-Konto, das Stripe nicht
 * kennt — und was lesen Kundin und Hof dann.
 */
import { describe, it, expect } from 'vitest'
import Stripe from 'stripe'
import {
  NEU_EINRICHTEN_KURZ,
  NEU_EINRICHTEN_SATZ,
  NEU_EINRICHTEN_TITEL,
  hofKontoUnbekanntText,
  istUnbekanntesStripeKonto,
  onlinePausiertHinweis,
  onlineZahlungPausiert,
  stripeKontoBereit,
  zahlungNichtMoeglichText,
} from '@/lib/stripe-konto'

describe('stripeKontoBereit', () => {
  it('nur wenn Zahlungen UND Auszahlungen frei sind', () => {
    expect(stripeKontoBereit({ charges_enabled: true, payouts_enabled: true })).toBe(true)
    expect(stripeKontoBereit({ charges_enabled: false, payouts_enabled: true })).toBe(false)
    expect(stripeKontoBereit({ charges_enabled: true, payouts_enabled: false })).toBe(false)
  })

  it('fehlende Angaben zählen als nicht bereit', () => {
    expect(stripeKontoBereit({})).toBe(false)
    expect(stripeKontoBereit({ charges_enabled: true, payouts_enabled: null })).toBe(false)
  })
})

describe('onlineZahlungPausiert', () => {
  const konto = 'acct_platzhalter'

  it('nur wenn der Hof online kassieren will, ein Konto hat und Stripe es nicht zulässt', () => {
    expect(onlineZahlungPausiert({ acceptsOnline: true, stripeAccountReady: false, stripeAccountId: konto })).toBe(true)
    expect(onlineZahlungPausiert({ acceptsOnline: true, stripeAccountReady: true, stripeAccountId: konto })).toBe(false)
    expect(onlineZahlungPausiert({ acceptsOnline: false, stripeAccountReady: false, stripeAccountId: konto })).toBe(false)
  })

  it('ein neuer Hof ohne Stripe-Konto ist nicht „pausiert" — dafür gibt es den Erste-Schritte-Schritt', () => {
    expect(onlineZahlungPausiert({ acceptsOnline: true, stripeAccountReady: false, stripeAccountId: null })).toBe(false)
  })
})

describe('Texte — Barzahlung nur versprechen, wenn es sie gibt', () => {
  it('Hinweis auf Heute', () => {
    // Seit Nr. 17 als Titel und Satz der Hinweiskarte (onlinePausiertHinweis).
    expect(onlinePausiertHinweis(true).satz).toContain('nur bar bei Abholung')
    expect(onlinePausiertHinweis(false).satz).not.toContain('bar')
  })

  it('Antwort des Checkouts', () => {
    expect(zahlungNichtMoeglichText(true)).toBe(
      'Online-Zahlung ist gerade nicht möglich. Bitte versuch es später oder wähle Barzahlung.'
    )
    expect(zahlungNichtMoeglichText(false)).not.toContain('Barzahlung')
  })
})

// ─── Hof-Konto, das Stripe nicht kennt (Register Z2, Nr. 42) ───────────────

/** So baut das SDK einen Fehler aus Stripes Antwort — erfundene Kennungen, kein Netz. */
const stripeFehler = (raw: { code?: string; message: string; param?: string; statusCode: number }) =>
  new Stripe.errors.StripeInvalidRequestError({ type: 'invalid_request_error', ...raw })

describe('istUnbekanntesStripeKonto', () => {
  it('erkennt resource_missing — etwa ein Test-Konto nach der Live-Umstellung', () => {
    const fehler = stripeFehler({
      code: 'resource_missing',
      message: "No such account: 'acct_erfunden'; a similar object exists in test mode, but a live mode key was used to make this request.",
      statusCode: 404,
    })
    expect(istUnbekanntesStripeKonto(fehler)).toBe(true)
  })

  it('erkennt das unbekannte Zielkonto eines PaymentIntents', () => {
    const fehler = stripeFehler({
      code: 'resource_missing',
      message: "No such destination: 'acct_erfunden'",
      param: 'transfer_data[destination]',
      statusCode: 400,
    })
    expect(istUnbekanntesStripeKonto(fehler)).toBe(true)
  })

  it('erkennt „No such account" auch ohne Code', () => {
    expect(istUnbekanntesStripeKonto(stripeFehler({ message: "No such account: 'acct_erfunden'", statusCode: 404 }))).toBe(true)
    expect(istUnbekanntesStripeKonto({ message: "No such account: 'acct_erfunden'" })).toBe(true)
  })

  it('Gegenprobe: Ausfall, Doppelklick, Sperre und andere Stripe-Fehler sind kein unbekanntes Konto', () => {
    expect(istUnbekanntesStripeKonto(new Error('Stripe nicht erreichbar'))).toBe(false)
    expect(istUnbekanntesStripeKonto(Object.assign(new Error('another in-progress request'), { statusCode: 409 }))).toBe(false)
    expect(
      istUnbekanntesStripeKonto(stripeFehler({ code: 'parameter_invalid_integer', message: 'Invalid integer', statusCode: 400 }))
    ).toBe(false)
    expect(istUnbekanntesStripeKonto(new Error('Stripe startet nicht: Die Vorschau läuft mit einem Live-Schlüssel.'))).toBe(false)
  })

  it('Gegenprobe: Unbekanntes ohne Fehlerform', () => {
    expect(istUnbekanntesStripeKonto(null)).toBe(false)
    expect(istUnbekanntesStripeKonto(undefined)).toBe(false)
    expect(istUnbekanntesStripeKonto('resource_missing')).toBe(false)
    expect(istUnbekanntesStripeKonto({ code: 'account_invalid' })).toBe(false)
  })
})

describe('Texte, wenn Stripe das Hof-Konto nicht kennt', () => {
  it('Kundin: Online geht bei diesem Hof gerade nicht — mit Ausweg', () => {
    expect(hofKontoUnbekanntText(true)).toBe(
      'Online-Zahlung ist bei diesem Hof gerade nicht möglich. Bitte wähle Bar bei Abholung.'
    )
    // Kein „versuch es später": Das Konto kommt nicht von selbst zurück.
    expect(hofKontoUnbekanntText(true)).not.toContain('später')
    expect(hofKontoUnbekanntText(false)).not.toContain('Bar')
    expect(hofKontoUnbekanntText(false)).toContain('Hof')
  })

  it('Hof: „Online-Zahlung neu einrichten" mit Satz — ohne Fachwort und ohne Kennung', () => {
    expect(NEU_EINRICHTEN_TITEL).toBe('Online-Zahlung neu einrichten')
    for (const text of [NEU_EINRICHTEN_SATZ, NEU_EINRICHTEN_KURZ]) {
      expect(text).toContain('neu ein')
      expect(text).not.toMatch(/acct_|resource_missing|account/i)
    }
  })
})
