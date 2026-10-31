/**
 * Testhof-Hinweis (Register N21; Nr. 207, Auftrag Punkt 3): EIN Text aus
 * src/lib/testhof.ts oben auf Hofseite, Produktseite und Kasse — nur bei
 * istTesthof, für echte Höfe nichts.
 *
 * Beweist:
 *  - der Wortlaut des Auftrags (Name aus MARKE);
 *  - TesthofHinweis rendert die neutrale Hinweiskarte nur bei istTesthof
 *    (Gegenprobe: echter Hof → leer);
 *  - Hofseite, Produktseite und beide Kassen-Shells binden den Baustein mit
 *    dem Hof der Seite ein; der alte Text in gruendungshof.ts ist weg (eine
 *    Quelle);
 *  - IN_LISTEN_SICHTBAR bleibt unverändert (istTesthof: false).
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { TESTHOF_HINWEIS, zeigtTesthofHinweis } from '@/lib/testhof'
import { MARKE } from '@/lib/marke'
import { TesthofHinweis } from '@/components/hofseite/testhof-hinweis'

describe('Testhof-Hinweis', () => {
  it('Wortlaut des Auftrags 207', () => {
    expect(TESTHOF_HINWEIS).toBe(`Testhof von ${MARKE} – Bestellungen hier sind Testbestellungen, es gibt keine Ware.`)
  })

  it('nur bei istTesthof: neutrale Hinweiskarte mit dem Text; Gegenprobe: echter Hof → nichts', () => {
    expect(zeigtTesthofHinweis({ istTesthof: true })).toBe(true)
    expect(zeigtTesthofHinweis({ istTesthof: false })).toBe(false)
    const html = renderToStaticMarkup(createElement(TesthofHinweis, { farm: { istTesthof: true } }))
    expect(html).toContain(TESTHOF_HINWEIS)
    expect(html).toContain('data-ton="neutral"')
    expect(renderToStaticMarkup(createElement(TesthofHinweis, { farm: { istTesthof: false } }))).toBe('')
  })

  it.each([
    ['Hofseite', 'src/components/hofseite/hofseite-kunde.tsx', 1],
    ['Produktseite', 'src/app/(public)/[farmSlug]/produkt/[id]/page.tsx', 1],
    ['Kasse (Formular, Zahlung, leer) und Zahlung fortsetzen', 'src/components/checkout/checkout-form.tsx', 2],
  ])('%s bindet den Baustein mit dem Hof der Seite ein', (_name, datei, anzahl) => {
    const quelle = readFileSync(datei, 'utf8')
    expect(quelle.match(/<TesthofHinweis farm=\{farm\}/g)?.length ?? 0).toBe(anzahl)
  })

  it('eine Quelle: der alte Text steht nicht mehr in gruendungshof.ts; IN_LISTEN_SICHTBAR unverändert', () => {
    expect(readFileSync('src/lib/gruendungshof.ts', 'utf8')).not.toContain('TESTHOF_HINWEIS')
    expect(readFileSync('src/server/queries/farm.ts', 'utf8')).toMatch(/export const IN_LISTEN_SICHTBAR = \{[^}]*istTesthof: false,/)
  })
})
