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
    $queryRaw: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/admin-protokoll', () => ({ protokolliere: vi.fn(async () => true) }))
vi.mock('@/server/admin-wache', async (original) => ({ ...(await original<typeof import('@/server/admin-wache')>()), verlangeFrischeBestaetigung: vi.fn() }))
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
import { ladeWiderrufeDesHofs, ladeWiderrufeOhneBestellung, ladeWiderrufeZurBestellung, verarbeiteWiderruf } from '@/server/widerruf'
import { ordneWiderrufZu } from '@/server/actions/admin-bestellung'
import { verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { WIDERRUF_ADMIN_TEXT, ausnahmeHinweis } from '@/lib/widerruf'
import { RUECKTRITT_TEXT } from '@/lib/ruecktritt-angaben'
import { findeElement } from './element-suche'
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

describe('Nachlauf: Teilwiderruf vor der Abholung, eine spätere Position scheitert (Nachbesserung Runde 2, Punkt 4)', () => {
  const WIDERRUF = {
    id: 'widerruf-1',
    orderId: 'bestellung-1',
    eingegangenAm: new Date(),
    email: ADRESSE,
    bestellnummerEingabe: 'HM-2611-TEST',
    umfang: 'teil',
    positionen: [
      { orderItemId: 'pos-a', menge: 1 },
      { orderItemId: 'pos-b', menge: 2 },
    ],
    nachricht: null,
    stand: 'eingegangen',
  }
  // Drei Positionen: zwei gewählt — fachlich nicht die ganze Bestellung.
  const BESTELLUNG = {
    id: 'bestellung-1',
    farmId: 'hof-1',
    orderNumber: 'HM-2611-TEST',
    kaeuferArt: 'PRIVAT',
    status: 'PAID',
    pickedUpAt: null,
    farm: { name: 'Testhof' },
    items: [
      { id: 'pos-a', productName: 'Eier', quantity: 1, fehltSeit: null },
      { id: 'pos-b', productName: 'Brot', quantity: 2, fehltSeit: null },
      { id: 'pos-c', productName: 'Honig', quantity: 1, fehltSeit: null },
    ],
  }
  const teil = (zahlung: 'online' | 'vor_ort', erstattetCents: number) => ({ art: 'teil', rechnung: { zahlung }, erstattetCents, rueckbuchungOffen: false })
  const auftraegeDer = (art: string) => vi.mocked(stelleEinOhneRisiko).mock.calls.filter((c) => c[0] === art)

  beforeEach(() => {
    db.order.findUnique.mockResolvedValue(BESTELLUNG as never)
    db.widerruf.findUnique.mockResolvedValue(WIDERRUF as never)
    db.widerruf.updateMany.mockResolvedValue({ count: 1 } as never)
  })

  it.each([
    ['abgelehnt', () => vi.mocked(meldeFehlendenArtikel).mockResolvedValueOnce(teil('online', 495) as never).mockResolvedValueOnce({ art: 'abgelehnt', grund: 'status' } as never)],
    ['wirft', () => vi.mocked(meldeFehlendenArtikel).mockResolvedValueOnce(teil('online', 495) as never).mockRejectedValueOnce(new Error('Stripe weg'))],
  ])('zweite Position %s → genau ein Auftrag `widerruf-erstattet` (vorAbholung, teilweise) mit 495 Cent; Stand bleibt offen, der Rest geht an den Hof', async (_fall, richte) => {
    richte()
    await verarbeiteWiderruf('widerruf-1', true)

    expect(meldeFehlendenArtikel).toHaveBeenCalledTimes(2)
    const erstattet = auftraegeDer('widerruf-erstattet')
    expect(erstattet).toHaveLength(1)
    expect(erstattet[0]![1]).toBe('bestellung-1')
    expect(erstattet[0]![2]).toEqual(
      expect.objectContaining({
        art: 'widerruf-erstattet',
        schluessel: 'widerruf-erstattet:widerruf-1:teilweise',
        bezug: { widerrufId: 'widerruf-1', erstattetCents: '495', vorAbholung: '1', teilweise: '1' },
      })
    )
    // Nicht `erstattet`: Der Hof entscheidet über den Rest (Postfach und Mail an den Hof).
    expect(db.widerruf.updateMany).not.toHaveBeenCalled()
    expect(db.unterhaltung.create).toHaveBeenCalledTimes(1)
    expect(auftraegeDer('widerruf-hof')).toHaveLength(1)
    expect(storniere).not.toHaveBeenCalled()
    // Kein Text, kein Name, keine Adresse an Sentry.
    expect(JSON.stringify(vi.mocked((await import('@sentry/nextjs')).captureException).mock.calls)).not.toContain(ADRESSE)
  })

  it('Gegenproben: scheitert schon die erste Position, keine Erstattungs-Mail; gehen alle durch, die gewohnte Mail ohne `teilweise`', async () => {
    vi.mocked(meldeFehlendenArtikel).mockResolvedValueOnce({ art: 'abgelehnt', grund: 'status' } as never)
    await verarbeiteWiderruf('widerruf-1', true)
    expect(meldeFehlendenArtikel).toHaveBeenCalledTimes(1)
    expect(auftraegeDer('widerruf-erstattet')).toHaveLength(0)
    expect(auftraegeDer('widerruf-hof')).toHaveLength(1)

    vi.mocked(stelleEinOhneRisiko).mockClear()
    vi.mocked(meldeFehlendenArtikel).mockReset()
    vi.mocked(meldeFehlendenArtikel).mockResolvedValueOnce(teil('online', 495) as never).mockResolvedValueOnce(teil('online', 1162) as never)
    await verarbeiteWiderruf('widerruf-1', true)
    const erstattet = auftraegeDer('widerruf-erstattet')
    expect(erstattet).toHaveLength(1)
    expect(erstattet[0]![2]).toEqual(expect.objectContaining({ schluessel: 'widerruf-erstattet:widerruf-1', bezug: { widerrufId: 'widerruf-1', erstattetCents: '1657', vorAbholung: '1' } }))
    expect(auftraegeDer('widerruf-hof')).toHaveLength(0)
  })

  it('vor Ort: teilweise ohne Betrag', async () => {
    vi.mocked(meldeFehlendenArtikel).mockResolvedValueOnce(teil('vor_ort', 0) as never).mockResolvedValueOnce({ art: 'abgelehnt', grund: 'status' } as never)
    await verarbeiteWiderruf('widerruf-1', true)
    const erstattet = auftraegeDer('widerruf-erstattet')
    expect(erstattet).toHaveLength(1)
    expect(erstattet[0]![2]).toEqual(expect.objectContaining({ bezug: { widerrufId: 'widerruf-1', vorAbholung: '1', teilweise: '1' } }))
  })
})

describe('Admin: Zuordnen (Nachbesserung Runde 2)', () => {
  const W_ID = 'cmfwiderruf00000000001ab'
  const BESTELLUNG = {
    id: 'bestellung-1',
    farmId: 'hof-1',
    orderNumber: 'HM-2611-TEST',
    kaeuferArt: 'PRIVAT',
    status: 'PICKED_UP',
    pickedUpAt: new Date(),
    farm: { name: 'Testhof' },
    items: [{ id: 'pos-a', productName: 'Eier', quantity: 1, fehltSeit: null }],
  }
  const W = { id: W_ID, orderId: 'bestellung-1', eingegangenAm: new Date(), email: ADRESSE, bestellnummerEingabe: 'HM-2611-TSET', umfang: 'ganz', positionen: null, nachricht: 'Bitte Eier zurück', stand: 'eingegangen' }

  beforeEach(() => {
    vi.mocked(verlangeFrischeBestaetigung).mockResolvedValue({ ok: true, userId: 'admin-1', sitzungId: 's-1', mitPasskey: true })
  })

  it('unbekannte Nummer → „Diese Bestellnummer gibt es nicht.“, nichts geändert; leere Nummer → Satz, ohne Abfrage', async () => {
    db.order.findUnique.mockResolvedValue(null as never)
    expect(await ordneWiderrufZu({ widerrufId: W_ID, bestellnummer: 'HM-0000-NEIN', grund: 'Anruf der Kundin' })).toEqual({ error: 'Diese Bestellnummer gibt es nicht.' })
    expect(db.widerruf.updateMany).not.toHaveBeenCalled()
    expect(protokolliere).not.toHaveBeenCalled()

    expect(await ordneWiderrufZu({ widerrufId: W_ID, bestellnummer: '  ', grund: 'Anruf der Kundin' })).toEqual({ error: WIDERRUF_ADMIN_TEXT.nummerFehlt })
    expect(db.order.findUnique).toHaveBeenCalledTimes(1)
    expect(verlangeFrischeBestaetigung).toHaveBeenCalledWith({ recht: 'hof_sperren_storno' })
  })

  it('Gegenprobe: passende Nummer → bedingt zugeordnet (orderId null in der WHERE-Klausel), Protokoll ohne Personendaten, weiter an den Hof; zweites Mal → schon zugeordnet', async () => {
    db.order.findUnique.mockResolvedValue(BESTELLUNG as never)
    db.widerruf.updateMany.mockResolvedValue({ count: 1 } as never)
    db.widerruf.findUnique.mockResolvedValue(W as never)
    expect(await ordneWiderrufZu({ widerrufId: W_ID, bestellnummer: 'hm-2611-test', grund: 'Anruf der Kundin' })).toEqual({ ok: true, weiter: 'hof' })
    expect(db.order.findUnique.mock.calls[0]![0]).toMatchObject({ where: { orderNumber: 'HM-2611-TEST' } })
    expect(db.widerruf.updateMany.mock.calls[0]![0]).toEqual({ where: { id: W_ID, orderId: null, stand: 'eingegangen' }, data: { orderId: 'bestellung-1' } })
    expect(protokolliere).toHaveBeenCalledWith({ wer: 'admin-1', art: 'widerruf_zugeordnet', bezugArt: 'bestellung', bezugId: 'bestellung-1', grund: 'Anruf der Kundin', mitPasskey: true })
    expect(JSON.stringify(vi.mocked(protokolliere).mock.calls)).not.toMatch(/Eier zurück|erfunden@/)
    // Keine zweite Eingangsbestätigung; nach der Abholung an den Hof.
    expect(sendWiderrufEingang).not.toHaveBeenCalled()
    expect(vi.mocked(stelleEinOhneRisiko).mock.calls.map((c) => c[0])).toEqual(['widerruf-hof'])

    db.widerruf.updateMany.mockResolvedValue({ count: 0 } as never)
    expect(await ordneWiderrufZu({ widerrufId: W_ID, bestellnummer: 'HM-2611-TEST', grund: 'Anruf der Kundin' })).toEqual({ error: WIDERRUF_ADMIN_TEXT.schonZugeordnet })
  })

  it('ohne frische Bestätigung → der Satz der Wache, keine Abfrage', async () => {
    vi.mocked(verlangeFrischeBestaetigung).mockResolvedValue({ error: 'frisch' } as never)
    expect(await ordneWiderrufZu({ widerrufId: W_ID, bestellnummer: 'HM-2611-TEST', grund: 'x' })).toEqual({ error: 'frisch' })
    expect(db.order.findUnique).not.toHaveBeenCalled()
  })
})

describe('Admin: Lesen (Nachbesserung Runde 2)', () => {
  it('ohne Bestellung: Name und eingegebene Nummer, E-Mail nur gekürzt; der Freitext nur als eigenes Feld (für den Dialog)', async () => {
    db.widerruf.findMany.mockResolvedValue([
      { id: 'w-1', name: 'Erika Test', email: ADRESSE, bestellnummerEingabe: 'HM-0000-X', eingegangenAm: new Date('2026-10-30T13:05:00Z'), umfang: 'teil', nachricht: 'Die Eier bitte' },
    ] as never)
    const [w] = await ladeWiderrufeOhneBestellung()
    expect(db.widerruf.findMany.mock.calls[0]![0]).toMatchObject({ where: { orderId: null, stand: 'eingegangen' } })
    expect(w).toMatchObject({ name: 'Erika Test', bestellnummerEingabe: 'HM-0000-X', eingegangenAm: '30. Oktober 2026, 14:05 Uhr', umfang: 'Einzelne Artikel (Freitext)', nachricht: 'Die Eier bitte' })
    // Gegenprobe: die volle Adresse steht nirgends in der Zeile.
    expect(w!.emailGekuerzt).not.toBe(ADRESSE)
    expect(JSON.stringify(w)).not.toContain(ADRESSE)
  })

  it('Bestellung: Umfang ohne Freitext (der steht nur in `nachricht`); Akte: weder Name noch Adresse noch Nachricht gelesen', async () => {
    db.widerruf.findMany.mockResolvedValueOnce([
      { id: 'w-1', stand: 'abgelehnt', eingegangenAm: new Date('2026-10-30T13:05:00Z'), umfang: 'teil', positionen: null, nachricht: 'Die Eier bitte', grund: 'verderblich' },
    ] as never)
    const [d] = await ladeWiderrufeZurBestellung('bestellung-1', [])
    expect(d).toMatchObject({ stand: 'abgelehnt', umfang: ['Einzelne Artikel (Freitext)'], nachricht: 'Die Eier bitte', grund: 'verderblich' })
    expect(d!.umfang.join(' ')).not.toContain('Eier')

    db.$queryRaw.mockResolvedValue([{ id: 'w-1' }] as never)
    db.widerruf.findMany.mockResolvedValueOnce([{ id: 'w-1', orderId: 'bestellung-1', stand: 'unbekannt', eingegangenAm: new Date(), umfang: 'ganz', positionen: null }] as never)
    db.order.findMany.mockResolvedValue([{ id: 'bestellung-1', orderNumber: 'HM-2611-TEST', items: [] }] as never)
    const [a] = await ladeWiderrufeDesHofs('hof-1')
    const select = (db.widerruf.findMany.mock.calls.at(-1)![0] as { select: Record<string, unknown> }).select
    expect(['name', 'email', 'nachricht'].filter((f) => f in select)).toEqual([])
    // Ein unbekannter Stand zählt als offen, nie still als erledigt.
    expect(a).toMatchObject({ bestellnummer: 'HM-2611-TEST', stand: 'eingegangen', umfang: ['Die ganze Bestellung'] })
    expect(db.order.findMany.mock.calls.at(-1)![0]).toMatchObject({ where: { farmId: 'hof-1' } })
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

  it('Nr. 214: mit Link nimmt der Hinweis je Position zuerst die Angabe des Hofs, sonst den Satz je Kategorie — beide Positionen bleiben wählbar', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'bestellung-1',
      orderNumber: 'HM-2611-TEST',
      customerName: 'Erika Test',
      kaeuferArt: 'PRIVAT',
      status: 'PICKED_UP',
      pickedUpAt: new Date(),
      farm: { name: 'Hof Test', ownerName: '', address: 'Feldweg 1', postalCode: '4910', city: 'Beispieldorf', phone: '', archivedAt: null, geschlossenAm: null, email: 'hof@example.com', owner: { email: 'inhaber@example.com' } },
      items: [
        { id: 'pos-a', productName: 'Honig', quantity: 1, fehltSeit: null, product: { category: 'HONIG', unit: 'STUECK', unitSize: null, keinRuecktritt: true } },
        { id: 'pos-b', productName: 'Honig klein', quantity: 1, fehltSeit: null, product: { category: 'HONIG', unit: 'STUECK', unitSize: null, keinRuecktritt: false } },
      ],
    } as never)
    const baum = await WiderrufPage({ searchParams: Promise.resolve({ bestellung: 'bestellung-1', sig: widerrufSignatur('bestellung-1') }) })
    const formular = findeElement(baum, WiderrufFormular)
    const positionen = (formular?.props.bestellung as { positionen: Array<{ id: string; hinweis: string }> }).positionen
    expect(positionen.map((p) => p.id)).toEqual(['pos-a', 'pos-b'])
    expect(positionen[0]!.hinweis).toBe(RUECKTRITT_TEXT.widerrufKeinRuecktritt)
    expect(positionen[1]!.hinweis).toBe(ausnahmeHinweis('HONIG'))
    expect(positionen[1]!.hinweis).toContain('wahrscheinlich möglich')
  })

  it('die Knöpfe heißen wörtlich „Vertrag widerrufen“ und „Widerruf bestätigen“', () => {
    const html = renderToStaticMarkup(createElement(WiderrufFormular, { bestellung: null }))
    expect(html).toContain('>Vertrag widerrufen</button>')
    // Schritt 2 rendert erst nach dem Klick — der Knopf nimmt die eine Quelle.
    const quelle = readFileSync('src/app/(public)/widerruf/widerruf-formular.tsx', 'utf8')
    expect(quelle).toContain('{WIDERRUF_TEXT.knopfBestaetigen}')
  })
})
