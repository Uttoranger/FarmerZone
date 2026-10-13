/**
 * Tests für das Titelbild der Hofseite (Register N6, Nachtlauf Nr. 72; N13, Nr. 89).
 *
 * Beweist:
 *  - titelbildDarstellung (N13): Ein Foto, das weniger als 1,5-mal so breit wie
 *    hoch ist, steht ganz — Quadrat, Hochformat und 4:3. Ab 3:2 (und breiter)
 *    füllt es die Fläche mit Fokuspunkt, so wie vor N6. Unbekannte Maße (vor dem
 *    Laden) bleiben beim Beschnitt.
 *  - leseBildmasse: Die Maße kommen aus dem geladenen Bild; meldet der Browser
 *    keine (0), gelten sie als unbekannt.
 *  - titelbildHinweis: Der Satz für Mein Hof erscheint genau dann, wenn die
 *    Hofseite das Foto ganz zeigt.
 *  - Der Rahmen wird mit der Breite höher (220/300/360/420 px) und rechnet mit
 *    höchstens 1 920 px: Das scharfe Foto steht in einem Kasten dieser Breite,
 *    die unscharfe Kopie liegt dahinter über die volle Breite und füllt, was der
 *    Kasten freilässt. Kasten und `sizes` nennen dieselbe Zahl, sonst lüde der
 *    Browser die falsche Breite.
 *  - Die Kopie ist in beiden Darstellungen da: bei „ganz“ sichtbar, bei
 *    „beschnitt“ nur über 1 920 px — und sie blendet ein (`transition-opacity`),
 *    damit der Wechsel nach dem Laden nicht springt.
 *  - Nur das vordere Bild liest die Maße (onLoad); sonst käme der Wechsel nie,
 *    und kein anderer Test sähe es. Der Alt-Text bleibt leer.
 *  - Der Satz steht nur in lib/titelbild.ts, das Titelbild nur in titelbild.tsx.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Next gibt es im Test nicht: Das Bild wird zu einem schlichten <img>, das
// Quelle, Alt-Text, sizes und Klassen behält und anzeigt, ob es onLoad trägt.
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string; sizes?: string; className?: string; onLoad?: () => void }) =>
    createElement('img', {
      src: p.src,
      alt: p.alt,
      sizes: p.sizes,
      className: p.className,
      'data-liest-masse': typeof p.onLoad === 'function' ? 'ja' : undefined,
    }),
}))

import { Titelbild, TitelbildBilder } from '@/components/hofseite/titelbild'
import { TITELBILD_BREITE_MAX, TITELBILD_SIZES, leseBildmasse, titelbildDarstellung, titelbildHinweis } from '@/lib/titelbild'

const QUER = { breite: 3000, hoehe: 2000 }
const QUADRAT = { breite: 1000, hoehe: 1000 }
const HOCH = { breite: 3000, hoehe: 4000 }

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')
const bilder = (html: string) => html.match(/<img\b[^>]*>/g) ?? []
/** Der erste öffnende Tag, der `merkmal` enthält. */
const tag = (html: string, merkmal: RegExp) => new RegExp(`<[a-z]+\\b[^>]*${merkmal.source}[^>]*>`).exec(html)?.[0] ?? ''
const klassen = (oeffnenderTag: string) => (/class="([^"]*)"/.exec(oeffnenderTag)?.[1] ?? '').split(/\s+/).filter(Boolean)

describe('titelbildDarstellung (Register N13)', () => {
  it.each([
    ['3:2 füllt die Fläche', QUER, 'beschnitt'],
    ['16:9 füllt die Fläche', { breite: 1920, hoehe: 1080 }, 'beschnitt'],
    ['21:9 füllt die Fläche', { breite: 2100, hoehe: 900 }, 'beschnitt'],
    ['4:3 steht ganz', { breite: 4000, hoehe: 3000 }, 'ganz'],
    ['1:1 steht ganz', QUADRAT, 'ganz'],
    ['3:4 steht ganz', HOCH, 'ganz'],
  ] as const)('%s', (_name, masse, erwartet) => {
    expect(titelbildDarstellung(masse)).toBe(erwartet)
  })

  it('kippt genau bei 1,5: knapp darunter ganz, ab 3:2 beschnitten', () => {
    expect(titelbildDarstellung({ breite: 1499, hoehe: 1000 })).toBe('ganz')
    expect(titelbildDarstellung({ breite: 1500, hoehe: 1000 })).toBe('beschnitt')
    expect(titelbildDarstellung({ breite: 1501, hoehe: 1000 })).toBe('beschnitt')
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
  it('sagt bei Quadrat und Hochformat, was die Hofseite daraus macht — und nennt das Querformat als Ausweg', () => {
    const satz = 'Quadrat oder Hochformat – am Computer zeigen wir es ganz, mit weichem Rand. Ein Querformat wirkt dort größer.'
    expect(titelbildHinweis(QUADRAT)).toBe(satz)
    expect(titelbildHinweis(HOCH)).toBe(satz)
  })

  it('steht bei allem, was die Hofseite ganz zeigt — auch bei 4:3', () => {
    expect(titelbildHinweis({ breite: 4000, hoehe: 3000 })).not.toBeNull()
  })

  it('schweigt bei Querformat ab 3:2 und bei unbekannten Maßen', () => {
    expect(titelbildHinweis(QUER)).toBeNull()
    expect(titelbildHinweis({ breite: 1920, hoehe: 1080 })).toBeNull()
    expect(titelbildHinweis(null)).toBeNull()
  })
})

describe('TitelbildBilder', () => {
  const DARSTELLUNGEN = ['beschnitt', 'ganz'] as const
  const zeige = (darstellung: 'beschnitt' | 'ganz') =>
    renderToStaticMarkup(createElement(TitelbildBilder, { foto: '/foto.jpg', fokusY: 40, darstellung, beimLaden: () => {} }))
  /** Die Lage der unscharfen Kopie: der Behälter, den Screenreader überspringen. */
  const kopie = (html: string) => tag(html, /aria-hidden="true"/)
  /** Der Kasten, in dem das scharfe Foto steht. */
  const kasten = (html: string) => tag(html, /max-w-\[\d+px\]/)
  /** Das Bild der Kopie (das erste im Baum) und das scharfe Foto (das, das die Maße liest). */
  const kopieBild = (html: string) => bilder(html).find((b) => !b.includes('data-liest-masse')) ?? ''
  const fotoBild = (html: string) => bilder(html).find((b) => b.includes('data-liest-masse')) ?? ''

  it.each(DARSTELLUNGEN)('%s: zwei Bilder desselben Fotos, die Kopie und das scharfe Foto', (darstellung) => {
    const html = zeige(darstellung)
    expect(bilder(html)).toHaveLength(2)
    expect(kopieBild(html)).toContain('src="/foto.jpg"')
    expect(fotoBild(html)).toContain('src="/foto.jpg"')
  })

  it.each(DARSTELLUNGEN)('%s: nur das vordere Bild liest die Maße, die Kopie ist für Screenreader verborgen', (darstellung) => {
    const html = zeige(darstellung)
    expect(kopie(html)).not.toBe('')
    expect(kopieBild(html)).not.toBe('')
    expect(fotoBild(html)).toContain('data-liest-masse="ja"')
  })

  it.each(DARSTELLUNGEN)('%s: leerer Alt-Text, die Überschrift nennt den Hof', (darstellung) => {
    for (const bild of bilder(zeige(darstellung))) expect(bild).toContain('alt=""')
  })

  it.each(DARSTELLUNGEN)('%s: das scharfe Foto steht im Kasten, die unscharfe Kopie davor im Baum — also dahinter — und außerhalb', (darstellung) => {
    const html = zeige(darstellung)
    expect(html.indexOf(kopieBild(html))).toBeLessThan(html.indexOf(kasten(html)))
    expect(html.indexOf(kasten(html))).toBeLessThan(html.indexOf(fotoBild(html)))
  })

  it('der Kasten ist zentriert, so hoch wie der Rahmen und höchstens 1 920 px breit', () => {
    expect(klassen(kasten(zeige('ganz')))).toEqual(expect.arrayContaining(['relative', 'mx-auto', 'h-full', `max-w-[${TITELBILD_BREITE_MAX}px]`]))
  })

  it('Kasten und sizes rechnen mit derselben Breite — der Browser lädt höchstens so viel', () => {
    const html = zeige('ganz')
    expect(/max-w-\[(\d+)px\]/.exec(kasten(html))?.[1]).toBe(String(TITELBILD_BREITE_MAX))
    expect(TITELBILD_SIZES).toBe('(min-width: 1920px) 1920px, 100vw')
    // Gleiches sizes an beiden Bildern: Der Browser holt dieselbe Datei nur einmal.
    for (const bild of bilder(html)) expect(bild).toContain(`sizes="${TITELBILD_SIZES}"`)
  })

  it('ganz: die Kopie ist ab 768 px sichtbar, das Foto steht dort ganz (contain)', () => {
    const html = zeige('ganz')
    const k = klassen(kopie(html))
    expect(k).toEqual(expect.arrayContaining(['hidden', 'md:block', 'opacity-100']))
    expect(k).not.toContain('opacity-0')
    expect(klassen(fotoBild(html))).toContain('md:object-contain')
  })

  it('beschnitt: die Kopie bleibt unsichtbar und ist nur über 1 920 px sichtbar — dort füllt sie die Ränder; das Foto füllt die Fläche', () => {
    const html = zeige('beschnitt')
    const k = klassen(kopie(html))
    expect(k).toEqual(expect.arrayContaining(['opacity-0', 'min-[1920px]:opacity-100']))
    expect(k).not.toContain('opacity-100')
    expect(klassen(fotoBild(html))).toContain('object-cover')
    expect(klassen(fotoBild(html))).not.toContain('md:object-contain')
  })

  it.each(DARSTELLUNGEN)('%s: die Kopie blendet ein, statt zu springen (transition-opacity), und ist weichgezeichnet', (darstellung) => {
    const html = zeige(darstellung)
    expect(klassen(kopie(html))).toContain('transition-opacity')
    expect(klassen(kopieBild(html)).some((c) => c.startsWith('blur-'))).toBe(true)
    expect(klassen(kopieBild(html))).toContain('object-cover')
  })

  it.each(DARSTELLUNGEN)('%s: das scharfe Foto ist nie weichgezeichnet', (darstellung) => {
    expect(klassen(fotoBild(zeige(darstellung))).some((c) => c.startsWith('blur-'))).toBe(false)
  })
})

describe('Titelbild', () => {
  const zeige = (foto: string | null) =>
    renderToStaticMarkup(
      createElement(Titelbild, { foto, verlauf: 'linear-gradient(1deg, red, blue)', fokusY: 50 }, createElement('button', null, 'Teilen'))
    )
  const rahmen = (html: string) => tag(html, /data-abschnitt="titelbild"/)

  // Feste Höhen, auch ohne Foto: Nach dem Laden springt nichts (Register N13).
  it.each([
    ['mit Foto', '/foto.jpg'],
    ['ohne Foto', null],
  ])('der Rahmen wird mit der Breite höher: 220 px am Handy, 300 ab 768, 360 ab 1 280, 420 ab 1 536 (%s)', (_name, foto) => {
    const k = klassen(rahmen(zeige(foto)))
    expect(k).toEqual(expect.arrayContaining(['h-[220px]', 'md:h-[300px]', 'xl:h-[360px]', '2xl:h-[420px]', 'w-full', 'overflow-hidden']))
  })

  it('vor dem Laden (auf dem Server) füllt das Foto die Fläche: Querformat springt nie', () => {
    const html = zeige('/foto.jpg')
    const vorn = bilder(html).find((b) => b.includes('data-liest-masse')) ?? ''
    expect(klassen(vorn)).toContain('object-cover')
    expect(klassen(vorn)).not.toContain('md:object-contain')
    // Die Kopie wartet unsichtbar, bis der Browser die Maße kennt.
    expect(klassen(tag(html, /aria-hidden="true"/))).toContain('opacity-0')
  })

  it('ohne Foto steht der Verlauf des Hofs, kein Bild und keine Kopie', () => {
    const html = zeige(null)
    expect(bilder(html)).toHaveLength(0)
    expect(html).toContain('linear-gradient(1deg, red, blue)')
    expect(html).not.toContain('max-w-[1920px]')
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
