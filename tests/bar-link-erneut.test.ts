/**
 * „Mail nicht bekommen? Erneut senden" (Register S17 Punkt 2, Nr. 151) —
 * die Server Action `sendeBarLinkErneut`.
 *
 * Die Aussagen: Nur mit gültiger Signatur, nur für eine offene Barbestellung,
 * höchstens dreimal je Bestellung und Tag (Bremse gemockt), nur an die Adresse
 * der Bestellung. Der neue Token ersetzt den alten bedingt auf den gelesenen
 * Wert (der Wechsel ist die Sperre); gespeichert wird nur sein Hash. Die
 * Antwort ist in jedem Fall dieselbe.
 *
 * Prisma, Bremse, Mail und Sentry sind gemockt; die Regeln aus
 * src/lib/bar-bestaetigung.ts und die Signatur laufen echt. Die
 * Datenbank-Sperre beweist tests/integration/bar-link-hash.int.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { nachlauf } = vi.hoisted(() => ({ nachlauf: [] as Array<() => Promise<void>> }))

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findFirst: vi.fn(), updateMany: vi.fn() } },
}))
vi.mock('@/server/bremse-datenbank', () => ({ bremseUeberAlleInstanzen: vi.fn() }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn() }))
vi.mock('@/server/unbezahlte-bestellung', () => ({ storniereUnbezahlteBestellung: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
// Die echte Mail-Vorlage (Hofpreis-Test unten) bindet server-only ein.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.push(aufgabe)
  },
}))

import * as Sentry from '@sentry/nextjs'
import { sendeBarLinkErneut } from '@/server/actions/bar-bestaetigung'
import { BAR_LINK_ERNEUT_ANTWORT, GRUND_KUNDIN_STORNIERT, barTokenHash } from '@/lib/bar-bestaetigung'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import { bestellSignatur } from '@/lib/bestell-link'
import { prisma } from '@/lib/prisma'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { sendOnsiteConfirmation } from '@/lib/email'

const findFirst = vi.mocked(prisma.order.findFirst)
const updateMany = vi.mocked(prisma.order.updateMany)
const bremse = vi.mocked(bremseUeberAlleInstanzen)
const mail = vi.mocked(sendOnsiteConfirmation)

const ALT = barTokenHash('V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k')
const IN_DER_FRIST = new Date('2026-10-02T08:30:00Z')

/** Eine offene Barbestellung — erfundene Daten. */
function bestellung(teil: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    farmId: 'farm-1',
    orderNumber: 'HT-0210-A4F2',
    status: 'PENDING_CONFIRMATION',
    paymentMethod: 'ONSITE_CASH',
    totalAmount: 10.3,
    serviceFeeCents: 0,
    customerName: 'Erika Mustermann',
    customerEmail: 'erika@example.org',
    customerPhone: '+43 660 0000000',
    createdAt: new Date('2026-10-02T08:00:00Z'),
    cancelReason: null,
    pickupDate: new Date('2026-10-03T12:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    confirmationToken: ALT,
    stripePaymentIntentId: null,
    farm: {
      id: 'farm-1', slug: 'hof-test', name: 'Hof Test', email: 'hof@example.org', ownerName: 'Max Mustermann',
      address: 'Dorfstraße 12', postalCode: '4910', city: 'Ried', phone: '+43 660 0000000', archivedAt: null,
    },
    items: [{ productName: 'Freilandeier', quantity: 1, unitPrice: 4.5, totalPrice: 4.5, product: { unit: 'STUECK', unitSize: null } }],
    ...teil,
  }
}

function formular(sig = bestellSignatur('order-1'), orderId = 'order-1'): FormData {
  const daten = new FormData()
  daten.set('orderId', orderId)
  daten.set('sig', sig)
  return daten
}

async function senden(daten = formular()) {
  const antwort = await sendeBarLinkErneut({}, daten)
  for (const aufgabe of nachlauf) await aufgabe()
  return antwort
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.length = 0
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(IN_DER_FRIST)
  findFirst.mockResolvedValue(bestellung() as never)
  updateMany.mockResolvedValue({ count: 1 } as never)
  bremse.mockResolvedValue(true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sendeBarLinkErneut — Erfolg', () => {
  it('schreibt den Hash eines NEUEN Tokens, bedingt auf den gelesenen Wert, und mailt genau diesen Token', async () => {
    const antwort = await senden()

    expect(antwort).toEqual({ antwort: BAR_LINK_ERNEUT_ANTWORT })
    expect(updateMany).toHaveBeenCalledTimes(1)
    const aufruf = updateMany.mock.calls[0]![0] as { where: Record<string, unknown>; data: { confirmationToken: string } }
    expect(aufruf.where).toEqual({
      id: 'order-1',
      status: 'PENDING_CONFIRMATION',
      paymentMethod: { not: 'ONLINE' },
      confirmationToken: ALT,
    })
    expect(mail).toHaveBeenCalledTimes(1)
    const [mailBestellung, neuerToken] = mail.mock.calls[0]!
    // Gespeichert der Hash, in der Mail der Token — nie umgekehrt.
    expect(aufruf.data.confirmationToken).toBe(barTokenHash(neuerToken))
    expect(aufruf.data.confirmationToken).not.toBe(ALT)
    expect(neuerToken).toMatch(/^[A-Za-z0-9_-]{32}$/)
    // An die Adresse DER Bestellung.
    expect(mailBestellung.customerEmail).toBe('erika@example.org')
    expect(mailBestellung).toMatchObject({ id: 'order-1', orderNumber: 'HT-0210-A4F2', farm: { slug: 'hof-test' } })
  })

  it('die Mail läuft erst nach der Antwort', async () => {
    await sendeBarLinkErneut({}, formular())

    expect(mail).not.toHaveBeenCalled()
    expect(nachlauf).toHaveLength(1)
  })

  it('bremst je Bestellung über alle Instanzen — Merkmal ist die Bestell-ID', async () => {
    await senden()

    expect(bremse).toHaveBeenCalledWith([{ bremse: DB_BREMSEN.barLinkBestellung, merkmal: 'order-1' }], IN_DER_FRIST)
  })

  it('eine gescheiterte Mail geht nur mit der Bestell-ID nach Sentry, die Antwort bleibt', async () => {
    mail.mockRejectedValueOnce(new Error('Resend gestört'))

    expect(await senden()).toEqual({ antwort: BAR_LINK_ERNEUT_ANTWORT })
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { aufgabe: 'bar-link-erneut' },
      extra: { orderId: 'order-1' },
    })
  })
})

describe('sendeBarLinkErneut — keine Mail, gleiche Antwort', () => {
  async function erwarteNichts(daten = formular()) {
    expect(await senden(daten)).toEqual({ antwort: BAR_LINK_ERNEUT_ANTWORT })
    expect(mail).not.toHaveBeenCalled()
  }

  it('falsche Signatur: nicht einmal eine Datenbankabfrage', async () => {
    await erwarteNichts(formular('f'.repeat(64)))
    expect(findFirst).not.toHaveBeenCalled()
    expect(bremse).not.toHaveBeenCalled()
  })

  it('Signatur einer anderen Bestellung', async () => {
    await erwarteNichts(formular(bestellSignatur('order-2')))
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('kaputte Eingabe', async () => {
    await erwarteNichts(new FormData())
    expect(findFirst).not.toHaveBeenCalled()
  })

  it.each([
    ['bestätigt', { status: 'CONFIRMED', confirmationToken: null }],
    ['storniert', { status: 'CANCELLED', cancelReason: GRUND_KUNDIN_STORNIERT }],
    ['online', { paymentMethod: 'ONLINE' }],
    ['stillgelegter Hof', { farm: { ...bestellung().farm, archivedAt: new Date('2026-10-01T00:00:00Z') } }],
    ['ohne gespeicherten Wert', { confirmationToken: null }],
  ])('%s: nichts geschrieben, nicht gezählt', async (_name, teil) => {
    findFirst.mockResolvedValue(bestellung(teil) as never)

    await erwarteNichts()
    expect(updateMany).not.toHaveBeenCalled()
    expect(bremse).not.toHaveBeenCalled()
  })

  it('nach der Frist: nichts — auch wenn noch niemand aufgeräumt hat', async () => {
    vi.setSystemTime(new Date('2026-10-02T10:30:00Z'))

    await erwarteNichts()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('unbekannte Bestellung', async () => {
    findFirst.mockResolvedValue(null as never)
    await erwarteNichts()
  })

  it('vierte Anforderung am Tag (Bremse voll): nichts geschrieben', async () => {
    bremse.mockResolvedValue(false)

    await erwarteNichts()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('jemand anderes war schneller (count 0): keine Mail', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)
    await erwarteNichts()
  })

  it('Datenbank weg: dieselbe Antwort, Meldung nur mit der Bestell-ID', async () => {
    findFirst.mockRejectedValue(new Error('Verbindung weg'))

    await erwarteNichts()
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { aufgabe: 'bar-link-erneut' },
      extra: { orderId: 'order-1' },
    })
  })
})

describe('sendeBarLinkErneut — Hofpreis-Modell (N38, Nr. 197 Nachbesserung)', () => {
  /** Zwei Zeilen mit Gebühr im Snapshot — erfundene Beträge. Ware 7,50 €, Gebühr 0,54 €. */
  const hofpreis = {
    gebuehrModell: 'hofpreis',
    gebuehrEinzug: 'monatsabrechnung',
    totalAmount: 7.5,
    serviceFeeCents: 54,
    items: [
      { productName: 'Freilandeier', quantity: 1, unitPrice: 4.5, totalPrice: 4.5, gebuehrCents: 32, product: { unit: 'STUECK', unitSize: null } },
      { productName: 'Heumilch', quantity: 2, unitPrice: 1.5, totalPrice: 3, gebuehrCents: 22, product: { unit: 'LITER', unitSize: 1 } },
    ],
  }

  it('liest die Gebühr je Zeile mit', async () => {
    findFirst.mockResolvedValue(bestellung(hofpreis) as never)
    await senden()

    const abfrage = findFirst.mock.calls[0]![0] as { include: { items: { select: Record<string, unknown> } } }
    expect(abfrage.include.items.select).toMatchObject({ gebuehrCents: true })
  })

  it('die erneut gesendete Mail: Summe der Zeilen = Gesamt', async () => {
    findFirst.mockResolvedValue(bestellung(hofpreis) as never)
    await senden()

    const [mailBestellung, token] = mail.mock.calls[0]!
    const echt = await vi.importActual<typeof import('@/lib/email')>('@/lib/email')
    const { html } = await echt.onsiteConfirmationInhalt(mailBestellung, token)

    // Erwartet in ganzen Cent (CODING_STANDARDS §2): Zeile = Ware + Gebühr der Zeile aus dem Snapshot.
    const zeileEierCents = 450 + 32
    const zeileMilchCents = 300 + 22
    const gesamtCents = 750 + 54
    expect(zeileEierCents + zeileMilchCents).toBe(gesamtCents)
    // Nur zur Suche im HTML: ganze Cent als Euro-Text, ohne Fließkomma.
    const euroText = (c: number) => `€ ${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`
    expect(euroText(zeileEierCents)).toBe('€ 4,82')
    // Zeilen mit Endpreis, dann das Gesamt.
    expect(html).toContain(euroText(zeileEierCents))
    expect(html).toContain(euroText(zeileMilchCents))
    expect(html).toContain(euroText(gesamtCents))
    // Keine eigene Gebührenzeile — die Gebühr steckt im Preis.
    expect(html).not.toContain('Servicegebühr')
  })
})
