/**
 * Tests für das Titelbild im Hochformat (Register N6, Nachtlauf Nr. 72).
 *
 * Beweist:
 *  - titelbildDarstellung: Nur ein Bild, das höher als breit ist, wird ganz
 *    gezeigt. Unbekannte Maße (vor dem Laden), Querformat und Quadrat bleiben
 *    beim Beschnitt — so sieht die Hofseite für Querformat wie vor N6 aus.
 *  - leseBildmasse: Die Maße kommen aus dem geladenen Bild; meldet der Browser
 *    keine (0), gelten sie als unbekannt.
 *  - titelbildHinweis: Der Satz für Mein Hof erscheint nur bei Hochformat.
 *  - Die Hofseite rendert bei „ganz“ zwei Bilder (unscharfe Kopie hinten,
 *    ganzes Bild vorn), bei „beschnitt“ eines; beide mit leerem Alt-Text. Auf dem
 *    Server — vor dem Laden — ist es immer „beschnitt“: Gerendert wird echt
 *    (react-dom/server in Node), die Maße setzt erst der Browser.
 *  - Nur das vordere Bild liest die Maße (onLoad); sonst käme im Hochformat nie
 *    der Wechsel, und kein anderer Test sähe es.
 *  - Der Satz steht nur in lib/titelbild.ts, das Titelbild nur in titelbild.tsx.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Next gibt es im Test nicht: Das Bild wird zu einem schlichten <img>, das
// Quelle, Alt-Text und aria-hidden behält und anzeigt, ob es onLoad trägt.
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string; 'aria-hidden'?: 'true'; onLoad?: () => void }) =>
    createElement('img', {
      src: p.src,
      alt: p.alt,
      'aria-hidden': p['aria-hidden'],
      'data-liest-masse': typeof p.onLoad === 'function' ? 'ja' : undefined,
    }),
}))

import { Titelbild, TitelbildBilder } from '@/components/hofseite/titelbild'
import { leseBildmasse, titelbildDarstellung, titelbildHinweis } from '@/lib/titelbild'

const QUER = { breite: 4000, hoehe: 3000 }
const QUADRAT = { breite: 1000, hoehe: 1000 }
const HOCH = { breite: 3000, hoehe: 4000 }

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')
const bilder = (html: string) => html.match(/<img\b[^>]*>/g) ?? []

describe('titelbildDarstellung', () => {
  it('zeigt ein Bild, das höher als breit ist, ganz', () => {
    expect(titelbildDarstellung(HOCH)).toBe('ganz')
  })

  it('schon ein Pixel mehr Höhe als Breite macht ein Hochformat', () => {
    expect(titelbildDarstellung({ breite: 1000, hoehe: 1001 })).toBe('ganz')
  })

  it('beschneidet Querformat wie bisher', () => {
    expect(titelbildDarstellung(QUER)).toBe('beschnitt')
  })

  it('beschneidet ein Quadrat: Nur höher als breit zählt', () => {
    expect(titelbildDarstellung(QUADRAT)).toBe('beschnitt')
  })

  it('beschneidet, solange die Maße unbekannt sind (vor dem Laden)', () => {
    expect(titelbildDarstellung(null)).toBe('beschnitt')
  })
})

describe('leseBildmasse', () => {
  it('übernimmt Breite und Höhe des geladenen Bilds', () => {
    expect(leseBildmasse({ naturalWidth: 3000, naturalHeight: 4000 })).toEqual(HOCH)
  })

  it('kennt keine Maße, solange der Browser 0 meldet (kaputtes Bild)', () => {
    expect(leseBildmasse({ naturalWidth: 0, naturalHeight: 0 })).toBeNull()
    expect(leseBildmasse({ naturalWidth: 3000, naturalHeight: 0 })).toBeNull()
  })
})

describe('titelbildHinweis (Satz unter der Vorschau in Mein Hof)', () => {
  it('sagt bei Hochformat, was die Hofseite daraus macht — und nennt das Querformat als Ausweg', () => {
    const satz = titelbildHinweis(HOCH)
    expect(satz).toMatch(/Hochformat/)
    expect(satz).toMatch(/Querformat/)
  })

  it('schweigt bei Querformat, Quadrat und unbekannten Maßen', () => {
    expect(titelbildHinweis(QUER)).toBeNull()
    expect(titelbildHinweis(QUADRAT)).toBeNull()
    expect(titelbildHinweis(null)).toBeNull()
  })
})

describe('TitelbildBilder', () => {
  const zeige = (darstellung: 'beschnitt' | 'ganz') =>
    renderToStaticMarkup(createElement(TitelbildBilder, { foto: '/foto.jpg', fokusY: 40, darstellung, beimLaden: () => {} }))

  it('beschnitt: ein Bild, und es liest die Maße', () => {
    const html = zeige('beschnitt')
    expect(bilder(html)).toHaveLength(1)
    expect(html).toContain('data-liest-masse="ja"')
  })

  it('ganz: zwei Bilder desselben Fotos', () => {
    const treffer = bilder(zeige('ganz'))
    expect(treffer).toHaveLength(2)
    for (const bild of treffer) expect(bild).toContain('src="/foto.jpg"')
  })

  it('ganz: die unscharfe Kopie ist für Screenreader verborgen und liest nichts — nur das vordere Bild liest die Maße', () => {
    const [verborgen, vorn] = [bilder(zeige('ganz')).filter((b) => b.includes('aria-hidden')), bilder(zeige('ganz')).filter((b) => !b.includes('aria-hidden'))]
    expect(verborgen).toHaveLength(1)
    expect(verborgen[0]).not.toContain('data-liest-masse')
    expect(vorn).toHaveLength(1)
    expect(vorn[0]).toContain('data-liest-masse="ja"')
  })

  it('beide Darstellungen: leerer Alt-Text, die Überschrift nennt den Hof', () => {
    for (const darstellung of ['beschnitt', 'ganz'] as const) {
      for (const bild of bilder(zeige(darstellung))) expect(bild).toContain('alt=""')
    }
  })
})

describe('Titelbild', () => {
  const zeige = (foto: string | null) =>
    renderToStaticMarkup(
      createElement(Titelbild, { foto, verlauf: 'linear-gradient(1deg, red, blue)', fokusY: 50 }, createElement('button', null, 'Teilen'))
    )

  it('vor dem Laden (auf dem Server) zeigt es immer ein Bild: Querformat springt nie', () => {
    expect(bilder(zeige('/foto.jpg'))).toHaveLength(1)
  })

  it('ohne Foto steht der Verlauf des Hofs, kein Bild', () => {
    const html = zeige(null)
    expect(bilder(html)).toHaveLength(0)
    expect(html).toContain('linear-gradient(1deg, red, blue)')
  })

  it('trägt, was die Hofseite daraufsetzt, und die Markierung für Mein Hof', () => {
    const html = zeige('/foto.jpg')
    expect(html).toContain('>Teilen</button>')
    expect(html).toContain('data-abschnitt="titelbild"')
  })
})

describe('Quelle', () => {
  it('das Titelbild baut nur titelbild.tsx; die Hofseite bindet es genau einmal ein', () => {
    const kunde = quelle('src/components/hofseite/hofseite-kunde.tsx')
    expect(kunde.match(/<Titelbild\b/g)).toHaveLength(1)
    expect(kunde).not.toContain('data-abschnitt="titelbild"')
    // Gegenprobe: Die Suche findet die Markierung dort, wo sie hingehört.
    expect(quelle('src/components/hofseite/titelbild.tsx')).toContain('data-abschnitt="titelbild"')
  })

  it('Mein Hof nimmt den Satz aus lib/titelbild.ts und liest die Maße aus der Vorschau', () => {
    const bausteine = quelle('src/components/mein-hof/bild-bausteine.tsx')
    expect(bausteine).toContain('titelbildHinweis(')
    expect(bausteine).toMatch(/onLoad=\{beimLaden\}/)
    expect(bausteine).not.toContain('zeigen wir es ganz')
    // Gegenprobe: Der Satz steht in der Quelle.
    expect(quelle('src/lib/titelbild.ts')).toContain('zeigen wir es ganz')
  })
})
