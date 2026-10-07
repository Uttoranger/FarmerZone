/**
 * Auswertung und Region (Nachtlauf Nr. 22c) gegen ein ECHTES Postgres.
 *
 * Die Aussagen:
 *  - „Servicegebühren dieses Monats" summiert nur die gespeicherten Beträge
 *    des EIGENEN Hofs aus dem laufenden Wiener Monat, gezählt nach der
 *    Abrechnungsregel (online bezahlt; nicht storniert, nicht erstattet; bar
 *    vor dem Stichtag nie) — und schreibt nichts.
 *  - Die Kennzahlen zählen nur abgeholte bzw. nicht abgeholte Bestellungen
 *    des eigenen Hofs im Zeitraum.
 *  - „Futter kaufen" liest nur öffentliche, aktive, freigeschaltete, nicht
 *    pausierte Höfe mit Nummer im Umkreis; gesperrte Größen erscheinen nicht;
 *    Kontaktdaten und Koordinaten verlassen den Server nicht.
 */
import { describe, it, expect, afterEach } from 'vitest'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getKennzahlen, getServicegebuehrenMonat } from '@/server/queries/auswertung'
import { getFutterKaufen } from '@/server/queries/futter-kaufen'
import { baueFutterKaufen } from '@/lib/futter-kaufen'
import { umsatzfenster } from '@/lib/umsatz'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

// Fest gewählt (vor dem Bar-Stichtag, Register B1) — die Abfragen nehmen `jetzt` als Parameter.
const JETZT = new Date('2026-10-15T10:00:00Z')

async function bestellung(farmId: string, abweichend: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  const kennung = intKennung('bestellung')
  return prisma.order.create({
    data: {
      orderNumber: kennung,
      farmId,
      customerEmail: `${kennung}@example.com`,
      customerName: 'Erika Musterfrau',
      customerPhone: '+43 660 0000000',
      totalAmount: '20.00',
      pickupDate: new Date('2026-10-10T10:00:00Z'),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      serviceFeeCents: 100,
      createdAt: new Date('2026-10-05T10:00:00Z'),
      ...abweichend,
    },
  })
}

describe('Servicegebühren dieses Monats — nur gelesen, nur der eigene Hof', () => {
  it('zählt online bezahlte, nicht stornierte, nicht erstattete Gebühren des laufenden Monats', async () => {
    const { farm } = await erstelleHof()
    const { farm: fremd } = await erstelleHof({ name: 'Fremder Hof' })

    await bestellung(farm.id, { serviceFeeCents: 53 })
    await bestellung(farm.id, { serviceFeeCents: 61, status: 'PICKED_UP', pickedUpAt: new Date('2026-10-10T15:00:00Z') })
    await bestellung(farm.id, { serviceFeeCents: 70, status: 'CANCELLED', cancelledAt: new Date('2026-10-06T10:00:00Z') })
    await bestellung(farm.id, { serviceFeeCents: 80, serviceFeeRefundedAt: new Date('2026-10-07T10:00:00Z') })
    await bestellung(farm.id, { serviceFeeCents: 90, paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', status: 'PICKED_UP' })
    await bestellung(farm.id, { serviceFeeCents: 95, createdAt: new Date('2026-09-28T10:00:00Z') })
    await bestellung(fremd.id, { serviceFeeCents: 999 })
    const vorher = await prisma.order.findMany({ where: { farmId: farm.id }, orderBy: { id: 'asc' } })

    const monat = await getServicegebuehrenMonat(farm.id, JETZT)

    expect(monat).toMatchObject({ monat: '2026-10', onlineCents: 114, onlineAnzahl: 2, vorOrtCents: 0, vorOrtAnzahl: 0, summeCents: 114 })
    expect(monat.bezeichnung).toBe('Oktober 2026')
    // Nur lesend: an keiner Bestellung hat sich etwas geändert.
    expect(await prisma.order.findMany({ where: { farmId: farm.id }, orderBy: { id: 'asc' } })).toEqual(vorher)
  })

  it('ohne Bestellung: null überall', async () => {
    const { farm } = await erstelleHof()
    expect(await getServicegebuehrenMonat(farm.id, JETZT)).toMatchObject({ summeCents: 0, onlineAnzahl: 0, vorOrtAnzahl: 0 })
  })
})

describe('Kennzahlen — eigener Hof, Zeitraum', () => {
  it('abgeholt nach Abholzeitpunkt, nicht abgeholt nach Abholtag, fremde Höfe nie', async () => {
    const { farm } = await erstelleHof()
    const { farm: fremd } = await erstelleHof({ name: 'Fremder Hof' })
    const abgeholt = { status: 'PICKED_UP' as const, pickedUpAt: new Date('2026-10-10T15:00:00Z') }
    await bestellung(farm.id, { ...abgeholt, totalAmount: '19.99' })
    await bestellung(farm.id, { ...abgeholt, totalAmount: '10.01', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING' })
    await bestellung(farm.id, { status: 'NOT_PICKED_UP', pickupDate: new Date('2026-10-14T10:00:00Z') })
    await bestellung(farm.id, { status: 'NOT_PICKED_UP', pickupDate: new Date('2026-09-14T10:00:00Z') })
    await bestellung(fremd.id, { ...abgeholt, totalAmount: '500.00' })

    const k = await getKennzahlen(farm.id, umsatzfenster('monat', JETZT))

    expect(k).toEqual({ bestellungen: 2, online: 1, vorOrt: 1, warenCents: 3000, durchschnittCents: 1500, nichtAbgeholt: 1 })
  })
})

describe('Futter kaufen — öffentliche registrierte Höfe im Umkreis', () => {
  const STANDORT = { latitude: 47.0, longitude: 15.0 }
  const NAH = { latitude: 47.03, longitude: 15.02 } // rund 4 km

  async function futter(farmId: string, abweichend: Partial<Prisma.ProductUncheckedCreateInput> = {}) {
    return prisma.product.create({
      data: {
        id: intKennung('futter'),
        farmId,
        name: 'Heu Rundballen',
        price: '45.00',
        vatRate: 10,
        unit: 'BALLEN',
        stock: 3,
        isAvailable: true,
        category: 'HEU_STROH',
        verpackung: 'LOSE_BALLEN',
        futter: {
          create: {
            zielTierarten: ['RIND'],
            zusammensetzung: 'Wiesenheu',
            analytischeBestandteile: 'Rohprotein 9 %',
            bestaetigtAm: new Date(),
            futtermittelart: 'EINZELFUTTERMITTEL',
            nettoMenge: '250',
            nettoEinheit: 'KG',
          },
        },
        ...abweichend,
      },
    })
  }

  it('nur öffentlich, freigeschaltet, nicht pausiert, mit Nummer, im Umkreis; gesperrtes Gebinde fehlt; keine Kontaktdaten', async () => {
    const { farm: eigen } = await erstelleHof(STANDORT)
    const { farm: gut } = await erstelleHof({ ...NAH, name: 'Futterhof' })
    const { farm: nichtFrei } = await erstelleHof({ ...NAH, approvedAt: null })
    const { farm: pausiert } = await erstelleHof({ ...NAH, isPaused: true })
    const { farm: ohneNummer } = await erstelleHof({ ...NAH, betriebsnummer: null })
    const { farm: weit } = await erstelleHof({ latitude: 48.2, longitude: 16.4 })
    const { farm: stillgelegt } = await erstelleHof({ ...NAH, archivedAt: new Date() })

    const ballen = await futter(gut.id)
    const sackerl = await futter(gut.id, { name: 'Heu 1 kg-Sackerl', verpackung: 'ABGEPACKT_ETIKETT', unit: 'STUECK', price: '2.50' })
    for (const f of [nichtFrei, pausiert, ohneNummer, weit, stillgelegt, eigen]) await futter(f.id)

    const daten = await getFutterKaufen(eigen.id, 25)
    expect(daten?.eigenerStandort).toBe(true)
    if (!daten?.eigenerStandort) return

    const ids = daten.hoefe.map((h) => h.id)
    expect(ids).toContain(gut.id)
    for (const f of [nichtFrei, pausiert, ohneNummer, weit, stillgelegt, eigen]) expect(ids).not.toContain(f.id)

    const ansicht = baueFutterKaufen({ ...daten, filter: { km: 25, art: null, menge: null }, jetzt: { wochentag: 1, uhrzeit: '10:00' } })
    const meine = ansicht.angebote.filter((a) => a.hofName === 'Futterhof')
    expect(meine.flatMap((a) => a.groessen.map((g) => g.id))).toEqual([ballen.id])
    expect(JSON.stringify(ansicht)).not.toContain(sackerl.id)
    expect(meine[0].schild).toBe('Futtermittelbetrieb · LFBIS 0000000')

    const text = JSON.stringify(daten)
    expect(text).not.toMatch(/Teststraße|@example\.com|\+43 660|latitude|longitude/)
  })

  it('ohne eigenen Standort: nur der Hinweis', async () => {
    const { farm } = await erstelleHof({ latitude: null, longitude: null })
    expect(await getFutterKaufen(farm.id, 25)).toEqual({ eigenerStandort: false })
    expect(await getFutterKaufen('int-gibt-es-nicht', 25)).toBeNull()
  })
})
