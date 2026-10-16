/**
 * Die vier Vorlagen der Startseite (Register N16, Nr. 96) — Rendertests ohne
 * DOM (renderToStaticMarkup). Das Lesen der Liste prüft seit Nr. 99
 * tests/startseite-live.test.ts (Fassung statt Tabellen).
 *
 * Beweist:
 *  - Jede Vorlage rendert ihre Merkmale (Titel, Überzeile, Text, Link mit
 *    Linktext, Bild, Höfe, Kategorie mit Link auf Entdecken); Gegenprobe:
 *    dieselben Merkmale fehlen, wo die Daten fehlen — und keine Vorlage
 *    rendert die Merkmale einer anderen.
 *  - Die Höfe-Auswahl ohne sichtbaren Hof rendert nichts.
 *  - Keine Vorlage schreibt eine Hexfarbe oder eine Farbe als style.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
import type { StartseitenBlockDaten } from '@/lib/startseite-gestalten'
import { hoefeAdresse, type StartseitenHof } from '@/lib/startseite'
import { StartseitenBlock } from '@/components/startseite/bloecke/startseiten-block'

const html = (node: ReactNode) => renderToStaticMarkup(createElement('div', null, node))

function block(teil: Partial<StartseitenBlockDaten>): StartseitenBlockDaten {
  return {
    id: 'b1',
    vorlage: 'SAISONKARTE',
    ueberzeile: null,
    titel: 'Titel des Blocks',
    text: null,
    bildUrl: null,
    linkUrl: null,
    linkText: null,
    hofSlugs: [],
    kategorie: null,
    liveAb: '2026-10-01T04:00:00.000Z',
    liveBis: null,
    ...teil,
  }
}

const HOF: StartseitenHof = {
  slug: 'hof-test',
  name: 'Hof Test',
  ort: '4910 Musterort',
  abholung: null,
  abholungIstTermin: false,
  angebot: 'Eier',
  foto: null,
  lage: null,
}

const BILD = 'https://speicher.public.blob.vercel-storage.com/startseite/bilder/1.webp'

describe('Saisonkarte mit Bild', () => {
  it('zeigt Überzeile, Titel, Text, Bild und den Link mit Linktext', () => {
    const aus = html(
      createElement(StartseitenBlock, {
        block: block({ ueberzeile: 'Ostern am Hof', text: 'Vorbestellen bis Donnerstag.', bildUrl: BILD, linkUrl: '/hoefe?kategorien=EIER', linkText: 'Höfe mit Eiern' }),
      })
    )
    expect(aus).toContain('Ostern am Hof')
    expect(aus).toContain('Titel des Blocks')
    expect(aus).toContain('Vorbestellen bis Donnerstag.')
    expect(aus).toContain(`src="${BILD}"`)
    expect(aus).toContain('href="/hoefe?kategorien=EIER"')
    expect(aus).toContain('Höfe mit Eiern')
    expect(aus).toContain('aria-labelledby="block-b1-titel"')
  })

  it('Gegenprobe: ohne Bild, Text und Link fehlen sie auch im HTML', () => {
    const aus = html(createElement(StartseitenBlock, { block: block({}) }))
    expect(aus).toContain('Titel des Blocks')
    expect(aus).not.toContain('<img')
    expect(aus).not.toContain('<a ')
  })
})

describe('Hinweisband', () => {
  it('zeigt den Satz in der Hinweiskarte, den Link als Knopf', () => {
    const aus = html(createElement(StartseitenBlock, { block: block({ vorlage: 'HINWEISBAND', titel: 'Viele Höfe machen im Jänner Winterpause.', linkUrl: '/hoefe', linkText: 'Offene Höfe' }) }))
    expect(aus).toContain('data-slot="hinweiskarte"')
    expect(aus).toContain('Viele Höfe machen im Jänner Winterpause.')
    expect(aus).toContain('href="/hoefe"')
    expect(aus).toContain('lucide-info')
    // Ein Satz, keine Überschrift: gliedert die Seite nicht.
    expect(aus).not.toContain('<h2')
  })
})

describe('Höfe-Auswahl', () => {
  it('zeigt die gewählten Höfe mit der Hofkarte der Startseite', () => {
    const aus = html(createElement(StartseitenBlock, { block: block({ vorlage: 'HOEFE_AUSWAHL', ueberzeile: 'Brennholz jetzt' }), hoefe: [HOF] }))
    expect(aus).toContain('Brennholz jetzt')
    expect(aus).toContain('href="/hof-test"')
    expect(aus).toContain('Hof Test')
    expect(aus).toContain('4910 Musterort')
  })

  it('rendert nichts, wenn keiner der Höfe mehr sichtbar ist', () => {
    expect(html(createElement(StartseitenBlock, { block: block({ vorlage: 'HOEFE_AUSWAHL' }), hoefe: [] }))).toBe('<div></div>')
  })
})

describe('Kategorie-Hinweis', () => {
  it('zeigt Kategorie, Illustration (nachts gedämpft) und den Weg auf Entdecken', () => {
    const aus = html(
      createElement(StartseitenBlock, { block: block({ vorlage: 'KATEGORIE_HINWEIS', kategorie: 'HONIG' }), kategorieBild: '/categories/honig.webp' })
    )
    expect(aus).toContain('Honig &amp; Bienenprodukte')
    expect(aus).toContain('src="/categories/honig.webp"')
    expect(aus).toContain(`href="${hoefeAdresse({ kategorien: ['HONIG'] })}"`)
    expect(aus).toContain('Honig &amp; Bienenprodukte entdecken')
    const abschnitt = readFileSync(join(process.cwd(), 'src/components/startseite/bloecke/kategorie-hinweis.tsx'), 'utf8')
    expect(abschnitt).toMatch(/dark:brightness-\[0\.78\] dark:saturate-\[0\.9\]/)
  })

  it('nimmt ein eigenes Link-Ziel statt Entdecken', () => {
    const aus = html(createElement(StartseitenBlock, { block: block({ vorlage: 'KATEGORIE_HINWEIS', kategorie: 'HONIG', linkUrl: '/fuer-hoefe', linkText: 'Mehr' }) }))
    expect(aus).toContain('href="/fuer-hoefe"')
    expect(aus).not.toContain('href="/hoefe?')
  })
})

describe('alle Vorlagen', () => {
  it('rendert keine fremden Merkmale: nur die Saisonkarte trägt „Saison", nur die Hinweiskarte das Hinweis-Symbol', () => {
    const je = {
      SAISONKARTE: html(createElement(StartseitenBlock, { block: block({}) })),
      HINWEISBAND: html(createElement(StartseitenBlock, { block: block({ vorlage: 'HINWEISBAND' }) })),
      HOEFE_AUSWAHL: html(createElement(StartseitenBlock, { block: block({ vorlage: 'HOEFE_AUSWAHL' }), hoefe: [HOF] })),
      KATEGORIE_HINWEIS: html(createElement(StartseitenBlock, { block: block({ vorlage: 'KATEGORIE_HINWEIS', kategorie: 'EIER' }) })),
    }
    expect(Object.entries(je).filter(([, aus]) => aus.includes('>Saison<')).map(([v]) => v)).toEqual(['SAISONKARTE'])
    expect(Object.entries(je).filter(([, aus]) => aus.includes('lucide-info')).map(([v]) => v)).toEqual(['HINWEISBAND'])
  })

  it('schreibt keine Hexfarbe und keine Farbe als style', () => {
    const ordner = join(process.cwd(), 'src/components/startseite/bloecke')
    for (const datei of readdirSync(ordner)) {
      const quelle = readFileSync(join(ordner, datei), 'utf8')
      expect(quelle, datei).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(quelle, datei).not.toMatch(/style=\{\{[^}]*color/i)
    }
  })
})
