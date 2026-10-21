/**
 * Die Route /api/csp-bericht (Register G8, Nr. 125): nimmt die Meldungen der CSP zum Beobachten an und
 * gibt sie gekürzt, entdoppelt und gebremst an Sentry weiter.
 *
 * Beweist (Sentry und die Bremse über die Datenbank gemockt — deren Zählung prüft die
 * Integrationsschicht an `bremseUeberAlleInstanzen`):
 *  - Reihenfolge Größe → Art des Inhalts → Lesen: 413 schon an der angegebenen Länge, 415 bei einer
 *    anderen Art, 413 auch ohne Längenangabe beim Lesen.
 *  - An Sentry geht nur Anweisung, Host und der gekürzte Pfad (Stufe warning, Tags, Fingerprint, Pfad
 *    in extra, ohne Anfrage-Daten) — keine Query, kein Ausschnitt, kein Referrer.
 *  - Entdoppeln vor den Bremsen: Dieselbe Meldung fragt keine Bremse und geht kein zweites Mal raus,
 *    auch nicht aus einer gleichzeitigen Anfrage (Vormerkung vor dem await); lässt eine Bremse sie
 *    nicht durch, wird die Vormerkung zurückgenommen.
 *  - Erste Stufe im Speicher (30 je Minute und IP), danach die Datenbank; ist sie voll, geht nichts raus.
 *  - Beide Bremsen zählen je weitergegebener Meldung, nicht je Anfrage — eine Anfrage mit vielen
 *    verschiedenen Einträgen bringt nicht mehr zu Sentry, als die Grenze erlaubt (Runde 1).
 *  - Die Antwort ist immer 204 ohne Inhalt, auch bei kaputtem Inhalt und abgebrochenem Datenstrom.
 */
import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import { CSP_MELDUNGEN_JE_ANFRAGE } from '@/lib/csp'

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)
const db = vi.hoisted(() => ({ bremseUeberAlleInstanzen: vi.fn(async () => true) }))
vi.mock('@/server/bremse-datenbank', () => db)

let POST: (request: NextRequest) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  db.bremseUeberAlleInstanzen.mockResolvedValue(true)
  // Entdoppeln und erste Stufe leben je Instanz im Modul: je Fall eine frische.
  vi.resetModules()
  ;({ POST } = await import('@/app/api/csp-bericht/route'))
})

const IP = '203.0.113.9'

function anfrage(body: string, art = 'application/csp-report', weitere: Record<string, string> = {}): NextRequest {
  return new Request('http://localhost:3000/api/csp-bericht', {
    method: 'POST',
    headers: { 'content-type': art, 'x-forwarded-for': IP, ...weitere },
    body,
  }) as NextRequest
}

function cspReport(blockiert: string, seite = 'https://example.com/hof-test?vorschau=1#oben'): string {
  return JSON.stringify({
    'csp-report': {
      'document-uri': seite,
      referrer: 'https://example.com/hoefe?q=geheimeSuche',
      'effective-directive': 'script-src-elem',
      'violated-directive': 'script-src-elem',
      'original-policy': "default-src 'self'; report-uri /api/csp-bericht",
      'blocked-uri': blockiert,
      'script-sample': 'geheimerAusschnitt',
    },
  })
}

/** Eine Anfrage im Format der Reporting API mit je einem Verstoß an jedem der genannten Hosts. */
function reportsAnfrage(hosts: string[]): NextRequest {
  const eintraege = hosts.map((host) => ({
    type: 'csp-violation',
    url: 'https://example.com/hoefe',
    body: { effectiveDirective: 'img-src', blockedURL: `https://${host}/` },
  }))
  return anfrage(JSON.stringify(eintraege), 'application/reports+json')
}

/** n verschiedene erfundene Hosts, ab `ab` durchgezählt. */
const hosts = (n: number, ab = 0): string[] => Array.from({ length: n }, (_, i) => `h${ab + i}.example.org`)

/** Was jede Sentry-Meldung über den Scope setzt. */
function gemeldet(): Array<{ text: unknown; level?: unknown; tags?: unknown; fingerprint?: unknown; extras?: unknown; prozessoren: unknown[] }> {
  return sentry.captureMessage.mock.calls.map(([text, kontext]) => {
    const eintrag: ReturnType<typeof gemeldet>[number] = { text, prozessoren: [] }
    const scope = {
      setLevel: (l: unknown) => ((eintrag.level = l), scope),
      setTags: (t: unknown) => ((eintrag.tags = t), scope),
      setFingerprint: (f: unknown) => ((eintrag.fingerprint = f), scope),
      setExtras: (e: unknown) => ((eintrag.extras = e), scope),
      addEventProcessor: (p: unknown) => (eintrag.prozessoren.push(p), scope),
    }
    ;(kontext as (s: typeof scope) => unknown)(scope)
    return eintrag
  })
}

async function istLeer204(antwort: Response): Promise<void> {
  expect(antwort.status).toBe(204)
  expect(await antwort.text()).toBe('')
}

describe('Größe und Art des Inhalts', () => {
  it('415 bei einer anderen Art — ohne Bremse und ohne Sentry', async () => {
    for (const art of ['application/json', 'text/plain']) {
      expect((await POST(anfrage(cspReport('inline'), art))).status, art).toBe(415)
    }
    expect(db.bremseUeberAlleInstanzen).not.toHaveBeenCalled()
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('413 schon an der angegebenen Länge über 8 KB — vor der Art des Inhalts', async () => {
    expect((await POST(anfrage('{}', 'text/plain', { 'content-length': '9000' }))).status).toBe(413)
  })

  it('413 auch ohne Längenangabe: beim Lesen begrenzt', async () => {
    const gross = JSON.stringify({ 'csp-report': { 'blocked-uri': 'inline', fuell: 'x'.repeat(9000) } })
    expect((await POST(anfrage(gross))).status).toBe(413)
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
})

describe('An Sentry nur die erlaubten Felder', () => {
  it('Anweisung und Host als Tags und Fingerprint, der gekürzte Pfad in extra, ohne Anfrage-Daten', async () => {
    await istLeer204(await POST(anfrage(cspReport('https://fremd.example.org/skript.js?token=abc'))))
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    const [m] = gemeldet()
    expect(m.text).toBe('CSP-Verstoß (nur beobachtet)')
    expect(m.level).toBe('warning')
    expect(m.tags).toEqual({ bereich: 'csp', anweisung: 'script-src-elem', host: 'https://fremd.example.org' })
    expect(m.fingerprint).toEqual(['csp', 'script-src-elem', 'https://fremd.example.org'])
    expect(m.extras).toEqual({ pfad: '/hof-test' })
    // vi.resetModules lädt sentry-hygiene je Fall neu — verglichen wird deshalb der Name.
    expect(m.prozessoren.map((p) => (p as { name: string }).name)).toEqual(['ohneAnfrage'])
    const alles = JSON.stringify(gemeldet())
    for (const weg of ['vorschau', 'oben', 'geheimeSuche', 'geheimerAusschnitt', 'token', 'report-uri']) expect(alles).not.toContain(weg)
  })

  it('Reporting API: je Verstoß eine Meldung, andere Arten fallen weg', async () => {
    const reports = JSON.stringify([
      { type: 'csp-violation', url: 'https://example.com/region', body: { documentURL: 'https://example.com/region', effectiveDirective: 'img-src', blockedURL: 'https://kacheln.example.org/1.png' } },
      { type: 'csp-violation', url: 'https://example.com/region', body: { documentURL: 'https://example.com/region', effectiveDirective: 'connect-src', blockedURL: 'https://api.example.org/x' } },
      { type: 'deprecation', url: 'https://example.com/region', body: {} },
    ])
    await istLeer204(await POST(anfrage(reports, 'application/reports+json')))
    expect(gemeldet().map((m) => m.tags)).toEqual([
      { bereich: 'csp', anweisung: 'img-src', host: 'https://kacheln.example.org' },
      { bereich: 'csp', anweisung: 'connect-src', host: 'https://api.example.org' },
    ])
  })

  it('bricht der Absender den Datenstrom ab: 204, nichts an Sentry', async () => {
    const abgebrochen = new ReadableStream<Uint8Array>({ start: (c) => c.error(new Error('abgebrochen')) })
    const init = { method: 'POST', headers: { 'content-type': 'application/csp-report', 'x-forwarded-for': IP }, body: abgebrochen, duplex: 'half' }
    await istLeer204(await POST(new Request('http://localhost:3000/api/csp-bericht', init as RequestInit) as NextRequest))
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('kaputter Inhalt: 204, nichts an Sentry', async () => {
    await istLeer204(await POST(anfrage('{kein json')))
    await istLeer204(await POST(anfrage(JSON.stringify({ anders: true }))))
    expect(sentry.captureMessage).not.toHaveBeenCalled()
    expect(db.bremseUeberAlleInstanzen).not.toHaveBeenCalled()
  })
})

describe('Entdoppeln und Bremsen', () => {
  it('dieselbe Meldung geht einmal raus — die zweite fragt keine Bremse mehr', async () => {
    await istLeer204(await POST(anfrage(cspReport('inline'))))
    await istLeer204(await POST(anfrage(cspReport('inline', 'https://example.com/hof-test?q=anders'))))
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(db.bremseUeberAlleInstanzen).toHaveBeenCalledTimes(1)
    expect(db.bremseUeberAlleInstanzen).toHaveBeenCalledWith([{ bremse: DB_BREMSEN.cspBerichtIp, merkmal: IP }])
    expect(DB_BREMSEN.cspBerichtIp).toMatchObject({ max: 30, fensterMs: 60_000 })
  })

  it('erste Stufe im Speicher: höchstens 30 je Minute und IP — die 31. erreicht weder Datenbank noch Sentry', async () => {
    for (let i = 0; i < 31; i += 1) await istLeer204(await POST(anfrage(cspReport(`https://fremd${i}.example.org/x`))))
    expect(sentry.captureMessage).toHaveBeenCalledTimes(30)
    expect(db.bremseUeberAlleInstanzen).toHaveBeenCalledTimes(30)
  })

  it('ist die Bremse über alle Instanzen voll, geht nichts an Sentry — die Antwort bleibt 204', async () => {
    db.bremseUeberAlleInstanzen.mockResolvedValue(false)
    await istLeer204(await POST(anfrage(cspReport('eval'))))
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('eine Anfrage mit vielen verschiedenen Einträgen: jede weitergegebene Meldung zählt, höchstens wenige je Anfrage', async () => {
    await istLeer204(await POST(reportsAnfrage(hosts(40))))
    expect(sentry.captureMessage).toHaveBeenCalledTimes(CSP_MELDUNGEN_JE_ANFRAGE)
    // Die Datenbank zählt je weitergegebener Meldung einmal, nicht einmal je Anfrage.
    expect(db.bremseUeberAlleInstanzen).toHaveBeenCalledTimes(CSP_MELDUNGEN_JE_ANFRAGE)
  })

  it('viele solche Anfragen: bei Sentry kommen höchstens 30 je Minute und IP an', async () => {
    for (let i = 0; i < 20; i += 1) await istLeer204(await POST(reportsAnfrage(hosts(40, i * 40))))
    expect(sentry.captureMessage).toHaveBeenCalledTimes(DB_BREMSEN.cspBerichtIp.max)
  })

  it('die Bremse über alle Instanzen zählt je Meldung — ist sie mitten in der Anfrage voll, geht der Rest nicht raus', async () => {
    db.bremseUeberAlleInstanzen.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false)
    await istLeer204(await POST(reportsAnfrage(hosts(CSP_MELDUNGEN_JE_ANFRAGE))))
    expect(sentry.captureMessage).toHaveBeenCalledTimes(2)
    expect(db.bremseUeberAlleInstanzen).toHaveBeenCalledTimes(3)
  })

  it('eine gebremste Meldung: die Vormerkung wird zurückgenommen, beim nächsten Mal geht sie raus', async () => {
    db.bremseUeberAlleInstanzen.mockResolvedValueOnce(false)
    await istLeer204(await POST(anfrage(cspReport('eval'))))
    expect(sentry.captureMessage).not.toHaveBeenCalled()
    await istLeer204(await POST(anfrage(cspReport('eval'))))
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('zwei gleichzeitige Anfragen mit derselben Meldung: einmal an Sentry, einmal gezählt', async () => {
    // Die Datenbank antwortet erst, wenn beide Anfragen laufen — ohne Vormerkung vor dem await gingen beide raus.
    let freigeben: (wert: boolean) => void = () => {}
    db.bremseUeberAlleInstanzen.mockImplementationOnce(() => new Promise<boolean>((ok) => (freigeben = ok)))
    const erste = POST(anfrage(cspReport('eval')))
    const zweite = POST(anfrage(cspReport('eval')))
    await istLeer204(await zweite)
    freigeben(true)
    await istLeer204(await erste)
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(db.bremseUeberAlleInstanzen).toHaveBeenCalledTimes(1)
  })

  it('derselbe Eintrag zweimal in einer Anfrage geht einmal raus und zählt einmal', async () => {
    await istLeer204(await POST(reportsAnfrage(['doppelt.example.org', 'doppelt.example.org'])))
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(db.bremseUeberAlleInstanzen).toHaveBeenCalledTimes(1)
  })
})
