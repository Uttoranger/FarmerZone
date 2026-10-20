/**
 * Hinweiskarte: drei Töne (Nr. 119, Runde 1). Neu ist „neutral“ für ruhige
 * Hinweise ohne Wertung (Testhof, Register N21) — Fläche, Rand und Symbol nur
 * aus Tokens. Grün und Orange bleiben Zeichen für Zeichen, wie sie waren: Der
 * Test hält beide Klassensätze exakt fest, damit der dritte Ton keinen der
 * vielen bestehenden Hinweise verschiebt.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Info } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'

const RAHMEN = 'flex flex-col gap-3 rounded-2xl border px-4 py-3.5 text-[13.5px] text-foreground sm:flex-row sm:items-center'
const SYMBOL = 'mt-0.5 size-5 shrink-0'

function klassen(ton: 'gruen' | 'orange' | 'neutral' | undefined): { karte: string; symbol: string; html: string } {
  const html = renderToStaticMarkup(createElement(Hinweiskarte, { ton, symbol: Info }, 'Ein Satz.'))
  const karte = /<div data-slot="hinweiskarte" data-ton="[a-z]+" class="([^"]*)"/.exec(html)?.[1]
  const symbol = /<svg[^>]*class="([^"]*)"/.exec(html)?.[1]
  if (karte === undefined || symbol === undefined) throw new Error('Hinweiskarte ohne Rahmen oder Symbol')
  return { karte, symbol: symbol.replace(/^lucide lucide-[a-z-]+ /, ''), html }
}

describe('Hinweiskarte — Töne', () => {
  it('grün (auch ohne Angabe) bleibt Zeichen für Zeichen', () => {
    for (const ton of ['gruen', undefined] as const) {
      const k = klassen(ton)
      expect(k.html).toContain('data-ton="gruen"')
      expect(k.karte).toBe(`${RAHMEN} border-accent/45 bg-accent/12`)
      expect(k.symbol).toBe(`${SYMBOL} text-status-fertig`)
    }
  })

  it('orange bleibt Zeichen für Zeichen', () => {
    const k = klassen('orange')
    expect(k.html).toContain('data-ton="orange"')
    expect(k.karte).toBe(`${RAHMEN} border-primary/45 bg-primary/12`)
    expect(k.symbol).toBe(`${SYMBOL} text-status-offen`)
  })

  it('neutral: Rand und Fläche aus Tokens, leises Symbol, Schrift in der normalen Textfarbe', () => {
    const k = klassen('neutral')
    expect(k.html).toContain('data-ton="neutral"')
    expect(k.karte).toBe(`${RAHMEN} border-border bg-muted`)
    expect(k.symbol).toBe(`${SYMBOL} text-muted-foreground`)
    // Gegenprobe: keine Spur von Grün oder Orange.
    expect(k.html).not.toMatch(/accent|primary|status-fertig|status-offen/)
  })
})
