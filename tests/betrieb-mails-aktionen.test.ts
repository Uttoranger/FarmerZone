/**
 * „Jetzt schicken“ und „Verwerfen“ in Admin › Betrieb › E-Mails (Nr. 161,
 * Register N26, N20; src/server/actions/betrieb.ts).
 *
 * Beweist mit gemockter Datenbank, je mit Gegenprobe:
 *  - ohne frische Bestätigung antwortet jede Aktion mit dem Satz der Wache,
 *    und nichts wird geändert; ungültige Eingabe ebenso;
 *  - „Jetzt schicken“ setzt DIESELBE Zeile auf offen, versuche 0, nächster
 *    Versuch jetzt — nur über die Warteschlange (nicht Sofort), nur offen
 *    oder gescheitert, nie mit einem Code, bei dem es nicht hilft (422); der
 *    Worker läuft danach (nach der Antwort);
 *  - „Verwerfen“ setzt nur offene und gescheiterte auf verworfen — die Zeile
 *    bleibt (kein Löschen);
 *  - beides geht für einen Auftrag oder alle einer Art.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const db = vi.hoisted(() => ({ mailAuftrag: { updateMany: vi.fn(), deleteMany: vi.fn() } }))
const wache = vi.hoisted(() => ({ verlangeAdminAktion: vi.fn(), verlangeFrischeBestaetigung: vi.fn() }))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
const worker = vi.hoisted(() => ({ arbeiteWarteschlange: vi.fn(async () => ({ gelaufen: true })) }))

vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/server/admin-wache', () => wache)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/betrieb', () => ({ beginneMessung: vi.fn(), messeUndPruefe: vi.fn() }))
vi.mock('@/server/mail-warteschlange', () => worker)
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn((aufgabe: () => Promise<void>) => nachlauf.aufgaben.push(aufgabe)) }))

import { FRISCH_FEHLER } from '@/lib/admin-anmeldung'
import { MAIL_TEXT } from '@/lib/betrieb-mails'
import { schickeMailJetztAction, verwirfMailAction } from '@/server/actions/betrieb'

const KENNUNG = 'cmfauftrag0000000000001a'

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben = []
  wache.verlangeFrischeBestaetigung.mockResolvedValue({ ok: true, userId: 'admin_1', sitzungId: 'sitzung-admin_1' })
  db.mailAuftrag.updateMany.mockResolvedValue({ count: 1 })
})

describe.each([
  ['schickeMailJetztAction', schickeMailJetztAction],
  ['verwirfMailAction', verwirfMailAction],
] as const)('%s', (_name, aktion) => {
  it('ohne frische Bestätigung: der Satz der Wache, nichts geändert, kein Worker', async () => {
    wache.verlangeFrischeBestaetigung.mockResolvedValue({ error: FRISCH_FEHLER })
    expect(await aktion({ id: KENNUNG })).toEqual({ error: FRISCH_FEHLER })
    expect(db.mailAuftrag.updateMany).not.toHaveBeenCalled()
    expect(nachlauf.aufgaben).toHaveLength(0)
    expect(wache.verlangeAdminAktion).not.toHaveBeenCalled()
  })

  it('ungültige Eingabe (Adresse statt Kennung, fremde Art, zwei Felder): nichts geändert', async () => {
    for (const eingabe of [{ id: 'kundin@example.at' }, { art: 'gibt-es-nicht' }, { id: KENNUNG, art: 'abholbereit' }, null]) {
      expect(await aktion(eingabe)).toEqual({ error: MAIL_TEXT.eingabeUngueltig })
    }
    expect(db.mailAuftrag.updateMany).not.toHaveBeenCalled()
  })

  it('Gegenprobe: frisch bestätigt ändert sie genau eine Anweisung — nie gelöscht', async () => {
    expect(await aktion({ id: KENNUNG })).toMatchObject({ ok: true })
    expect(db.mailAuftrag.updateMany).toHaveBeenCalledTimes(1)
    expect(db.mailAuftrag.deleteMany).not.toHaveBeenCalled()
  })
})

describe('Jetzt schicken', () => {
  it('dieselbe Zeile: offen, versuche 0, nächster Versuch jetzt — nur Warteschlange, nur offen/gescheitert, nie mit 422', async () => {
    const vorher = Date.now()
    expect(await schickeMailJetztAction({ id: KENNUNG })).toEqual({ ok: true, satz: 'Die Mail geht gleich hinaus.' })
    const { where, data } = db.mailAuftrag.updateMany.mock.calls[0][0]
    expect(where).toMatchObject({ id: KENNUNG, vorrang: { gt: 0 }, status: { in: ['offen', 'gescheitert'] } })
    expect(where.OR[0]).toEqual({ fehlerCode: null })
    expect(where.OR[1].fehlerCode.notIn).toContain('validation_error')
    expect(where.OR[1].fehlerCode.notIn).not.toContain('rate_limit_exceeded')
    expect(data).toMatchObject({ status: 'offen', versuche: 0, belegtBis: null })
    expect(data.naechsterVersuchAm.getTime()).toBeGreaterThanOrEqual(vorher)
    // Der Worker läuft nach der Antwort.
    expect(nachlauf.aufgaben).toHaveLength(1)
    await nachlauf.aufgaben[0]()
    expect(worker.arbeiteWarteschlange).toHaveBeenCalledWith({ biszeitMs: 45_000 })
  })

  it('alle einer Art: dieselben Bedingungen über die Art', async () => {
    db.mailAuftrag.updateMany.mockResolvedValue({ count: 3 })
    expect(await schickeMailJetztAction({ art: 'bestellung-bestaetigung' })).toEqual({ ok: true, satz: '3 Mails gehen gleich hinaus.' })
    expect(db.mailAuftrag.updateMany.mock.calls[0][0].where).toMatchObject({ art: 'bestellung-bestaetigung', vorrang: { gt: 0 } })
  })

  it('Gegenprobe: traf die Anweisung nichts (inzwischen in Arbeit oder 422), kein Worker und ein ehrlicher Satz', async () => {
    db.mailAuftrag.updateMany.mockResolvedValue({ count: 0 })
    expect(await schickeMailJetztAction({ id: KENNUNG })).toEqual({ ok: true, satz: MAIL_TEXT.nichtsGeaendert })
    expect(nachlauf.aufgaben).toHaveLength(0)
  })
})

describe('Verwerfen', () => {
  it('nur offene und gescheiterte werden verworfen; die Zeile bleibt im Protokoll', async () => {
    expect(await verwirfMailAction({ id: KENNUNG })).toEqual({ ok: true, satz: 'Die Mail ist verworfen – sie bleibt im Protokoll.' })
    expect(db.mailAuftrag.updateMany).toHaveBeenCalledWith({ where: { id: KENNUNG, status: { in: ['offen', 'gescheitert'] } }, data: { status: 'verworfen', belegtBis: null } })
    expect(nachlauf.aufgaben).toHaveLength(0)
  })
})
