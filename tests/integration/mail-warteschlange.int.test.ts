/**
 * Die Mail-Warteschlange gegen ein ECHTES Postgres (Register N26, Nr. 158).
 * Resend ist eine Attrappe (kein Netz, keine echte Mail); die Aussage ist der
 * Zustand der Tabelle "MailAuftrag" danach und was die Attrappe bekam.
 *
 * Beweist, je mit Gegenprobe:
 *  - doppelter fachlicher Schlüssel → ein Auftrag
 *  - Wichtig vor Kann warten (im ersten Stapel)
 *  - 429 → neuer Versuch mit Abstand; nach 5 Wiederholungen gescheitert
 *  - 4xx → sofort gescheitert; eine kaputte Mail nimmt den Stapel nicht mit
 *  - zwei Worker gleichzeitig → jede Mail genau einmal (SKIP LOCKED + Sperre)
 *  - abgelaufene Belegung → neu geholt
 *  - Tageskontingent ab 70 % → Kann warten bleibt liegen, Wichtig geht
 *  - abgemeldetes Abo → verworfen (echter Renderer „beitrag“)
 *  - Post-Sperre (Z3) → gesperrt; ohne Schlüssel → ohne_schluessel, kein neuer Versuch
 *  - Fingerabdruck gesetzt (Worker und sendRaw), die Adresse in keiner Spalte
 *  - Last: 5.000 Kann warten + 20 Wichtig — Wichtig im ersten Stapel, keine doppelt, keine verloren
 *
 * Daten: Schlüssel und Bestellkennungen mit `int-`, Adressen @example.com
 * (erfunden); danach weg. Der Mail-Zähler des heutigen UTC-Tags wird vorher
 * gemerkt und danach wiederhergestellt.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { utcTagesbeginn } from '@/lib/betrieb'
import { empfaengerFingerabdruck } from '@/lib/mail-empfaenger'
import { VORRANG } from '@/schemas/mail-auftrag'
import type { RendererTabelle } from '@/server/mail-arten'
import { arbeiteWarteschlange, holeFaelligeSeite, stelleMailEin, type EinstellAuftrag } from '@/server/mail-warteschlange'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

type StapelPayload = Array<{ to: string; subject: string; html: string; headers?: Record<string, string> }>

const { batchMock, sendMock } = vi.hoisted(() => ({ batchMock: vi.fn(), sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
    batch = { send: batchMock }
  },
}))
// Der Worker nach dem Einstellen liefe sonst im Hintergrund mit den echten Renderern mit.
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

const OHNE_GRENZE = { mailsTag: null, mailsMonat: null }
/** Adressen aus dem Bezug — die Attrappe zeigt, welche Mail hinausging. */
const FAKE: RendererTabelle = {
  abholbereit: async (b) => ({ an: `${b.orderId}@example.com`, betreff: 'Abholbereit', html: '<p>abholbereit</p>' }),
  rundschreiben: async (b) => ({ an: b.fadenId.startsWith('int-gesperrt') ? `${b.fadenId}@example.org` : `${b.fadenId}@example.com`, betreff: 'Rundschreiben', html: '<p>rundschreiben</p>' }),
}

let zaehlerVorher: bigint | null = null
const heute = () => utcTagesbeginn(new Date())

function stapelOk(payload: StapelPayload) {
  return { data: { data: payload.map(() => ({ id: `int-re-${randomUUID()}` })) }, error: null, headers: null }
}

function wichtig(kennung: string): EinstellAuftrag {
  return { art: 'abholbereit', vorrang: VORRANG.wichtig, schluessel: `${kennung}:w`, bezug: { orderId: kennung }, bestellungId: kennung }
}

function kannWarten(kennung: string): EinstellAuftrag {
  return { art: 'rundschreiben', vorrang: VORRANG.kannWarten, schluessel: `${kennung}:k`, bezug: { fadenId: kennung } }
}

async function zeile(schluessel: string) {
  return prisma.mailAuftrag.findUniqueOrThrow({ where: { schluessel } })
}

function arbeite(teil: { abstandMs?: number; biszeitMs?: number; grenze?: { mailsTag: number | null; mailsMonat: number | null } } = {}) {
  return arbeiteWarteschlange({ biszeitMs: teil.biszeitMs ?? 20_000, renderer: FAKE, grenze: teil.grenze ?? OHNE_GRENZE, abstandMs: teil.abstandMs ?? 0 })
}

/** Alle Adressen, die die Attrappe in Stapeln bekam, in Reihenfolge. */
function gesendeteAdressen(): string[] {
  return batchMock.mock.calls.flatMap(([payload]) => (payload as StapelPayload).map((m) => m.to))
}

async function raeumeMailsAuf(): Promise<void> {
  await prisma.mailAuftrag.deleteMany({ where: { OR: [{ schluessel: { startsWith: 'int-' } }, { bestellungId: { startsWith: 'int-' } }] } })
}

beforeAll(async () => {
  await raeumeMailsAuf()
  const z = await prisma.betriebMessung.findUnique({ where: { tag_art: { tag: heute(), art: 'mails' } } })
  zaehlerVorher = z?.wert ?? null
})

afterEach(async () => {
  vi.clearAllMocks()
  batchMock.mockImplementation(async (payload: StapelPayload) => stapelOk(payload))
  await raeumeMailsAuf()
  await raeumeAuf()
  if (zaehlerVorher === null) await prisma.betriebMessung.deleteMany({ where: { tag: heute(), art: 'mails' } })
  else await prisma.betriebMessung.update({ where: { tag_art: { tag: heute(), art: 'mails' } }, data: { wert: zaehlerVorher } })
})

afterAll(async () => {
  await raeumeMailsAuf()
})

batchMock.mockImplementation(async (payload: StapelPayload) => stapelOk(payload))

describe('Einstellen', () => {
  it('doppelter Schlüssel → ein Auftrag; Gegenprobe: ein anderer Schlüssel ist ein zweiter', async () => {
    const k = intKennung('doppelt')
    expect(await stelleMailEin(wichtig(k))).toBe(1)
    expect(await stelleMailEin([wichtig(k), wichtig(k)])).toBe(0)
    expect(await prisma.mailAuftrag.count({ where: { schluessel: `${k}:w` } })).toBe(1)
    expect(await stelleMailEin(kannWarten(k))).toBe(1)
    expect(await prisma.mailAuftrag.count({ where: { schluessel: { startsWith: k } } })).toBe(2)
    const z = await zeile(`${k}:w`)
    expect(z).toMatchObject({ status: 'offen', vorrang: 1, versuche: 0, bestellungId: k, bezug: { orderId: k }, ausloeser: 'system', empfaengerHash: null })
  })
})

describe('Worker', () => {
  it('Wichtig vor Kann warten: der neuere wichtige Auftrag steht im ersten Stapel vor 100 älteren', async () => {
    const k = intKennung('vorrang')
    await stelleMailEin(Array.from({ length: 100 }, (_, i) => kannWarten(`${k}-${i}`)))
    await stelleMailEin(wichtig(`${k}-eilig`))
    await arbeite()
    const erster = (batchMock.mock.calls[0][0] as StapelPayload).map((m) => m.to)
    expect(erster).toHaveLength(100)
    expect(erster[0]).toBe(`${k}-eilig@example.com`)
    // Gegenprobe: der übrige Kann-warten-Auftrag geht im zweiten Stapel, keiner fehlt.
    expect(gesendeteAdressen()).toHaveLength(101)
    expect(await prisma.mailAuftrag.count({ where: { schluessel: { startsWith: k }, status: 'gesendet' } })).toBe(101)
  })

  it('429 → offen mit Abstand von 1 Minute; vor der Zeit nicht geholt; nach 5 Wiederholungen gescheitert', async () => {
    const k = intKennung('429')
    await stelleMailEin(wichtig(k))
    batchMock.mockResolvedValue({ data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' }, headers: null })
    const vorher = Date.now()
    await arbeite()
    let z = await zeile(`${k}:w`)
    expect(z).toMatchObject({ status: 'offen', versuche: 1, fehlerCode: 'rate_limit_exceeded', gesendetAm: null, belegtBis: null })
    expect(z.naechsterVersuchAm.getTime() - vorher).toBeGreaterThanOrEqual(59_000)
    expect(z.naechsterVersuchAm.getTime() - vorher).toBeLessThan(70_000)
    // Gegenprobe: vor dem nächsten Versuch holt der Worker ihn nicht.
    batchMock.mockClear()
    await arbeite()
    expect(batchMock).not.toHaveBeenCalled()
    // Nach der fünften Wiederholung (240 Minuten) gibt es keine sechste.
    await prisma.mailAuftrag.update({ where: { schluessel: `${k}:w` }, data: { versuche: 5, naechsterVersuchAm: new Date(Date.now() - 1_000) } })
    await arbeite()
    z = await zeile(`${k}:w`)
    expect(z).toMatchObject({ status: 'gescheitert', versuche: 6, fehlerCode: 'rate_limit_exceeded' })
  })

  it('4xx → sofort gescheitert; Gegenprobe: die übrigen Mails desselben Stapels gehen einzeln', async () => {
    const k = intKennung('4xx')
    await stelleMailEin([wichtig(`${k}-a`), wichtig(`${k}-kaputt`), wichtig(`${k}-b`)])
    batchMock.mockImplementation(async (payload: StapelPayload) =>
      payload.length > 1 || payload[0].to.includes('kaputt')
        ? { data: null, error: { name: 'validation_error', statusCode: 422, message: 'Invalid `to` field' }, headers: null }
        : stapelOk(payload)
    )
    await arbeite()
    expect(await zeile(`${k}-kaputt:w`)).toMatchObject({ status: 'gescheitert', versuche: 1, fehlerCode: 'validation_error', resendId: null })
    expect((await zeile(`${k}-a:w`)).status).toBe('gesendet')
    expect((await zeile(`${k}-b:w`)).status).toBe('gesendet')
    // Einzeln mit eigenem Idempotenz-Schlüssel je Auftrag, der Stapel mit einem für die ganze Anfrage.
    const schluessel = batchMock.mock.calls.map(([, optionen]) => (optionen as { idempotencyKey: string }).idempotencyKey)
    expect(schluessel[0]).toMatch(/^mail-stapel-[0-9a-f]{40}$/)
    expect(schluessel.slice(1).every((s) => /^mail-.+-0$/.test(s))).toBe(true)
  })

  it('zwei Worker gleichzeitig → jede Mail genau einmal', async () => {
    const k = intKennung('zwei')
    await stelleMailEin(Array.from({ length: 250 }, (_, i) => kannWarten(`${k}-${i}`)))
    const [a, b] = await Promise.all([arbeite(), arbeite()])
    expect(a.gesendet + b.gesendet).toBe(250)
    const adressen = gesendeteAdressen().filter((x) => x.startsWith(k))
    expect(adressen).toHaveLength(250)
    expect(new Set(adressen).size).toBe(250)
    const ids = await prisma.mailAuftrag.findMany({ where: { schluessel: { startsWith: k } }, select: { resendId: true, status: true } })
    expect(ids.every((z) => z.status === 'gesendet')).toBe(true)
    expect(new Set(ids.map((z) => z.resendId)).size).toBe(250)
  })

  it('zwei gleichzeitige Holungen bekommen nie dieselbe Zeile (SKIP LOCKED); Gegenprobe: danach ist nichts mehr fällig', async () => {
    const k = intKennung('holen')
    await stelleMailEin(Array.from({ length: 150 }, (_, i) => kannWarten(`${k}-${i}`)))
    const jetzt = new Date()
    const [a, b] = await Promise.all([holeFaelligeSeite(jetzt, true), holeFaelligeSeite(jetzt, true)])
    const eigene = (s: { id: string }[]) => s.map((z) => z.id)
    expect(a.length + b.length).toBe(150)
    expect(eigene(a).filter((id) => eigene(b).includes(id))).toEqual([])
    expect(await holeFaelligeSeite(jetzt, true)).toEqual([])
    expect(await prisma.mailAuftrag.count({ where: { schluessel: { startsWith: k }, status: 'in_arbeit', belegtBis: { gt: jetzt } } })).toBe(150)
  })

  it('abgelaufene Belegung → neu geholt; Gegenprobe: eine laufende Belegung bleibt liegen', async () => {
    const k = intKennung('belegt')
    await stelleMailEin([wichtig(`${k}-alt`), wichtig(`${k}-laeuft`)])
    await prisma.mailAuftrag.update({ where: { schluessel: `${k}-alt:w` }, data: { status: 'in_arbeit', belegtBis: new Date(Date.now() - 1_000) } })
    await prisma.mailAuftrag.update({ where: { schluessel: `${k}-laeuft:w` }, data: { status: 'in_arbeit', belegtBis: new Date(Date.now() + 60_000) } })
    await arbeite()
    expect((await zeile(`${k}-alt:w`)).status).toBe('gesendet')
    expect(await zeile(`${k}-laeuft:w`)).toMatchObject({ status: 'in_arbeit', gesendetAm: null })
  })

  it('Tageskontingent bei 70 %: Kann warten bleibt liegen, Wichtig geht; Gegenprobe bei 69 % gehen beide', async () => {
    const grenze = { mailsTag: 100, mailsMonat: null }
    const setzeZaehler = (wert: number) =>
      prisma.betriebMessung.upsert({
        where: { tag_art: { tag: heute(), art: 'mails' } },
        create: { tag: heute(), art: 'mails', wert },
        update: { wert },
      })
    const k = intKennung('kontingent')
    await setzeZaehler(70)
    await stelleMailEin([kannWarten(`${k}-1`), wichtig(`${k}-1`)])
    await arbeite({ grenze })
    expect((await zeile(`${k}-1:w`)).status).toBe('gesendet')
    expect((await zeile(`${k}-1:k`)).status).toBe('offen')

    await setzeZaehler(69)
    await arbeite({ grenze })
    expect((await zeile(`${k}-1:k`)).status).toBe('gesendet')
  })

  it('Post-Sperre (Z3) → gesperrt, ohne Versand; Gegenprobe: example.com geht', async () => {
    const k = intKennung('sperre')
    await stelleMailEin([kannWarten(`int-gesperrt-${k}`), kannWarten(`${k}-frei`)])
    await arbeite()
    const gesperrt = await zeile(`int-gesperrt-${k}:k`)
    expect(gesperrt).toMatchObject({ status: 'gesperrt', resendId: null, empfaengerHash: empfaengerFingerabdruck(`int-gesperrt-${k}@example.org`) })
    expect(gesendeteAdressen()).toEqual([`${k}-frei@example.com`])
  })

  it('Fingerabdruck gesetzt (Worker und sendRaw) — die Adresse steht in keiner Spalte; Gegenprobe über denselben Weg findet den Hash', async () => {
    const k = intKennung('hash')
    await stelleMailEin(wichtig(k))
    await arbeite()
    const adresse = `${k}@example.com`
    const ausWorker = await zeile(`${k}:w`)
    expect(ausWorker.empfaengerHash).toBe(empfaengerFingerabdruck(adresse))

    sendMock.mockResolvedValue({ data: { id: `int-re-${randomUUID()}` }, error: null })
    const { sendRaw } = await import('@/lib/email')
    const direkt = `${k}-direkt@example.com`
    expect((await sendRaw(direkt, 'Dein Code', '<p>x</p>', { art: 'bar-bestaetigungslink', bestellungId: `${k}-direkt` })).id).toBeDefined()
    const protokoll = await prisma.mailAuftrag.findFirstOrThrow({ where: { bestellungId: `${k}-direkt` } })
    expect(protokoll).toMatchObject({ vorrang: 0, art: 'bar-bestaetigungslink', status: 'gesendet', empfaengerHash: empfaengerFingerabdruck(direkt) })

    // Jede Spalte als Text: keine Zeile enthält eine der Adressen …
    const mitAdresse = (teil: string) =>
      prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "MailAuftrag" m WHERE m::text ILIKE ${`%${teil}%`}`
    expect(await mitAdresse(adresse)).toEqual([])
    expect(await mitAdresse(direkt)).toEqual([])
    expect(await mitAdresse('@example.com')).toEqual([])
    // … die Gegenprobe über dieselbe Abfrage findet den Fingerabdruck.
    expect((await mitAdresse(empfaengerFingerabdruck(direkt))).map((z) => z.id)).toEqual([protokoll.id])
  })
})

describe('Renderer „beitrag“ gegen die echte Datenbank', () => {
  it('abgemeldetes Abo → verworfen; Gegenprobe: das angemeldete bekommt die Mail mit Abmelde-Kopfzeilen', async () => {
    const { farm } = await erstelleHof()
    const ab = intKennung('abo-ab')
    const an = intKennung('abo-an')
    const abgemeldet = await prisma.customerFarmSubscription.create({ data: { customerEmail: `${ab}@example.com`, farmId: farm.id, optInEmail: false } })
    const angemeldet = await prisma.customerFarmSubscription.create({ data: { customerEmail: `${an}@example.com`, farmId: farm.id, optInEmail: true } })
    const post = await prisma.statusPost.create({ data: { farmId: farm.id, title: 'Frische Eier', body: 'Hallo {Vorname}!', publishedAt: new Date() } })
    const auftrag = (aboId: string): EinstellAuftrag => ({ art: 'beitrag', vorrang: VORRANG.kannWarten, schluessel: `int-beitrag:${post.id}:${aboId}`, bezug: { postId: post.id, aboId }, farmId: farm.id })
    await stelleMailEin([auftrag(abgemeldet.id), auftrag(angemeldet.id)])
    await arbeiteWarteschlange({ biszeitMs: 20_000, grenze: OHNE_GRENZE, abstandMs: 0 })
    expect(await zeile(`int-beitrag:${post.id}:${abgemeldet.id}`)).toMatchObject({ status: 'verworfen', fehlerCode: 'abo_abgemeldet', empfaengerHash: null })
    expect((await zeile(`int-beitrag:${post.id}:${angemeldet.id}`)).status).toBe('gesendet')
    const [mail] = batchMock.mock.calls.flatMap(([p]) => p as StapelPayload).filter((m) => m.to === `${an}@example.com`)
    expect(mail.subject).toBe(`${farm.name}: Frische Eier`)
    expect(Object.keys(mail.headers ?? {})).toEqual(expect.arrayContaining(['List-Unsubscribe', 'List-Unsubscribe-Post']))
  }, 60_000)
})

describe('Last', () => {
  it('5.000 Kann warten und 20 Wichtig: alle wichtigen im ersten Stapel, keine doppelt, keine verloren', async () => {
    const k = intKennung('last')
    const anlegenStart = Date.now()
    await stelleMailEin(Array.from({ length: 5_000 }, (_, i) => kannWarten(`${k}-k${i}`)))
    await stelleMailEin(Array.from({ length: 20 }, (_, i) => wichtig(`${k}-w${i}`)))
    const anlegenMs = Date.now() - anlegenStart

    const start = Date.now()
    let laeufe = 0
    while (laeufe < 5 && (await prisma.mailAuftrag.count({ where: { schluessel: { startsWith: k }, status: { not: 'gesendet' } } })) > 0) {
      await arbeite({ abstandMs: 200, biszeitMs: 50_000 })
      laeufe += 1
    }
    const dauerMs = Date.now() - start

    const erster = (batchMock.mock.calls[0][0] as StapelPayload).map((m) => m.to)
    expect(erster.slice(0, 20).every((a) => a.includes(`${k}-w`))).toBe(true)
    expect(batchMock.mock.calls.every(([p]) => (p as StapelPayload).length <= 100)).toBe(true)
    const adressen = gesendeteAdressen().filter((a) => a.startsWith(k))
    expect(adressen).toHaveLength(5_020)
    expect(new Set(adressen).size).toBe(5_020)
    expect(await prisma.mailAuftrag.count({ where: { schluessel: { startsWith: k }, status: 'gesendet' } })).toBe(5_020)

    // Messwerte für den Bericht (Nr. 158): Resend-Attrappe, 200 ms Abstand, echtes Postgres.
    // Direkt auf stdout: Die Integrationskonfiguration hält console.log zurück.
    process.stdout.write(
      `[Last] 5.020 Mails in ${(dauerMs / 1000).toFixed(1)} s (${laeufe} Lauf/Läufe, ${batchMock.mock.calls.length} Stapel) = ${Math.round(5_020 / (dauerMs / 1000))} Mails/s; Einstellen ${anlegenMs} ms\n`
    )
  }, 240_000)
})

describe('ohne Schlüssel', () => {
  it('→ ohne_schluessel und kein neuer Versuch; Gegenprobe: nichts ging an Resend', async () => {
    vi.resetModules()
    vi.stubEnv('RESEND_API_KEY', '')
    const frisch = await import('@/server/mail-warteschlange')
    const k = intKennung('ohne')
    await frisch.stelleMailEin(wichtig(k))
    await frisch.arbeiteWarteschlange({ biszeitMs: 10_000, renderer: FAKE, grenze: OHNE_GRENZE, abstandMs: 0 })
    expect(await zeile(`${k}:w`)).toMatchObject({ status: 'ohne_schluessel', versuche: 0, empfaengerHash: empfaengerFingerabdruck(`${k}@example.com`) })
    await frisch.arbeiteWarteschlange({ biszeitMs: 10_000, renderer: FAKE, grenze: OHNE_GRENZE, abstandMs: 0 })
    expect(await zeile(`${k}:w`)).toMatchObject({ status: 'ohne_schluessel', versuche: 0 })
    expect(batchMock).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  }, 60_000)
})
