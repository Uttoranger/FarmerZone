/**
 * Der Ein-Klick-Endpunkt `/api/abmelden` (RFC 8058, Nr. 47) — echter Handler,
 * echtes Token und echtes Zod, die Datenbank gemockt. Den Zustand danach in
 * einem echten Postgres prüft tests/integration/abmelden.int.test.ts.
 *
 * Beweist:
 *  - POST mit gültigem Token und „List-Unsubscribe=One-Click" meldet ab —
 *    ohne weitere Abfrage, ohne Sitzung, als Formular (urlencoded oder
 *    multipart). Die Antwort ist dieselbe, ob es ein Abo gab oder nicht.
 *  - Zweimal ist wie einmal (idempotent).
 *  - Ohne gültigen Token oder ohne den festen Inhalt: 400, nichts geschrieben.
 *  - GET ändert nie etwas (S2): weiter zur Seite mit dem Knopf.
 *  - Ein Datenbankfehler geht ohne Adresse und Token nach Sentry.
 *  - Gebremst mit eigener Grenze (EIN_KLICK_JE_MINUTE je IP), nicht mit der
 *    Vorgabe von 20 — die Aufrufe kommen von wenigen Mailanbieter-Servern.
 *  - Der Knopf auf der Seite (`unsubscribeWithToken`) antwortet auf einen
 *    ungültigen Link mit demselben Satz wie der Endpunkt.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { transaction, updateMany } = vi.hoisted(() => ({
  transaction: vi.fn(),
  updateMany: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: transaction, customerFarmSubscription: { updateMany } },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// Nur für den Import der Server Actions (unsubscribeWithToken braucht keins von beiden).
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))

import * as Sentry from '@sentry/nextjs'
import { GET, POST } from '@/app/api/abmelden/route'
import { generateUnsubscribeToken } from '@/lib/unsubscribe'
import { APP_URL } from '@/lib/umgebung-server'
import { ABMELDE_LINK_UNGUELTIG, EIN_KLICK_JE_MINUTE } from '@/lib/abmelde-link'
import { CHECKOUT_RESERVE_MAX_PER_WINDOW } from '@/lib/rate-limit'
import { unsubscribeWithToken } from '@/server/actions/subscriptions'

const EMAIL = 'kundin@example.com'
const HOF = 'farm-1'
const TOKEN = generateUnsubscribeToken(EMAIL, HOF)

function einKlick(token: string | null, inhalt: BodyInit | null = 'List-Unsubscribe=One-Click', art = 'application/x-www-form-urlencoded'): NextRequest {
  const adresse = new URL('http://localhost/api/abmelden')
  if (token !== null) adresse.searchParams.set('token', token)
  return new NextRequest(adresse, {
    method: 'POST',
    body: inhalt,
    headers: inhalt === null || inhalt instanceof FormData ? {} : { 'content-type': art },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  updateMany.mockImplementation((args: unknown) => ({ schritt: args }))
  transaction.mockResolvedValue([{ count: 0 }, { count: 1 }])
})

describe('POST — die Ein-Klick-Abmeldung des Mailprogramms', () => {
  it('meldet mit gültigem Token ab: offene Anfrage auflösen, dann E-Mail und WhatsApp aus — in einer Transaktion', async () => {
    const antwort = await POST(einKlick(TOKEN))

    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toEqual({ ok: true })
    expect(transaction).toHaveBeenCalledTimes(1)
    const schritte = transaction.mock.calls[0]![0] as { schritt: { where: unknown; data: unknown } }[]
    expect(schritte).toHaveLength(2)
    expect(schritte[0]!.schritt).toMatchObject({
      where: { customerEmail: EMAIL, farmId: HOF, emailOptInAngefragtAm: { not: null }, emailOptInBestaetigtAm: null },
      data: { optInEmail: false, emailOptInAngefragtAm: null },
    })
    expect(schritte[1]!.schritt).toEqual({ where: { customerEmail: EMAIL, farmId: HOF }, data: { optInEmail: false, optInWhatsApp: false } })
  })

  it('nimmt den Inhalt auch als multipart/form-data an (RFC 8058 empfiehlt das)', async () => {
    const formular = new FormData()
    formular.set('List-Unsubscribe', 'One-Click')
    const antwort = await POST(einKlick(TOKEN, formular))
    expect(antwort.status).toBe(200)
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  it('verrät nicht, ob es ein Abo gab: dieselbe Antwort, wenn nichts zu ändern war', async () => {
    transaction.mockResolvedValue([{ count: 0 }, { count: 0 }])
    const ohneAbo = await POST(einKlick(TOKEN))
    transaction.mockResolvedValue([{ count: 1 }, { count: 1 }])
    const mitAbo = await POST(einKlick(TOKEN))

    expect([ohneAbo.status, await ohneAbo.json()]).toEqual([mitAbo.status, await mitAbo.json()])
  })

  it('zweimal ist wie einmal', async () => {
    const erste = await POST(einKlick(TOKEN))
    const zweite = await POST(einKlick(TOKEN))
    expect([erste.status, zweite.status]).toEqual([200, 200])
    expect(transaction.mock.calls[0]).toEqual(transaction.mock.calls[1])
  })

  it.each([
    ['ohne Token', null],
    ['mit falscher Signatur', `${TOKEN.slice(0, -1)}0`],
    ['mit Unsinn', 'kein-token'],
    ['mit leerem Token', ''],
  ])('%s: 400 mit festem Satz, nichts geschrieben', async (_fall, token) => {
    const antwort = await POST(einKlick(token))
    expect(antwort.status).toBe(400)
    expect(await antwort.json()).toMatchObject({ error: ABMELDE_LINK_UNGUELTIG })
    expect(transaction).not.toHaveBeenCalled()
  })

  it.each([
    ['ohne Inhalt', null],
    ['mit falschem Wert', 'List-Unsubscribe=Ja'],
    ['als JSON statt als Formular', JSON.stringify({ 'List-Unsubscribe': 'One-Click' })],
  ])('%s: 400, nichts geschrieben — der feste Inhalt nach RFC 8058 ist Pflicht', async (_fall, inhalt) => {
    const antwort = await POST(einKlick(TOKEN, inhalt, inhalt?.startsWith('{') ? 'application/json' : 'application/x-www-form-urlencoded'))
    expect(antwort.status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('Datenbankfehler: 500, Sentry erfährt es ohne Adresse und ohne Token', async () => {
    const fehler = new Error(`Abo von ${EMAIL} nicht gefunden`)
    fehler.name = 'PrismaClientKnownRequestError'
    transaction.mockRejectedValue(fehler)

    const antwort = await POST(einKlick(TOKEN))

    expect(antwort.status).toBe(500)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [gemeldet, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, unknown]
    expect(gemeldet).not.toBe(fehler)
    expect(gemeldet.name).toBe('PrismaClientKnownRequestError')
    expect(JSON.stringify([gemeldet.message, kontext])).not.toMatch(new RegExp(`${EMAIL}|${TOKEN.slice(0, 20)}`))
  })

  it('ist gebremst — mit eigener Grenze je IP statt der Vorgabe (Nachbesserung 1)', async () => {
    expect(EIN_KLICK_JE_MINUTE).toBeGreaterThan(CHECKOUT_RESERVE_MAX_PER_WINDOW)
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const vonServer = (ip: string) => {
        const anfrage = einKlick(TOKEN)
        anfrage.headers.set('x-forwarded-for', ip)
        return POST(anfrage)
      }
      // Ein Mailanbieter-Server schickt viele Abmeldungen hintereinander:
      // Alle bis zur Grenze gehen durch, auch weit über 20.
      const status: number[] = []
      for (let i = 0; i < EIN_KLICK_JE_MINUTE; i++) status.push((await vonServer('198.51.100.20')).status)
      expect(new Set(status)).toEqual(new Set([200]))
      // Darüber: 429 — und ein anderer Server zählt für sich.
      const darueber = await vonServer('198.51.100.20')
      expect(darueber.status).toBe(429)
      expect(darueber.headers.get('retry-after')).toBe('60')
      expect((await vonServer('198.51.100.21')).status).toBe(200)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('die Bremse steht vor allem anderen im POST, mit der eigenen Grenze', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/app/api/abmelden/route.ts'), 'utf8')
    const post = quelle.slice(quelle.indexOf('export async function POST'))
    expect(post).toMatch(/^[^]*?\{\s*const gebremst = enforceRateLimit\('abmelden', request, null, \{ max: EIN_KLICK_JE_MINUTE \}\)/)
    expect(post.indexOf('enforceRateLimit(')).toBeLessThan(post.indexOf('safeParse('))
  })
})

describe('Der Knopf auf der Seite — unsubscribeWithToken', () => {
  it('ein ungültiger Link bekommt denselben Satz wie beim Endpunkt (mit Ausweg, ohne „abgelaufen"), nichts geschrieben', async () => {
    for (const falsch of [42, '', 'x'.repeat(1001), `${TOKEN}x`, null]) {
      expect(await unsubscribeWithToken(falsch), String(falsch).slice(0, 20)).toEqual({ error: ABMELDE_LINK_UNGUELTIG })
    }
    expect(ABMELDE_LINK_UNGUELTIG).not.toMatch(/abgelaufen/i)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ein gültiger Link meldet ab', async () => {
    expect(await unsubscribeWithToken(TOKEN)).toEqual({})
    expect(transaction).toHaveBeenCalledTimes(1)
  })
})

describe('GET — ändert nie etwas (S2)', () => {
  it('mit Token: weiter zur Seite mit dem Knopf, nichts geschrieben', async () => {
    const antwort = GET(new NextRequest(`http://localhost/api/abmelden?token=${TOKEN}`))
    expect(antwort.status).toBe(303)
    expect(antwort.headers.get('location')).toBe(`${APP_URL}/account/unsubscribe?token=${TOKEN}`)
    expect(transaction).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('ohne Token: zur Seite ohne Token (sie sagt „Ungültiger Link"), nichts geschrieben', async () => {
    const antwort = GET(new NextRequest('http://localhost/api/abmelden'))
    expect(antwort.status).toBe(303)
    expect(antwort.headers.get('location')).toBe(`${APP_URL}/account/unsubscribe`)
    expect(transaction).not.toHaveBeenCalled()
  })
})
