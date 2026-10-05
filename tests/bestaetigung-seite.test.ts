/**
 * Die Bestätigungsseite /{hof}/confirm/{orderId} im neuen Design (Nr. 13).
 *
 * Zugang und Zustand aus der Datenbank beweist weiter
 * tests/bestaetigung-zugang.test.ts. Hier, an der echten Seite (Prisma
 * gemockt, gerendert mit renderToStaticMarkup):
 *  - Sie steht in der KundeShell ohne Unterleiste (Fokus-Seite mit Kopf).
 *  - Status-Schritte folgen dem Bestellstatus aus der Datenbank.
 *  - Bar offen: Frist aus fristen.ts und der Hinweis auf die Mail.
 *  - Die Bestellnummer wird nur angezeigt — kein Link baut auf ihr auf.
 *  - „Erzähl's weiter" bekommt nur Name und Slug des Hofs, nie die
 *    Signatur oder die Bestell-ID; geteilt wird die öffentliche Hofseite.
 *  - Beträge über die gemeinsamen Formatierer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { shellProps, teilenProps } = vi.hoisted(() => ({
  shellProps: [] as Array<Record<string, unknown>>,
  teilenProps: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: vi.fn() } } }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: (p: { unterleiste?: boolean; children?: ReactNode }) => {
    shellProps.push({ unterleiste: p.unterleiste })
    return createElement('div', { 'data-shell': 'kunde' }, p.children)
  },
}))
vi.mock('@/components/checkout/clear-cart-on-mount', () => ({ ClearCartOnMount: () => null }))
vi.mock('@/components/bestaetigung/hof-teilen-karte', () => ({
  HofTeilenKarte: (p: Record<string, unknown>) => {
    teilenProps.push(p)
    return createElement('section', { 'data-teilen': 'hof' }, "Erzähl's weiter")
  },
}))

import ConfirmPage, { metadata } from '@/app/(public)/[farmSlug]/confirm/[orderId]/page'
import { bestellLinkGilt, bestellSignatur } from '@/lib/bestell-link'
import { prisma } from '@/lib/prisma'

const findUnique = vi.mocked(prisma.order.findUnique)
const GUELTIG = bestellSignatur('order-1')
const JETZT = new Date('2026-10-05T08:20:00Z')

function bestellung(teil: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    farmId: 'farm-1',
    orderNumber: 'HT-0210-A4F2',
    status: 'PENDING_CONFIRMATION',
    paymentMethod: 'ONSITE_CASH',
    paymentStatus: 'PENDING',
    totalAmount: 10.3,
    serviceFeeCents: 52,
    serviceFeeRefundedAt: null,
    customerName: 'Erika Beispiel',
    customerEmail: 'erika@example.org',
    createdAt: new Date('2026-10-05T08:12:00Z'),
    cancelReason: null,
    pickupDate: new Date('2026-10-05T12:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    farm: {
      slug: 'hof-test',
      name: 'Hof Test',
      address: 'Feldweg 1',
      postalCode: '4910',
      city: 'Beispieldorf',
      archivedAt: null,
    },
    items: [
      { productName: 'Freilandeier', quantity: 1, unitPrice: 4.5, totalPrice: 4.5, product: { unit: 'STUECK', unitSize: null } },
      { productName: 'Bauernbrot', quantity: 1, unitPrice: 5.8, totalPrice: 5.8, product: { unit: 'STUECK', unitSize: null } },
    ],
    ...teil,
  }
}

async function seite(suche: Record<string, string | undefined> = { sig: GUELTIG }): Promise<string> {
  const element = await ConfirmPage({
    params: Promise.resolve({ farmSlug: 'hof-test', orderId: 'order-1' }),
    searchParams: Promise.resolve(suche),
  })
  return renderToStaticMarkup(element)
}

/** Text ohne Tags, Entities aufgelöst — für Sätze über mehrere Elemente. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
}

beforeEach(() => {
  vi.clearAllMocks()
  shellProps.length = 0
  teilenProps.length = 0
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(JETZT)
  findUnique.mockResolvedValue(bestellung() as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Bestätigungsseite — Shell und Kopf', () => {
  it('steht in der KundeShell ohne Unterleiste — mit und ohne Signatur', async () => {
    await seite()
    await seite({})
    expect(shellProps).toEqual([{ unterleiste: false }, { unterleiste: false }])
  })

  it('bleibt aus dem Suchindex und gibt keinen Referrer weiter', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.referrer).toBe('no-referrer')
  })

  it('ohne Signatur: ein Ausweg zu den Höfen, kein Link zur Bestellung', async () => {
    const html = await seite({})
    expect(hrefs(html)).toContain('/hoefe')
    expect(html).not.toContain('order-1')
    expect(findUnique).not.toHaveBeenCalled()
  })
})

describe('Bar, wartet auf Bestätigung', () => {
  it('nennt die echte Frist aus fristen.ts und die Adresse, an die der Link ging', async () => {
    const t = text(await seite())
    expect(t).toContain('Fast geschafft – bitte bestätige per E-Mail')
    expect(t).toContain('erika@example.org')
    // 10:12 Uhr bestellt + zwei Stunden, vor dem Abholbeginn 15:00 Uhr.
    expect(t).toContain('Bestätigen bis heute, 12:12 Uhr')
    expect(t).toContain('Danach geben wir die Ware wieder frei')
  })

  it('der Schritt „Bestätigt" ist dran, nicht erledigt', async () => {
    const html = await seite()
    expect(html).toMatch(/data-stand="naechster"[^>]*aria-current="step"|aria-current="step"[^>]*data-stand="naechster"/)
    expect(text(html)).toContain('Bestätigt')
    expect(text(html)).not.toContain('Bestellung bestätigt')
  })

  it('kein „Erzähl\'s weiter", solange nichts bestätigt ist', async () => {
    await seite()
    expect(teilenProps).toEqual([])
  })

  it('Beträge über die Formatierer: Waren, Servicegebühr als eigene Zeile, Gesamt', async () => {
    const t = text(await seite())
    expect(t).toContain('€ 4,50')
    expect(t).toContain('€ 5,80')
    expect(t).toContain('Servicegebühr')
    expect(t).toContain('€ 0,52')
    expect(t).toContain('€ 10,82')
    expect(t).toContain('Bar bei Abholung · Noch offen')
  })
})

describe('Online bezahlt', () => {
  beforeEach(() => {
    findUnique.mockResolvedValue(
      bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PAID', status: 'PAID' }) as never
    )
  })

  it('Dank, Bestellnummer als Anzeige, Status-Schritte bis „Bezahlt"', async () => {
    const html = await seite()
    const t = text(html)
    expect(t).toContain('Danke, deine Bestellung ist da!')
    expect(t).toContain('Zahlung erfolgreich')
    expect(t).toContain('Bestellnummer')
    expect(t).toContain('HT-0210-A4F2')
    expect(t).not.toContain('Abholcode')
    expect(html).toMatch(/data-schritt="bezahlt"[^>]*data-stand="erledigt"/)
    expect(html).toMatch(/data-schritt="gepackt"[^>]*data-stand="naechster"/)
  })

  it('die Bestellnummer ist nie Teil eines Links — sie ist keine Berechtigung', async () => {
    const html = await seite()
    // Gegenprobe: Die Nummer steht auf der Seite.
    expect(html).toContain('HT-0210-A4F2')
    for (const href of hrefs(html)) expect(href, href).not.toContain('HT-0210-A4F2')
  })

  it('Links zur Bestellung und zum Kalender tragen eine gültige Signatur', async () => {
    const intern = hrefs(await seite()).filter((h) => h.startsWith('/hof-test/bestellung/'))
    expect(intern.map((h) => new URL(h, 'http://x').pathname).sort()).toEqual([
      '/hof-test/bestellung/order-1',
      '/hof-test/bestellung/order-1/kalender',
    ])
    for (const h of intern) {
      expect(bestellLinkGilt('order-1', new URL(h, 'http://x').searchParams.get('s') ?? ''), h).toBe(true)
    }
  })

  it('„Erzähl\'s weiter" bekommt nur Name und Slug des Hofs — nie Signatur oder Bestell-ID', async () => {
    await seite()
    expect(teilenProps).toEqual([{ hofName: 'Hof Test', hofSlug: 'hof-test' }])
    const props = JSON.stringify(teilenProps)
    expect(props).not.toContain(GUELTIG)
    expect(props).not.toContain('order-1')
    expect(props).not.toContain('HT-0210-A4F2')
  })

  it('„Route planen" führt zur Hofadresse, nicht zu einer Adresse mit Personendaten', async () => {
    const route = hrefs(await seite()).find((h) => h.startsWith('https://www.google.com/maps/'))
    expect(route).toBeDefined()
    expect(route).toContain(encodeURIComponent('Feldweg 1'))
    expect(route).not.toContain('erika')
  })
})

describe('Status aus der Datenbank', () => {
  it('abholbereit: „Gepackt" erledigt, „Abgeholt" ist dran', async () => {
    findUnique.mockResolvedValue(bestellung({ status: 'READY' }) as never)
    const html = await seite()
    expect(text(html)).toContain('Deine Bestellung liegt bereit')
    expect(html).toMatch(/data-schritt="gepackt"[^>]*data-stand="erledigt"/)
    expect(html).toMatch(/data-schritt="abgeholt"[^>]*data-stand="naechster"/)
  })

  it('Zahlung wird geprüft: Abholkarte ohne „In den Kalender" — der Termin steht erst mit der Zahlung', async () => {
    findUnique.mockResolvedValue(bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PENDING' }) as never)
    const html = await seite({ sig: GUELTIG, redirect_status: 'succeeded' })
    expect(text(html)).toContain('Zahlung wird geprüft')
    // Gegenprobe: die Abholkarte ist da (Route), nur der Kalender fehlt.
    expect(text(html)).toContain('Route planen')
    expect(html).not.toContain('/kalender')
    expect(text(html)).not.toContain('In den Kalender')
  })

  it('storniert: keine Schritte, kein Kalender, kein Teilen — aber ein Weg zur Bestellung', async () => {
    findUnique.mockResolvedValue(bestellung({ status: 'CANCELLED', cancelReason: 'Vom Hof storniert' }) as never)
    const html = await seite()
    expect(text(html)).toContain('Bestellung storniert')
    expect(html).not.toContain('data-schritt=')
    expect(html).not.toContain('/kalender')
    expect(teilenProps).toEqual([])
    expect(hrefs(html).some((h) => h.startsWith('/hof-test/bestellung/order-1?s='))).toBe(true)
  })

  it('alte Bestellung mit Karte bei Abholung (E5) wird weiter richtig benannt', async () => {
    findUnique.mockResolvedValue(bestellung({ status: 'CONFIRMED', paymentMethod: 'ONSITE_CARD' }) as never)
    const t = text(await seite())
    expect(t).toContain('Karte bei Abholung')
    expect(t).not.toContain('Bar bei Abholung')
  })
})

describe('„Hof teilen" teilt die öffentliche Hofseite', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('geteilt wird origin + Slug — ohne Pfad der Bestellung, ohne Parameter', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { location: { origin: 'https://farmerzone.example', href: `https://farmerzone.example/hof-test/confirm/order-1?sig=${GUELTIG}` } })
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } })
    const { teileHof } = await import('@/components/shared/hof-teilen')

    await teileHof({ name: 'Hof Test', slug: 'hof-test' })

    expect(share).toHaveBeenCalledTimes(1)
    const geteilt = share.mock.calls[0][0] as { url: string; text: string }
    expect(geteilt.url).toBe('https://farmerzone.example/hof-test')
    // Gegenprobe zur Adresse, auf der die Kundin gerade steht.
    expect(JSON.stringify(geteilt)).not.toContain(GUELTIG)
    expect(JSON.stringify(geteilt)).not.toContain('confirm')
  })
})
