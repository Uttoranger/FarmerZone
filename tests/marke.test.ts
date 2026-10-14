/**
 * Der Baustein Marke (Register G5, Nr. 79) — und StatusBadge, der seit Nr. 79
 * über ihn zeichnet.
 *
 * Beweist:
 *  - Jede der vier Arten nimmt Schrift und Fläche aus ihren Tokens
 *    (text-zustand-<art>, bg-zustand-<art>-grund), ohne Farbwert und ohne
 *    Palettenfarbe; den Kontrast der Paare rechnet design-tokens.test.ts nach.
 *  - Ein Symbol steht mit dem Wort in EINER Zeile (Regelvorschlag 68): als
 *    Geschwister des Worts direkt in der Flex-Zeile, für Screenreader
 *    verborgen; ohne Symbol kein svg.
 *  - StatusBadge übersetzt den Ton in die Art (offen → tun, fertig → läuft,
 *    neutral → erledigt), behält data-slot und data-status und reicht das
 *    Symbol durch.
 *  - Hof und Kundin lesen denselben Status verschieden (bestellMarke in
 *    hof-bestellungen.ts / bestellStatusAnzeige in bestellstatus.ts) — nur die
 *    Farbe kommt aus einer Quelle; storniert ist für beide abgebrochen (rot).
 */
import { describe, it, expect } from 'vitest'
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Check } from 'lucide-react'
import { OrderStatus } from '@prisma/client'
import { Marke } from '@/components/ui/marke'
import { StatusBadge, type StatusTon } from '@/components/ui/status-badge'
import { bestellMarke } from '@/lib/hof-bestellungen'
import { bestellStatusAnzeige } from '@/lib/bestellstatus'
import { MARKE_ARTEN, type MarkeArt } from '@/lib/marke-art'

const FARBLITERAL = /#[0-9a-fA-F]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch)\(/
const PALETTE =
  /\b(bg|text|border|ring|fill|stroke|from|to|via|outline|shadow|divide|decoration)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?\b/

/** createElement mit Kindern als weitere Argumente — ohne dass TypeScript `children` in den Props verlangt. */
function el<P extends { children?: ReactNode }>(typ: ComponentType<P>, props: Omit<P, 'children'>, ...kinder: ReactNode[]): ReactElement {
  return createElement(typ as unknown as ComponentType<Omit<P, 'children'>>, props, ...kinder)
}

/** Öffnender Tag, Symbol, Wort: Das Symbol ist Geschwister des Worts, kein eigener Block darüber. */
const ZEILE = /^<span ([^>]*)><svg ([^>]*)>.*?<\/svg><span class="min-w-0 truncate">([^<]*)<\/span><\/span>$/

describe('Marke — vier Arten aus den Tokens', () => {
  it.each(MARKE_ARTEN)('%s: Schrift und Fläche aus den Tokens, ohne Symbol kein svg', (art) => {
    const html = renderToStaticMarkup(createElement(Marke, { art }, 'Wort'))

    expect(html).toContain(`data-art="${art}"`)
    expect(html).toContain(`text-zustand-${art}`)
    expect(html).toContain(`bg-zustand-${art}-grund`)
    expect(html).toMatch(/<span class="min-w-0 truncate">Wort<\/span><\/span>$/)
    expect(html).not.toContain('<svg')
    expect(html).not.toMatch(FARBLITERAL)
    expect(html).not.toMatch(PALETTE)
  })

  it.each(MARKE_ARTEN)('%s mit Symbol: Symbol und Wort in einer Zeile, das Symbol verborgen', (art) => {
    const html = renderToStaticMarkup(createElement(Marke, { art, symbol: Check }, 'Bezahlt'))

    const [, aussen, symbol, wort] = html.match(ZEILE) ?? []
    // Die Regel ist hier selbst eine Frage des Layouts: Flex in Zeilenrichtung —
    // mit flex-col stünde das Symbol wieder über dem Wort (Bericht 68).
    expect(aussen).toMatch(/class="[^"]*\binline-flex\b[^"]*\bitems-center\b/)
    expect(aussen).not.toMatch(/\bflex-col\b/)
    expect(symbol).toContain('lucide-check')
    expect(symbol).toContain('aria-hidden="true"')
    expect(wort).toBe('Bezahlt')
  })
})

describe('StatusBadge zeichnet über Marke', () => {
  const TON_ZUR_ART: [StatusTon, MarkeArt][] = [
    ['offen', 'tun'],
    ['fertig', 'laeuft'],
    ['neutral', 'erledigt'],
  ]

  it.each(TON_ZUR_ART)('%s wird zur Art %s — data-slot und data-status bleiben', (ton, art) => {
    const html = renderToStaticMarkup(el(StatusBadge, { status: ton }, 'Wort'))

    expect(html).toContain(`data-slot="status-badge" data-status="${ton}" data-art="${art}"`)
    expect(html).toContain(`text-zustand-${art}`)
  })

  it('reicht das Symbol durch — in derselben Zeile wie das Wort', () => {
    const html = renderToStaticMarkup(el(StatusBadge, { status: 'fertig', symbol: Check }, 'Gepackt'))

    const [, , symbol, wort] = html.match(ZEILE) ?? []
    expect(symbol).toContain('lucide-check')
    expect(wort).toBe('Gepackt')
  })
})

describe('Bedeutung je Blickwinkel — eine Farbquelle, zwei Lesarten', () => {
  it('jeder reale Status hat in beiden Lesarten eine Art; bezahlt heißt für den Hof „packen" (tun), für die Kundin läuft es', () => {
    for (const status of Object.values(OrderStatus)) {
      expect(MARKE_ARTEN, status).toContain(bestellMarke(status).art)
      expect(MARKE_ARTEN, status).toContain(bestellStatusAnzeige(status, '').art)
    }

    expect(bestellMarke('PAID').art).toBe('tun')
    expect(bestellStatusAnzeige('PAID', '').art).toBe('laeuft')
    // Wartet auf die Kundin: Für den Hof ist nichts zu tun, die Kundin muss bestätigen.
    expect(bestellMarke('PENDING_CONFIRMATION').art).toBe('erledigt')
    expect(bestellStatusAnzeige('PENDING_CONFIRMATION', '').art).toBe('tun')
  })

  it('storniert ist für beide abgebrochen (rot), nicht abgeholt für beide erledigt (Freigabe Lauf 13)', () => {
    expect(bestellMarke('CANCELLED').art).toBe('abgebrochen')
    expect(bestellStatusAnzeige('CANCELLED', '').art).toBe('abgebrochen')
    expect(bestellMarke('NOT_PICKED_UP').art).toBe('erledigt')
    expect(bestellStatusAnzeige('NOT_PICKED_UP', '').art).toBe('erledigt')
  })
})
