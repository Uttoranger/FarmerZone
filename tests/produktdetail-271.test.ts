/**
 * Produktseite nach der Abnahme Lauf 32 (Nr. 271, Gruppe 1, Board s1-/w1-produkt):
 * „Gleich mit abholen“ zeigt Name mit Menge, Preis fett und Grundpreis darunter (Abnahme produkt 5),
 * der Mengen-Stepper hat eine sichtbare Beschriftung und 44 px Ziele (produkt 4), und am Handy steht
 * nur EIN Warenkorb-Symbol (produkt 9).
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement('img', { src, alt }),
}))

import { GleichMitAbholen } from '@/components/produktdetail/produktdetail-teile'
import { publicProduct } from './fabrik/public-product'

const quelle = readFileSync('src/components/produktdetail/produktdetail-kunde.tsx', 'utf8')

describe('Gleich mit abholen (Board s1-/w1-produkt Bild 2)', () => {
  const zeile = (p: ReturnType<typeof publicProduct>) =>
    renderToStaticMarkup(
      createElement(GleichMitAbholen, {
        produkte: [p],
        link: (id: string) => `/hof-test/produkt/${id}`,
        mitFamilie: () => false,
        imKorb: () => 0,
        wirdHinzugefuegt: null,
        onInDenKorb: () => {},
      })
    )

  it('Name mit Menge, darunter der Preis fett und der Grundpreis grau — dieselbe Hilfe wie die Hofseite', () => {
    const html = zeile(publicProduct({ id: 'milch', name: 'Heumilch frisch', price: 1.49, unit: 'LITER', unitSize: 1 }))
    expect(html).toContain('>Heumilch frisch, 1 L</span>')
    expect(html).toMatch(/<span class="[^"]*font-bold[^"]*">€ 1,49<\/span>/)
    expect(html).toMatch(/<span class="[^"]*text-muted-foreground[^"]*">€ 1,49 \/ L<\/span>/)
    // Gegenprobe: nicht mehr einzeilig „€ 1,49 / L“ als Preis.
    expect(html).not.toMatch(/font-bold[^"]*">€ 1,49 \/ L</)
  })

  it('Stück ohne Gebinde: Preis und Preis je Stück', () => {
    const html = zeile(publicProduct({ id: 'brot', name: 'Bauernbrot', price: 4.2, unit: 'STUECK', unitSize: null }))
    expect(html).toContain('>Bauernbrot</span>')
    expect(html).toContain('>€ 4,20</span>')
  })
})

describe('Mengen-Stepper und Warenkorb-Symbol', () => {
  it('der Stepper steht in einem Label mit sichtbarem „Menge“, Pille 48 px und Feld 44 px hoch', () => {
    expect(quelle).toMatch(/<label className="[^"]*" onClick=\{mengeLabelTipp\}>\s*<span className="[^"]*">Menge<\/span>\s*<Stepper/)
    expect(quelle).toContain('eingabeClassName="h-11 w-11"')
    expect(quelle).toContain('className="[&_[data-slot=stepper-pille]]:h-12"')
  })

  it('am Handy EIN Warenkorb-Symbol: die klebende Zeile zeigt es erst, wenn der Kopf der Shell weggescrollt ist', () => {
    expect(quelle).toContain('new IntersectionObserver(')
    expect(quelle).toMatch(/!kopfWeg && 'hidden'/)
    // Die Marke steht direkt vor der klebenden Zeile.
    expect(quelle.indexOf('ref={setKopfMarke}')).toBeLessThan(quelle.indexOf('ref={setKlebeZeile}'))
  })

  it('die Illustration steht als eigenes gerahmtes Quadrat im Band, gedämpft über die Hülle (F041, 15.5.3)', () => {
    const quadrat = quelle.slice(quelle.indexOf('data-slot="illustration"'), quelle.indexOf('</span>', quelle.indexOf('data-slot="illustration"')))
    expect(quadrat).toMatch(/className="[^"]*aspect-square[^"]*dark:ring-1 dark:ring-border/)
    expect(quadrat).toContain('<Image')
    // Die Hülle trägt die Dämpfung aus der einen Quelle.
    expect(quelle).toContain('bild && !produkt.imageUrl ? ILLUSTRATION_HUELLE : FOTO_HUELLE')
  })
})
