/**
 * Die Drossel der Mail „Ein Hof hat geantwortet" (Register N14, Ergänzung;
 * Nachtlauf Nr. 105) — die Action mit gemockter Datenbank. Den Zustand in
 * Postgres und die echte Bremse prüft tests/integration/postfach-ruhig.int.test.ts.
 * „Erstattung erledigt" steht seit Nr. 186 in Admin › Bestellungen
 * (tests/admin-bestellung.test.ts).
 *
 * Beweist:
 *  - Drossel mit fester Uhr: Antworten um 10:05 und 10:15 → eine Mail, um
 *    11:05 wieder eine (das Fenster ist die volle Stunde der Bremse). Die
 *    Frist der Drossel (1,5 s, danach geht die Mail, nach Sentry nur die Klasse)
 *    prüft tests/postfach-drossel-frist.test.ts mit der echten Bremse.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn(async () => ({ id: 'cmfhof00000000000000test' })) }))
vi.mock('@/server/queries/postfach', () => ({
  ladeBetreiberEmpfaenger: vi.fn(async () => ['team@example.com']),
}))
vi.mock('@/server/bremse-datenbank', () => ({ bremseUeberAlleInstanzen: vi.fn(async () => true) }))
// Die Mail an das Team ist seit Nr. 159 je Adresse ein Auftrag der Warteschlange.
vi.mock('@/server/mail-warteschlange', () => ({ stelleMailEin: vi.fn(async () => 1) }))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as (() => Promise<void>)[] }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/prisma', async () => {
  const tx = {
    unterhaltung: { updateMany: vi.fn(async () => ({ count: 1 })) },
    nachricht: { create: vi.fn(async () => ({ id: 'cmfnachricht000000000001' })) },
    unterhaltungStand: { createMany: vi.fn(async () => ({ count: 1 })), updateMany: vi.fn(async () => ({ count: 1 })) },
  }
  return {
    prisma: {
      // Die Wache liest seit Nr. 115 die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
      ...(await import('./admin-sitzung')).passkeyAttrappen(),
      user: { findUnique: vi.fn() },
      order: { updateMany: vi.fn() },
      // Die Kennung der weiteren Adresse aus der Zustellung (empfaengerKennungen).
      betreiberEmpfaenger: { findMany: vi.fn(async () => [{ id: 'cmfteam00000000000000001', email: 'team@example.com' }]) },
      $transaction: vi.fn(async (arbeit: (t: typeof tx) => Promise<unknown>) => arbeit(tx)),
    },
  }
})

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stelleMailEin } from '@/server/mail-warteschlange'
import { bremseUeberAlleInstanzen, type Versuch } from '@/server/bremse-datenbank'
import { DB_BREMSEN, fensterBeginn, innerhalbDerGrenze } from '@/lib/bremse-datenbank'
import { antworteAlsHof } from '@/server/actions/postfach'
import { adminSitzung } from './admin-sitzung'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderUpdateMany = vi.mocked(prisma.order.updateMany)

const FADEN = 'cmffaden0000000000001abc'

async function arbeiteNachlaufAb(): Promise<void> {
  for (const aufgabe of nachlauf.aufgaben.splice(0)) await aufgabe()
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  getSession.mockResolvedValue(adminSitzung('admin_1') as never)
  userFindUnique.mockResolvedValue({ isAdmin: true, adminInhaber: true } as never)
  orderUpdateMany.mockResolvedValue({ count: 1 })
})

describe('Drossel: „Ein Hof hat geantwortet" höchstens einmal je Faden und voller Stunde', () => {
  // Ein Zähler je Zweck, Merkmal und festem Fenster — so zählt die Tabelle RateLimitZaehler.
  const zaehler = new Map<string, number>()

  beforeEach(() => {
    zaehler.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    getSession.mockResolvedValue(adminSitzung('hof_1') as never)
    // Wie die echte Bremse: je Zweck, Merkmal und Fenster einen Treffer zählen, erlaubt = innerhalb der Grenze.
    vi.mocked(bremseUeberAlleInstanzen).mockImplementation(async (versuche: readonly Versuch[], jetzt: Date = new Date()) =>
      versuche
        .map(({ bremse, merkmal }) => {
          const schluessel = `${bremse.zweck}|${merkmal}|${fensterBeginn(jetzt, bremse.fensterMs).getTime()}`
          const stand = (zaehler.get(schluessel) ?? 0) + 1
          zaehler.set(schluessel, stand)
          return innerhalbDerGrenze(stand, bremse.max)
        })
        .every(Boolean)
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
    expect(stelleMailEin).toHaveBeenCalledTimes(1)

    await antwortUm('2026-10-16T11:05:00Z')
    expect(stelleMailEin).toHaveBeenCalledTimes(2)
    // Gezählt wird je Faden mit der Bremse der Mail — Merkmal ist die Kennung des Fadens.
    expect(vi.mocked(bremseUeberAlleInstanzen).mock.calls.every(([v]) => v[0]?.bremse === DB_BREMSEN.antwortHofMail && v[0]?.merkmal === FADEN)).toBe(true)
  })

  it('10:59 und 11:00 liegen in zwei Fenstern — je eine Mail', async () => {
    await antwortUm('2026-10-16T10:59:59Z')
    await antwortUm('2026-10-16T11:00:00Z')
    expect(stelleMailEin).toHaveBeenCalledTimes(2)
  })

  it('ohne Empfänger wird nicht gezählt und nichts verschickt', async () => {
    const { ladeBetreiberEmpfaenger } = await import('@/server/queries/postfach')
    vi.mocked(ladeBetreiberEmpfaenger).mockResolvedValueOnce([])
    await antwortUm('2026-10-16T10:05:00Z')
    expect(bremseUeberAlleInstanzen).not.toHaveBeenCalled()
    expect(stelleMailEin).not.toHaveBeenCalled()
  })
})
