/**
 * Die Startseite liest live (Register N16, Änderung Nr. 99) —
 * src/server/queries/startseite.ts mit gemockter Datenbank und einem
 * Datencache, der sich wie unstable_cache merkt, was er einmal gelesen hat.
 *
 * Beweist:
 *  - Live ist die jüngste nicht zurückgezogene Fassung mit liveAb ≤ jetzt —
 *    die Bedingung steht in der Abfrage; ohne Fassung die Standard-Reihenfolge
 *    (kein Seed, kein sichtbarer Wechsel beim Deploy).
 *  - Die Höfe aller Blöcke in höchstens EINER weiteren Abfrage, nur
 *    freigeschaltete; ohne Höfe keine.
 *  - Eine unlesbare Fassung gibt die Standard-Reihenfolge und geht nach Sentry
 *    — ohne ihren Inhalt.
 *  - „Bis zu 5 Minuten“ auch für Planungen: Der Cache-Eintrag trägt den Termin
 *    der nächsten geplanten Fassung; ab da liest ladeStartseite frisch an ihm
 *    vorbei (Zeit als Parameter).
 *  - Ein Lesefehler gibt eine leere Liste (die Seite rendert dann die
 *    Standard-Reihenfolge) und geht nach Sentry.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cache = vi.hoisted(() => ({ gemerkt: new Map<string, unknown>() }))
vi.mock('next/cache', () => ({
  // Wie der Datencache: einmal gelesen, danach derselbe Eintrag — bis der Test ihn leert.
  unstable_cache: (fn: () => Promise<unknown>, schluessel: string[]) => async () => {
    const key = schluessel.join('|')
    if (!cache.gemerkt.has(key)) cache.gemerkt.set(key, await fn())
    return cache.gemerkt.get(key)
  },
}))
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { startseiteFassung: { findFirst: vi.fn() }, farm: { findMany: vi.fn() } },
}))

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { STANDARD_REIHENFOLGE } from '@/lib/startseite-gestalten'
import { standardFassung } from '@/lib/startseite-fassung'
import type { FassungInhalt } from '@/schemas/startseite-fassung'
import { ladeStartseite } from '@/server/queries/startseite'

const JETZT = new Date('2026-10-15T18:30:00.000Z')
const findFirst = vi.mocked(prisma.startseiteFassung.findFirst)

function hoefeBlock(id: string, farmIds: string[]): FassungInhalt['zeilen'][number] {
  return { art: 'BLOCK', sichtbar: true, block: { id, vorlage: 'HOEFE_AUSWAHL', titel: `Block ${id}`, farmIds, liveAb: '2026-10-01T04:00:00.000Z' } }
}

/** Antwortet auf „live zu …“ (liveAb lte) mit `live` und auf „nächste nach …“ (liveAb gt) mit `naechste`. */
function fassungen(live: { id: string; inhalt: unknown } | null, naechste: Date | null): void {
  findFirst.mockImplementation((async (frage: { where: { liveAb: { lte?: Date; gt?: Date } } }) =>
    frage.where.liveAb.lte ? live : naechste && { liveAb: naechste }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  cache.gemerkt.clear()
})

describe('ladeStartseite', () => {
  it('fragt die jüngste nicht zurückgezogene Fassung mit erreichter Zeit — beim Lesen', async () => {
    fassungen(null, null)
    await ladeStartseite(JETZT)
    const frage = findFirst.mock.calls.map((c) => c[0] as { where: Record<string, unknown>; orderBy: unknown })
    const live = frage.find((f) => (f.where.liveAb as { lte?: Date }).lte)
    expect(live?.where).toMatchObject({ zurueckgezogenAm: null })
    expect(live?.orderBy).toEqual([{ liveAb: 'desc' }, { createdAt: 'desc' }])
    // Der Zeitpunkt kommt aus dem Lesen selbst, nicht aus einem Cron.
    expect((live?.where.liveAb as { lte: Date }).lte).toBeInstanceOf(Date)
  })

  it('zeigt ohne Fassung die Standard-Reihenfolge, alle sichtbar, ohne Blöcke', async () => {
    fassungen(null, null)
    expect(await ladeStartseite(JETZT)).toEqual(STANDARD_REIHENFOLGE.map((art) => ({ art, sichtbar: true })))
    expect(prisma.farm.findMany).not.toHaveBeenCalled()
  })

  it('liest die Höfe aller Blöcke in EINER Abfrage, nur freigeschaltete — ein gesperrter fällt weg', async () => {
    const [kopf, hoefe, ...rest] = standardFassung().zeilen
    const inhalt: FassungInhalt = { v: 1, zeilen: [kopf, hoefeBlock('b1', ['f1', 'f2']), hoefe, hoefeBlock('b2', ['f2', 'f9']), ...rest] }
    fassungen({ id: 'f-live', inhalt }, null)
    vi.mocked(prisma.farm.findMany).mockResolvedValue([
      { id: 'f1', slug: 'hof-eins' },
      { id: 'f2', slug: 'hof-zwei' },
    ] as never)

    const zeilen = await ladeStartseite(JETZT)

    expect(prisma.farm.findMany).toHaveBeenCalledTimes(1)
    const gefragt = vi.mocked(prisma.farm.findMany).mock.calls[0]?.[0] as { where: { id: { in: string[] }; approvedAt: unknown } }
    expect(new Set(gefragt.where.id.in)).toEqual(new Set(['f1', 'f2', 'f9']))
    expect(gefragt.where.approvedAt).toEqual({ not: null })
    expect(zeilen.flatMap((z) => (z.art === 'BLOCK' ? [z.block.hofSlugs] : []))).toEqual([['hof-eins', 'hof-zwei'], ['hof-zwei']])
  })

  it('zeigt bei einer unlesbaren Fassung die Standard-Reihenfolge und meldet nur ihre Kennung', async () => {
    fassungen({ id: 'f-kaputt', inhalt: { v: 2, geheim: 'Text des Admins' } }, null)
    expect(await ladeStartseite(JETZT)).toEqual(STANDARD_REIHENFOLGE.map((art) => ({ art, sichtbar: true })))
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    const meldung = JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls[0])
    expect(meldung).toContain('f-kaputt')
    expect(meldung).not.toContain('Text des Admins')
  })

  it('liest ab dem Termin der nächsten Planung frisch am Cache vorbei', async () => {
    const termin = new Date('2026-10-17T07:00:00.000Z')
    const ohneFragen: FassungInhalt = { v: 1, zeilen: standardFassung().zeilen.map((z) => (z.art === 'FRAGEN' ? { ...z, sichtbar: false } : z)) }
    // Der Cache-Eintrag entsteht vor dem Termin: live der Standard, geplant der Termin.
    fassungen(null, termin)
    const vorher = await ladeStartseite(JETZT)
    expect(vorher.find((z) => z.art === 'FRAGEN')?.sichtbar).toBe(true)

    // Ab jetzt ist die geplante Fassung erreicht; die Datenbank weiß es, der Cache noch nicht.
    fassungen({ id: 'f-geplant', inhalt: ohneFragen }, null)
    expect((await ladeStartseite(new Date(termin.getTime() - 1))).find((z) => z.art === 'FRAGEN')?.sichtbar).toBe(true)
    expect((await ladeStartseite(termin)).find((z) => z.art === 'FRAGEN')?.sichtbar).toBe(false)
  })

  it('gibt bei einem Lesefehler eine leere Liste und meldet ihn nach Sentry', async () => {
    findFirst.mockRejectedValue(new Error('Verbindung weg'))
    expect(await ladeStartseite(JETZT)).toEqual([])
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
})
