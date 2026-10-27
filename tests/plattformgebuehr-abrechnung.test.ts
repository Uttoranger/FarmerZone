/**
 * SEPA-Monatsabrechnung der Plattformgebühr (Register N38, Nr. 198). Stripe
 * ist eine Attrappe — kein Live-Aufruf; Prisma, Mail und Protokoll gemockt.
 *
 * Beweist:
 *  - Summen (rein, ganze Cent): eine abgeholte Barbestellung steht auf der
 *    Rechnung bar; nicht abgeholt, storniert und erlassen nicht; online als
 *    „bezahlt außerhalb“; erstattet bzw. entfallen 0; Modell bisher nie.
 *  - Sperre: zurückgebucht sofort, offen/gescheitert erst nach
 *    `barSperreNachTagen`; bezahlt sperrt nie. `einzugFuer` gibt dann bar null.
 *  - Lauf: 0 € → keine Rechnung (Stand „nichts“); Lastschrift mit dem
 *    SEPA-Zahlungsmittel, Idempotenzschlüssel `abr-<farmId>-<yyyy-mm>-bar|online`;
 *    ein zweiter Lauf am selben Tag erzeugt nichts Neues; Abrechnungstag je Hof
 *    (Wiener Datum); ein Fehler bei einem Hof hält die anderen nicht auf.
 *  - Webhooks über die echte Route: `invoice.payment_failed` → Postfach-Nachricht
 *    und Mail; `invoice.paid` → bezahlt; `charge.dispute.created` →
 *    zurückgebucht; Mandat gilt nur über `setup_intent.succeeded` (der Start
 *    im Browser schreibt nichts); `mandate.updated` inactive → Mandat weg;
 *    unbekannte Rechnung → nichts geändert.
 *  - Einstellungen je Hof ohne Recht → Fehler, nichts geschrieben.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const stripeAttrappe = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  customers: { create: vi.fn() },
  setupIntents: { create: vi.fn() },
  invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), pay: vi.fn(), sendInvoice: vi.fn(), retrieve: vi.fn() },
  invoiceItems: { create: vi.fn(), list: vi.fn() },
  invoicePayments: { list: vi.fn() },
  accounts: { retrieveCurrent: vi.fn() },
  paymentMethods: { retrieve: vi.fn() },
}))
vi.mock('@/lib/stripe', () => ({ stripe: stripeAttrappe }))

const db = vi.hoisted(() => ({
  farm: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  order: { findMany: vi.fn(), groupBy: vi.fn() },
  monatsabrechnung: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  unterhaltung: { create: vi.fn() },
  betriebMessung: { upsert: vi.fn(), deleteMany: vi.fn() },
  webhookEvent: { findUnique: vi.fn(), create: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/server/mail-warteschlange', () => ({ stelleEinOhneRisiko: vi.fn(), stelleMailEinInTransaktion: vi.fn() }))
vi.mock('@/server/admin-protokoll', () => ({ protokolliere: vi.fn(async () => true) }))
vi.mock('@/server/queries/plattform-einstellung', () => ({ lesePlattformEinstellung: vi.fn(async () => ({ hofpreisModellAb: new Date('2027-02-01T00:00:00.000+01:00') })) }))
vi.mock('@/server/queries/admin', () => ({ ladeHoefeFuerGruendung: vi.fn(async () => []) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'u1' } })) } } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/server/admin-wache', () => ({ verlangeAdminAktion: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))

import { POST } from '@/app/api/stripe/webhook/route'
import { stelleEinOhneRisiko } from '@/server/mail-warteschlange'
import { protokolliere } from '@/server/admin-protokoll'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { kuendigeEinzugAn, rechneHofAb, rechneMonatsabrechnungen } from '@/server/plattformgebuehr-abrechnung'
import { starteLastschrift } from '@/server/actions/lastschrift'
import { speichereHofPlattformgebuehr } from '@/server/actions/admin-plattformgebuehr'
import {
  abrechnungSperrtBar,
  ankuendigungFaellig,
  barMoeglich,
  einzugFuer,
  istAbrechnungsTag,
  monatsSummen,
  nichtAbgeholtAuffaellig,
  vormonat,
  type BestellungFuerAbrechnung,
} from '@/lib/plattformgebuehr'
import { LASTSCHRIFT_TEXT, lastschriftGescheitertText } from '@/lib/konditionen'
import { summeGebuehrPositionen } from '@/lib/plattformgebuehr'
import { captureException } from '@sentry/nextjs'
import { richteRechnungenEin } from './stripe-rechnungen-attrappe'

const TAG = 24 * 60 * 60 * 1000
// Dienstag, 3. März 2027, 06:30 in Wien — der Abrechnungstag (Vorgabe der 3.) für Februar.
const JETZT = new Date('2027-03-03T05:30:00.000Z')

function bestellung(teil: Partial<BestellungFuerAbrechnung>): BestellungFuerAbrechnung {
  return {
    id: 'o1',
    orderNumber: 'HM-0227-AAAA',
    paymentMethod: 'ONSITE_CASH',
    status: 'PICKED_UP',
    paymentStatus: 'PENDING',
    serviceFeeCents: 72,
    gebuehrModell: 'hofpreis',
    gebuehrEinzug: 'sepa',
    gebuehrEntfallen: false,
    ...teil,
  }
}

// ─── Drei Beispielmonate (erfunden), Summen in Cent ──────────────────────────
// Februar: bar 2 abgeholt (72 + 270 = 342), 1 nicht abgeholt, 1 storniert, 1 erlassen (54); online 2 bezahlt (72 + 48 = 120), 1 erstattet.
const FEBRUAR: BestellungFuerAbrechnung[] = [
  bestellung({ id: 'b1', orderNumber: 'HM-0227-B001', serviceFeeCents: 72 }),
  bestellung({ id: 'b2', orderNumber: 'HM-0227-B002', serviceFeeCents: 270, gebuehrEinzug: 'ueberweisung' }),
  bestellung({ id: 'b3', orderNumber: 'HM-0227-B003', status: 'NOT_PICKED_UP' }),
  bestellung({ id: 'b4', orderNumber: 'HM-0227-B004', status: 'CANCELLED' }),
  bestellung({ id: 'b5', orderNumber: 'HM-0227-B005', serviceFeeCents: 54, gebuehrEinzug: 'erlassen' }),
  bestellung({ id: 'o1', orderNumber: 'HM-0227-O001', paymentMethod: 'ONLINE', paymentStatus: 'PAID', gebuehrEinzug: 'stripe', serviceFeeCents: 72 }),
  bestellung({ id: 'o2', orderNumber: 'HM-0227-O002', paymentMethod: 'ONLINE', paymentStatus: 'PAID', gebuehrEinzug: 'stripe', serviceFeeCents: 48 }),
  bestellung({ id: 'o3', orderNumber: 'HM-0227-O003', paymentMethod: 'ONLINE', paymentStatus: 'REFUNDED', gebuehrEinzug: 'stripe', serviceFeeCents: 72 }),
]
// März: nur online (Gebühr nach „nicht abgeholt“ entfallen zählt nicht) → bar 0, online 300.
const MAERZ: BestellungFuerAbrechnung[] = [
  bestellung({ id: 'o4', orderNumber: 'HM-0327-O004', paymentMethod: 'ONLINE', paymentStatus: 'PAID', gebuehrEinzug: 'stripe', serviceFeeCents: 300 }),
  bestellung({ id: 'o5', orderNumber: 'HM-0327-O005', paymentMethod: 'ONLINE', paymentStatus: 'PAID', gebuehrEinzug: 'stripe', serviceFeeCents: 90, gebuehrEntfallen: true }),
]
// April: eine Barbestellung im Modell bisher (zählt nie) und eine abgeholte nach „Artikel fehlt“ (Gebühr gesenkt auf 48) → bar 48.
const APRIL: BestellungFuerAbrechnung[] = [
  bestellung({ id: 'b6', orderNumber: 'HM-0427-B006', gebuehrModell: null, gebuehrEinzug: null, serviceFeeCents: 50 }),
  bestellung({ id: 'b7', orderNumber: 'HM-0427-B007', serviceFeeCents: 48 }),
]

describe('Summen eines Monats (rein, ganze Cent)', () => {
  it('Februar: abgeholt bar auf der Rechnung, nicht abgeholt/storniert/erlassen nicht; online bezahlt, erstattet 0', () => {
    const s = monatsSummen(FEBRUAR)
    expect(s.barZeilen).toEqual([
      { orderId: 'b1', orderNumber: 'HM-0227-B001', cents: 72 },
      { orderId: 'b2', orderNumber: 'HM-0227-B002', cents: 270 },
    ])
    expect(s.barCents).toBe(342)
    expect(s.erlassenBestellungen).toBe(1)
    expect(s.erlassenCents).toBe(54)
    expect(s.nichtAbgeholtBestellungen).toBe(1)
    expect(s.onlineZeilen.map((z) => z.orderId)).toEqual(['o1', 'o2'])
    expect(s.onlineCents).toBe(120)
  })

  it('März: bar 0, online 300 (Gebühr entfallen zählt nicht); April: Modell bisher nie, Artikel fehlt mit der gesenkten Gebühr', () => {
    expect(monatsSummen(MAERZ)).toEqual(expect.objectContaining({ barCents: 0, barZeilen: [], onlineCents: 300 }))
    expect(monatsSummen(APRIL)).toEqual(expect.objectContaining({ barCents: 48, onlineCents: 0 }))
  })

  it('Gebühr einer Bestellung aus ihren Positionen (Geld-Abgleich): Summe der Snapshots in ganzen Cent', () => {
    expect(summeGebuehrPositionen([{ gebuehrCents: 36 }, { gebuehrCents: 72 }, { gebuehrCents: 0 }])).toBe(108)
    expect(summeGebuehrPositionen([])).toBe(0)
  })

  it('alle Werte ganze Cent', () => {
    for (const monat of [FEBRUAR, MAERZ, APRIL]) {
      const s = monatsSummen(monat)
      for (const w of [s.barCents, s.onlineCents, s.erlassenCents]) expect(Number.isInteger(w)).toBe(true)
    }
  })
})

describe('Sperre (eine Quelle für Kasse und Checkout)', () => {
  it('zurückgebucht sperrt sofort; gescheitert/offen erst nach den Tagen; bezahlt nie', () => {
    expect(abrechnungSperrtBar([{ stand: 'zurueckgebucht', offenSeit: null }], 14, JETZT)).toBe(true)
    expect(abrechnungSperrtBar([{ stand: 'gescheitert', offenSeit: new Date(JETZT.getTime() - 14 * TAG) }], 14, JETZT)).toBe(false)
    expect(abrechnungSperrtBar([{ stand: 'gescheitert', offenSeit: new Date(JETZT.getTime() - 14 * TAG - 1) }], 14, JETZT)).toBe(true)
    expect(abrechnungSperrtBar([{ stand: 'offen', offenSeit: new Date(JETZT.getTime() - 20 * TAG) }], 30, JETZT)).toBe(false)
    expect(abrechnungSperrtBar([{ stand: 'offen', offenSeit: null }], 14, JETZT)).toBe(false)
    expect(abrechnungSperrtBar([{ stand: 'bezahlt', offenSeit: new Date(0) }], 14, JETZT)).toBe(false)
  })

  it('gesperrt: einzugFuer bar → null, barMoeglich falsch; online bleibt stripe', () => {
    const hof = { einzugAb: new Date('2027-02-01T00:00:00.000Z'), barMandatPflicht: true, sepaMandatAm: new Date('2027-01-10T00:00:00.000Z') }
    expect(einzugFuer(hof, 'ONSITE_CASH', JETZT)).toBe('sepa')
    expect(einzugFuer({ ...hof, barGesperrt: true }, 'ONSITE_CASH', JETZT)).toBeNull()
    expect(einzugFuer({ ...hof, barGesperrt: true }, 'ONLINE', JETZT)).toBe('stripe')
    expect(barMoeglich({ modell: 'hofpreis', hundertstel: 600, ...hof, barGesperrt: true }, JETZT)).toBe(false)
    expect(barMoeglich({ modell: 'hofpreis', hundertstel: 600, ...hof }, JETZT)).toBe(true)
  })

  it('Ankündigung 28 Tage vorher, genau einmal; Quote ab 10 und über 20 %; Vormonat und Abrechnungstag', () => {
    const ab = new Date(JETZT.getTime() + 28 * TAG)
    expect(ankuendigungFaellig(ab, null, JETZT)).toBe(true)
    expect(ankuendigungFaellig(new Date(ab.getTime() + 1), null, JETZT)).toBe(false)
    expect(ankuendigungFaellig(ab, JETZT, JETZT)).toBe(false)
    expect(nichtAbgeholtAuffaellig(10, 3)).toBe(true)
    expect(nichtAbgeholtAuffaellig(10, 2)).toBe(false)
    expect(vormonat('2028-01-03')).toBe('2027-12')
    expect(vormonat('2028-03-03')).toBe('2028-02')
    expect(istAbrechnungsTag(3, '2028-03-03')).toBe(true)
    expect(istAbrechnungsTag(4, '2028-03-03')).toBe(false)
  })
})

// ─── Der Lauf ────────────────────────────────────────────────────────────────

const HOF = { id: 'hof_1', tarif: 'HOFTOR' as const, barMandatPflicht: true, barSperreNachTagen: 14, sepaMandatAm: new Date('2027-01-10T00:00:00.000Z'), sepaZahlungsmittelId: 'pm_sepa_1' }

function bestellZeilen(liste: BestellungFuerAbrechnung[]) {
  return liste.map((b) => ({ ...b, serviceFeeRefundedAt: b.gebuehrEntfallen ? new Date() : null }))
}

let rechnungen: ReturnType<typeof richteRechnungenEin>

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_dummy')
  db.monatsabrechnung.findUnique.mockResolvedValue(null)
  db.monatsabrechnung.upsert.mockImplementation(async () => ({ id: 'abr_1', stand: 'entwurf', rechnungBarId: null, rechnungOnlineId: null }))
  db.monatsabrechnung.update.mockResolvedValue({})
  db.monatsabrechnung.updateMany.mockResolvedValue({ count: 1 })
  db.monatsabrechnung.findMany.mockResolvedValue([])
  db.farm.findUnique.mockResolvedValue({ id: 'hof_1', name: 'Hof Probe', stripeKundeId: 'cus_1', owner: { email: 'hof@example.com' } })
  db.order.findMany.mockResolvedValue(bestellZeilen(FEBRUAR))
  rechnungen = richteRechnungenEin(stripeAttrappe, (art) => `in_${art}`)
  stripeAttrappe.webhooks.constructEvent.mockReset()
  db.webhookEvent.findUnique.mockResolvedValue(null)
  db.webhookEvent.create.mockResolvedValue({})
})

describe('rechneHofAb: Februar abrechnen', () => {
  it('online: Rechnung mit Positionen, finalisiert und „bezahlt außerhalb“; bar: Lastschrift mit dem SEPA-Zahlungsmittel', async () => {
    const e = await rechneHofAb(HOF, '2027-02', JETZT)
    expect(e).toEqual({ farmId: 'hof_1', monat: '2027-02', stand: 'offen', neu: true })
    const aufrufe = stripeAttrappe.invoices.create.mock.calls
    expect(aufrufe[0]).toEqual([expect.objectContaining({ customer: 'cus_1', collection_method: 'charge_automatically', auto_advance: false }), { idempotencyKey: 'abr-hof_1-2027-02-online' }])
    expect(stripeAttrappe.invoices.pay).toHaveBeenCalledWith('in_online', { paid_out_of_band: true }, { idempotencyKey: 'abr-hof_1-2027-02-online-bezahlt' })
    expect(aufrufe[1]).toEqual([
      expect.objectContaining({ collection_method: 'charge_automatically', default_payment_method: 'pm_sepa_1', payment_settings: { payment_method_types: ['sepa_debit'] } }),
      { idempotencyKey: 'abr-hof_1-2027-02-bar' },
    ])
    // Je Bestellnummer eine Position, Beträge als ganze Cent.
    const bar = stripeAttrappe.invoiceItems.create.mock.calls.filter(([p]) => p.invoice === 'in_bar').map(([p]) => [p.amount, p.description])
    expect(bar).toEqual([
      [72, 'Plattformgebühr bar · Bestellung HM-0227-B001'],
      [270, 'Plattformgebühr bar · Bestellung HM-0227-B002'],
    ])
    expect(stripeAttrappe.invoices.finalizeInvoice).toHaveBeenCalledWith('in_bar', { auto_advance: true }, { idempotencyKey: 'abr-hof_1-2027-02-bar-fertig' })
    // Snapshot in Cent; Lastschrift zählt die Sperre erst ab dem ersten Fehlschlag.
    expect(db.monatsabrechnung.upsert.mock.calls[0][0].create).toEqual(
      expect.objectContaining({ farmId: 'hof_1', tarif: 'HOFTOR', grundgebuehrCents: 0, servicegebuehrBarCents: 342, barBestellungen: 2, servicegebuehrOnlineCents: 120, nichtAbgeholtBestellungen: 1, summeCents: 342 })
    )
    expect(db.monatsabrechnung.updateMany).toHaveBeenLastCalledWith({ where: { id: 'abr_1', stand: 'entwurf' }, data: { stand: 'offen', offenSeit: null } })
  })

  it('ohne Mandat (Pflicht aus): Überweisung mit days_until_due = Tage bis zur Sperre, offen ab dem Senden', async () => {
    await rechneHofAb({ ...HOF, barMandatPflicht: false, sepaMandatAm: null, sepaZahlungsmittelId: null, barSperreNachTagen: 10 }, '2027-02', JETZT)
    expect(stripeAttrappe.invoices.create.mock.calls[1][0]).toEqual(expect.objectContaining({ collection_method: 'send_invoice', days_until_due: 10 }))
    expect(stripeAttrappe.invoices.sendInvoice).toHaveBeenCalledWith('in_bar', {}, { idempotencyKey: 'abr-hof_1-2027-02-bar-senden' })
    expect(db.monatsabrechnung.updateMany).toHaveBeenLastCalledWith({ where: { id: 'abr_1', stand: 'entwurf' }, data: { stand: 'offen', offenSeit: JETZT } })
  })

  it('0 € bar → keine Rechnung bar, Stand „nichts“ (März: nur die Rechnung online)', async () => {
    db.order.findMany.mockResolvedValue(bestellZeilen(MAERZ))
    const e = await rechneHofAb(HOF, '2027-03', JETZT)
    expect(e.stand).toBe('nichts')
    expect(stripeAttrappe.invoices.create).toHaveBeenCalledTimes(1)
    expect(stripeAttrappe.invoices.create.mock.calls[0][0].metadata.art).toBe('online')
    expect(db.monatsabrechnung.updateMany).toHaveBeenLastCalledWith({ where: { id: 'abr_1', stand: 'entwurf' }, data: { stand: 'nichts' } })
  })

  it('zweiter Lauf am selben Tag: Abrechnung steht schon auf „offen“ → nichts Neues bei Stripe', async () => {
    db.monatsabrechnung.findUnique.mockResolvedValue({ id: 'abr_1', stand: 'offen', rechnungBarId: 'in_bar', rechnungOnlineId: 'in_online' })
    const e = await rechneHofAb(HOF, '2027-02', JETZT)
    expect(e).toEqual({ farmId: 'hof_1', monat: '2027-02', stand: 'offen', neu: false })
    expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
    expect(db.monatsabrechnung.upsert).not.toHaveBeenCalled()
  })

  it('Entwurf mit gespeicherter Rechnung bar, Abbruch mitten in den Positionen: fehlende Position nachgezogen (je Schlüssel einmal), erst dann finalisiert', async () => {
    db.monatsabrechnung.findUnique.mockResolvedValue({ id: 'abr_1', stand: 'entwurf' })
    db.monatsabrechnung.upsert.mockResolvedValue({ id: 'abr_1', stand: 'entwurf', rechnungBarId: 'in_bar_alt', rechnungOnlineId: 'in_online_alt' })
    rechnungen.set('in_online_alt', { status: 'paid', posten: [] })
    rechnungen.set('in_bar_alt', { status: 'draft', posten: [{ id: 'ii_alt', schluessel: 'b1', amount: 72 }] })
    const e = await rechneHofAb(HOF, '2027-02', JETZT)
    expect(e.stand).toBe('offen')
    expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
    // Nur b2 kommt dazu, mit demselben Schlüssel wie beim ersten Lauf.
    expect(stripeAttrappe.invoiceItems.create.mock.calls.map(([p, o]) => [p.invoice, p.amount, o.idempotencyKey])).toEqual([['in_bar_alt', 270, 'abr-hof_1-2027-02-bar-pos-b2']])
    expect(stripeAttrappe.invoices.finalizeInvoice).toHaveBeenCalledWith('in_bar_alt', { auto_advance: true }, { idempotencyKey: 'abr-hof_1-2027-02-bar-fertig' })
    expect(rechnungen.get('in_bar_alt')?.posten.reduce((s, x) => s + x.amount, 0)).toBe(342)
    // Die Rechnung online ist schon bezahlt: nichts mehr daran.
    expect(stripeAttrappe.invoices.pay).not.toHaveBeenCalled()
  })

  it('Rechnungsbetrag weicht von der Summe ab: Warnung, nicht finalisiert, bleibt im Entwurf', async () => {
    db.monatsabrechnung.findUnique.mockResolvedValue({ id: 'abr_1', stand: 'entwurf' })
    db.monatsabrechnung.upsert.mockResolvedValue({ id: 'abr_1', stand: 'entwurf', rechnungBarId: 'in_bar_alt', rechnungOnlineId: 'in_online_alt' })
    rechnungen.set('in_online_alt', { status: 'paid', posten: [] })
    rechnungen.set('in_bar_alt', { status: 'draft', posten: [{ id: 'ii_fremd', schluessel: 'b9', amount: 999 }] })
    const e = await rechneHofAb(HOF, '2027-02', JETZT)
    expect(e).toEqual({ farmId: 'hof_1', monat: '2027-02', stand: 'entwurf', neu: false })
    expect(stripeAttrappe.invoices.finalizeInvoice).not.toHaveBeenCalled()
    expect(db.monatsabrechnung.updateMany).not.toHaveBeenCalled()
    expect(vi.mocked(captureException)).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Monatsabrechnung: Rechnungsbetrag weicht von der Summe ab — nicht finalisiert' }),
      expect.objectContaining({ extra: expect.objectContaining({ rechnungCents: 999 + 342, sollCents: 342, art: 'bar' }) })
    )
  })

  it('Rechnung online gespeichert, aber nicht finalisiert (Abbruch nach dem Speichern): Positionen nachgezogen, finalisiert, „bezahlt außerhalb“', async () => {
    db.monatsabrechnung.findUnique.mockResolvedValue({ id: 'abr_1', stand: 'entwurf' })
    db.monatsabrechnung.upsert.mockResolvedValue({ id: 'abr_1', stand: 'entwurf', rechnungBarId: null, rechnungOnlineId: 'in_online_alt' })
    rechnungen.set('in_online_alt', { status: 'draft', posten: [{ id: 'ii_alt', schluessel: 'o1', amount: 72 }] })
    const e = await rechneHofAb(HOF, '2027-02', JETZT)
    expect(e.stand).toBe('offen')
    expect(stripeAttrappe.invoices.create.mock.calls.map(([p]) => p.metadata.art)).toEqual(['bar'])
    const online = stripeAttrappe.invoiceItems.create.mock.calls.filter(([p]) => p.invoice === 'in_online_alt').map(([p, o]) => [p.amount, o.idempotencyKey])
    expect(online).toEqual([[48, 'abr-hof_1-2027-02-online-pos-o2']])
    expect(stripeAttrappe.invoices.finalizeInvoice).toHaveBeenCalledWith('in_online_alt', { auto_advance: false }, { idempotencyKey: 'abr-hof_1-2027-02-online-fertig' })
    expect(stripeAttrappe.invoices.pay).toHaveBeenCalledWith('in_online_alt', { paid_out_of_band: true }, { idempotencyKey: 'abr-hof_1-2027-02-online-bezahlt' })
    expect(rechnungen.get('in_online_alt')?.status).toBe('paid')
  })

  it('Rechnung online schon finalisiert, aber nicht bezahlt gesetzt: nur noch „bezahlt außerhalb“', async () => {
    db.monatsabrechnung.findUnique.mockResolvedValue({ id: 'abr_1', stand: 'entwurf' })
    db.monatsabrechnung.upsert.mockResolvedValue({ id: 'abr_1', stand: 'entwurf', rechnungBarId: null, rechnungOnlineId: 'in_online_alt' })
    rechnungen.set('in_online_alt', { status: 'open', posten: [{ id: 'ii_1', schluessel: 'o1', amount: 72 }, { id: 'ii_2', schluessel: 'o2', amount: 48 }] })
    await rechneHofAb(HOF, '2027-02', JETZT)
    expect(stripeAttrappe.invoices.finalizeInvoice).not.toHaveBeenCalledWith('in_online_alt', expect.anything(), expect.anything())
    expect(stripeAttrappe.invoices.pay).toHaveBeenCalledWith('in_online_alt', { paid_out_of_band: true }, { idempotencyKey: 'abr-hof_1-2027-02-online-bezahlt' })
  })

  it('über 200 Bestellungen: eine Sammelzeile mit der Summe aus monatsSummen', async () => {
    const viele = Array.from({ length: 201 }, (_, i) => bestellung({ id: `v${i}`, orderNumber: `HM-0227-V${String(i).padStart(3, '0')}`, serviceFeeCents: 72 + (i % 3) }))
    db.order.findMany.mockResolvedValue(bestellZeilen(viele))
    const e = await rechneHofAb(HOF, '2027-02', JETZT)
    expect(e.stand).toBe('offen')
    const bar = stripeAttrappe.invoiceItems.create.mock.calls.filter(([p]) => p.invoice === 'in_bar').map(([p]) => [p.amount, p.description])
    expect(bar).toEqual([[monatsSummen(viele).barCents, 'Plattformgebühr bar · 201 Bestellungen']])
  })

  it('Mandat Pflicht, aber keins da: keine Rechnung bar, bleibt im Entwurf', async () => {
    const e = await rechneHofAb({ ...HOF, sepaMandatAm: null }, '2027-02', JETZT)
    expect(e.stand).toBe('entwurf')
    expect(stripeAttrappe.invoices.create.mock.calls.map(([p]) => p.metadata.art)).toEqual(['online'])
  })
})

describe('rechneMonatsabrechnungen: Abrechnungstag je Hof, ein Fehler hält die anderen nicht auf', () => {
  it('fragt nur Höfe mit Abrechnungstag 3 (Wiener Datum) ab und rechnet den Vormonat; ein Fehler bei einem Hof → Warnung, der nächste läuft', async () => {
    db.farm.findMany.mockImplementation(async (a: { where: Record<string, unknown> }) => {
      if ('gebuehrHinweisAm' in a.where) return []
      return [
        { ...HOF, id: 'hof_kaputt' },
        { ...HOF, id: 'hof_1' },
      ]
    })
    stripeAttrappe.accounts.retrieveCurrent.mockResolvedValue({ business_profile: { name: 'Plattform' }, settings: { invoices: { default_account_tax_ids: ['txi_1'] } } })
    db.monatsabrechnung.findUnique.mockImplementation(async (a: { where: { farmId_monat: { farmId: string } } }) => {
      if (a.where.farmId_monat.farmId === 'hof_kaputt') throw new Error('kaputt')
      return null
    })
    const lauf = await rechneMonatsabrechnungen(JETZT)
    expect(lauf).toEqual(expect.objectContaining({ monat: '2027-02', hoefe: 2, neu: 1, fehler: 1, rechnungsangabenFehlen: false }))
    const abfrage = db.farm.findMany.mock.calls.find(([a]) => 'abrechnungsTag' in a.where)?.[0]
    expect(abfrage.where).toEqual({ abrechnungsTag: 3, orders: { some: { gebuehrModell: 'hofpreis' } } })
  })

  it('ein liegengebliebener Entwurf eines älteren Monats wird im täglichen Lauf nachgezogen', async () => {
    db.farm.findMany.mockResolvedValue([])
    db.monatsabrechnung.findMany.mockResolvedValue([{ monat: new Date('2027-01-01T00:00:00.000Z'), farm: { ...HOF, id: 'hof_alt' } }])
    db.monatsabrechnung.findUnique.mockResolvedValue({ id: 'abr_1', stand: 'entwurf' })
    const lauf = await rechneMonatsabrechnungen(new Date('2027-03-10T05:30:00.000Z'))
    expect(lauf).toEqual(expect.objectContaining({ hoefe: 0, nachgezogen: 1, fehler: 0 }))
    expect(db.monatsabrechnung.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { stand: 'entwurf' } }))
    expect(stripeAttrappe.invoices.create.mock.calls.map(([, o]) => o.idempotencyKey)).toEqual(['abr-hof_alt-2027-01-online', 'abr-hof_alt-2027-01-bar'])
  })

  it('am 4. März ist für Tag-3-Höfe nichts zu tun — die Abfrage fragt Tag 4', async () => {
    db.farm.findMany.mockResolvedValue([])
    await rechneMonatsabrechnungen(new Date('2027-03-04T05:30:00.000Z'))
    const abfrage = db.farm.findMany.mock.calls.find(([a]) => 'abrechnungsTag' in a.where)?.[0]
    expect(abfrage.where.abrechnungsTag).toBe(4)
    expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
  })

  it('Rechnungsangaben fehlen im Stripe-Dashboard: Warnung und Zeile für Heute, kein Abbruch', async () => {
    db.farm.findMany.mockImplementation(async (a: { where: Record<string, unknown> }) => ('gebuehrHinweisAm' in a.where ? [] : [HOF]))
    stripeAttrappe.accounts.retrieveCurrent.mockResolvedValue({ business_profile: { name: null }, settings: { invoices: { default_account_tax_ids: [] } } })
    const lauf = await rechneMonatsabrechnungen(JETZT)
    expect(lauf).toEqual(expect.objectContaining({ neu: 1, rechnungsangabenFehlen: true }))
    expect(db.betriebMessung.upsert).toHaveBeenCalled()
  })
})

describe('Ankündigung vier Wochen vor dem Einzug — genau einmal', () => {
  it('Einzug in 20 Tagen: Vermerk bedingt gesetzt, dann Postfach (SYSTEM, Link Lastschrift) und Mail; schon vermerkt → nichts', async () => {
    const vorJetzt = new Date('2027-01-12T08:00:00.000Z') // 20 Tage vor dem Stichtag 1.2.2027
    db.farm.findMany.mockResolvedValue([{ id: 'hof_1', gruendungBis: null, einzugAb: null }])
    db.farm.updateMany.mockResolvedValue({ count: 1 })
    db.farm.findUnique.mockResolvedValue({ id: 'hof_1', gruendungBis: null, einzugAb: null, plattformgebuehrProzent: null, barMandatPflicht: true, archivedAt: null, owner: { email: 'hof@example.com' } })
    expect(await kuendigeEinzugAn(vorJetzt)).toBe(1)
    expect(db.farm.updateMany).toHaveBeenCalledWith({ where: { id: 'hof_1', gebuehrHinweisAm: null }, data: { gebuehrHinweisAm: vorJetzt } })
    const n = db.unterhaltung.create.mock.calls[0][0].data.nachrichten.create
    expect(n).toEqual(expect.objectContaining({ art: 'SYSTEM', linkUrl: '/settings/konditionen#barzahlung' }))
    expect(n.text).toContain('6 % vom Warenpreis')
    expect(n.text).toContain('Dafür brauchst du eine Lastschrift.')
    expect(vi.mocked(stelleEinOhneRisiko)).toHaveBeenCalledWith('plattformgebuehr-ankuendigung', null, expect.objectContaining({ schluessel: 'plattformgebuehr-ankuendigung:hof_1', bezug: { farmId: 'hof_1' } }))

    vi.clearAllMocks()
    db.farm.findMany.mockResolvedValue([{ id: 'hof_1', gruendungBis: null, einzugAb: null }])
    db.farm.updateMany.mockResolvedValue({ count: 0 })
    expect(await kuendigeEinzugAn(vorJetzt)).toBe(0)
    expect(db.unterhaltung.create).not.toHaveBeenCalled()
    expect(stelleEinOhneRisiko).not.toHaveBeenCalled()
  })

  it('Einzug erst in 40 Tagen: noch nichts', async () => {
    db.farm.findMany.mockResolvedValue([{ id: 'hof_1', gruendungBis: null, einzugAb: null }])
    expect(await kuendigeEinzugAn(new Date('2026-12-23T08:00:00.000Z'))).toBe(0)
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })
})

// ─── Webhooks über die echte Route ───────────────────────────────────────────

function ereignis(type: string, object: Record<string, unknown>, id = 'evt_1') {
  stripeAttrappe.webhooks.constructEvent.mockReturnValue({ id, type, data: { object } })
  return POST(new NextRequest('http://localhost/api/stripe/webhook', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig' } }))
}

describe('Webhooks der Monatsabrechnung', () => {
  it('invoice.payment_failed → gescheitert, offen seit jetzt (falls leer), Postfach-Nachricht und Mail an den Hof', async () => {
    db.monatsabrechnung.findFirst.mockResolvedValue({ id: 'abr_1', farmId: 'hof_1', monat: new Date('2027-02-01T00:00:00.000Z'), farm: { barSperreNachTagen: 14 } })
    const res = await ereignis('invoice.payment_failed', { id: 'in_bar', attempt_count: 1 })
    expect(res.status).toBe(200)
    expect(db.monatsabrechnung.updateMany).toHaveBeenCalledWith({ where: { id: 'abr_1', offenSeit: null, stand: { in: ['offen', 'gescheitert', 'entwurf'] } }, data: { offenSeit: expect.any(Date) } })
    expect(db.monatsabrechnung.updateMany).toHaveBeenCalledWith({ where: { id: 'abr_1', stand: { in: ['offen', 'gescheitert', 'entwurf'] } }, data: { stand: 'gescheitert' } })
    const nachricht = db.unterhaltung.create.mock.calls[0][0].data
    expect(nachricht.farmId).toBe('hof_1')
    expect(nachricht.nachrichten.create).toEqual(expect.objectContaining({ art: 'SYSTEM', text: lastschriftGescheitertText({ monat: 'Februar 2027', tage: 14 }) }))
    expect(vi.mocked(stelleEinOhneRisiko)).toHaveBeenCalledWith(
      'lastschrift-gescheitert',
      null,
      expect.objectContaining({ art: 'lastschrift-gescheitert', bezug: { monatsabrechnungId: 'abr_1' }, schluessel: 'lastschrift-gescheitert:abr_1:1' })
    )
    expect(vi.mocked(protokolliere)).toHaveBeenCalledWith(expect.objectContaining({ wer: null, art: 'lastschrift_gescheitert', bezugArt: 'hof', bezugId: 'hof_1' }))
  })

  it('invoice.paid → bezahlt, eingezogen, offenSeit null; die Rechnung online ändert nichts', async () => {
    db.monatsabrechnung.findFirst.mockResolvedValue({ id: 'abr_1', farmId: 'hof_1', rechnungBarId: 'in_bar' })
    await ereignis('invoice.paid', { id: 'in_bar' })
    expect(db.monatsabrechnung.updateMany).toHaveBeenCalledWith({ where: { id: 'abr_1', stand: { in: ['offen', 'gescheitert', 'entwurf'] } }, data: { stand: 'bezahlt', eingezogenAm: expect.any(Date), offenSeit: null } })
    db.monatsabrechnung.updateMany.mockClear()
    await ereignis('invoice.paid', { id: 'in_online' }, 'evt_2')
    expect(db.monatsabrechnung.updateMany).not.toHaveBeenCalled()
  })

  it('unbekannte Rechnung: nur protokolliert, nichts geändert, 200', async () => {
    db.monatsabrechnung.findFirst.mockResolvedValue(null)
    const res = await ereignis('invoice.payment_failed', { id: 'in_fremd' })
    expect(res.status).toBe(200)
    expect(db.monatsabrechnung.updateMany).not.toHaveBeenCalled()
    expect(db.unterhaltung.create).not.toHaveBeenCalled()
  })

  it('charge.dispute.created zur Rechnungszahlung → zurückgebucht; eine Rückbuchung ohne Rechnung bleibt unberührt', async () => {
    stripeAttrappe.invoicePayments.list.mockResolvedValue({ data: [{ invoice: 'in_bar' }] })
    db.monatsabrechnung.findFirst.mockResolvedValue({ id: 'abr_1', farmId: 'hof_1' })
    await ereignis('charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_rechnung' })
    expect(stripeAttrappe.invoicePayments.list).toHaveBeenCalledWith({ payment: { type: 'payment_intent', payment_intent: 'pi_rechnung' }, limit: 1 })
    expect(db.monatsabrechnung.updateMany).toHaveBeenCalledWith({ where: { id: 'abr_1', stand: { not: 'zurueckgebucht' } }, data: { stand: 'zurueckgebucht', zurueckgebuchtAm: expect.any(Date) } })
    db.monatsabrechnung.updateMany.mockClear()
    stripeAttrappe.invoicePayments.list.mockResolvedValue({ data: [] })
    await ereignis('charge.dispute.created', { id: 'dp_2', payment_intent: 'pi_bestellung' }, 'evt_3')
    expect(db.monatsabrechnung.updateMany).not.toHaveBeenCalled()
  })

  it('Mandat gilt nur über setup_intent.succeeded — der Start im Browser schreibt nichts an den Hof', async () => {
    stripeAttrappe.setupIntents.create.mockResolvedValue({ id: 'seti_1', client_secret: 'seti_secret' })
    expect(await starteLastschrift()).toEqual({ clientSecret: 'seti_secret' })
    expect(stripeAttrappe.setupIntents.create).toHaveBeenCalledWith({ customer: 'cus_1', payment_method_types: ['sepa_debit'], usage: 'off_session', metadata: { farmId: 'hof_1' } })
    expect(db.farm.update).not.toHaveBeenCalled()

    db.farm.findFirst.mockResolvedValue({ id: 'hof_1' })
    await ereignis('setup_intent.succeeded', { id: 'seti_1', customer: 'cus_1', payment_method: 'pm_sepa_1', payment_method_types: ['sepa_debit'], metadata: { farmId: 'hof_1' } })
    expect(db.farm.update).toHaveBeenCalledWith({ where: { id: 'hof_1' }, data: { sepaZahlungsmittelId: 'pm_sepa_1', sepaMandatAm: expect.any(Date) } })
  })

  it('setup_intent.succeeded mit fremdem farmId in den Metadaten: nichts geändert', async () => {
    db.farm.findFirst.mockResolvedValue({ id: 'hof_1' })
    await ereignis('setup_intent.succeeded', { id: 'seti_2', customer: 'cus_1', payment_method: 'pm_x', payment_method_types: ['sepa_debit'], metadata: { farmId: 'hof_anders' } })
    expect(db.farm.update).not.toHaveBeenCalled()
  })

  it('mandate.updated inactive → sepaMandatAm null; active ändert nichts', async () => {
    db.farm.findMany.mockResolvedValue([{ id: 'hof_1' }])
    db.farm.updateMany.mockResolvedValue({ count: 1 })
    await ereignis('mandate.updated', { id: 'mandate_1', status: 'active', payment_method: 'pm_sepa_1' })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
    await ereignis('mandate.updated', { id: 'mandate_1', status: 'inactive', payment_method: 'pm_sepa_1' }, 'evt_4')
    expect(db.farm.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['hof_1'] } }, data: { sepaMandatAm: null } })
  })

  it('Fehler bei Stripe beim Start der Lastschrift: neutraler Satz', async () => {
    stripeAttrappe.setupIntents.create.mockRejectedValue(new Error('down'))
    expect(await starteLastschrift()).toEqual({ error: LASTSCHRIFT_TEXT.fehler })
  })
})

describe('Einstellungen je Hof im Admin', () => {
  it('ohne Recht „Geld“ (oder nicht frisch): Fehler, nichts geschrieben, kein Protokoll', async () => {
    vi.mocked(verlangeAdminAktion).mockResolvedValue({ error: 'Dafür fehlt dir das Recht.' })
    const r = await speichereHofPlattformgebuehr({ farmId: 'hof_1', satz: '6', mandatPflicht: true, sperreTage: 14, abrechnungsTag: 3, einzugAb: '' })
    expect(r).toEqual({ error: 'Dafür fehlt dir das Recht.' })
    expect(verlangeAdminAktion).toHaveBeenCalledWith({ frisch: true, recht: 'geld' })
    expect(db.farm.update).not.toHaveBeenCalled()
    expect(protokolliere).not.toHaveBeenCalled()
  })

  it('mit Recht: gespeichert (Satz als Decimal-Text), Protokoll mit alt → neu; Abrechnungstag 29 abgelehnt', async () => {
    vi.mocked(verlangeAdminAktion).mockResolvedValue({ ok: true, userId: 'admin_1', sitzungId: 's', mitPasskey: true })
    db.farm.findUnique.mockResolvedValue({ plattformgebuehrProzent: null, barMandatPflicht: true, barSperreNachTagen: 14, abrechnungsTag: 3, einzugAb: null })
    expect(await speichereHofPlattformgebuehr({ farmId: 'hof_1', satz: '6,5', mandatPflicht: false, sperreTage: 10, abrechnungsTag: 5, einzugAb: '2028-04-01' })).toEqual({ ok: true })
    expect(db.farm.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ plattformgebuehrProzent: '6.50', barMandatPflicht: false, barSperreNachTagen: 10, abrechnungsTag: 5 }))
    expect(vi.mocked(protokolliere).mock.calls[0][0]).toEqual(
      expect.objectContaining({ art: 'plattformgebuehr_geaendert', bezugId: 'hof_1', mitPasskey: true, grund: expect.stringContaining('Satz 6 → 6,5 %') })
    )
    db.farm.update.mockClear()
    expect(await speichereHofPlattformgebuehr({ farmId: 'hof_1', satz: '6', mandatPflicht: true, sperreTage: 14, abrechnungsTag: 29, einzugAb: '' })).toEqual({ error: expect.stringContaining('1 bis 28') })
    expect(db.farm.update).not.toHaveBeenCalled()
  })
})
