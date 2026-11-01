/**
 * Belehrung und AGB in den Bestätigungsmails (Nr. 207, Auftrag Punkt 1) —
 * gerendert über das echte src/lib/email.ts, nur das Resend-SDK gemockt.
 *
 * Beweist:
 *  - Bestätigung online und bar (nach dem Knopf) und „Bitte bestätige“ (bar)
 *    tragen bei einer Verbraucherin Teil A mit den vier Angaben des Hofs,
 *    Teil B, den Hinweis zur Rückgabe am Hof und den Link zum Widerruf;
 *  - jede dieser Mails trägt die AGB als Datei agb-<marke>-<fassung>.html,
 *    deren Inhalt genau agbAlsHtml() ist (aus agb.ts) — auch bei „Betrieb“;
 *  - bei „Betrieb“ entfallen Belehrung und Formular (Gegenprobe);
 *  - MAIL_AGB_ZEILE nennt den Anhang;
 *  - sendRaw gibt den Anhang an Resend weiter (Base64, Dateiname), ohne ihn
 *    ins Log zu schreiben; versendeStapel schickt eine Mail mit Anhang einzeln
 *    über emails.send mit dem Idempotenz-Schlüssel und lehnt mehrere ab.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'

const { sendMock, batchMock } = vi.hoisted(() => ({ sendMock: vi.fn(), batchMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/server/mail-warteschlange', () => ({ protokolliereSofortMail: vi.fn() }))
vi.mock('@/server/betrieb-zaehler', () => ({ zaehleMail: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
    batch = { send: batchMock }
  },
}))

import { agbAlsHtml, agbDateiname } from '@/lib/rechtstexte/agb-datei'
import { BELEHRUNG, HOF_ANGABEN_OHNE_LINK } from '@/lib/widerruf'
import type { OrderForEmail, StapelMail } from '@/lib/email'

let email: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  vi.stubEnv('VERCEL_ENV', 'production')
  email = await import('@/lib/email')
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  sendMock.mockReset()
  batchMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

function bestellung(teil: Partial<OrderForEmail> = {}): OrderForEmail {
  return {
    id: 'order-1',
    orderNumber: 'HT-0210-A4F2',
    customerName: 'Erika Beispiel',
    customerEmail: 'erika@example.org',
    customerPhone: '+43 660 0000000',
    totalAmount: '10.30',
    serviceFeeCents: 52,
    createdAt: new Date('2026-10-05T08:12:00Z'),
    pickupDate: new Date('2026-10-05T12:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    paymentMethod: 'ONLINE',
    kaeuferArt: 'PRIVAT',
    farm: {
      id: 'farm-1',
      name: 'Hof Beispiel',
      email: '',
      ownerName: 'Max Muster',
      address: 'Feldweg 1',
      city: 'Beispieldorf',
      postalCode: '4910',
      phone: '+43 664 0000000',
      slug: 'hof-beispiel',
      owner: { email: 'inhaber@example.org' },
    },
    items: [{ productName: 'Freilandeier', quantity: 1, unitPrice: '4.50', totalPrice: '4.50', gebuehrCents: 0, product: { unit: 'STUECK', unitSize: null } }],
    ...teil,
  }
}

function klartext(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|&#xA0;/g, ' ')
    .replace(/\s+/g, ' ')
}

const VIER_ANGABEN = 'Hof Beispiel, Max Muster, Feldweg 1, 4910 Beispieldorf, Telefon +43 664 000 0000, E-Mail inhaber@example.org'
const FORMULAR_ANGABEN = '– An Hof Beispiel, Max Muster, Feldweg 1, 4910 Beispieldorf, E-Mail inhaber@example.org:'

async function onsite(order: OrderForEmail): Promise<StapelMail> {
  return email.onsiteConfirmationInhalt(order, 'token-1')
}

const MAILS: Array<[string, (o: OrderForEmail) => Promise<StapelMail>, Partial<OrderForEmail>]> = [
  ['Bestätigung online', (o) => email.baueOrderConfirmation(o), {}],
  ['Bestätigung bar', (o) => email.baueOrderConfirmation(o), { paymentMethod: 'ONSITE_CASH' }],
  ['Bitte bestätige (bar)', onsite, { paymentMethod: 'ONSITE_CASH' }],
]

describe.each(MAILS)('%s', (_name, baue, teil) => {
  it('Verbraucherin: Teil A mit den vier Hofangaben, Teil B, Hinweis, Link zum Widerruf und die AGB im Anhang', async () => {
    const mail = await baue(bestellung(teil))
    const text = klartext(mail.html)
    expect(text).toContain(BELEHRUNG.teilA.titel)
    expect(text).toContain(`müssen Sie uns (${VIER_ANGABEN}) mittels`)
    expect(text).toContain(BELEHRUNG.teilB.titel)
    expect(text).toContain(FORMULAR_ANGABEN)
    expect(text).toContain(BELEHRUNG.teilB.fussnote)
    expect(text).toContain(BELEHRUNG.hinweis)
    expect(text).not.toContain(HOF_ANGABEN_OHNE_LINK.voll)
    expect(mail.html).toMatch(/href="[^"]*\/widerruf\?bestellung=order-1&amp;sig=/)
    expect(text).toContain('Du findest sie auch als Datei im Anhang dieser E-Mail')
    expect(mail.anhaenge).toEqual([{ dateiname: agbDateiname(), inhalt: agbAlsHtml() }])
    expect(mail.anhaenge?.[0]?.dateiname).toMatch(/^agb-[a-z]+-\d+(\.\d+)*\.html$/)
  }, 30_000)

  it('Nr. 214: ohne Produkt mit geschätzten Rücksendekosten kein 5-b-Satz', async () => {
    const text = klartext((await baue(bestellung(teil))).html)
    expect(text).toContain('Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.')
    expect(text).not.toContain('Die Kosten werden auf höchstens etwa')
  }, 30_000)

  it('Nr. 214: mit Schätzung der 5-b-Satz nach „Sie tragen …“ — Summe × Menge, auf ganze Euro aufgerundet', async () => {
    const items: OrderForEmail['items'] = [
      { productName: 'Brennholz', quantity: 2, unitPrice: '90.00', totalPrice: '180.00', gebuehrCents: 0, product: { unit: 'RAUMMETER', unitSize: null, ruecksendekostenCents: 1250 } },
      { productName: 'Freilandeier', quantity: 1, unitPrice: '4.50', totalPrice: '4.50', gebuehrCents: 0, product: { unit: 'STUECK', unitSize: null, ruecksendekostenCents: null } },
      { productName: 'Heu', quantity: 3, unitPrice: '5.00', totalPrice: '15.00', gebuehrCents: 0, product: { unit: 'BALLEN', unitSize: null, ruecksendekostenCents: 199 } },
    ]
    const text = klartext((await baue(bestellung({ ...teil, items }))).html)
    // 2 × 12,50 € + 3 × 1,99 € = 30,97 € → 31 EUR
    expect(text).toContain('Sie tragen die unmittelbaren Kosten der Rücksendung der Waren. Die Kosten werden auf höchstens etwa 31 EUR geschätzt.')
  }, 30_000)

  it('Gegenprobe Betrieb: keine Belehrung, kein Formular, kein Widerruf-Link — der Anhang bleibt', async () => {
    const mail = await baue(bestellung({ ...teil, kaeuferArt: 'BETRIEB' }))
    const text = klartext(mail.html)
    expect(text).not.toContain(BELEHRUNG.teilA.titel)
    expect(text).not.toContain(BELEHRUNG.teilB.titel)
    expect(text).not.toContain('Widerrufsrecht')
    expect(mail.html).not.toContain('/widerruf?')
    expect(mail.anhaenge).toEqual([{ dateiname: agbDateiname(), inhalt: agbAlsHtml() }])
  }, 30_000)
})

describe('Hof-E-Mail in der Belehrung', () => {
  it('mit eigener Hof-E-Mail steht sie statt der Anmelde-Adresse (hofKontaktEmail)', async () => {
    const order = bestellung()
    const mail = await email.baueOrderConfirmation({ ...order, farm: { ...order.farm, email: 'hof@example.org' } })
    expect(klartext(mail.html)).toContain('E-Mail hof@example.org')
    expect(mail.html).not.toContain('inhaber@example.org')
  })
})

describe('Anhang über den bestehenden Mail-Weg', () => {
  it('sendOnsiteConfirmation → sendRaw gibt die AGB als Base64 mit Dateinamen an Resend; das Log nennt den Anhang nicht', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await email.sendOnsiteConfirmation(bestellung({ paymentMethod: 'ONSITE_CASH' }), 'token-1')
    const aufruf = sendMock.mock.calls.at(-1)?.[0] as { attachments?: Array<{ filename: string; content: string }> }
    expect(aufruf.attachments).toEqual([{ filename: agbDateiname(), content: Buffer.from(agbAlsHtml(), 'utf8').toString('base64') }])
    expect(JSON.stringify(log.mock.calls)).not.toContain(agbDateiname())
    log.mockRestore()
  }, 30_000)

  it('Gegenprobe: eine Mail ohne Anhang schickt kein attachments-Feld', async () => {
    await email.sendRaw('erika@example.org', 'Betreff', '<p>x</p>', { art: 'anmeldecode' })
    expect(sendMock.mock.calls.at(-1)?.[0]).not.toHaveProperty('attachments')
  })

  it('versendeStapel: eine Mail mit Anhang einzeln über emails.send mit dem Schlüssel; Gegenprobe ohne Anhang über batch', async () => {
    const mitAnhang: StapelMail = { an: 'erika@example.org', betreff: 'B', html: '<p>x</p>', anhaenge: [{ dateiname: 'agb.html', inhalt: '<p>agb</p>' }] }
    expect(await email.versendeStapel([mitAnhang], 'schluessel-1')).toEqual({ ok: true, ids: ['email_1'] })
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0]![1]).toEqual({ idempotencyKey: 'schluessel-1' })
    expect(batchMock).not.toHaveBeenCalled()

    batchMock.mockResolvedValue({ data: { data: [{ id: 'b1' }] }, error: null })
    expect(await email.versendeStapel([{ an: 'erika@example.org', betreff: 'B', html: '<p>x</p>' }], 'schluessel-2')).toEqual({ ok: true, ids: ['b1'] })
    expect(batchMock).toHaveBeenCalledTimes(1)
  })

  it('zwei Mails mit Anhang in einer Anfrage: abgelehnt, nichts verschickt (nie still ohne Anhang)', async () => {
    const m: StapelMail = { an: 'erika@example.org', betreff: 'B', html: '<p>x</p>', anhaenge: [{ dateiname: 'agb.html', inhalt: 'x' }] }
    expect(await email.versendeStapel([m, m], 'schluessel-3')).toEqual({ ok: false, statusCode: null, code: 'anhang_im_stapel' })
    expect(sendMock).not.toHaveBeenCalled()
    expect(batchMock).not.toHaveBeenCalled()
  })

  it('Resend lehnt ab: Status und Code zurück, damit der Worker wiederholt oder aufgibt', async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'x' } })
    const m: StapelMail = { an: 'erika@example.org', betreff: 'B', html: '<p>x</p>', anhaenge: [{ dateiname: 'agb.html', inhalt: 'x' }] }
    expect(await email.versendeStapel([m], 'schluessel-4')).toEqual({ ok: false, statusCode: 429, code: 'rate_limit_exceeded' })
  })
})
