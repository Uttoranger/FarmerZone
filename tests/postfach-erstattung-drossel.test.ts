/**
 * „Erstattung erledigt" und die Drossel der Mail „Ein Hof hat geantwortet"
 * (Register N14, Ergänzung; Nachtlauf Nr. 105) — die Actions mit gemockter
 * Datenbank. Den Zustand in Postgres und die echte Bremse prüft
 * tests/integration/postfach-ruhig.int.test.ts.
 *
 * Beweist:
 *  - markiereErstattungErledigt schreibt ohne Admin nichts; mit Admin genau
 *    EIN bedingtes Schreiben, das nur das Merkmal löscht; eine fremde oder
 *    schon erledigte Bestellung (0 Zeilen) ist kein Fehler.
 *  - Drossel mit fester Uhr: Antworten um 10:05 und 10:15 → eine Mail, um
 *    11:05 wieder eine (das Fenster ist die volle Stunde der Bremse); wirft
 *    die Bremse, geht die Mail trotzdem (fail-open), nach Sentry nur die Klasse.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn(async () => ({ id: 'cmfhof00000000000000test' })) }))
vi.mock('@/server/queries/postfach', () => ({
  ladeBetreiberEmpfaenger: vi.fn(async () => ['team@example.com']),
  ladeAntwortFuerTeam: vi.fn(async () => ({ hofName: 'Testhof A', titel: 'Erfundener Titel' })),
}))
vi.mock('@/server/bremse-datenbank', () => ({ zaehleVersuche: vi.fn(), bremseUeberAlleInstanzen: vi.fn(async () => true) }))
vi.mock('@/lib/email', () => ({ sendHofAntwortAnTeam: vi.fn(async () => ({ gesendet: 1, gescheitert: 0 })) }))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as (() => Promise<void>)[] }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/prisma', async () => {
  const tx = {
    unterhaltung: { updateMany: vi.fn(async () => ({ count: 1 })) },
    nachricht: { create: vi.fn(async () => ({})) },
    unterhaltungStand: { createMany: vi.fn(async () => ({ count: 1 })), updateMany: vi.fn(async () => ({ count: 1 })) },
  }
  return {
    prisma: {
      // Die Wache liest seit Nr. 115 die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
      ...(await import('./admin-sitzung')).passkeyAttrappen(),
      user: { findUnique: vi.fn() },
      order: { updateMany: vi.fn() },
      $transaction: vi.fn(async (arbeit: (t: typeof tx) => Promise<unknown>) => arbeit(tx)),
    },
  }
})

import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendHofAntwortAnTeam } from '@/lib/email'
import { zaehleVersuche, type Versuch } from '@/server/bremse-datenbank'
import { DB_BREMSEN, fensterBeginn } from '@/lib/bremse-datenbank'
import { antworteAlsHof, markiereErstattungErledigt } from '@/server/actions/postfach'
import { adminSitzung } from './admin-sitzung'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderUpdateMany = vi.mocked(prisma.order.updateMany)

const BESTELLUNG = 'cmfbestellung000000001ab'
const FADEN = 'cmffaden0000000000001abc'

async function arbeiteNachlaufAb(): Promise<void> {
  for (const aufgabe of nachlauf.aufgaben.splice(0)) await aufgabe()
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  getSession.mockResolvedValue(adminSitzung('admin_1') as never)
  userFindUnique.mockResolvedValue({ isAdmin: true } as never)
  orderUpdateMany.mockResolvedValue({ count: 1 })
})

describe('markiereErstattungErledigt — nur Admin, nur das Merkmal', () => {
  it('ohne Anmeldung wird nichts geschrieben', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG })).toEqual({ error: 'Nicht angemeldet.' })
    expect(orderUpdateMany).not.toHaveBeenCalled()
  })

  it('angemeldet, aber kein Admin: wird nichts geschrieben', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG })).toEqual({ error: 'Kein Zugriff.' })
    expect(orderUpdateMany).not.toHaveBeenCalled()
  })

  it('löscht nur erstattungOffenSeit — bedingt auf eine offene Erstattung, sonst nichts', async () => {
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG })).toEqual({ ok: true })
    expect(orderUpdateMany).toHaveBeenCalledTimes(1)
    expect(orderUpdateMany).toHaveBeenCalledWith({ where: { id: BESTELLUNG, erstattungOffenSeit: { not: null } }, data: { erstattungOffenSeit: null } })
  })

  it('fremde oder schon erledigte Bestellung: 0 Zeilen, kein Fehler', async () => {
    orderUpdateMany.mockResolvedValue({ count: 0 })
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG })).toEqual({ ok: true })
  })

  it('eine Kennung, die keine cuid ist, oder ein Feld mehr: fester Satz, nichts geschrieben', async () => {
    expect(await markiereErstattungErledigt({ orderId: 'abc' })).toEqual({ error: 'Das hat nicht geklappt. Bitte lade die Seite neu.' })
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, betrag: 100 })).toEqual({ error: 'Das hat nicht geklappt. Bitte lade die Seite neu.' })
    expect(orderUpdateMany).not.toHaveBeenCalled()
  })
})

describe('Drossel: „Ein Hof hat geantwortet" höchstens einmal je Faden und voller Stunde', () => {
  // Ein Zähler je Zweck, Merkmal und festem Fenster — so zählt die Tabelle RateLimitZaehler.
  const zaehler = new Map<string, number>()

  beforeEach(() => {
    zaehler.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    getSession.mockResolvedValue(adminSitzung('hof_1') as never)
    vi.mocked(zaehleVersuche).mockImplementation(async (versuche: readonly Versuch[], jetzt: Date = new Date()) =>
      versuche.map(({ bremse, merkmal }) => {
        const schluessel = `${bremse.zweck}|${merkmal}|${fensterBeginn(jetzt, bremse.fensterMs).getTime()}`
        const stand = (zaehler.get(schluessel) ?? 0) + 1
        zaehler.set(schluessel, stand)
        return stand
      })
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function antwortUm(zeit: string): Promise<void> {
    vi.setSystemTime(new Date(zeit))
    expect(await antworteAlsHof({ unterhaltungId: FADEN, text: 'Erfundene Antwort.' })).toEqual({ ok: true })
    await arbeiteNachlaufAb()
  }

  it('10:05 und 10:15 → eine Mail; 11:05 → wieder eine', async () => {
    await antwortUm('2026-10-16T10:05:00Z')
    await antwortUm('2026-10-16T10:15:00Z')
    expect(sendHofAntwortAnTeam).toHaveBeenCalledTimes(1)

    await antwortUm('2026-10-16T11:05:00Z')
    expect(sendHofAntwortAnTeam).toHaveBeenCalledTimes(2)
    // Gezählt wird je Faden mit der Bremse der Mail — Merkmal ist die Kennung des Fadens.
    expect(vi.mocked(zaehleVersuche).mock.calls.every(([v]) => v[0]?.bremse === DB_BREMSEN.antwortHofMail && v[0]?.merkmal === FADEN)).toBe(true)
  })

  it('10:59 und 11:00 liegen in zwei Fenstern — je eine Mail', async () => {
    await antwortUm('2026-10-16T10:59:59Z')
    await antwortUm('2026-10-16T11:00:00Z')
    expect(sendHofAntwortAnTeam).toHaveBeenCalledTimes(2)
  })

  it('wirft die Bremse, geht die Mail trotzdem — nach Sentry nur Klasse und Kennung', async () => {
    vi.mocked(zaehleVersuche).mockRejectedValue(new TypeError('Verbindung weg'))
    await antwortUm('2026-10-16T10:05:00Z')
    expect(sendHofAntwortAnTeam).toHaveBeenCalledTimes(1)
    const [fehler, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] ?? []
    expect((fehler as Error).name).toBe('TypeError')
    expect((fehler as Error).message).not.toContain('Verbindung')
    expect(JSON.stringify(kontext)).not.toContain('Erfundene Antwort')
  })

  it('ohne Empfänger wird nicht gezählt und nichts verschickt', async () => {
    const { ladeBetreiberEmpfaenger } = await import('@/server/queries/postfach')
    vi.mocked(ladeBetreiberEmpfaenger).mockResolvedValueOnce([])
    await antwortUm('2026-10-16T10:05:00Z')
    expect(zaehleVersuche).not.toHaveBeenCalled()
    expect(sendHofAntwortAnTeam).not.toHaveBeenCalled()
  })
})
