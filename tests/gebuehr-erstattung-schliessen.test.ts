/**
 * Offene Gebühr nach „Nicht abgeholt“ als Aufgabe (Nr. 288, Schritte 7 bis 9):
 *  - Die Aufgabe in Heute zeigt die Gebühr, nicht den bezahlten Betrag;
 *    beim offenen Storno bleibt es beim bezahlten Betrag.
 *  - Admin › Bestellungen kennt den Fall „Gebühr-Erstattung gescheitert“ vor
 *    der allgemeinen offenen Erstattung.
 *  - „Außerhalb erstattet“ schließt den Gebühr-Fall mit `serviceFeeRefundedAt`
 *    (der Vermerk beim Hof verschwindet, die Gebühr zählt nicht als Einnahme),
 *    schreibt mit der gelesenen farmId und lässt einen offenen Storno so, wie
 *    er war. Eine unbekannte Bestellung schreibt nichts Neues.
 *
 * Prisma gestellt, Admin-Wache echt (tests/admin-sitzung.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn() } } }))
vi.mock('@/server/stornieren', () => ({ storniere: vi.fn() }))
vi.mock('@/lib/prisma', async () => ({
  prisma: {
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    user: { findUnique: vi.fn() },
    order: { updateMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(async () => []) },
    adminAktion: { create: vi.fn(async () => ({ id: 'cmfeintrag00000000000001' })) },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { BESTELL_FAELLE, bestellFall } from '@/lib/admin-bestellung'
import { markiereErstattungErledigt } from '@/server/actions/admin-bestellung'
import { ladeErstattungAufgaben } from '@/server/queries/postfach'
import { adminSitzung } from './admin-sitzung'

type Fn = ReturnType<typeof vi.fn>
const db = prisma as unknown as {
  user: { findUnique: Fn }
  order: { updateMany: Fn; findUnique: Fn; findMany: Fn }
  adminAktion: { create: Fn }
}

const BESTELLUNG = 'cmfbestellung000000001ab'
const HOF = 'cmfhof00000000000000test'
const eintraege = (): Array<Record<string, unknown>> => db.adminAktion.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.api.getSession).mockResolvedValue(adminSitzung('admin_1') as never)
  db.user.findUnique.mockResolvedValue({ isAdmin: true, adminInhaber: true, adminRechte: [] })
  db.order.findUnique.mockResolvedValue({ farmId: HOF })
  db.order.updateMany.mockResolvedValue({ count: 1 })
})

describe('Admin › Bestellungen: Fall „Gebühr-Erstattung gescheitert“', () => {
  const offen = {
    status: 'NOT_PICKED_UP',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    erstattungOffenSeit: new Date('2026-11-10T08:00:00.000Z'),
    serviceFeeCents: 98,
    serviceFeeRefundedAt: null,
  }

  it('geht vor der allgemeinen offenen Erstattung — mit Titel und Text wörtlich', () => {
    expect(bestellFall(offen)).toBe('gebuehr_erstattung_offen')
    expect(BESTELL_FAELLE.gebuehr_erstattung_offen).toEqual({
      titel: 'Gebühr-Erstattung gescheitert',
      wasTun:
        'Der Hof hat ‚Nicht abgeholt‘ vermerkt. Die Kundin bekommt nur die Gebühr zurück, nicht den Warenpreis. Erstatte in Stripe genau die Gebühr als Teilerstattung und klick dann ‚Außerhalb erstattet‘.',
      ton: 'tun',
    })
  })

  it('Gegenproben: offener Storno bleibt „Erstattung gescheitert“, ohne Vermerk „nicht abgeholt“, Gebühr schon zurück ebenso', () => {
    expect(bestellFall({ ...offen, status: 'CANCELLED' })).toBe('erstattung_offen')
    expect(bestellFall({ ...offen, erstattungOffenSeit: null })).toBe('nicht_abgeholt')
    expect(bestellFall({ ...offen, serviceFeeRefundedAt: new Date('2026-11-11T08:00:00.000Z') })).toBe('erstattung_offen')
    expect(bestellFall({ ...offen, paymentMethod: 'ONSITE_CASH' })).toBe('erstattung_offen')
  })
})

describe('„Außerhalb erstattet“ schließt die offene Gebühr', () => {
  const GEBUEHR_WO = {
    id: BESTELLUNG,
    farmId: HOF,
    status: 'NOT_PICKED_UP',
    paymentMethod: 'ONLINE',
    serviceFeeCents: { gt: 0 },
    serviceFeeRefundedAt: null,
    erstattungOffenSeit: { not: null },
  }

  it('Gebühr-Fall: leert erstattungOffenSeit und setzt serviceFeeRefundedAt, mit der gelesenen farmId, ein Protokoll', async () => {
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'In Stripe erstattet' })).toEqual({ ok: true })

    expect(db.order.findUnique).toHaveBeenCalledWith({ where: { id: BESTELLUNG }, select: { farmId: true } })
    expect(db.order.updateMany).toHaveBeenCalledTimes(1)
    expect(db.order.updateMany).toHaveBeenCalledWith({ where: GEBUEHR_WO, data: { erstattungOffenSeit: null, serviceFeeRefundedAt: expect.any(Date) } })
    expect(eintraege()).toEqual([{ wer: 'admin_1', art: 'erstattung_erledigt', bezugArt: 'bestellung', bezugId: BESTELLUNG, grund: 'In Stripe erstattet', mitPasskey: true }])
    expect(stripe.refunds.create).not.toHaveBeenCalled()
  })

  it('offener Storno: das Gebühr-Schreiben trifft nicht, das bisherige leert nur erstattungOffenSeit — serviceFeeRefundedAt bleibt', async () => {
    db.order.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 })

    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'Selbst überwiesen' })).toEqual({ ok: true })

    expect(db.order.updateMany).toHaveBeenNthCalledWith(2, { where: { id: BESTELLUNG, erstattungOffenSeit: { not: null } }, data: { erstattungOffenSeit: null } })
    const zweitesSchreiben = db.order.updateMany.mock.calls[1]?.[0] as { data: Record<string, unknown> }
    expect(zweitesSchreiben.data).not.toHaveProperty('serviceFeeRefundedAt')
    expect(eintraege()).toHaveLength(1)
  })

  it('unbekannte Bestellung: kein Gebühr-Schreiben, das bisherige trifft nichts, { ok: true }, kein Eintrag', async () => {
    db.order.findUnique.mockResolvedValue(null)
    db.order.updateMany.mockResolvedValue({ count: 0 })

    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'Selbst überwiesen' })).toEqual({ ok: true })

    expect(db.order.updateMany).toHaveBeenCalledTimes(1)
    expect(db.order.updateMany).toHaveBeenCalledWith({ where: { id: BESTELLUNG, erstattungOffenSeit: { not: null } }, data: { erstattungOffenSeit: null } })
    expect(eintraege()).toEqual([])
  })
})

describe('Aufgabe „Erstattung offen“ in Heute: der richtige Betrag', () => {
  const zeile = {
    id: BESTELLUNG,
    orderNumber: 'HM-2611-A1B2',
    erstattungOffenSeit: new Date('2026-11-10T08:00:00.000Z'),
    stripePaymentIntentId: 'pi_beispiel',
    paymentStatus: 'PAID',
    // Decimal-Felder: alsCents liest über toString.
    totalAmount: { toString: () => '20.00' },
    platformFeeAmount: { toString: () => '0.00' },
    serviceFeeCents: 98,
    erstattetCents: 0,
    status: 'NOT_PICKED_UP',
    paymentMethod: 'ONLINE',
    serviceFeeRefundedAt: null,
    farm: { name: 'Hof Test' },
  }

  it('offene Gebühr: der Betrag ist die Gebühr, nicht das Bezahlte', async () => {
    db.order.findMany.mockResolvedValue([zeile])

    const [aufgabe] = await ladeErstattungAufgaben()

    expect(aufgabe?.bezahltCents).toBe(98)
  })

  it('offener Storno: wie bisher das Bezahlte (Warenpreis und Gebühr)', async () => {
    db.order.findMany.mockResolvedValue([{ ...zeile, status: 'CANCELLED' }])

    const [aufgabe] = await ladeErstattungAufgaben()

    expect(aufgabe?.bezahltCents).toBe(2098)
  })

  it('liest Status, Zahlart und Gebühr-Vermerk mit', async () => {
    await ladeErstattungAufgaben()
    const auswahl = (db.order.findMany.mock.calls[0]?.[0] as { select: Record<string, unknown> }).select
    expect(auswahl).toMatchObject({ status: true, paymentMethod: true, serviceFeeRefundedAt: true, serviceFeeCents: true })
  })
})
