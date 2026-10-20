/**
 * Die Drossel der Mail „Ein Hof hat geantwortet" wartet höchstens
 * DB_BREMSE_ZEITLIMIT_MS (1,5 s) auf ihren Zähler (Register N14, Ergänzung;
 * Nr. 105; Frist seit Nr. 121). Gebaut mit der ECHTEN Bremse
 * (`src/server/bremse-datenbank.ts`), nur die Datenbank dahinter hängt.
 *
 * Beweist: Hängt der Zähler, bleibt die Antwort des Hofs davon unberührt
 * (die Mail liegt im Nachlauf); innerhalb der Frist geht keine Mail, nach ihr
 * geht sie (fail-open, lieber eine zu viel als keine), und nach Sentry geht
 * nur die Klasse des Fehlers mit dem Grund „zeitlimit" — kein Text der
 * Antwort, keine Kennung des Fadens. Die Zählung selbst (ein Treffer je
 * Fenster) prüft tests/postfach-erstattung-drossel.test.ts.
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
      ...(await import('./admin-sitzung')).passkeyAttrappen(),
      user: { findUnique: vi.fn() },
      // Der Zähler der Bremse (INSERT … ON CONFLICT … RETURNING).
      $queryRaw: vi.fn(),
      $transaction: vi.fn(async (arbeit: (t: typeof tx) => Promise<unknown>) => arbeit(tx)),
    },
  }
})

import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendHofAntwortAnTeam } from '@/lib/email'
import { DB_BREMSE_ZEITLIMIT_MS, DB_BREMSEN, bremsSchluessel } from '@/lib/bremse-datenbank'
import { env } from '@/lib/env'
import { antworteAlsHof } from '@/server/actions/postfach'
import { adminSitzung } from './admin-sitzung'

const FADEN = 'cmffaden0000000000001abc'
const GEHEIMER_TEXT = 'Erfundene Antwort, die nie nach Sentry gehört.'

async function arbeiteNachlaufAb(): Promise<void> {
  for (const aufgabe of nachlauf.aufgaben.splice(0)) await aufgabe()
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  vi.useFakeTimers()
  vi.mocked(auth.api.getSession).mockResolvedValue(adminSitzung('hof_1') as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Drossel „Ein Hof hat geantwortet": der Zähler hängt', () => {
  it('die Antwort kommt sofort, die Mail erst nach der Frist von 1,5 s — dann geht sie trotzdem, gemeldet wird nur die Klasse', async () => {
    vi.mocked(prisma.$queryRaw).mockImplementation(() => new Promise(() => {}) as never)

    // Der Hof wartet nicht auf die Drossel: Die Mail liegt im Nachlauf.
    expect(await antworteAlsHof({ unterhaltungId: FADEN, text: GEHEIMER_TEXT })).toEqual({ ok: true })
    const fertig = arbeiteNachlaufAb()
    await vi.advanceTimersByTimeAsync(0)
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)

    // Innerhalb der Frist wartet die Drossel noch.
    await vi.advanceTimersByTimeAsync(DB_BREMSE_ZEITLIMIT_MS - 1)
    expect(sendHofAntwortAnTeam).not.toHaveBeenCalled()

    // Mit der Frist gilt sie als „frei": fail-open.
    await vi.advanceTimersByTimeAsync(1)
    await fertig
    expect(sendHofAntwortAnTeam).toHaveBeenCalledTimes(1)

    // Nach Sentry geht nur die Klasse und der Grund — kein Text der Antwort, keine Kennung des Fadens.
    // (In EINEM Fall: Die Bremse meldet höchstens einmal je Instanz und Abstand.)
    const [fehler, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] ?? []
    expect((fehler as Error).name).toBe('BremseZeitlimit')
    expect(kontext).toMatchObject({ tags: { aufgabe: 'bremse-datenbank', grund: 'zeitlimit', zweck: DB_BREMSEN.antwortHofMail.zweck } })
    const gemeldet = JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)
    expect(gemeldet).not.toContain('Erfundene Antwort')
    expect(gemeldet).not.toContain(FADEN)
  })

  it('antwortet der Zähler rechtzeitig mit „schon ein Treffer", geht keine zweite Mail', async () => {
    // Die Bremse liest den Stand über den Schlüssel; ein Stand ohne Zeile zählt als 0 — wer das Gegenteil will, liefert die Zeile.
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ schluessel: bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.antwortHofMail.zweck, FADEN), zaehler: 2 }])

    await antworteAlsHof({ unterhaltungId: FADEN, text: GEHEIMER_TEXT })
    await arbeiteNachlaufAb()

    expect(sendHofAntwortAnTeam).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
