/**
 * Das Korb-Blatt zeigt die Zeilensumme in ganzen Cent (Nr. 139; CODING_STANDARDS §2 „Geld“).
 *
 * Fehler: Die Zeile rechnete `item.price * item.quantity` in Fließkomma; 3 × 1,10 € war 3,3000000000000003 €. Weil
 * formatEuro das als „€ 3,30“ zeigt, prüft der Test den Zahlenwert, der an formatEuro geht, nicht den Text: Die Zeile
 * kommt aus `korbBetraege(items).zeilenCents` (wie der Mini-Warenkorb), also genau 3.3.
 */
import { Fragment, createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const angezeigt = vi.hoisted(() => ({ betraege: [] as number[] }))

// Das Blatt rendert sonst in ein Portal, das renderToStaticMarkup nicht ausgibt: hier inline, wie in
// tests/kaufen-nur-mit-abholtermin.test.ts.
vi.mock('@/components/ui/sheet', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/ui/sheet')>()
  type Kinder = { open?: boolean; children?: ReactNode }
  return {
    ...echt,
    Sheet: (props: Kinder) => createElement(Fragment, null, props.open ? props.children : null),
    SheetContent: (props: Kinder) => createElement('section', null, props.children),
    SheetTitle: (props: Kinder) => createElement('h2', null, props.children),
  }
})

vi.mock('@/lib/format', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/lib/format')>()
  return {
    ...echt,
    formatEuro: (betrag: number) => {
      angezeigt.betraege.push(betrag)
      return echt.formatEuro(betrag)
    },
  }
})

import { CartSheet } from '@/components/farm/cart-sheet'
import type { CartItem } from '@/lib/use-cart'

const BROT: CartItem = { productId: 'prod_brot', name: 'Brot', price: 1.1, unit: 'Stück', unitSize: 1, imageUrl: null, quantity: 3 }

describe('Korb-Blatt: Zeilensumme in ganzen Cent (Nr. 139)', () => {
  it('3 × 1,10 € geht als genau 3.3 an formatEuro, nicht als 3.3000000000000003', () => {
    angezeigt.betraege = []
    const html = renderToStaticMarkup(
      createElement(CartSheet, {
        open: true,
        onOpenChange: () => {},
        items: [BROT],
        // Eine Summe, die von der Zeile abweicht: So prüft `toContain(3.3)` die Zeile, nicht die Summe.
        total: 9.99,
        farmSlug: 'hof-test',
        onUpdateQuantity: () => {},
        onRemoveItem: () => {},
        kaufSperre: { sperre: null, hofName: 'Hof Test', pauseMessage: null },
      })
    )
    expect(html).toContain('Brot')
    expect(angezeigt.betraege).toContain(3.3)
    expect(angezeigt.betraege).not.toContain(3.3000000000000003)
  })
})
