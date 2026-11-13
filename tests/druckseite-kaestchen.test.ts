/**
 * Kästchen zum Abhaken auf der Packliste (Druckseite, Board w2-druck; Nr. 285).
 *
 * Ursache: Vor jeder Position stand das Zeichen „☐“ (U+2610). Die Emoji-Wache fand es je nach Unicode-Fassung
 * der Laufzeit oder nicht (Unicode 16 rot, Unicode 17 grün). Ein Bildzeichen sieht zudem je Gerät anders aus.
 * Seit Nr. 285 zeichnet das Lucide-Symbol `Square` den Umriss: ein SVG, das auch druckt, wenn der Browser
 * Hintergründe weglässt.
 *
 * Beweist (die echte Seite, serverseitig gerendert, Datenbank und Sitzung als Attrappe):
 *  - Im Abschnitt „Pro Kunde“ steht vor jedem Positionstext genau ein `svg` mit `aria-hidden="true"` und der
 *    Kennung `lucide-square` (Merkmal des Symbols, keine Layout-Klasse).
 *  - Im ganzen Markup steht kein Zeichen aus der festen Bildzeichen-Liste (`tests/bildzeichen-bereiche.ts`).
 *  - Gegenprobe: Das alte Markup mit „☐“ schlägt bei beiden Prüfungen an.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BILDZEICHEN_BEREICHE } from './bildzeichen-bereiche'

const m = vi.hoisted(() => ({ findMany: vi.fn() }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/server/hofbereich', () => ({ verlangeHofDerSitzung: async () => ({ userId: 'u1', farmId: 'farm_1' }) }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: async () => ({ id: 'farm_1', name: 'Hof Test' }) }))
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findMany: m.findMany } } }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: async () => {} }))

import PrintPacklistPage from '@/app/(druck)/orders/today/print/page'

const POSITIONEN = ['Heumilch frisch', 'Bergkäse', 'Eier vom Hof']

function bestellung(id: string, kunde: string, namen: string[]) {
  return {
    id,
    customerName: kunde,
    orderNumber: `FZ-${id}`,
    pickupTimeStart: '14:00',
    pickupTimeEnd: '16:00',
    status: 'CONFIRMED',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    totalAmount: '5.00',
    serviceFeeCents: 0,
    serviceFeeRefundedAt: null,
    gebuehrModell: null,
    items: namen.map((productName) => ({ productName, quantity: 2, product: null })),
  }
}

const alsEscape = (codepunkt: number): string => `\\u{${codepunkt.toString(16)}}`
const BILDZEICHEN = new RegExp(
  `[${BILDZEICHEN_BEREICHE.map(([von, bis]) => (von === bis ? alsEscape(von) : `${alsEscape(von)}-${alsEscape(bis)}`)).join('')}]`,
  'gu'
)

/** Jedes Zeichen aus der festen Liste im Text. Leer = in Ordnung. */
function bildzeichenIn(text: string): string[] {
  return [...text.matchAll(BILDZEICHEN)].map((treffer) => treffer[0])
}

/** Befunde je Position im Abschnitt „Pro Kunde“: genau ein verborgenes Square-Symbol zwischen Vorgänger und Text. */
function pruefeKaestchen(html: string, namen: string[]): string[] {
  const start = html.indexOf('Pro Kunde')
  if (start === -1) return ['Abschnitt „Pro Kunde“ fehlt']
  const abschnitt = html.slice(start)
  const befunde: string[] = []
  let ab = 0
  for (const name of namen) {
    const stelle = abschnitt.indexOf(name, ab)
    if (stelle === -1) {
      befunde.push(`${name}: Positionstext fehlt`)
      continue
    }
    const svg = abschnitt.slice(ab, stelle).match(/<svg[^>]*>/g) ?? []
    if (svg.length !== 1) befunde.push(`${name}: ${svg.length} svg davor statt 1`)
    else {
      if (!svg[0].includes('aria-hidden="true"')) befunde.push(`${name}: svg ohne aria-hidden="true"`)
      if (!svg[0].includes('lucide-square')) befunde.push(`${name}: svg ist nicht das Symbol Square`)
    }
    ab = stelle + name.length
  }
  return befunde
}

describe('Druckseite: Kästchen zum Abhaken als Lucide-Symbol (Nr. 285)', () => {
  it('vor jeder Position steht ein verborgenes Square-Symbol, im Markup kein Bildzeichen', async () => {
    m.findMany.mockResolvedValue([bestellung('a1', 'Max Mustermann', POSITIONEN.slice(0, 2)), bestellung('a2', 'Erika Muster', POSITIONEN.slice(2))])

    const html = renderToStaticMarkup(await PrintPacklistPage())

    expect(pruefeKaestchen(html, POSITIONEN)).toEqual([])
    expect(bildzeichenIn(html)).toEqual([])
  })

  it('Gegenprobe: das alte Markup mit „☐“ schlägt bei beiden Prüfungen an', () => {
    const alt = `<h2>Pro Kunde (1)</h2>${POSITIONEN.map((name) => `<div><span aria-hidden="true">☐ </span>${name}</div>`).join('')}`

    expect(pruefeKaestchen(alt, POSITIONEN)).toEqual(POSITIONEN.map((name) => `${name}: 0 svg davor statt 1`))
    expect(bildzeichenIn(alt)).toEqual(['☐', '☐', '☐'])
    expect(pruefeKaestchen('<h2>Pro Kunde</h2><div><svg class="lucide lucide-square">', ['Heumilch'])).toEqual(['Heumilch: Positionstext fehlt'])
    expect(pruefeKaestchen('<h2>Pro Kunde</h2><svg class="lucide lucide-check">Heumilch', ['Heumilch'])).toEqual([
      'Heumilch: svg ohne aria-hidden="true"',
      'Heumilch: svg ist nicht das Symbol Square',
    ])
  })
})
