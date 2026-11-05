/**
 * Wortlaut nach N39 und Anhang I FAGG bleibt (Register N43 (1) und (2), V88; Lauf 30, Nr. 231).
 *
 * Ursache: Nr. 231 stellt die Seite /widerruf und die Sätze in src/lib/widerruf.ts
 * auf „Rücktritt“ um (N43). Bis die Anwältin entscheidet, bleiben wörtlich:
 *  - die Beschriftung der Online-Funktion nach § 13a FAGG — der Einstieg
 *    `fussLink` und der Knopf `knopfWiderrufen` („Vertrag widerrufen“) und der
 *    Bestätigen-Knopf `knopfBestaetigen` („Widerruf bestätigen“);
 *  - die Belehrung samt Muster-Formular (`BELEHRUNG`).
 *
 * Beweist: Die drei Texte sind gleich dem Stand auf main (4.11.2026, cab6ef3),
 * die Belehrung über ihre Prüfsumme (SHA-256 des JSON) — ein geändertes Wort,
 * ein Leerzeichen oder ein vertauschter Abschnitt macht sie rot. Die Seite
 * zeigt beide Knöpfe mit genau diesem Text. Gegenprobe: Die Prüfsumme schlägt
 * bei einem einzigen geänderten Zeichen an.
 *
 * Ändert die Projektleitung nach der Entscheidung der Anwältin den Wortlaut,
 * ändert sie diese Werte im selben Zug — nie eine Nummer nebenbei.
 */
import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/server/actions/widerruf', () => ({ reicheWiderrufMitLinkEin: vi.fn(), reicheWiderrufOhneLinkEin: vi.fn() }))

import { BELEHRUNG, WIDERRUF_TEXT } from '@/lib/widerruf'
import { WiderrufFormular } from '@/app/(public)/widerruf/widerruf-formular'

/** Stand auf main (cab6ef3) — wörtlich nach N39. */
const N39_AUF_MAIN = { fussLink: 'Vertrag widerrufen', knopfWiderrufen: 'Vertrag widerrufen', knopfBestaetigen: 'Widerruf bestätigen' } as const

/** SHA-256 von JSON.stringify(BELEHRUNG) auf main (cab6ef3). */
const BELEHRUNG_PRUEFSUMME_MAIN = '8c273980fa03877590037802a8b1e19e7edaccb105d0fe452c69ed8d20a0ec86'

const pruefsumme = (wert: unknown): string => createHash('sha256').update(JSON.stringify(wert)).digest('hex')

describe('N39-Beschriftung bleibt wörtlich (N43 (1))', () => {
  it('Einstieg, Knopf und Bestätigen-Knopf sind gleich dem Stand auf main', () => {
    expect({
      fussLink: WIDERRUF_TEXT.fussLink,
      knopfWiderrufen: WIDERRUF_TEXT.knopfWiderrufen,
      knopfBestaetigen: WIDERRUF_TEXT.knopfBestaetigen,
    }).toEqual(N39_AUF_MAIN)
  })

  it('der Titel der Seite heißt dagegen „Rücktrittsrecht“ (N43)', () => {
    expect(WIDERRUF_TEXT.titel).toBe('Rücktrittsrecht')
  })

  it('das Formular zeigt den Knopf „Vertrag widerrufen“ wörtlich', () => {
    const html = renderToStaticMarkup(createElement(WiderrufFormular, { bestellung: null }))
    expect(html).toContain(`>${N39_AUF_MAIN.knopfWiderrufen}</button>`)
    // Die Frage über der Auswahl sagt „zurücktreten“, nicht „widerrufen“.
    expect(html).toContain('Wovon möchtest du zurücktreten?')
  })
})

describe('Belehrung und Muster-Formular bleiben wörtlich (N43 (2))', () => {
  it('die Prüfsumme der Belehrung ist die vom Stand auf main', () => {
    expect(pruefsumme(BELEHRUNG)).toBe(BELEHRUNG_PRUEFSUMME_MAIN)
  })

  it('Gegenprobe: ein einziges angehängtes Zeichen ändert die Prüfsumme', () => {
    const geaendert = { ...BELEHRUNG, hinweis: `${BELEHRUNG.hinweis} ` }
    expect(pruefsumme(geaendert)).not.toBe(BELEHRUNG_PRUEFSUMME_MAIN)
  })
})
