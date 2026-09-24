/**
 * Tests für die Leseroute GET /api/triage/export (Sprint triage-leseroute) —
 * am echten Handler, nur Prisma gemockt.
 *
 * Beweist: ohne konfigurierten Token 401 (fail-closed), falscher oder
 * fehlender Bearer 401 — und in beiden Fällen KEIN Datenbankzugriff; richtiger
 * Token 200 mit text/markdown, Cache-Control: no-store und dem Markdown der
 * gemeinsamen Export-Funktion; Filter aus der Adresse (Voreinstellung
 * NEU,GEPRUEFT); Rate-Limit: der elfte Aufruf je Minute und IP bekommt 429,
 * auch ohne gültigen Token; eine andere IP bleibt frei; es gibt nur GET.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({ prisma: { meldung: { findMany: vi.fn() } } }))

import * as route from '@/app/api/triage/export/route'
import { prisma } from '@/lib/prisma'
import { EXPORT_AUSWAHL, EXPORT_MAX } from '@/lib/briefkasten-export'

const findMany = vi.mocked(prisma.meldung.findMany)
const TOKEN = 'triage-token-geheim-42'

const MELDUNG = {
  id: 'cmfmeldung0000000001abc',
  art: 'FEHLER',
  status: 'NEU',
  text: 'Abholzeiten speichern geht nicht.',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  seiteUrl: 'https://farmerzone.at/settings',
  userAgent: 'Mozilla/5.0 (iPhone)',
  viewport: '375x667',
  diagKennung: 'S71',
  screenshotUrl: null,
  customerEmail: null,
  clusterKey: null,
  triageNotiz: 'intern',
  duplikatVonId: null,
  sprintName: null,
  triagedAt: null,
  antwortAnMelder: null,
  farm: { name: 'Biohof Sonnleitner', slug: 'sonnleitner' },
}

let ipZaehler = 0
/** Jede Anfrage-Gruppe bekommt eine eigene IP, damit der Limiter (Modulzustand) die Tests nicht verkoppelt. */
function neueIp(): string {
  ipZaehler += 1
  return `203.0.113.${ipZaehler}`
}

function anfrage(opts: { auth?: string; ip?: string; query?: string } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': opts.ip ?? neueIp() }
  if (opts.auth !== undefined) headers.authorization = opts.auth
  return new NextRequest(`http://localhost/api/triage/export${opts.query ?? ''}`, { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('TRIAGE_TOKEN', TOKEN)
  findMany.mockResolvedValue([MELDUNG] as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Leseroute — Zugriff', () => {
  it('ohne konfigurierten Token: 401 auch mit irgendeinem Bearer, kein Datenbankzugriff', async () => {
    vi.stubEnv('TRIAGE_TOKEN', '')
    const res = await route.GET(anfrage({ auth: 'Bearer ' }))
    expect(res.status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('GAR NICHT gesetzter Token: 401 — auch gegen „Bearer undefined" und „Bearer"', async () => {
    // Der wahrscheinlichste Einrichtungsfehler ist die FEHLENDE Variable, nicht
    // die leere. Ohne den fail-closed-Zweig (`!token ||`) würde die Route den
    // erwarteten Wert zu „Bearer undefined" zusammensetzen — wer das errät, käme
    // hinein. Deshalb wird hier die Variable wirklich entfernt, nicht geleert.
    vi.stubEnv('TRIAGE_TOKEN', undefined)
    for (const auth of ['Bearer undefined', 'Bearer', 'Bearer null', 'Bearer ""', '']) {
      const res = await route.GET(anfrage({ auth }))
      expect(res.status, `Authorization: ${JSON.stringify(auth)}`).toBe(401)
    }
    const ohneHeader = await route.GET(anfrage())
    expect(ohneHeader.status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('verrät den Token in keiner Antwort', async () => {
    const abgelehnt = await route.GET(anfrage({ auth: 'Bearer falsch' }))
    expect(await abgelehnt.text()).not.toContain(TOKEN)
    const angenommen = await route.GET(anfrage({ auth: `Bearer ${TOKEN}` }))
    expect(await angenommen.text()).not.toContain(TOKEN)
  })

  it('falscher Token: 401, kein Datenbankzugriff', async () => {
    const res = await route.GET(anfrage({ auth: 'Bearer falsch' }))
    expect(res.status).toBe(401)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(findMany).not.toHaveBeenCalled()
  })

  it('Token als Präfix oder ohne „Bearer": 401', async () => {
    expect((await route.GET(anfrage({ auth: `Bearer ${TOKEN}x` }))).status).toBe(401)
    expect((await route.GET(anfrage({ auth: `Bearer ${TOKEN.slice(0, -1)}` }))).status).toBe(401)
    expect((await route.GET(anfrage({ auth: TOKEN }))).status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('fehlender Header: 401', async () => {
    const res = await route.GET(anfrage())
    expect(res.status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('richtiger Token: 200, text/markdown, no-store, Markdown der Export-Funktion', async () => {
    const res = await route.GET(anfrage({ auth: `Bearer ${TOKEN}` }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const text = await res.text()
    expect(text).toContain('# Briefkasten — 1 Meldung')
    expect(text).toContain('## cmfmeldu · Fehler · Neu')
    expect(text).toContain('- Hof: Biohof Sonnleitner (/sonnleitner)')
    expect(text).toContain('- Kontext: /settings · 375x667 · Mozilla/5.0 (iPhone)')
    expect(text).toContain('- Notiz: intern')
    expect(text).toContain('<<<FREMDTEXT meldung=cmfmeldu>>>\n    Abholzeiten speichern geht nicht.\n<<<ENDE FREMDTEXT>>>')
  })

  it('kennt nur GET — kein POST, kein Schreibpfad', () => {
    expect(typeof route.GET).toBe('function')
    expect('POST' in route).toBe(false)
    expect('PUT' in route).toBe(false)
    expect('PATCH' in route).toBe(false)
    expect('DELETE' in route).toBe(false)
  })
})

describe('Leseroute — Filter', () => {
  it('liest alle Export-Felder, Voreinstellung offene Arbeit, jüngste zuerst, höchstens 51', async () => {
    await route.GET(anfrage({ auth: `Bearer ${TOKEN}` }))
    expect(findMany).toHaveBeenCalledTimes(1)
    const args = findMany.mock.calls[0][0]
    expect(args?.where).toEqual({ status: { in: ['NEU', 'GEPRUEFT', 'VERMUTLICH_WUNSCH'] } })
    expect(args?.select).toEqual(EXPORT_AUSWAHL)
    // Die jüngste Meldung zuerst — beim Sichten ist das Neue das Wichtige.
    expect(args?.orderBy).toEqual({ createdAt: 'desc' })
    // 50 zeigt der Export, die eine mehr sagt ihm, dass er kappen muss.
    expect(args?.take).toBe(EXPORT_MAX + 1)
  })

  it('nimmt status (Liste, auch klein geschrieben) und art aus der Adresse', async () => {
    const res = await route.GET(anfrage({ auth: `Bearer ${TOKEN}`, query: '?status=erledigt,kein_fehler&art=wunsch' }))
    expect(res.status).toBe(200)
    expect(findMany.mock.calls[0][0]?.where).toEqual({ status: { in: ['ERLEDIGT', 'KEIN_FEHLER'] }, art: 'WUNSCH' })
    expect(await res.text()).toContain('Filter: Status ERLEDIGT, KEIN_FEHLER · Art WUNSCH')
  })

  it('unbekannte Werte fallen still weg — zurück auf die Voreinstellung', async () => {
    await route.GET(anfrage({ auth: `Bearer ${TOKEN}`, query: '?status=quatsch&art=x' }))
    expect(findMany.mock.calls[0][0]?.where).toEqual({ status: { in: ['NEU', 'GEPRUEFT', 'VERMUTLICH_WUNSCH'] } })
  })

  it('leerer Briefkasten: 200 mit Hinweis statt Fehler', async () => {
    findMany.mockResolvedValue([] as never)
    const res = await route.GET(anfrage({ auth: `Bearer ${TOKEN}` }))
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('_Keine Meldungen für diesen Filter._')
  })
})

describe('Leseroute — Rate-Limit', () => {
  it('lässt zehn Aufrufe je Minute und IP zu, der elfte bekommt 429 mit Retry-After', async () => {
    const ip = neueIp()
    for (let i = 0; i < 10; i++) {
      const res = await route.GET(anfrage({ auth: `Bearer ${TOKEN}`, ip }))
      expect(res.status).toBe(200)
    }
    const elfte = await route.GET(anfrage({ auth: `Bearer ${TOKEN}`, ip }))
    expect(elfte.status).toBe(429)
    expect(elfte.headers.get('retry-after')).toBe('60')
    expect(elfte.headers.get('cache-control')).toBe('no-store')
    expect(findMany).toHaveBeenCalledTimes(10)
  })

  it('bremst auch Rateversuche am Token: elf falsche Aufrufe → der elfte ist 429, nicht 401', async () => {
    const ip = neueIp()
    for (let i = 0; i < 10; i++) {
      expect((await route.GET(anfrage({ auth: 'Bearer rateversuch', ip }))).status).toBe(401)
    }
    expect((await route.GET(anfrage({ auth: 'Bearer rateversuch', ip }))).status).toBe(429)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('zählt je IP — eine andere Adresse bleibt frei', async () => {
    const gebremst = neueIp()
    for (let i = 0; i < 11; i++) await route.GET(anfrage({ auth: `Bearer ${TOKEN}`, ip: gebremst }))
    expect((await route.GET(anfrage({ auth: `Bearer ${TOKEN}`, ip: gebremst }))).status).toBe(429)
    expect((await route.GET(anfrage({ auth: `Bearer ${TOKEN}`, ip: neueIp() }))).status).toBe(200)
  })
})
