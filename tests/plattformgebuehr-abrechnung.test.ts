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
 *  - Rückbuchung einer Kundenzahlung (Nr. 289, E-022) über die echte Route:
 *    Protokoll mit Betrag und Antwortfrist und eine Zeile `kundenstreit:…` für
 *    Heute; `charge.dispute.closed` schreibt den Ausgang und löscht die Zeile.
 *    Nie eine Änderung an der Bestellung, nie ein schreibender Stripe-Aufruf.
 *  - Einstellungen je Hof ohne Recht → Fehler, nichts geschrieben.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const stripeAttrappe = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  customers: { create: vi.fn() },
  setupIntents: { create: vi.fn() },
  // Nr. 290: `list` sucht die Nachforderung nach einer Rückbuchung.
  invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), pay: vi.fn(), sendInvoice: vi.fn(), retrieve: vi.fn(), del: vi.fn(), list: vi.fn() },
  invoiceItems: { create: vi.fn(), list: vi.fn() },
  invoicePayments: { list: vi.fn() },
  accounts: { retrieveCurrent: vi.fn() },
  paymentMethods: { retrieve: vi.fn() },
  // Nr. 289: nur da, damit ein Aufruf auffiele — die Rückbuchung einer Kundenzahlung bewegt kein Geld.
  refunds: { create: vi.fn() },
  transfers: { createReversal: vi.fn() },
  disputes: { update: vi.fn(), close: vi.fn() },
}))
vi.mock('@/lib/stripe', () => ({ stripe: stripeAttrappe }))

const db = vi.hoisted(() => ({
  farm: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  order: { findMany: vi.fn(), groupBy: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  monatsabrechnung: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  unterhaltung: { create: vi.fn() },
  betriebMessung: { upsert: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))

import { POST } from '@/app/api/stripe/webhook/route'
import { stelleEinOhneRisiko } from '@/server/mail-warteschlange'
import { protokolliere } from '@/server/admin-protokoll'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { kuendigeEinzugAn, rechneHofAb, rechneMonatsabrechnungen, stelleNachforderung } from '@/server/plattformgebuehr-abrechnung'
import { oeffneRechnung, starteLastschrift } from '@/server/actions/lastschrift'
import { klaereRueckbuchung, speichereHofPlattformgebuehr } from '@/server/actions/admin-plattformgebuehr'
import { pruefeStripeObjekt } from '@/schemas/stripe-ereignis'
import { RUECKBUCHUNG_TEXT, SPERRE_TEXT, rueckbuchungGeklaertNachricht } from '@/lib/admin-hof-akte'
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
import { LASTSCHRIFT_HREF, LASTSCHRIFT_TEXT, lastschriftGescheitertText } from '@/lib/konditionen'
import { summeGebuehrPositionen } from '@/lib/plattformgebuehr'
import { captureException } from '@sentry/nextjs'
import { richteRechnungenEin } from './stripe-rechnungen-attrappe'
import { revalidatePath, updateTag } from 'next/cache'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { rechnungSchema } from '@/schemas/plattformgebuehr'
import { ladeSperrKarte } from '@/server/queries/plattformgebuehr'
import { ADMIN_GRUND_FEHLER, adminGrundSchema } from '@/schemas/admin-aktion'
import { centsAlsEuro, formatEuro } from '@/lib/format'

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
    rechnungen.set('in_bar_alt', { status: 'draft', posten: [{ id: 'ii_alt', schluessel: 'b1', amount: 72 }], default_payment_method: 'pm_sepa_1' })
    const e = await rechneHofAb(HOF, '2027-02', JETZT)
    expect(e.stand).toBe('offen')
    expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
    // Nur b2 kommt dazu, mit demselben Schlüssel wie beim ersten Lauf.
    expect(stripeAttrappe.invoiceItems.create.mock.calls.map(([p, o]) => [p.invoice, p.amount, o.idempotencyKey])).toEqual([['in_bar_alt', 270, 'abr-hof_1-2027-02-bar-pos-b2']])
    expect(stripeAttrappe.invoices.finalizeInvoice).toHaveBeenCalledWith('in_bar_alt', { auto_advance: true }, { idempotencyKey: 'abr-hof_1-2027-02-bar-fertig' })
    expect(rechnungen.get('in_bar_alt')?.posten.reduce((s, x) => s + x.amount, 0)).toBe(342)
    // Die Rechnung online ist schon bezahlt: nichts mehr daran.
    expect(stripeAttrappe.invoices.pay).not.toHaveBeenCalled()
    // Gegenprobe zum Wegwechsel: Einzugsweg unverändert (Lastschrift) → der Entwurf bleibt, nichts gelöscht.
    expect(stripeAttrappe.invoices.del).not.toHaveBeenCalled()
  })

  it('Rechnungsbetrag weicht von der Summe ab: Warnung, nicht finalisiert, bleibt im Entwurf', async () => {
    db.monatsabrechnung.findUnique.mockResolvedValue({ id: 'abr_1', stand: 'entwurf' })
    db.monatsabrechnung.upsert.mockResolvedValue({ id: 'abr_1', stand: 'entwurf', rechnungBarId: 'in_bar_alt', rechnungOnlineId: 'in_online_alt' })
    rechnungen.set('in_online_alt', { status: 'paid', posten: [] })
    rechnungen.set('in_bar_alt', { status: 'draft', posten: [{ id: 'ii_fremd', schluessel: 'b9', amount: 999 }], default_payment_method: 'pm_sepa_1' })
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

  // ─── Einzugsweg geändert, während die Rechnung bar im Entwurf liegt ────────
  const ENTWURF_BAR = { id: 'abr_1', stand: 'entwurf', rechnungBarId: 'in_bar_alt', rechnungOnlineId: 'in_online_alt' }
  function entwurfVorbelegen(weg: 'charge_automatically' | 'send_invoice'): void {
    db.monatsabrechnung.findUnique.mockResolvedValue({ id: 'abr_1', stand: 'entwurf' })
    db.monatsabrechnung.upsert.mockResolvedValue(ENTWURF_BAR)
    rechnungen.set('in_online_alt', { status: 'paid', posten: [] })
    rechnungen.set('in_bar_alt', { status: 'draft', posten: [{ id: 'ii_alt', schluessel: 'b1', amount: 72 }], collection_method: weg, default_payment_method: weg === 'charge_automatically' ? 'pm_sepa_1' : undefined })
  }
  const OHNE_MANDAT = { ...HOF, barMandatPflicht: false, sepaMandatAm: null, sepaZahlungsmittelId: null, barSperreNachTagen: 10 }

  it('Mandat entfernt (Pflicht aus): Lastschrift-Entwurf gelöscht, neu als Überweisung mit neuem Schlüssel; offen ab dem Senden', async () => {
    entwurfVorbelegen('charge_automatically')
    const e = await rechneHofAb(OHNE_MANDAT, '2027-02', JETZT)
    expect(e.stand).toBe('offen')
    expect(stripeAttrappe.invoices.del).toHaveBeenCalledWith('in_bar_alt')
    expect(rechnungen.has('in_bar_alt')).toBe(false)
    const [p, o] = stripeAttrappe.invoices.create.mock.calls[0]
    expect(p).toEqual(expect.objectContaining({ collection_method: 'send_invoice', days_until_due: 10 }))
    expect(o).toEqual({ idempotencyKey: 'abr-hof_1-2027-02-bar-ersetzt-in_bar_alt' })
    const neueId = (await stripeAttrappe.invoices.create.mock.results[0].value).id as string
    expect(neueId).not.toBe('in_bar_alt')
    expect(db.monatsabrechnung.update).toHaveBeenCalledWith({ where: { id: 'abr_1' }, data: { rechnungBarId: neueId } })
    // Alle Positionen neu, mit dem neuen Schlüssel — die alten Schlüssel gäben sonst die gelöschten Posten zurück.
    expect(stripeAttrappe.invoiceItems.create.mock.calls.map(([q, k]) => [q.invoice, q.amount, k.idempotencyKey])).toEqual([
      [neueId, 72, 'abr-hof_1-2027-02-bar-ersetzt-in_bar_alt-pos-b1'],
      [neueId, 270, 'abr-hof_1-2027-02-bar-ersetzt-in_bar_alt-pos-b2'],
    ])
    expect(stripeAttrappe.invoices.finalizeInvoice).toHaveBeenCalledWith(neueId, { auto_advance: false }, { idempotencyKey: 'abr-hof_1-2027-02-bar-ersetzt-in_bar_alt-fertig' })
    expect(stripeAttrappe.invoices.sendInvoice).toHaveBeenCalledWith(neueId, {}, { idempotencyKey: 'abr-hof_1-2027-02-bar-ersetzt-in_bar_alt-senden' })
    expect(db.monatsabrechnung.updateMany).toHaveBeenLastCalledWith({ where: { id: 'abr_1', stand: 'entwurf' }, data: { stand: 'offen', offenSeit: JETZT } })
  })

  it('Mandat neu: Überweisungs-Entwurf gelöscht, neu als Lastschrift mit dem SEPA-Zahlungsmittel; nichts gesendet, offenSeit leer', async () => {
    entwurfVorbelegen('send_invoice')
    const e = await rechneHofAb(HOF, '2027-02', JETZT)
    expect(e.stand).toBe('offen')
    expect(stripeAttrappe.invoices.del).toHaveBeenCalledWith('in_bar_alt')
    expect(stripeAttrappe.invoices.create.mock.calls[0]).toEqual([
      expect.objectContaining({ collection_method: 'charge_automatically', default_payment_method: 'pm_sepa_1' }),
      { idempotencyKey: 'abr-hof_1-2027-02-bar-ersetzt-in_bar_alt' },
    ])
    expect(stripeAttrappe.invoices.finalizeInvoice).toHaveBeenCalledWith(expect.not.stringMatching(/^in_bar_alt$/), { auto_advance: true }, { idempotencyKey: 'abr-hof_1-2027-02-bar-ersetzt-in_bar_alt-fertig' })
    expect(stripeAttrappe.invoices.sendInvoice).not.toHaveBeenCalled()
    expect(db.monatsabrechnung.updateMany).toHaveBeenLastCalledWith({ where: { id: 'abr_1', stand: 'entwurf' }, data: { stand: 'offen', offenSeit: null } })
  })

  it('Lastschrift geändert (neues Zahlungsmittel): Entwurf mit dem alten ersetzt; Gegenprobe gleiches Zahlungsmittel → bleibt', async () => {
    entwurfVorbelegen('charge_automatically')
    await rechneHofAb({ ...HOF, sepaZahlungsmittelId: 'pm_sepa_2' }, '2027-02', JETZT)
    expect(stripeAttrappe.invoices.del).toHaveBeenCalledWith('in_bar_alt')
    expect(stripeAttrappe.invoices.create.mock.calls[0][0]).toEqual(expect.objectContaining({ default_payment_method: 'pm_sepa_2' }))
  })

  it('Entwurf lässt sich nicht löschen: Warnung, kein neuer Entwurf, nichts finalisiert, bleibt im Entwurf', async () => {
    entwurfVorbelegen('charge_automatically')
    stripeAttrappe.invoices.del.mockRejectedValue(new Error('gesperrt'))
    const e = await rechneHofAb(OHNE_MANDAT, '2027-02', JETZT)
    expect(e).toEqual({ farmId: 'hof_1', monat: '2027-02', stand: 'entwurf', neu: false })
    expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
    expect(stripeAttrappe.invoices.finalizeInvoice).not.toHaveBeenCalled()
    expect(rechnungen.get('in_bar_alt')?.status).toBe('draft')
    expect(vi.mocked(captureException)).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Monatsabrechnung: Einzugsweg geändert, Entwurf ließ sich nicht löschen — bleibt stehen' }),
      expect.anything()
    )
  })

  it('Abbruch nach dem Löschen (gespeicherte Rechnung fehlt bei Stripe): neu mit dem Ersatz-Schlüssel, keine Warnung über den Stand', async () => {
    db.monatsabrechnung.findUnique.mockResolvedValue({ id: 'abr_1', stand: 'entwurf' })
    db.monatsabrechnung.upsert.mockResolvedValue({ ...ENTWURF_BAR, rechnungBarId: 'in_bar_weg' })
    rechnungen.set('in_online_alt', { status: 'paid', posten: [] })
    const e = await rechneHofAb(OHNE_MANDAT, '2027-02', JETZT)
    expect(e.stand).toBe('offen')
    expect(stripeAttrappe.invoices.create.mock.calls[0][1]).toEqual({ idempotencyKey: 'abr-hof_1-2027-02-bar-ersetzt-in_bar_weg' })
  })

  it('schon finalisierte Rechnung wird nie gelöscht; der Weg der Rechnung zählt (Lastschrift → nichts senden, offenSeit leer)', async () => {
    entwurfVorbelegen('charge_automatically')
    rechnungen.set('in_bar_alt', { status: 'open', posten: [{ id: 'ii_1', schluessel: 'b1', amount: 72 }, { id: 'ii_2', schluessel: 'b2', amount: 270 }], collection_method: 'charge_automatically' })
    const e = await rechneHofAb(OHNE_MANDAT, '2027-02', JETZT)
    expect(e.stand).toBe('offen')
    expect(stripeAttrappe.invoices.del).not.toHaveBeenCalled()
    expect(stripeAttrappe.invoices.sendInvoice).not.toHaveBeenCalled()
    expect(db.monatsabrechnung.updateMany).toHaveBeenLastCalledWith({ where: { id: 'abr_1', stand: 'entwurf' }, data: { stand: 'offen', offenSeit: null } })
  })

  // ─── Ein schnellerer Webhook hat den Stand schon weitergesetzt ─────────────
  it('updateMany auf „entwurf“ trifft nichts (Webhook war schneller): kein Protokoll, Rückgabe mit dem echten Stand, nicht neu', async () => {
    db.monatsabrechnung.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ stand: 'bezahlt' })
    db.monatsabrechnung.updateMany.mockResolvedValue({ count: 0 })
    const e = await rechneHofAb(HOF, '2027-02', JETZT)
    expect(e).toEqual({ farmId: 'hof_1', monat: '2027-02', stand: 'bezahlt', neu: false })
    expect(protokolliere).not.toHaveBeenCalled()
  })

  it('auch bei 0 € bar: count 0 → kein Protokoll, echter Stand; Gegenprobe count 1 → protokolliert und neu', async () => {
    db.order.findMany.mockResolvedValue(bestellZeilen(MAERZ))
    db.monatsabrechnung.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ stand: 'nichts' })
    db.monatsabrechnung.updateMany.mockResolvedValueOnce({ count: 0 })
    expect(await rechneHofAb(HOF, '2027-03', JETZT)).toEqual({ farmId: 'hof_1', monat: '2027-03', stand: 'nichts', neu: false })
    expect(protokolliere).not.toHaveBeenCalled()
    rechnungen = richteRechnungenEin(stripeAttrappe, (art) => `in_${art}`)
    expect(await rechneHofAb(HOF, '2027-03', JETZT)).toEqual({ farmId: 'hof_1', monat: '2027-03', stand: 'nichts', neu: true })
    expect(vi.mocked(protokolliere).mock.calls[0][0]).toEqual(expect.objectContaining({ art: 'monatsabrechnung_erstellt' }))
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

  it('charge.dispute.created zur Rechnungszahlung → zurückgebucht; eine Rückbuchung ohne Rechnung und ohne Bestellung: eine Warnung, nichts geschrieben', async () => {
    stripeAttrappe.invoicePayments.list.mockResolvedValue({ data: [{ invoice: 'in_bar' }] })
    // Nr. 290: Monat und Summe braucht der Nachlauf (Nachricht, Nachforderung).
    db.monatsabrechnung.findFirst.mockResolvedValue({ id: 'abr_1', farmId: 'hof_1', monat: new Date('2027-02-01T00:00:00.000Z'), summeCents: 342 })
    await ereignis('charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_rechnung' })
    expect(stripeAttrappe.invoicePayments.list).toHaveBeenCalledWith({ payment: { type: 'payment_intent', payment_intent: 'pi_rechnung' }, limit: 1 })
    expect(db.monatsabrechnung.updateMany).toHaveBeenCalledWith({ where: { id: 'abr_1', stand: { not: 'zurueckgebucht' } }, data: { stand: 'zurueckgebucht', zurueckgebuchtAm: expect.any(Date) } })
    db.monatsabrechnung.updateMany.mockClear()
    vi.mocked(protokolliere).mockClear()
    // Nr. 289 (E-022, Fall c): Zahlung ohne Rechnung, aber auch keine Bestellung — eine Warnung mit der Kennung, sonst nichts.
    stripeAttrappe.invoicePayments.list.mockResolvedValue({ data: [] })
    db.order.findUnique.mockResolvedValue(null)
    const res = await ereignis('charge.dispute.created', { id: 'dp_2', payment_intent: 'pi_bestellung' }, 'evt_3')
    expect(res.status).toBe(200)
    expect(db.order.findUnique).toHaveBeenCalledWith({ where: { stripePaymentIntentId: 'pi_bestellung' }, select: { id: true } })
    expect(db.monatsabrechnung.updateMany).not.toHaveBeenCalled()
    expect(protokolliere).not.toHaveBeenCalled()
    expect(db.betriebMessung.createMany).not.toHaveBeenCalled()
    expect(vi.mocked(captureException).mock.calls).toEqual([
      [expect.objectContaining({ message: 'Rückbuchung ohne Rechnung und ohne Bestellung' }), { level: 'warning', tags: { bereich: 'monatsabrechnung', aufgabe: 'rueckbuchung-unbekannt' }, extra: { streit: 'dp_2' } }],
    ])
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

// ─── Rückbuchung einer Kundenzahlung (Nr. 289, E-022) ───────────────────────

describe('Rückbuchung einer Kundenzahlung (Nr. 289, E-022): sichtbar machen, kein Geld bewegen', () => {
  // Freitag, 5. März 2027, 10:15 in Wien — die Route setzt ihren Zeitpunkt selbst, darum steht die Uhr.
  const STREIT_JETZT = new Date('2027-03-05T09:15:00.000Z')
  // Sonntag, 14. März 2027, 23:59:59 in Wien.
  const DUE_BY = Math.floor(Date.parse('2027-03-14T22:59:59.000Z') / 1000)
  const SIEBEN_TAGE = Math.floor((STREIT_JETZT.getTime() + 7 * TAG) / 1000)
  const BETRAG = 1234567

  function streit(teil: Record<string, unknown> = {}): Record<string, unknown> {
    return { id: 'dp_kunde_a', object: 'dispute', payment_intent: 'pi_kunde', amount: BETRAG, status: 'needs_response', evidence_details: { due_by: DUE_BY }, ...teil }
  }

  /** Kein Geld, keine Bestellung, kein Stripe-Schreiben — für jeden Fall dasselbe. */
  function nichtsBewegt(): void {
    expect(db.order.update).not.toHaveBeenCalled()
    expect(db.order.updateMany).not.toHaveBeenCalled()
    expect(db.monatsabrechnung.updateMany).not.toHaveBeenCalled()
    for (const schreiben of [stripeAttrappe.refunds.create, stripeAttrappe.transfers.createReversal, stripeAttrappe.disputes.update, stripeAttrappe.disputes.close, stripeAttrappe.invoices.create]) {
      expect(schreiben).not.toHaveBeenCalled()
    }
    expect(stelleEinOhneRisiko).not.toHaveBeenCalled()
    expect(db.unterhaltung.create).not.toHaveBeenCalled()
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: STREIT_JETZT, toFake: ['Date'] })
    stripeAttrappe.invoicePayments.list.mockResolvedValue({ data: [] })
    db.order.findUnique.mockResolvedValue({ id: 'bestellung-kunde' })
    db.betriebMessung.createMany.mockResolvedValue({ count: 1 })
    db.betriebMessung.deleteMany.mockResolvedValue({ count: 1 })
    return () => vi.useRealTimers()
  })

  it('(a) created zu einer Rechnungszahlung: zurückgebucht wie bisher, kein Eintrag zur Kundenzahlung, keine Zeile', async () => {
    stripeAttrappe.invoicePayments.list.mockResolvedValue({ data: [{ invoice: 'in_bar' }] })
    // Nr. 290: Monat und Summe braucht der Nachlauf (Nachricht, Nachforderung).
    db.monatsabrechnung.findFirst.mockResolvedValue({ id: 'abr_1', farmId: 'hof_1', monat: new Date('2027-02-01T00:00:00.000Z'), summeCents: BETRAG })
    await ereignis('charge.dispute.created', streit({ payment_intent: 'pi_rechnung' }))
    expect(db.monatsabrechnung.updateMany).toHaveBeenCalledWith({ where: { id: 'abr_1', stand: { not: 'zurueckgebucht' } }, data: { stand: 'zurueckgebucht', zurueckgebuchtAm: STREIT_JETZT } })
    expect(vi.mocked(protokolliere).mock.calls.map(([e]) => e.art)).toEqual(['lastschrift_zurueckgebucht'])
    expect(db.order.findUnique).not.toHaveBeenCalled()
    expect(db.betriebMessung.createMany).not.toHaveBeenCalled()
  })

  it('(b) created zu einer Bestellung, needs_response, 12.345,67 €: genau ein Eintrag „zurückgebucht“, Grund mit Betrag und Frist, Zeile mit der Frist', async () => {
    const res = await ereignis('charge.dispute.created', streit())
    expect(res.status).toBe(200)
    expect(db.order.findUnique).toHaveBeenCalledWith({ where: { stripePaymentIntentId: 'pi_kunde' }, select: { id: true } })
    const eintraege = vi.mocked(protokolliere).mock.calls.map(([e]) => e)
    expect(eintraege).toEqual([
      {
        wer: null,
        art: 'kundenzahlung_zurueckgebucht',
        bezugArt: 'bestellung',
        bezugId: 'bestellung-kunde',
        mitPasskey: false,
        grund: `Rückbuchung dp_kunde_a · ${formatEuro(centsAlsEuro(BETRAG))} · Antwort bis 14.\u00a0März 2027`,
      },
    ])
    // Der Grund überlebt die Prüfung des Protokolls — sonst stünde der Eintrag ohne Grund da.
    expect(adminGrundSchema.safeParse(eintraege[0]?.grund).success).toBe(true)
    expect(db.betriebMessung.createMany).toHaveBeenCalledWith({
      data: [{ tag: new Date('2027-03-05T00:00:00.000Z'), art: 'kundenstreit:bestellung-kunde:dp_kunde_a:rueckbuchung', wert: BigInt(DUE_BY), gemessenAm: STREIT_JETZT }],
      skipDuplicates: true,
    })
    // Erst das Protokoll, dann die Zeile (Block 289, Umsetzung 3).
    expect(vi.mocked(protokolliere).mock.invocationCallOrder[0]).toBeLessThan(db.betriebMessung.createMany.mock.invocationCallOrder[0] ?? 0)
    expect(captureException).not.toHaveBeenCalled()
    nichtsBewegt()
  })

  it('(b2) warning_needs_response: Eintrag „Rückfrage“, Grund beginnt mit „Rückfrage“, Zeile als rueckfrage', async () => {
    await ereignis('charge.dispute.created', streit({ status: 'warning_needs_response' }))
    const [eintrag] = vi.mocked(protokolliere).mock.calls.map(([e]) => e)
    expect(eintrag).toEqual(expect.objectContaining({ art: 'kundenzahlung_rueckfrage', bezugArt: 'bestellung', bezugId: 'bestellung-kunde', wer: null }))
    expect(eintrag?.grund).toMatch(/^Rückfrage dp_kunde_a · /)
    expect(db.betriebMessung.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ art: 'kundenstreit:bestellung-kunde:dp_kunde_a:rueckfrage' })] }))
    nichtsBewegt()
  })

  it('(b3) Kennung mit sieben Ziffern: Eintrag mit Grund ohne Kennung, eine Warnung; die Zeile behält die Kennung', async () => {
    await ereignis('charge.dispute.created', streit({ id: 'dp_1234567ab' }))
    const [eintrag] = vi.mocked(protokolliere).mock.calls.map(([e]) => e)
    expect(eintrag?.grund).toBe(`Rückbuchung · ${formatEuro(centsAlsEuro(BETRAG))} · Antwort bis 14.\u00a0März 2027`)
    expect(adminGrundSchema.safeParse(eintrag?.grund).success).toBe(true)
    expect(vi.mocked(captureException).mock.calls).toEqual([[expect.any(Error), expect.objectContaining({ tags: { bereich: 'monatsabrechnung', aufgabe: 'rueckbuchung-grund' } })]])
    expect(db.betriebMessung.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ art: 'kundenstreit:bestellung-kunde:dp_1234567ab:rueckbuchung' })] }))
  })

  it('ohne Betrag: Grund ohne Betrag und eine Warnung — der Eintrag steht trotzdem', async () => {
    await ereignis('charge.dispute.created', streit({ amount: null }))
    const [eintrag] = vi.mocked(protokolliere).mock.calls.map(([e]) => e)
    expect(eintrag?.grund).toBe('Rückbuchung dp_kunde_a · Antwort bis 14.\u00a0März 2027')
    expect(vi.mocked(captureException).mock.calls).toEqual([[expect.any(Error), expect.objectContaining({ tags: { bereich: 'monatsabrechnung', aufgabe: 'rueckbuchung-betrag' } })]])
  })

  it('(d) ohne evidence_details: Frist Eingang + 7 Tage', async () => {
    await ereignis('charge.dispute.created', streit({ evidence_details: undefined }))
    expect(vi.mocked(protokolliere).mock.calls[0]?.[0].grund).toBe(`Rückbuchung dp_kunde_a · ${formatEuro(centsAlsEuro(BETRAG))} · Antwort bis 12.\u00a0März 2027`)
    expect(db.betriebMessung.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ wert: BigInt(SIEBEN_TAGE) })] }))
  })

  it.each([
    ['won', 'dp_kunde_a · gewonnen'],
    ['lost', 'dp_kunde_a · verloren'],
    ['warning_closed', 'dp_kunde_a · ohne Rückbuchung beendet (warning_closed)'],
  ])('(e) closed mit %s: Eintrag „abgeschlossen“ mit dem Ausgang, Zeile gelöscht', async (status, grund) => {
    await ereignis('charge.dispute.closed', streit({ status }))
    expect(vi.mocked(protokolliere).mock.calls.map(([e]) => e)).toEqual([
      { wer: null, art: 'kundenzahlung_rueckbuchung_abgeschlossen', bezugArt: 'bestellung', bezugId: 'bestellung-kunde', mitPasskey: false, grund },
    ])
    expect(db.betriebMessung.deleteMany).toHaveBeenCalledWith({ where: { art: { startsWith: 'kundenstreit:bestellung-kunde:dp_kunde_a:' } } })
    // Protokoll wie bei created, dann die Zeile weg (Umsetzung 4).
    expect(vi.mocked(protokolliere).mock.invocationCallOrder[0]).toBeLessThan(db.betriebMessung.deleteMany.mock.invocationCallOrder[0] ?? 0)
    expect(db.betriebMessung.createMany).not.toHaveBeenCalled()
    nichtsBewegt()
  })

  it('(e) closed: ein langer fremder Stand wird auf 50 Zeichen gekürzt', async () => {
    const lang = 'x'.repeat(50)
    await ereignis('charge.dispute.closed', streit({ status: lang }))
    expect(vi.mocked(protokolliere).mock.calls[0]?.[0].grund).toBe(`dp_kunde_a · ohne Rückbuchung beendet (${lang})`)
  })

  it('(f) closed zu einer Rechnungszahlung: nichts — kein Eintrag, keine Zeile, keine Bestellung gesucht', async () => {
    stripeAttrappe.invoicePayments.list.mockResolvedValue({ data: [{ invoice: 'in_bar' }] })
    await ereignis('charge.dispute.closed', streit({ status: 'lost' }))
    expect(protokolliere).not.toHaveBeenCalled()
    expect(db.order.findUnique).not.toHaveBeenCalled()
    expect(db.betriebMessung.deleteMany).not.toHaveBeenCalled()
    expect(db.monatsabrechnung.findFirst).not.toHaveBeenCalled()
    nichtsBewegt()
  })

  it('closed ohne Bestellung: nichts', async () => {
    db.order.findUnique.mockResolvedValue(null)
    await ereignis('charge.dispute.closed', streit({ status: 'won' }))
    expect(protokolliere).not.toHaveBeenCalled()
    expect(db.betriebMessung.deleteMany).not.toHaveBeenCalled()
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
    db.farm.findUnique.mockResolvedValue({ slug: 'hof-probe', plattformgebuehrProzent: null, barMandatPflicht: true, barSperreNachTagen: 14, abrechnungsTag: 3, einzugAb: null })
    expect(await speichereHofPlattformgebuehr({ farmId: 'hof_1', satz: '6,5', mandatPflicht: false, sperreTage: 10, abrechnungsTag: 5, einzugAb: '2028-04-01' })).toEqual({ ok: true })
    expect(db.farm.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ plattformgebuehrProzent: '6.50', barMandatPflicht: false, barSperreNachTagen: 10, abrechnungsTag: 5 }))
    expect(vi.mocked(protokolliere).mock.calls[0][0]).toEqual(
      expect.objectContaining({ art: 'plattformgebuehr_geaendert', bezugId: 'hof_1', mitPasskey: true, grund: expect.stringContaining('Satz 6 → 6,5 %') })
    )
    // Der Satz steht auf der Hofseite und in der Hofübersicht: beide neu laden (wie admin-hof.ts).
    expect(revalidatePath).toHaveBeenCalledWith('/hof-probe')
    expect(updateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG)
    db.farm.update.mockClear()
    vi.mocked(updateTag).mockClear()
    expect(await speichereHofPlattformgebuehr({ farmId: 'hof_1', satz: '6', mandatPflicht: true, sperreTage: 14, abrechnungsTag: 29, einzugAb: '' })).toEqual({ error: expect.stringContaining('1 bis 28') })
    expect(db.farm.update).not.toHaveBeenCalled()
    // Gegenprobe: abgelehnt → nichts neu geladen.
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('Rechnung öffnen: Schema unter src/schemas', () => {
  it('nimmt Kennung, Art und Ziel; lehnt Fremdes ab', () => {
    expect(rechnungSchema.safeParse({ abrechnungId: 'a_1', art: 'bar', ziel: 'bezahlen' }).success).toBe(true)
    expect(rechnungSchema.safeParse({ abrechnungId: 'a 1', art: 'bar', ziel: 'pdf' }).success).toBe(false)
    expect(rechnungSchema.safeParse({ abrechnungId: 'a1', art: 'bar', ziel: 'loeschen' }).success).toBe(false)
  })
})

describe('Hof › Heute: welche Abrechnung die Karte zeigt', () => {
  it('zurückgebucht geht vor offen (Bezahlen hebt die Pause dann nicht auf) und kommt mit Stand; ohne sperrende → null', async () => {
    db.farm.findUnique.mockResolvedValue({ barSperreNachTagen: 14 })
    const alt = new Date(JETZT.getTime() - 30 * TAG)
    db.monatsabrechnung.findMany.mockResolvedValue([
      { id: 'a_jan', monat: new Date('2027-01-01T00:00:00.000Z'), stand: 'offen', offenSeit: alt, rechnungBarId: 'in_1' },
      { id: 'a_feb', monat: new Date('2027-02-01T00:00:00.000Z'), stand: 'zurueckgebucht', offenSeit: null, rechnungBarId: 'in_2' },
    ])
    expect(await ladeSperrKarte('hof_1', JETZT)).toEqual({ abrechnungId: 'a_feb', monatText: 'Februar 2027', stand: 'zurueckgebucht' })
    // Gegenprobe: nur die offene → sie, mit Stand „offen“.
    db.monatsabrechnung.findMany.mockResolvedValue([{ id: 'a_jan', monat: new Date('2027-01-01T00:00:00.000Z'), stand: 'offen', offenSeit: alt, rechnungBarId: 'in_1' }])
    expect(await ladeSperrKarte('hof_1', JETZT)).toEqual({ abrechnungId: 'a_jan', monatText: 'Jänner 2027', stand: 'offen' })
    db.monatsabrechnung.findMany.mockResolvedValue([])
    expect(await ladeSperrKarte('hof_1', JETZT)).toBeNull()
  })
})

// ─── Rücklastschrift: Nachforderung und Notweg (Nr. 290, A007) ───────────────

describe('Rücklastschrift: Nachforderung und Notweg (Nr. 290)', () => {
  /** Die Abrechnung, wie die Datenbank sie hält — die Attrappe schreibt bedingt wie Postgres. */
  type Zeile = { id: string; farmId: string; monat: Date; summeCents: number; rechnungBarId: string | null; stand: string; eingezogenAm: Date | null; offenSeit: Date | null; zurueckgebuchtAm: Date | null }
  let zeile: Zeile
  /** Metadaten je Rechnung bei Stripe (die Rechnungs-Attrappe kennt nur Stand und Positionen). */
  let metadaten: Map<string, Record<string, string>>
  const NACHFORDERUNG = 'in_nachforderung'
  const META = { farmId: 'hof_1', monat: '2027-02', art: 'nachforderung', abrechnungId: 'abr_1' }

  function passt(bedingung: unknown, wert: unknown): boolean {
    if (bedingung === undefined) return true
    if (bedingung !== null && typeof bedingung === 'object') {
      const b = bedingung as { not?: unknown; in?: unknown[] }
      if ('not' in b) return wert !== b.not
      if ('in' in b) return (b.in ?? []).includes(wert)
    }
    return bedingung === wert
  }
  function trifft(where: Record<string, unknown>): boolean {
    return ['id', 'farmId', 'stand', 'rechnungBarId', 'offenSeit'].every((k) => passt(where[k], zeile[k as keyof Zeile]))
  }
  function waehle<T extends Record<string, unknown>>(select: Record<string, unknown> | undefined, z: T): Partial<T> {
    if (!select) return z
    return Object.fromEntries(Object.keys(select).filter((k) => k !== 'farm').map((k) => [k, z[k]])) as Partial<T>
  }
  const HOF_ZUR_ABRECHNUNG = { stripeKundeId: 'cus_1', barSperreNachTagen: 14 }

  function warnungen(): string[] {
    return vi.mocked(captureException).mock.calls.map(([, k]) => (k as { tags: { aufgabe: string } }).tags.aufgabe)
  }
  function arten(): string[] {
    return vi.mocked(protokolliere).mock.calls.map(([e]) => e.art)
  }

  beforeEach(() => {
    zeile = { id: 'abr_1', farmId: 'hof_1', monat: new Date('2027-02-01T00:00:00.000Z'), summeCents: 342, rechnungBarId: 'in_bar', stand: 'offen', eingezogenAm: null, offenSeit: null, zurueckgebuchtAm: null }
    metadaten = new Map()
    // Die Rechnung bar des Monats: bezahlt per Lastschrift, Betrag = Summe.
    rechnungen.set('in_bar', { status: 'paid', posten: [{ id: 'ii_bar', schluessel: 'b1', amount: 342 }], collection_method: 'charge_automatically' })
    const anlegen = stripeAttrappe.invoices.create.getMockImplementation()
    stripeAttrappe.invoices.create.mockImplementation(async (p: { metadata: Record<string, string> }, o?: { idempotencyKey?: string }) => {
      const r = await anlegen?.(p, o)
      metadaten.set(r.id, p.metadata)
      return r
    })
    stripeAttrappe.invoices.list.mockImplementation(async (p: { customer: string }) => ({
      data: p.customer === 'cus_1' ? [...metadaten].map(([id, metadata]) => ({ id, status: rechnungen.get(id)?.status ?? 'void', metadata, hosted_invoice_url: `https://rechnung.example.com/${id}`, invoice_pdf: `https://rechnung.example.com/${id}.pdf` })) : [],
      has_more: false,
    }))
    stripeAttrappe.invoicePayments.list.mockResolvedValue({ data: [{ invoice: 'in_bar' }] })
    db.monatsabrechnung.findFirst.mockImplementation(async (a: { where: Record<string, unknown>; select?: Record<string, unknown> }) => {
      const oder = a.where.OR as Record<string, unknown>[] | undefined
      const gefunden = oder ? oder.some((o) => o.rechnungBarId === zeile.rechnungBarId) : trifft(a.where)
      return gefunden ? { ...waehle(a.select, zeile), ...(a.select?.farm ? { farm: HOF_ZUR_ABRECHNUNG } : {}) } : null
    })
    db.monatsabrechnung.findUnique.mockImplementation(async (a: { where: { id: string }; select?: Record<string, unknown> }) =>
      a.where.id === zeile.id ? { ...waehle(a.select, zeile), ...(a.select?.farm ? { farm: HOF_ZUR_ABRECHNUNG } : {}) } : null
    )
    db.monatsabrechnung.findMany.mockImplementation(async (a: { where: Record<string, unknown> }) => (a.where.stand === 'zurueckgebucht' && zeile.stand === 'zurueckgebucht' ? [{ id: zeile.id }] : []))
    db.monatsabrechnung.updateMany.mockImplementation(async (a: { where: Record<string, unknown>; data: Partial<Zeile> }) => {
      if (!trifft(a.where)) return { count: 0 }
      Object.assign(zeile, a.data)
      return { count: 1 }
    })
    db.farm.findMany.mockResolvedValue([])
    vi.mocked(verlangeAdminAktion).mockResolvedValue({ ok: true, userId: 'admin_1', sitzungId: 's', mitPasskey: true })
    return () => {
      db.monatsabrechnung.findFirst.mockReset()
      db.monatsabrechnung.findUnique.mockReset()
      db.monatsabrechnung.findMany.mockReset()
      db.monatsabrechnung.updateMany.mockReset()
      db.farm.findMany.mockReset()
      stripeAttrappe.invoices.list.mockReset()
      stripeAttrappe.invoicePayments.list.mockReset()
    }
  })

  describe('Rückbuchung → Nachricht und Nachforderung', () => {
    it('(a) created zur Rechnungszahlung: zurückgebucht, eine Nachricht, genau eine Nachforderung über die Summe – angelegt, finalisiert, gesendet; dasselbe Ereignis noch einmal legt nichts an', async () => {
      const res = await ereignis('charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_rechnung', amount: 342 })
      expect(res.status).toBe(200)
      expect(zeile.stand).toBe('zurueckgebucht')
      expect(db.unterhaltung.create).toHaveBeenCalledTimes(1)
      const nachricht = db.unterhaltung.create.mock.calls[0][0].data
      expect(nachricht.farmId).toBe('hof_1')
      expect(nachricht.nachrichten.create).toEqual(expect.objectContaining({ art: 'SYSTEM', linkUrl: LASTSCHRIFT_HREF, text: LASTSCHRIFT_TEXT.zurueckgebuchtSatz('Februar 2027') }))
      expect(stripeAttrappe.invoices.create).toHaveBeenCalledTimes(1)
      expect(stripeAttrappe.invoices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_1',
          currency: 'eur',
          auto_advance: false,
          collection_method: 'send_invoice',
          days_until_due: 14,
          description: 'Plattformgebühr Februar 2027 · zurückgebuchte Lastschrift',
          metadata: META,
        }),
        { idempotencyKey: 'abr-hof_1-2027-02-nachforderung' }
      )
      expect(stripeAttrappe.invoiceItems.create.mock.calls.map(([p, o]) => [p.invoice, p.amount, o.idempotencyKey])).toEqual([[NACHFORDERUNG, 342, 'abr-hof_1-2027-02-nachforderung-pos-nachforderung']])
      expect(stripeAttrappe.invoices.finalizeInvoice).toHaveBeenCalledWith(NACHFORDERUNG, { auto_advance: false }, { idempotencyKey: 'abr-hof_1-2027-02-nachforderung-fertig' })
      expect(stripeAttrappe.invoices.sendInvoice).toHaveBeenCalledWith(NACHFORDERUNG, {}, { idempotencyKey: 'abr-hof_1-2027-02-nachforderung-senden' })
      expect(arten()).toEqual(['lastschrift_zurueckgebucht', 'lastschrift_nachforderung_erstellt'])
      expect(vi.mocked(protokolliere).mock.calls[1][0]).toEqual(expect.objectContaining({ wer: null, bezugArt: 'hof', bezugId: 'hof_1', mitPasskey: false, grund: 'Monatsabrechnung 2027-02' }))
      // Ohne den Startsatz zu Schritt 3a (Tor T4): keine Mail.
      expect(stelleEinOhneRisiko).not.toHaveBeenCalled()
      expect(warnungen()).toEqual([])

      // Dasselbe Ereignis mit neuer Ereignis-Kennung: das bedingte Setzen trifft nichts — keine zweite Nachricht, keine zweite Rechnung.
      await ereignis('charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_rechnung', amount: 342 }, 'evt_2')
      // Und ein Nachziehen findet die offene Nachforderung über die Liste — nichts neu, nichts noch einmal gesendet.
      await stelleNachforderung('abr_1', JETZT)
      expect(db.unterhaltung.create).toHaveBeenCalledTimes(1)
      expect(stripeAttrappe.invoices.create).toHaveBeenCalledTimes(1)
      expect(stripeAttrappe.invoices.sendInvoice).toHaveBeenCalledTimes(1)
      expect(stripeAttrappe.invoices.list).toHaveBeenCalledWith({ customer: 'cus_1', limit: 100 })
    })

    it('(a2) Betrag der Rückbuchung weicht von der Summe ab: keine Nachforderung, eine Warnung, Stand bleibt zurückgebucht', async () => {
      await ereignis('charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_rechnung', amount: 341 })
      expect(zeile.stand).toBe('zurueckgebucht')
      expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
      expect(stripeAttrappe.invoices.sendInvoice).not.toHaveBeenCalled()
      expect(warnungen()).toEqual(['nachforderung-betrag'])
      expect(arten()).toEqual(['lastschrift_zurueckgebucht'])
    })

    it('(a3) Rechnung bar bei Stripe über einen anderen Betrag als die Summe: nichts angelegt, Warnung („im Zweifel nichts buchen“)', async () => {
      rechnungen.set('in_bar', { status: 'paid', posten: [{ id: 'ii_bar', schluessel: 'b1', amount: 400 }] })
      await ereignis('charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_rechnung' })
      expect(zeile.stand).toBe('zurueckgebucht')
      expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
      expect(warnungen()).toEqual(['nachforderung-betrag'])
    })

    it('(e) Stripe-Fehler beim Anlegen: Warnung, Stand bleibt, Antwort 200; der tägliche Lauf legt sie an', async () => {
      stripeAttrappe.invoices.create.mockRejectedValueOnce(new Error('Stripe nicht erreichbar'))
      const res = await ereignis('charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_rechnung', amount: 342 })
      expect(res.status).toBe(200)
      expect(zeile.stand).toBe('zurueckgebucht')
      expect(warnungen()).toEqual(['nachforderung'])
      expect(stripeAttrappe.invoices.sendInvoice).not.toHaveBeenCalled()

      await rechneMonatsabrechnungen(JETZT)
      expect(db.monatsabrechnung.findMany).toHaveBeenCalledWith({ where: { stand: 'zurueckgebucht' }, select: { id: true } })
      expect(metadaten.get(NACHFORDERUNG)).toEqual(META)
      expect(stripeAttrappe.invoices.sendInvoice).toHaveBeenCalledTimes(1)
      expect(arten()).toEqual(['lastschrift_zurueckgebucht', 'lastschrift_nachforderung_erstellt'])
    })

    it('Rückbuchung zu einer Rechnung ohne Monatsabrechnung (etwa einer bezahlten Nachforderung): Warnung, nichts geändert', async () => {
      stripeAttrappe.invoicePayments.list.mockResolvedValue({ data: [{ invoice: 'in_fremd' }] })
      const res = await ereignis('charge.dispute.created', { id: 'dp_9', payment_intent: 'pi_x' })
      expect(res.status).toBe(200)
      expect(zeile.stand).toBe('offen')
      expect(warnungen()).toEqual(['rueckbuchung-unbekannt'])
      expect(vi.mocked(captureException).mock.calls[0][0]).toEqual(expect.objectContaining({ message: 'Rückbuchung zu einer Rechnung ohne Monatsabrechnung' }))
      expect(db.unterhaltung.create).not.toHaveBeenCalled()
    })
  })

  describe('täglicher Lauf holt Fehlendes nach', () => {
    it('(f) vorhandene offene Nachforderung: kein invoices.create, kein sendInvoice', async () => {
      zeile.stand = 'zurueckgebucht'
      rechnungen.set('in_nf_alt', { status: 'open', posten: [{ id: 'ii_nf', schluessel: 'nachforderung', amount: 342 }] })
      metadaten.set('in_nf_alt', META)
      await rechneMonatsabrechnungen(JETZT)
      expect(stripeAttrappe.invoices.list).toHaveBeenCalled()
      expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
      expect(stripeAttrappe.invoices.sendInvoice).not.toHaveBeenCalled()
      expect(zeile.stand).toBe('zurueckgebucht')
    })

    it('Gegenprobe: eine stornierte (void) Nachforderung zählt nicht — eine neue wird angelegt', async () => {
      zeile.stand = 'zurueckgebucht'
      rechnungen.set('in_nf_alt', { status: 'void', posten: [] })
      metadaten.set('in_nf_alt', META)
      await rechneMonatsabrechnungen(JETZT)
      expect(stripeAttrappe.invoices.create).toHaveBeenCalledTimes(1)
      expect(stripeAttrappe.invoices.sendInvoice).toHaveBeenCalledTimes(1)
    })

    it('(g) Nachforderung schon bezahlt, Stand noch zurückgebucht (Ereignis verloren): bezahlt, ein Protokolleintrag', async () => {
      zeile.stand = 'zurueckgebucht'
      rechnungen.set('in_nf_alt', { status: 'paid', posten: [{ id: 'ii_nf', schluessel: 'nachforderung', amount: 342 }] })
      metadaten.set('in_nf_alt', META)
      await rechneMonatsabrechnungen(JETZT)
      expect(zeile).toEqual(expect.objectContaining({ stand: 'bezahlt', eingezogenAm: JETZT, offenSeit: null }))
      expect(arten()).toEqual(['lastschrift_nachforderung_bezahlt'])
      expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
    })

    it('Nachforderung einer fremden Abrechnung zählt nicht (andere abrechnungId)', async () => {
      zeile.stand = 'zurueckgebucht'
      rechnungen.set('in_nf_fremd', { status: 'open', posten: [] })
      metadaten.set('in_nf_fremd', { ...META, abrechnungId: 'abr_2' })
      await stelleNachforderung('abr_1', JETZT)
      expect(stripeAttrappe.invoices.create).toHaveBeenCalledTimes(1)
    })

    it('ohne Stand zurückgebucht, ohne Rechnung bar oder ohne Stripe-Kunde: nichts', async () => {
      zeile.stand = 'offen'
      await stelleNachforderung('abr_1', JETZT)
      zeile.stand = 'zurueckgebucht'
      zeile.rechnungBarId = null
      await stelleNachforderung('abr_1', JETZT)
      expect(stripeAttrappe.invoices.list).not.toHaveBeenCalled()
      expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
    })
  })

  describe('invoice.paid der Nachforderung', () => {
    const bezahlt = (metadata: Record<string, string> = META) => ereignis('invoice.paid', { id: NACHFORDERUNG, metadata }, 'evt_paid')

    it('(b) bei zurückgebucht → bezahlt, eingezogen, offenSeit null; Protokoll — der Hof ist von selbst frei', async () => {
      zeile.stand = 'zurueckgebucht'
      expect((await bezahlt()).status).toBe(200)
      expect(db.monatsabrechnung.updateMany).toHaveBeenCalledWith({ where: { id: 'abr_1', farmId: 'hof_1', stand: 'zurueckgebucht' }, data: { stand: 'bezahlt', eingezogenAm: expect.any(Date), offenSeit: null } })
      expect(zeile.stand).toBe('bezahlt')
      expect(abrechnungSperrtBar([zeile], 14, JETZT)).toBe(false)
      expect(arten()).toEqual(['lastschrift_nachforderung_bezahlt'])
      expect(warnungen()).toEqual([])
    })

    it('(c) fremde farmId oder anderer Stand: nichts geändert, Warnung (ohne Kennung des Hofs im Text)', async () => {
      zeile.stand = 'zurueckgebucht'
      await bezahlt({ ...META, farmId: 'hof_fremd' })
      expect(zeile.stand).toBe('zurueckgebucht')
      zeile.stand = 'offen'
      await bezahlt()
      expect(zeile.stand).toBe('offen')
      expect(warnungen()).toEqual(['nachforderung-bezahlt', 'nachforderung-bezahlt'])
      for (const [fehler] of vi.mocked(captureException).mock.calls) expect((fehler as Error).message).toBe('Nachforderung bezahlt, aber keine passende Abrechnung')
      expect(protokolliere).not.toHaveBeenCalled()
    })

    it('(c2) nach dem Notweg (geklärt) bezahlt: Stand bleibt, ein Protokolleintrag mit dem Grund, eine Warnung', async () => {
      zeile.stand = 'geklaert'
      await bezahlt()
      expect(zeile.stand).toBe('geklaert')
      expect(vi.mocked(protokolliere).mock.calls.map(([e]) => e)).toEqual([
        expect.objectContaining({ art: 'lastschrift_nachforderung_bezahlt', bezugArt: 'hof', bezugId: 'hof_1', wer: null, mitPasskey: false, grund: 'Nach dem Notweg bezahlt – Betrag an den Hof zurück' }),
      ])
      expect(warnungen()).toEqual(['nachforderung-bezahlt'])
    })

    it('(c3) schon bezahlt (der Lauf hat es nachgeholt): nichts geändert, keine Warnung, kein Protokoll', async () => {
      zeile.stand = 'bezahlt'
      await bezahlt()
      expect(zeile.stand).toBe('bezahlt')
      expect(warnungen()).toEqual([])
      expect(protokolliere).not.toHaveBeenCalled()
    })

    it('(d) invoice.paid der Monatsrechnung bar bei zurückgebucht: unverändert (der Weg der Monatsrechnungen bleibt)', async () => {
      zeile.stand = 'zurueckgebucht'
      await ereignis('invoice.paid', { id: 'in_bar' })
      expect(zeile.stand).toBe('zurueckgebucht')
      expect(protokolliere).not.toHaveBeenCalled()
    })

    it('Metadaten im Schema: Texte gehen durch, eine Zahl nicht', () => {
      expect(pruefeStripeObjekt('invoice.paid', { id: 'in_1', metadata: META })).toEqual({ ok: true })
      expect(pruefeStripeObjekt('invoice.paid', { id: 'in_1', metadata: null })).toEqual({ ok: true })
      expect(pruefeStripeObjekt('invoice.paid', { id: 'in_1', metadata: { abrechnungId: 7 } })).toEqual({ ok: false, felder: ['metadata.abrechnungId'] })
    })
  })

  describe('Notweg: klaereRueckbuchung (Recht „Geld“, frischer Passkey, Grund)', () => {
    const eingabe = { abrechnungId: 'abr_1', grund: 'Hof hat bar im Büro bezahlt' }
    beforeEach(() => {
      zeile.stand = 'zurueckgebucht'
    })

    function nichtsGeschrieben(): void {
      expect(zeile.stand).toBe('zurueckgebucht')
      expect(protokolliere).not.toHaveBeenCalled()
      expect(db.unterhaltung.create).not.toHaveBeenCalled()
    }

    it('ohne Recht → Fehler, nichts geschrieben; ohne frische Bestätigung → Fehler', async () => {
      vi.mocked(verlangeAdminAktion).mockResolvedValueOnce({ error: 'Dafür fehlt dir das Recht.' })
      expect(await klaereRueckbuchung(eingabe)).toEqual({ error: 'Dafür fehlt dir das Recht.' })
      expect(verlangeAdminAktion).toHaveBeenCalledWith({ frisch: true, recht: 'geld' })
      vi.mocked(verlangeAdminAktion).mockResolvedValueOnce({ error: 'Bestätige es bitte mit deinem Passkey.' })
      expect(await klaereRueckbuchung(eingabe)).toEqual({ error: 'Bestätige es bitte mit deinem Passkey.' })
      expect(db.monatsabrechnung.updateMany).not.toHaveBeenCalled()
      nichtsGeschrieben()
    })

    it('ohne Grund bzw. Grund mit @ → Fehler, nichts geschrieben', async () => {
      expect(await klaereRueckbuchung({ abrechnungId: 'abr_1', grund: '  ' })).toEqual({ error: SPERRE_TEXT.eingabe })
      expect(await klaereRueckbuchung({ abrechnungId: 'abr_1' })).toEqual({ error: SPERRE_TEXT.eingabe })
      expect(await klaereRueckbuchung({ abrechnungId: 'abr_1', grund: 'Mail von hof@example.com' })).toEqual({ error: ADMIN_GRUND_FEHLER })
      expect(db.monatsabrechnung.updateMany).not.toHaveBeenCalled()
      nichtsGeschrieben()
    })

    it('zweimal: einmal geschrieben (geklärt, mit der gelesenen farmId in der Bedingung), ein Protokolleintrag, eine Nachricht mit dem Monat als Wort', async () => {
      expect(await klaereRueckbuchung(eingabe)).toEqual({ ok: true })
      expect(await klaereRueckbuchung(eingabe)).toEqual({ error: RUECKBUCHUNG_TEXT.nichtMehr })
      expect(zeile.stand).toBe('geklaert')
      expect(abrechnungSperrtBar([zeile], 14, JETZT)).toBe(false)
      expect(db.monatsabrechnung.updateMany).toHaveBeenCalledWith({ where: { id: 'abr_1', farmId: 'hof_1', stand: 'zurueckgebucht' }, data: { stand: 'geklaert' } })
      expect(vi.mocked(protokolliere).mock.calls.map(([e]) => e)).toEqual([
        expect.objectContaining({ art: 'lastschrift_rueckbuchung_geklaert', bezugArt: 'hof', bezugId: 'hof_1', wer: 'admin_1', mitPasskey: true, grund: 'Hof hat bar im Büro bezahlt' }),
      ])
      expect(db.unterhaltung.create).toHaveBeenCalledTimes(1)
      const nachricht = db.unterhaltung.create.mock.calls[0][0].data
      expect(nachricht.farmId).toBe('hof_1')
      expect(nachricht.nachrichten.create).toEqual(expect.objectContaining({ art: 'SYSTEM', linkUrl: LASTSCHRIFT_HREF, text: rueckbuchungGeklaertNachricht('Februar 2027') }))
      expect(rueckbuchungGeklaertNachricht('Februar 2027')).toBe('Die zurückgebuchte Lastschrift für Februar 2027 ist geklärt. Sie sperrt deine Barzahlung nicht mehr.')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/hoefe/hof_1')
      // Kein Aufruf an Stripe, keine Mail.
      expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
      expect(stripeAttrappe.invoices.list).not.toHaveBeenCalled()
      expect(stelleEinOhneRisiko).not.toHaveBeenCalled()
    })

    it('anderer Stand → Fehlersatz, nichts geschrieben; unbekannte Abrechnung → Fehlersatz, kein Schreiben', async () => {
      zeile.stand = 'offen'
      expect(await klaereRueckbuchung(eingabe)).toEqual({ error: RUECKBUCHUNG_TEXT.nichtMehr })
      expect(zeile.stand).toBe('offen')
      expect(protokolliere).not.toHaveBeenCalled()
      db.monatsabrechnung.updateMany.mockClear()
      expect(await klaereRueckbuchung({ ...eingabe, abrechnungId: 'abr_gibts_nicht' })).toEqual({ error: RUECKBUCHUNG_TEXT.nichtMehr })
      expect(db.monatsabrechnung.updateMany).not.toHaveBeenCalled()
      expect(db.unterhaltung.create).not.toHaveBeenCalled()
    })
  })

  describe('Hof › „Jetzt bezahlen“ der Nachforderung (oeffneRechnung)', () => {
    it('eigene Abrechnung → Adresse der gehosteten Rechnung; fremde Abrechnung oder keine Nachforderung → rechnungFehlt', async () => {
      zeile.stand = 'zurueckgebucht'
      rechnungen.set('in_nf_alt', { status: 'open', posten: [] })
      metadaten.set('in_nf_alt', META)
      expect(await oeffneRechnung({ abrechnungId: 'abr_1', art: 'nachforderung', ziel: 'bezahlen' })).toEqual({ url: 'https://rechnung.example.com/in_nf_alt' })
      expect(db.monatsabrechnung.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'abr_1', farmId: 'hof_1' } }))
      // Fremd: die Abrechnung gehört einem anderen Hof — sieht aus wie eine fehlende.
      zeile.farmId = 'hof_anders'
      expect(await oeffneRechnung({ abrechnungId: 'abr_1', art: 'nachforderung', ziel: 'bezahlen' })).toEqual({ error: LASTSCHRIFT_TEXT.rechnungFehlt })
      zeile.farmId = 'hof_1'
      metadaten.clear()
      expect(await oeffneRechnung({ abrechnungId: 'abr_1', art: 'nachforderung', ziel: 'bezahlen' })).toEqual({ error: LASTSCHRIFT_TEXT.rechnungFehlt })
    })
  })
})
