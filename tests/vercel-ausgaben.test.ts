/**
 * Vercel-Ausgaben (Register N18, Nr. 113): POST /api/webhooks/vercel-ausgaben
 * und die tägliche Prüfung des Abrechnungszeitraums.
 *
 * Beweist mit gemockter Datenbank (Rohabfragen) und gemocktem Versand:
 *  - Signatur: richtig → gespeichert; falsch oder fehlend → 400, nichts
 *    gespeichert; Geheimnis fehlt → 500, nichts gespeichert (fail-closed).
 *    Geprüft wird der ROHTEXT — dasselbe JSON anders formatiert passt nicht.
 *  - Zod für die vier Felder; Beträge als ganze Cent (19.99 $ → 1999).
 *  - Warnstufe bedingt wie die anderen Warnungen: 50 → eine Mail, nochmal 50
 *    → keine, 75 → eine; die Mail erst nach der Antwort; außerhalb der
 *    Produktion nur gespeichert, keine Stufe.
 *  - Neuer Abrechnungszeitraum: die tägliche Prüfung setzt die Stufe still
 *    auf 0 (ohne Mail).
 * Die Bedingung in derselben Anweisung (zwei gleichzeitige Meldungen → eine
 * Mail) ist dieselbe wie bei den anderen Warnungen (`setzeStufe`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  betriebWarnung: { findMany: vi.fn() },
  betriebMessung: { findMany: vi.fn(), aggregate: vi.fn() },
}))
const umgebung = vi.hoisted(() => ({ vercelProduktion: true }))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendBetriebWarnung: vi.fn(async () => ({ gesendet: 1, gescheitert: 0 })) }))
vi.mock('@/server/queries/postfach', () => ({ ladeBetreiberEmpfaenger: vi.fn(async () => ['team@example.com']) }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn((aufgabe: () => Promise<void>) => nachlauf.aufgaben.push(aufgabe)) }))
vi.mock('@/lib/umgebung-server', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/lib/umgebung-server')>()
  return {
    ...echt,
    get UMGEBUNG() {
      return { ...echt.UMGEBUNG, vercelProduktion: umgebung.vercelProduktion }
    },
  }
})

import { sendBetriebWarnung } from '@/lib/email'
import { POST } from '@/app/api/webhooks/vercel-ausgaben/route'
import { pruefeGrenzen } from '@/server/betrieb'

const GEHEIMNIS = 'vercel-ausgaben-testgeheimnis'
const JETZT = new Date('2026-10-25T10:00:00.000Z')

function werteVon(aufruf: unknown[]): unknown[] {
  const [teile, ...werte] = aufruf as [TemplateStringsArray, ...unknown[]]
  return Prisma.sql(teile, ...werte).values
}

function signiere(text: string, geheimnis = GEHEIMNIS): string {
  return createHmac('sha1', geheimnis).update(text).digest('hex')
}

function meldung(currentSpend: number, thresholdPercent: number): string {
  return JSON.stringify({ budgetAmount: 50, currentSpend, teamId: 'team_test', thresholdPercent })
}

function anfrage(text: string, signatur: string | null = signiere(text)): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/vercel-ausgaben', {
    method: 'POST',
    body: text,
    headers: signatur === null ? {} : { 'x-vercel-signature': signatur },
  })
}

/** Arbeitet den gesammelten Nachlauf ab — vorher ist keine Mail verschickt (sie liegt nicht im Antwortpfad). */
async function nachlaufAbarbeiten(): Promise<void> {
  const aufgaben = nachlauf.aufgaben.splice(0)
  for (const aufgabe of aufgaben) await aufgabe()
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben = []
  umgebung.vercelProduktion = true
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  vi.stubEnv('VERCEL_AUSGABEN_SECRET', GEHEIMNIS)
  db.$executeRaw.mockResolvedValue(2)
  db.$queryRaw.mockResolvedValue([{ art: 'vercelAusgaben' }])
  db.betriebWarnung.findMany.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Webhook — Signatur und Eingabe', () => {
  it('richtige Signatur: 200, Ausgaben und Limit in ganzen Cent für den UTC-Tag', async () => {
    const antwort = await POST(anfrage(meldung(19.99, 50)))
    expect(antwort.status).toBe(200)
    expect(werteVon(db.$executeRaw.mock.calls[0])).toEqual([
      ...['2026-10-25', 'vercelAusgaben', BigInt(1999), JETZT],
      ...['2026-10-25', 'vercelLimit', BigInt(5000), JETZT],
    ])
  })

  it('falsche Signatur (anderes Geheimnis, gleich lang): 400, nichts gespeichert, keine Mail', async () => {
    const text = meldung(30, 50)
    const antwort = await POST(anfrage(text, signiere(text, 'vercel-ausgaben-falschgeheimn')))
    expect(antwort.status).toBe(400)
    expect(db.$executeRaw).not.toHaveBeenCalled()
    expect(nachlauf.aufgaben).toEqual([])
  })

  it('Signatur über anders formatiertes JSON mit denselben Werten: 400 — es zählt der Rohtext', async () => {
    const text = meldung(30, 50)
    const antwort = await POST(anfrage(text, signiere(JSON.stringify(JSON.parse(text), null, 2))))
    expect(antwort.status).toBe(400)
    expect(db.$executeRaw).not.toHaveBeenCalled()
  })

  it('Signatur fehlt: 400, nichts gespeichert', async () => {
    expect((await POST(anfrage(meldung(30, 50), null))).status).toBe(400)
    expect(db.$executeRaw).not.toHaveBeenCalled()
  })

  it('Geheimnis fehlt (auch leer): 500, nichts gespeichert — auch mit einer Signatur zum leeren Geheimnis', async () => {
    vi.stubEnv('VERCEL_AUSGABEN_SECRET', '')
    const text = meldung(30, 50)
    expect((await POST(anfrage(text, signiere(text, '')))).status).toBe(500)
    expect(db.$executeRaw).not.toHaveBeenCalled()
  })

  it('richtig signiert, aber kein JSON oder ein Feld fehlt bzw. ist Text: 400, nichts gespeichert', async () => {
    for (const text of ['kein json', JSON.stringify({ budgetAmount: 50, currentSpend: 30, teamId: 'team_test' }), JSON.stringify({ budgetAmount: '50', currentSpend: 30, teamId: 'team_test', thresholdPercent: 50 })]) {
      expect((await POST(anfrage(text))).status, text).toBe(400)
    }
    expect(db.$executeRaw).not.toHaveBeenCalled()
  })
})

describe('Webhook — Warnstufe und Mail', () => {
  it('50 %: Stufe 1 bedingt gesetzt, EINE Mail — erst nach der Antwort', async () => {
    expect((await POST(anfrage(meldung(25.1, 50)))).status).toBe(200)
    expect(werteVon(db.$queryRaw.mock.calls[0]).slice(0, 2)).toEqual(['vercelAusgaben', 1])
    expect(sendBetriebWarnung).not.toHaveBeenCalled()

    await nachlaufAbarbeiten()
    expect(sendBetriebWarnung).toHaveBeenCalledTimes(1)
    expect(sendBetriebWarnung).toHaveBeenCalledWith({ art: 'vercelAusgaben', stufe: 1, ausgabenCent: 2510, limitCent: 5000 }, ['team@example.com'])
  })

  it('nochmal 50 % im selben Zeitraum: keine Anweisung, keine Mail', async () => {
    db.betriebWarnung.findMany.mockResolvedValue([{ art: 'vercelAusgaben', stufe: 1, seit: new Date('2026-10-21T10:00:00Z'), gemeldetAm: new Date('2026-10-21T10:00:00Z') }])
    expect((await POST(anfrage(meldung(26, 50)))).status).toBe(200)
    expect(db.$queryRaw).not.toHaveBeenCalled()
    await nachlaufAbarbeiten()
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
  })

  it('75 % nach 50 %: Stufe 2, eine Mail', async () => {
    db.betriebWarnung.findMany.mockResolvedValue([{ art: 'vercelAusgaben', stufe: 1, seit: new Date('2026-10-21T10:00:00Z'), gemeldetAm: new Date('2026-10-21T10:00:00Z') }])
    await POST(anfrage(meldung(38, 75)))
    expect(werteVon(db.$queryRaw.mock.calls[0]).slice(0, 2)).toEqual(['vercelAusgaben', 2])
    await nachlaufAbarbeiten()
    expect(sendBetriebWarnung).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendBetriebWarnung).mock.calls[0][0]).toMatchObject({ stufe: 2 })
  })

  it('traf das bedingte Setzen keine Zeile (eine gleichzeitige Meldung war schneller): keine Mail', async () => {
    db.$queryRaw.mockResolvedValue([])
    await POST(anfrage(meldung(25.1, 50)))
    await nachlaufAbarbeiten()
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
  })

  it('außerhalb der Produktion: gespeichert, aber keine Stufe und keine Mail', async () => {
    umgebung.vercelProduktion = false
    expect((await POST(anfrage(meldung(25.1, 50)))).status).toBe(200)
    expect(db.$executeRaw).toHaveBeenCalledTimes(1)
    expect(db.$queryRaw).not.toHaveBeenCalled()
    expect(nachlauf.aufgaben).toEqual([])
  })
})

describe('Neuer Abrechnungszeitraum (täglich in pruefeGrenzen)', () => {
  it('eine Stufe aus dem alten Zeitraum geht still auf 0 — ohne Mail; eine aus dem laufenden bleibt', async () => {
    db.betriebMessung.findMany.mockResolvedValue([])
    db.betriebMessung.aggregate.mockResolvedValue({ _sum: { wert: null } })
    db.betriebWarnung.findMany.mockResolvedValue([{ art: 'vercelAusgaben', stufe: 2, seit: new Date('2026-10-10T10:00:00Z'), gemeldetAm: new Date('2026-10-15T10:00:00Z') }])
    db.$queryRaw.mockResolvedValue([{ art: 'vercelAusgaben' }])

    expect(await pruefeGrenzen(JETZT, { produktion: true })).toBe(0)
    const setzen = db.$queryRaw.mock.calls.map((c) => werteVon(c))
    expect(setzen).toEqual([['vercelAusgaben']])
    expect(String((db.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?'))).toMatch(/UPDATE "BetriebWarnung" SET "stufe" = 0/)
    await nachlaufAbarbeiten()
    expect(sendBetriebWarnung).not.toHaveBeenCalled()

    // Gegenprobe: im laufenden Zeitraum gemeldet (nach dem 19.) — keine Anweisung.
    vi.clearAllMocks()
    db.betriebMessung.findMany.mockResolvedValue([])
    db.betriebMessung.aggregate.mockResolvedValue({ _sum: { wert: null } })
    db.betriebWarnung.findMany.mockResolvedValue([{ art: 'vercelAusgaben', stufe: 2, seit: new Date('2026-10-20T10:00:00Z'), gemeldetAm: new Date('2026-10-20T10:00:00Z') }])
    await pruefeGrenzen(JETZT, { produktion: true })
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })
})
