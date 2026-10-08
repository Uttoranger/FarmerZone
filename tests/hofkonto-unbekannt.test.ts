/**
 * Ein gespeichertes Hof-Konto, das Stripe nicht kennt (Register Z2,
 * Nachtlauf Nr. 42) — was `vermerkeUnbekanntesHofKonto` daraus macht.
 *
 * Beweist:
 *  - Der Hof gilt als nicht bereit: `stripeAccountReady` wird bedingt auf
 *    false gesetzt — nur, solange noch DIESELBE Kennung gespeichert ist.
 *    Die Kennung selbst schreibt der Vermerk nie (nicht automatisch löschen).
 *  - Sentry höchstens einmal je Hof und Tag, über die Bremse in der Datenbank
 *    (gehashter Schlüssel), und nur mit der Hof-ID — nie mit der Konto-Kennung.
 *  - Der Vermerk wirft nie: Er sitzt auf Fehlerwegen (Kasse, Einstellungen),
 *    die danach noch antworten müssen.
 *
 * Die Zählung selbst (über alle Instanzen, Fensterwechsel) prüft
 * tests/integration/hofkonto-unbekannt.int.test.ts gegen echtes Postgres.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { updateMany: vi.fn() } } }))
vi.mock('@/server/bremse-datenbank', () => ({ bremseUeberAlleInstanzen: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import { vermerkeUnbekanntesHofKonto } from '@/server/hofkonto-unbekannt'

const updateMany = vi.mocked(prisma.farm.updateMany)
const bremse = vi.mocked(bremseUeberAlleInstanzen)
const JETZT = new Date('2026-10-08T09:00:00.000Z')
const KONTO = 'acct_erfunden_alt'

beforeEach(() => {
  vi.clearAllMocks()
  updateMany.mockResolvedValue({ count: 1 } as never)
  bremse.mockResolvedValue(true)
})

describe('nicht bereit — die Kennung bleibt', () => {
  it('setzt stripeAccountReady bedingt auf false: nur für diesen Hof und nur bei derselben Kennung', async () => {
    await vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)

    expect(updateMany).toHaveBeenCalledTimes(1)
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'farm_1', stripeAccountId: KONTO, stripeAccountReady: true },
      data: { stripeAccountReady: false },
    })
  })

  it('schreibt die Konto-Kennung nie — auch nicht auf null', async () => {
    await vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)

    const daten = (updateMany.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(Object.keys(daten)).toEqual(['stripeAccountReady'])
  })
})

describe('Sentry höchstens einmal je Hof und Tag, nur mit Hof-ID', () => {
  it('fragt die Drossel mit der Hof-ID als Merkmal', async () => {
    await vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)

    expect(bremse).toHaveBeenCalledWith([{ bremse: DB_BREMSEN.stripeKontoUnbekannt, merkmal: 'farm_1' }], JETZT)
  })

  it('das erste Mal im Fenster: eine Meldung mit Hof-ID, ohne Konto-Kennung', async () => {
    await vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureMessage).mock.calls[0][1]).toEqual({
      level: 'warning',
      tags: { aufgabe: 'stripe-konto', grund: 'konto_unbekannt' },
      extra: { farmId: 'farm_1' },
    })
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain('acct_')
  })

  it('schon gemeldet (Drossel sagt nein): keine Meldung — der Hof gilt trotzdem als nicht bereit', async () => {
    bremse.mockResolvedValue(false)

    await vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)

    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(updateMany).toHaveBeenCalledTimes(1)
  })

  it('die Drossel ist ein eigener Zweck: eine Meldung je Tag', () => {
    expect(DB_BREMSEN.stripeKontoUnbekannt).toEqual({ zweck: 'stripe-konto-unbekannt', max: 1, fensterMs: 24 * 60 * 60 * 1000 })
  })
})

describe('wirft nie', () => {
  it('Datenbankfehler beim Vermerk: keine Ausnahme, Sentry ohne Kennung, die Drossel läuft weiter', async () => {
    updateMany.mockRejectedValue(Object.assign(new Error(`Fehler bei ${KONTO}`), { name: 'PrismaClientKnownRequestError' }))

    await expect(vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)).not.toContain('acct_')
    expect(bremse).toHaveBeenCalledTimes(1)
  })

  it('eine scheiternde Drossel lässt den Aufrufer weiterlaufen und meldet lieber einmal zu viel (fail-open)', async () => {
    bremse.mockRejectedValue(new Error('unerwartet'))

    await expect(vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)).resolves.toBeUndefined()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
})
