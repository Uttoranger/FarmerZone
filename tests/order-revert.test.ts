/**
 * Tests für den Ein-Schritt-Rückweg (bestellungen-undo):
 * revertReady (READY → PAID/CONFIRMED, Herleitung über paymentStatus) und
 * revertPickedUp (PICKED_UP → READY, pickedUpAt geleert; die Zahlung nach
 * zahlungNachRueckweg, seit Nr. 32 — Fälle in tests/rueckweg-zahlung.test.ts).
 * revertPickedUp verschickt KEINE Mail; revertReady nur mit Haken, als Auftrag
 * der Warteschlange (Nr. 159; verschickt wird nach der Antwort), mit try: ein
 * Fehler beim Einstellen geht ohne Adresse nach Sentry und kippt den
 * Statuswechsel nicht (Nr. 35).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/stripe', () => ({ stripe: {} }))
vi.mock('@/server/mail-warteschlange', () => ({ stelleMailEin: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
// Der Nachlauf wird gesammelt statt gestartet: Die Action selbst startet
// keinen mehr (der Worker läuft nach dem Einstellen).
const nachlauf: Array<() => Promise<void>> = []
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.push(aufgabe)
  },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    order: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}))

import * as Sentry from '@sentry/nextjs'
import { revertReady, revertPickedUp } from '@/server/actions/orders'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stelleMailEin } from '@/server/mail-warteschlange'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const orderFindFirst = vi.mocked(prisma.order.findFirst)
const orderUpdate = vi.mocked(prisma.order.update)
// Seit fix/storno-atomar schreiben die Rückwege BEDINGT (updateMany mit
// Statusfilter), damit sie eine inzwischen stornierte Bestellung nie
// zurückholen. Das unbedingte update bleibt ungenutzt.
const orderUpdateMany = vi.mocked(prisma.order.updateMany)
const einstellen = vi.mocked(stelleMailEin)

const EMAIL_ORDER = {
  id: 'order_1',
  orderNumber: 'TH-1907-TEST',
  customerName: 'Anna Testerin',
  customerEmail: 'kundin@test.local',
  customerPhone: '+43 699 0000000',
  totalAmount: { toString: () => '7.00' },
  pickupDate: new Date('2026-07-21T12:00:00Z'),
  pickupTimeStart: '09:00',
  pickupTimeEnd: '12:00',
  paymentMethod: 'ONSITE_CASH',
  paymentStatus: 'PENDING',
  stripePaymentIntentId: null,
  items: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.length = 0
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1', name: 'Testhof', slug: 'testhof', email: 'hof@test.local', ownerName: 'Franz', address: 'Weg 1', postalCode: '4020', city: 'Linz', phone: '' } as never)
  orderUpdate.mockResolvedValue({} as never)
  orderUpdateMany.mockResolvedValue({ count: 1 } as never)
})

describe('revertReady', () => {
  it('nur aus READY: Query ist auf Status READY + eigene Farm gescoped', async () => {
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PENDING' } as never)
    await revertReady('order_1')
    expect(orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_1', farmId: 'farm_1', status: 'READY' },
      })
    )
  })

  it('falscher Ausgangsstatus → abgelehnt, kein Update', async () => {
    orderFindFirst.mockResolvedValue(null)
    const result = await revertReady('order_confirmed')
    expect(result.error).toBe('Die Bestellung wurde inzwischen geändert, zum Beispiel storniert. Lade die Seite neu.')
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('Ownership: ohne Session keine Änderung', async () => {
    getSession.mockResolvedValue(null as never)
    const result = await revertReady('order_1')
    expect(result.error).toBe('Nicht angemeldet')
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('Herleitung: paymentStatus PAID → zurück auf PAID', async () => {
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PAID' } as never)
    const result = await revertReady('order_1')
    expect(result).toEqual({})
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order_1', farmId: 'farm_1', status: 'READY' },
      data: { status: 'PAID' },
    })
  })

  it('Herleitung: paymentStatus nicht PAID → zurück auf CONFIRMED', async () => {
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PENDING' } as never)
    await revertReady('order_1')
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order_1', farmId: 'farm_1', status: 'READY' },
      data: { status: 'CONFIRMED' },
    })
  })

  it('Haken AN (Standard) → genau ein Auftrag „nicht-abholbereit" (Wichtig, mit bestellungId), sonst keiner', async () => {
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PAID' } as never)
    await revertReady('order_1')
    expect(einstellen).toHaveBeenCalledTimes(1)
    const auftrag = einstellen.mock.calls[0]![0] as { art: string; vorrang: number; schluessel: string; bestellungId: string; farmId: string; bezug: unknown }
    expect(auftrag).toMatchObject({ art: 'nicht-abholbereit', vorrang: 1, bestellungId: 'order_1', farmId: 'farm_1', bezug: { orderId: 'order_1' } })
    // Zurück und wieder bereit darf wieder schreiben: der Zeitpunkt macht den Schlüssel eindeutig.
    expect(auftrag.schluessel).toMatch(/^nicht-abholbereit:order_1:\d+$/)
    // Erst nach dem Statuswechsel.
    expect(orderUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(einstellen.mock.invocationCallOrder[0]!)
    expect(nachlauf).toHaveLength(0)
  })

  it('Haken AUS → kein Auftrag', async () => {
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PENDING' } as never)
    const result = await revertReady('order_1', false)
    expect(result).toEqual({})
    expect(einstellen).not.toHaveBeenCalled()
  })

  it('abgelehnter Rückschritt stellt auch mit Haken nichts ein', async () => {
    orderFindFirst.mockResolvedValue(null)
    await revertReady('order_confirmed', true)
    expect(einstellen).not.toHaveBeenCalled()
  })

  it('Fehler beim Einstellen: Statuswechsel bleibt, Antwort ohne Fehler, Sentry ohne Adresse', async () => {
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PENDING' } as never)
    einstellen.mockRejectedValueOnce(new Error('DB weg'))

    const result = await revertReady('order_1')
    expect(result).toEqual({})
    expect(orderUpdateMany).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const gemeldet = JSON.stringify(vi.mocked(Sentry.captureException).mock.calls[0]?.[1])
    expect(gemeldet).toContain('order_1')
    expect(gemeldet).not.toContain('kundin@test.local')
    expect(gemeldet).not.toContain('Anna')
    // Kein Rückweg in die Datenbank: nichts zurückgerollt, nichts erneut geschrieben.
    expect(orderUpdateMany).toHaveBeenCalledTimes(1)
    expect(orderUpdate).not.toHaveBeenCalled()
  })
})

describe('revertPickedUp', () => {
  it('nur aus PICKED_UP: Query ist auf Status PICKED_UP + eigene Farm gescoped', async () => {
    orderFindFirst.mockResolvedValue({ id: 'order_1' } as never)
    await revertPickedUp('order_1')
    expect(orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_1', farmId: 'farm_1', status: 'PICKED_UP' },
      })
    )
  })

  it('falscher Ausgangsstatus → abgelehnt, kein Update', async () => {
    orderFindFirst.mockResolvedValue(null)
    const result = await revertPickedUp('order_ready')
    expect(result.error).toBe('Die Bestellung wurde inzwischen geändert, zum Beispiel storniert. Lade die Seite neu.')
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('Ownership: ohne Session keine Änderung', async () => {
    getSession.mockResolvedValue(null as never)
    const result = await revertPickedUp('order_1')
    expect(result.error).toBe('Nicht angemeldet')
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('setzt READY und leert pickedUpAt — online bezahlt bleibt die Zahlung unangetastet', async () => {
    const bezahltAm = new Date('2026-07-20T08:00:00Z')
    orderFindFirst.mockResolvedValue({
      paymentMethod: 'ONLINE', paymentStatus: 'PAID', paidAt: bezahltAm, pickedUpAt: new Date('2026-07-21T10:00:00Z'),
    } as never)
    const result = await revertPickedUp('order_1')
    expect(result).toEqual({})
    const updateArg = orderUpdateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
      data: Record<string, unknown>
    }
    // Bedingt auf Besitz, Ausgangsstatus und gelesenen Zahlstand
    expect(updateArg.where).toEqual({ id: 'order_1', farmId: 'farm_1', status: 'PICKED_UP', paymentStatus: 'PAID', paidAt: bezahltAm })
    expect(updateArg.data).toEqual({ status: 'READY', pickedUpAt: null })
    // Geld-Wahrheit online: kein paymentStatus, kein paidAt im Update
    expect(updateArg.data).not.toHaveProperty('paymentStatus')
    expect(updateArg.data).not.toHaveProperty('paidAt')
  })

  it('bleibt mailfrei — auch die neue Update-Mail wird NIE eingestellt', async () => {
    orderFindFirst.mockResolvedValue({ id: 'order_1' } as never)
    await revertPickedUp('order_1')
    expect(einstellen).not.toHaveBeenCalled()
  })
})
