/**
 * Käufer-Vorschau Lebensmittel im Produktdialog (Nachtlauf Nr. 51, freigabe.md
 * §13) — gerendert (react-dom/server in Node, TESTING_GUIDELINES §1).
 *
 * Beweist:
 *  - „So sehen Käufer dein Produkt" zeigt die ECHTE Produktkarte der Hofseite
 *    (Vorschau-Variante), live aus Foto, Name, Preis und Einheit: andere
 *    Formularwerte, andere Karte.
 *  - Mit gewählter Unterkategorie zeigt sie deren Illustration — dasselbe Bild
 *    wie Hofseite und /products (Register I1, Nr. 74, Runde 1).
 *  - Ohne Link und ohne Korb.
 *  - Leere oder ungültige Felder zeigen ruhige Platzhalter, nie „NaN".
 *  - Der Produktdialog zeigt sie nur für Lebensmittel; Futter (E9-Schild) und
 *    Brennmaterial behalten ihre eigene Vorschau unverändert.
 *  - Die Zusammenfassung des Abschnitts „Preis" nimmt ohne gültigen Preis
 *    denselben Satz wie die Vorschau (Runde 1).
 * Je Aussage eine Gegenprobe, dass die Suche das Merkmal auch findet.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))

import { LebensmittelVorschau } from '@/components/products/lebensmittel-vorschau'
import { KAEUFER_VORSCHAU } from '@/lib/hofseite-kunde'
import { categoryImagePath } from '@/lib/product-image'
import type { ProductCategoryValue, ProductSubcategoryValue } from '@/lib/taxonomie'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

type Werte = {
  name: string
  price: number
  unit: string
  unitSize: number | null
  foto: string | null
  kategorie: ProductCategoryValue | null
  unterkategorie: ProductSubcategoryValue | null
}
const KAESE: Werte = { name: 'Bergkäse', price: 12.9, unit: 'KG', unitSize: 0.5, foto: null, kategorie: 'MILCH', unterkategorie: null }
const vorschau = (werte: Werte) => renderToStaticMarkup(createElement(LebensmittelVorschau, werte))

describe('„So sehen Käufer dein Produkt" — die echte Produktkarte, live aus dem Formular', () => {
  it('Überschrift, Name, Preis mit Grundpreis und die Illustration der Kategorie', () => {
    const html = vorschau(KAESE)
    expect(html).toContain(KAEUFER_VORSCHAU.titel)
    expect(html).toContain('Bergkäse')
    expect(html).toContain('€ 12,90 für 0,5 kg')
    expect(html).toContain('€ 25,80 / kg')
    expect(html).toContain('src="/categories/milch.webp"')
  })

  it('mit gewählter Unterkategorie zeigt die Karte deren Illustration, nicht die der Kategorie', () => {
    const html = vorschau({ ...KAESE, unterkategorie: 'KAESE' })
    expect(html).toContain('src="/categories/milch/kaese.webp"')
    expect(html).not.toContain('src="/categories/milch.webp"')
    // Gegenprobe: ohne Unterkategorie bleibt es das Bild der Kategorie.
    expect(vorschau(KAESE)).toContain('src="/categories/milch.webp"')
  })

  it('dasselbe Bild wie auf Hofseite und /products: der Server gibt den Produktkacheln es über categoryImagePath', () => {
    for (const [kategorie, unterkategorie] of [
      ['MILCH', 'JOGHURT_TOPFEN'],
      ['HONIG', 'WALDHONIG'],
      ['EIER', 'EIER_BIO'],
      ['GEMUESE', null],
    ] as const) {
      const html = vorschau({ ...KAESE, kategorie, unterkategorie })
      expect(html, `${kategorie}/${unterkategorie}`).toContain(`src="${categoryImagePath(kategorie, unterkategorie, () => true)}"`)
    }
  })

  it('andere Formularwerte, andere Karte — mit gewähltem Foto statt der Illustration', () => {
    const html = vorschau({ name: 'Topfen', price: 3.2, unit: 'STUECK', unitSize: null, foto: 'blob:foto-1', kategorie: 'MILCH', unterkategorie: null })
    expect(html).toContain('Topfen')
    expect(html).toContain('€ 3,20 / Stück')
    expect(html).toContain('src="blob:foto-1"')
    expect(html).not.toContain('Bergkäse')
    expect(html).not.toContain('/categories/milch.webp')
  })

  it('ohne Link und ohne Korb', () => {
    const html = vorschau(KAESE)
    expect(html).not.toMatch(/<a\b/)
    expect(html).not.toMatch(/<button\b/)
    expect(html).not.toMatch(/in den Korb/)
  })

  it('leere oder ungültige Felder: ruhige Platzhalter, nie „NaN" oder „€ 0,00"', () => {
    for (const price of [Number.NaN, 0, 4.505]) {
      const html = vorschau({ name: '', price, unit: 'STUECK', unitSize: null, foto: null, kategorie: null, unterkategorie: null })
      expect(html, String(price)).toContain(KAEUFER_VORSCHAU.name)
      expect(html, String(price)).toContain(KAEUFER_VORSCHAU.preisFehlt)
      expect(html, String(price)).not.toMatch(/NaN|€ 0,00/)
    }
    // Gegenprobe: mit Namen und Preis keine Platzhalter.
    const gefuellt = vorschau(KAESE)
    expect(gefuellt).not.toContain(KAEUFER_VORSCHAU.preisFehlt)
    expect(gefuellt).not.toContain(KAEUFER_VORSCHAU.name)
  })
})

describe('nur im Produktdialog für Lebensmittel — Futter und Brennmaterial bleiben, wie sie sind', () => {
  const dialog = quelle('src/components/products/product-dialog.tsx')

  it('der Dialog bindet die Vorschau ein, nur im Bereich Lebensmittel (produktBereich, eine Quelle mit /products)', () => {
    expect(dialog).toMatch(/<LebensmittelVorschau\b/)
    expect(dialog).toMatch(/produktBereich\(category\) === 'lebensmittel'/)
  })

  it('der Dialog gibt Foto, Name, Preis und Einheit aus dem Formular weiter, nichts Gerechnetes', () => {
    const aufruf = dialog.slice(dialog.indexOf('<LebensmittelVorschau'), dialog.indexOf('/>', dialog.indexOf('<LebensmittelVorschau')))
    for (const feld of ['name={werte.name}', 'price={werte.price}', 'unit={werte.unit}', 'unitSize={werte.unitSize}', 'foto={previewUrl}', 'kategorie={category}', 'unterkategorie={werte.subcategory}']) {
      expect(aufruf, feld).toContain(feld)
    }
  })

  it('die Zusammenfassung des zugeklappten Abschnitts „Preis" sagt ohne gültigen Preis dasselbe wie die Vorschau, nie „€ 0,00"', () => {
    const fall = dialog.slice(dialog.indexOf("case 'preis': {"), dialog.indexOf("case 'details': {"))
    expect(fall).toContain('gueltigerPreis(w.price)')
    expect(fall).toContain('KAEUFER_VORSCHAU.preisFehlt')
    // Gegenprobe: der alte Rückfall auf 0 ist weg.
    expect(fall).not.toMatch(/Number\.isFinite\(w\.price\) \? w\.price : 0/)
    expect(fall.length).toBeGreaterThan(0)
  })

  it('Futter und Brennmaterial: eigene Vorschau unverändert, keine Produktkarte', () => {
    const futter = quelle('src/components/produkte/futter-formular.tsx')
    const holz = quelle('src/components/produkte/brennmaterial-formular.tsx')
    expect(futter).toContain('So sehen Käufer dein Futter')
    expect(futter).toContain('futterSchild(')
    expect(holz).toContain('So sehen Käufer dein Holz')
    for (const text of [futter, holz]) {
      expect(text).not.toMatch(/LebensmittelVorschau|lebensmittel-vorschau/)
      expect(text).not.toMatch(/\bProduktKarte\b/)
    }
  })
})
