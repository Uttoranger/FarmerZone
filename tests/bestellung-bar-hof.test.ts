/**
 * Mail „Neue Bestellung bar“ an den Hof (Nr. 256, N46; Board
 * s3/w3-mail-hof-bestellung Bild 2) — Renderer und Inhalt, ohne Datenbank.
 *
 * Beweist:
 *  - „Bar zu kassieren“ kommt allein aus `barZuKassierenCents` der Bestellung:
 *    vor dem Stichtag (bar ohne Gebühr, B1) gleich dem Warenpreis, nach dem
 *    Stichtag mit Gebühr > 0 gleich Warenpreis + Gebühr — nie der Warenpreis als Rückfall.
 *  - Betreff, Überschrift, Satz, Frist („bestätigt bis <Wochentag>, <Datum>,
 *    <Uhrzeit> Uhr“), Knopf und Fuß nach dem Board; an die Hof-Adresse, ohne Reply-To.
 *  - Kein tel:-Link, keine Telefonnummer, keine E-Mail-Adresse und keine Notiz der Kundin.
 *  - Der Renderer verwirft bei CONFIRMED, CANCELLED, PICKED_UP, bei abgelaufener
 *    Frist (istVerwaist) und bei einer Online-Bestellung.
 * Die Integration (Route legt genau einen Auftrag an, Fehler ändert nichts)
 * steht in tests/integration/bestellung-bar-hof.int.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ order: { findUnique: vi.fn() } }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { RENDERER } from '@/server/mail-arten'
import { bezugSchemaFuer } from '@/schemas/mail-auftrag'
import { barZuKassierenCents, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import type { StapelMail } from '@/lib/email'
import { MAIL_FUSS_TEXT } from '@/emails/_layout'

/** Mi, 3. März 2027, 07:40 in Wien — der Tag der Beispielwelt. */
const JETZT = new Date('2027-03-03T06:40:00.000Z')
const NOTIZ = 'Bitte klingeln beim Seiteneingang'
const TELEFON = '+43 660 0000000'

/** Eine Barbestellung nach dem Stichtag (Hofpreis-Modell, Gebühr 1,12 €), eben eingegangen. Erfundene Daten. */
const NACH_STICHTAG = {
  id: 'cbestellung0000000000002',
  farmId: 'chofmueller0000000000001',
  orderNumber: 'HM-0303-7E15',
  customerName: 'Eva Steiner',
  customerEmail: 'eva.steiner@example.org',
  customerPhone: TELEFON,
  customerNote: NOTIZ,
  totalAmount: '18.00',
  serviceFeeCents: 112,
  gebuehrModell: 'hofpreis' as string | null,
  gebuehrEinzug: 'monatsabrechnung' as string | null,
  createdAt: JETZT,
  pickupDate: new Date('2027-03-06T12:00:00.000Z'),
  pickupTimeStart: '09:00',
  pickupTimeEnd: '12:00',
  paymentMethod: 'ONSITE_CASH',
  stripePaymentIntentId: null,
  cancelReason: null,
  status: 'PENDING_CONFIRMATION',
  kaeuferArt: 'PRIVAT',
  farm: {
    id: 'chofmueller0000000000001',
    name: 'Hof Müller',
    slug: 'hof-mueller',
    ownerName: 'Franz Müller',
    address: 'Dorfstraße 12',
    postalCode: '5280',
    city: 'Braunau am Inn',
    phone: '+43 664 0000000',
    email: 'hof-mueller@example.org',
    owner: { email: 'franz.mueller@example.org' },
  },
  items: [
    { id: 'cposition000000000000001', productName: 'Bergkäse', quantity: 2, unitPrice: '6.20', totalPrice: '12.40', gebuehrCents: 76, product: { unit: 'G', unitSize: '250', ruecksendekostenCents: null } },
    { id: 'cposition000000000000002', productName: 'Heumilch frisch', quantity: 4, unitPrice: '1.40', totalPrice: '5.60', gebuehrCents: 36, product: { unit: 'LITER', unitSize: '1', ruecksendekostenCents: null } },
  ],
}

/** Vor dem Stichtag: Modell „bisher“, bar ohne Gebühr (B1). */
const VOR_STICHTAG = {
  ...NACH_STICHTAG,
  gebuehrModell: null,
  gebuehrEinzug: null,
  serviceFeeCents: 0,
  items: NACH_STICHTAG.items.map((i) => ({ ...i, gebuehrCents: 0 })),
}

type Bestellung = typeof NACH_STICHTAG

async function rendere(b: Bestellung): Promise<StapelMail | { verworfen: string }> {
  db.order.findUnique.mockResolvedValue(b)
  const renderer = RENDERER['bestellung-bar-hof']
  if (!renderer) throw new Error('kein Renderer für bestellung-bar-hof')
  return renderer(bezugSchemaFuer('bestellung-bar-hof').parse({ orderId: b.id }))
}

async function mail(b: Bestellung): Promise<StapelMail> {
  const ergebnis = await rendere(b)
  if ('verworfen' in ergebnis) throw new Error(`verworfen: ${ergebnis.verworfen}`)
  return ergebnis
}

/** Sichtbarer Text der Mail, Leerraum zusammengezogen. */
function text(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#xA0;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Was „Bar zu kassieren“ zeigen muss — allein aus barZuKassierenCents. */
function kassierenText(b: Bestellung): string {
  const cents = barZuKassierenCents({ totalAmount: b.totalAmount, serviceFeeCents: b.serviceFeeCents, paymentMethod: b.paymentMethod })
  if (cents === null) throw new Error('keine Barbestellung')
  return formatEuro(centsAlsEuro(cents))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'], now: JETZT })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('„Bar zu kassieren“ allein aus barZuKassierenCents', () => {
  it('vor dem Stichtag: gleich dem Warenpreis (bar ohne Gebühr, B1)', async () => {
    const t = text((await mail(VOR_STICHTAG)).html)
    expect(kassierenText(VOR_STICHTAG)).toBe(formatEuro(18))
    expect(t).toContain(`Bar zu kassieren ${kassierenText(VOR_STICHTAG)}`)
  })

  it('nach dem Stichtag mit Gebühr > 0: Warenpreis + Gebühr — nie der Warenpreis allein', async () => {
    const t = text((await mail(NACH_STICHTAG)).html)
    expect(kassierenText(NACH_STICHTAG)).toBe(formatEuro(19.12))
    expect(t).toContain(`Bar zu kassieren ${formatEuro(19.12)}`)
    // Gegenprobe: Der Warenpreis steht nicht als Betrag zum Kassieren da.
    expect(t).not.toContain(`Bar zu kassieren ${formatEuro(18)}`)
    expect(t).not.toContain('Bar zu kassieren:')
  })
})

describe('Inhalt nach Board Bild 2', () => {
  it('Betreff, Überschrift, Satz, Frist, Positionen, Knopf und Fuß; an die Hof-Adresse, ohne Reply-To', async () => {
    const m = await mail(NACH_STICHTAG)
    const t = text(m.html)
    expect(m.an).toBe('hof-mueller@example.org')
    expect(m.antwortAn).toBeUndefined()
    expect(m.betreff).toMatch(/^Neue Bestellung für .+ – HM-0303-7E15 \(Bar bei Abholung\)$/)
    expect(t).toContain('Neue Bestellung eingegangen')
    expect(t).toContain('Eva Steiner hat eine Bestellung aufgegeben. Die Zahlung (Bar bei Abholung) erfolgt bei der Abholung.')
    expect(t).toContain('HM-0303-7E15')
    expect(t).toContain('Abholung')
    // Frist: 2 Stunden ab Bestellung (fristVon), als fester Tag mit Uhrzeit (C-Zeile mail-kauf).
    expect(t).toContain('Eva Steiner bestätigt bis Mittwoch, 3. März, 09:40 Uhr. Erst dann packst du.')
    expect(t).toContain('Bergkäse')
    expect(t).toContain('Heumilch frisch')
    expect(t).toContain('Bei Heute ansehen →')
    expect(t).toContain(MAIL_FUSS_TEXT.plattform)
    // Die Zeile „Kundin“ nur mit dem Namen.
    expect(t).toContain('Kundin Eva Steiner')
  })

  it('kein tel:-Link, keine Telefonnummer, keine E-Mail-Adresse und keine Notiz der Kundin', async () => {
    const m = await mail(NACH_STICHTAG)
    expect(m.html).not.toContain('tel:')
    expect(m.html).not.toContain('660 0000000')
    expect(m.html).not.toContain('+436600000000')
    expect(m.html).not.toContain('660 000 0000')
    expect(m.html).not.toContain(NACH_STICHTAG.customerEmail)
    expect(m.html).not.toContain(NOTIZ)
    expect(m.html).not.toContain('mailto:')
  })
})

describe('Renderer: nur solange die Bestellung auf die Bestätigung wartet', () => {
  it.each(['CONFIRMED', 'CANCELLED', 'PICKED_UP'])('%s → verworfen „nicht_mehr_offen“', async (status) => {
    expect(await rendere({ ...NACH_STICHTAG, status })).toEqual({ verworfen: 'nicht_mehr_offen' })
  })

  it('PENDING_CONFIRMATION mit abgelaufener Frist (istVerwaist) → verworfen; eine Minute davor noch nicht', async () => {
    const zweiStunden = 2 * 60 * 60 * 1000
    expect(await rendere({ ...NACH_STICHTAG, createdAt: new Date(JETZT.getTime() - zweiStunden) })).toEqual({ verworfen: 'nicht_mehr_offen' })
    const knapp = await rendere({ ...NACH_STICHTAG, createdAt: new Date(JETZT.getTime() - zweiStunden + 60_000) })
    expect('verworfen' in knapp).toBe(false)
  })

  it('Gegenprobe: eine Online-Bestellung vor der Zahlung (auch PENDING_CONFIRMATION) → verworfen', async () => {
    expect(await rendere({ ...NACH_STICHTAG, paymentMethod: 'ONLINE' })).toEqual({ verworfen: 'nicht_mehr_offen' })
  })

  it('Bestellung gelöscht → verworfen „bestellung_fehlt“', async () => {
    db.order.findUnique.mockResolvedValue(null)
    const renderer = RENDERER['bestellung-bar-hof']
    expect(await renderer?.({ orderId: NACH_STICHTAG.id })).toEqual({ verworfen: 'bestellung_fehlt' })
  })
})
