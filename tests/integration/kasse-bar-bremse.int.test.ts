/**
 * Integrationstest — Nr. 287: Bremse für Bar-Bestellungen (Missbrauchsschutz M5).
 *
 * Eine Bar-Bestellung schickt sofort zwei Mails (an die eingegebene Adresse und
 * an den Hof) und hält Ware bis zu zwei Stunden. Deshalb, nur in Produktion
 * und nur bar, nach dem Abgleich des Gesamtbetrags und vor der Transaktion:
 *  a) je Adresse höchstens 3 unbestätigte Bar-Bestellungen gleichzeitig,
 *  b) je IP höchstens 10 neue Bar-Bestellungen je Stunde (über alle Instanzen),
 *  c) je Hof höchstens 15 unbestätigte (Startsatz „Bremse je Hof für
 *     Bar-Bestellungen freigegeben“, Abschnitt A: ja).
 * Gebremst heißt: 429, keine Bestellung, kein Vorrat, keine Mail. Online ist nie
 * betroffen; eine Wiederholung mit bekanntem Schlüssel bekommt ihre Bestellung;
 * scheitert die Zählung, geht die Bestellung durch (fail-open, Register R1).
 *
 * In Produktion zählen auch die Bremsen des Checkouts (20 je Minute) in der
 * Tabelle — jeder Fall nimmt deshalb eigene IP-Adressen (192.0.2.x, nur für
 * Dokumentation reserviert) und räumt seine Zeilen in `RateLimitZaehler` weg.
 * Die Datei berührt Better Auth nicht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
// Der Nachlauf (Mail) wird gesammelt und nie gestartet: Seine Zahl ist die Zahl der Mails, die eine Bestellung auslöst.
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() } },
}))

import * as Sentry from '@sentry/nextjs'
import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'
import { BAR_UNBESTAETIGT_JE_HOF, DB_BREMSEN, bremsSchluessel } from '@/lib/bremse-datenbank'
import { zaehleVersuche } from '@/server/bremse-datenbank'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

const SATZ = 'Bar bestellen geht gerade nicht. Bitte versuch es später noch einmal.'
const SATZ_ONLINE = 'Bar bestellen geht gerade nicht. Bezahl online oder versuch es später noch einmal.'

/** Die Zeilen, die dieser Lauf in `RateLimitZaehler` hinterlässt — Schlüssel aus IP bzw. Sitzung. */
const schluessel: string[] = []
let ipZaehler = 0

/** Eine eigene IP je Aufruf der Fabrik; ihre Zähler kommen auf die Liste zum Aufräumen. */
function neueIp(): string {
  ipZaehler += 1
  const ip = `192.0.2.${(process.pid % 50) + ipZaehler}`
  schluessel.push(
    bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.checkoutIp.zweck, ip),
    bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.barBestellungIp.zweck, ip)
  )
  return ip
}

beforeEach(async () => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  vi.stubEnv('NODE_ENV', 'production')
  vi.mocked(stripe.paymentIntents.create).mockImplementation((async () => ({ id: intKennung('pi'), client_secret: 'cs_test' })) as never)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  await prisma.rateLimitZaehler.deleteMany({ where: { schluessel: { in: schluessel } } })
  schluessel.length = 0
  await raeumeAuf()
})

/** Eine Bestellung über /api/checkout von `ip`, mit eigener Sitzung und Halt. */
async function bestellen(eingabe: {
  farm: { id: string; slug: string }
  produktId: string
  ip: string
  email: string
  paymentMethod?: 'ONSITE_CASH' | 'ONLINE'
  idempotencyKey?: string
  sitzung?: string
}): Promise<Response> {
  const sitzung = eingabe.sitzung ?? intKennung('sitzung')
  schluessel.push(bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.checkoutSitzung.zweck, sitzung))
  if (!eingabe.sitzung) await setzeHalt(eingabe.produktId, sitzung, 1)
  const roh = checkoutAnfrage({
    farm: eingabe.farm,
    sessionId: sitzung,
    customerEmail: eingabe.email,
    paymentMethod: eingabe.paymentMethod ?? 'ONSITE_CASH',
    idempotencyKey: eingabe.idempotencyKey,
    positionen: [{ productId: eingabe.produktId, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
  })
  return checkout(
    new NextRequest(roh.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': eingabe.ip },
      body: await roh.text(),
    })
  )
}

const vorrat = async (id: string): Promise<number> => (await prisma.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock
const neueAdresse = (): string => `${intKennung('kundin')}@example.com`

/** Ein Hof, der online annimmt (fertiger Stripe-Zugang) — für den Satz mit dem Ausweg und für Online-Bestellungen. */
const ONLINE_BEREIT = { acceptsOnline: true, stripeAccountReady: true, stripeAccountId: 'acct_int_bremse' } as const

describe('Bremse für Bar-Bestellungen je Adresse (Nr. 287, a)', () => {
  it('3 unbestätigte einer Adresse: die 4. bekommt 429 — keine Bestellung, kein Vorrat, keine Mail; nach dem Bestätigen geht die nächste', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 10 })
    const ip = neueIp()
    const email = neueAdresse()
    for (let i = 0; i < 3; i += 1) expect((await bestellen({ farm, produktId: produkt.id, ip, email })).status).toBe(200)
    const mailsVorher = nachlauf.aufgaben.length

    const vierte = await bestellen({ farm, produktId: produkt.id, ip, email })

    expect(vierte.status).toBe(429)
    expect(await vierte.json()).toEqual({ error: SATZ, code: 'BAR_GEBREMST' })
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(3)
    expect(await vorrat(produkt.id)).toBe(7)
    expect(nachlauf.aufgaben.length).toBe(mailsVorher)

    // Eine davon bestätigt: wieder nur 2 unbestätigte — die nächste geht.
    const eine = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id }, select: { id: true } })
    await prisma.order.update({ where: { id: eine.id }, data: { status: 'CONFIRMED', confirmationToken: null } })
    expect((await bestellen({ farm, produktId: produkt.id, ip, email })).status).toBe(200)
  })

  it('online ist nie betroffen — auch nicht mit drei unbestätigten Bar-Bestellungen derselben Adresse', async () => {
    const { farm } = await erstelleHof(ONLINE_BEREIT)
    const produkt = await erstelleProdukt(farm.id, { stock: 10 })
    const ip = neueIp()
    const email = neueAdresse()
    for (let i = 0; i < 3; i += 1) expect((await bestellen({ farm, produktId: produkt.id, ip, email })).status).toBe(200)

    const online = await bestellen({ farm, produktId: produkt.id, ip, email, paymentMethod: 'ONLINE' })

    expect(online.status).toBe(200)
    // Gegenprobe: bar wäre jetzt gebremst — mit dem Satz, der auf online zeigt.
    const bar = await bestellen({ farm, produktId: produkt.id, ip, email })
    expect(bar.status).toBe(429)
    expect((await bar.json()).error).toBe(SATZ_ONLINE)
  })

  it('eine Wiederholung mit bekanntem Schlüssel bekommt ihre Bestellung, auch an der Grenze', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 10 })
    const ip = neueIp()
    const email = neueAdresse()
    const idempotencyKey = intKennung('idem')
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 1)
    expect((await bestellen({ farm, produktId: produkt.id, ip, email })).status).toBe(200)
    expect((await bestellen({ farm, produktId: produkt.id, ip, email })).status).toBe(200)
    const dritte = await bestellen({ farm, produktId: produkt.id, ip, email, idempotencyKey, sitzung })
    expect(dritte.status).toBe(200)
    const { orderId } = (await dritte.json()) as { orderId: string }

    const wiederholt = await bestellen({ farm, produktId: produkt.id, ip, email, idempotencyKey, sitzung })

    expect(wiederholt.status).toBe(200)
    expect(await wiederholt.json()).toMatchObject({ orderId, wiederholt: true })
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(3)
  })
})

describe('Bremse für Bar-Bestellungen je IP (Nr. 287, b)', () => {
  it('die 11. Bar-Bestellung einer IP in einer Stunde bekommt 429 mit Retry-After — über alle Instanzen gezählt', async () => {
    const { farm } = await erstelleHof(ONLINE_BEREIT)
    const produkt = await erstelleProdukt(farm.id, { stock: 10 })
    const ip = neueIp()
    // Zehn Bar-Bestellungen dieser IP auf anderen Instanzen in dieser Stunde.
    const bremse = DB_BREMSEN.barBestellungIp
    for (let i = 0; i < bremse.max; i += 1) await zaehleVersuche([{ bremse, merkmal: ip }])

    const elfte = await bestellen({ farm, produktId: produkt.id, ip, email: neueAdresse() })

    expect(elfte.status).toBe(429)
    expect(Number(elfte.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(await elfte.json()).toEqual({ error: SATZ_ONLINE, code: 'BAR_GEBREMST' })
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(0)
    expect(await vorrat(produkt.id)).toBe(10)
    // Online von derselben IP: nicht betroffen. Eine andere IP: bar geht.
    expect((await bestellen({ farm, produktId: produkt.id, ip, email: neueAdresse(), paymentMethod: 'ONLINE' })).status).toBe(200)
    expect((await bestellen({ farm, produktId: produkt.id, ip: neueIp(), email: neueAdresse() })).status).toBe(200)
  })
})

describe('Bremse für Bar-Bestellungen je Hof (Nr. 287, c — Startsatz ja)', () => {
  it(`die ${BAR_UNBESTAETIGT_JE_HOF + 1}. unbestätigte am Hof bekommt 429; bis ${BAR_UNBESTAETIGT_JE_HOF} geht es`, async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 10 })
    const morgen = new Date(Date.now() + 24 * 60 * 60 * 1000)
    // 14 unbestätigte Bar-Bestellungen verschiedener Adressen liegen schon am Hof.
    for (let i = 0; i < BAR_UNBESTAETIGT_JE_HOF - 1; i += 1) {
      await prisma.order.create({
        data: {
          orderNumber: intKennung('nr'),
          farmId: farm.id,
          customerEmail: neueAdresse(),
          customerName: 'Erika Mustermann',
          customerPhone: '+43 660 0000000',
          totalAmount: 10,
          pickupDate: morgen,
          pickupTimeStart: '15:00',
          pickupTimeEnd: '18:00',
          paymentMethod: 'ONSITE_CASH',
          status: 'PENDING_CONFIRMATION',
        },
      })
    }

    const fuenfzehnte = await bestellen({ farm, produktId: produkt.id, ip: neueIp(), email: neueAdresse() })
    const sechzehnte = await bestellen({ farm, produktId: produkt.id, ip: neueIp(), email: neueAdresse() })

    expect(fuenfzehnte.status).toBe(200)
    expect(sechzehnte.status).toBe(429)
    expect(await sechzehnte.json()).toEqual({ error: SATZ, code: 'BAR_GEBREMST' })
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(BAR_UNBESTAETIGT_JE_HOF)
    expect(await vorrat(produkt.id)).toBe(9)
  })
})

describe('Bremse für Bar-Bestellungen: fail-open (Register R1)', () => {
  it('scheitert die Zählung in der Datenbank, geht die Bestellung durch — und Sentry erfährt es', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 10 })
    vi.spyOn(prisma.order, 'count').mockRejectedValue(new Error('Datenbank weg'))

    const antwort = await bestellen({ farm, produktId: produkt.id, ip: neueIp(), email: neueAdresse() })

    expect(antwort.status).toBe(200)
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: expect.objectContaining({ aufgabe: 'bremse-datenbank' }) })
    )
  })
})
