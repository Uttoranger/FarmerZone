/**
 * Monatswahl im Kosten-Blatt (Admin › Geld, Nr. 281): Die zwei Auswahlfelder „Ab Monat" maß die
 * Abnahme Lauf 32 als „ohne Beschriftung" (G-M2) — die versteckten Labels allein zählen nicht. Mit
 * `beschriftungId` nennen beide Felder zuerst die sichtbare Überschrift, dann ihr eigenes Wort; ohne
 * bleibt alles wie vorher (kein aria-labelledby).
 */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MonatWahl } from '@/app/admin/finanzen/monat-wahl'

const grund = { wert: '2026-11', onChange: () => {}, bezug: '2026-11', idPraefix: 'kosten-ab' } as const

describe('MonatWahl – Beschriftung über die sichtbare Überschrift', () => {
  it('verweist beide Felder auf Überschrift und eigenes Wort', () => {
    const html = renderToStaticMarkup(createElement(MonatWahl, { ...grund, beschriftungId: 'kosten-ab-titel' }))
    expect(html).toContain('aria-labelledby="kosten-ab-titel kosten-ab-monat-wort"')
    expect(html).toContain('aria-labelledby="kosten-ab-titel kosten-ab-jahr-wort"')
    expect(html).toContain('id="kosten-ab-monat-wort"')
    expect(html).toContain('id="kosten-ab-jahr-wort"')
  })

  it('ohne Überschrift bleibt es bei den Labels allein', () => {
    const html = renderToStaticMarkup(createElement(MonatWahl, grund))
    expect(html).not.toContain('aria-labelledby')
    expect(html).toContain('for="kosten-ab-monat"')
  })
})
