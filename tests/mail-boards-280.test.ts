/**
 * Mail-Boards nach der Abnahme Lauf 32 (Nr. 280, Auftrag 23.1): Positionszeile G14, Telefonnummer fett,
 * Werte-Spalte am Handy, Zeiten nach V9 über den Datumshelfer aus Nr. 279 und die Sätze der Boards
 * mail-sicherheit, mail-team, mail-betrieb und mail-hof-konto. Nur Inhalte — kein Versand, keine Datenbank;
 * Daten erfunden, Adressen @example.org, Telefonnummern genullt.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/server/mail-warteschlange', () => ({ protokolliereSofortMail: vi.fn() }))
vi.mock('@/server/betrieb-zaehler', () => ({ zaehleMail: vi.fn() }))
vi.mock('@/server/queries/plattform-einstellung', async () => {
  const { PLATTFORM_EINSTELLUNG_STANDARD } = await import('@/lib/plattform-einstellung')
  return { ladePlattformEinstellung: async () => PLATTFORM_EINSTELLUNG_STANDARD }
})
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn() }
    batch = { send: vi.fn() }
  },
}))

import type { OrderForEmail, OrderForHofMail } from '@/lib/email'

let email: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  email = await import('@/lib/email')
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

function klartext(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|&#xA0;/g, ' ')
    .replace(/\s+/g, ' ')
}

/** Di, 2. März 2027, 21:14 in Wien. */
const ZEIT = new Date('2027-03-02T20:14:00Z')

function bestellung(teil: Partial<OrderForEmail> = {}): OrderForHofMail {
  return {
    id: 'order-1',
    orderNumber: 'HM-0303-2C91',
    customerName: 'Maria Huber',
    customerEmail: 'maria.huber@example.org',
    customerPhone: '+43 660 0000000',
    totalAmount: '18.00',
    serviceFeeCents: 0,
    createdAt: new Date('2027-03-03T06:40:00Z'),
    pickupDate: new Date('2027-03-03T12:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    paymentMethod: 'ONLINE',
    kaeuferArt: 'BETRIEB',
    farm: {
      id: 'farm-1',
      name: 'Hof Müller',
      email: 'hof-mueller@example.org',
      ownerName: 'Franz Müller',
      address: 'Dorfstraße 12',
      city: 'Braunau am Inn',
      postalCode: '5280',
      phone: '+43 664 0000000',
      slug: 'hof-mueller',
      owner: { email: 'franz.mueller@example.org' },
    },
    items: [
      { productName: 'Bergkäse', quantity: 2, unitPrice: '6.20', totalPrice: '12.40', gebuehrCents: 0, product: { unit: 'G', unitSize: '250' } },
      { productName: 'Heumilch frisch', quantity: 4, unitPrice: '1.40', totalPrice: '5.60', gebuehrCents: 0, product: { unit: 'LITER', unitSize: '1' } },
      { productName: 'Freilandeier', quantity: 3, unitPrice: '0.00', totalPrice: '0.00', gebuehrCents: 0, product: { unit: 'STUECK', unitSize: null } },
    ],
    ...teil,
  } as OrderForHofMail
}

describe('Positionszeile G14 in den Bestellmails', () => {
  it('Bestätigung an die Kundin: Anzahl fett vorn, Gebinde in Klammern — Beträge wie vorher', async () => {
    const { html } = await email.baueOrderConfirmation(bestellung())
    expect(html).toContain('<strong style="font-weight:700">2</strong> × Bergkäse (250 g)')
    expect(html).toContain('<strong style="font-weight:700">4</strong> × Heumilch frisch (1 L)')
    // Beim Stück ohne Gebinde keine Klammer („3 × Freilandeier (1 Stück)“ sagte nichts Neues).
    expect(html).toContain('<strong style="font-weight:700">3</strong> × Freilandeier<')
    const t = klartext(html)
    expect(t).toContain('2 × Bergkäse (250 g) € 12,40')
    expect(t).toContain('4 × Heumilch frisch (1 L) € 5,60')
    // Gegenprobe: die alte Schreibweise „Name · Menge“ steht nicht mehr da.
    expect(t).not.toContain('Bergkäse · 2 × 250 g')
  })

  it('Mail an den Hof (bezahlt): dieselbe Positionszeile', async () => {
    const { html } = await email.baueOrderPaidToFarmer(bestellung())
    expect(html).toContain('<strong style="font-weight:700">4</strong> × Heumilch frisch (1 L)')
  })

  it('„Ein Artikel fehlt“: der Artikel im Satz und die übrigen Positionen nach G14', async () => {
    const order = bestellung()
    const { html } = await email.baueArtikelFehlt(order, {
      position: order.items[1],
      uebrig: [order.items[0]],
      zahlung: 'vor_ort',
      bisherCents: 1800,
      neuCents: 1240,
      erstattetCents: null,
    })
    const t = klartext(html)
    expect(t).toContain('es fehlt leider: 4 × Heumilch frisch (1 L) .')
    expect(html).toContain('<strong style="font-weight:700">2</strong> × Bergkäse (250 g)')
  })
})

describe('Telefonnummer der Kundin fett in den Hof-Mails', () => {
  it('bezahlte Bestellung: „Kundin · Name · Nummer“, Nummer fett als Anruf-Link', async () => {
    const { html } = await email.baueOrderPaidToFarmer(bestellung())
    expect(html).toMatch(/<a href="tel:\+436600000000"[^>]*font-weight:600[^>]*>\+43 660 000 0000<\/a>/)
  })
})

describe('Werte-Spalte am Handy (Board s3-mail-kauf Bild 1)', () => {
  it('Datum und Adresse tragen die Klasse für die schmale Fassung, Beträge nicht', async () => {
    const { html } = await email.baueOrderConfirmation(bestellung())
    expect(html).toContain('.fz-wert{font-size:13px !important')
    expect(html.match(/class="fz-wert"/g)?.length).toBe(2)
    expect(html.match(/class="fz-wert-name"/g)?.length).toBe(2)
  })
})

describe('Sicherheit und Team: Sätze der Boards, Zeiten nach V9', () => {
  it('Neue Anmeldung: Überschrift „Neue Anmeldung“, Tag im Satz, Zeitpunkt mit Wochentag und Jahr', async () => {
    const { betreff, html } = await email.neueAnmeldungInhalt({ hof: true, name: 'Franz Müller', geraet: 'Windows · Edge', zeitpunkt: ZEIT, link: 'https://example.org/sicherheit' })
    const t = klartext(html)
    expect(betreff).toContain('Neue Anmeldung bei deinem Hof-Konto')
    expect(t).toContain('Agrilo Neue Anmeldung Hallo Franz Müller, am Di, 2. März 2027 hat sich jemand mit deinem Konto angemeldet:')
    expect(t).toContain('Wann Di, 2. März 2027, 21:14 Uhr')
    expect(t).not.toContain('2.3. um 21:14')
  })

  it('Zu viele Codes: Satz des Boards ohne Anrede, Pause nach V9, Schutzsatz bleibt', async () => {
    const t = klartext((await email.zuVieleVersucheInhalt({ art: 'code', bis: ZEIT })).html)
    expect(t).toContain('Für deine Adresse wurde mehrmals ein falscher Code eingegeben. Zum Schutz nehmen wir für diese Adresse bis Di, 2. März 2027, 21:14 Uhr keinen Code mehr an.')
    expect(t).toContain('Gib Codes nie an andere weiter – wir fragen dich nie danach.')
    expect(t).not.toContain('Hallo,')
  })

  it('Zu viele Passwörter: ohne Knopf (Phishing-Schutz), Weg über „Passwort vergessen“ bleibt', async () => {
    const { html } = await email.zuVieleVersucheInhalt({ art: 'passwort', bis: ZEIT })
    const t = klartext(html)
    expect(t).toContain('Für dein Konto wurde mehrmals ein falsches Passwort eingegeben. Deshalb ist die Anmeldung mit Passwort bis Di, 2. März 2027, 21:14 Uhr pausiert.')
    expect(t).toContain('Passwort vergessen')
    expect(html).not.toMatch(/border-radius:999px/)
  })

  it('Neue Anmelde-Adresse bestätigen: Überschrift, Satz und „Bis dahin … alte Adresse“', async () => {
    const { betreff, html } = await email.emailAendernLinkInhalt({ hof: 'Hof Müller', link: 'https://example.org/konto/email' })
    const t = klartext(html)
    expect(betreff).toContain('Bestätige deine neue Anmelde-Adresse')
    expect(t).toContain('Neue Anmelde-Adresse bestätigen Hallo Hof Müller, das Team von Agrilo hat auf deinen Wunsch eine neue Anmelde-Adresse eingetragen. Bitte bestätige sie:')
    expect(t).toContain('Der Link gilt 24 Stunden und einmal. Bis dahin meldest du dich mit der alten Adresse an.')
  })

  it('Anmelde-Adresse geändert: Zeitpunkt nach V9', async () => {
    const t = klartext((await email.emailGeaendertHinweisInhalt({ hof: null, zeitpunkt: ZEIT, link: 'https://example.org/sicherheit' })).html)
    expect(t).toContain('am Di, 2. März 2027, 21:14 Uhr wurde die Anmelde-Adresse deines Kontos geändert.')
  })

  it('Neuer Passkey: Überschrift, Passkey in Anführungszeichen, Zeitpunkt in Klammern', async () => {
    const { betreff, html } = await email.adminSicherheitInhalt({ anlass: 'passkey-hinzugefuegt', geraet: 'Laptop · Chrome', zeitpunkt: ZEIT })
    const t = klartext(html)
    expect(betreff).toContain('Neuer Passkey bei deinem Admin-Konto')
    expect(t).toContain('Neuer Passkey Bei deinem Admin-Konto wurde der Passkey „Laptop · Chrome“ hinzugefügt (Di, 2. März 2027, 21:14 Uhr).')
  })

  it('Passkey entfernt: derselbe Aufbau wie vorher, Zeitpunkt nach V9', async () => {
    const t = klartext((await email.adminSicherheitInhalt({ anlass: 'passkey-entfernt', geraet: 'Laptop · Chrome', zeitpunkt: ZEIT })).html)
    expect(t).toContain('Hallo, am Di, 2. März 2027, 21:14 Uhr wurde bei deinem Admin-Konto ein Passkey entfernt: Laptop · Chrome .')
  })

  it('Einrichtungscode: typografische Anführungszeichen um „Admin-Zugang absichern“', async () => {
    const t = klartext((await email.adminSicherheitInhalt({ anlass: 'einrichtungscode', geraet: 'Laptop · Chrome', zeitpunkt: ZEIT, code: '0'.repeat(6) })).html)
    expect(t).toContain('auf der Seite „Admin-Zugang absichern“ ein:')
  })
})

describe('Betrieb und Postfach', () => {
  it('Warn-Mail: Knopf „In Betrieb ansehen →“', async () => {
    const t = klartext((await email.betriebWarnungInhalt({ art: 'grenze', wert: 'datenbank', anteil: 82, stand: '410 MB von 500 MB', trend: null, ohneVerwendungBytes: null })).html)
    expect(t).toContain('In Betrieb ansehen →')
  })

  it('Postfach: „Antworten geht in der App, im Postfach.“', async () => {
    const { POSTFACH_MAIL_TEXT } = await import('@/lib/postfach')
    expect(POSTFACH_MAIL_TEXT.antwortenInDerApp).toBe('Antworten geht in der App, im Postfach.')
  })
})
