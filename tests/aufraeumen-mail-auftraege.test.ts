/**
 * Aufräumen und Mail-Warteschlange (Nr. 170; Register N26, N18) mit Attrappen —
 * die echte Datenbank prüft tests/integration/aufraeumen.int.test.ts.
 *
 * Beweist:
 *  - Das Aufräumen fasst Aufträge „in Arbeit“ nicht an (kein updateMany auf
 *    MailAuftrag): Ein abgebrochener Lauf behält seine alte Belegung, und der
 *    Worker schickt ihn mit dessen Idempotenz-Schlüssel.
 *  - VOR dem Löschen sichert es die gesendete Zahl der Beiträge
 *    (`sichereGesendeteBeitragsMails`) mit derselben Grenze wie das Löschen.
 *  - Gegenprobe: Scheitert das Sichern, wird nichts gelöscht.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => {
  const reihe: string[] = []
  const nichts = { count: 0 }
  return {
    reihe,
    nichts,
    loeschen: vi.fn(async () => {
      reihe.push('loeschen')
      return { count: 4 }
    }),
    auftragUpdate: vi.fn(async () => nichts),
    sichere: vi.fn(async () => {
      reihe.push('sichern')
      return 2
    }),
  }
})
vi.mock('@/lib/prisma', () => ({
  prisma: {
    session: { deleteMany: vi.fn(async () => m.nichts) },
    verification: { deleteMany: vi.fn(async () => m.nichts) },
    webhookEvent: { deleteMany: vi.fn(async () => m.nichts) },
    betriebMessung: { deleteMany: vi.fn(async () => m.nichts) },
    einmalLink: { deleteMany: vi.fn(async () => m.nichts) },
    order: { updateMany: vi.fn(async () => m.nichts) },
    mailAuftrag: { deleteMany: m.loeschen, updateMany: m.auftragUpdate },
  },
}))
vi.mock('@/server/mail-arten/beitrag', () => ({ sichereGesendeteBeitragsMails: m.sichere }))

import { raeumeAltesAuf } from '@/server/aufraeumen'
import { aufraeumGrenzen } from '@/lib/betrieb'

const JETZT = new Date('2026-10-25T03:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  m.reihe.length = 0
})

describe('Aufräumen: Mail-Aufträge', () => {
  it('kein updateMany auf MailAuftrag — Aufträge „in Arbeit“ bleiben, wie sie sind; kein Feld mailAuftraegeFrei', async () => {
    const ergebnis = await raeumeAltesAuf(JETZT)
    expect(m.auftragUpdate).not.toHaveBeenCalled()
    expect(ergebnis.mailAuftraege).toBe(4)
    expect(Object.keys(ergebnis)).not.toContain('mailAuftraegeFrei')
  })

  it('erst die gesendete Zahl sichern, dann löschen — mit derselben Grenze', async () => {
    await raeumeAltesAuf(JETZT)
    const grenze = aufraeumGrenzen(JETZT).mailAuftraege
    expect(m.reihe).toEqual(['sichern', 'loeschen'])
    expect(m.sichere).toHaveBeenCalledWith(grenze)
    expect(m.loeschen).toHaveBeenCalledWith({ where: { erstelltAm: { lt: grenze } } })
  })

  it('Gegenprobe: scheitert das Sichern, wird kein Auftrag gelöscht', async () => {
    m.sichere.mockRejectedValueOnce(new Error('Verbindung weg'))
    await expect(raeumeAltesAuf(JETZT)).rejects.toThrow()
    expect(m.loeschen).not.toHaveBeenCalled()
  })
})
