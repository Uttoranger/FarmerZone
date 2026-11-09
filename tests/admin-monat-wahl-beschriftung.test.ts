/**
 * Monatswahl im Kosten-Blatt (Admin › Geld, Nr. 281): Die zwei Auswahlfelder „Ab Monat" maß die
 * Abnahme Lauf 32 als „ohne Beschriftung" (G-M2) — die versteckten Labels allein zählen nicht. Mit
 * `beschriftungId` nennen beide Felder zuerst die sichtbare Überschrift, dann ihr eigenes Wort; ohne
 * bleibt alles wie vorher (kein aria-labelledby). Dazu der Quelltext: Das Kosten-Blatt gibt seine
 * sichtbaren Überschriften weiter, und die Tag-/Uhrzeitfelder der Startseiten-Blöcke zeigen nur auf IDs,
 * die es in derselben Datei gibt.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MonatWahl } from '@/app/admin/finanzen/monat-wahl'

const grund = { wert: '2026-11', onChange: () => {}, bezug: '2026-11', idPraefix: 'kosten-ab' } as const

describe('MonatWahl – Beschriftung über die sichtbare Überschrift', () => {
  it('Monatsfeld heißt wie die Überschrift, Jahresfeld nennt Überschrift und eigenes Wort', () => {
    const html = renderToStaticMarkup(createElement(MonatWahl, { ...grund, beschriftungId: 'kosten-ab-titel' }))
    // Das Monatsfeld heißt wie die Überschrift („Ab Monat“), nicht „Ab Monat Monat“.
    expect(html).toContain('aria-labelledby="kosten-ab-titel"')
    expect(html).not.toContain('kosten-ab-titel kosten-ab-monat-wort')
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

const quelle = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('Kosten-Blatt – Überschriften an die Monatswahl', () => {
  const text = quelle('src/app/admin/finanzen/kosten-sheet.tsx')

  it.each(['kosten-ab-titel', 'kosten-bis-titel'])('%s steht als id an der Überschrift und geht an MonatWahl', (titel) => {
    expect(text).toMatch(new RegExp(`<span id="${titel}" className=\\{beschriftung\\}>`))
    expect(text).toContain(`beschriftungId="${titel}"`)
  })
})

describe('Startseiten-Block – Tag und Uhrzeit zeigen auf vorhandene IDs', () => {
  const text = quelle('src/components/admin/startseite-block-formular.tsx')
  const verweise = [...text.matchAll(/aria-labelledby=\{`([^`]*)`\}/g)].map((t) => t[1]!)
    .filter((v) => v.includes('-live-'))

  it('vier Felder verweisen auf Legende und sich selbst', () => {
    expect(verweise).toHaveLength(4)
  })

  it('jede verwiesene ID ist in derselben Datei vergeben', () => {
    for (const verweis of verweise) {
      const ids = verweis.split(' ')
      expect(ids, verweis).toHaveLength(2)
      for (const ziel of ids) expect(text, ziel).toContain(`id={\`${ziel}\`}`)
    }
  })

  it('die erste ID ist eine Legende, die zweite das Feld selbst', () => {
    for (const verweis of verweise) {
      const [legende, feld] = verweis.split(' ')
      expect(text).toContain(`<legend id={\`${legende}\`}`)
      expect(text).toMatch(new RegExp(`<input id=\\{\`${feld!.replace(/[$}{]/g, '\\$&')}\`\\}[^>]*aria-labelledby=\\{\`${verweis.replace(/[$}{]/g, '\\$&')}\``))
    }
  })
})
