/**
 * Bausteine aus Lauf 32, Teil 4 (Nr. 248: G5, G12, G13, G14) — gerendert wie auf dem Server bzw. als reine Funktion.
 *
 * Beweist:
 *  - Größenkachel (G5, `form="zeile"`): Radio-Kreis links, Name „Sack, 25 kg“, darunter „Grundpreis · Vorrat“, Preis rechts; die
 *    leere Größe zeigt ihren Preis (nicht durchgestrichen) und „gerade nicht da“ statt „ausverkauft“; Rundung in px.
 *  - Stepper (G13, `form="pille"`): eine gerahmte Pille (Rand `border-input`) mit −, Zahl, Einheit und + — klein wie
 *    groß; die Knöpfe ohne eigenen Kreis.
 *  - Vorgabe beider Bausteine = Stand vor Lauf 32 (Gegenprobe): ohne `form` zwei Spalten, Kachel mit rounded-xl und
 *    durchgestrichenem Preis; Stepper mit Kreisknöpfen — die Seiten springen nicht um (Freigabe Z. 215).
 *  - Diagrammfarbe (G13): im Dunkeln helles Mint (status-fertig), Vergleich leichter, aber auf bg-card ≥ 3:1 in beiden
 *    Themes (WCAG 1.4.11, aus globals.css nachgerechnet).
 *  - Bilder im Dunkeln (G12): Platzhalter und Karten aus ui/bild-dunkel.ts, Kacheln multipliziert.
 *  - Positionszeile (G14): „4 × Heumilch frisch (1 L)“, Anzahl als eigenes Teil (fett), Stück ohne Gebinde.
 *  - Kurznummer (G14): groß, aus dem Ende derselben ID, sechs Zeichen; die Suche trifft ganze ID und Kurznummer,
 *    als Übergang auch die alte Nummer aus meldung.ts (erste acht Zeichen), nie ein beliebiges Stück.
 *  - Vorschau: Nr. 248 zeigt ihre Bausteine im eigenen Einhängepunkt.
 * Gegenproben je Fall: die Merkmale erscheinen in der Variante, die sie trägt.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => createElement('img', { src, alt, className }),
}))

import { GROESSE_NICHT_DA, GroessenWahl, Groessenkachel, groessenName, groessenUnterzeile } from '@/components/ui/groessenkachel'
import { Stepper } from '@/components/ui/stepper'
import { FOTO_HUELLE, ILLUSTRATION_BILD, KARTE_HUELLE, KARTE_KACHELN, PLATZHALTER_FLAECHE } from '@/components/ui/bild-dunkel'
import { DIAGRAMM_BALKEN, DIAGRAMM_LEER, DIAGRAMM_VERGLEICH } from '@/components/ui/diagramm-farbe'
import { RUNDUNG } from '@/components/ui/rundung'
import { positionszeile } from '@/lib/positionszeile'
import { KURZNUMMER_LAENGE, kurznummerAus, passtZurKurznummer } from '@/lib/kurznummer'
import { kurznummer } from '@/lib/meldung'
import { Vorschau248 } from '@/app/intern/bausteine/vorschau-248'
import { kontrast, leseOklch, oklchZuHex } from '@/lib/farbraum'

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)
const wahl = (kind: ReactNode, form?: 'zeile') =>
  createElement(GroessenWahl, { beschriftung: 'Größe wählen', standardWert: 'sack', form } as Parameters<typeof GroessenWahl>[0], kind)
const zeile = (props: Omit<Parameters<typeof Groessenkachel>[0], 'form'>) => wahl(createElement(Groessenkachel, { ...props, form: 'zeile' }), 'zeile')

describe('Größenkachel (G5)', () => {
  it('Name mit Menge, darunter Grundpreis · Vorrat, Preis rechts, Radio-Kreis vorn', () => {
    const markup = html(zeile({ wert: 'sack', name: 'Sack', hinweis: '25 kg', preis: '€ 12,72', grundpreis: '€ 0,51 / kg', vorrat: 'noch 14' }))

    expect(markup).toContain('grid-cols-1')
    expect(markup).toContain('data-form="zeile"')
    expect(markup).toContain('>Sack, 25 kg<')
    expect(markup).toContain('>€ 0,51 / kg · noch 14<')
    expect(markup).toContain('>€ 12,72<')
    expect(markup).toContain(RUNDUNG.karte)
    expect(markup).not.toContain('rounded-xl')
    // Der Name steht vor dem Preis — der Preis rechts.
    expect(markup.indexOf('Sack, 25 kg')).toBeLessThan(markup.indexOf('€ 12,72'))
  })

  it('leere Größe: Preis bleibt sichtbar (nicht durchgestrichen), „gerade nicht da“ statt „ausverkauft“, nicht wählbar', () => {
    const markup = html(zeile({ wert: 'lose', name: 'Lose', hinweis: '1 t', preis: '€ 371,00', grundpreis: '€ 0,37 / kg', vorrat: 'ausverkauft', zustand: 'ausverkauft' }))

    expect(markup).toContain('>€ 371,00<')
    expect(markup).toContain(`>€ 0,37 / kg · ${GROESSE_NICHT_DA}<`)
    expect(markup).not.toContain('>ausverkauft<')
    expect(markup).not.toContain('line-through')
    expect(markup).toContain('data-disabled')
  })

  it('Gegenprobe: eine Größe mit Vorrat sagt nie „gerade nicht da“; knapp ist hervorgehoben', () => {
    expect(groessenUnterzeile('€ 1,60 / kg', 'nur noch 2', 'knapp')).toBe('€ 1,60 / kg · nur noch 2')
    expect(groessenUnterzeile(undefined, 'noch 3', 'normal')).toBe('noch 3')
    expect(groessenUnterzeile(undefined, undefined, 'ausverkauft')).toBe(GROESSE_NICHT_DA)
    expect(groessenName('Rundballen')).toBe('Rundballen')
    const knapp = html(zeile({ wert: 'rund', name: 'Rundballen', preis: '€ 45,00', vorrat: 'nur noch 2', zustand: 'knapp' }))
    expect(knapp).toContain('text-status-offen')
    expect(knapp).not.toContain(GROESSE_NICHT_DA)
  })

  it('Gegenprobe Vorgabe (ohne form): der Stand vor Lauf 32 — zwei Spalten, Kachel, Preis durchgestrichen, „ausverkauft“', () => {
    const voll = html(wahl(createElement(Groessenkachel, { wert: 'sack', name: 'Sack', hinweis: '25 kg', preis: '€ 12,72', grundpreis: '€ 0,51 / kg', vorrat: 'noch 14' })))
    expect(voll).toContain('grid grid-cols-2 gap-2')
    expect(voll).toContain('rounded-xl')
    expect(voll).toContain('>Sack<')
    expect(voll).toContain('>25 kg<')
    expect(voll).not.toContain('Sack, 25 kg')
    expect(voll).not.toContain('data-form')
    expect(voll).not.toContain(RUNDUNG.karte)

    const leer = html(wahl(createElement(Groessenkachel, { wert: 'lose', name: 'Lose', preis: '€ 371,00', vorrat: 'ausverkauft', zustand: 'ausverkauft' })))
    expect(leer).toContain('line-through')
    expect(leer).toContain('>ausverkauft<')
    expect(leer).not.toContain(GROESSE_NICHT_DA)
  })
})

describe('Stepper (G13)', () => {
  it('klein: eine gerahmte Pille „− n +“ mit Einheit, Knöpfe ohne eigenen Kreis', () => {
    const markup = html(createElement(Stepper, { beschriftung: 'Menge Heumilch', standardWert: 2, min: 1, einheit: 'L', form: 'pille' }))

    // Rand eines Bedienelements: border-input (≥ 3:1), nicht der Kartenrand border-border.
    expect(markup).toMatch(/data-slot="stepper-pille" class="[^"]*rounded-full border border-input/)
    expect(markup).not.toContain('border-border')
    expect(markup).toContain('aria-label="Menge Heumilch: eins weniger"')
    expect(markup).toContain('aria-label="Menge Heumilch: eins mehr"')
    expect(markup).toContain('>L<')
    expect(markup).not.toContain('size-8')
    // Reihenfolge in der Pille: −, Zahl, Einheit, +.
    const minus = markup.indexOf('eins weniger')
    const einheit = markup.indexOf('>L<')
    expect(minus).toBeLessThan(markup.indexOf('aria-label="Menge Heumilch"'))
    expect(einheit).toBeLessThan(markup.indexOf('eins mehr'))
  })

  it('groß (Vorrat-Blatt): dieselbe Pille, höher', () => {
    const markup = html(createElement(Stepper, { beschriftung: 'Vorrat Bergkäse', standardWert: 3, gross: true, einheit: 'Stück', form: 'pille' }))
    expect(markup).toContain('data-slot="stepper-pille"')
    expect(markup).toContain('h-14')
    expect(markup).toContain('>Stück<')
    // Gegenprobe: ohne Einheit keine Einheit.
    expect(html(createElement(Stepper, { beschriftung: 'Menge', standardWert: 1, form: 'pille' }))).not.toContain('text-muted-foreground')
  })

  it('Gegenprobe Vorgabe (ohne form): der Stand vor Lauf 32 — Kreisknöpfe, keine Pille, groß mit Unterstrich', () => {
    const klein = html(createElement(Stepper, { beschriftung: 'Menge', standardWert: 1 }))
    expect(klein).not.toContain('stepper-pille')
    expect(klein).not.toContain('data-form')
    expect(klein).toContain('size-8')
    expect(klein).toContain('h-11 w-10 text-center')
    const gross = html(createElement(Stepper, { beschriftung: 'Vorrat', standardWert: 3, gross: true, einheit: 'kg' }))
    expect(gross).toContain('border-b-2 border-status-fertig')
    expect(gross).toContain('size-14 bg-card')
    expect(gross).toContain('>kg<')
  })
})

describe('Diagrammfarbe (G13) und Bilder im Dunkeln (G12)', () => {
  it('Balken im Dunkeln helles Mint, Vergleich dieselbe Farbe leichter, leerer Tag nur ein Strich', () => {
    expect(DIAGRAMM_BALKEN).toContain('dark:bg-status-fertig')
    expect(DIAGRAMM_VERGLEICH).toMatch(/dark:bg-status-fertig\/\d+/)
    expect(DIAGRAMM_VERGLEICH).not.toBe(DIAGRAMM_BALKEN)
    expect(DIAGRAMM_LEER).toBe('bg-border')
  })

  it('Vergleichsbalken auf bg-card ≥ 3:1 in beiden Themes (WCAG 1.4.11) — aus globals.css nachgerechnet', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
    const token = (selektor: string, name: string): string => {
      const start = css.indexOf(`${selektor} {`)
      expect(start, selektor).toBeGreaterThan(-1)
      const block = css.slice(start, css.indexOf('\n}', start))
      const roh = new RegExp(`--fz-${name}:\\s*([^;]+);`).exec(block)?.[1]
      const farbe = roh ? leseOklch(roh) : null
      if (!farbe) throw new Error(`fehlt: ${selektor} --fz-${name}`)
      return oklchZuHex(farbe)
    }
    // Deckkraft wie im Browser: sRGB-Mischung der Balkenfarbe mit der Karte darunter.
    const decke = (vorn: string, grund: string, anteil: number): string => {
      const kanal = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)
      return `#${[0, 1, 2].map((i) => Math.round(anteil * kanal(vorn, i) + (1 - anteil) * kanal(grund, i)).toString(16).padStart(2, '0')).join('').toUpperCase()}`
    }
    const anteil = (muster: RegExp): number => {
      const m = muster.exec(DIAGRAMM_VERGLEICH)
      if (!m) throw new Error(`Deckkraft fehlt in ${DIAGRAMM_VERGLEICH}`)
      return Number(m[1]) / 100
    }
    const hell = anteil(/(?:^| )bg-accent\/(\d+)/)
    const dunkel = anteil(/dark:bg-status-fertig\/(\d+)/)

    const hellKarte = token(':root', 'surface')
    const dunkelKarte = token('[data-theme="dark"]', 'surface')
    expect(kontrast(decke(token(':root', 'accent'), hellKarte, hell), hellKarte)).toBeGreaterThanOrEqual(3)
    expect(kontrast(decke(token('[data-theme="dark"]', 'status-fertig'), dunkelKarte, dunkel), dunkelKarte)).toBeGreaterThanOrEqual(3)
    // Gegenprobe: der alte Vergleich (30 % / 40 %) lag darunter — die Rechnung unterscheidet.
    expect(kontrast(decke(token(':root', 'accent'), hellKarte, 0.3), hellKarte)).toBeLessThan(3)
    expect(kontrast(decke(token('[data-theme="dark"]', 'status-fertig'), dunkelKarte, 0.4), dunkelKarte)).toBeLessThan(3)
  })

  it('Platzhalter auf der gedämpften Fläche, Kartenkacheln mit der Fläche der Hülle multipliziert', () => {
    expect(PLATZHALTER_FLAECHE).toBe('bg-muted')
    expect(KARTE_KACHELN).toBe(ILLUSTRATION_BILD)
    expect(KARTE_HUELLE).toContain('isolate')
    expect(KARTE_HUELLE).toContain('dark:bg-muted')
    expect(FOTO_HUELLE).toBe('dark:brightness-[0.85]')
  })
})

describe('Positionszeile (G14)', () => {
  it('Anzahl vorn, Gebinde in Klammern', () => {
    expect(positionszeile({ name: 'Heumilch frisch', quantity: 4, unit: 'LITER', unitSize: 1 })).toEqual({
      anzahl: '4',
      name: 'Heumilch frisch',
      gebinde: '1 L',
      text: '4 × Heumilch frisch (1 L)',
    })
    expect(positionszeile({ name: 'Bergkäse', quantity: 2, unit: 'G', unitSize: 250 }).text).toBe('2 × Bergkäse (250 g)')
  })

  it('Stück ohne Gebinde und ohne Einheit: nur Anzahl und Name; Pakete mit Mehrzahl', () => {
    expect(positionszeile({ name: 'Freilandeier', quantity: 3, unit: 'STUECK', unitSize: null }).text).toBe('3 × Freilandeier')
    expect(positionszeile({ name: 'Brot', quantity: 1 }).gebinde).toBeNull()
    // Gegenprobe: ein Gebinde aus mehreren Stück steht da.
    expect(positionszeile({ name: 'Eier', quantity: 1, unit: 'STUECK', unitSize: 6 }).gebinde).not.toBeNull()
    expect(positionszeile({ name: '  Honig ', quantity: 1.5, unit: 'KG', unitSize: null }).text).toBe('1,5 × Honig (1 kg)')
  })
})

describe('Kurznummer (G14)', () => {
  const ID = 'cmw4fc4j0000abcd4f8m2q'

  it('groß, aus dem Ende derselben ID, sechs Zeichen', () => {
    expect(KURZNUMMER_LAENGE).toBe(6)
    expect(kurznummerAus(ID)).toBe('4F8M2Q')
    // Zwei IDs mit gleichem Anfang (gleicher Zeitstempel) bekommen verschiedene Kurznummern.
    expect(kurznummerAus('cmw4fc4j0001abcdxyz123')).not.toBe(kurznummerAus('cmw4fc4j0001abcdxyz124'))
    expect(kurznummerAus('abc')).toBe('ABC')
  })

  it('die Suche trifft die ganze ID und die Kurznummer, groß oder klein, mit „#“ und Rändern', () => {
    expect(passtZurKurznummer(ID, ID)).toBe(true)
    expect(passtZurKurznummer(ID, '4F8M2Q')).toBe(true)
    expect(passtZurKurznummer(ID, ' #4f8m2q ')).toBe(true)
  })

  it('Übergang: die alte Nummer aus meldung.ts (die ersten acht Zeichen) trifft weiter', () => {
    expect(kurznummer(ID)).toBe('cmw4fc4j')
    expect(passtZurKurznummer(ID, kurznummer(ID))).toBe(true)
    expect(passtZurKurznummer(ID, '#CMW4FC4J')).toBe(true)
    // Gegenprobe: kürzer, länger oder verschoben ist es keine alte Nummer.
    expect(passtZurKurznummer(ID, 'cmw4fc4')).toBe(false)
    expect(passtZurKurznummer(ID, 'cmw4fc4j0')).toBe(false)
    expect(passtZurKurznummer(ID, 'mw4fc4j0')).toBe(false)
  })

  it('Gegenprobe: ein beliebiges Stück, eine falsche Nummer oder nichts trifft nicht', () => {
    expect(passtZurKurznummer(ID, 'Q')).toBe(false)
    expect(passtZurKurznummer(ID, '8M2Q')).toBe(false)
    expect(passtZurKurznummer(ID, 'cmw4f')).toBe(false)
    expect(passtZurKurznummer(ID, '4F8M2R')).toBe(false)
    expect(passtZurKurznummer(ID, '  ')).toBe(false)
  })
})

describe('Vorschau /intern/bausteine (Nr. 248)', () => {
  it('zeigt G5, G12, G13, G14 und die Geldsätze im eigenen Einhängepunkt', () => {
    const markup = html(createElement(Vorschau248))
    for (const titel of ['Größenkachel (G5)', 'Stepper und Diagrammfarbe (G13)', 'Bilder im Dunkeln (G12)', 'Positionszeile und Kurznummer (G14)', 'Geldsätze nach V1']) {
      expect(markup).toContain(titel)
    }
    expect(markup).toContain('data-slot="groessenkachel"')
    expect(markup).toContain('data-slot="stepper-pille"')
    expect(markup).toContain('Du bekommst')
    expect(markup).toContain('ohne Gebühr für dich.')
    expect(markup).toContain('<strong class="font-bold tabular-nums">4</strong> × Heumilch frisch')
  })
})
