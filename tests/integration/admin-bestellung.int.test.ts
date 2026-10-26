/**
 * Admin › Bestellungen (Register N33, N34; Nachtlauf Nr. 186) gegen ein ECHTES
 * Postgres — mit echter Anmeldung über Better Auth und der echten Admin-Wache
 * (Passkey-Admin aus setup/basis.ts). Gemockt sind nur Stripe, Sentry, der
 * Request-Kontext und der Nachlauf des Mail-Workers.
 *
 * Beweist (Zustand danach):
 *  - Suche: Bestellnummer und ganze Adresse finden die Bestellung (dieselbe
 *    Abfrage wie Admin › Betrieb › E-Mails), eine Teiladresse findet nichts.
 *  - Notfall-Storno = Storno des Hofs: an zwei gleichen Online-Bestellungen,
 *    eine vom Hof (`cancelOrder`), eine vom Team (`notfallStorno`) storniert —
 *    gleicher Stand, gleicher Bestand, dieselbe Erstattung bei Stripe
 *    (reverse_transfer, refund_application_fee), je eine Storno-Mail. Dazu
 *    beim Team: Nachricht an den Hof, zwei Einträge im Protokoll.
 *  - Notfall-Storno nach der Abholung, ohne Recht und ohne Grund: nichts
 *    ändert sich, kein Stripe-Aufruf.
 *  - „Außerhalb erstattet“ löscht nur das Merkmal, ruft Stripe nie.
 *  - Die volle Adresse gibt es nur nach Grund, mit Eintrag ohne Adresse.
 * Testhöfe heißen „Testhof …“, Adressen @example.com, Texte erfunden.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn(), list: vi.fn(async () => ({ data: [], has_more: false })) } } }))
// Die Storno-Mail ist ein Auftrag der Warteschlange (echt in der Datenbank); den Worker danach braucht dieser Test nicht.
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { ADMIN_RECHT_FEHLER } from '@/lib/admin-rechte'
import { ADMIN_BESTELLUNG_TEXT } from '@/lib/admin-bestellung'
import { ADMIN_BESTELLUNG_GRUND_FEHLT, bestellFilterAus } from '@/schemas/admin-bestellung'
import { mailSucheAus } from '@/schemas/betrieb-mails'
import { cancelOrder } from '@/server/actions/orders'
import { markiereErstattungErledigt, notfallStorno, zeigeKundinAdresse } from '@/server/actions/admin-bestellung'
import { ladeBestellListe } from '@/server/queries/admin-bestellungen'
import { artenZu, erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, intKennung, machePasskeyAdmin, raeumeAuf } from './setup/basis'

const erstatten = vi.mocked(stripe.refunds.create)
const EINZELPREIS = 10
const MENGE = 2
const BESTAND = 5

/** Kennungen, deren Protokoll-Einträge nach dem Test weg müssen (AdminAktion hängt an nichts). */
const bezuege: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  erstatten.mockImplementation((async (p: { payment_intent: string }) => ({ id: `re_${p.payment_intent}`, status: 'succeeded', amount: EINZELPREIS * MENGE * 100 + 100 })) as never)
})

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await prisma.adminAktion.deleteMany({ where: { bezugId: { in: bezuege.splice(0) } } })
  await raeumeAuf()
})

async function alsSitzung(cookie: string): Promise<void> {
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
}

async function admin(rechte: { inhaber: boolean; rechte?: string[] } = { inhaber: true }): Promise<string> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung({ name: 'Testhof Admin' })
  await machePasskeyAdmin(ownerId)
  if (!rechte.inhaber) await prisma.user.update({ where: { id: ownerId }, data: { adminInhaber: false, adminRechte: rechte.rechte ?? [] } })
  return cookie
}

/** Eine bezahlte Online-Bestellung, wie der Webhook sie hinterlässt — Bestand schon gebucht. */
async function bezahlteBestellung(farmId: string, produktId: string, abweichend: { status?: 'PAID' | 'PICKED_UP'; email?: string; nummer?: string } = {}) {
  const pi = `pi_${intKennung('zahlung').replace(/[^A-Za-z0-9]/g, '')}`
  const bestellung = await prisma.order.create({
    data: {
      orderNumber: abweichend.nummer ?? intKennung('bestellung').toUpperCase(),
      farmId,
      customerEmail: abweichend.email ?? `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Beispiel',
      customerPhone: '+43 660 0000000',
      status: abweichend.status ?? 'PAID',
      totalAmount: EINZELPREIS * MENGE,
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      paidAt: new Date(),
      stripePaymentIntentId: pi,
      platformFeeAmount: 0,
      serviceFeeCents: 100,
      serviceFeePercentApplied: 4.9,
      items: { create: [{ productId: produktId, productName: 'Testprodukt', unitPrice: EINZELPREIS, quantity: MENGE, totalPrice: EINZELPREIS * MENGE, vatRate: 10 }] },
    },
    select: { id: true, orderNumber: true, customerEmail: true },
  })
  bezuege.push(bestellung.id, farmId)
  return { ...bestellung, pi }
}

const stand = (id: string) =>
  prisma.order.findUniqueOrThrow({ where: { id }, select: { status: true, paymentStatus: true, erstattungOffenSeit: true, serviceFeeRefundedAt: true, cancelReason: true } })
const bestand = async (id: string): Promise<number> => (await prisma.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock
/** Die Erstattung bei Stripe ohne das, was je Bestellung anders ist (Zahlung, Merkmal, Schlüssel). */
const erstattungsArt = (aufruf: unknown[]): unknown => {
  const [p] = aufruf as [Record<string, unknown>]
  return { reverse_transfer: p.reverse_transfer, refund_application_fee: p.refund_application_fee }
}

describe('Suche nach Nummer und Adresse', () => {
  it('Nummer und ganze Adresse finden die Bestellung, eine Teiladresse nichts', async () => {
    const { farm } = await erstelleHof({ name: 'Testhof Suche' })
    const produkt = await erstelleProdukt(farm.id, { stock: BESTAND })
    const email = `${intKennung('kundin')}@example.com`
    // Eine Nummer im Muster der Suche (BESTELLNUMMER_MUSTER), eindeutig je Lauf.
    const nummer = `INT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
    const b = await bezahlteBestellung(farm.id, produkt.id, { email, nummer })
    const filter = bestellFilterAus({})
    const jetzt = new Date()

    expect((await ladeBestellListe(mailSucheAus(b.orderNumber), filter, jetzt)).map((z) => z.id)).toEqual([b.id])
    expect((await ladeBestellListe(mailSucheAus(email), filter, jetzt)).map((z) => z.id)).toEqual([b.id])
    expect(await ladeBestellListe(mailSucheAus(email.slice(0, email.indexOf('@') + 1)), filter, jetzt)).toEqual([])
    expect(await ladeBestellListe(mailSucheAus(email.slice(email.indexOf('@'))), filter, jetzt)).toEqual([])
    expect(await ladeBestellListe(mailSucheAus(email.slice(1)), filter, jetzt)).toEqual([])
    // Filter schneidet: abgeholt passt nicht.
    expect(await ladeBestellListe(mailSucheAus(email), bestellFilterAus({ stand: 'abgeholt' }), jetzt)).toEqual([])
  })
})

describe('Notfall-Storno — derselbe Weg wie der Storno des Hofs', () => {
  it('Stand, Bestand, Erstattung und Mail wie beim Hof; dazu Nachricht an den Hof und Protokoll', async () => {
    const { farm, cookie: hofCookie } = await erstelleHofMitAnmeldung({ name: 'Testhof Storno', acceptsOnline: true })
    const produktHof = await erstelleProdukt(farm.id, { stock: BESTAND })
    const produktTeam = await erstelleProdukt(farm.id, { stock: BESTAND })
    const vomHof = await bezahlteBestellung(farm.id, produktHof.id)
    const vomTeam = await bezahlteBestellung(farm.id, produktTeam.id)
    const adminCookie = await admin()

    await alsSitzung(hofCookie)
    const hofErgebnis = await cancelOrder(vomHof.id)
    await alsSitzung(adminCookie)
    const teamErgebnis = await notfallStorno({ orderId: vomTeam.id, grund: 'Hof nicht erreichbar' })

    expect(teamErgebnis).toEqual(hofErgebnis)
    expect(teamErgebnis).not.toHaveProperty('error')
    const [hofStand, teamStand] = [await stand(vomHof.id), await stand(vomTeam.id)]
    expect(teamStand).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED', erstattungOffenSeit: null, cancelReason: null })
    expect({ ...teamStand, serviceFeeRefundedAt: teamStand.serviceFeeRefundedAt !== null }).toEqual({ ...hofStand, serviceFeeRefundedAt: hofStand.serviceFeeRefundedAt !== null })
    expect(await bestand(produktTeam.id)).toBe(BESTAND + MENGE)
    expect(await bestand(produktHof.id)).toBe(BESTAND + MENGE)
    expect(erstatten).toHaveBeenCalledTimes(2)
    expect(erstattungsArt(erstatten.mock.calls[1] as unknown[])).toEqual(erstattungsArt(erstatten.mock.calls[0] as unknown[]))
    expect(erstatten.mock.calls[1]?.[0]).toMatchObject({ payment_intent: vomTeam.pi, reverse_transfer: true })
    expect(await artenZu(vomTeam.id)).toEqual(await artenZu(vomHof.id))
    expect(await artenZu(vomTeam.id)).toContain('storniert')

    const nachricht = await prisma.nachricht.findFirst({ where: { unterhaltung: { farmId: farm.id }, linkUrl: `/orders/${vomTeam.id}` }, select: { text: true, art: true } })
    expect(nachricht?.art).toBe('SYSTEM')
    expect(nachricht?.text).toContain(`${vomTeam.orderNumber} vom Team storniert`)
    const eintraege = await prisma.adminAktion.findMany({ where: { art: 'notfall_storno', bezugId: { in: [vomTeam.id, farm.id] } }, orderBy: { bezugArt: 'asc' } })
    expect(eintraege.map((e) => [e.bezugArt, e.grund, e.mitPasskey])).toEqual([
      ['bestellung', 'Hof nicht erreichbar', true],
      ['hof', 'Hof nicht erreichbar', true],
    ])
    // Gegenprobe: der Storno des Hofs schreibt weder Nachricht noch Protokoll.
    expect(await prisma.nachricht.count({ where: { linkUrl: `/orders/${vomHof.id}` } })).toBe(0)
    expect(await prisma.adminAktion.count({ where: { bezugId: vomHof.id } })).toBe(0)
  })

  it('nach der Abholung, ohne Recht und ohne Grund: nichts ändert sich, kein Stripe-Aufruf', async () => {
    const { farm } = await erstelleHof({ name: 'Testhof Sperre' })
    const produkt = await erstelleProdukt(farm.id, { stock: BESTAND })
    const abgeholt = await bezahlteBestellung(farm.id, produkt.id, { status: 'PICKED_UP' })
    const offen = await bezahlteBestellung(farm.id, produkt.id)

    await alsSitzung(await admin())
    expect(await notfallStorno({ orderId: abgeholt.id, grund: 'Hof nicht erreichbar' })).toEqual({ error: ADMIN_BESTELLUNG_TEXT.stornoNachAbholung })
    expect(await notfallStorno({ orderId: offen.id, grund: ' ' })).toEqual({ error: ADMIN_BESTELLUNG_GRUND_FEHLT })
    await alsSitzung(await admin({ inhaber: false, rechte: ['geld', 'adresse_anzeigen'] }))
    expect(await notfallStorno({ orderId: offen.id, grund: 'Hof nicht erreichbar' })).toEqual({ error: ADMIN_RECHT_FEHLER })

    expect(await stand(abgeholt.id)).toMatchObject({ status: 'PICKED_UP', paymentStatus: 'PAID' })
    expect(await stand(offen.id)).toMatchObject({ status: 'PAID', paymentStatus: 'PAID' })
    expect(await bestand(produkt.id)).toBe(BESTAND)
    expect(erstatten).not.toHaveBeenCalled()
    expect(await prisma.adminAktion.count({ where: { bezugId: { in: [abgeholt.id, offen.id] } } })).toBe(0)

    // Gegenprobe: mit dem Recht geht der Storno der offenen Bestellung.
    await alsSitzung(await admin({ inhaber: false, rechte: ['hof_sperren_storno'] }))
    expect(await notfallStorno({ orderId: offen.id, grund: 'Hof nicht erreichbar' })).not.toHaveProperty('error')
    expect(await stand(offen.id)).toMatchObject({ status: 'CANCELLED' })
  })
})

describe('„Außerhalb erstattet“ und volle Adresse', () => {
  it('„Außerhalb erstattet“ löscht nur das Merkmal, Stripe nie; Protokoll mit Grund', async () => {
    const { farm } = await erstelleHof({ name: 'Testhof Erstattung' })
    const produkt = await erstelleProdukt(farm.id, { stock: BESTAND })
    const b = await bezahlteBestellung(farm.id, produkt.id)
    await prisma.order.update({ where: { id: b.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), erstattungOffenSeit: new Date() } })
    const vorher = await prisma.order.findUniqueOrThrow({ where: { id: b.id } })

    await alsSitzung(await admin())
    expect(await markiereErstattungErledigt({ orderId: b.id, grund: 'Selbst überwiesen' })).toEqual({ ok: true })

    const nachher = await prisma.order.findUniqueOrThrow({ where: { id: b.id } })
    const ohne = (z: typeof vorher) => Object.fromEntries(Object.entries(z).filter(([f]) => f !== 'erstattungOffenSeit' && f !== 'updatedAt'))
    expect(nachher.erstattungOffenSeit).toBeNull()
    expect(ohne(nachher)).toEqual(ohne(vorher))
    expect(erstatten).not.toHaveBeenCalled()
    expect(stripe.refunds.list).not.toHaveBeenCalled()
    expect(await prisma.adminAktion.findMany({ where: { bezugId: b.id }, select: { art: true, grund: true } })).toEqual([{ art: 'erstattung_erledigt', grund: 'Selbst überwiesen' }])
  })

  it('volle Adresse nur nach Grund; der Eintrag trägt keine Adresse', async () => {
    const { farm } = await erstelleHof({ name: 'Testhof Adresse' })
    const produkt = await erstelleProdukt(farm.id, { stock: BESTAND })
    const b = await bezahlteBestellung(farm.id, produkt.id)

    await alsSitzung(await admin())
    expect(await zeigeKundinAdresse({ orderId: b.id })).toEqual({ error: ADMIN_BESTELLUNG_GRUND_FEHLT })
    expect(await prisma.adminAktion.count({ where: { bezugId: b.id } })).toBe(0)
    expect(await zeigeKundinAdresse({ orderId: b.id, grund: 'Kundin fragt nach Erstattung' })).toEqual({ ok: true, adresse: b.customerEmail })
    const eintraege = await prisma.adminAktion.findMany({ where: { bezugId: b.id } })
    expect(eintraege.map((e) => [e.art, e.grund])).toEqual([['adresse_angezeigt', 'Kundin fragt nach Erstattung']])
    expect(JSON.stringify(eintraege)).not.toContain(b.customerEmail)
  })
})
