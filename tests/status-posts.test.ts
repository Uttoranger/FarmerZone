/**
 * Die Beitrags-Actions (src/server/actions/status-posts.ts, Nr. 32,
 * Morgenbericht Lauf 5 §5):
 *  - Zod an ALLEN Actions (Kennungen, Felder des Beitrags) — nichts
 *    Ungeprüftes geht in eine WHERE-Klausel oder die Datenbank.
 *  - „Geöffnet" je Person (Register W1, Nr. 66): EIN UPDATE mit
 *    array_remove/array_append ohne Lesen davor, Beitrag UND Abonnement über
 *    farmId in der WHERE-Klausel, keine Zahl aus dem Browser.
 *  - Besitz im selben Schreibvorgang: `updateMany`/`deleteMany` mit
 *    `{ id, farmId }` und `count` statt vorgelagertem `findFirst` und blindem
 *    `update`/`delete` per ID.
 *  - Nach außen nur Sätze für Menschen, nie `err.message`; Sentry bekommt einen
 *    festen Text und die Fehlerklasse, nie Titel, Text oder Adressen.
 *  - Deaktivieren und Löschen räumen auch die öffentliche Hofseite neu auf.
 *  - Verknüpfte Produkte nur vom eigenen Hof (Nr. 35): eine Abfrage mit
 *    `{ id: { in }, farmId }`; eine fremde oder unbekannte Kennung lehnt den
 *    ganzen Beitrag mit einem Satz ab, statt still etwas zu speichern.
 *  - Mails über die Warteschlange (Nr. 159): Die Action wartet auf keine Mail;
 *    Beitrag und je Abo ein Auftrag (Kann warten) entstehen in EINER
 *    Transaktion, `emailRecipientCount` ist die Zahl der Aufträge; die Sperre
 *    ist dieselbe Bedingung wie auf der Seite (mailSperreWo). Versand,
 *    Fehler je Mail und die Zahl der gesendeten prüfen
 *    tests/mail-warteschlange.test.ts und tests/mail-auftraege.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/server/bild-url', () => ({ BILD_NICHT_UEBERNOMMEN: 'Bild nicht übernommen', bildUrlErlaubt: vi.fn(async () => true) }))
vi.mock('@/server/mail-warteschlange', () => ({ stelleMailEin: vi.fn() }))
// Der Nachlauf wird gesammelt: Die Action selbst startet keinen (der Worker läuft nach dem Einstellen).
const { nachlauf } = vi.hoisted(() => ({ nachlauf: [] as (() => Promise<void>)[] }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: (aufgabe: () => Promise<void>) => void nachlauf.push(aufgabe) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    farm: { findUnique: vi.fn() },
    product: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    customerFarmSubscription: { findMany: vi.fn() },
    statusPost: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { type Prisma, StatusPostAnlass } from '@prisma/client'
import { revalidatePath, updateTag } from 'next/cache'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { NEUIGKEITEN_CACHE_TAG } from '@/lib/startseite-gestalten'
import * as Sentry from '@sentry/nextjs'
import { deleteStatusPost, expireStatusPost, publishStatusPost, setzeWhatsAppGetippt } from '@/server/actions/status-posts'
import { BEITRAG_PRODUKT_FREMD, STATUS_POST_ANLASS_VALUES } from '@/schemas/status-post'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { stelleMailEin } from '@/server/mail-warteschlange'
import { mailSperreWo } from '@/lib/beitrag-mailabstand'

const HOF = { id: 'farm_1', name: 'Testhof', slug: 'testhof', logoUrl: null }
const sp = vi.mocked(prisma.statusPost)
const roh = vi.mocked(prisma.$queryRaw)
/** Prisma-Kennungen (cuid) wie in der Datenbank. */
const POST = 'cbeitrag0000000000000001'
const ABO = 'cabo00000000000000000001'
/** Der Fehlersatz einer Antwort — gleich, welche Form die Erfolgsantwort hat. */
const fehlerVon = (antwort: object): string | undefined => ('error' in antwort ? (antwort.error as string | undefined) : undefined)

const beitrag = (mehr: Record<string, unknown> = {}) => ({
  title: 'Neue Eier',
  body: 'Frisch gelegt.',
  anlass: 'FRESH_PRODUCT',
  showOnFarmPage: true,
  sendEmail: false,
  ...mehr,
})

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.length = 0
  vi.mocked(stelleMailEin).mockImplementation(async (a) => (Array.isArray(a) ? a.length : 1))
  // Die Transaktion arbeitet auf denselben Attrappen.
  vi.mocked(prisma.$transaction).mockImplementation((async (arbeit: (tx: typeof prisma) => Promise<unknown>) => arbeit(prisma)) as never)
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(getFarmForUser).mockResolvedValue(HOF as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({ slug: 'testhof', name: 'Testhof' } as never)
  sp.create.mockResolvedValue({ id: 'post_1', farmId: 'farm_1' } as never)
  sp.updateMany.mockResolvedValue({ count: 1 } as never)
  sp.deleteMany.mockResolvedValue({ count: 1 } as never)
})

describe('Zwischenspeicher: Marke auf /hoefe und „Neu bei den Höfen“ (Nr. 129, N22/N16)', () => {
  // Der Mock zählt: Jede der drei Aktionen leert BEIDE Etiketten genau einmal — sonst stünde die Marke bis zu fünf Minuten falsch.
  const etiketten = (): string[] => vi.mocked(updateTag).mock.calls.map(([tag]) => tag).sort()
  const beide = [HOEFE_CACHE_TAG, NEUIGKEITEN_CACHE_TAG].sort()

  it('Veröffentlichen leert die Hofliste und „Neu bei den Höfen“', async () => {
    expect((await publishStatusPost(beitrag() as never)).postId).toBe('post_1')
    expect(etiketten()).toEqual(beide)
  })

  it('Deaktivieren leert beide — die Marke geht ohne Warten', async () => {
    expect(await expireStatusPost('post_1')).toEqual({})
    expect(etiketten()).toEqual(beide)
  })

  it('Löschen leert beide', async () => {
    expect(await deleteStatusPost('post_1')).toEqual({})
    expect(etiketten()).toEqual(beide)
  })

  it('Gegenprobe: ohne Treffer (fremder Beitrag) und mit ungültiger Eingabe bleibt der Speicher', async () => {
    sp.updateMany.mockResolvedValue({ count: 0 } as never)
    sp.deleteMany.mockResolvedValue({ count: 0 } as never)
    await expireStatusPost('post_fremd')
    await deleteStatusPost('post_fremd')
    await publishStatusPost(beitrag({ title: '' }) as never)
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('Anlässe', () => {
  it('die Liste im Schema entspricht dem Enum der Datenbank', () => {
    expect([...STATUS_POST_ANLASS_VALUES].sort()).toEqual(Object.values(StatusPostAnlass).sort())
  })
})

describe('expireStatusPost — Besitz im selben Schreibvorgang', () => {
  it('deaktiviert per updateMany mit id UND farmId, kein vorgelagertes findFirst', async () => {
    expect(await expireStatusPost('post_1')).toEqual({})
    expect(sp.updateMany).toHaveBeenCalledWith({
      where: { id: 'post_1', farmId: 'farm_1' },
      data: { expiresAt: expect.any(Date) },
    })
    expect(sp.findFirst).not.toHaveBeenCalled()
    expect(sp.update).not.toHaveBeenCalled()
  })

  it('fremder oder verschwundener Beitrag (count 0) → Satz, keine Änderung anderswo', async () => {
    sp.updateMany.mockResolvedValue({ count: 0 } as never)
    const antwort = await expireStatusPost('post_fremd')
    expect(antwort.error).toBe('Diesen Beitrag gibt es nicht mehr. Lade die Seite neu.')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('räumt den Reiter und die öffentliche Hofseite neu auf', async () => {
    await expireStatusPost('post_1')
    expect(revalidatePath).toHaveBeenCalledWith('/farm-page')
    expect(revalidatePath).toHaveBeenCalledWith('/testhof')
  })

  it.each([[''], ['x'.repeat(65)], [42], [null], [{ id: 'post_1' }]])('ungültige Kennung %j → abgelehnt, nichts geschrieben', async (id) => {
    const antwort = await expireStatusPost(id as never)
    expect(antwort.error).toBeTruthy()
    expect(sp.updateMany).not.toHaveBeenCalled()
  })
})

describe('deleteStatusPost — Besitz im selben Schreibvorgang', () => {
  it('löscht per deleteMany mit id UND farmId, kein vorgelagertes findFirst', async () => {
    expect(await deleteStatusPost('post_1')).toEqual({})
    expect(sp.deleteMany).toHaveBeenCalledWith({ where: { id: 'post_1', farmId: 'farm_1' } })
    expect(sp.findFirst).not.toHaveBeenCalled()
    expect(sp.delete).not.toHaveBeenCalled()
  })

  it('fremder Beitrag (count 0) → Satz', async () => {
    sp.deleteMany.mockResolvedValue({ count: 0 } as never)
    expect((await deleteStatusPost('post_fremd')).error).toBe('Diesen Beitrag gibt es nicht mehr. Lade die Seite neu.')
  })

  it('räumt den Reiter und die öffentliche Hofseite neu auf', async () => {
    await deleteStatusPost('post_1')
    expect(revalidatePath).toHaveBeenCalledWith('/farm-page')
    expect(revalidatePath).toHaveBeenCalledWith('/testhof')
  })

  it('ungültige Kennung → abgelehnt, nichts gelöscht', async () => {
    expect((await deleteStatusPost('' as never)).error).toBeTruthy()
    expect(sp.deleteMany).not.toHaveBeenCalled()
  })
})

describe('setzeWhatsAppGetippt — eine Anweisung, Besitz in der WHERE-Klausel (W1)', () => {
  /** Die eine Abfrage an die Datenbank, Leerraum zusammengezogen. */
  const abfrage = () => {
    const sql = roh.mock.calls[0]?.[0] as unknown as Prisma.Sql
    return { text: sql.text.replace(/\s+/g, ' '), values: sql.values }
  }

  it('geöffnet: EIN UPDATE mit array_remove + array_append, Zähler gleich der Länge, Liste der Datenbank zurück', async () => {
    roh.mockResolvedValue([{ whatsappGetippt: ['cabo00000000000000000009', ABO] }] as never)

    expect(await setzeWhatsAppGetippt(POST, ABO, true)).toEqual({ ok: true, getippt: ['cabo00000000000000000009', ABO] })

    expect(roh).toHaveBeenCalledTimes(1)
    const { text, values } = abfrage()
    expect(text).toContain('UPDATE "StatusPost" SET "whatsappGetippt" = array_append(array_remove(COALESCE("whatsappGetippt", ARRAY[]::TEXT[])')
    expect(text).toContain('"whatsappSentCount" = cardinality(array_append(array_remove(')
    expect(text).toContain('RETURNING "whatsappGetippt"')
    expect(values).toEqual([ABO, ABO, ABO, ABO, POST, 'farm_1', ABO, 'farm_1'])
    // Kein Lesen davor und kein Schreiben einer Zahl aus dem Browser.
    expect(sp.findFirst).not.toHaveBeenCalled()
    expect(sp.updateMany).not.toHaveBeenCalled()
  })

  it('Besitz in derselben Anweisung: der Beitrag über id UND farmId, das Abonnement über farmId und dieselbe Regel wie die Liste', async () => {
    roh.mockResolvedValue([{ whatsappGetippt: [ABO] }] as never)
    await setzeWhatsAppGetippt(POST, ABO, true)
    // Nr. 75 (c): WhatsApp-Häkchen und eine Nummer, die nicht leer ist — wie whatsAppAbonnentinnen.
    expect(abfrage().text).toMatch(
      /WHERE "id" = \$5 AND "farmId" = \$6 AND EXISTS \(SELECT 1 FROM "CustomerFarmSubscription" WHERE "id" = \$7 AND "farmId" = \$8 AND "optInWhatsApp" = true AND "customerPhone" IS NOT NULL AND "customerPhone" <> ''\)/
    )
  })

  it('nach dem Setzen bauen Reiter „Beiträge" und Tipp-Liste neu auf — ohne Treffer nicht', async () => {
    roh.mockResolvedValue([{ whatsappGetippt: [ABO] }] as never)
    await setzeWhatsAppGetippt(POST, ABO, true)
    expect(revalidatePath).toHaveBeenCalledWith('/farm-page')
    expect(revalidatePath).toHaveBeenCalledWith('/status', 'layout')

    vi.mocked(revalidatePath).mockClear()
    roh.mockResolvedValue([] as never)
    sp.count.mockResolvedValue(1 as never)
    await setzeWhatsAppGetippt(POST, ABO, true)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('zurücksetzen: nur array_remove, ebenfalls eine Anweisung', async () => {
    roh.mockResolvedValue([{ whatsappGetippt: [] }] as never)

    expect(await setzeWhatsAppGetippt(POST, ABO, false)).toEqual({ ok: true, getippt: [] })

    const { text, values } = abfrage()
    expect(text).not.toContain('array_append')
    expect(text).toContain('"whatsappSentCount" = cardinality(array_remove(')
    expect(values).toEqual([ABO, ABO, POST, 'farm_1', ABO, 'farm_1'])
  })

  it('fremde Abonnements-ID: nichts getroffen → Satz zur Person', async () => {
    roh.mockResolvedValue([] as never)
    sp.count.mockResolvedValue(1 as never)

    expect(await setzeWhatsAppGetippt(POST, ABO, true)).toEqual({
      error: 'Diese Person bekommt deine WhatsApp-Nachrichten nicht mehr. Lade die Seite neu.',
    })
    expect(sp.count).toHaveBeenCalledWith({ where: { id: POST, farmId: 'farm_1' } })
  })

  it('fremder Beitrag: nichts getroffen → Satz zum Beitrag', async () => {
    roh.mockResolvedValue([] as never)
    sp.count.mockResolvedValue(0 as never)
    expect(await setzeWhatsAppGetippt(POST, ABO, false)).toEqual({ error: 'Diesen Beitrag gibt es nicht mehr. Lade die Seite neu.' })
  })

  it.each([
    ['post_1', ABO, true],
    [POST, 'abo-1', true],
    [POST, '', false],
    [123, ABO, true],
    [POST, ABO, 'ja'],
    [POST, ABO, 1],
  ])('ungültige Eingabe (%j, %j, %j) → abgelehnt, nichts geschrieben', async (beitrag, abo, geoeffnet) => {
    expect(await setzeWhatsAppGetippt(beitrag as never, abo as never, geoeffnet as never)).toEqual({
      error: 'Da stimmt etwas mit dem Beitrag nicht. Lade die Seite neu und versuch es noch einmal.',
    })
    expect(roh).not.toHaveBeenCalled()
  })

  it('angemeldet ohne Hof (etwa eine Kundin) → Satz zum Neu-Anmelden, nichts geschrieben', async () => {
    vi.mocked(getFarmForUser).mockResolvedValue(null as never)
    expect(await setzeWhatsAppGetippt(POST, ABO, true)).toEqual({ error: 'Bitte melde dich neu an.' })
    expect(roh).not.toHaveBeenCalled()
  })
})

describe('publishStatusPost — Zod', () => {
  it('Gegenprobe: ein gültiger Beitrag geht durch (getrimmt)', async () => {
    const antwort = await publishStatusPost(beitrag({ title: '  Neue Eier  ' }) as never)
    expect(antwort.postId).toBe('post_1')
    expect(sp.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: 'Neue Eier', farmId: 'farm_1' }) }))
  })

  it.each([
    ['leerer Titel', { title: '   ' }],
    ['leerer Text', { body: '' }],
    ['unbekannter Anlass', { anlass: 'WERBUNG' }],
    ['Titel zu lang', { title: 'x'.repeat(201) }],
    ['Text zu lang', { body: 'x'.repeat(5001) }],
    ['Haken kein Wahrheitswert', { sendEmail: 'ja' }],
    ['Produktliste kein Array', { linkedProductIds: 'p1' }],
    ['Produkt-ID leer', { linkedProductIds: [''] }],
    ['Bild-Adresse keine Zeichenkette', { photoUrl: 42 }],
  ])('%s → Satz, nichts angelegt', async (_fall, mehr) => {
    const antwort = await publishStatusPost(beitrag(mehr) as never)
    expect(antwort.error).toBeTruthy()
    expect(antwort.postId).toBeUndefined()
    expect(sp.create).not.toHaveBeenCalled()
  })

  // Nachbesserung Runde 1: Felder ohne eigene Meldung gaben den englischen
  // Zod-Text weiter („Invalid input: expected boolean …").
  it.each([
    ['Haken kein Wahrheitswert', { sendEmail: 'ja' }],
    ['Produktliste kein Array', { linkedProductIds: 'p1' }],
    ['Produkt-ID leer', { linkedProductIds: [''] }],
    ['zu viele Produkte', { linkedProductIds: Array.from({ length: 501 }, (_, i) => `p${i}`) }],
    ['Bild-Adresse keine Zeichenkette', { photoUrl: 42 }],
    ['Bild-Adresse zu lang', { photoUrl: 'x'.repeat(2049) }],
    ['Titel keine Zeichenkette', { title: 42 }],
    ['Text keine Zeichenkette', { body: null }],
  ])('%s → deutscher Satz, kein Zod-Text', async (_fall, mehr) => {
    const antwort = await publishStatusPost(beitrag(mehr) as never)
    expect(antwort.error).toBeTruthy()
    expect(antwort.error).not.toMatch(/Invalid|expected|received|Too (big|small)/i)
    expect(antwort.error).toMatch(/[äöüß]|Beitrag|Titel|Text/)
  })

  it('Gegenprobe: Titel, Text und Anlass behalten ihren eigenen Satz', async () => {
    expect((await publishStatusPost(beitrag({ title: ' ' }) as never)).error).toBe('Gib deinem Beitrag einen Titel.')
    expect((await publishStatusPost(beitrag({ body: '' }) as never)).error).toBe('Schreib ein paar Worte zu deinem Beitrag.')
    expect((await publishStatusPost(beitrag({ anlass: 'X' }) as never)).error).toBe('Wähle einen Anlass für deinen Beitrag.')
  })

  it('kein Objekt → Satz statt Absturz', async () => {
    expect((await publishStatusPost(null as never)).error).toBe('Da stimmt etwas mit dem Beitrag nicht. Lade die Seite neu und versuch es noch einmal.')
  })
})

describe('publishStatusPost — kein WhatsApp-Häkchen mehr (Register T5, Nr. 67)', () => {
  it('ein mitgeschicktes sendWhatsApp verwirft das Schema: keine Abonnentinnen-Abfrage, nichts eingefroren', async () => {
    const antwort = await publishStatusPost(beitrag({ sendWhatsApp: true }) as never)
    expect(antwort).toEqual({ postId: 'post_1', emailCount: 0 })
    expect(prisma.customerFarmSubscription.findMany).not.toHaveBeenCalled()
    // W1: Die Tipp-Liste liest die Abonnentinnen beim Öffnen — beim Veröffentlichen wird nichts gesetzt.
    const daten = sp.create.mock.calls[0][0].data
    expect(daten).not.toHaveProperty('sentViaWhatsApp')
    expect(daten).not.toHaveProperty('whatsappRecipientCount')
  })
})

describe('Fehler nach außen: nie err.message, Sentry ohne Inhalte', () => {
  const INTERN = 'Invalid `prisma.statusPost.create()` invocation: title "Geheimer Titel" kundin@example.com'

  it('publishStatusPost: unerwarteter Fehler → Satz, Sentry mit festem Text', async () => {
    sp.create.mockRejectedValue(Object.assign(new Error(INTERN), { name: 'PrismaClientKnownRequestError', code: 'P2000' }))
    const antwort = await publishStatusPost(beitrag({ title: 'Geheimer Titel' }) as never)

    expect(antwort.error).toBe('Wir konnten den Beitrag gerade nicht veröffentlichen. Bitte versuch es noch einmal.')
    expect(JSON.stringify(antwort)).not.toContain('prisma')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const gemeldet = JSON.stringify([
      (vi.mocked(Sentry.captureException).mock.calls[0]?.[0] as Error).message,
      vi.mocked(Sentry.captureException).mock.calls[0]?.[1],
    ])
    expect(gemeldet).not.toContain('Geheimer Titel')
    expect(gemeldet).not.toContain('example.com')
  })

  it.each([
    ['expireStatusPost', () => expireStatusPost('post_1'), () => sp.updateMany],
    ['deleteStatusPost', () => deleteStatusPost('post_1'), () => sp.deleteMany],
    ['setzeWhatsAppGetippt', () => setzeWhatsAppGetippt(POST, ABO, true), () => roh],
  ] as const)('%s: unerwarteter Fehler → Satz, kein interner Text', async (_name, aufruf, schreiben) => {
    schreiben().mockRejectedValue(new Error(INTERN) as never)
    const fehler = fehlerVon(await aufruf())
    expect(fehler).toBeTruthy()
    expect(fehler).not.toContain('prisma')
    expect(fehler).not.toContain('Geheimer')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect((vi.mocked(Sentry.captureException).mock.calls[0]?.[0] as Error).message).not.toContain('Geheimer')
  })

  it('ohne Anmeldung → Satz zum Neu-Anmelden, nichts geschrieben, kein Sentry', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    for (const antwort of [
      await expireStatusPost('post_1'),
      await deleteStatusPost('post_1'),
      await setzeWhatsAppGetippt(POST, ABO, true),
      await publishStatusPost(beitrag() as never),
    ]) {
      expect(fehlerVon(antwort)).toBe('Bitte melde dich neu an.')
    }
    expect(roh).not.toHaveBeenCalled()
    expect(sp.updateMany).not.toHaveBeenCalled()
    expect(sp.deleteMany).not.toHaveBeenCalled()
    expect(sp.create).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

describe('publishStatusPost — verknüpfte Produkte nur vom eigenen Hof', () => {
  const produkte = vi.mocked(prisma.product.findMany)

  it('eigene Produkte: eine Abfrage mit id in … UND farmId, dann gespeichert', async () => {
    produkte.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }] as never)
    const antwort = await publishStatusPost(beitrag({ linkedProductIds: ['p1', 'p2'] }) as never)
    expect(antwort.error).toBeUndefined()
    expect(produkte).toHaveBeenCalledTimes(1)
    expect(produkte).toHaveBeenCalledWith({ where: { id: { in: ['p1', 'p2'] }, farmId: 'farm_1' }, select: { id: true } })
    expect(sp.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ linkedProductIds: ['p1', 'p2'] }) }))
  })

  it('ein fremdes oder unbekanntes Produkt: Satz, nichts angelegt, kein Versand', async () => {
    // Die Abfrage mit farmId findet nur p1 — p_fremd gehört einem anderen Hof oder gibt es nicht.
    produkte.mockResolvedValue([{ id: 'p1' }] as never)
    const antwort = await publishStatusPost(beitrag({ linkedProductIds: ['p1', 'p_fremd'], sendEmail: true }) as never)
    expect(antwort.error).toBe(BEITRAG_PRODUKT_FREMD)
    expect(antwort.postId).toBeUndefined()
    expect(sp.create).not.toHaveBeenCalled()
    expect(prisma.customerFarmSubscription.findMany).not.toHaveBeenCalled()
  })

  it('doppelte Kennung zählt einmal (sonst wäre ein eigenes Produkt zweimal „fremd")', async () => {
    produkte.mockResolvedValue([{ id: 'p1' }] as never)
    const antwort = await publishStatusPost(beitrag({ linkedProductIds: ['p1', 'p1'] }) as never)
    expect(antwort.error).toBeUndefined()
    expect(produkte).toHaveBeenCalledWith({ where: { id: { in: ['p1'] }, farmId: 'farm_1' }, select: { id: true } })
    expect(sp.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ linkedProductIds: ['p1'] }) }))
  })

  it('ohne Produkte: keine Abfrage, leere Liste gespeichert', async () => {
    await publishStatusPost(beitrag() as never)
    await publishStatusPost(beitrag({ linkedProductIds: [] }) as never)
    expect(produkte).not.toHaveBeenCalled()
    expect(sp.create).toHaveBeenCalledTimes(2)
    expect(sp.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ linkedProductIds: [] }) }))
  })

  it('der Satz ist deutsch, geduzt und nennt den Ausweg', () => {
    expect(BEITRAG_PRODUKT_FREMD).toMatch(/Produkt/)
    expect(BEITRAG_PRODUKT_FREMD).toMatch(/Lade die Seite neu/)
    expect(BEITRAG_PRODUKT_FREMD).not.toMatch(/ID|farmId|Invalid/)
  })
})

describe('publishStatusPost — Mails über die Warteschlange (Nr. 159)', () => {
  const JETZT = new Date('2026-10-23T08:00:00.000Z')
  const abos = (anzahl: number) =>
    vi.mocked(prisma.customerFarmSubscription.findMany).mockResolvedValue(Array.from({ length: anzahl }, (_, i) => ({ id: `cabo${String(i).padStart(20, '0')}` })) as never)

  beforeEach(() => {
    vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
    sp.findFirst.mockResolvedValue(null as never)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('je Abo ein Auftrag „beitrag" (Kann warten) in DERSELBEN Transaktion wie der Beitrag; Antwort mit der Zahl der Aufträge', async () => {
    abos(3)

    const antwort = await publishStatusPost(beitrag({ sendEmail: true }) as never)

    expect(antwort).toEqual({ postId: 'post_1', emailCount: 3 })
    expect(sp.create.mock.calls[0]![0].data).toMatchObject({ sentViaEmail: true, emailRecipientCount: 3 })
    expect(stelleMailEin).toHaveBeenCalledTimes(1)
    const [auftraege, tx] = vi.mocked(stelleMailEin).mock.calls[0]!
    expect(tx).toBe(prisma)
    expect(auftraege).toEqual(
      [0, 1, 2].map((i) => {
        const aboId = `cabo${String(i).padStart(20, '0')}`
        return { art: 'beitrag', vorrang: 2, schluessel: `beitrag:post_1:${aboId}`, bezug: { postId: 'post_1', aboId }, farmId: 'farm_1' }
      })
    )
    // Nur Bestand und bestätigte Anmeldungen, nur die Kennung — keine Adresse in der Warteschlange.
    expect(vi.mocked(prisma.customerFarmSubscription.findMany).mock.calls[0]![0]).toMatchObject({ select: { id: true } })
    expect(nachlauf).toHaveLength(0)
  })

  it('1.000 Abos → 1.000 Aufträge in EINEM Aufruf, die Action wartet auf keine Mail', async () => {
    abos(1000)
    expect(await publishStatusPost(beitrag({ sendEmail: true }) as never)).toEqual({ postId: 'post_1', emailCount: 1000 })
    expect(stelleMailEin).toHaveBeenCalledTimes(1)
    expect(vi.mocked(stelleMailEin).mock.calls[0]![0]).toHaveLength(1000)
    expect(nachlauf).toHaveLength(0)
  })

  it('scheitert das Einstellen, gibt es auch keinen Beitrag (eine Transaktion) — Satz, Sentry ohne Inhalte', async () => {
    abos(2)
    vi.mocked(stelleMailEin).mockRejectedValueOnce(new Error('DB weg'))
    const antwort = await publishStatusPost(beitrag({ sendEmail: true, title: 'Geheimer Titel' }) as never)
    expect(antwort.error).toBe('Wir konnten den Beitrag gerade nicht veröffentlichen. Bitte versuch es noch einmal.')
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)).not.toContain('Geheimer')
  })

  it('ohne Haken: kein Auftrag, keine Abo-Abfrage', async () => {
    await publishStatusPost(beitrag() as never)
    expect(stelleMailEin).not.toHaveBeenCalled()
    expect(prisma.customerFarmSubscription.findMany).not.toHaveBeenCalled()
  })

  it('die Sperre fragt mailSperreWo mit dem Zeitpunkt der Anfrage — dieselbe Bedingung wie die Seite', async () => {
    abos(1)
    await publishStatusPost(beitrag({ sendEmail: true }) as never)
    expect(sp.findFirst.mock.calls[0]![0]).toMatchObject({ where: mailSperreWo(HOF.id, JETZT) })
  })

  it('Gegenprobe: greift die Sperre, keine Abonnentinnen-Abfrage, kein Auftrag, 0 am Beitrag', async () => {
    abos(1)
    sp.findFirst.mockResolvedValue({ id: 'frueher' } as never)

    expect(await publishStatusPost(beitrag({ sendEmail: true }) as never)).toEqual({ postId: 'post_1', emailCount: 0 })

    expect(prisma.customerFarmSubscription.findMany).not.toHaveBeenCalled()
    expect(stelleMailEin).not.toHaveBeenCalled()
    expect(sp.create.mock.calls[0]![0].data).toMatchObject({ sentViaEmail: false, emailRecipientCount: 0 })
  })
})
