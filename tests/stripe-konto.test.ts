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
  NEU_EINRICHTEN_TITEL,
  hofKontoUnbekanntText,
  istUnbekanntesStripeKonto,
  istUnzugaenglichesStripeKonto,
  NEU_EINRICHTEN_FENSTER_MS,
  neuEinrichtenSatz,
  neuEinrichtenSchluessel,
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

  it('erkennt resource_missing an einem Konto-Parameter — auch mit anderem Wortlaut (Runde 1)', () => {
    for (const param of ['transfer_data[destination]', 'destination', 'account']) {
      expect(istUnbekanntesStripeKonto({ code: 'resource_missing', param, message: 'Unbekannter Wortlaut' }), param).toBe(true)
    }
  })

  it('Gegenprobe (Runde 1): resource_missing allein reicht nicht — es muss das Hof-Konto meinen', () => {
    // Der Fall aus dem Befund: ein unbekannter PaymentIntent, nicht das Konto des Hofs.
    expect(istUnbekanntesStripeKonto({ code: 'resource_missing', param: 'intent', message: "No such payment_intent: 'pi_erfunden'" })).toBe(false)
    expect(
      istUnbekanntesStripeKonto(
        stripeFehler({ code: 'resource_missing', param: 'intent', message: "No such payment_intent: 'pi_erfunden'", statusCode: 404 })
      )
    ).toBe(false)
    expect(istUnbekanntesStripeKonto({ code: 'resource_missing' })).toBe(false)
    expect(istUnbekanntesStripeKonto({ code: 'resource_missing', param: 'charge', message: "No such charge: 'ch_erfunden'" })).toBe(false)
    expect(istUnbekanntesStripeKonto({ code: 'resource_missing', message: "No such refund: 're_erfunden'" })).toBe(false)
    expect(istUnbekanntesStripeKonto({ message: "No such account_link: 'x'" })).toBe(false)
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

describe('istUnzugaenglichesStripeKonto — reine Konto-Aufrufe (Runde 1)', () => {
  /** So antwortet Stripe auf eine Kennung, die nicht zur Plattform gehört — erfunden, ohne Schlüssel. */
  const keinZugriff = () =>
    new Stripe.errors.StripeInvalidRequestError({
      type: 'invalid_request_error',
      code: 'account_invalid',
      message:
        "The provided key does not have access to account 'acct_erfunden' (or that account does not exist). Application access may have been revoked.",
      statusCode: 403,
    })

  it('wertet den Zugriffsfehler als „Konto unbekannt" — mit Code oder nur am Wortlaut', () => {
    expect(istUnzugaenglichesStripeKonto(keinZugriff())).toBe(true)
    expect(istUnzugaenglichesStripeKonto({ code: 'account_invalid' })).toBe(true)
    expect(
      istUnzugaenglichesStripeKonto({ message: "The provided key does not have access to account 'acct_erfunden' (or that account does not exist)." })
    ).toBe(true)
  })

  it('kennt alles, was istUnbekanntesStripeKonto kennt', () => {
    expect(istUnzugaenglichesStripeKonto({ message: "No such account: 'acct_erfunden'" })).toBe(true)
    expect(istUnzugaenglichesStripeKonto({ code: 'resource_missing', param: 'account', message: 'x' })).toBe(true)
  })

  it('die Kasse bleibt streng: dort zählt der Zugriffsfehler nicht', () => {
    expect(istUnbekanntesStripeKonto(keinZugriff())).toBe(false)
  })

  it('Gegenprobe: fehlende Rechte, PaymentIntent, Ausfall und Modus-Wache sind kein unbekanntes Konto', () => {
    expect(
      istUnzugaenglichesStripeKonto({
        code: 'secret_key_required',
        message: "The provided key does not have the required permissions for this endpoint on account 'acct_erfunden'.",
      })
    ).toBe(false)
    expect(istUnzugaenglichesStripeKonto({ code: 'resource_missing', param: 'intent', message: "No such payment_intent: 'pi_erfunden'" })).toBe(false)
    expect(istUnzugaenglichesStripeKonto(new Error('Stripe nicht erreichbar'))).toBe(false)
    expect(istUnzugaenglichesStripeKonto(new Error('Stripe startet nicht: Lokal ist ein Live-Schlüssel eingetragen.'))).toBe(false)
    expect(istUnzugaenglichesStripeKonto(null)).toBe(false)
    expect(istUnzugaenglichesStripeKonto('account_invalid')).toBe(false)
  })
})

describe('neuEinrichtenSchluessel — Idempotenz im 15-Minuten-Fenster (Runde 2)', () => {
  const ZEHN_UHR = new Date('2026-10-08T10:00:00.000Z')
  const plus = (ms: number) => new Date(ZEHN_UHR.getTime() + ms)

  it('Doppelklick und sofortiger Neuversuch im selben Fenster: derselbe Schlüssel', () => {
    const erster = neuEinrichtenSchluessel('farm_1', 'acct_erfunden', ZEHN_UHR)
    expect(neuEinrichtenSchluessel('farm_1', 'acct_erfunden', plus(1_000))).toBe(erster)
    expect(neuEinrichtenSchluessel('farm_1', 'acct_erfunden', plus(NEU_EINRICHTEN_FENSTER_MS - 1))).toBe(erster)
  })

  it('spätestens nach 15 Minuten ein neuer Schlüssel — ein gespeicherter Fehler sperrt nicht 24 Stunden', () => {
    expect(NEU_EINRICHTEN_FENSTER_MS).toBe(15 * 60 * 1000)
    const erster = neuEinrichtenSchluessel('farm_1', 'acct_erfunden', ZEHN_UHR)
    expect(neuEinrichtenSchluessel('farm_1', 'acct_erfunden', plus(NEU_EINRICHTEN_FENSTER_MS))).not.toBe(erster)
  })

  it('Grenze: an der Fenstergrenze wechselt der Schlüssel (dokumentiert)', () => {
    expect(neuEinrichtenSchluessel('farm_1', 'acct_erfunden', plus(-1))).not.toBe(neuEinrichtenSchluessel('farm_1', 'acct_erfunden', ZEHN_UHR))
  })

  it('je Hof und alter Kennung ein eigener Schlüssel — nur Kennungen, nichts Persönliches', () => {
    const schluessel = neuEinrichtenSchluessel('farm_1', 'acct_erfunden', ZEHN_UHR)
    expect(schluessel).toMatch(/^hofkonto-neu-farm_1-acct_erfunden-\d+$/)
    expect(neuEinrichtenSchluessel('farm_2', 'acct_erfunden', ZEHN_UHR)).not.toBe(schluessel)
    expect(neuEinrichtenSchluessel('farm_1', 'acct_anders', ZEHN_UHR)).not.toBe(schluessel)
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
    for (const text of [neuEinrichtenSatz(true), neuEinrichtenSatz(false), NEU_EINRICHTEN_KURZ]) {
      expect(text).toContain('neu ein')
      expect(text).not.toMatch(/acct_|resource_missing|account/i)
    }
  })

  it('Hof: der Satz verspricht Barzahlung nur, wenn der Hof sie anbietet (Runde 1)', () => {
    expect(neuEinrichtenSatz(true)).toContain('Bis dahin bieten wir deinen Kundinnen nur Barzahlung an.')
    expect(neuEinrichtenSatz(false)).not.toMatch(/bar/i)
    expect(neuEinrichtenSatz(false)).toContain('Bis dahin können Kunden bei dir nicht bestellen.')
  })
})
