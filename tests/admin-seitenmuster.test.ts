/**
 * Die drei Bausteine des Admin-Seitenmusters (Register N15, Nr. 94) — gerendert
 * wie auf dem Server: Seitenkopf, Kennzahlen, Unterreiter.
 *
 * Beweist:
 *  - Seitenkopf: h1 und ein Satz; rechts nur, was die Seite hineinlegt.
 *  - Kennzahlen: eine Beschreibungsliste, die Zahl in Fraunces; der Ton kommt
 *    aus den Bedeutungs-Tokens (tun, läuft) und steht nur an der Kachel, die
 *    ihn bekommt — neutral trägt keinen. Am Handy zu dritt, Kacheln mit
 *    `amHandy: false` fallen dort weg, die Spaltenzahl ab 1024 px folgt der Zahl.
 *  - Unterreiter: echte Links mit dem Parameter `reiter`, genau einer trägt
 *    aria-current="page", die Zahl steht in der Pille, die Tippfläche misst
 *    mindestens 44 px (sichtbar 36 px, der Rest über ::before wie bei den
 *    Filter-Chips).
 *  - Gegenproben: ein kleiner Chip fällt durch die Messung, ohne Ton keine
 *    Tonklasse, ohne Auswahl kein aria-current.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch'))
    return createElement('a', { href, ...attribute }, children)
  },
}))

import { Seitenkopf } from '@/components/admin/seitenkopf'
import { Kennzahlen } from '@/components/admin/kennzahlen'
import { Unterreiter } from '@/components/admin/unterreiter'
import type { KennzahlDaten, UnterreiterDaten } from '@/lib/admin-seiten'

const quelle = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

/** Die Klassen des ersten Tags, der `muster` im Markup enthält. */
function tagMit(html: string, muster: string): string {
  const stelle = html.indexOf(muster)
  expect(stelle, muster).toBeGreaterThan(-1)
  const anfang = html.lastIndexOf('<', stelle)
  return html.slice(anfang, html.indexOf('>', stelle) + 1)
}

/**
 * So hoch ist die Tippfläche mindestens, wie die Klassen sie nennen: `h-N` oder
 * `min-h-N` (N × 4 px) plus, was `before:-inset-y-N` oben und unten dazugibt.
 * Das ist die Messung, an der die Pillen hängen — ein Chip mit `h-8` fällt durch.
 */
function tippflaecheHoehe(klassen: string): number {
  const hoehe = /(?:^|\s)(?:min-)?h-(\d+(?:\.\d+)?)(?=\s|$)/.exec(klassen)
  // Das ::before sitzt im Innenrand eines Rahmens: Mit `border` fehlen oben und unten je 1 px (Nr. 118, Filter-Chip).
  const rahmen = /(?:^|\s)border(?=\s|$)/.test(klassen) ? 2 : 0
  const ueberstand = /(?:^|\s)before:-inset-y-(?:(\d+(?:\.\d+)?)|\[(\d+)px\])(?=\s|$)/.exec(klassen)
  const px = ueberstand ? (ueberstand[1] !== undefined ? Number(ueberstand[1]) * 4 : Number(ueberstand[2])) : 0
  return (hoehe ? Number(hoehe[1]) * 4 : 0) - rahmen + px * 2
}

const kachel = (ueber: Partial<KennzahlDaten> & { id: string }): KennzahlDaten => ({ titel: 'Titel', wert: '1', ...ueber })

describe('Seitenkopf', () => {
  it('h1 und ein Satz; rechts steht, was die Seite hineinlegt', () => {
    const html = renderToStaticMarkup(createElement(Seitenkopf, { titel: 'Höfe', satz: 'Was wartet, steht oben.', rechts: createElement('button', null, 'Suchen') }))
    expect(html).toMatch(/<h1[^>]*>Höfe<\/h1>/)
    expect(html).toContain('Was wartet, steht oben.')
    expect(html).toContain('<button>Suchen</button>')
  })

  it('Gegenprobe: ohne rechts bleibt die Seite des Kopfs leer', () => {
    const html = renderToStaticMarkup(createElement(Seitenkopf, { titel: 'Finanzen', satz: 'Ein Satz.' }))
    expect(html).not.toContain('<button')
    expect(html.match(/<h1/g)).toHaveLength(1)
  })

  it('ein Hinweis steht als zweite leise Zeile unter dem Satz — ohne Hinweis (oder null) keine zweite Zeile', () => {
    const mit = renderToStaticMarkup(createElement(Seitenkopf, { titel: 'Finanzen', satz: 'Ein Satz.', hinweis: 'Ein Hinweis.' }))
    expect(mit).toMatch(/Ein Satz\.<\/p><p class="[^"]*text-muted-foreground[^"]*">Ein Hinweis\.<\/p>/)
    for (const hinweis of [undefined, null]) {
      expect(renderToStaticMarkup(createElement(Seitenkopf, { titel: 'Finanzen', satz: 'Ein Satz.', hinweis })).match(/<p/g)).toHaveLength(1)
    }
  })
})

describe('Kennzahlen', () => {
  const daten: KennzahlDaten[] = [
    kachel({ id: 'a', titel: 'Warten', wert: '2', satz: 'auf Freischaltung', ton: 'tun' }),
    kachel({ id: 'b', titel: 'Online', wert: '3', ton: 'laeuft' }),
    kachel({ id: 'c', titel: 'Pausiert', wert: '1', ton: 'neutral', amHandy: false }),
  ]
  const html = renderToStaticMarkup(createElement(Kennzahlen, { beschriftung: 'Höfe in Zahlen', eintraege: daten }))

  it('eine Beschreibungsliste mit Titel, Zahl und Satz je Kachel, benannt für den Screenreader', () => {
    expect(html).toContain('aria-label="Höfe in Zahlen"')
    expect(html.match(/<dt/g)).toHaveLength(3)
    expect(html).toMatch(/<dt[^>]*>[\s\S]*?Warten[\s\S]*?<\/dt><dd[^>]*>2<\/dd><dd[^>]*>auf Freischaltung<\/dd>/)
  })

  it('die Zahl steht in Fraunces (font-heading)', () => {
    expect(tagMit(html, '>2</dd>')).toContain('font-heading')
  })

  it('der Ton kommt aus den Bedeutungs-Tokens und steht nur an seiner Kachel', () => {
    expect(tagMit(html, '>2</dd>')).toContain('text-zustand-tun')
    expect(tagMit(html, '>3</dd>')).toContain('text-zustand-laeuft')
    // Gegenprobe: neutral trägt keinen Zustandston.
    expect(tagMit(html, '>1</dd>')).not.toContain('text-zustand')
    expect(tagMit(html, '>1</dd>')).toContain('text-foreground')
  })

  it('am Handy zu dritt; eine Kachel mit amHandy: false fällt dort weg, die anderen nicht', () => {
    expect(tagMit(html, '<dl')).toContain('grid-cols-3')
    const pausiert = html.slice(html.lastIndexOf('<div', html.indexOf('Pausiert')), html.indexOf('Pausiert'))
    expect(pausiert).toMatch(/\bhidden\b/)
    const warten = html.slice(html.lastIndexOf('<div', html.indexOf('Warten')), html.indexOf('Warten'))
    expect(warten).not.toMatch(/\bhidden\b/)
  })

  it('ab 1024 px so viele Spalten wie Kacheln (3 bis 5)', () => {
    const fuenf = Array.from({ length: 5 }, (_, i) => kachel({ id: String(i) }))
    expect(tagMit(renderToStaticMarkup(createElement(Kennzahlen, { beschriftung: 'x', eintraege: fuenf })), '<dl')).toContain('lg:grid-cols-5')
    expect(tagMit(html, '<dl')).toContain('lg:grid-cols-3')
  })

  it('ein Kurztitel ersetzt den Titel nur am Handy', () => {
    const mit = renderToStaticMarkup(createElement(Kennzahlen, { beschriftung: 'x', eintraege: [kachel({ id: 'p', titel: 'Gründungsplätze', titelKurz: 'Plätze frei' })] }))
    expect(tagMit(mit, '>Plätze frei<')).toMatch(/md:hidden/)
    expect(tagMit(mit, '>Gründungsplätze<')).toMatch(/hidden md:inline/)
    // Gegenprobe: ohne Kurztitel steht der Titel ein einziges Mal da.
    expect(html.match(/Warten/g)).toHaveLength(1)
  })

  it('der Satz einer Kachel steht am Handy nur, wenn die Kachel ihn dort will', () => {
    const zwei = renderToStaticMarkup(
      createElement(Kennzahlen, {
        beschriftung: 'x',
        eintraege: [kachel({ id: 'a', satz: 'bleibt kurz' }), kachel({ id: 'b', satz: 'gilt auch am Handy', satzAmHandy: true })],
      })
    )
    expect(tagMit(zwei, '>bleibt kurz<')).toMatch(/hidden md:block/)
    expect(tagMit(zwei, '>gilt auch am Handy<')).not.toMatch(/\bhidden\b/)
  })

  it('der Baustein schreibt keine Farbe selbst: kein Hex, keine Palette, kein style', () => {
    const text = quelle('src/components/admin/kennzahlen.tsx')
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:bg|text|border)-(?:slate|gray|zinc|amber|orange|green|red|stone)-\d/)
    expect(text).not.toContain('style={{')
  })
})

describe('Unterreiter', () => {
  const eintraege: UnterreiterDaten[] = [
    { id: 'warten', label: 'Warten auf Freischaltung', labelKurz: 'Warten', href: '/admin?reiter=warten', zahl: '2' },
    { id: 'alle', label: 'Alle Höfe', labelKurz: 'Alle', href: '/admin?reiter=alle', zahl: '4' },
    { id: 'gruendung', label: 'Gründungshöfe', href: '/admin?reiter=gruendung', zahl: '7 / 12' },
  ]
  const html = renderToStaticMarkup(createElement(Unterreiter, { beschriftung: 'Höfe wählen', eintraege, aktiv: 'alle' }))

  it('eine Navigation aus echten Links mit dem Parameter reiter', () => {
    expect(html).toMatch(/<nav[^>]*aria-label="Höfe wählen"/)
    expect([...html.matchAll(/<a href="([^"]+)"/g)].map((t) => t[1])).toEqual(['/admin?reiter=warten', '/admin?reiter=alle', '/admin?reiter=gruendung'])
    for (const e of eintraege) expect(new URL(e.href, 'https://x.example').searchParams.get('reiter')).toBe(e.id)
  })

  it('genau der aktive Reiter trägt aria-current="page"', () => {
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(tagMit(html, 'href="/admin?reiter=alle"')).toContain('aria-current="page"')
    expect(tagMit(html, 'href="/admin?reiter=warten"')).not.toContain('aria-current')
  })

  it('Gegenprobe: ohne Auswahl trägt keiner aria-current', () => {
    const ohne = renderToStaticMarkup(createElement(Unterreiter, { beschriftung: 'Höfe wählen', eintraege, aktiv: null }))
    expect(ohne).not.toContain('aria-current')
  })

  it('die Zahl steht in der Pille, auch „7 / 12“', () => {
    expect(html).toMatch(/Warten auf Freischaltung[\s\S]*?>2<\/span>/)
    expect(html).toContain('>7 / 12<')
  })

  it('ein Kurzname steht neben dem langen und nur am Handy', () => {
    expect(tagMit(html, '>Warten<')).toMatch(/md:hidden/)
    expect(tagMit(html, '>Warten auf Freischaltung<')).toMatch(/hidden md:inline/)
    // Gegenprobe: „Gründungshöfe“ hat keinen Kurznamen und steht einmal da.
    expect(html.match(/Gründungshöfe/g)).toHaveLength(1)
  })

  it('jede Pille hat eine Tippfläche von mindestens 44 px', () => {
    for (const e of eintraege) {
      const klassen = /class="([^"]*)"/.exec(tagMit(html, `href="${e.href}"`))?.[1] ?? ''
      expect(tippflaecheHoehe(klassen), e.id).toBeGreaterThanOrEqual(44)
    }
  })

  it('Gegenprobe: die Messung lässt einen kleinen Chip durchfallen', () => {
    expect(tippflaecheHoehe('inline-flex h-8 px-3')).toBeLessThan(44)
    expect(tippflaecheHoehe('inline-flex h-9 px-3')).toBeLessThan(44)
    expect(tippflaecheHoehe("relative inline-flex h-9 before:absolute before:-inset-y-1 before:content-['']")).toBe(44)
    expect(tippflaecheHoehe('inline-flex min-h-11')).toBe(44)
    // mit Rahmen zählt der Innenrand: 4 px Überstand ergäben nur 42 px, 5 px ergeben 44
    expect(tippflaecheHoehe("relative inline-flex h-9 border before:absolute before:-inset-y-1 before:content-['']")).toBe(42)
    expect(tippflaecheHoehe("relative inline-flex h-9 border before:absolute before:-inset-y-[5px] before:content-['']")).toBe(44)
  })

  it('ohne Zahl steht nur das Wort', () => {
    const ohneZahl = renderToStaticMarkup(
      createElement(Unterreiter, { beschriftung: 'Monat', eintraege: [{ id: 'monat', label: 'Monat', href: '/admin/finanzen?reiter=monat' }], aktiv: 'monat' })
    )
    expect(ohneZahl).toMatch(/>Monat<\/a>/)
  })
})
