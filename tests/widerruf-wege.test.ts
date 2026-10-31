/**
 * Widerruf online (Nr. 200, Register N39) — die Systemgrenzen: Server Actions
 * (src/server/actions/widerruf.ts), Nachlauf (src/server/widerruf.ts) und die
 * Seite /widerruf. Datenbank, Mail, Bremse und Sitzung sind gemockt
 * (Infrastruktur); geprüft werden Signatur, Zuordnung, gleiche Antwort,
 * Bremse, Pflichtgrund und dass keine Adresse im Log steht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '203.0.113.7' })) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    widerruf: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    farm: { findUnique: vi.fn() },
    unterhaltung: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/admin-protokoll', () => ({ protokolliere: vi.fn(async () => true) }))
vi.mock('@/server/bremse-datenbank', () => ({ bremseUeberAlleInstanzen: vi.fn(async () => true) }))
vi.mock('@/server/mail-warteschlange', () => ({ stelleEinOhneRisiko: vi.fn(async () => {}) }))
vi.mock('@/lib/email', () => ({ sendWiderrufEingang: vi.fn(async () => ({ id: 'mail-1' })) }))
// Storno und Teilstorno haben eigene Tests (stornieren, artikel-fehlt); hier zählt, was der Widerruf daraus macht.
vi.mock('@/server/stornieren', () => ({ storniere: vi.fn(async () => ({})) }))
vi.mock('@/server/artikel-fehlt', () => ({ meldeFehlendenArtikel: vi.fn() }))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: (a: () => Promise<void>) => nachlauf.aufgaben.push(a) }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { protokolliere } from '@/server/admin-protokoll'
import { sendWiderrufEingang } from '@/lib/email'
import { stelleEinOhneRisiko } from '@/server/mail-warteschlange'
import { storniere } from '@/server/stornieren'
import { meldeFehlendenArtikel } from '@/server/artikel-fehlt'
import { widerrufSignatur } from '@/lib/bestell-link'
import { adressMerkmal } from '@/lib/bremse-datenbank'
import { lehneWiderrufAbAction, reicheWiderrufMitLinkEin, reicheWiderrufOhneLinkEin } from '@/server/actions/widerruf'
import { verarbeiteWiderruf } from '@/server/widerruf'
import WiderrufPage from '@/app/(public)/widerruf/page'
import { WiderrufFormular } from '@/app/(public)/widerruf/widerruf-formular'

const db = vi.mocked(prisma, true)
const ADRESSE = 'erfunden@example.com'

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben = []
  db.widerruf.create.mockResolvedValue({ id: 'widerruf-1' } as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const LINK_BESTELLUNG = {
  id: 'bestellung-1',
  orderNumber: 'HM-2611-TEST',
  kaeuferArt: 'PRIVAT',
  status: 'PICKED_UP',
  pickedUpAt: new Date(),
  customerEmail: ADRESSE,
  items: [
    { id: 'pos-a', quantity: 1, fehltSeit: null },
    { id: 'pos-b', quantity: 2, fehltSeit: null },
  ],
}

describe('mit signiertem Link', () => {
  it('falsche Signatur → „Link ungültig“, ohne eine Abfrage', async () => {
    const antwort = await reicheWiderrufMitLinkEin({ bestellung: 'bestellung-1', sig: 'falsch', umfang: 'ganz', name: 'Erika Test' })
    expect(antwort).toMatchObject({ code: 'LINK' })
    expect(db.order.findUnique).not.toHaveBeenCalled()
    expect(db.widerruf.create).not.toHaveBeenCalled()
  })

  it('Position einer fremden Bestellung → abgelehnt, nichts angelegt', async () => {
    db.order.findUnique.mockResolvedValue(LINK_BESTELLUNG as never)
    const antwort = await reicheWiderrufMitLinkEin({
      bestellung: 'bestellung-1',
      sig: widerrufSignatur('bestellung-1'),
      umfang: 'teil',
      positionen: ['fremde-position'],
      name: 'Erika Test',
    })
    expect(antwort).toMatchObject({ code: 'EINGABE' })
    expect(db.widerruf.create).not.toHaveBeenCalled()
  })

  it('Gegenprobe: eigene Position → angelegt mit ganzer Menge und der Adresse der Bestellung', async () => {
    db.order.findUnique.mockResolvedValue(LINK_BESTELLUNG as never)
    const antwort = await reicheWiderrufMitLinkEin({
      bestellung: 'bestellung-1',
      sig: widerrufSignatur('bestellung-1'),
      umfang: 'teil',
      positionen: ['pos-b'],
      name: 'Erika Test',
    })
    expect(antwort).toMatchObject({ ok: true })
    expect(db.widerruf.create.mock.calls[0]![0].data).toMatchObject({
      orderId: 'bestellung-1',
      email: ADRESSE,
      positionen: [{ orderItemId: 'pos-b', menge: 2 }],
    })
  })
})

describe('ohne Link', () => {
  const eingabe = { name: 'Erika Test', email: ADRESSE, bestellnummer: ' hm-2611-test ', umfang: 'ganz' }

  it('passende Nummer UND E-Mail → zugeordnet; sonst orderId null — die Antwort ist dieselbe', async () => {
    db.order.findFirst.mockResolvedValueOnce({ id: 'bestellung-1' } as never)
    const mit = await reicheWiderrufOhneLinkEin(eingabe)
    db.order.findFirst.mockResolvedValueOnce(null as never)
    const ohne = await reicheWiderrufOhneLinkEin(eingabe)

    expect(db.order.findFirst.mock.calls[0]![0]).toMatchObject({
      where: { orderNumber: 'HM-2611-TEST', customerEmail: { equals: ADRESSE, mode: 'insensitive' } },
    })
    expect(db.widerruf.create.mock.calls[0]![0].data.orderId).toBe('bestellung-1')
    expect(db.widerruf.create.mock.calls[1]![0].data.orderId).toBeNull()
    // Gleiche Antwort: dieselben Schlüssel, derselbe Erfolg — nur der Zeitpunkt unterscheidet sich.
    expect(Object.keys(mit).sort()).toEqual(Object.keys(ohne).sort())
    expect(mit).toMatchObject({ ok: true })
    expect(ohne).toMatchObject({ ok: true })
    // Vor der Antwort schreibt kein Weg ins Protokoll — ein Treffer dauert nicht länger als ein Fehlversuch.
    expect(protokolliere).not.toHaveBeenCalled()
    expect(nachlauf.aufgaben).toHaveLength(2)

    // Nach der Antwort steht das Zuordnen im Protokoll — nur die Kennung, nur beim Treffer.
    const gespeichert = { eingegangenAm: new Date(), email: ADRESSE, bestellnummerEingabe: 'hm-2611-test', umfang: 'ganz', positionen: null, nachricht: null, stand: 'eingegangen' }
    db.widerruf.findUnique.mockResolvedValueOnce({ ...gespeichert, id: 'widerruf-1', orderId: 'bestellung-1' } as never)
    db.widerruf.findUnique.mockResolvedValueOnce({ ...gespeichert, id: 'widerruf-2', orderId: null } as never)
    db.order.findUnique.mockResolvedValue(null as never)
    for (const aufgabe of nachlauf.aufgaben) await aufgabe()
    expect(protokolliere).toHaveBeenCalledTimes(1)
    expect(protokolliere).toHaveBeenCalledWith({ wer: null, art: 'widerruf_zugeordnet', bezugArt: 'bestellung', bezugId: 'bestellung-1', mitPasskey: false })
  })

  it('Bremse greift (5 je IP und Stunde, 3 je Adresse und Tag) — nichts angelegt', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.mocked(bremseUeberAlleInstanzen).mockResolvedValueOnce(false)
    const antwort = await reicheWiderrufOhneLinkEin(eingabe)
    expect(antwort).toMatchObject({ code: 'ZU_VIELE' })
    expect(db.widerruf.create).not.toHaveBeenCalled()
    const versuche = vi.mocked(bremseUeberAlleInstanzen).mock.calls[0]![0]
    expect(versuche.map((v) => [v.bremse.zweck, v.bremse.max, v.bremse.fensterMs])).toEqual([
      ['widerruf-ip', 5, 60 * 60 * 1000],
      ['widerruf-adresse', 3, 24 * 60 * 60 * 1000],
    ])
    // Gespeichert wird nur der HMAC-Schlüssel aus Zweck und Merkmal (bremsSchluessel), nie die Adresse.
    expect(versuche[1]!.merkmal).toBe(adressMerkmal(ADRESSE))
    // Gegenprobe: mit freier Bremse geht derselbe Widerruf durch.
    expect(await reicheWiderrufOhneLinkEin(eingabe)).toMatchObject({ ok: true })
  })
})

describe('Nachlauf: Eingangsbestätigung', () => {
  it('geht an die Adresse des Widerrufs; im Log steht keine Adresse und kein Name', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    db.widerruf.findUnique.mockResolvedValue({
      id: 'widerruf-1',
      orderId: null,
      eingegangenAm: new Date('2026-11-03T13:05:00Z'),
      email: ADRESSE,
      bestellnummerEingabe: 'HM-2611-TEST',
      umfang: 'ganz',
      positionen: null,
      nachricht: null,
      stand: 'eingegangen',
    } as never)
    await verarbeiteWiderruf('widerruf-1', false)
    expect(sendWiderrufEingang).toHaveBeenCalledTimes(1)
    const [an, daten] = vi.mocked(sendWiderrufEingang).mock.calls[0]!
    expect(an).toBe(ADRESSE)
    expect(daten).toMatchObject({ bestellnummer: 'HM-2611-TEST', eingegangenAm: '3. November 2026, 14:05 Uhr', hofName: null })
    const geloggt = JSON.stringify([...log.mock.calls, ...fehler.mock.calls])
    expect(geloggt).not.toContain(ADRESSE)
    expect(geloggt).not.toContain('Erika')
  })
})

describe('Nachlauf: vor der Abholung', () => {
  const WIDERRUF = {
    id: 'widerruf-1',
    orderId: 'bestellung-1',
    eingegangenAm: new Date(),
    email: ADRESSE,
    bestellnummerEingabe: 'HM-2611-TEST',
    umfang: 'teil',
    positionen: [{ orderItemId: 'pos-a', menge: 1 }],
    nachricht: null,
    stand: 'eingegangen',
  }
  const BESTELLUNG = {
    id: 'bestellung-1',
    farmId: 'hof-1',
    orderNumber: 'HM-2611-TEST',
    kaeuferArt: 'PRIVAT',
    status: 'CONFIRMED',
    pickedUpAt: null,
    farm: { name: 'Testhof' },
    items: [
      { id: 'pos-a', productName: 'Eier', quantity: 1, fehltSeit: null },
      { id: 'pos-b', productName: 'Brot', quantity: 2, fehltSeit: null },
    ],
  }
  const teil = (zahlung: 'online' | 'vor_ort', erstattetCents: number) => ({ art: 'teil', rechnung: { zahlung }, erstattetCents, rueckbuchungOffen: false })

  beforeEach(() => {
    db.order.findUnique.mockResolvedValue(BESTELLUNG as never)
    db.widerruf.updateMany.mockResolvedValue({ count: 1 } as never)
  })

  it('Teilwiderruf, online: genau ein Mail-Auftrag `widerruf-erstattet` mit dem gebuchten Betrag', async () => {
    db.widerruf.findUnique.mockResolvedValue(WIDERRUF as never)
    vi.mocked(meldeFehlendenArtikel).mockResolvedValue(teil('online', 495) as never)
    await verarbeiteWiderruf('widerruf-1', true)

    expect(meldeFehlendenArtikel).toHaveBeenCalledTimes(1)
    expect(db.widerruf.updateMany.mock.calls[0]![0]).toMatchObject({ where: { id: 'widerruf-1', stand: 'eingegangen' }, data: { stand: 'erstattet' } })
    expect(stelleEinOhneRisiko).toHaveBeenCalledTimes(1)
    const [art, bestellung, auftrag] = vi.mocked(stelleEinOhneRisiko).mock.calls[0]!
    expect([art, bestellung]).toEqual(['widerruf-erstattet', 'bestellung-1'])
    expect(auftrag).toMatchObject({ art: 'widerruf-erstattet', schluessel: 'widerruf-erstattet:widerruf-1', bezug: { widerrufId: 'widerruf-1', erstattetCents: '495', vorAbholung: '1' } })
    // Kein Storno der ganzen Bestellung, keine Meldung an den Hof.
    expect(storniere).not.toHaveBeenCalled()
    expect(db.unterhaltung.create).not.toHaveBeenCalled()
  })

  it('Gegenproben: vor Ort ohne Betrag; ganze Bestellung über storniere ohne zweite Mail; Stand schon gesetzt → keine Mail', async () => {
    db.widerruf.findUnique.mockResolvedValue(WIDERRUF as never)
    vi.mocked(meldeFehlendenArtikel).mockResolvedValue(teil('vor_ort', 0) as never)
    await verarbeiteWiderruf('widerruf-1', true)
    expect(stelleEinOhneRisiko).toHaveBeenCalledTimes(1)
    expect(vi.mocked(stelleEinOhneRisiko).mock.calls[0]![2]).toMatchObject({ bezug: { widerrufId: 'widerruf-1', vorAbholung: '1' } })
    expect(vi.mocked(stelleEinOhneRisiko).mock.calls[0]![2]).not.toHaveProperty('bezug.erstattetCents')

    vi.mocked(stelleEinOhneRisiko).mockClear()
    db.widerruf.findUnique.mockResolvedValue({ ...WIDERRUF, umfang: 'ganz', positionen: null } as never)
    await verarbeiteWiderruf('widerruf-1', true)
    expect(storniere).toHaveBeenCalledWith({ id: 'hof-1' }, 'bestellung-1', 'Widerruf der Kundin')
    // Die Storno-Mail stellt `storniere` selbst ein — der Widerruf legt keine zweite dazu.
    expect(stelleEinOhneRisiko).not.toHaveBeenCalled()

    db.widerruf.findUnique.mockResolvedValue(WIDERRUF as never)
    db.widerruf.updateMany.mockResolvedValue({ count: 0 } as never)
    vi.mocked(meldeFehlendenArtikel).mockResolvedValue(teil('online', 495) as never)
    await verarbeiteWiderruf('widerruf-1', true)
    expect(stelleEinOhneRisiko).not.toHaveBeenCalled()
  })
})

describe('Hof: Ablehnen', () => {
  it('ohne Grund → Fehlersatz, nichts geändert', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'u-1', role: 'FARMER' } } as never)
    const antwort = await lehneWiderrufAbAction({ widerrufId: 'widerruf-1', grund: '   ' })
    expect(antwort).toEqual({ error: 'Bitte schreib einen Grund.' })
    expect(db.widerruf.updateMany).not.toHaveBeenCalled()
  })
})

describe('Seite /widerruf', () => {
  it('falsch signierter Link → 404, ohne Abfrage', async () => {
    await expect(WiderrufPage({ searchParams: Promise.resolve({ bestellung: 'bestellung-1', sig: 'falsch' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(WiderrufPage({ searchParams: Promise.resolve({ bestellung: 'bestellung-1' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(db.order.findUnique).not.toHaveBeenCalled()
  })

  it('die Knöpfe heißen wörtlich „Vertrag widerrufen“ und „Widerruf bestätigen“', () => {
    const html = renderToStaticMarkup(createElement(WiderrufFormular, { bestellung: null }))
    expect(html).toContain('>Vertrag widerrufen</button>')
    // Schritt 2 rendert erst nach dem Klick — der Knopf nimmt die eine Quelle.
    const quelle = readFileSync('src/app/(public)/widerruf/widerruf-formular.tsx', 'utf8')
    expect(quelle).toContain('{WIDERRUF_TEXT.knopfBestaetigen}')
  })
})
