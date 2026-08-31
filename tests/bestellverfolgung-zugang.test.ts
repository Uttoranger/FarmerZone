/**
 * Tests für den DURCHSETZUNGSPUNKT der Bestellverfolgung: nicht die reine
 * Funktion (tests/bestellverfolgung.test.ts), sondern Seite und ICS-Route
 * selbst — mit gemocktem Prisma (Muster wie tests/hofuebersicht.test.ts).
 *
 * Der Anlass ist ein Mutationsbefund: Die Signaturprüfung ließ sich aus
 * page.tsx und route.ts ersatzlos streichen, ohne dass die Suite rot wurde.
 * Diese Tests machen genau das unmöglich — sie rufen die ECHTEN Handler auf
 * und verlangen: falsche Signatur → Ablehnung OHNE Datenbank-Zugriff, und
 * die Ablehnung ist für „falsche Signatur" und „Bestellung existiert nicht"
 * BYTE-GLEICH (kein Existenz-Orakel).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: vi.fn() } },
}))

import { NextRequest } from 'next/server'
import { GET } from '@/app/(public)/[farmSlug]/bestellung/[orderId]/kalender/route'
import BestellungPage from '@/app/(public)/[farmSlug]/bestellung/[orderId]/page'
import { bestellSignatur } from '@/lib/bestell-link'
import { prisma } from '@/lib/prisma'

const findUnique = vi.mocked(prisma.order.findUnique)

/** Eine Bestellung, wie die Query sie liefert. */
function bestellung(teil: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'HM-2611-A4F2',
    status: 'READY',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    totalAmount: 25,
    pickupDate: new Date('2026-09-04T12:00:00Z'),
    pickupTimeStart: '14:00',
    pickupTimeEnd: '16:00',
    farm: {
      slug: 'hof-probe',
      name: 'Hof Müller',
      address: 'Dorfstraße 12',
      postalCode: '4910',
      city: 'Ried im Innkreis',
      archivedAt: null,
    },
    items: [
      {
        productName: 'Bergkäse',
        quantity: 2,
        unitPrice: 12.5,
        totalPrice: 25,
        product: { unit: 'KG', unitSize: null },
      },
    ],
    ...teil,
  }
}

function icsAnfrage(orderId: string, s: string) {
  return GET(
    new NextRequest(`http://localhost:3000/hof-probe/bestellung/${orderId}/kalender?s=${s}`),
    { params: Promise.resolve({ farmSlug: 'hof-probe', orderId }) }
  )
}

/**
 * Zieht allen TEXT aus einem Server-Elementbaum: Zeichenketten direkt,
 * Funktions-Komponenten werden aufgerufen (LinkUngueltig, Marke — reine
 * Funktionen ohne Hooks). Wo ein Aufruf nicht geht (next/link nutzt Hooks),
 * genügt die Kinder-Prop — der sichtbare Text steckt dort.
 */
async function elementText(el: unknown): Promise<string> {
  if (el == null || typeof el === 'boolean') return ''
  if (typeof el === 'string' || typeof el === 'number') return String(el)
  if (Array.isArray(el)) {
    let text = ''
    for (const kind of el) text += await elementText(kind)
    return text
  }
  const element = el as { type?: unknown; props?: { children?: unknown } }
  if (!element.props) return ''
  if (typeof element.type === 'function') {
    try {
      return await elementText(await (element.type as (p: unknown) => unknown)(element.props))
    } catch {
      // Komponente braucht React-Kontext (Hooks) — der Text der Kinder reicht.
    }
  }
  return elementText(element.props.children)
}

async function seite(orderId: string, s: string | undefined, farmSlug = 'hof-probe') {
  const element = await BestellungPage({
    params: Promise.resolve({ farmSlug, orderId }),
    searchParams: Promise.resolve({ s }),
  })
  return elementText(element)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ICS-Route — die Signatur wird an der Route selbst durchgesetzt', () => {
  it('falsche Signatur: 404, und die Datenbank wird NICHT einmal gefragt', async () => {
    const antwort = await icsAnfrage('order-1', 'f'.repeat(64))
    expect(antwort.status).toBe(404)
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('kein Existenz-Orakel: „falsche Signatur" und „Bestellung fehlt" antworten byte-gleich', async () => {
    const falscheSignatur = await icsAnfrage('order-1', 'f'.repeat(64))
    findUnique.mockResolvedValue(null as never)
    const fehlend = await icsAnfrage('order-1', bestellSignatur('order-1'))

    expect(fehlend.status).toBe(falscheSignatur.status)
    expect(await fehlend.text()).toBe(await falscheSignatur.text())
  })

  it('gültige Signatur liefert die Kalenderdatei zum richtigen Termin', async () => {
    findUnique.mockResolvedValue(bestellung() as never)
    const antwort = await icsAnfrage('order-1', bestellSignatur('order-1'))

    expect(antwort.status).toBe(200)
    expect(antwort.headers.get('content-type')).toContain('text/calendar')
    const ics = await antwort.text()
    expect(ics).toContain('DTSTART;TZID=Europe/Vienna:20260904T140000')
    expect(ics).toContain('SUMMARY:Abholung Hof Müller')
    // Entfaltet (Faltung rückgängig), weil die 75-Oktett-Faltung Wörter
    // mitten im Link trennen darf.
    expect(ics.replace(/\r\n /g, '')).toContain('Bestellung HM-2611-A4F2')
  })

  it('ein fremder Hof-Slug in der URL wird abgelehnt wie eine falsche Signatur', async () => {
    findUnique.mockResolvedValue(bestellung() as never)
    const antwort = await GET(
      new NextRequest(
        `http://localhost:3000/anderer-hof/bestellung/order-1/kalender?s=${bestellSignatur('order-1')}`
      ),
      { params: Promise.resolve({ farmSlug: 'anderer-hof', orderId: 'order-1' }) }
    )
    expect(antwort.status).toBe(404)
  })

  it('storniert: kein Termin, keine Datei', async () => {
    findUnique.mockResolvedValue(bestellung({ status: 'CANCELLED' }) as never)
    const antwort = await icsAnfrage('order-1', bestellSignatur('order-1'))
    expect(antwort.status).toBe(404)
  })
})

describe('Bestellseite — die Signatur wird an der Seite selbst durchgesetzt', () => {
  it('falsche Signatur: ruhige Seite, KEIN Datenbank-Zugriff, keine Bestelldaten', async () => {
    const html = await seite('order-1', 'f'.repeat(64))
    expect(html).toContain('Dieser Link ist nicht gültig')
    expect(html).not.toContain('HM-2611')
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('ohne Signatur-Parameter dasselbe', async () => {
    const html = await seite('order-1', undefined)
    expect(html).toContain('Dieser Link ist nicht gültig')
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('gültige Signatur, Bestellung fehlt: dieselbe ruhige Seite — kein Existenz-Orakel', async () => {
    findUnique.mockResolvedValue(null as never)
    const gueltigOhneBestellung = await seite('order-1', bestellSignatur('order-1'))
    const falscheSignatur = await seite('order-1', 'f'.repeat(64))
    expect(gueltigOhneBestellung).toBe(falscheSignatur)
  })

  it('gültige Signatur zeigt Bestellnummer, Status-Marke, Positionen und Zahlung', async () => {
    findUnique.mockResolvedValue(bestellung() as never)
    const html = await seite('order-1', bestellSignatur('order-1'))
    expect(html).toContain('HM-2611-A4F2')
    expect(html).toContain('Abholbereit')
    expect(html).toContain('Dein Paket wartet')
    expect(html).toContain('Bergkäse')
    expect(html).toContain('Termin in den Kalender')
    expect(html).toContain('Online')
  })

  it('ein stillgelegter Hof verhält sich wie eine unbekannte Bestellung', async () => {
    findUnique.mockResolvedValue(
      bestellung({
        farm: { ...bestellung().farm, archivedAt: new Date('2026-01-01') },
      }) as never
    )
    const html = await seite('order-1', bestellSignatur('order-1'))
    expect(html).toContain('Dieser Link ist nicht gültig')
    expect(html).not.toContain('HM-2611')
  })
})

describe('Bestell-Link — das Zweck-Präfix ist festgenagelt', () => {
  it('die Signatur ist das HMAC über „bestellung-ansehen:{id}", NICHT über die nackte ID', () => {
    // Nagelt das Payload-Schema fest: Eine Änderung bräche alle bereits
    // versendeten Mail-Links UND die Domänentrennung gegenüber
    // reorder-token/unsubscribe (dasselbe Secret) — beides darf kein
    // stiller Refactor lösen.
    const secret = process.env.BETTER_AUTH_SECRET!
    expect(bestellSignatur('order-1')).toBe(
      createHmac('sha256', secret).update('bestellung-ansehen:order-1').digest('hex')
    )
    expect(bestellSignatur('order-1')).not.toBe(
      createHmac('sha256', secret).update('order-1').digest('hex')
    )
  })
})
