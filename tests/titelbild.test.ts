/**
 * Tests für das Titelbild der Hofseite (Register N6, Nachtlauf Nr. 72; N13, Nr. 89).
 *
 * Beweist:
 *  - titelbildDarstellung (N13): Ein Foto, das weniger als 1,5-mal so breit wie
 *    hoch ist, steht ganz — Quadrat, Hochformat und 4:3. Ab 3:2 (und breiter)
 *    füllt es die Fläche mit Fokuspunkt, so wie vor N6. Unbekannte Maße (vor dem
 *    Laden) bleiben beim Beschnitt. Gerechnet wird mit den Maßen, die der Browser
 *    für die gelieferte Größe meldet, und die sind zweimal verändert: sharp rundet
 *    die Höhe (ein Foto in genau 3:2 kommt als 640 × 427, 1,4988, an), und bei
 *    einer srcset teilt der Browser durch die Bilddichte und rundet ab (einem
 *    glatten 3:2 fehlt an einzelnen Fensterbreiten ein Pixel Breite: 776 × 518
 *    statt 777 × 518). Ein 3:2-Foto bleibt an jeder Breite und Dichte beim
 *    Beschnitt, auch 1499 × 1000; die Fehlbreiten sind in Chrome gemessen.
 *  - leseBildmasse: Die Maße kommen aus dem geladenen Bild; meldet der Browser
 *    keine (0), gelten sie als unbekannt.
 *  - titelbildHinweis: Der Satz für Mein Hof erscheint genau dann, wenn die
 *    Hofseite das Foto ganz zeigt.
 *  - Der Rahmen wird mit der Breite höher (220/300/360/420 px) und rechnet mit
 *    höchstens 1 920 px: Das scharfe Foto steht in einem Kasten dieser Breite,
 *    die unscharfe Kopie liegt dahinter über die volle Breite und füllt, was der
 *    Kasten freilässt. Kasten, Kopie-Grenze und `sizes` nennen dieselbe Zahl,
 *    sonst lüde der Browser die falsche Breite.
 *  - Das scharfe Foto liegt in zwei Lagen mit derselben Quelle: füllend
 *    (object-cover) und ganz (object-contain, erst ab 768 px). `object-fit` lässt
 *    sich nicht überblenden — darum wechselt das Foto nicht die Passung, sondern
 *    die Lage: Beim Wechsel nach dem Laden blenden die ganze Lage und die Kopie
 *    ein, während die füllende ausblendet, alle mit demselben Übergang (N13:
 *    „blendet weich über, kein Sprung“).
 *  - Nur die füllende Lage liest die Maße (onLoad) und lädt vorrangig; sonst
 *    käme der Wechsel nie oder die Datei zweimal. Kopie und ganze Lage sind für
 *    Screenreader verborgen, der Alt-Text bleibt leer.
 *  - Der Weg onLoad → Maße → Lagen läuft im Titelbild selbst (Prüfstand für
 *    useState mit einer Zelle je Aufrufstelle, ohne DOM): Quadrat schaltet um,
 *    3:2 in der gelieferten Größe nicht.
 *  - Der Satz steht nur in lib/titelbild.ts, das Titelbild nur in titelbild.tsx.
 *  - Seit Nr. 97 (Register N13, Ergänzung): Die Wahl des Hofs sticht die Regel
 *    (FUELLEN füllt auch ein Quadrat, GANZ zeigt auch 3:2 ganz, AUTO und ohne
 *    Wahl die Regel); der Satz in Mein Hof steht nur ohne Wahl. Füllende Lage
 *    und Kopie tragen den Ausschnitt (Fokus, Zoom, Filter), die Kopie den
 *    Weichzeichner und den Filter in EINER Angabe, die ganze Lage nur den Filter.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

type Ladeereignis = { currentTarget: { naturalWidth: number; naturalHeight: number } }

// Der Prüfstand für das, was nur der Browser auslöst (TESTING_GUIDELINES §1,
// „Einen Hook samt Effekten prüfen“, Vorbild tests/use-cart.test.ts): useState
// hat eine Zelle je Aufrufstelle, gezählt in der Reihenfolge des Renderns, und
// setzt mit einem Wert oder einem Updater. `beimLaden` ist der onLoad, den das
// Titelbild dem Bild gegeben hat.
const buehne = vi.hoisted(() => {
  type Setzer<T> = (wert: T | ((vorher: T) => T)) => void
  let zellen: unknown[] = []
  let zeiger = 0
  return {
    beimLaden: null as null | ((ereignis: Ladeereignis) => void),
    /** Alle Zellen leer, wie ein frisch eingehängtes Titelbild. */
    leere(): void {
      zellen = []
      zeiger = 0
    },
    /** Vor jedem Rendern: Die Aufrufstellen zählen wieder von vorn, die Zellen behalten ihren Wert. */
    beginneRender(): void {
      zeiger = 0
    },
    useState<T>(anfang: T | (() => T)): [T, Setzer<T>] {
      const i = zeiger++
      if (!(i in zellen)) {
        const neu: { wert: T; setze: Setzer<T> } = {
          wert: typeof anfang === 'function' ? (anfang as () => T)() : anfang,
          setze: (wert) => {
            neu.wert = typeof wert === 'function' ? (wert as (vorher: T) => T)(neu.wert) : wert
          },
        }
        zellen[i] = neu
      }
      const zelle = zellen[i] as { wert: T; setze: Setzer<T> }
      return [zelle.wert, zelle.setze]
    },
  }
})

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: buehne.useState,
}))

// Next gibt es im Test nicht: Das Bild wird zu einem schlichten <img>, das
// Quelle, Alt-Text, sizes, Klassen und aria-hidden behält und anzeigt, ob es
// onLoad und priority trägt.
vi.mock('next/image', () => ({
  default: (p: {
    src: string
    alt: string
    sizes?: string
    className?: string
    style?: Record<string, string>
    priority?: boolean
    'aria-hidden'?: boolean | 'true' | 'false'
    onLoad?: (ereignis: Ladeereignis) => void
  }) => {
    if (p.onLoad) buehne.beimLaden = p.onLoad
    return createElement('img', {
      src: p.src,
      alt: p.alt,
      sizes: p.sizes,
      className: p.className,
      style: p.style,
      'aria-hidden': p['aria-hidden'],
      'data-liest-masse': typeof p.onLoad === 'function' ? 'ja' : undefined,
      'data-vorrang': p.priority ? 'ja' : undefined,
    })
  },
}))

import { Titelbild, TitelbildBilder } from '@/components/hofseite/titelbild'
import {
  TITELBILD_BREITE_MAX,
  TITELBILD_SIZES,
  leseBildmasse,
  titelbildAusschnitt,
  titelbildDarstellung,
  titelbildHinweis,
} from '@/lib/titelbild'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'

/** Ein Ausschnitt mit allem: Fokus, Zoom und Filter (Warm). */
const AUSSCHNITT: BildAusschnitt = { fokusX: 30, fokusY: 64, zoom: 115, filter: 'WARM' }

const QUER = { breite: 3000, hoehe: 2000 }
const QUADRAT = { breite: 1000, hoehe: 1000 }
const HOCH = { breite: 3000, hoehe: 4000 }

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')
const bilder = (html: string) => html.match(/<img\b[^>]*>/g) ?? []
/** Der erste öffnende Tag, der `merkmal` enthält. */
const tag = (html: string, merkmal: RegExp) => new RegExp(`<[a-z]+\\b[^>]*${merkmal.source}[^>]*>`).exec(html)?.[0] ?? ''
const klassen = (oeffnenderTag: string) => (/class="([^"]*)"/.exec(oeffnenderTag)?.[1] ?? '').split(/\s+/).filter(Boolean)
/** Das div, das mit `oeffnenderTag` beginnt, samt Inhalt bis zu seinem schließenden Tag. */
function findeDivMitInhalt(html: string, oeffnenderTag: string): string {
  const anfang = html.indexOf(oeffnenderTag)
  const tags = /<div\b|<\/div>/g
  tags.lastIndex = anfang
  let tiefe = 0
  for (let t = tags.exec(html); anfang >= 0 && t; t = tags.exec(html)) {
    tiefe += t[0] === '</div>' ? -1 : 1
    if (tiefe === 0) return html.slice(anfang, t.index + t[0].length)
  }
  return ''
}

// Die Lagen im Titelbild, von hinten nach vorn: Kopie (div) mit ihrem Bild, Kasten, füllende und ganze Lage.
/** Die Lage der unscharfen Kopie: der Behälter (div), den Screenreader überspringen. */
const kopie = (html: string) => /<div\b[^>]*aria-hidden="true"[^>]*>/.exec(html)?.[0] ?? ''
/** Der Kasten, in dem das scharfe Foto steht. */
const kasten = (html: string) => tag(html, /max-w-\[\d+px\]/)
const findeBildMit = (html: string, passt: (k: string[]) => boolean) => bilder(html).find((b) => passt(klassen(b))) ?? ''
/** Weichgezeichnet ist ein Bild mit `blur(` in seinem Inline-Filter (seit Nr. 97 dort, zusammen mit dem Filter des Ausschnitts). */
const weich = (bild: string) => /filter:\s*blur\(/.test(bild)
const kopieBild = (html: string) => bilder(html).find(weich) ?? ''
/** Das scharfe Foto, das die Fläche füllt (object-cover) — am Handy das einzige. */
const fuellend = (html: string) => bilder(html).find((b) => klassen(b).includes('object-cover') && !weich(b)) ?? ''
/** Das scharfe Foto, das ganz steht (object-contain) — erst ab 768 px. */
const ganzBild = (html: string) => findeBildMit(html, (k) => k.includes('object-contain'))

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

  // Der Spielraum der Rundung ist ein Pixel in der Breite: Ein Pixel unter 3:2 gilt noch als 3:2, zwei darunter nicht mehr.
  it('kippt bei 1,5 abzüglich der Rundung: 1498 × 1000 steht ganz, ab 1499 × 1000 füllt es die Fläche', () => {
    expect(titelbildDarstellung({ breite: 1498, hoehe: 1000 })).toBe('ganz')
    expect(titelbildDarstellung({ breite: 1499, hoehe: 1000 })).toBe('beschnitt')
    expect(titelbildDarstellung({ breite: 1500, hoehe: 1000 })).toBe('beschnitt')
    expect(titelbildDarstellung({ breite: 1501, hoehe: 1000 })).toBe('beschnitt')
  })

  // Gemessen wird, was der Browser für die gelieferte Größe meldet, nicht das Original: sharp rundet die Höhe auf ganze Pixel.
  it.each([
    ['3:2 in 640 px Breite (1800 × 1200 verkleinert, 1,4988) bleibt beim Beschnitt', { breite: 640, hoehe: 427 }, 'beschnitt'],
    ['3:2 in 256 px Breite (1,4971) bleibt beim Beschnitt', { breite: 256, hoehe: 171 }, 'beschnitt'],
    ['3:2 in Originalgröße (1800 × 1200) bleibt beim Beschnitt', { breite: 1800, hoehe: 1200 }, 'beschnitt'],
    [
      'einen Pixel unter 3:2 in Originalgröße (1499 × 1000) bleibt beim Beschnitt — bis 1 080 px Breite verkleinert es sich wie 3:2',
      { breite: 1499, hoehe: 1000 },
      'beschnitt',
    ],
    ['4:3 in 640 px Breite steht ganz — die Rundung verschluckt es nicht', { breite: 640, hoehe: 480 }, 'ganz'],
    ['Quadrat (1000 × 1000) steht ganz', { breite: 1000, hoehe: 1000 }, 'ganz'],
    ['4:3 in 1 080 px Breite steht ganz', { breite: 1080, hoehe: 810 }, 'ganz'],
  ] as const)('rechnet mit der gelieferten Größe: %s', (_name, masse, erwartet) => {
    expect(titelbildDarstellung(masse)).toBe(erwartet)
  })

  // In Chrome gemessen (Nr. 89, Runde 2): Zum Foto 1800 × 1200, genau 3:2, wählt der Browser einen Eintrag der srcset (828 bis 3 840 px),
  // teilt die gelieferte Größe durch die Dichte (Eintrag ÷ Platz) und rundet ab. Ein glattes Ergebnis fällt dabei an einzelnen
  // Fensterbreiten um einen Pixel zu klein aus, nur in der Breite: 777 × 518 wird 776 × 518. Mit ½ px Spielraum stand das ganz.
  it.each([
    ['Fenster 777 px, Dichte 1: 776 × 518 statt 777 × 518', { breite: 776, hoehe: 518 }],
    ['Fenster 894 px, Dichte 1: 893 × 596 statt 894 × 596', { breite: 893, hoehe: 596 }],
    ['Fenster 1 648 px, Dichte 1: 1544 × 1030 statt 1545 × 1030', { breite: 1544, hoehe: 1030 }],
    ['Fenster 880 px, Dichte 1,25: 824 × 550 statt 825 × 550', { breite: 824, hoehe: 550 }],
    ['Fenster 1 888 px, Dichte 2: 884 × 590 statt 885 × 590', { breite: 884, hoehe: 590 }],
  ] as const)('ein 3:2-Foto bleibt beim Beschnitt, wenn die Dichteteilung ihm einen Pixel Breite nimmt: %s', (_name, masse) => {
    expect(titelbildDarstellung(masse)).toBe('beschnitt')
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

  it('schweigt bei einem 3:2-Foto auch in der Größe, die die Vorschau in Mein Hof lädt (640 × 427)', () => {
    expect(titelbildHinweis({ breite: 640, hoehe: 427 })).toBeNull()
  })
})

describe('TitelbildBilder', () => {
  const DARSTELLUNGEN = ['beschnitt', 'ganz'] as const
  const zeige = (darstellung: 'beschnitt' | 'ganz') =>
    renderToStaticMarkup(createElement(TitelbildBilder, { foto: '/foto.jpg', ausschnitt: AUSSCHNITT, darstellung, beimLaden: () => {} }))

  it.each(DARSTELLUNGEN)('%s: drei Bilder desselben Fotos — die Kopie und das scharfe Foto in zwei Lagen, füllend und ganz', (darstellung) => {
    const html = zeige(darstellung)
    expect(bilder(html)).toHaveLength(3)
    // Jede Lage ist genau ein Bild, und es sind drei verschiedene.
    const lagen = [kopieBild(html), fuellend(html), ganzBild(html)]
    expect(lagen.every((lage) => lage !== '')).toBe(true)
    expect(new Set(lagen).size).toBe(3)
    for (const lage of lagen) expect(lage).toContain('src="/foto.jpg"')
  })

  it.each(DARSTELLUNGEN)('%s: nur die füllende Lage liest die Maße und lädt vorrangig — die anderen beiden nicht', (darstellung) => {
    const html = zeige(darstellung)
    expect(fuellend(html)).toContain('data-liest-masse="ja"')
    expect(fuellend(html)).toContain('data-vorrang="ja"')
    for (const lage of [kopieBild(html), ganzBild(html)]) {
      expect(lage).not.toContain('data-liest-masse')
      expect(lage).not.toContain('data-vorrang')
    }
  })

  it.each(DARSTELLUNGEN)('%s: leerer Alt-Text, die Überschrift nennt den Hof', (darstellung) => {
    for (const bild of bilder(zeige(darstellung))) expect(bild).toContain('alt=""')
  })

  it.each(DARSTELLUNGEN)('%s: Screenreader hören das Foto höchstens einmal — die Kopie samt Bild und die ganze Lage sind verborgen, die füllende nicht', (darstellung) => {
    const html = zeige(darstellung)
    // Die Kopie ist der Behälter mit aria-hidden, ihr Bild liegt darin — und nichts vom scharfen Foto.
    expect(kopie(html)).not.toBe('')
    expect(html.indexOf(kopie(html))).toBeLessThan(html.indexOf(kopieBild(html)))
    const behaelter = findeDivMitInhalt(html, kopie(html))
    expect(behaelter).toContain(kopieBild(html))
    expect(behaelter).not.toContain(fuellend(html))
    expect(behaelter).not.toContain(ganzBild(html))
    // Die ganze Lage ist dasselbe Foto noch einmal und für Screenreader nicht da; die füllende bleibt die eine, die sie sehen.
    expect(ganzBild(html)).toContain('aria-hidden="true"')
    expect(fuellend(html)).not.toContain('aria-hidden')
  })

  it.each(DARSTELLUNGEN)('%s: von hinten nach vorn die Kopie, der Kasten, darin die füllende und davor die ganze Lage', (darstellung) => {
    const html = zeige(darstellung)
    const lagen = [kopie(html), kopieBild(html), kasten(html), fuellend(html), ganzBild(html)]
    expect(lagen.every((lage) => lage !== '')).toBe(true)
    const stellen = lagen.map((lage) => html.indexOf(lage))
    expect(stellen).toEqual([...stellen].sort((a, b) => a - b))
    expect(new Set(stellen).size).toBe(lagen.length)
  })

  it('der Kasten ist zentriert, so hoch wie der Rahmen und höchstens 1 920 px breit', () => {
    expect(klassen(kasten(zeige('ganz')))).toEqual(expect.arrayContaining(['relative', 'mx-auto', 'h-full', `max-w-[${TITELBILD_BREITE_MAX}px]`]))
  })

  it('der Kasten schneidet ab: Ein gezoomtes Foto ragt über 1 920 px nicht seitlich in die weiche Kopie (Nr. 97, Runde 1)', () => {
    // Zoom 115 % am Rand (fokusX 0): Das scharfe Foto wird um seinen linken Rand auf 115 % vergrößert und stünde
    // ohne Beschnitt im Kasten bis zu 288 px rechts über die 1 920 px hinaus — mitten in der weichen Kopie.
    const html = renderToStaticMarkup(
      createElement(TitelbildBilder, { foto: '/foto.jpg', ausschnitt: { ...AUSSCHNITT, fokusX: 0, zoom: 115 }, darstellung: 'beschnitt', beimLaden: () => {} }),
    )
    expect(fuellend(html)).toContain('transform:scale(1.15)')
    expect(klassen(kasten(html))).toContain('overflow-hidden')
  })

  it('Kasten, Kopie-Grenze und sizes rechnen mit derselben Breite — der Browser lädt höchstens so viel', () => {
    const html = zeige('beschnitt')
    expect(/max-w-\[(\d+)px\]/.exec(kasten(html))?.[1]).toBe(String(TITELBILD_BREITE_MAX))
    expect(/min-\[(\d+)px\]:opacity-100/.exec(kopie(html))?.[1]).toBe(String(TITELBILD_BREITE_MAX))
    expect(TITELBILD_SIZES).toBe('(min-width: 1920px) 1920px, 100vw')
    // Gleiches sizes an allen drei Bildern: Der Browser holt dieselbe Datei nur einmal.
    for (const bild of bilder(html)) expect(bild).toContain(`sizes="${TITELBILD_SIZES}"`)
  })

  it('ganz: Kopie und ganze Lage sind ab 768 px sichtbar, die füllende ist dort aus — am Handy bleibt sie stehen', () => {
    const html = zeige('ganz')
    const k = klassen(kopie(html))
    expect(k).toEqual(expect.arrayContaining(['hidden', 'md:block', 'opacity-100']))
    expect(k).not.toContain('opacity-0')
    const ganz = klassen(ganzBild(html))
    // `hidden` bis 768 px: Dort gibt es die Lage nicht, also auch keinen Abruf.
    expect(ganz).toEqual(expect.arrayContaining(['hidden', 'md:block', 'opacity-100']))
    expect(ganz).not.toContain('opacity-0')
    const fuellende = klassen(fuellend(html))
    expect(fuellende).toContain('md:opacity-0')
    // Ohne Vorsatz würde sie auch am Handy verschwinden.
    expect(fuellende).not.toContain('opacity-0')
    expect(fuellende).not.toContain('md:object-contain')
  })

  it('beschnitt: nur die füllende Lage ist da; Kopie und ganze Lage warten unsichtbar, die Kopie ist nur über 1 920 px sichtbar — dort füllt sie die Ränder', () => {
    const html = zeige('beschnitt')
    const k = klassen(kopie(html))
    expect(k).toEqual(expect.arrayContaining(['opacity-0', `min-[${TITELBILD_BREITE_MAX}px]:opacity-100`]))
    expect(k).not.toContain('opacity-100')
    const ganz = klassen(ganzBild(html))
    expect(ganz).toContain('opacity-0')
    expect(ganz).not.toContain('opacity-100')
    const fuellende = klassen(fuellend(html))
    expect(fuellende).not.toContain('md:opacity-0')
    expect(fuellende).not.toContain('opacity-0')
  })

  it.each(DARSTELLUNGEN)('%s: Kopie, füllende und ganze Lage blenden über, statt zu springen — gleich lang, bei „weniger Bewegung“ ohne Übergang', (darstellung) => {
    const html = zeige(darstellung)
    for (const lage of [kopie(html), fuellend(html), ganzBild(html)]) {
      expect(klassen(lage)).toEqual(expect.arrayContaining(['transition-opacity', 'duration-500', 'motion-reduce:transition-none']))
    }
  })

  it.each(DARSTELLUNGEN)('%s: die Kopie ist weichgezeichnet und füllt, das scharfe Foto nie weichgezeichnet', (darstellung) => {
    const html = zeige(darstellung)
    expect(weich(kopieBild(html))).toBe(true)
    expect(klassen(kopieBild(html))).toContain('object-cover')
    expect(weich(fuellend(html))).toBe(false)
    expect(weich(ganzBild(html))).toBe(false)
  })

  it.each(DARSTELLUNGEN)('%s: füllende Lage und Kopie tragen den Ausschnitt — Fokus, Zoom um den Fokus und Filter', (darstellung) => {
    const html = zeige(darstellung)
    for (const lage of [fuellend(html), kopieBild(html)]) {
      expect(lage).toContain('object-position:30% 64%')
      expect(lage).toContain('transform:scale(1.15)')
      expect(lage).toContain('transform-origin:30% 64%')
    }
    expect(fuellend(html)).toContain('filter:sepia(0.22) saturate(1.2)')
  })

  it('die Kopie hat Weichzeichner UND Filter in EINER Angabe — eine Klasse blur-… daneben wäre wirkungslos', () => {
    const k = kopieBild(zeige('ganz'))
    expect(k.match(/filter:/g)).toHaveLength(1)
    expect(k).toContain('filter:blur(28px) sepia(0.22) saturate(1.2)')
    expect(klassen(k).some((c) => c.startsWith('blur-'))).toBe(false)
  })

  it('die ganze Lage trägt nur den Filter — ohne Fokus und Zoom steht sie mittig in voller Höhe', () => {
    const ganz = ganzBild(zeige('ganz'))
    expect(ganz).toContain('filter:sepia(0.22) saturate(1.2)')
    expect(ganz).not.toContain('object-position')
    expect(ganz).not.toContain('transform')
  })

  it('Natürlich setzt keinen Filter — am scharfen Foto nichts, an der Kopie nur der Weichzeichner', () => {
    const html = renderToStaticMarkup(
      createElement(TitelbildBilder, { foto: '/foto.jpg', ausschnitt: { ...AUSSCHNITT, filter: 'NATUERLICH' }, darstellung: 'ganz', beimLaden: () => {} })
    )
    expect(fuellend(html)).not.toContain('filter')
    expect(ganzBild(html)).not.toContain('style=')
    expect(kopieBild(html)).toContain('filter:blur(28px)"')
  })
})

describe('Wahl des Hofs: füllen oder ganz (Register N13, Ergänzung, Nr. 97)', () => {
  it.each([
    ['FUELLEN füllt auch ein Quadrat', QUADRAT, 'FUELLEN', 'beschnitt'],
    ['FUELLEN füllt auch ein Hochformat', HOCH, 'FUELLEN', 'beschnitt'],
    ['GANZ zeigt auch 3:2 ganz', QUER, 'GANZ', 'ganz'],
    ['GANZ zeigt ganz, auch bevor die Maße bekannt sind', null, 'GANZ', 'ganz'],
    ['AUTO nimmt die Regel: Quadrat ganz', QUADRAT, 'AUTO', 'ganz'],
    ['AUTO nimmt die Regel: 3:2 füllt', QUER, 'AUTO', 'beschnitt'],
    ['ohne Wahl die Regel: Quadrat ganz', QUADRAT, undefined, 'ganz'],
  ] as const)('%s', (_name, masse, wahl, erwartet) => {
    expect(titelbildDarstellung(masse, wahl)).toBe(erwartet)
  })

  it('der Satz in Mein Hof steht nur ohne eigene Wahl', () => {
    expect(titelbildHinweis(QUADRAT, 'AUTO')).toContain('zeigen wir es ganz')
    expect(titelbildHinweis(QUADRAT, undefined)).toContain('zeigen wir es ganz')
    expect(titelbildHinweis(QUADRAT, 'FUELLEN')).toBeNull()
    expect(titelbildHinweis(QUADRAT, 'GANZ')).toBeNull()
  })

  it('ohne gespeicherten Ausschnitt gilt der Stand von vorher: Mitte, bannerFocusY, 100 %, Natürlich, ohne Wahl', () => {
    expect(titelbildAusschnitt(null, 30)).toEqual({ fokusX: 50, fokusY: 30, zoom: 100, filter: 'NATUERLICH' })
    expect(titelbildAusschnitt(AUSSCHNITT, 30)).toBe(AUSSCHNITT)
  })
})

describe('Titelbild', () => {
  beforeEach(() => {
    buehne.leere()
    buehne.beimLaden = null
  })

  const zeige = (foto: string | null, ausschnitt: BildAusschnitt = titelbildAusschnitt(null, 50)) => {
    buehne.beginneRender()
    return renderToStaticMarkup(
      createElement(Titelbild, { foto, verlauf: 'linear-gradient(1deg, red, blue)', ausschnitt }, createElement('button', null, 'Teilen'))
    )
  }
  const rahmen = (html: string) => tag(html, /data-abschnitt="titelbild"/)
  /** Der Browser meldet die Maße des geladenen Bilds an onLoad; danach rendert React neu. */
  const lade = (breite: number, hoehe: number) => {
    buehne.beimLaden?.({ currentTarget: { naturalWidth: breite, naturalHeight: hoehe } })
    return zeige('/foto.jpg')
  }

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
    expect(klassen(fuellend(html))).not.toContain('md:opacity-0')
    // Die ganze Lage und die Kopie warten unsichtbar, bis der Browser die Maße kennt.
    expect(klassen(ganzBild(html))).toContain('opacity-0')
    expect(klassen(kopie(html))).toContain('opacity-0')
  })

  it('nach dem Laden eines Quadrats blenden Kopie und ganze Lage ein, die füllende aus', () => {
    zeige('/foto.jpg')
    expect(buehne.beimLaden).not.toBeNull()
    const html = lade(1000, 1000)
    expect(klassen(kopie(html))).toContain('opacity-100')
    expect(klassen(ganzBild(html))).toContain('opacity-100')
    expect(klassen(ganzBild(html))).not.toContain('opacity-0')
    expect(klassen(fuellend(html))).toContain('md:opacity-0')
    // Alle drei tragen den Übergang schon vor dem Wechsel — sonst ginge die Lage ohne Überblenden an.
    for (const lage of [kopie(html), fuellend(html), ganzBild(html)]) expect(klassen(lage)).toContain('transition-opacity')
  })

  it('ein 3:2-Foto bleibt nach dem Laden beim Beschnitt — auch in der gelieferten Größe 640 × 427', () => {
    zeige('/foto.jpg')
    const html = lade(640, 427)
    expect(klassen(fuellend(html))).not.toContain('md:opacity-0')
    expect(klassen(ganzBild(html))).toContain('opacity-0')
    expect(klassen(kopie(html))).toContain('opacity-0')
  })

  it('„Ganz zeigen“ zeigt ein 3:2-Foto nach dem Laden ganz, „Ausschnitt füllen“ lässt ein Quadrat füllen', () => {
    zeige('/foto.jpg', { ...AUSSCHNITT, darstellung: 'GANZ' })
    buehne.beimLaden?.({ currentTarget: { naturalWidth: 640, naturalHeight: 427 } })
    const ganz = zeige('/foto.jpg', { ...AUSSCHNITT, darstellung: 'GANZ' })
    expect(klassen(ganzBild(ganz))).toContain('opacity-100')
    expect(klassen(fuellend(ganz))).toContain('md:opacity-0')

    buehne.beimLaden?.({ currentTarget: { naturalWidth: 1000, naturalHeight: 1000 } })
    const fuellen = zeige('/foto.jpg', { ...AUSSCHNITT, darstellung: 'FUELLEN' })
    expect(klassen(fuellend(fuellen))).not.toContain('md:opacity-0')
    expect(klassen(ganzBild(fuellen))).toContain('opacity-0')
    // Gegenprobe: ohne Wahl stünde dasselbe Quadrat ganz.
    expect(klassen(fuellend(zeige('/foto.jpg')))).toContain('md:opacity-0')
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
