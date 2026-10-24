/**
 * Die Mail-Warteschlange (Register N26, Nr. 158) ohne Datenbank: die Regeln
 * (Kontingent, Wiederholung), der Bezug (nur Kennungen), das Einstellen
 * (EIN createMany mit skipDuplicates), der Renderer „beitrag“ und die
 * Cron-Route. Was die echte Datenbank tun muss (Holen mit SKIP LOCKED, zwei
 * Worker, Last), prüft tests/integration/mail-warteschlange.int.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  mailAuftrag: { createMany: vi.fn() },
  customerFarmSubscription: { findFirst: vi.fn() },
  statusPost: { findFirst: vi.fn() },
  order: { findMany: vi.fn() },
}))
const { nachDerAntwort, arbeite, mitHerzschlag } = vi.hoisted(() => ({
  nachDerAntwort: vi.fn(),
  arbeite: vi.fn(),
  mitHerzschlag: vi.fn(async (...args: [name: string, lauf: () => Promise<unknown>, danach?: (jetzt: Date) => Promise<unknown>]) => args[1]()),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import {
  BELEGUNG_REST_MS,
  belegungReicht,
  kannWartenPausiert,
  laesstSichWiederholen,
  naechsterVersuch,
  stapelSchluessel,
  stelleMailEin,
} from '@/server/mail-warteschlange'
import { bezugSchemaFuer, VORRANG } from '@/schemas/mail-auftrag'
import { rendereBeitrag } from '@/server/mail-arten/beitrag'
import { setzeVorname, vornameFuer, vornamenAusBestellungen } from '@/server/beitrag-vorname'

beforeEach(() => {
  vi.clearAllMocks()
  db.mailAuftrag.createMany.mockResolvedValue({ count: 0 })
})

describe('Kontingent: „Kann warten“ pausiert ab 70 % des Tages bzw. 90 % des Zeitraums', () => {
  const frei = { mailsTag: 100, mailsMonat: 3_000 }

  it('69 am Tag geht, 70 pausiert; 2.699 im Zeitraum geht, 2.700 pausiert', () => {
    expect(kannWartenPausiert({ heute: 69, imZeitraum: 0 }, frei)).toBe(false)
    expect(kannWartenPausiert({ heute: 70, imZeitraum: 0 }, frei)).toBe(true)
    expect(kannWartenPausiert({ heute: 0, imZeitraum: 2_699 }, frei)).toBe(false)
    expect(kannWartenPausiert({ heute: 0, imZeitraum: 2_700 }, frei)).toBe(true)
  })

  it('ohne Tagesgrenze zählt nur der Zeitraum; ohne jede Grenze pausiert nichts', () => {
    expect(kannWartenPausiert({ heute: 10_000, imZeitraum: 0 }, { mailsTag: null, mailsMonat: 3_000 })).toBe(false)
    expect(kannWartenPausiert({ heute: 10_000, imZeitraum: 2_700 }, { mailsTag: null, mailsMonat: 3_000 })).toBe(true)
    expect(kannWartenPausiert({ heute: 10_000, imZeitraum: 10_000 }, { mailsTag: null, mailsMonat: null })).toBe(false)
  })
})

describe('Wiederholung nach 429/5xx', () => {
  const jetzt = new Date('2026-10-24T10:00:00.000Z')
  const minuten = (d: Date | null) => (d === null ? null : (d.getTime() - jetzt.getTime()) / 60_000)

  it('nach 1, 5, 15, 60 und 240 Minuten — danach keine (gescheitert)', () => {
    expect([0, 1, 2, 3, 4, 5].map((v) => minuten(naechsterVersuch(v, jetzt).am))).toEqual([1, 5, 15, 60, 240, null])
    expect(naechsterVersuch(5, jetzt).versuche).toBe(6)
  })

  it('429, 5xx und Netzfehler lassen sich wiederholen, jeder andere 4xx nicht', () => {
    expect([429, 500, 503, null].map(laesstSichWiederholen)).toEqual([true, true, true, true])
    expect([400, 403, 422].map(laesstSichWiederholen)).toEqual([false, false, false])
  })
})

describe('Belegung und Idempotenz-Schlüssel', () => {
  it('vor einer Anfrage müssen noch 30 s Belegung übrig sein; Gegenprobe: 1 ms weniger reicht nicht', () => {
    const belegtBis = new Date('2026-10-24T10:02:00.000Z')
    expect(belegungReicht(belegtBis, belegtBis.getTime() - BELEGUNG_REST_MS)).toBe(true)
    expect(belegungReicht(belegtBis, belegtBis.getTime() - BELEGUNG_REST_MS + 1)).toBe(false)
  })

  it('der Stapel-Schlüssel hängt an Kennungen und Versuchen, nicht an der Reihenfolge; Gegenprobe: ein anderer Versuch gibt einen anderen', () => {
    const a = { id: 'a1', versuche: 0 }
    const b = { id: 'b2', versuche: 1 }
    expect(stapelSchluessel([a, b])).toBe(stapelSchluessel([b, a]))
    expect(stapelSchluessel([a, b])).toMatch(/^mail-stapel-[0-9a-f]{40}$/)
    expect(stapelSchluessel([a, { ...b, versuche: 2 }])).not.toBe(stapelSchluessel([a, b]))
  })
})

describe('Bezug: nur Kennungen, nie Adresse, Text oder Token', () => {
  it('Kennungen unter …Id gehen durch', () => {
    expect(bezugSchemaFuer('bestellung-bestaetigung').safeParse({ orderId: 'cm1abc_DEF-2' }).success).toBe(true)
    expect(bezugSchemaFuer('beitrag').safeParse({ postId: 'p1', aboId: 'a1' }).success).toBe(true)
  })

  it('Adresse, Text, langer Token, fremder Name oder zu viele Felder werden abgelehnt', () => {
    const schema = bezugSchemaFuer('bestellung-bestaetigung')
    expect(schema.safeParse({ orderId: 'kundin@example.com' }).success).toBe(false)
    expect(schema.safeParse({ orderId: 'Hallo Welt' }).success).toBe(false)
    expect(schema.safeParse({ orderId: 'x'.repeat(65) }).success).toBe(false)
    expect(schema.safeParse({ email: 'abc' }).success).toBe(false)
    expect(schema.safeParse({ aId: 'a', bId: 'b', cId: 'c', dId: 'd', eId: 'e' }).success).toBe(false)
    expect(bezugSchemaFuer('beitrag').safeParse({ postId: 'p1', aboId: 'a1', zusatzId: 'z' }).success).toBe(false)
  })
})

describe('stelleMailEin', () => {
  const auftrag = (aboId: string) => ({
    art: 'beitrag' as const,
    vorrang: VORRANG.kannWarten,
    schluessel: `beitrag:p1:${aboId}`,
    bezug: { postId: 'p1', aboId },
    farmId: 'hof1',
  })

  it('viele Aufträge = EIN createMany mit skipDuplicates, danach der Worker nach der Antwort', async () => {
    db.mailAuftrag.createMany.mockResolvedValue({ count: 3 })
    expect(await stelleMailEin([auftrag('a1'), auftrag('a2'), auftrag('a3')])).toBe(3)
    expect(db.mailAuftrag.createMany).toHaveBeenCalledTimes(1)
    const [{ data, skipDuplicates }] = db.mailAuftrag.createMany.mock.calls[0]
    expect(skipDuplicates).toBe(true)
    expect(data).toHaveLength(3)
    expect(data[0]).toEqual({ art: 'beitrag', vorrang: 2, schluessel: 'beitrag:p1:a1', bezug: { postId: 'p1', aboId: 'a1' }, bestellungId: null, farmId: 'hof1' })
    expect(nachDerAntwort).toHaveBeenCalledTimes(1)
  })

  it('ein einzelner Auftrag in der Transaktion des Aufrufers (Parameter db)', async () => {
    const tx = { mailAuftrag: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } }
    await stelleMailEin({ art: 'abholbereit', vorrang: VORRANG.wichtig, schluessel: 'abholbereit:o1', bezug: { orderId: 'o1' }, bestellungId: 'o1' }, tx)
    expect(tx.mailAuftrag.createMany).toHaveBeenCalledTimes(1)
    expect(db.mailAuftrag.createMany).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ein Bezug mit Adresse wirft, bevor etwas geschrieben wird; eine leere Liste schreibt nichts', async () => {
    await expect(stelleMailEin({ ...auftrag('a1'), bezug: { postId: 'p1', aboId: 'kundin@example.com' } })).rejects.toThrow()
    expect(await stelleMailEin([])).toBe(0)
    expect(db.mailAuftrag.createMany).not.toHaveBeenCalled()
    expect(nachDerAntwort).not.toHaveBeenCalled()
  })
})

describe('Renderer „beitrag“ lädt frisch', () => {
  it('abgemeldetes oder unbestätigtes Abo → verworfen (Filter WERBEMAIL_EMPFAENGER)', async () => {
    db.customerFarmSubscription.findFirst.mockResolvedValue(null)
    expect(await rendereBeitrag({ postId: 'p1', aboId: 'a1' })).toEqual({ verworfen: 'abo_abgemeldet' })
    const where = db.customerFarmSubscription.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ id: 'a1', optInEmail: true })
    expect(where.OR).toBeDefined()
    expect(db.statusPost.findFirst).not.toHaveBeenCalled()
  })

  it('gelöschter Beitrag → verworfen', async () => {
    db.customerFarmSubscription.findFirst.mockResolvedValue({ customerEmail: 'kundin@example.com', farmId: 'hof1' })
    db.statusPost.findFirst.mockResolvedValue(null)
    expect(await rendereBeitrag({ postId: 'p1', aboId: 'a1' })).toEqual({ verworfen: 'beitrag_fehlt' })
  })

  it('Gegenprobe: gültiges Abo → Mail an die heutige Adresse, mit Vorname und Abmelde-Kopfzeilen', async () => {
    db.customerFarmSubscription.findFirst.mockResolvedValue({ customerEmail: 'kundin@example.com', farmId: 'hof1' })
    db.statusPost.findFirst.mockResolvedValue({
      title: 'Frische Eier',
      body: 'Hallo {Vorname}, es gibt Eier.',
      anlass: 'FRESH_PRODUCT',
      photoUrl: null,
      showOnFarmPage: true,
      farm: { name: 'Hof Muster', slug: 'hof-muster' },
    })
    db.order.findMany.mockResolvedValue([{ customerEmail: 'Kundin@example.com', customerName: 'Erika Musterfrau' }])
    const mail = await rendereBeitrag({ postId: 'p1', aboId: 'a1' })
    expect('verworfen' in mail).toBe(false)
    if ('verworfen' in mail) return
    expect(mail.an).toBe('kundin@example.com')
    expect(mail.betreff).toBe('Hof Muster: Frische Eier')
    expect(mail.html).toContain('Hallo Erika')
    expect(Object.keys(mail.headers ?? {})).toEqual(expect.arrayContaining(['List-Unsubscribe', 'List-Unsubscribe-Post']))
  }, 30_000)
})

describe('Vorname: eine Hilfe für direkten Versand und Renderer', () => {
  it('Adresse ohne Rücksicht auf Groß-/Kleinschreibung, neueste Bestellung gewinnt, ohne Bestellung leer', async () => {
    db.order.findMany.mockResolvedValue([
      { customerEmail: 'KUNDIN@example.com', customerName: 'Erika Musterfrau' },
      { customerEmail: 'kundin@example.com', customerName: 'Alt Name' },
    ])
    const vornamen = await vornamenAusBestellungen('hof1', ['kundin@example.com', 'neu@example.com'])
    expect(db.order.findMany.mock.calls[0][0].where).toEqual({ farmId: 'hof1', customerEmail: { in: ['kundin@example.com', 'neu@example.com'] } })
    expect(vornameFuer(vornamen, 'Kundin@Example.com')).toBe('Erika')
    expect(vornameFuer(vornamen, 'neu@example.com')).toBe('')
    expect(setzeVorname('Hallo {Vorname} und {vorname}!', 'Erika')).toBe('Hallo Erika und Erika!')
  })

  it('ohne Adressen keine Abfrage', async () => {
    expect((await vornamenAusBestellungen('hof1', [])).size).toBe(0)
    expect(db.order.findMany).not.toHaveBeenCalled()
  })
})

describe('Cron /api/cron/mails', () => {
  const pruefeAblaeufe = vi.fn(async () => 0)
  const pruefeMailWarnungen = vi.fn(async () => 0)
  vi.doMock('@/server/betrieb', () => ({ mitHerzschlag, pruefeAblaeufe, pruefeMailWarnungen }))

  async function rufe(authorization?: string) {
    vi.doMock('@/server/mail-warteschlange', () => ({ arbeiteWarteschlange: arbeite }))
    const { GET } = await import('@/app/api/cron/mails/route')
    return GET(new NextRequest('http://localhost/api/cron/mails', { headers: authorization ? { authorization } : {} }))
  }

  it('ohne oder mit falschem Bearer: 401, kein Worker', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-test-geheim')
    expect((await rufe()).status).toBe(401)
    expect((await rufe('Bearer falsch')).status).toBe(401)
    expect(arbeite).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('mit Bearer: Worker mit 50 s im Herzschlag „mails“', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-test-geheim')
    arbeite.mockResolvedValue({ gelaufen: true, seiten: 1, gesendet: 3 })
    const antwort = await rufe('Bearer cron-test-geheim')
    expect(antwort.status).toBe(200)
    expect(mitHerzschlag).toHaveBeenCalledWith('mails', expect.any(Function), expect.any(Function))
    expect(arbeite).toHaveBeenCalledWith({ biszeitMs: 50_000 })
    expect(await antwort.json()).toMatchObject({ gelaufen: true, gesendet: 3 })
    vi.unstubAllEnvs()
  })

  it('danach (Nr. 161): erst die anderen Abläufe, dann die Mail-Warnungen — mit demselben Zeitpunkt', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-test-geheim')
    arbeite.mockResolvedValue({ gelaufen: true, seiten: 0, gesendet: 0 })
    await rufe('Bearer cron-test-geheim')
    const danach = mitHerzschlag.mock.calls.at(-1)?.[2] as (jetzt: Date) => Promise<unknown>
    const jetzt = new Date('2026-10-24T08:00:00.000Z')
    await danach(jetzt)
    expect(pruefeAblaeufe).toHaveBeenCalledWith(jetzt)
    expect(pruefeMailWarnungen).toHaveBeenCalledWith(jetzt)
    expect(pruefeAblaeufe.mock.invocationCallOrder[0]).toBeLessThan(pruefeMailWarnungen.mock.invocationCallOrder[0])
    vi.unstubAllEnvs()
  })
})
