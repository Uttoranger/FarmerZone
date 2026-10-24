/**
 * Tests für das Erneuern der Hofliste nach Bestellung und Storno
 * (src/server/hofliste-erneuern.ts; Register N19, Ergänzung 21.10.2026, Nr. 131).
 *
 * Seit Nr. 163 (Register N19, Ergänzung 24.10.2026): erneuert wird nur, wenn
 * die Bestellung ihr Abholfenster voll macht bzw. der Storno ein volles wieder
 * frei — die Entscheidung trifft die reine Funktion `wechseltFensterStand`,
 * gezählt wird mit `belegung` wie in der Kasse.
 *
 * Beweist: erneuert wird nur bei einem Fenster mit Höchstzahl, immer erst im
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
    order: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import * as Sentry from '@sentry/nextjs'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { erneuereHoflisteNachBestellung, erneuereHoflisteNachStorno, wechseltFensterStand } from '@/server/hofliste-erneuern'
import type { HofFenster } from '@/server/abholfenster'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'

const findFirst = vi.mocked(prisma.pickupSlot.findFirst)
const findUnique = vi.mocked(prisma.order.findUnique)
const zaehle = vi.mocked(prisma.order.count)

/** Ein Termin, der noch lange bestellbar ist (Bestellschluss = Beginn, src/lib/abholfenster.ts). */
const TERMIN = { datum: '2099-06-01', start: '15:00', ende: '18:00' }

function fenster(maxOrders: number | null): HofFenster {
  return { ...TERMIN, slot: { id: 'slot_a', dayOfWeek: 1, startTime: '15:00', endTime: '18:00', maxOrders, isActive: true } }
}

/** Die stornierte Bestellung, wie der Nachlauf sie liest — Abholtag als Wiener Mittag. */
function stornoBestellung(datum = TERMIN.datum) {
  return { farmId: 'farm_a', pickupDate: new Date(`${datum}T10:00:00Z`), pickupTimeStart: '15:00', pickupTimeEnd: '18:00' }
}

async function arbeiteNachlaufAb(): Promise<void> {
  for (const aufgabe of nachlauf.aufgaben.splice(0)) await aufgabe()
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  vi.mocked(revalidateTag).mockImplementation(() => {})
  findFirst.mockResolvedValue(null)
})

describe('wechseltFensterStand — die reine Entscheidung', () => {
  it('Bestellung: erneuert nur, wenn sie das Fenster voll macht', () => {
    expect(wechseltFensterStand('bestellung', 3, 3)).toBe(true)
    // Gegenprobe: ein Platz bleibt frei.
    expect(wechseltFensterStand('bestellung', 2, 3)).toBe(false)
    // War schon voll (Höchstzahl nachträglich gesenkt): die Liste kennt das schon.
    expect(wechseltFensterStand('bestellung', 4, 3)).toBe(false)
  })

  it('Storno: erneuert nur, wenn ein volles Fenster wieder frei wird', () => {
    expect(wechseltFensterStand('storno', 2, 3)).toBe(true)
    // Gegenprobe: war nicht voll, bleibt frei.
    expect(wechseltFensterStand('storno', 1, 3)).toBe(false)
    // Bleibt trotz Storno voll (überbucht nach gesenkter Höchstzahl).
    expect(wechseltFensterStand('storno', 3, 3)).toBe(false)
  })

  it('ohne Höchstzahl nie', () => {
    expect(wechseltFensterStand('bestellung', 1, null)).toBe(false)
    expect(wechseltFensterStand('storno', 0, null)).toBe(false)
  })
})

describe('erneuereHoflisteNachBestellung', () => {
  it('Fenster wird voll → erneuert, erst nach der Antwort, gezählt wie in der Kasse', async () => {
    zaehle.mockResolvedValue(2)
    erneuereHoflisteNachBestellung('farm_a', fenster(2))

    expect(revalidateTag).not.toHaveBeenCalled()
    expect(zaehle).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(revalidateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG, { expire: 0 })
    // Dieselbe Zählung wie `imAbholfenster` (`belegung`): nicht storniert, dieser Hof, Tag und Fenster.
    expect(zaehle).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { not: 'CANCELLED' },
        farmId: 'farm_a',
        pickupTimeStart: '15:00',
        pickupTimeEnd: '18:00',
      }),
    })
  })

  it('ein Platz bleibt → nicht erneuert', async () => {
    zaehle.mockResolvedValue(1)
    erneuereHoflisteNachBestellung('farm_a', fenster(2))
    await arbeiteNachlaufAb()
    expect(zaehle).toHaveBeenCalledTimes(1)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('ohne Höchstzahl passiert nichts, nicht einmal eine Zählung', async () => {
    erneuereHoflisteNachBestellung('farm_a', fenster(null))

    expect(nachDerAntwort).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(zaehle).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe('erneuereHoflisteNachStorno', () => {
  it('volles Fenster wird frei → erneuert; sucht die Abholzeit mit Höchstzahl genau dieses Termins', async () => {
    findUnique.mockResolvedValue(stornoBestellung() as never)
    findFirst.mockResolvedValue({ maxOrders: 2 } as never)
    zaehle.mockResolvedValue(1)

    erneuereHoflisteNachStorno('order_a')
    expect(findUnique).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()

    expect(revalidateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG, { expire: 0 })
    expect(findFirst).toHaveBeenCalledWith({
      // 2099-06-01 ist ein Montag (1).
      where: { farmId: 'farm_a', isActive: true, maxOrders: { not: null }, dayOfWeek: 1, startTime: '15:00', endTime: '18:00' },
      select: { maxOrders: true },
    })
  })

  it('Fenster war nicht voll → nicht erneuert', async () => {
    findUnique.mockResolvedValue(stornoBestellung() as never)
    findFirst.mockResolvedValue({ maxOrders: 3 } as never)
    zaehle.mockResolvedValue(1)
    erneuereHoflisteNachStorno('order_a')
    await arbeiteNachlaufAb()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('ohne Abholzeit mit Höchstzahl → nie, ohne Zählung', async () => {
    findUnique.mockResolvedValue(stornoBestellung() as never)
    findFirst.mockResolvedValue(null)
    erneuereHoflisteNachStorno('order_a')
    await arbeiteNachlaufAb()
    expect(zaehle).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('ein vergangener Termin steht in keiner Liste → nicht erneuert, ohne weitere Abfrage', async () => {
    findUnique.mockResolvedValue(stornoBestellung('2001-03-15') as never)
    erneuereHoflisteNachStorno('order_a')
    await arbeiteNachlaufAb()
    expect(findFirst).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('ein Wurf beim Erneuern geht ohne Bestelldaten als Meldung nach Sentry und erreicht den Aufrufer nie', async () => {
    findUnique.mockResolvedValue(stornoBestellung() as never)
    findFirst.mockResolvedValue({ maxOrders: 1 } as never)
    zaehle.mockResolvedValue(0)
    vi.mocked(revalidateTag).mockImplementation(() => {
      throw new TypeError('Erneuern gescheitert bei order_geheim')
    })

    expect(() => erneuereHoflisteNachStorno('order_geheim')).not.toThrow()
    await expect(arbeiteNachlaufAb()).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [meldung, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, unknown]
    expect(meldung.name).toBe('TypeError')
    // Neutral gefasst: gleich, ob eine Bestellung oder ein Storno das Erneuern ausgelöst hat.
    expect(meldung.message).toBe('Hofliste nicht erneuert')
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
    findUnique.mockResolvedValue(stornoBestellung() as never)
    findFirst.mockResolvedValue({ maxOrders: 1 } as never)
    zaehle.mockResolvedValue(0)

    await gibVerwaisteFreiOhneRisiko('farm_a', jetzt)

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order_verwaist', status: 'PENDING_CONFIRMATION' } })
    )
    // Erneuert wird nicht im Storno selbst (beim Rendern würfe es), sondern im Nachlauf.
    expect(revalidateTag).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'order_verwaist' } }))
    expect(revalidateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG, { expire: 0 })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
