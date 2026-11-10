/**
 * B-Zeilen der mail-* Boards (Nr. 255, Lauf 32) — gerendert über das echte src/lib/email.ts und die echten
 * Renderer (src/server/mail-arten), Prisma und Resend gemockt.
 *
 * Beweist:
 *  - Admin-Vorschau/Renderer reichen `serviceFeeRefundedAt` durch: Eine stornierte Barbestellung mit entfallener
 *    Gebühr zeigt in der Bestätigung „Bar bei Abholung“ = Warenpreis (Nachtrag 244 → 255);
 *  - mail-betrieb Bild 1: „Hof, PLZ Ort“ und „Fehlt noch“; Bild 2: Kurznummer aus dem Ende der ID (kurznummerAus);
 *  - mail-hof-bestellung: Abholzeit „9:00–12:00“ ohne führende Null, Linie unter „Abholung“; die Kundin-Mail behält „09:00“;
 *  - mail-kauf Bild 6: „Ein Artikel fehlt“ listet, was bleibt, vor „Neuer Betrag“ — ohne früher fehlende Positionen;
 *  - mail-storno Bild 3: „Verfallen“ nennt die verstrichene Frist (fristVon), ohne Zeitpunkt „nicht rechtzeitig“;
 *  - mail-storno Bild 4: „Zahlung kam zu spät“ sagt „abgelaufen“.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'

const { db } = vi.hoisted(() => ({
  db: {
    order: { findUnique: vi.fn() },
  },
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
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

import type { OrderForHofMail } from '@/lib/email'
import { fristVon, zeitpunktFuerMail } from '@/lib/fristen'
import { kurznummerAus } from '@/lib/kurznummer'

let email: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  email = await import('@/lib/email')
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  db.order.findUnique.mockReset()
})

const ERSTELLT = new Date('2027-03-03T06:40:00Z')
const ABHOLTAG = new Date('2027-03-06T11:00:00Z')

const FARM = {
  id: 'farm-1',
  name: 'Hof Beispiel',
  slug: 'hof-beispiel',
  ownerName: 'Max Muster',
  address: 'Feldweg 1',
  postalCode: '4910',
  city: 'Beispieldorf',
  phone: '+43 664 0000000',
  email: 'hof@example.org',
  owner: { email: 'inhaber@example.org' },
}

const ITEM = (id: string, name: string, totalPrice: string, fehltSeit: Date | null = null) => ({
  id,
  productName: name,
  quantity: 1,
  unitPrice: totalPrice,
  totalPrice,
  gebuehrCents: 0,
  fehltSeit,
  product: { unit: 'STUECK', unitSize: null, ruecksendekostenCents: null, abholhinweise: [] },
})

/** Eine Zeile aus der Datenbank, wie BESTELLUNG_FUER_MAIL sie liest. */
function zeile(teil: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    farmId: 'farm-1',
    orderNumber: 'HT-0303-A4F2',
    customerName: 'Erika Beispiel',
    customerEmail: 'erika@example.org',
    customerPhone: '+43 660 0000000',
    totalAmount: '9.80',
    serviceFeeCents: 60,
    serviceFeeRefundedAt: null,
    gebuehrModell: null,
    gebuehrEinzug: null,
    createdAt: ERSTELLT,
    pickupDate: ABHOLTAG,
    pickupTimeStart: '09:00',
    pickupTimeEnd: '12:00',
    paymentMethod: 'ONSITE_CASH',
    stripePaymentIntentId: null,
    cancelReason: null,
    status: 'CONFIRMED',
    kaeuferArt: 'PRIVAT',
    farm: FARM,
    items: [ITEM('i1', 'Freilandeier', '9.80')],
    ...teil,
  }
}

function bestellung(teil: Partial<OrderForHofMail> = {}): OrderForHofMail {
  const z = zeile()
  return { ...z, items: z.items, ...teil } as unknown as OrderForHofMail
}

function klartext(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#xA0;| /g, ' ').replace(/\s+/g, ' ')
}

describe('Admin-Vorschau und Renderer: entfallene Gebühr', () => {
  it('ladeBestellungFuerMail reicht serviceFeeRefundedAt durch — die Bestätigung zeigt den Warenpreis', async () => {
    db.order.findUnique.mockResolvedValue(zeile({ status: 'CANCELLED', serviceFeeRefundedAt: new Date('2027-03-04T08:00:00Z') }))
    const { ladeBestellungFuerMail } = await import('@/server/mail-arten/bestellung')
    const b = await ladeBestellungFuerMail('order-1')
    expect(b?.serviceFeeRefundedAt).toBeInstanceOf(Date)
    const text = klartext((await email.baueOrderConfirmation(b!)).html)
    expect(text).toContain('Bar bei Abholung € 9,80')
    expect(text).toContain('Servicegebühr (entfällt) € 0,60')
    // Die Abfrage fragt das Feld wirklich ab.
    expect(db.order.findUnique.mock.calls[0]?.[0].select.serviceFeeRefundedAt).toBe(true)
  })
})

describe('mail-betrieb', () => {
  it('Bild 1: „Hof, PLZ Ort“ und „Fehlt noch“; ohne Lücken keine Zeile', async () => {
    const mit = klartext((await email.baueNewFarmNotification({ id: 'f1', name: 'Hof am Moos', slug: 'hof-am-moos', ownerEmail: 'x@example.org', createdAt: ERSTELLT, postalCode: '5230', city: 'Mattighofen', fehlt: ['Stripe', 'Produkte', 'Abholzeit'] }, 'betrieb@example.org')).html)
    expect(mit).toContain('Hof Hof am Moos, 5230 Mattighofen')
    expect(mit).toContain('Fehlt noch Stripe, Produkte, Abholzeit')
    const ohne = klartext((await email.baueNewFarmNotification({ id: 'f1', name: 'Hof am Moos', slug: 'hof-am-moos', ownerEmail: 'x@example.org', createdAt: ERSTELLT, fehlt: [] }, 'betrieb@example.org')).html)
    expect(ohne).not.toContain('Fehlt noch')
  })

  it('Bild 2: die Kurznummer kommt aus dem Ende der ID', () => {
    expect(kurznummerAus('cmeldung0000000000004f8m2q')).toBe('4F8M2Q')
  })
})

describe('mail-hof-bestellung', () => {
  it('Abholzeit ohne führende Null in allen drei Hof-Mails, Linie unter „Abholung“', async () => {
    for (const mail of [
      await email.baueBarBestellungAnHof(bestellung({ status: 'PENDING_CONFIRMATION' } as Partial<OrderForHofMail>)),
      await email.baueOrderConfirmedToFarmer(bestellung()),
      await email.baueOrderPaidToFarmer(bestellung({ paymentMethod: 'ONLINE' })),
    ]) {
      expect(klartext(mail.html)).toContain('9:00–12:00 Uhr')
      expect(klartext(mail.html)).not.toContain('09:00–12:00')
      expect(mail.html).toMatch(/Abholung[\s\S]{0,1500}<hr/)
    }
  })

  it('„Bar zu kassieren“ ohne Doppelpunkt; die Kundin-Mail behält „09:00“', async () => {
    expect(klartext((await email.baueOrderConfirmedToFarmer(bestellung())).html)).toContain('Bar zu kassieren € 10,40')
    expect(klartext((await email.baueOrderConfirmation(bestellung())).html)).toContain('09:00–12:00 Uhr')
  })
})

describe('mail-kauf Bild 6: Ein Artikel fehlt', () => {
  it('listet, was bleibt, vor „Neuer Betrag“', async () => {
    const b = bestellung()
    const fehlend = { productName: 'Heumilch', quantity: 1, unitPrice: '1.30', totalPrice: '1.30', gebuehrCents: 0, product: { unit: 'STUECK', unitSize: null } }
    const { html } = await email.baueArtikelFehlt(b, {
      position: fehlend,
      zahlung: 'vor_ort',
      bisherCents: 1170,
      neuCents: 1040,
      erstattetCents: null,
      uebrig: [{ productName: 'Freilandeier', quantity: 1, unitPrice: '9.80', totalPrice: '9.80', gebuehrCents: 0, product: { unit: 'STUECK', unitSize: null } }],
    })
    const text = klartext(html)
    expect(text).toMatch(/Freilandeier[^€]*€ 9,80 Neuer Betrag € 10,40/)
  })

  it('der Renderer lässt die fehlende und früher fehlende Positionen weg', async () => {
    db.order.findUnique.mockResolvedValue(zeile({ items: [ITEM('i1', 'Freilandeier', '4.90'), ITEM('i2', 'Heumilch', '1.30'), ITEM('i3', 'Bergkäse', '3.60', new Date('2027-03-03T08:00:00Z'))] }))
    const { rendereArtikelFehlt } = await import('@/server/mail-arten/bestellung')
    const mail = await rendereArtikelFehlt({ orderId: 'order-1', itemId: 'i2', bisherCents: '1040', neuCents: '910' })
    if ('verworfen' in mail) throw new Error(mail.verworfen)
    const text = klartext(mail.html)
    expect(text).toContain('Freilandeier')
    expect(text.split('Neuer Betrag')[0]).not.toContain('Bergkäse')
    expect(text.split('Neuer Betrag')[0].split('Bestellnummer')[1]).not.toContain('Heumilch')
  })
})

describe('mail-storno', () => {
  it('Bild 3: „Verfallen“ nennt die Frist aus fristVon', async () => {
    const frist = fristVon({ paymentMethod: 'ONSITE_CASH', createdAt: ERSTELLT, pickupDate: ABHOLTAG, pickupTimeStart: '09:00' })
    const text = klartext((await email.baueBestellungVerfallen(bestellung())).html)
    expect(text).toContain(`nicht bis ${zeitpunktFuerMail(frist)} bestätigt`)
    const ohne = klartext((await email.baueBestellungVerfallen({ customerName: 'Erika', customerEmail: 'e@example.org', orderNumber: 'X', farm: { name: 'Hof Beispiel', email: '' } })).html)
    expect(ohne).toContain('nicht rechtzeitig bestätigt')
  })

  it('Bild 4: „Zahlung kam zu spät“ sagt „abgelaufen“', async () => {
    const text = klartext((await email.baueZahlungZuSpaet(bestellung({ paymentMethod: 'ONLINE' }), 1040)).html)
    expect(text).toContain('schon abgelaufen war')
    expect(text).not.toContain('storniert')
  })
})
