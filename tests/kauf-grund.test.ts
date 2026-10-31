/**
 * Nr. 205 Punkt 1: Der Mini-Warenkorb der Seitenspalte zeigt während der
 * Notbremse oder einer Sperre statt „Zur Kasse“ den Satz mit Grund — wie das
 * Korb-Blatt. EINE Quelle für beide: `KaufGrund`.
 *
 * Beweist (je mit Gegenprobe):
 *  - ohne Sperre und ohne Notbremse: „Zur Kasse“ steht da, kein Hinweis;
 *  - Notbremse: Satz samt „bis …“, kein „Zur Kasse“;
 *  - Sperre des Hofs geht vor (Pause nennt den Hofnamen, nie den Satz der Notbremse);
 *  - Mini-Warenkorb und Korb-Blatt benutzen beide `KaufGrund` (Quelltext).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Bestellstopp } from '@/lib/notbremse'

const browser = vi.hoisted(() => ({ stopp: null as Bestellstopp | null }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@/components/notbremse-band', async (original) => ({
  ...(await original<typeof import('@/components/notbremse-band')>()),
  useBestellstopp: () => browser.stopp,
}))
// Das Korb-Blatt rendert sein Fenster beim Server-Rendern nicht (Portal): Der Inhalt steht an Ort und Stelle.
vi.mock('@/components/ui/sheet', async (original) => {
  const echt = await original<typeof import('@/components/ui/sheet')>()
  type Kinder = { children?: ReactNode }
  return {
    ...echt,
    Sheet: (p: Kinder) => createElement('div', null, p.children),
    SheetContent: (p: Kinder) => createElement('section', null, p.children),
    SheetTitle: (p: Kinder) => createElement('h2', null, p.children),
  }
})
vi.mock('@/lib/use-warenkorb-kopf', () => ({
  useWarenkorbVomHof: () => [{ productId: 'p1', name: 'Heumilch', price: 1.5, quantity: 2, unit: 'L', unitSize: null, imageUrl: null, farmId: 'f1' }],
}))

import { HofseiteSeitenspalte, type SeitenspalteHof } from '@/components/hofseite/hofseite-seitenspalte'
import { CartSheet } from '@/components/farm/cart-sheet'
import { KaufGrund } from '@/components/hofseite/kauf-grund'
import type { KaufSperre } from '@/lib/bereiche-anzeige'

const STOPP: Bestellstopp = { satz: 'Bestellen geht gleich wieder.', bis: '2026-10-26T10:00:00.000Z' }
const HOF: SeitenspalteHof = { id: 'f1', slug: 'hof-test', name: 'Musterdorf', address: 'Weg 1', postalCode: '1000', city: 'Ort', pauseMessage: null, pickupSlots: [] }
const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

function spalte(sperre: KaufSperre = null): string {
  return renderToStaticMarkup(
    createElement(HofseiteSeitenspalte, { hof: HOF, sperre, zahlungsarten: [], gebuehrKurz: null, gebuehrKorb: null, mitKorb: true, jetzt: '2026-10-26T08:00:00.000Z' })
  )
}

beforeEach(() => {
  browser.stopp = null
})

describe('Mini-Warenkorb der Seitenspalte: Grund statt „Zur Kasse“', () => {
  it('Gegenprobe: ohne Sperre und Notbremse steht „Zur Kasse“', () => {
    const html = spalte()
    expect(html).toContain('Zur Kasse')
    expect(html).not.toContain(STOPP.satz)
  })

  it('Notbremse: der Satz mit „bis …“ steht da, „Zur Kasse“ fehlt', () => {
    browser.stopp = STOPP
    const html = spalte()
    expect(html).toContain(STOPP.satz)
    expect(html).toContain('bis ')
    expect(html).not.toContain('Zur Kasse')
  })

  it('Sperre des Hofs geht vor der Notbremse', () => {
    browser.stopp = STOPP
    const html = spalte('pause')
    expect(html).toContain('Musterdorf pausiert gerade.')
    expect(html).not.toContain(STOPP.satz)
    expect(html).not.toContain('Zur Kasse')
  })
})

describe('Korb-Blatt: Grund statt „Zur Kasse“ (Nr. 205)', () => {
  const posten = { productId: 'p1', name: 'Heumilch', price: 1.5, quantity: 2, unit: 'L', unitSize: null, imageUrl: null, farmId: 'f1' }
  function blatt(sperre: KaufSperre = null): string {
    return renderToStaticMarkup(
      createElement(CartSheet, {
        open: true,
        onOpenChange: () => {},
        items: [posten],
        total: 3,
        farmSlug: 'hof-test',
        onUpdateQuantity: () => {},
        onRemoveItem: () => {},
        kaufSperre: { hofName: 'Musterdorf', pauseMessage: null, sperre },
      })
    )
  }

  it('Gegenprobe: ohne Sperre und Notbremse steht „Zur Kasse“', () => {
    const html = blatt()
    expect(html).toContain('Zur Kasse')
    expect(html).not.toContain(STOPP.satz)
  })

  it('mit Notbremse steht der Satz, „Zur Kasse“ fehlt', () => {
    browser.stopp = STOPP
    const html = blatt()
    expect(html).toContain(STOPP.satz)
    expect(html).not.toContain('Zur Kasse')
  })

  it('mit Sperre des Hofs steht ihr Grund statt des Notbremse-Satzes', () => {
    browser.stopp = STOPP
    const html = blatt('pause')
    expect(html).toContain('Musterdorf pausiert gerade.')
    expect(html).not.toContain(STOPP.satz)
    expect(html).not.toContain('Zur Kasse')
  })
})

describe('KaufGrund: eine Quelle', () => {
  const basis = { hofName: 'Musterdorf', pauseMessage: null }
  it('ohne Grund nichts, sonst Sperre vor Notbremse', () => {
    expect(KaufGrund({ ...basis, sperre: null, stopp: null })).toBeNull()
    expect(renderToStaticMarkup(KaufGrund({ ...basis, sperre: null, stopp: STOPP }))).toContain(STOPP.satz)
    expect(renderToStaticMarkup(KaufGrund({ ...basis, sperre: 'ausgebucht', stopp: STOPP }))).not.toContain(STOPP.satz)
  })

  it('Mini-Warenkorb und Korb-Blatt lesen beide KaufGrund', () => {
    for (const pfad of ['src/components/hofseite/hofseite-seitenspalte.tsx', 'src/components/farm/cart-sheet.tsx']) {
      expect(quelle(pfad), pfad).toContain('<KaufGrund')
    }
  })
})
