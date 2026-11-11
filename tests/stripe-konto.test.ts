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
  ANGABEN_NACHRICHT,
  BEI_STRIPE_ERGAENZEN,
  STRIPE_KONTO_STAENDE,
  ZAHLUNG_ANSEHEN,
  ZAHLUNG_STUFE_TEXT,
  ZAHLUNG_ZEILE_TEXT,
  hofStufe,
  istStripeKontoStand,
  onlineZahlungNachricht,
  stripeAnzeige,
  stripeGrundAdmin,
  stripeKontoStand,
  type StripeKontoDaten,
} from '@/lib/stripe-konto'
import { SUPPORT_EMAIL } from '@/lib/support'

/** Ein fertiges Konto: alles, was E1 verlangt (erfundene Werte, kein Netz). */
const FERTIG: StripeKontoDaten = {
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  capabilities: { card_payments: 'active', transfers: 'active', eps_payments: 'active' },
  requirements: { disabled_reason: null, currently_due: [], past_due: [], pending_verification: [] },
}

function konto(teil: {
  charges_enabled?: boolean | null
  payouts_enabled?: boolean | null
  details_submitted?: boolean | null
  capabilities?: StripeKontoDaten['capabilities']
  requirements?: Partial<NonNullable<StripeKontoDaten['requirements']>>
}): StripeKontoDaten {
  const { requirements, ...rest } = teil
  return { ...FERTIG, ...rest, requirements: { ...FERTIG.requirements, ...requirements } }
}

const faehig = (teil: Partial<Record<'card_payments' | 'transfers' | 'eps_payments', string>>) => ({
  card_payments: 'active',
  transfers: 'active',
  eps_payments: 'active',
  ...teil,
})

describe('stripeKontoBereit (E1: bereit erst mit EPS)', () => {
  it('alle fünf Bedingungen erfüllt → bereit', () => {
    expect(stripeKontoBereit(FERTIG)).toBe(true)
  })

  it.each([
    ['Zahlungen gesperrt', konto({ charges_enabled: false })],
    ['Auszahlungen gesperrt', konto({ payouts_enabled: false })],
    ['Karte inaktiv', konto({ capabilities: faehig({ card_payments: 'inactive' }) })],
    ['Karte in Prüfung', konto({ capabilities: faehig({ card_payments: 'pending' }) })],
    ['Überweisung inaktiv', konto({ capabilities: faehig({ transfers: 'inactive' }) })],
    ['Überweisung in Prüfung', konto({ capabilities: faehig({ transfers: 'pending' }) })],
    ['EPS inaktiv', konto({ capabilities: faehig({ eps_payments: 'inactive' }) })],
    ['EPS in Prüfung', konto({ capabilities: faehig({ eps_payments: 'pending' }) })],
    ['EPS fehlt', konto({ capabilities: { card_payments: 'active', transfers: 'active' } })],
    ['Karte fehlt', konto({ capabilities: { transfers: 'active', eps_payments: 'active' } })],
    ['Überweisung fehlt', konto({ capabilities: { card_payments: 'active', eps_payments: 'active' } })],
    ['capabilities null', konto({ capabilities: null })],
  ])('%s → nicht bereit', (_name, k) => {
    expect(stripeKontoBereit(k)).toBe(false)
  })

  it('die alte Regel (nur Zahlungen und Auszahlungen frei) reicht nicht mehr', () => {
    expect(stripeKontoBereit({ charges_enabled: true, payouts_enabled: true })).toBe(false)
  })

  it('fehlende Angaben zählen als nicht bereit', () => {
    expect(stripeKontoBereit({})).toBe(false)
    expect(stripeKontoBereit({ charges_enabled: true, payouts_enabled: null })).toBe(false)
  })
})

describe('stripeKontoStand (E2: die erste Stufe, die zutrifft)', () => {
  it('bereit', () => {
    expect(stripeKontoStand(FERTIG)).toBe('bereit')
  })

  it.each([
    ['rejected.fraud', konto({ charges_enabled: false, requirements: { disabled_reason: 'rejected.fraud' } })],
    ['rejected.other mit offenen Angaben', konto({ charges_enabled: false, requirements: { disabled_reason: 'rejected.other', currently_due: ['x'] } })],
    ['platform_paused', konto({ charges_enabled: false, requirements: { disabled_reason: 'platform_paused' } })],
  ])('gesperrt: %s', (_name, k) => {
    expect(stripeKontoStand(k)).toBe('gesperrt')
  })

  it.each([
    ['Formular nicht abgeschickt', konto({ details_submitted: false, charges_enabled: false })],
    ['details_submitted fehlt', konto({ details_submitted: null, payouts_enabled: false })],
    ['currently_due nicht leer', konto({ payouts_enabled: false, requirements: { currently_due: ['individual.dob.day'] } })],
    ['past_due nicht leer', konto({ charges_enabled: false, requirements: { past_due: ['external_account'] } })],
    ['requirements.past_due bei leeren Listen', konto({ charges_enabled: false, requirements: { disabled_reason: 'requirements.past_due' } })],
    ['offene Angaben gehen vor EPS', konto({ capabilities: faehig({ eps_payments: 'inactive' }), requirements: { currently_due: ['x'] } })],
  ])('angaben_fehlen: %s', (_name, k) => {
    expect(stripeKontoStand(k)).toBe('angaben_fehlen')
  })

  it.each([
    ['EPS inaktiv', konto({ capabilities: faehig({ eps_payments: 'inactive' }) })],
    ['EPS fehlt', konto({ capabilities: { card_payments: 'active', transfers: 'active' } })],
  ])('eps_fehlt: %s', (_name, k) => {
    expect(stripeKontoStand(k)).toBe('eps_fehlt')
  })

  it.each([
    ['EPS in Prüfung bei sonst fertigem Konto', konto({ capabilities: faehig({ eps_payments: 'pending' }) })],
    ['Karte in Prüfung', konto({ charges_enabled: false, capabilities: faehig({ card_payments: 'pending' }) })],
    ['Überweisung in Prüfung', konto({ payouts_enabled: false, capabilities: faehig({ transfers: 'pending' }) })],
    ['pending_verification nicht leer', konto({ charges_enabled: false, requirements: { pending_verification: ['individual.verification.document'] } })],
    ['requirements.pending_verification', konto({ charges_enabled: false, requirements: { disabled_reason: 'requirements.pending_verification' } })],
    ['under_review', konto({ charges_enabled: false, requirements: { disabled_reason: 'under_review' } })],
    ['listed', konto({ charges_enabled: false, requirements: { disabled_reason: 'listed' } })],
  ])('pruefung: %s', (_name, k) => {
    expect(stripeKontoStand(k)).toBe('pruefung')
  })

  it.each([
    ['nichts davon (Zahlungen aus, kein Grund)', konto({ charges_enabled: false })],
    ['Karte inaktiv ohne Grund', konto({ capabilities: faehig({ card_payments: 'inactive' }) })],
    ['capabilities null bei sonst fertigem Konto', konto({ capabilities: null })],
    ['anderer Grund', konto({ charges_enabled: false, requirements: { disabled_reason: 'other' } })],
  ])('unklar: %s', (_name, k) => {
    expect(stripeKontoStand(k)).toBe('unklar')
  })

  it('liefert nur Werte aus STRIPE_KONTO_STAENDE', () => {
    expect(STRIPE_KONTO_STAENDE).toEqual(['bereit', 'gesperrt', 'angaben_fehlen', 'eps_fehlt', 'pruefung', 'unklar'])
    expect(istStripeKontoStand('pruefung')).toBe(true)
    expect(istStripeKontoStand('rejected.fraud')).toBe(false)
    expect(istStripeKontoStand(null)).toBe(false)
  })
})

describe('stripeAnzeige und hofStufe (E4)', () => {
  it('ohne Konto: kein_konto, egal was gespeichert ist', () => {
    expect(stripeAnzeige({ stripeKontoDa: false, stripeAccountReady: false, stripeKontoStand: 'pruefung' })).toBe('kein_konto')
  })

  it('NULL + bereit → bereit; NULL + nicht bereit → angaben_fehlen (bisheriges Verhalten)', () => {
    expect(stripeAnzeige({ stripeKontoDa: true, stripeAccountReady: true, stripeKontoStand: null })).toBe('bereit')
    expect(stripeAnzeige({ stripeKontoDa: true, stripeAccountReady: false, stripeKontoStand: null })).toBe('angaben_fehlen')
  })

  it('bereit gilt nur über stripeAccountReady: gespeichertes „bereit“ bei nicht bereit → angaben_fehlen', () => {
    expect(stripeAnzeige({ stripeKontoDa: true, stripeAccountReady: false, stripeKontoStand: 'bereit' })).toBe('angaben_fehlen')
    expect(stripeAnzeige({ stripeKontoDa: true, stripeAccountReady: true, stripeKontoStand: 'pruefung' })).toBe('bereit')
  })

  it('unbekannter Text → angaben_fehlen; gültiger Stand → der Stand', () => {
    expect(stripeAnzeige({ stripeKontoDa: true, stripeAccountReady: false, stripeKontoStand: 'irgendwas' })).toBe('angaben_fehlen')
    for (const stand of ['gesperrt', 'angaben_fehlen', 'eps_fehlt', 'pruefung', 'unklar'] as const) {
      expect(stripeAnzeige({ stripeKontoDa: true, stripeAccountReady: false, stripeKontoStand: stand })).toBe(stand)
    }
  })

  it('der Hof sieht eps_fehlt und unklar als „noch nicht freigegeben“', () => {
    expect(hofStufe('eps_fehlt')).toBe('noch_nicht')
    expect(hofStufe('unklar')).toBe('noch_nicht')
    for (const a of ['kein_konto', 'bereit', 'gesperrt', 'angaben_fehlen', 'pruefung'] as const) expect(hofStufe(a)).toBe(a)
  })
})

describe('Texte für den Hof (E5, wörtlich)', () => {
  it('W-A gilt: „Stripe prüft“ ohne Rückfall-Satz', () => {
    expect(ANGABEN_NACHRICHT).toBe(true)
    expect(ZAHLUNG_STUFE_TEXT.pruefung).toEqual({
      titel: 'Stripe prüft deine Angaben.',
      text: 'Du musst nichts tun, wir melden uns. Das dauert meist nur kurz, manchmal ein paar Werktage. Sobald die Online-Zahlung aktiv ist, siehst du es hier.',
      marke: 'Stripe prüft',
    })
  })

  it('Kasten und Marke: noch nicht freigegeben, gesperrt (mit der Support-Adresse)', () => {
    expect(ZAHLUNG_STUFE_TEXT.noch_nicht).toEqual({
      titel: 'Stripe hat die Online-Zahlung noch nicht ganz freigegeben.',
      text: 'Du musst nichts tun, wir kümmern uns darum und melden uns.',
      marke: 'Noch nicht freigegeben',
    })
    expect(ZAHLUNG_STUFE_TEXT.gesperrt).toEqual({
      titel: 'Online-Zahlung ist bei Stripe gesperrt.',
      text: `Online bezahlen geht bei dir deshalb gerade nicht. Schreib uns bitte an ${SUPPORT_EMAIL}, wir helfen dir weiter.`,
      marke: 'Bei Stripe gesperrt',
    })
  })

  it('Zeile „Zahlung“ in den Einstellungen', () => {
    expect(ZAHLUNG_ZEILE_TEXT).toEqual({
      pruefung: 'Stripe prüft deine Angaben · du musst nichts tun',
      noch_nicht: 'Stripe hat noch nicht ganz freigegeben · wir kümmern uns darum',
      gesperrt: 'Online-Zahlung bei Stripe gesperrt · schreib uns',
    })
  })

  const BAR = 'Bis dahin können Kunden nur bar bei Abholung bestellen.'
  const OHNE = 'Bis dahin können Kunden bei dir nicht bestellen.'

  it.each([
    ['angaben_fehlen', 'Stripe braucht noch Angaben von dir', 'Erst danach können Kunden online bezahlen.', BEI_STRIPE_ERGAENZEN],
    ['pruefung', 'Stripe prüft deine Angaben', 'Du musst nichts tun, wir melden uns.', ZAHLUNG_ANSEHEN],
    [
      'noch_nicht',
      'Online-Zahlung noch nicht freigegeben',
      'Stripe hat die Online-Zahlung noch nicht ganz freigegeben. Du musst nichts tun, wir kümmern uns darum und melden uns.',
      ZAHLUNG_ANSEHEN,
    ],
    [
      'gesperrt',
      'Online-Zahlung ist bei Stripe gesperrt',
      `Online bezahlen geht bei dir deshalb gerade nicht. Schreib uns bitte an ${SUPPORT_EMAIL}, wir helfen dir weiter.`,
      ZAHLUNG_ANSEHEN,
    ],
  ] as const)('Heute bei %s: Titel, Satz mit [BAR], Knopf', (stufe, titel, satz, knopf) => {
    expect(onlinePausiertHinweis(stufe, true)).toEqual({ titel, satz: `${satz} ${BAR}`, knopf })
    expect(onlinePausiertHinweis(stufe, false)).toEqual({ titel, satz: `${satz} ${OHNE}`, knopf })
  })

  it('Knöpfe: „Bei Stripe ergänzen“ und „Zahlung ansehen“', () => {
    expect(BEI_STRIPE_ERGAENZEN).toBe('Bei Stripe ergänzen')
    expect(ZAHLUNG_ANSEHEN).toBe('Zahlung ansehen')
  })

  it('kein „EPS“ in einem Hof-Text der Stufen', () => {
    const texte = [
      ...Object.values(ZAHLUNG_STUFE_TEXT).flatMap((t) => [t.titel, t.text, t.marke]),
      ...Object.values(ZAHLUNG_ZEILE_TEXT),
      ...(['angaben_fehlen', 'pruefung', 'noch_nicht', 'gesperrt'] as const).flatMap((s) =>
        [true, false].flatMap((b) => Object.values(onlinePausiertHinweis(s, b)))
      ),
      ...(['aktiv', 'angaben'] as const).flatMap((a) => [true, false].flatMap((b) => Object.values(onlineZahlungNachricht(a, b)))),
    ]
    for (const t of texte) expect(t, t).not.toMatch(/\bEPS\b/i)
  })
})

describe('Nachrichten an den Hof (E6, wörtlich)', () => {
  it('aktiv — sichtbarer Hof', () => {
    expect(onlineZahlungNachricht('aktiv', true)).toEqual({
      betreff: 'Online-Zahlung ist aktiv',
      text: 'Stripe hat dein Konto freigegeben. Ab sofort können Kunden bei dir online bezahlen.',
    })
  })

  it('aktiv — Hof noch nicht online', () => {
    expect(onlineZahlungNachricht('aktiv', false)).toEqual({
      betreff: 'Online-Zahlung ist aktiv',
      text: 'Stripe hat dein Konto freigegeben. Sobald dein Hof online ist, können Kunden dort auch online bezahlen.',
    })
  })

  it('angaben (W-A)', () => {
    expect(onlineZahlungNachricht('angaben', true)).toEqual({
      betreff: 'Stripe braucht noch Angaben von dir',
      text: 'Stripe braucht noch Angaben von dir. Öffne Einstellungen › Zahlung und tippe auf ‚Einrichtung fortsetzen‘.',
    })
  })
})

describe('Für das Team (E8, wörtlich)', () => {
  it('stripeGrundAdmin je Anzeige', () => {
    expect(stripeGrundAdmin('kein_konto')).toBe('Stripe fehlt')
    expect(stripeGrundAdmin('angaben_fehlen')).toBe('Stripe: Angaben fehlen')
    expect(stripeGrundAdmin('pruefung')).toBe('Stripe prüft')
    expect(stripeGrundAdmin('eps_fehlt')).toBe('Stripe: EPS nicht aktiv')
    expect(stripeGrundAdmin('unklar')).toBe('Stripe: nicht freigegeben, Grund unklar')
    expect(stripeGrundAdmin('gesperrt')).toBe('Stripe: gesperrt')
    expect(stripeGrundAdmin('bereit')).toBe('Stripe eingerichtet')
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
    // Seit Nr. 17 als Titel und Satz der Hinweiskarte, seit A012 je Stufe (onlinePausiertHinweis).
    expect(onlinePausiertHinweis('angaben_fehlen', true).satz).toContain('nur bar bei Abholung')
    expect(onlinePausiertHinweis('angaben_fehlen', false).satz).not.toContain('bar')
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
