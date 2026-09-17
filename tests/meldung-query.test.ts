/**
 * Tests für die Lesezugriffe des Briefkastens (src/server/queries/meldung.ts,
 * Sprint fehlerbriefkasten Teil C/D) — Prisma gemockt.
 *
 * Beweist: die Hof-Query filtert HART auf farmId; eine fremde ID liefert
 * nichts; die Hof-Sicht enthält NIE Triage-Felder, selbst wenn die Datenbank
 * sie mitliefert; der Admin-Filter fällt auf NEU+GEPRUEFT zurück; die
 * Wunsch-Bündelung zählt je Cluster, größte zuerst, „ohne Cluster" zuletzt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { meldung: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() } },
}))

import {
  getMeldungenFuerHof,
  getMeldungFuerHof,
  filterAusParametern,
  getMeldungenFuerAdmin,
  getMeldungDetail,
  gruppiereWuensche,
  getWunschCluster,
} from '@/server/queries/meldung'
import { prisma } from '@/lib/prisma'

const findMany = vi.mocked(prisma.meldung.findMany)
const findFirst = vi.mocked(prisma.meldung.findFirst)

const ZEILE = {
  id: 'cmfmeldung0000000001abc',
  art: 'FEHLER',
  text: 'Abholzeiten speichern geht nicht.\nZweite Zeile.',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  status: 'KEIN_FEHLER',
  antwortAnMelder: 'Die Zeiten werden erst nach „Speichern" unten übernommen.',
  // Was die Datenbank sonst noch hätte — darf NIE beim Hof ankommen
  triageNotiz: 'Bedienfehler, kein Bug',
  clusterKey: 'abholzeiten',
  duplikatVonId: 'cmfandere',
  sprintName: 'abholzeiten-v2',
  triagedAt: new Date('2026-09-02T08:00:00Z'),
  farmId: 'farm_1',
  seiteUrl: 'https://farmerzone.at/settings',
  userAgent: 'UA',
  viewport: '375x667',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Hof-Sicht', () => {
  it('fragt nur die eigenen Meldungen ab — farmId steht hart in der Query', async () => {
    findMany.mockResolvedValue([ZEILE] as never)
    await getMeldungenFuerHof('farm_1')
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany.mock.calls[0][0]?.where).toEqual({ farmId: 'farm_1' })
  })

  it('liefert nur die Felder der Sichtbarkeitsregel — keine Triage, kein Kontext', async () => {
    findMany.mockResolvedValue([ZEILE] as never)
    const [m] = await getMeldungenFuerHof('farm_1')
    expect(Object.keys(m).sort()).toEqual(
      ['antwortAnMelder', 'art', 'createdAt', 'id', 'kurznummer', 'status', 'statusFarbe', 'text'].sort()
    )
    expect(m.status).toBe('Geprüft — funktioniert wie vorgesehen')
    expect(m.kurznummer).toBe('cmfmeldu')
    expect(m.antwortAnMelder).toBe(ZEILE.antwortAnMelder)
    expect(m).not.toHaveProperty('triageNotiz')
    expect(m).not.toHaveProperty('clusterKey')
    expect(m).not.toHaveProperty('sprintName')
  })

  it('bindet auch den Einzelzugriff an die farmId — eine fremde ID liefert null', async () => {
    findFirst.mockResolvedValue(null)
    const result = await getMeldungFuerHof('farm_1', 'cmfmeldung0000000001abc')
    expect(result).toBeNull()
    expect(findFirst.mock.calls[0][0]?.where).toEqual({ id: 'cmfmeldung0000000001abc', farmId: 'farm_1' })
  })

  it('liefert die eigene Meldung in der Hof-Sicht', async () => {
    findFirst.mockResolvedValue(ZEILE as never)
    const m = await getMeldungFuerHof('farm_1', ZEILE.id)
    expect(m?.status).toBe('Geprüft — funktioniert wie vorgesehen')
    expect(m).not.toHaveProperty('triageNotiz')
  })
})

describe('Admin-Filter', () => {
  it('fällt ohne Parameter auf NEU + GEPRUEFT und alle Arten zurück', () => {
    expect(filterAusParametern({})).toEqual({ status: ['NEU', 'GEPRUEFT'], art: null })
  })

  it('nimmt gültige Werte, ignoriert unbekannte', () => {
    expect(filterAusParametern({ status: 'ERLEDIGT,quatsch,DUPLIKAT', art: 'WUNSCH' })).toEqual({
      status: ['ERLEDIGT', 'DUPLIKAT'],
      art: 'WUNSCH',
    })
    expect(filterAusParametern({ status: 'quatsch', art: 'X' })).toEqual({ status: ['NEU', 'GEPRUEFT'], art: null })
  })

  it('gibt den Filter an Prisma weiter und bildet die Zeile mit Kurznummer und erster Zeile', async () => {
    findMany.mockResolvedValue([{ ...ZEILE, farm: { name: 'Biohof' }, customerEmail: null, diagKennung: 'S71' }] as never)
    const zeilen = await getMeldungenFuerAdmin({ status: ['NEU'], art: 'FEHLER' })
    expect(findMany.mock.calls[0][0]?.where).toEqual({ status: { in: ['NEU'] }, art: 'FEHLER' })
    expect(zeilen[0]).toMatchObject({
      kurznummer: 'cmfmeldu',
      hofName: 'Biohof',
      ersteZeile: 'Abholzeiten speichern geht nicht.',
      diagKennung: 'S71',
      clusterKey: 'abholzeiten',
      status: 'KEIN_FEHLER',
    })
  })

  it('löst im Detail eine Kurznummer als Präfix und eine volle ID exakt auf', async () => {
    findFirst.mockResolvedValue(null)
    await getMeldungDetail('cmfmeldu')
    expect(findFirst.mock.calls[0][0]?.where).toEqual({ id: { startsWith: 'cmfmeldu' } })
    await getMeldungDetail(ZEILE.id)
    expect(findFirst.mock.calls[1][0]?.where).toEqual({ id: ZEILE.id })
  })
})

describe('gruppiereWuensche', () => {
  const t = (tage: number) => new Date(Date.UTC(2026, 8, 1 + tage))
  const w = (id: string, clusterKey: string | null, tage: number, text = `Wunsch ${id}`) => ({
    id,
    text,
    clusterKey,
    createdAt: t(tage),
    hofName: 'Hof ' + id,
  })

  it('zählt je Cluster, größte Bündel zuerst, ohne Cluster ganz unten', () => {
    const cluster = gruppiereWuensche([
      w('a1', 'abholzeiten', 0),
      w('a2', 'abholzeiten', 1),
      w('a3', 'abholzeiten', 2),
      w('b1', 'bilder', 0),
      w('b2', 'bilder', 3),
      w('o1', null, 5),
      w('o2', '  ', 6),
    ])
    expect(cluster.map((c) => [c.clusterKey, c.anzahl])).toEqual([
      ['abholzeiten', 3],
      ['bilder', 2],
      [null, 2],
    ])
  })

  it('zeigt je Bündel höchstens drei Beispiele, die jüngsten zuerst', () => {
    const cluster = gruppiereWuensche([
      w('a1', 'k', 0),
      w('a2', 'k', 1),
      w('a3', 'k', 2),
      w('a4', 'k', 3),
    ])
    expect(cluster[0].anzahl).toBe(4)
    expect(cluster[0].beispiele.map((b) => b.id)).toEqual(['a4', 'a3', 'a2'])
    expect(cluster[0].beispiele[0].kurznummer).toBe('a4')
  })

  it('sortiert gleich große Bündel nach Namen', () => {
    const cluster = gruppiereWuensche([w('1', 'zebra', 0), w('2', 'apfel', 0)])
    expect(cluster.map((c) => c.clusterKey)).toEqual(['apfel', 'zebra'])
  })

  it('fragt für den Reiter nur Wünsche ab, Duplikate ausgenommen', async () => {
    findMany.mockResolvedValue([] as never)
    await getWunschCluster()
    expect(findMany.mock.calls[0][0]?.where).toEqual({ art: 'WUNSCH', status: { not: 'DUPLIKAT' } })
  })
})
