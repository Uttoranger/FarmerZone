/**
 * Der Verantwortungs-Hinweis zu Futter (E10a) im Mini-Warenkorb der Seitenspalte (Nr. 235, UI-Runde 3) —
 * gerendert in Node (TESTING_GUIDELINES §1).
 *
 * Beweist (je mit Gegenprobe):
 *  - Hofseite (Vorgabe): Liegt Futter im Korb, steht der Satz aus E10a unter der Summe.
 *  - Produktseite (`mitFutterHinweis={false}`): kein Satz im Mini-Warenkorb — er läse sich dort wie ein Satz
 *    über das Produkt der Seite (auch Brennholz). Summe und „Zur Kasse“ bleiben.
 *  - Ohne Futter im Korb nie ein Satz.
 *  - Die Produktseite schaltet ihn ab (Quelltext), die Hofseite nicht.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const korb = vi.hoisted(() => ({ produktId: 'p_heu' }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@/components/notbremse-band', async (original) => ({
  ...(await original<typeof import('@/components/notbremse-band')>()),
  useBestellstopp: () => null,
}))
vi.mock('@/lib/use-warenkorb-kopf', () => ({
  useWarenkorbVomHof: () => [{ productId: korb.produktId, name: 'Wiesenheu', price: 6, quantity: 1, unit: 'BALLEN', unitSize: null, imageUrl: null, farmId: 'f1' }],
}))

import { HofseiteSeitenspalte, type SeitenspalteHof } from '@/components/hofseite/hofseite-seitenspalte'
import { KUNDEN_VERANTWORTUNG } from '@/lib/futter-registrierung'

const HOF: SeitenspalteHof = { id: 'f1', slug: 'hof-test', name: 'Musterdorf', address: 'Weg 1', postalCode: '1000', city: 'Ort', pauseMessage: null, pickupSlots: [] }
const PRODUKTE = [
  { id: 'p_heu', category: 'HEU_STROH' as const, abgabe: 'ALLE' as const },
  { id: 'p_holz', category: 'BRENNHOLZ' as const, abgabe: 'ALLE' as const },
]
const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

function spalte(mitFutterHinweis?: boolean): string {
  return renderToStaticMarkup(
    createElement(HofseiteSeitenspalte, {
      hof: HOF,
      sperre: null,
      zahlungsarten: [],
      gebuehrHinweis: null,
      gebuehrKorb: null,
      mitKorb: true,
      jetzt: '2026-11-05T08:00:00.000Z',
      produkte: PRODUKTE,
      ...(mitFutterHinweis === undefined ? {} : { mitFutterHinweis }),
    })
  )
}

describe('Futter-Hinweis im Mini-Warenkorb (E10a)', () => {
  it('Hofseite: mit Futter im Korb steht der Satz unter der Summe', () => {
    korb.produktId = 'p_heu'
    const html = spalte()
    expect(html).toContain(KUNDEN_VERANTWORTUNG)
    expect(html.indexOf('1 Produkt')).toBeLessThan(html.indexOf(KUNDEN_VERANTWORTUNG))
  })

  it('Produktseite: ohne den Satz — Summe und „Zur Kasse“ bleiben (Gegenprobe oben: derselbe Korb mit Satz)', () => {
    korb.produktId = 'p_heu'
    const html = spalte(false)
    expect(html).not.toContain(KUNDEN_VERANTWORTUNG)
    expect(html).toContain('1 Produkt')
    expect(html).toContain('Zur Kasse')
  })

  it('ohne Futter im Korb nie ein Satz', () => {
    korb.produktId = 'p_holz'
    expect(spalte()).not.toContain(KUNDEN_VERANTWORTUNG)
    expect(spalte()).toContain('Zur Kasse')
  })

  it('die Produktseite schaltet ihn ab, die Hofseite nicht (Quelltext)', () => {
    expect(quelle('src/components/produktdetail/produktdetail-kunde.tsx')).toContain('mitFutterHinweis={false}')
    expect(quelle('src/components/hofseite/hofseite-kunde.tsx')).not.toContain('mitFutterHinweis')
  })
})
