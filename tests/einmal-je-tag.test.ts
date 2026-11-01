/**
 * „Einmal je Tag“ (Nr. 213.3, Nacharbeit aus Morgenbericht 27 zu Nr. 203;
 * Nachbesserung Runde 1: Helfer rein).
 *
 * Ursache: Das Muster „nur wer die Zeile des Tages in BetriebMessung anlegt,
 * meldet“ stand zweimal — `erstmalsHeute` (src/lib/umgebung-server.ts) und
 * `meldeUngueltigEinmalJeTag` (Stripe-Webhook). Jetzt EIN reiner Helfer mit
 * freiem Art-Schlüssel (src/lib/einmal-je-tag.ts), der die Anweisung als
 * Parameter bekommt; die Anweisung steht einmal (`legeTageszeileAn`), beide
 * Aufrufer reichen sie durch.
 *
 * Beweist (ohne Datenbank, ohne Prisma-Attrappe für den Helfer; über alle
 * Instanzen beweist es tests/integration/betrieb.int.test.ts an `erstmalsHeute`):
 *  - true genau dann, wenn die Anweisung eine Zeile anlegt; Tag ist der UTC-Tag.
 *  - Wirft die Anweisung: false, kein Wurf.
 *  - Der Helfer importiert kein Prisma und trägt keine Anweisung.
 *  - `legeTageszeileAn` schickt die Anweisung mit (Tag, Schlüssel, Zeitpunkt).
 *  - Beide Aufrufer benutzen den Helfer mit ihrem bisherigen Schlüssel und
 *    derselben Anweisung; keiner schreibt sie selbst.
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: vi.fn() } }))

import { prisma } from '@/lib/prisma'
import { einmalJeTag, type LegeTageszeileAn } from '@/lib/einmal-je-tag'
import { utcTag as utcTagVon } from '@/lib/betrieb'
import { legeTageszeileAn } from '@/lib/umgebung-server'

const JETZT = new Date('2026-10-31T23:59:30.000Z')
const ANWEISUNG = 'INSERT INTO "BetriebMessung"'

describe('einmalJeTag (rein)', () => {
  it('true, wenn die Zeile des Tages neu ist — mit UTC-Tag und freiem Schlüssel', async () => {
    const legeAn = vi.fn<LegeTageszeileAn>(async () => 1)
    expect(await einmalJeTag('sentry:probe:a', JETZT, legeAn)).toBe(true)
    expect(legeAn).toHaveBeenCalledWith('2026-10-31', 'sentry:probe:a', JETZT)
  })

  it('false, wenn es die Zeile schon gibt (eine andere Anfrage war schneller)', async () => {
    expect(await einmalJeTag('sentry:probe:a', JETZT, async () => 0)).toBe(false)
  })

  it('wirft die Anweisung: false, kein Wurf', async () => {
    const legeAn: LegeTageszeileAn = async () => {
      throw new Error('Datenbank weg')
    }
    await expect(einmalJeTag('sentry:probe:a', JETZT, legeAn)).resolves.toBe(false)
  })

  it('der Tag ist der UTC-Tag — nicht der Wiener', () => {
    expect(utcTagVon(new Date('2026-10-31T23:30:00.000Z'))).toBe('2026-10-31')
    expect(utcTagVon(new Date('2026-11-01T00:00:00.000Z'))).toBe('2026-11-01')
  })

  it('der Helfer importiert kein Prisma und trägt keine Anweisung', () => {
    const text = readFileSync('src/lib/einmal-je-tag.ts', 'utf8')
    expect(text).not.toMatch(/prisma/i)
    expect(text).not.toContain(ANWEISUNG)
  })
})

describe('legeTageszeileAn — die eine Anweisung', () => {
  it('legt mit ON CONFLICT DO NOTHING an und liefert die Zahl der neuen Zeilen', async () => {
    const queryRaw = vi.mocked(prisma.$queryRaw)
    queryRaw.mockResolvedValueOnce([{ art: 'sentry:probe:a' }] as never)
    expect(await legeTageszeileAn('2026-10-31', 'sentry:probe:a', JETZT)).toBe(1)
    const [teile, tag, art, wann] = queryRaw.mock.calls[0]! as unknown as [TemplateStringsArray, string, string, Date]
    expect(teile.join('?')).toContain(ANWEISUNG)
    expect(teile.join('?')).toContain('ON CONFLICT ("tag", "art") DO NOTHING')
    expect([tag, art, wann]).toEqual(['2026-10-31', 'sentry:probe:a', JETZT])
    queryRaw.mockResolvedValueOnce([] as never)
    expect(await legeTageszeileAn('2026-10-31', 'sentry:probe:a', JETZT)).toBe(0)
  })
})

describe('beide Aufrufer nehmen den Helfer mit derselben Anweisung', () => {
  it.each([
    ['src/lib/umgebung-server.ts', 'einmalJeTag(`sentry:${zustand}:${DEPLOY_KENNUNG}`, jetzt, legeTageszeileAn)'],
    ['src/app/api/stripe/webhook/route.ts', 'einmalJeTag(`sentry:stripe-schema:${typ}`, new Date(), legeTageszeileAn)'],
  ])('%s', (datei, aufruf) => {
    expect(readFileSync(datei, 'utf8')).toContain(aufruf)
  })

  it('die Anweisung steht genau einmal — in umgebung-server.ts, nicht im Webhook', () => {
    expect(readFileSync('src/lib/umgebung-server.ts', 'utf8').split(ANWEISUNG)).toHaveLength(2)
    expect(readFileSync('src/app/api/stripe/webhook/route.ts', 'utf8')).not.toContain(ANWEISUNG)
  })
})
