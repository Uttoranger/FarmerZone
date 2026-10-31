/**
 * „Einmal je Tag“ (Nr. 213.3, Nacharbeit aus Morgenbericht 27 zu Nr. 203).
 *
 * Ursache: Das Muster „nur wer die Zeile des Tages in BetriebMessung anlegt,
 * meldet“ stand zweimal — `erstmalsHeute` (src/lib/umgebung-server.ts) und
 * `meldeUngueltigEinmalJeTag` (Stripe-Webhook). Jetzt EIN Helfer mit freiem
 * Art-Schlüssel (src/lib/einmal-je-tag.ts); beide Aufrufer bauen nur ihren
 * Schlüssel.
 *
 * Beweist (Prisma als Attrappe; über alle Instanzen beweist es
 * tests/integration/betrieb.int.test.ts an `erstmalsHeute`):
 *  - true genau dann, wenn die Anweisung eine Zeile anlegt; Tag ist der UTC-Tag.
 *  - Scheitert die Datenbank: false, kein Wurf.
 *  - Beide Aufrufer benutzen den Helfer mit ihrem bisherigen Schlüssel und
 *    schreiben die Anweisung nicht mehr selbst (Gegenprobe: der Helfer hat sie).
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: vi.fn() } }))

import { prisma } from '@/lib/prisma'
import { einmalJeTag, utcTagVon } from '@/lib/einmal-je-tag'

const queryRaw = vi.mocked(prisma.$queryRaw)
const JETZT = new Date('2026-10-31T23:59:30.000Z')

beforeEach(() => {
  queryRaw.mockReset()
})

describe('einmalJeTag', () => {
  it('true, wenn die Zeile des Tages neu ist — mit UTC-Tag und freiem Schlüssel', async () => {
    queryRaw.mockResolvedValueOnce([{ art: 'sentry:probe:a' }] as never)
    expect(await einmalJeTag('sentry:probe:a', JETZT)).toBe(true)
    const [teile, tag, art, wann] = queryRaw.mock.calls[0]! as unknown as [TemplateStringsArray, string, string, Date]
    expect(teile.join('?')).toContain('ON CONFLICT ("tag", "art") DO NOTHING')
    expect([tag, art, wann]).toEqual(['2026-10-31', 'sentry:probe:a', JETZT])
  })

  it('false, wenn es die Zeile schon gibt (eine andere Anfrage war schneller)', async () => {
    queryRaw.mockResolvedValueOnce([] as never)
    expect(await einmalJeTag('sentry:probe:a', JETZT)).toBe(false)
  })

  it('scheitert die Datenbank: false, kein Wurf', async () => {
    queryRaw.mockRejectedValueOnce(new Error('Datenbank weg'))
    await expect(einmalJeTag('sentry:probe:a', JETZT)).resolves.toBe(false)
  })

  it('der Tag ist der UTC-Tag — nicht der Wiener', () => {
    expect(utcTagVon(new Date('2026-10-31T23:30:00.000Z'))).toBe('2026-10-31')
    expect(utcTagVon(new Date('2026-11-01T00:00:00.000Z'))).toBe('2026-11-01')
  })
})

describe('beide Aufrufer nehmen den Helfer', () => {
  const ANWEISUNG = 'INSERT INTO "BetriebMessung"'
  it.each([
    ['src/lib/umgebung-server.ts', 'einmalJeTag(`sentry:${zustand}:${DEPLOY_KENNUNG}`'],
    ['src/app/api/stripe/webhook/route.ts', 'einmalJeTag(`sentry:stripe-schema:${typ}`'],
  ])('%s', (datei, aufruf) => {
    const text = readFileSync(datei, 'utf8')
    expect(text).toContain(aufruf)
    expect(text).not.toContain(ANWEISUNG)
  })

  it('Gegenprobe: der Helfer selbst trägt die Anweisung', () => {
    expect(readFileSync('src/lib/einmal-je-tag.ts', 'utf8')).toContain('INSERT INTO "BetriebMessung"')
  })
})
