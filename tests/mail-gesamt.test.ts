/**
 * „Gesamt“ in den Kunden-Mails bei entfallener Gebühr (Nr. 255, Nachtrag zu Nr. 244) — gerendert über das echte
 * src/lib/email.ts, nur das Resend-SDK gemockt. Die echten Mails gehen hinaus, solange die Gebühr gilt; eine
 * entfallene Gebühr sieht vor allem die Admin-Vorschau (Admin › Betrieb › Mails) nach Storno oder „nicht abgeholt“.
 *
 * Beweist, wie tests/geldanzeige-gesamt.test.ts (a)–(f) für die Bestätigungsseite:
 *  (a) bar, Gebühr entfallen: „Bar bei Abholung“ = Warenpreis, Zeile „Servicegebühr (entfällt)“ durchgestrichen;
 *  (b) online, Gebühr erstattet: „Online bezahlt“ = Warenpreis, „(erstattet)“;
 *  (c) Erstattung offen (serviceFeeRefundedAt leer): Gesamt MIT Gebühr, nichts gestrichen;
 *  (d) Hofpreis-Modell, entfallen: Zeilen mit Warenpreis, Zeilensumme = Gesamt = Warenpreis, kein „inkl.“-Satz
 *      (Nr. 255 Runde 1); Gegenprobe: gilt die Gebühr, Endpreise, Gesamt mit Gebühr und „inkl.“-Satz;
 *  (e) Gebühr 0: Gesamt = Warenpreis, keine Zeile;
 *  (f) Snapshot bleibt: „Bar zu kassieren“ und „Die Kundin hat … bezahlt“ in den Hof-Mails zählen die Gebühr
 *      weiter mit, auch wenn sie entfallen ist (nur Anzeige geändert, nichts an Buchung oder Kasse).
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

const ENTFALLEN_AM = new Date('2026-10-06T10:00:00Z')

function bestellung(teil: Partial<OrderForEmail> = {}): OrderForHofMail {
  return {
    id: 'order-1',
    orderNumber: 'HT-0210-A4F2',
    customerName: 'Erika Beispiel',
    customerEmail: 'erika@example.org',
    customerPhone: '+43 660 0000000',
    totalAmount: '9.80',
    serviceFeeCents: 60,
    createdAt: new Date('2026-10-05T08:12:00Z'),
    pickupDate: new Date('2026-10-05T12:00:00Z'),
    pickupTimeStart: '09:00',
    pickupTimeEnd: '12:00',
    paymentMethod: 'ONSITE_CASH',
    kaeuferArt: 'PRIVAT',
    farm: {
      id: 'farm-1',
      name: 'Hof Beispiel',
      email: 'hof@example.org',
      ownerName: 'Max Muster',
      address: 'Feldweg 1',
      city: 'Beispieldorf',
      postalCode: '4910',
      phone: '+43 664 0000000',
      slug: 'hof-beispiel',
      owner: { email: 'inhaber@example.org' },
    },
    items: [{ productName: 'Freilandeier', quantity: 2, unitPrice: '4.90', totalPrice: '9.80', gebuehrCents: 0, product: { unit: 'STUECK', unitSize: null } }],
    ...teil,
  } as OrderForHofMail
}

/** Das HTML als Fließtext, ohne Auszeichnung — Beträge mit festem Leerzeichen bleiben „€ 9,80“. */
function klartext(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#xA0;| /g, ' ')
    .replace(/\s+/g, ' ')
}

const MAILS = [
  ['Bestätigung', (o: OrderForEmail) => email.baueOrderConfirmation(o)],
  ['Bitte bestätige (bar)', (o: OrderForEmail) => email.onsiteConfirmationInhalt(o, 'token-1')],
] as const

describe('Kunden-Mails: „Gesamt“ ohne entfallene Gebühr', () => {
  it.each(MAILS)('(a) %s, bar mit entfallener Gebühr: Gesamt ist der Warenpreis, die Gebühr steht durchgestrichen', async (_name, baue) => {
    const { html } = await baue(bestellung({ status: 'CANCELLED', serviceFeeRefundedAt: ENTFALLEN_AM } as Partial<OrderForEmail>))
    const text = klartext(html)
    expect(text).toContain('Bar bei Abholung € 9,80')
    expect(text).toContain('Servicegebühr (entfällt) € 0,60')
    expect(html).toMatch(/line-through[^>]*>€\s0,60</)
    expect(text).not.toContain('€ 10,40')
  })

  it('(b) Bestätigung online, Gebühr erstattet: „Online bezahlt“ ist der Warenpreis, Vermerk „erstattet“', async () => {
    const { html } = await email.baueOrderConfirmation(bestellung({ paymentMethod: 'ONLINE', serviceFeeRefundedAt: ENTFALLEN_AM }))
    const text = klartext(html)
    expect(text).toContain('Online bezahlt € 9,80')
    expect(text).toContain('Servicegebühr (erstattet) € 0,60')
    expect(html).toMatch(/line-through[^>]*>€\s0,60</)
  })

  it.each(MAILS)('(c) %s, Gebühr gilt (Erstattung offen oder offen): Gesamt MIT Gebühr, nichts gestrichen', async (_name, baue) => {
    const { html } = await baue(bestellung({ serviceFeeRefundedAt: null }))
    const text = klartext(html)
    expect(text).toContain('Bar bei Abholung € 10,40')
    expect(text).toContain('Servicegebühr € 0,60')
    expect(text).not.toMatch(/\((entfällt|erstattet)\)/)
    expect(html).not.toContain('line-through')
  })

  it('(c) ohne das Feld (alte Lader) gilt die Gebühr wie bisher', async () => {
    const { html } = await email.baueOrderConfirmation(bestellung())
    expect(klartext(html)).toContain('Bar bei Abholung € 10,40')
  })

  // Stimmige Hofpreis-Bestellung: Summe der gebuehrCents der Zeilen = serviceFeeCents (0,45 + 0,15 = 0,60).
  const HOFPREIS = {
    gebuehrModell: 'hofpreis',
    items: [
      { productName: 'Freilandeier', quantity: 1, unitPrice: '4.90', totalPrice: '4.90', gebuehrCents: 45, product: { unit: 'STUECK', unitSize: null } },
      { productName: 'Heumilch', quantity: 1, unitPrice: '4.90', totalPrice: '4.90', gebuehrCents: 15, product: { unit: 'LITER', unitSize: 1 } },
    ],
  } as Partial<OrderForEmail>

  it.each(MAILS)('(d) %s, Hofpreis-Modell mit entfallener Gebühr: kein „inkl.“-Satz, Zeilen mit Warenpreis, Zeilensumme = Gesamt', async (_name, baue) => {
    const { html } = await baue(bestellung({ ...HOFPREIS, serviceFeeRefundedAt: ENTFALLEN_AM }))
    const text = klartext(html)
    expect(text).toContain('1 × Freilandeier € 4,90')
    expect(text).toContain('1 × Heumilch (1 L) € 4,90')
    expect(text).toContain('Bar bei Abholung € 9,80')
    expect(text).not.toContain('inkl. Plattformgebühr')
    expect(text).not.toMatch(/Plattformgebühr \((entfällt|erstattet)\)/)
    expect(text).not.toContain('€ 10,40')
  })

  it.each(MAILS)('(d) %s, Gegenprobe Hofpreis-Modell, Gebühr gilt: Endpreise, Gesamt mit Gebühr, „inkl.“-Satz', async (_name, baue) => {
    const { html } = await baue(bestellung({ ...HOFPREIS }))
    const text = klartext(html)
    expect(text).toContain('1 × Freilandeier € 5,35')
    expect(text).toContain('1 × Heumilch (1 L) € 5,05')
    expect(text).toContain('Bar bei Abholung € 10,40')
    expect(text).toContain('inkl. Plattformgebühr (darin € 0,60)')
  })

  it('(d) Bestätigung online, Hofpreis-Modell, Gebühr erstattet: Zeilensumme = „Online bezahlt“, kein „inkl.“', async () => {
    const { html } = await email.baueOrderConfirmation(bestellung({ ...HOFPREIS, paymentMethod: 'ONLINE', serviceFeeRefundedAt: ENTFALLEN_AM }))
    const text = klartext(html)
    expect(text).toContain('Online bezahlt € 9,80')
    expect(text).not.toContain('inkl. Plattformgebühr')
  })

  it('„Bring bitte … in bar mit“: der zu kassierende Betrag aus dem Snapshot; bei entfallener Gebühr kein Kasten', async () => {
    expect(klartext((await email.baueOrderConfirmation(bestellung())).html)).toContain('Bring bitte € 10,40 in bar mit.')
    expect(klartext((await email.baueOrderConfirmation(bestellung({ ...HOFPREIS }))).html)).toContain('Bring bitte € 10,40 in bar mit.')
    const entfallen = klartext((await email.baueOrderConfirmation(bestellung({ serviceFeeRefundedAt: ENTFALLEN_AM }))).html)
    expect(entfallen).not.toContain('Bring bitte')
  })

  it('„Bitte zahle … mit Karte“ (Karte bei Abholung, E5): derselbe Betrag aus dem Snapshot; bei entfallener Gebühr kein Kasten (Nr. 280)', async () => {
    const karte = { paymentMethod: 'ONSITE_CARD' }
    expect(klartext((await email.baueOrderConfirmation(bestellung(karte))).html)).toContain('Bitte zahle € 10,40 bei der Abholung mit Karte.')
    expect(klartext((await email.baueOrderConfirmation(bestellung({ ...karte, ...HOFPREIS }))).html)).toContain('Bitte zahle € 10,40 bei der Abholung mit Karte.')
    const entfallen = klartext((await email.baueOrderConfirmation(bestellung({ ...karte, serviceFeeRefundedAt: ENTFALLEN_AM }))).html)
    expect(entfallen).not.toContain('Bitte zahle')
    // Gegenprobe: bar bleibt beim eigenen Satz, online gibt es keinen Kasten.
    expect(klartext((await email.baueOrderConfirmation(bestellung())).html)).not.toContain('Bitte zahle')
    const online = klartext((await email.baueOrderConfirmation(bestellung({ paymentMethod: 'ONLINE' }))).html)
    expect(online).not.toContain('Bitte zahle')
    expect(online).not.toContain('Bring bitte')
  })

  it('(e) Gebühr 0: Gesamt ist der Warenpreis, keine Gebührenzeile', async () => {
    const { html } = await email.baueOrderConfirmation(bestellung({ serviceFeeCents: 0 }))
    const text = klartext(html)
    expect(text).toContain('Bar bei Abholung € 9,80')
    expect(text).not.toContain('Servicegebühr €')
  })
})

describe('(f) Hof-Mails: der Snapshot bleibt, auch bei entfallener Gebühr', () => {
  it('„Bar zu kassieren“ in „Bar-Bestellung bestätigt“ und „Neue Bestellung bar“ zählt die Gebühr mit', async () => {
    const entfallen = bestellung({ serviceFeeRefundedAt: ENTFALLEN_AM })
    expect(klartext((await email.baueOrderConfirmedToFarmer(entfallen)).html)).toContain('€ 10,40')
    expect(klartext((await email.baueBarBestellungAnHof(entfallen)).html)).toContain('Bar zu kassieren € 10,40')
  })

  it('„Die Kundin hat … bezahlt“ in der Online-Mail an den Hof bleibt Warenpreis + Gebühr', async () => {
    const { html } = await email.baueOrderPaidToFarmer(bestellung({ paymentMethod: 'ONLINE', serviceFeeRefundedAt: ENTFALLEN_AM }))
    expect(klartext(html)).toContain('Die Kundin hat € 10,40 bezahlt.')
  })
})

describe('Antwort 8 und Überschrift (Nr. 255)', () => {
  it('Abholbereit-Mail ohne „Dieselbe Bestellung nochmal aufgeben“ und ohne ?reorder=', async () => {
    const { html } = await email.baueOrderReady(bestellung())
    expect(html).not.toContain('nochmal aufgeben')
    expect(html).not.toContain('reorder=')
    expect(html).toContain('Bestellung ansehen')
  })

  it('„Neue Bestellung bar“ an den Hof: Überschrift als <h1>', async () => {
    const { html } = await email.baueBarBestellungAnHof(bestellung())
    expect(html).toMatch(/<h1\b[^>]*>Neue Bestellung eingegangen<\/h1>/)
  })
})
