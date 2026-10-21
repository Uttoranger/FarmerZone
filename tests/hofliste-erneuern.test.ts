/**
 * Tests für das Erneuern der Hofliste nach Bestellung und Storno
 * (src/server/hofliste-erneuern.ts; Register N19, Ergänzung 21.10.2026, Nr. 131).
 *
 * Beweist: erneuert wird nur bei einem Hof mit Höchstzahl, immer erst im
 * Nachlauf (`nachDerAntwort`, hier gesammelt und selbst abgearbeitet) und mit
 * `revalidateTag(HOEFE_CACHE_TAG, { expire: 0 })`; ein Wurf dabei geht ohne
 * Bestelldaten als Meldung nach Sentry und erreicht den Aufrufer nie. Und: Ein
 * Storno über `gibVerwaisteFreiOhneRisiko` (der Weg beim Rendern von Seiten)
 * erreicht den Helfer. `next/cache` ist keine Sicherheitsfunktion — ersetzt.
 * Dass eine Bestellung den Wurf übersteht, prüft die echte Datenbank
 * (tests/integration/volle-abholfenster.int.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: vi.fn((aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  }),
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendBestellungVerfallen: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ stripe: { paymentIntents: { retrieve: vi.fn(), cancel: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    pickupSlot: { findFirst: vi.fn() },
    order: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import * as Sentry from '@sentry/nextjs'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { erneuereHoflisteNachBestellung, erneuereHoflisteNachStorno } from '@/server/hofliste-erneuern'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'

const findFirst = vi.mocked(prisma.pickupSlot.findFirst)

async function arbeiteNachlaufAb(): Promise<void> {
  for (const aufgabe of nachlauf.aufgaben.splice(0)) await aufgabe()
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  vi.mocked(revalidateTag).mockImplementation(() => {})
  findFirst.mockResolvedValue(null)
})

describe('erneuereHoflisteNachBestellung', () => {
  it('erneuert bei einem Fenster mit Höchstzahl — erst nach der Antwort, ohne Zusatzabfrage', async () => {
    erneuereHoflisteNachBestellung(2)

    expect(revalidateTag).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(revalidateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG, { expire: 0 })
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('ohne Höchstzahl passiert nichts', async () => {
    erneuereHoflisteNachBestellung(null)

    expect(nachDerAntwort).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe('erneuereHoflisteNachStorno', () => {
  it('erneuert bei einem Hof mit aktiver Abholzeit mit Höchstzahl, bei einem ohne nicht', async () => {
    findFirst.mockResolvedValueOnce({ farmId: 'farm_a' } as never)
    erneuereHoflisteNachStorno('order_a')
    await arbeiteNachlaufAb()
    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(findFirst).toHaveBeenCalledWith({
      where: { isActive: true, maxOrders: { not: null }, farm: { orders: { some: { id: 'order_a' } } } },
      select: { farmId: true },
    })

    erneuereHoflisteNachStorno('order_b')
    await arbeiteNachlaufAb()
    expect(revalidateTag).toHaveBeenCalledTimes(1)
  })

  it('ein Wurf beim Erneuern geht ohne Bestelldaten als Meldung nach Sentry und erreicht den Aufrufer nie', async () => {
    findFirst.mockResolvedValue({ farmId: 'farm_a' } as never)
    vi.mocked(revalidateTag).mockImplementation(() => {
      throw new TypeError('Erneuern gescheitert bei order_geheim')
    })

    expect(() => erneuereHoflisteNachStorno('order_geheim')).not.toThrow()
    await expect(arbeiteNachlaufAb()).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [meldung, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, unknown]
    expect(meldung.name).toBe('TypeError')
    expect(kontext).toEqual({ level: 'warning', tags: { bereich: 'hofliste' } })
    expect(JSON.stringify([meldung.message, kontext])).not.toContain('order_geheim')
  })
})

describe('Storno beim Rendern einer Seite', () => {
  it('ein Storno über gibVerwaisteFreiOhneRisiko erreicht den Helfer über nachDerAntwort, ohne Sentry', async () => {
    const jetzt = new Date('2026-10-21T08:00:00Z')
    // Eine Barbestellung, deren Bestätigungsfrist längst abgelaufen ist (src/lib/fristen.ts).
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      {
        id: 'order_verwaist',
        paymentMethod: 'ONSITE_CASH',
        createdAt: new Date('2026-10-10T08:00:00Z'),
        pickupDate: new Date('2026-10-12T10:00:00Z'),
        pickupTimeStart: '15:00',
        stripePaymentIntentId: null,
        orderNumber: 'B-TEST',
        customerName: 'Erika Mustermann',
        customerEmail: 'kundin@example.com',
        farm: { name: 'Testhof A' },
      },
    ] as never)
    const tx = {
      order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      orderItem: { findMany: vi.fn().mockResolvedValue([]) },
      product: { update: vi.fn() },
    }
    vi.mocked(prisma.$transaction).mockImplementation((async (rueckruf: (t: typeof tx) => unknown) => rueckruf(tx)) as never)
    findFirst.mockResolvedValue({ farmId: 'farm_a' } as never)

    await gibVerwaisteFreiOhneRisiko('farm_a', jetzt)

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order_verwaist', status: 'PENDING_CONFIRMATION' } })
    )
    // Erneuert wird nicht im Storno selbst (beim Rendern würfe es), sondern im Nachlauf.
    expect(revalidateTag).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ farm: { orders: { some: { id: 'order_verwaist' } } } }) }))
    expect(revalidateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG, { expire: 0 })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
