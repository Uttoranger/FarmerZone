/**
 * Notbremse „Bestellungen anhalten“ (Register N34, Nachtlauf Nr. 189) gegen ein
 * ECHTES Postgres — mit echter Anmeldung über Better Auth, der echten
 * Admin-Wache (Passkey-Admin aus setup/basis.ts) und den echten Routen.
 *
 * Beweist (Zustand danach):
 *  - Ohne das Recht `notbremse` schreibt `halteBestellungenAn` nichts und
 *    protokolliert nichts (403-Fall); „bis“ über 72 Stunden lehnt sie ab
 *    (400-Fall), ebenfalls ohne Schreiben.
 *  - Mit dem Recht: die vier Felder stehen, ein Protokoll-Eintrag mit Art,
 *    Bezug „plattform“ und Grund-Label — und /api/reserve,
 *    /api/warenkorb/pruefen und /api/checkout antworten 409 mit dem Satz für
 *    die Kundschaft. Der Halt bleibt, keine Bestellung, kein Bestandsabzug.
 *  - Abgelaufen („bis“ vorbei, Felder noch gefüllt) → wieder offen, ohne dass
 *    jemand schreibt. Aufgehoben (`gibBestellungenFrei`) → offen, Eintrag im
 *    Protokoll; die Kasse nimmt die Bestellung wieder an.
 *  - Laufende Bestellungen: Während die Notbremse gilt, setzt der Hof eine
 *    Bestellung auf „abholbereit“ und storniert eine andere.
 * Daten erfunden (example.com, `int-`-Kennungen); danach weg, die Notbremse aus.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn() }, paymentIntents: { create: vi.fn() } } }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
// Der echte Teil von email.ts (Storno, Abholbereit) bindet 'server-only'.
vi.mock('server-only', () => ({}))

import { headers } from 'next/headers'
import { updateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { ADMIN_RECHT_FEHLER } from '@/lib/admin-rechte'
import { NOTBREMSE_FEHLER, NOTBREMSE_HOECHSTENS_MS } from '@/lib/notbremse'
import { PLATTFORM_EINSTELLUNG_ID, PLATTFORM_EINSTELLUNG_TAG } from '@/lib/plattform-einstellung'
import { POST as reserve } from '@/app/api/reserve/route'
import { POST as pruefen } from '@/app/api/warenkorb/pruefen/route'
import { POST as checkout } from '@/app/api/checkout/route'
import { gibBestellungenFrei, halteBestellungenAn } from '@/server/actions/notbremse'
import { cancelOrder, markAsReady } from '@/server/actions/orders'
import { checkoutAnfrage, erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, intKennung, machePasskeyAdmin, raeumeAuf, setzeHalt } from './setup/basis'

const SATZ = 'Bestellen ist gerade kurz nicht möglich. Bitte versuch es in einer Stunde wieder.'
const STUNDE = 60 * 60 * 1000
const nutzer: string[] = []

const AUS = { bestellstoppAb: null, bestellstoppBis: null, bestellstoppGrund: null, bestellstoppSatz: null }

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await prisma.plattformEinstellung.updateMany({ where: { id: PLATTFORM_EINSTELLUNG_ID }, data: AUS })
  await prisma.adminAktion.deleteMany({ where: { wer: { in: nutzer.splice(0) } } })
  await raeumeAuf()
})

/** Eine Person im Team mit diesen Rechten (nicht Inhaberin), angemeldet mit frischem Passkey. */
async function teamPerson(rechte: string[]): Promise<string> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  await prisma.user.update({ where: { id: ownerId }, data: { adminInhaber: false, adminRechte: rechte } })
  nutzer.push(ownerId)
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return ownerId
}

function stand() {
  return prisma.plattformEinstellung.findUnique({
    where: { id: PLATTFORM_EINSTELLUNG_ID },
    select: { bestellstoppAb: true, bestellstoppBis: true, bestellstoppGrund: true, bestellstoppSatz: true },
  })
}

function json(pfad: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${pfad}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

/** Hof mit Produkt und einem Halt der Sitzung — bereit für alle drei Routen. */
async function korb() {
  const { farm } = await erstelleHof()
  const produkt = await erstelleProdukt(farm.id, { stock: 5 })
  const sitzung = intKennung('sitzung')
  await setzeHalt(produkt.id, sitzung, 2)
  return { farm, produkt, sitzung }
}

async function dreiRouten(k: Awaited<ReturnType<typeof korb>>) {
  const r = await reserve(json('/api/reserve', { productId: k.produkt.id, quantity: 3, sessionId: k.sitzung }))
  const p = await pruefen(json('/api/warenkorb/pruefen', { sessionId: k.sitzung, items: [{ productId: k.produkt.id, quantity: 2 }] }))
  const c = await checkout(
    checkoutAnfrage({ farm: k.farm, sessionId: k.sitzung, positionen: [{ productId: k.produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }] })
  )
  return { r, p, c }
}

describe('halteBestellungenAn — Recht, Frist, Protokoll', () => {
  it('ohne das Recht notbremse: Ablehnung, nichts geschrieben, kein Eintrag', async () => {
    const wer = await teamPerson(['geld'])
    const ergebnis = await halteBestellungenAn({ grund: 'zahlungen', satz: SATZ, bis: new Date(Date.now() + STUNDE).toISOString() })
    expect(ergebnis).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect((await stand())?.bestellstoppAb ?? null).toBeNull()
    expect(await prisma.adminAktion.count({ where: { wer } })).toBe(0)
  })

  it('„bis“ über 72 Stunden: Ablehnung, nichts geschrieben; genau 72 Stunden gehen (Gegenprobe)', async () => {
    const wer = await teamPerson(['notbremse'])
    const zuWeit = await halteBestellungenAn({ grund: 'wartung', satz: SATZ, bis: new Date(Date.now() + NOTBREMSE_HOECHSTENS_MS + 60_000).toISOString() })
    expect(zuWeit).toEqual({ error: NOTBREMSE_FEHLER.zuLang })
    expect((await stand())?.bestellstoppAb ?? null).toBeNull()
    expect(await prisma.adminAktion.count({ where: { wer } })).toBe(0)

    const knapp = await halteBestellungenAn({ grund: 'wartung', satz: SATZ, bis: new Date(Date.now() + NOTBREMSE_HOECHSTENS_MS - 60_000).toISOString() })
    expect(knapp).toEqual({ ok: true })
  })

  it('mit dem Recht: Felder, Protokoll, Etikett geleert — und alle drei Routen 409 mit dem Satz', async () => {
    const k = await korb()
    const wer = await teamPerson(['notbremse'])
    const bis = new Date(Date.now() + 2 * STUNDE)

    expect(await halteBestellungenAn({ grund: 'zahlungen', satz: `  ${SATZ} `, bis: bis.toISOString() })).toEqual({ ok: true })

    const zeile = await stand()
    expect(zeile).toMatchObject({ bestellstoppGrund: 'zahlungen', bestellstoppSatz: SATZ })
    expect(zeile?.bestellstoppBis?.toISOString()).toBe(bis.toISOString())
    const eintraege = await prisma.adminAktion.findMany({ where: { wer } })
    expect(eintraege.map((e) => [e.art, e.bezugArt, e.grund, e.mitPasskey])).toEqual([['bestellungen_angehalten', 'plattform', 'Zahlungen gestört (Stripe)', true]])
    expect(updateTag).toHaveBeenCalledWith(PLATTFORM_EINSTELLUNG_TAG)

    const { r, p, c } = await dreiRouten(k)
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe(SATZ)
    expect(p.status).toBe(409)
    expect(await p.json()).toEqual({ error: SATZ, code: 'BESTELLSTOPP' })
    expect(c.status).toBe(409)
    expect(await c.json()).toEqual({ error: SATZ, code: 'BESTELLSTOPP' })

    // Der Korb bleibt: Halt unverändert, keine Bestellung, kein Abzug.
    expect(await prisma.stockReservation.findMany({ where: { productId: k.produkt.id }, select: { sessionId: true, quantity: true } })).toEqual([{ sessionId: k.sitzung, quantity: 2 }])
    expect(await prisma.order.count({ where: { farmId: k.farm.id } })).toBe(0)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: k.produkt.id } })).stock).toBe(5)
  })
})

describe('Ende beim Lesen und Aufheben', () => {
  it('abgelaufen: Felder noch gefüllt, „bis“ vorbei — alle drei Routen wieder offen', async () => {
    const k = await korb()
    await prisma.plattformEinstellung.update({
      where: { id: PLATTFORM_EINSTELLUNG_ID },
      data: { bestellstoppAb: new Date(Date.now() - 2 * STUNDE), bestellstoppBis: new Date(Date.now() - 1000), bestellstoppGrund: 'wartung', bestellstoppSatz: SATZ },
    })
    const { r, p, c } = await dreiRouten(k)
    expect(r.status).toBe(200)
    expect(p.status).toBe(200)
    expect(c.status).toBe(200)
    expect(await prisma.order.count({ where: { farmId: k.farm.id } })).toBe(1)
  })

  it('aufgehoben: offen, Eintrag im Protokoll; zweites Aufheben ohne Eintrag', async () => {
    const k = await korb()
    const wer = await teamPerson(['notbremse'])
    await halteBestellungenAn({ grund: 'kasse', satz: SATZ, bis: new Date(Date.now() + STUNDE).toISOString() })
    expect((await reserve(json('/api/reserve', { productId: k.produkt.id, quantity: 1, sessionId: k.sitzung }))).status).toBe(409)

    expect(await gibBestellungenFrei()).toEqual({ ok: true })
    expect(await stand()).toEqual(AUS)
    expect(await gibBestellungenFrei()).toEqual({ ok: true })
    const arten = (await prisma.adminAktion.findMany({ where: { wer }, orderBy: { wann: 'asc' } })).map((e) => e.art)
    expect(arten).toEqual(['bestellungen_angehalten', 'bestellungen_freigegeben'])

    vi.mocked(headers).mockResolvedValue(new Headers() as never)
    const { r, p, c } = await dreiRouten(k)
    expect([r.status, p.status, c.status]).toEqual([200, 200, 200])
  })

  it('gibBestellungenFrei ohne das Recht: Ablehnung, die Notbremse bleibt', async () => {
    await prisma.plattformEinstellung.update({
      where: { id: PLATTFORM_EINSTELLUNG_ID },
      data: { bestellstoppAb: new Date(), bestellstoppBis: new Date(Date.now() + STUNDE), bestellstoppGrund: 'wartung', bestellstoppSatz: SATZ },
    })
    await teamPerson(['geld'])
    expect(await gibBestellungenFrei()).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect((await stand())?.bestellstoppSatz).toBe(SATZ)
  })
})

describe('Laufende Bestellungen bleiben unberührt', () => {
  it('während der Notbremse: abholbereit setzen und stornieren gehen', async () => {
    const { farm, cookie } = await erstelleHofMitAnmeldung()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const bestellung = (status: 'CONFIRMED') =>
      prisma.order.create({
        data: {
          orderNumber: intKennung('bestellung').toUpperCase(),
          farmId: farm.id,
          customerEmail: `${intKennung('kundin')}@example.com`,
          customerName: 'Erika Mustermann',
          customerPhone: '+43 660 0000000',
          status,
          totalAmount: 10,
          pickupDate: new Date(Date.now() + 24 * STUNDE),
          pickupTimeStart: '15:00',
          pickupTimeEnd: '18:00',
          paymentMethod: 'ONSITE_CASH',
          paymentStatus: 'PENDING',
          items: { create: [{ productId: produkt.id, productName: 'Testprodukt', unitPrice: 10, quantity: 1, totalPrice: 10, vatRate: 10 }] },
        },
      })
    const eins = await bestellung('CONFIRMED')
    const zwei = await bestellung('CONFIRMED')
    await prisma.plattformEinstellung.update({
      where: { id: PLATTFORM_EINSTELLUNG_ID },
      data: { bestellstoppAb: new Date(), bestellstoppBis: new Date(Date.now() + STUNDE), bestellstoppGrund: 'zahlungen', bestellstoppSatz: SATZ },
    })
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)

    expect(await markAsReady(eins.id)).not.toHaveProperty('error')
    expect(await cancelOrder(zwei.id, 'Ware verdorben')).not.toHaveProperty('error')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: eins.id } })).status).toBe('READY')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: zwei.id } })).status).toBe('CANCELLED')
  })
})
