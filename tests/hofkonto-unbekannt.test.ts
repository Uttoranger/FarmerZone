/**
 * Ein gespeichertes Hof-Konto, das Stripe nicht kennt (Register Z2,
 * Nachtlauf Nr. 42) — was `vermerkeUnbekanntesHofKonto` daraus macht.
 *
 * Beweist:
 *  - Der Hof gilt als nicht bereit: `stripeAccountReady` wird bedingt auf
 *    false gesetzt — nur, solange noch DIESELBE Kennung gespeichert ist.
 *    Die Kennung selbst schreibt der Vermerk nie (nicht automatisch löschen).
 *  - Dreht sich der Bereit-Wert (count 1), steht „Online-Zahlung pausiert“
 *    mit Grund konto_unbekannt im Protokoll (N33, N49); danach, unabhängig
 *    davon, wird der gespeicherte grobe Stand gelöscht (Anzeige „Angaben
 *    fehlen“), bedingt auf dieselbe Kennung.
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
vi.mock('@/server/admin-protokoll', () => ({ protokolliere: vi.fn(async () => true) }))

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import { protokolliere } from '@/server/admin-protokoll'
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
  it('setzt stripeAccountReady bedingt auf false und löscht danach den Stand — nur für diesen Hof und nur bei derselben Kennung', async () => {
    await vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)

    expect(updateMany).toHaveBeenCalledTimes(2)
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'farm_1', stripeAccountId: KONTO, stripeAccountReady: true },
      data: { stripeAccountReady: false },
    })
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'farm_1', stripeAccountId: KONTO },
      data: { stripeKontoStand: null },
    })
  })

  it('schreibt die Konto-Kennung nie — auch nicht auf null', async () => {
    await vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)

    for (const aufruf of updateMany.mock.calls) {
      expect(Object.keys((aufruf[0] as { data: Record<string, unknown> }).data)).not.toContain('stripeAccountId')
    }
  })

  it('Wechsel bereit → nicht bereit: ein Protokolleintrag „Online-Zahlung pausiert“ (System, Grund konto_unbekannt)', async () => {
    await vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)

    expect(protokolliere).toHaveBeenCalledTimes(1)
    expect(protokolliere).toHaveBeenCalledWith({
      wer: null,
      art: 'online_zahlung_pausiert',
      bezugArt: 'hof',
      bezugId: 'farm_1',
      mitPasskey: false,
      grund: 'konto_unbekannt',
    })
  })

  it('war der Hof schon nicht bereit (count 0): kein Protokoll, der Stand wird trotzdem gelöscht', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 } as never)

    await vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)

    expect(protokolliere).not.toHaveBeenCalled()
    expect(updateMany).toHaveBeenNthCalledWith(2, { where: { id: 'farm_1', stripeAccountId: KONTO }, data: { stripeKontoStand: null } })
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
    expect(updateMany).toHaveBeenCalledTimes(2)
  })

  it('die Drossel ist ein eigener Zweck: eine Meldung je Tag', () => {
    expect(DB_BREMSEN.stripeKontoUnbekannt).toEqual({ zweck: 'stripe-konto-unbekannt', max: 1, fensterMs: 24 * 60 * 60 * 1000 })
  })
})

describe('wirft nie', () => {
  it('Datenbankfehler beim Vermerk: keine Ausnahme, Sentry ohne Kennung, Stand und Drossel laufen weiter', async () => {
    updateMany.mockRejectedValueOnce(Object.assign(new Error(`Fehler bei ${KONTO}`), { name: 'PrismaClientKnownRequestError' }))

    await expect(vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)).not.toContain('acct_')
    expect(protokolliere).not.toHaveBeenCalled()
    expect(updateMany).toHaveBeenCalledTimes(2)
    expect(bremse).toHaveBeenCalledTimes(1)
  })

  it('auch das Löschen des Stands wirft nie', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 } as never).mockRejectedValueOnce(new Error(`Fehler bei ${KONTO}`))

    await expect(vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)).not.toContain('acct_')
  })

  it('eine scheiternde Drossel lässt den Aufrufer weiterlaufen und meldet lieber einmal zu viel (fail-open)', async () => {
    bremse.mockRejectedValue(new Error('unerwartet'))

    await expect(vermerkeUnbekanntesHofKonto('farm_1', KONTO, JETZT)).resolves.toBeUndefined()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
})
