/**
 * Tests für die Schreibroute POST /api/triage/status (Sprint
 * Briefkasten-Rückkopplung, Teil B) — am echten Handler, nur Prisma und
 * next/cache gemockt. Die Übergangsregeln selbst prüft triage-status.test.ts;
 * hier geht es um die Tür: Token, Rolle, Body, Suche, bedingtes Schreiben.
 *
 * Beweist: falscher Token je Status → 403, unbekannter oder fehlender → 401,
 * gleiche Tokens → 401, jeweils ohne Datenbankzugriff; grund fehlt → 400;
 * antwortAnMelder im Body → 400; die Art bleibt unverändert; die Audit-Zeile
 * steht in der Notiz; geschrieben wird nur auf den gelesenen Stand; ein
 * geplanter Wunsch wird nach dem Deployment „Umgesetzt"; Wiederöffnen nimmt
 * nur den festen Satz zurück; mehrdeutige Kurznummer → 409; Rate-Limit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({ prisma: { meldung: { findMany: vi.fn(), updateMany: vi.fn() } } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import * as route from '@/app/api/triage/status/route'
import { prisma } from '@/lib/prisma'

const findMany = vi.mocked(prisma.meldung.findMany)
const updateMany = vi.mocked(prisma.meldung.updateMany)

const LESEN = 'lese-token-test-1'
const WRITE = 'write-token-test-2'
const MERGE = 'merge-token-test-3'

const ID = 'cmmeldung00000000001abcd'

type Zeile = { id: string; status: string; art: string; triageNotiz: string | null; antwortAnMelder: string | null }
const zeile = (extra: Partial<Zeile> = {}): Zeile => ({
  id: ID,
  status: 'NEU',
  art: 'FEHLER',
  triageNotiz: null,
  antwortAnMelder: null,
  ...extra,
})

let ipZaehler = 0
function neueIp(): string {
  ipZaehler += 1
  return `198.51.100.${ipZaehler}`
}

function anfrage(body: unknown, opts: { token?: string | null; ip?: string } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': opts.ip ?? neueIp(), 'content-type': 'application/json' }
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? WRITE}`
  return new NextRequest('http://localhost/api/triage/status', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T10:00:00Z'))
  vi.stubEnv('TRIAGE_TOKEN', LESEN)
  vi.stubEnv('TRIAGE_WRITE_TOKEN', WRITE)
  vi.stubEnv('TRIAGE_MERGE_TOKEN', MERGE)
  findMany.mockResolvedValue([zeile()] as never)
  updateMany.mockResolvedValue({ count: 1 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Schreibroute — Token', () => {
  const faelle = [
    { status: 'GEPLANT', body: { prNummer: 5 }, richtig: WRITE, falsch: MERGE },
    { status: 'VERMUTLICH_WUNSCH', body: { grund: 'Klingt nach Wunsch.' }, richtig: WRITE, falsch: MERGE },
    { status: 'ERLEDIGT', body: { prNummer: 5 }, richtig: MERGE, falsch: WRITE },
    { status: 'GEPRUEFT', body: { prNummer: 5 }, richtig: MERGE, falsch: WRITE },
  ]

  for (const f of faelle) {
    it(`${f.status} mit dem Token der anderen Rolle → 403, kein Datenbankzugriff`, async () => {
      const res = await route.POST(anfrage({ meldungId: ID, status: f.status, ...f.body }, { token: f.falsch }))
      expect(res.status).toBe(403)
      expect(await json(res)).toMatchObject({ code: 'FALSCHER_TOKEN' })
      expect(findMany).not.toHaveBeenCalled()
      expect(updateMany).not.toHaveBeenCalled()
    })
  }

  it('der Lese-Token schreibt nicht: 401', async () => {
    const res = await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }, { token: LESEN }))
    expect(res.status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('ohne Header, mit unbekanntem Token, ohne konfigurierten Token: 401', async () => {
    expect((await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }, { token: null }))).status).toBe(401)
    expect((await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }, { token: 'geraten' }))).status).toBe(401)
    vi.stubEnv('TRIAGE_WRITE_TOKEN', undefined)
    expect((await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }, { token: 'undefined' }))).status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('gleiche Tokens: die Route ist gesperrt, auch für den eigentlich richtigen', async () => {
    vi.stubEnv('TRIAGE_MERGE_TOKEN', WRITE)
    const fehlerLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }, { token: WRITE }))
    expect(res.status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
    // Der Log nennt Namen, nie Werte.
    expect(String(fehlerLog.mock.calls[0]?.[0])).not.toContain(WRITE)
    fehlerLog.mockRestore()
  })

  it('verrät keinen Token in der Antwort', async () => {
    const res = await route.POST(anfrage({ meldungId: ID, status: 'ERLEDIGT', prNummer: 5 }, { token: WRITE }))
    const text = await res.text()
    for (const t of [LESEN, WRITE, MERGE]) expect(text).not.toContain(t)
  })

  it('kennt nur POST', () => {
    expect(typeof route.POST).toBe('function')
    for (const methode of ['GET', 'PUT', 'PATCH', 'DELETE']) expect(methode in route).toBe(false)
  })
})

describe('Schreibroute — Body', () => {
  it('grund fehlt bei VERMUTLICH_WUNSCH → 400, kein Datenbankzugriff', async () => {
    const res = await route.POST(anfrage({ meldungId: ID, status: 'VERMUTLICH_WUNSCH' }))
    expect(res.status).toBe(400)
    expect(await json(res)).toMatchObject({ code: 'UNGUELTIG' })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('antwortAnMelder im Body → 400: die Route schreibt nie eigenen Text an den Melder', async () => {
    const res = await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5, antwortAnMelder: 'Alles gut!' }))
    expect(res.status).toBe(400)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('kein JSON → 400', async () => {
    expect((await route.POST(anfrage('{kaputt'))).status).toBe(400)
  })
})

describe('Schreibroute — Meldung finden', () => {
  it('Kurznummer sucht per Präfix, höchstens zwei Treffer', async () => {
    await route.POST(anfrage({ meldungId: 'cmmeldun', status: 'GEPLANT', prNummer: 5 }))
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { id: { startsWith: 'cmmeldun' } }, take: 2 })
  })

  it('volle ID sucht exakt', async () => {
    await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }))
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { id: ID } })
  })

  it('unbekannt → 404, mehrdeutig → 409 statt einer beliebigen', async () => {
    findMany.mockResolvedValueOnce([] as never)
    expect((await route.POST(anfrage({ meldungId: 'cmgibtsn', status: 'GEPLANT', prNummer: 5 }))).status).toBe(404)
    findMany.mockResolvedValueOnce([zeile(), zeile({ id: 'cmmeldun99999999999zzzz' })] as never)
    const res = await route.POST(anfrage({ meldungId: 'cmmeldun', status: 'GEPLANT', prNummer: 5 }))
    expect(res.status).toBe(409)
    expect(await json(res)).toMatchObject({ code: 'MEHRDEUTIG' })
    expect(updateMany).not.toHaveBeenCalled()
  })
})

describe('Schreibroute — Übergänge und Wirkung', () => {
  it('GEPLANT: schreibt bedingt auf den gelesenen Stand, mit Audit-Zeile, ohne Art; Antwort nur der Status', async () => {
    const res = await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 131 }))
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ status: 'GEPLANT' })
    const args = updateMany.mock.calls[0][0]
    expect(args?.where).toEqual({ id: ID, status: 'NEU', triageNotiz: null })
    expect(args?.data).toMatchObject({ status: 'GEPLANT', sprintName: 'PR #131', triageNotiz: '[Auto · PR #131 · 24.09.2026 · Geplant]' })
    expect(args?.data).not.toHaveProperty('art')
  })

  it('verbotener Übergang → 409 mit Satz, nichts geschrieben', async () => {
    findMany.mockResolvedValue([zeile({ status: 'DUPLIKAT' })] as never)
    const res = await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }))
    expect(res.status).toBe(409)
    expect(await json(res)).toMatchObject({ code: 'UEBERGANG' })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('ERLEDIGT nur aus GEPLANT — aus GEPRUEFT 409', async () => {
    findMany.mockResolvedValue([zeile({ status: 'GEPRUEFT' })] as never)
    const res = await route.POST(anfrage({ meldungId: ID, status: 'ERLEDIGT', prNummer: 5 }, { token: MERGE }))
    expect(res.status).toBe(409)
  })

  it('Wunsch, im Admin auf GEPLANT gesetzt → Deployment → ERLEDIGT mit „Umgesetzt"; Art bleibt WUNSCH', async () => {
    findMany.mockResolvedValue([zeile({ art: 'WUNSCH', status: 'GEPLANT' })] as never)
    const res = await route.POST(anfrage({ meldungId: ID, status: 'ERLEDIGT', prNummer: 140 }, { token: MERGE }))
    expect(res.status).toBe(200)
    const data = updateMany.mock.calls[0][0]?.data
    expect(data).toMatchObject({ status: 'ERLEDIGT', antwortAnMelder: 'Umgesetzt — seit 24.09.2026 online.' })
    expect(data).not.toHaveProperty('art')
  })

  it('ein Wunsch lässt sich über die Route nicht planen: 409 FALSCHE_ART', async () => {
    findMany.mockResolvedValue([zeile({ art: 'WUNSCH' })] as never)
    const res = await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }))
    expect(res.status).toBe(409)
    expect(await json(res)).toMatchObject({ code: 'FALSCHE_ART' })
  })

  it('Wiederöffnen: fester Satz weg, geschriebene Antwort bleibt', async () => {
    findMany.mockResolvedValueOnce([zeile({ status: 'ERLEDIGT', antwortAnMelder: 'Behoben — seit 20.09.2026 online.' })] as never)
    await route.POST(anfrage({ meldungId: ID, status: 'GEPRUEFT', prNummer: 150 }, { token: MERGE }))
    expect(updateMany.mock.calls[0][0]?.data).toMatchObject({ status: 'GEPRUEFT', antwortAnMelder: null })

    findMany.mockResolvedValueOnce([zeile({ status: 'ERLEDIGT', antwortAnMelder: 'Das war ein Tippfehler, jetzt passt es.' })] as never)
    await route.POST(anfrage({ meldungId: ID, status: 'GEPRUEFT', prNummer: 150 }, { token: MERGE }))
    expect(updateMany.mock.calls[1][0]?.data).not.toHaveProperty('antwortAnMelder')
  })

  it('ERLEDIGT → ERLEDIGT: 200, nichts geschrieben', async () => {
    findMany.mockResolvedValue([zeile({ status: 'ERLEDIGT' })] as never)
    const res = await route.POST(anfrage({ meldungId: ID, status: 'ERLEDIGT', prNummer: 5 }, { token: MERGE }))
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ status: 'ERLEDIGT' })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('hat sich die Meldung zwischen Lesen und Schreiben geändert: 409 statt Überschreiben', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    const res = await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }))
    expect(res.status).toBe(409)
    expect(await json(res)).toMatchObject({ code: 'GEAENDERT' })
  })

  it('VERMUTLICH_WUNSCH schreibt den gereinigten Grund mit „[KI] " in die Notiz', async () => {
    await route.POST(anfrage({ meldungId: ID, status: 'VERMUTLICH_WUNSCH', grund: 'Wünscht\u0007 Sortierung' }))
    expect(updateMany.mock.calls[0][0]?.data).toMatchObject({
      status: 'VERMUTLICH_WUNSCH',
      triageNotiz: '[KI] Wünscht Sortierung\n[Auto · KI · 24.09.2026 · Vermutlich Wunsch]',
    })
  })
})

describe('Schreibroute — Rate-Limit', () => {
  it('zehn Aufrufe je Minute und IP, der elfte 429 — auch mit falschem Token', async () => {
    const ip = neueIp()
    for (let i = 0; i < 10; i++) {
      expect((await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }, { token: 'rate', ip }))).status).toBe(401)
    }
    const elfte = await route.POST(anfrage({ meldungId: ID, status: 'GEPLANT', prNummer: 5 }, { ip }))
    expect(elfte.status).toBe(429)
    expect(elfte.headers.get('retry-after')).toBe('60')
    expect(findMany).not.toHaveBeenCalled()
  })
})
