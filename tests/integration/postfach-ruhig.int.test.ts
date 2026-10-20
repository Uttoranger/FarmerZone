/**
 * Postfach ruhig (Register N14, Ergänzung; Nachtlauf Nr. 105) gegen ein echtes
 * Postgres — mit echter Anmeldung über Better Auth und der echten Bremse.
 *
 * Beweist (Zustand danach):
 *  - „Erstattung erledigt" löscht nur Order.erstattungOffenSeit (die übrigen
 *    Felder bleiben, außer dem automatischen updatedAt); ein zweiter Aufruf
 *    schreibt 0 Zeilen und ist kein Fehler; ohne Admin bleibt alles stehen.
 *    Danach zählt der Eingang die Erstattung nicht mehr („Davon Geld").
 *  - Drossel: Zwei Antworten eines Hofs im selben Faden innerhalb einer
 *    vollen Stunde → ein Versand-Aufruf (Mail gemockt); ein anderer Faden
 *    zählt für sich.
 * Testhöfe heißen „Testhof …", Adressen @example.com, Texte erfunden. Der
 * Nachlauf wird gesammelt und selbst abgearbeitet (TESTING_GUIDELINES §3).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as (() => Promise<void>)[] }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/email', () => ({
  sendHofAntwortAnTeam: vi.fn(async () => ({ gesendet: 1, gescheitert: 0 })),
}))

import { headers } from 'next/headers'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendHofAntwortAnTeam } from '@/lib/email'
import { DB_BREMSEN, fensterBeginn } from '@/lib/bremse-datenbank'
import { antworteAlsHof, markiereErstattungErledigt } from '@/server/actions/postfach'
import { zaehleOffenImEingang } from '@/server/queries/postfach'
import { erstelleHof, erstelleHofMitAnmeldung, intKennung, raeumeAuf, machePasskeyAdmin } from './setup/basis'

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  await raeumeAuf()
})

async function alsSitzung(cookie: string): Promise<void> {
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
}

async function erstelleAdmin(): Promise<{ cookie: string }> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung({ name: 'Testhof Admin' })
  await machePasskeyAdmin(ownerId)
  return { cookie }
}

async function arbeiteNachlaufAb(): Promise<void> {
  for (const aufgabe of nachlauf.aufgaben.splice(0)) await aufgabe()
}

async function bestellungMitOffenerErstattung(farmId: string): Promise<string> {
  const order = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Beispiel',
      customerPhone: '+43 660 0000000',
      status: 'CANCELLED',
      totalAmount: new Prisma.Decimal(2000).div(100),
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      stripePaymentIntentId: intKennung('pi'),
      serviceFeeCents: 100,
      erstattungOffenSeit: new Date(Date.now() - 60 * 60 * 1000),
    },
    select: { id: true },
  })
  return order.id
}

describe('Erstattung erledigt', () => {
  it('löscht nur das Merkmal; zweiter Aufruf 0 Zeilen ohne Fehler; der Eingang zählt sie nicht mehr', async () => {
    const { cookie } = await erstelleAdmin()
    const { farm } = await erstelleHof({ name: 'Testhof A' })
    const id = await bestellungMitOffenerErstattung(farm.id)
    const vorher = await prisma.order.findUniqueOrThrow({ where: { id } })
    const offenVorher = (await zaehleOffenImEingang()).erstattungen

    await alsSitzung(cookie)
    expect(await markiereErstattungErledigt({ orderId: id })).toEqual({ ok: true })

    const nachher = await prisma.order.findUniqueOrThrow({ where: { id } })
    expect(nachher.erstattungOffenSeit).toBeNull()
    // Alles andere unverändert — Geld, Status, Zahlung; nur updatedAt setzt Prisma selbst.
    const ohne = (zeile: typeof vorher) => Object.fromEntries(Object.entries(zeile).filter(([feld]) => feld !== 'erstattungOffenSeit' && feld !== 'updatedAt'))
    expect(ohne(nachher)).toEqual(ohne(vorher))
    expect((await zaehleOffenImEingang()).erstattungen).toBe(offenVorher - 1)

    const zweitesMal = await prisma.order.findUniqueOrThrow({ where: { id }, select: { updatedAt: true } })
    expect(await markiereErstattungErledigt({ orderId: id })).toEqual({ ok: true })
    // 0 Zeilen: nicht einmal updatedAt rückt.
    expect((await prisma.order.findUniqueOrThrow({ where: { id }, select: { updatedAt: true } })).updatedAt).toEqual(zweitesMal.updatedAt)
  })

  it('ohne Admin bleibt die Erstattung offen', async () => {
    const { farm, cookie } = await erstelleHofMitAnmeldung({ name: 'Testhof B' })
    const id = await bestellungMitOffenerErstattung(farm.id)

    await alsSitzung(cookie)
    expect(await markiereErstattungErledigt({ orderId: id })).toEqual({ error: 'Kein Zugriff.' })
    await alsSitzung('')
    expect(await markiereErstattungErledigt({ orderId: id })).toEqual({ error: 'Nicht angemeldet.' })
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).erstattungOffenSeit).not.toBeNull()
  })
})

describe('Drossel der Mail „Ein Hof hat geantwortet" (echte Bremse)', () => {
  async function fadenFuer(farmId: string): Promise<string> {
    const faden = await prisma.unterhaltung.create({ data: { farmId, letzteNachrichtAm: new Date() }, select: { id: true } })
    await prisma.nachricht.create({ data: { unterhaltungId: faden.id, vonFarmId: null, text: 'Erfundene Nachricht vom Team.' } })
    return faden.id
  }

  it('zwei Antworten im selben Faden und derselben vollen Stunde → ein Versand; ein anderer Faden zählt für sich', async () => {
    const { farm, cookie } = await erstelleHofMitAnmeldung({ name: 'Testhof A' })
    const faden = await fadenFuer(farm.id)
    const andererFaden = await fadenFuer(farm.id)
    await alsSitzung(cookie)

    const beginn = Date.now()
    expect(await antworteAlsHof({ unterhaltungId: faden, text: 'Erfundene erste Antwort.' })).toEqual({ ok: true })
    expect(await antworteAlsHof({ unterhaltungId: faden, text: 'Erfundene zweite Antwort.' })).toEqual({ ok: true })
    const ende = Date.now()
    await arbeiteNachlaufAb()

    // Die Systemuhr läuft (Integrationsschicht): Liegt zufällig eine volle Stunde dazwischen, sind es zwei Fenster.
    const einFenster = fensterBeginn(new Date(beginn), DB_BREMSEN.antwortHofMail.fensterMs).getTime() === fensterBeginn(new Date(ende), DB_BREMSEN.antwortHofMail.fensterMs).getTime()
    expect(sendHofAntwortAnTeam).toHaveBeenCalledTimes(einFenster ? 1 : 2)
    expect(vi.mocked(sendHofAntwortAnTeam).mock.calls[0]![1]).toMatchObject({ unterhaltungId: faden, text: 'Erfundene erste Antwort.' })
    // Beide Antworten stehen im Faden — gedrosselt wird nur die Mail.
    expect(await prisma.nachricht.count({ where: { unterhaltungId: faden, vonFarmId: farm.id } })).toBe(2)

    vi.mocked(sendHofAntwortAnTeam).mockClear()
    expect(await antworteAlsHof({ unterhaltungId: andererFaden, text: 'Erfundene Antwort im anderen Faden.' })).toEqual({ ok: true })
    await arbeiteNachlaufAb()
    expect(sendHofAntwortAnTeam).toHaveBeenCalledTimes(1)
  })
})
