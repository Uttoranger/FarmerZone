/**
 * Das Schild nach der E9-Ergänzung (Nr. 123): „Futtermittelbetrieb · LFBIS
 * <Nummer> · laut Hof" in neutraler Farbe und OHNE Haken-Symbol — an allen
 * drei Stellen über EINEN Baustein (FutterSchild): Futter kaufen, Produktseite,
 * Vorschau im Futter-Formular. Ein Haken (ShieldCheck, BadgeCheck,
 * CheckCircle, Check) läse sich wie „geprüft"; die Plattform prüft nicht.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FutterSchild } from '@/components/produkte/futter-schild'

const lies = (datei: string) => fs.readFileSync(path.resolve(__dirname, '..', datei), 'utf8')

/** Ein Haken-Symbol aus lucide, eingebunden oder gezeichnet — als ganzes Wort. */
const HAKEN = /\b(ShieldCheck|BadgeCheck|CheckCircle2?|CircleCheck(Big)?|Check)\b/

const STELLEN = {
  'Futter kaufen': 'src/components/region/futter-karte.tsx',
  Produktseite: 'src/components/produktdetail/produktdetail-kunde.tsx',
  'Vorschau im Futter-Formular': 'src/components/produkte/futter-formular.tsx',
} as const

describe('FutterSchild — neutral, ohne Haken', () => {
  it('alle drei Stellen zeichnen das Schild über FutterSchild und binden kein Haken-Symbol ein', () => {
    for (const [stelle, datei] of Object.entries(STELLEN)) {
      const text = lies(datei)
      expect(text, stelle).toMatch(/<FutterSchild text=\{[^}]*schild[^}]*\} \/>/)
      const lucide = text.match(/import \{([^}]*)\} from 'lucide-react'/)?.[1] ?? ''
      expect(lucide, stelle).not.toMatch(HAKEN)
    }
    expect(lies('src/components/produkte/futter-schild.tsx')).not.toMatch(HAKEN)
  })

  it('Gegenprobe: die Suche schlägt an einem Import mit ShieldCheck an', () => {
    expect(" Building2, ChevronLeft, ShieldCheck, ShoppingBasket ").toMatch(HAKEN)
    expect(' Shield, Wheat ').not.toMatch(HAKEN)
  })

  it('zeichnet den Text mit dem Schild-Symbol in leiser Schrift — ohne Grün, ohne Haken', () => {
    const html = renderToStaticMarkup(createElement(FutterSchild, { text: 'Futtermittelbetrieb · LFBIS 1234567 · laut Hof' }))
    expect(html).toContain('Futtermittelbetrieb · LFBIS 1234567 · laut Hof')
    expect(html).toContain('lucide-shield')
    expect(html).not.toMatch(/lucide-(shield-check|badge-check|circle-check)/)
    expect(html).toContain('text-muted-foreground')
    expect(html).not.toMatch(/status-fertig|accent/)
  })
})
