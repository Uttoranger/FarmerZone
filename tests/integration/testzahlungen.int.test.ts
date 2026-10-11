/**
 * Integrationstest — Testzahlungen aus den Auswertungen (Register Z4,
 * Nachtlauf Nr. 55) in der echten Datenbank.
 *
 * Aussagen über das, was die Abfragen zurückgeben:
 *  - Die drei Formen der EINEN Regel (Prüfung, Prisma-Bedingung, SQL-Baustein)
 *    wählen in Postgres genau dieselben Bestellungen — auch genau an der
 *    Grenze und eine Millisekunde davor und danach.
 *  - /admin (rohes SQL, monatsSpaltenJeHof) und /admin/finanzen
 *    (topfVonBestellung) zählen für denselben Monat dasselbe — mit und ohne
 *    Stichtag. Bar und Karte beim Hof zählen immer.
 *  - Umsatz von Auswertung, Verkäufe (Woche und Jahr für die Umsatzgrenze),
 *    Heute und Kunden ohne Testzahlungen; ohne Stichtag wie vor Nr. 55.
 *  - Die Hinweiszeile kommt genau dann, wenn eine gezeigte Zahl eine
 *    Testzahlung auslässt — auf den Seiten des Hofs wie auf Admin-Finanzen.
 *
 * Alle Bestellungen liegen im März 2027: Der Seed bestellt dort nicht, und der
 * SEPA-Start (B1, 1. Februar 2027) ist vorbei — Barbestellungen tragen ihre
 * Gebühr, „bar zählt immer" ist damit auch in den Finanzen sichtbar. `jetzt`
 * und der Stichtag sind Parameter; die Abfragen hängen an keiner Uhr.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { Prisma, type PaymentMethod, type OrderStatus, type PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { istTestzahlung, ohneTestzahlungenSql, ohneTestzahlungenWhere, testzahlungenHinweis } from '@/lib/testzahlung'
import { umsatzfenster } from '@/lib/umsatz'
import { getAdminFarms } from '@/server/queries/admin'
import { getFinanzen } from '@/server/queries/finanzen'
import { getKennzahlen } from '@/server/queries/auswertung'
import { getSalesOverview } from '@/server/queries/manual-sales'
import { getHeute } from '@/server/queries/heute'
import { getCustomersForFarm } from '@/server/queries/customers'
import { testzahlungenHinweisFuerHof } from '@/server/queries/testzahlungen'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

// Erfundener Stichtag: Dienstag, 16. März 2027, 12:00 Uhr in Wien (MEZ).
const STICHTAG = new Date('2027-03-16T12:00:00+01:00')
const JETZT = new Date('2027-03-18T10:00:00+01:00') // Donnerstag derselben Woche

type Bestellung = {
  paymentMethod: PaymentMethod
  createdAt: Date
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  pickedUpAt?: Date | null
  gebuehrCents?: number
  warenpreis?: number
  gebuehrEntfallen?: boolean
  produktId?: string
  kundin?: string
}

async function bestelle(farmId: string, b: Bestellung) {
  const status = b.status ?? 'PICKED_UP'
  const online = b.paymentMethod === 'ONLINE'
  const warenpreis = b.warenpreis ?? 20
  return prisma.order.create({
    data: {
      orderNumber: intKennung('tz').toUpperCase(),
      farmId,
      customerEmail: b.kundin ?? `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      status,
      totalAmount: warenpreis,
      pickupDate: b.createdAt,
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: b.paymentMethod,
      paymentStatus: b.paymentStatus ?? (online || status === 'PICKED_UP' ? 'PAID' : 'PENDING'),
      // Verkäufe trennen online und bar am Zahlungsvorgang (src/lib/sales-summary.ts).
      stripePaymentIntentId: online ? intKennung('pi') : null,
      serviceFeeCents: b.gebuehrCents ?? 0,
      serviceFeePercentApplied: (b.gebuehrCents ?? 0) > 0 ? 5 : null,
      serviceFeeRefundedAt: b.gebuehrEntfallen ? new Date(b.createdAt.getTime() + 60_000) : null,
      pickedUpAt: b.pickedUpAt ?? (status === 'PICKED_UP' ? new Date(b.createdAt.getTime() + 3_600_000) : null),
      createdAt: b.createdAt,
      ...(b.produktId
        ? { items: { create: [{ productId: b.produktId, productName: 'Testprodukt', quantity: 1, unitPrice: warenpreis, totalPrice: warenpreis, vatRate: 10 }] } }
        : {}),
    },
  })
}

describe('Eine Regel, drei Formen — in Postgres dieselbe Auswahl', () => {
  it('Prüfung, Prisma-Bedingung und SQL-Baustein wählen genau dieselben Bestellungen, auch an der Grenze', async () => {
    const { farm } = await erstelleHof()
    const zeitpunkte = [new Date(STICHTAG.getTime() - 1), STICHTAG, new Date(STICHTAG.getTime() + 1), new Date('2027-03-01T08:00:00Z')]
    const angelegt = []
    for (const paymentMethod of ['ONLINE', 'ONSITE_CASH', 'ONSITE_CARD'] as const) {
      for (const createdAt of zeitpunkte) angelegt.push(await bestelle(farm.id, { paymentMethod, createdAt }))
    }

    for (const stichtag of [STICHTAG, null]) {
      const erwartet = angelegt.filter((o) => !istTestzahlung(o, stichtag)).map((o) => o.id).sort()

      const ueberPrisma = await prisma.order.findMany({ where: { farmId: farm.id, ...ohneTestzahlungenWhere(stichtag) }, select: { id: true } })
      const ueberSql = await prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM "Order" WHERE "farmId" = ${farm.id} AND ${ohneTestzahlungenSql(Prisma.sql, stichtag)}`
      )

      expect(ueberPrisma.map((o) => o.id).sort(), String(stichtag)).toEqual(erwartet)
      expect(ueberSql.map((o) => o.id).sort(), String(stichtag)).toEqual(erwartet)

      // Ein eigenes NOT des Aufrufers steht neben der Regel, es ersetzt sie nicht (Nachbesserung Runde 1).
      const ausgenommen = erwartet[0]
      const mitEigenemNot = await prisma.order.findMany({
        where: { farmId: farm.id, ...ohneTestzahlungenWhere(stichtag), NOT: { id: ausgenommen } },
        select: { id: true },
      })
      expect(mitEigenemNot.map((o) => o.id).sort(), String(stichtag)).toEqual(erwartet.filter((id) => id !== ausgenommen))
    }
    // Mit Stichtag fehlen genau die zwei Online-Bestellungen davor.
    expect(angelegt.filter((o) => istTestzahlung(o, STICHTAG))).toHaveLength(2)
  })
})

describe('/admin und /admin/finanzen zählen gleich — mit und ohne Stichtag', () => {
  it('Testzahlungen fehlen in Hofliste und Finanzen gleichermaßen, bar und Karte zählen immer', async () => {
    const { farm } = await erstelleHof()
    const davor = new Date('2027-03-05T10:00:00+01:00')
    const danach = new Date('2027-03-17T10:00:00+01:00')
    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: davor, gebuehrCents: 52 }) // Testzahlung
    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: davor, status: 'PENDING_CONFIRMATION', paymentStatus: 'PENDING', gebuehrCents: 33 }) // Testzahlung, offen
    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: davor, status: 'CANCELLED', paymentStatus: 'REFUNDED', gebuehrCents: 50, gebuehrEntfallen: true }) // Testzahlung, entfallen
    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: danach, gebuehrCents: 61 }) // echt
    await bestelle(farm.id, { paymentMethod: 'ONSITE_CASH', createdAt: davor, gebuehrCents: 70 }) // bar, echt
    await bestelle(farm.id, { paymentMethod: 'ONSITE_CARD', createdAt: davor, gebuehrCents: 40 }) // Karte beim Hof, echt

    const mit = (await getAdminFarms(JETZT, STICHTAG)).find((f) => f.id === farm.id)
    expect(mit?.monat).toEqual({ bestellungen: 3, gebuehrOnlineCents: 61, gebuehrBarCents: 110, gebuehrEntfallenCents: 0 })
    const ohne = (await getAdminFarms(JETZT, null)).find((f) => f.id === farm.id)
    expect(ohne?.monat).toEqual({ bestellungen: 5, gebuehrOnlineCents: 113, gebuehrBarCents: 110, gebuehrEntfallenCents: 50 })

    // Dieselben Summen über ALLE Höfe des Monats — wie die Finanzseite sie zählt.
    for (const stichtag of [STICHTAG, null]) {
      const hoefe = await getAdminFarms(JETZT, stichtag)
      const finanzen = await getFinanzen('2027-03', JETZT, stichtag)
      const summe = (feld: 'gebuehrOnlineCents' | 'gebuehrBarCents') => hoefe.reduce((s, h) => s + h.monat[feld], 0)
      expect(summe('gebuehrOnlineCents'), String(stichtag)).toBe(finanzen.einnahmen.eingezogenCents)
      expect(summe('gebuehrBarCents'), String(stichtag)).toBe(finanzen.einnahmen.geschuldetCents)
    }

    const finanzenMit = await getFinanzen('2027-03', JETZT, STICHTAG)
    expect(finanzenMit.einnahmen).toMatchObject({ eingezogenCents: 61, geschuldetCents: 110, erwartetCents: 0, bestellungen: 3 })
    expect(finanzenMit.testzahlungenHinweis).toBe(testzahlungenHinweis(STICHTAG))
    const finanzenOhne = await getFinanzen('2027-03', JETZT, null)
    expect(finanzenOhne.einnahmen).toMatchObject({ eingezogenCents: 113, geschuldetCents: 110, erwartetCents: 33, bestellungen: 4 })
    expect(finanzenOhne.testzahlungenHinweis).toBeNull()
  })
})

describe('Umsatz ohne Testzahlungen — Auswertung, Verkäufe, Heute, Kunden', () => {
  async function hofMitWoche() {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 10 })
    const kundin = `${intKennung('kundin')}@example.com`
    // Alle drei in der Woche von JETZT abgeholt, von derselben Kundin.
    await bestelle(farm.id, {
      paymentMethod: 'ONLINE',
      createdAt: new Date('2027-03-15T09:00:00+01:00'),
      pickedUpAt: new Date('2027-03-16T10:00:00+01:00'),
      warenpreis: 20,
      produktId: produkt.id,
      kundin,
    }) // Testzahlung
    await bestelle(farm.id, {
      paymentMethod: 'ONLINE',
      createdAt: new Date('2027-03-16T15:00:00+01:00'),
      pickedUpAt: new Date('2027-03-17T10:00:00+01:00'),
      warenpreis: 25,
      produktId: produkt.id,
      kundin,
    }) // echt
    await bestelle(farm.id, {
      paymentMethod: 'ONSITE_CASH',
      createdAt: new Date('2027-03-15T09:30:00+01:00'),
      pickedUpAt: new Date('2027-03-16T11:00:00+01:00'),
      warenpreis: 7.5,
      produktId: produkt.id,
      kundin,
    }) // bar, echt
    return farm
  }

  it('mit Stichtag: Woche, Jahr, Kennzahlen, Heute und Kundin ohne die Testzahlung — bar zählt', async () => {
    const farm = await hofMitWoche()
    const woche = umsatzfenster('woche', JETZT)

    const verkaeufe = await getSalesOverview(farm.id, JETZT, STICHTAG)
    expect(verkaeufe).toMatchObject({ weekTotal: 32.5, weekOnline: 25, weekBar: 7.5, ytdTotal: 32.5 })
    expect(verkaeufe.testzahlungenHinweis).toBe(testzahlungenHinweis(STICHTAG))
    // Die Liste „Letzte Verkäufe" zeigt alle Bestellungen weiter.
    expect(verkaeufe.zeilen.filter((z) => z.art === 'bestellung')).toHaveLength(3)

    expect(await getKennzahlen(farm.id, woche, STICHTAG)).toMatchObject({ bestellungen: 2, online: 1, vorOrt: 1, warenCents: 3250 })
    expect((await getHeute(farm.id, JETZT, Promise.resolve(), STICHTAG)).woche.dieseWocheCent).toBe(3250)
    const [kundin] = await getCustomersForFarm(farm.id, JETZT, STICHTAG)
    expect(kundin).toMatchObject({ umsatzCents: 3250, orderCount: 3 })
  })

  it('ohne Stichtag ist das Ergebnis dasselbe wie vor Nr. 55', async () => {
    const farm = await hofMitWoche()
    const woche = umsatzfenster('woche', JETZT)

    const verkaeufe = await getSalesOverview(farm.id, JETZT, null)
    expect(verkaeufe).toMatchObject({ weekTotal: 52.5, weekOnline: 45, weekBar: 7.5, ytdTotal: 52.5, testzahlungenHinweis: null })
    expect(await getKennzahlen(farm.id, woche, null)).toMatchObject({ bestellungen: 3, online: 2, vorOrt: 1, warenCents: 5250 })
    expect((await getHeute(farm.id, JETZT, Promise.resolve(), null)).woche.dieseWocheCent).toBe(5250)
    const [kundin] = await getCustomersForFarm(farm.id, JETZT, null)
    expect(kundin).toMatchObject({ umsatzCents: 5250, orderCount: 3 })
  })
})

describe('Hinweiszeile — genau dann, wenn eine gezeigte Zahl eine Testzahlung auslässt', () => {
  const WOCHE = umsatzfenster('woche', JETZT).aktuell
  const JAHR = umsatzfenster('jahr', JETZT).aktuell
  // Wiener Monat März 2027 (die Sommerzeit beginnt am 28. März).
  const MAERZ = { von: new Date('2027-03-01T00:00:00+01:00'), bis: new Date('2027-04-01T00:00:00+02:00') }
  const ANGELEGT = new Date('2027-03-10T09:00:00+01:00')
  const HINWEIS = testzahlungenHinweis(STICHTAG)

  it('offene Testzahlung: keine Zeile — abgeholte: Zeile; ohne Stichtag nie', async () => {
    const { farm } = await erstelleHof()
    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: ANGELEGT, status: 'PENDING_CONFIRMATION', paymentStatus: 'PENDING', gebuehrCents: 52 })
    expect(await testzahlungenHinweisFuerHof(farm.id, { umsatz: [WOCHE, JAHR], gebuehrenMonat: MAERZ }, STICHTAG)).toBeNull()

    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: ANGELEGT, pickedUpAt: new Date('2027-03-11T10:00:00+01:00') })
    expect(await testzahlungenHinweisFuerHof(farm.id, { umsatz: [WOCHE, JAHR] }, STICHTAG)).toBe(HINWEIS)
    expect(await testzahlungenHinweisFuerHof(farm.id, { umsatz: [WOCHE, JAHR] }, null)).toBeNull()
  })

  it('bezahlt, nicht abgeholt: Zeile nur, wo die Servicegebühren des Monats sie auslassen (Auswertung), nicht bei Verkäufen', async () => {
    const { farm } = await erstelleHof()
    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: ANGELEGT, status: 'CONFIRMED', paymentStatus: 'PAID', gebuehrCents: 52 })
    expect(await testzahlungenHinweisFuerHof(farm.id, { umsatz: [WOCHE, JAHR] }, STICHTAG)).toBeNull()
    expect(await testzahlungenHinweisFuerHof(farm.id, { umsatz: [WOCHE, JAHR], gebuehrenMonat: MAERZ }, STICHTAG)).toBe(HINWEIS)
  })

  it('abgeholt nur zwischen den gezeigten Fenstern: keine Zeile', async () => {
    const { farm } = await erstelleHof()
    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: ANGELEGT, pickedUpAt: new Date('2027-03-11T10:00:00+01:00') })

    const davor = { von: new Date('2027-01-01T00:00:00+01:00'), bis: new Date('2027-03-11T09:59:59+01:00') }
    const danach = { von: new Date('2027-03-11T10:00:01+01:00'), bis: JETZT }
    expect(await testzahlungenHinweisFuerHof(farm.id, { umsatz: [davor, danach] }, STICHTAG)).toBeNull()
    // Gegenprobe: dasselbe Fenster über den Abholzeitpunkt hinweg findet sie.
    expect(await testzahlungenHinweisFuerHof(farm.id, { umsatz: [{ von: davor.von, bis: danach.bis }] }, STICHTAG)).toBe(HINWEIS)
  })

  it('storniert nach Abholung oder bar: keine Zeile — weder über den Umsatz noch über den Monat der Servicegebühren (Runde 2)', async () => {
    const { farm } = await erstelleHof()
    // Abgeholt im Jahr, danach storniert; die Erstattung gescheitert, die Zahlung
    // bleibt PAID — so endet nach der Live-Schaltung jeder Storno einer
    // Testzahlung (docs/betrieb/stripe-live.md, Hinweis zur Erstattung). Nur der
    // Status hält sie aus beiden Abfragen heraus.
    await bestelle(farm.id, {
      paymentMethod: 'ONLINE',
      createdAt: ANGELEGT,
      status: 'CANCELLED',
      paymentStatus: 'PAID',
      pickedUpAt: new Date('2027-03-11T10:00:00+01:00'),
      gebuehrCents: 50,
    })
    await bestelle(farm.id, { paymentMethod: 'ONSITE_CASH', createdAt: ANGELEGT, gebuehrCents: 70 })

    expect(await testzahlungenHinweisFuerHof(farm.id, { umsatz: [WOCHE, JAHR], gebuehrenMonat: MAERZ }, STICHTAG)).toBeNull()
  })
})

describe('Admin-Finanzen: Hinweiszeile genau dann, wenn eine gezeigte Zahl eine Testzahlung auslässt (Runde 2)', () => {
  // Ein Fenster ohne Seed-Bestellungen: gewählt März 2028, gezeigt April 2027
  // bis März 2028. Die Finanzseite zählt alle Höfe.
  const STICHTAG_2028 = new Date('2028-03-16T12:00:00+01:00')
  const JETZT_2028 = new Date('2028-03-18T10:00:00+01:00')
  const IM_FEBRUAR = new Date('2028-02-10T10:00:00+01:00')
  const IM_MAERZ = new Date('2028-03-10T10:00:00+01:00')
  const HINWEIS_2028 = testzahlungenHinweis(STICHTAG_2028)
  const OFFEN = { status: 'PENDING_CONFIRMATION', paymentStatus: 'PENDING', gebuehrCents: 33 } as const

  it('offene Testzahlung im Vormonat: keine Zeile — im gewählten Monat: Zeile', async () => {
    const { farm } = await erstelleHof()
    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: IM_FEBRUAR, ...OFFEN })
    expect((await getFinanzen('2028-03', JETZT_2028, STICHTAG_2028)).testzahlungenHinweis).toBeNull()
    // Wird der Februar gewählt, steht dort „erwartet" — dann fehlt sie in einer gezeigten Zahl.
    expect((await getFinanzen('2028-02', JETZT_2028, STICHTAG_2028)).testzahlungenHinweis).toBe(HINWEIS_2028)

    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: IM_MAERZ, ...OFFEN })
    expect((await getFinanzen('2028-03', JETZT_2028, STICHTAG_2028)).testzahlungenHinweis).toBe(HINWEIS_2028)
  })

  it('bezahlte Testzahlung im Vormonat: Zeile — sie fehlt im Verlauf', async () => {
    const { farm } = await erstelleHof()
    await bestelle(farm.id, { paymentMethod: 'ONLINE', createdAt: IM_FEBRUAR, status: 'CONFIRMED', paymentStatus: 'PAID', gebuehrCents: 52 })

    const mit = await getFinanzen('2028-03', JETZT_2028, STICHTAG_2028)
    expect(mit.testzahlungenHinweis).toBe(HINWEIS_2028)
    expect(mit.verlauf.find((p) => p.monat === '2028-02')?.einnahmenCents).toBe(0)
    // Gegenprobe ohne Stichtag: Der Februar zählt sie, eine Zeile gibt es nicht.
    const ohne = await getFinanzen('2028-03', JETZT_2028, null)
    expect(ohne.verlauf.find((p) => p.monat === '2028-02')?.einnahmenCents).toBe(52)
    expect(ohne.testzahlungenHinweis).toBeNull()
  })
})
