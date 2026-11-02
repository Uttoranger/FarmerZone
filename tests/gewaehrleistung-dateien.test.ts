/**
 * Die amtliche Gewährleistungs-Mitteilung (Anhang II FAGG, Nr. 211) als Dateien
 * unter public/recht — Wache, die dauerhaft bleibt (Freigabe Lauf 29 §2
 * „Sicherheit“): Ein späterer Austausch der Grafik darf weder fremde Dateien
 * noch Skript oder fremde Verweise einschleppen.
 *
 * Beweist (Dateiarbeit, echtes sharp, kein Netz):
 *  - public/recht enthält GENAU gewaehrleistung-mitteilung-de.svg und
 *    gewaehrleistung-mitteilung-de.png — keine weitere Sprache, keine
 *    Schwarz-Weiß-Fassung, kein .gitkeep, keine __MACOSX-/.DS_Store-Reste;
 *  - die SVG enthält kein <script>, kein <foreignObject>, keinen
 *    Ereignis-Griff (onload=…), kein @import und keinen Verweis nach außen:
 *    href/xlink:href und url(…) zeigen nur auf interne Anker (#…);
 *  - die PNG ist mindestens 1240 px breit, im A4-Verhältnis der SVG
 *    (842/595, Toleranz 1 %) und ohne Alphakanal (weißer Grund);
 *  - die beiden Pfade stehen unter src/ nur in der Quelle
 *    src/lib/rechtstexte/gewaehrleistung-mitteilung.ts, und die Dateien
 *    liegen dort, wohin die Quelle zeigt.
 *  - Gegenprobe je Verstoß: an Schnipseln schlägt die Prüfung an.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import sharp from 'sharp'
import { GEWAEHRLEISTUNG_MITTEILUNG } from '@/lib/rechtstexte/gewaehrleistung-mitteilung'

const WURZEL = process.cwd()
const ORDNER = join(WURZEL, 'public', 'recht')
const SVG = join(WURZEL, 'public', GEWAEHRLEISTUNG_MITTEILUNG.svgPfad)
const PNG = join(WURZEL, 'public', GEWAEHRLEISTUNG_MITTEILUNG.pngPfad)
const A4 = 842 / 595

/** Was in einer amtlichen SVG nichts verloren hat — je Fund ein Wort, leer heißt sauber. */
function svgVerstoesse(svg: string): string[] {
  const funde: string[] = []
  if (/<script\b/i.test(svg)) funde.push('script')
  if (/<foreignObject\b/i.test(svg)) funde.push('foreignObject')
  if (/\son[a-z]+\s*=/i.test(svg)) funde.push('ereignis')
  if (/@import\b/i.test(svg)) funde.push('import')
  // Jeder Verweis (href, xlink:href) zeigt auf einen Anker in derselben Datei — nie http(s), //, data: oder eine Datei daneben.
  for (const t of svg.matchAll(/\b(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi)) {
    if (!t[2]?.trim().startsWith('#')) funde.push(`href:${t[2]}`)
  }
  // Ebenso url(…) in Stilen und Attributen (clip-path: url(#clippath) ist intern).
  for (const t of svg.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    if (!t[2]?.trim().startsWith('#')) funde.push(`url:${t[2]}`)
  }
  return funde
}

function* dateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

describe('public/recht: nur die amtliche Mitteilung, Deutsch, Farbe', () => {
  it('enthält genau die SVG und ihre PNG', () => {
    expect(readdirSync(ORDNER).sort()).toEqual(['gewaehrleistung-mitteilung-de.png', 'gewaehrleistung-mitteilung-de.svg'])
  })

  it('die Quelle zeigt auf genau diese beiden Dateien', () => {
    expect(GEWAEHRLEISTUNG_MITTEILUNG.svgPfad).toBe('/recht/gewaehrleistung-mitteilung-de.svg')
    expect(GEWAEHRLEISTUNG_MITTEILUNG.pngPfad).toBe('/recht/gewaehrleistung-mitteilung-de.png')
    expect(statSync(SVG).isFile()).toBe(true)
    expect(statSync(PNG).isFile()).toBe(true)
  })
})

describe('SVG ohne Skript und ohne Verweis nach außen', () => {
  it('die abgelegte SVG ist sauber', () => {
    const svg = readFileSync(SVG, 'utf8')
    expect(svg).toMatch(/<svg\b/)
    // Gegenprobe gegen eine leere Suche: Die Datei hat interne Verweise, die durchgehen.
    expect(svg).toMatch(/url\(#clippath/)
    expect(svgVerstoesse(svg)).toEqual([])
  })

  it('Gegenprobe: jeder Verstoß schlägt an, interne Anker nicht', () => {
    expect(svgVerstoesse('<svg><script>alert(1)</script></svg>')).toEqual(['script'])
    expect(svgVerstoesse('<svg><foreignObject><div/></foreignObject></svg>')).toEqual(['foreignObject'])
    expect(svgVerstoesse('<svg onload="x()"></svg>')).toEqual(['ereignis'])
    expect(svgVerstoesse('<style>@import "a.css";</style>')).toEqual(['import'])
    expect(svgVerstoesse('<use xlink:href="https://example.com/a.svg#x"/>')).toEqual(['href:https://example.com/a.svg#x'])
    expect(svgVerstoesse('<a href="//example.com">x</a>')).toEqual(['href://example.com'])
    expect(svgVerstoesse("<image href='data:image/png;base64,AAAA'/>")).toEqual(['href:data:image/png;base64,AAAA'])
    expect(svgVerstoesse('<rect style="fill: url(http://example.com/f.svg#g)"/>')).toEqual(['url:http://example.com/f.svg#g'])
    expect(svgVerstoesse('<use xlink:href="#a"/><rect style="clip-path: url(#b)" clip-path="url(\'#c\')"/>')).toEqual([])
  })
})

describe('PNG für die Mails', () => {
  it('mindestens 1240 px breit, A4-Verhältnis der SVG (Toleranz 1 %), ohne Alphakanal', async () => {
    const m = await sharp(PNG).metadata()
    expect(m.format).toBe('png')
    expect(m.width).toBeGreaterThanOrEqual(GEWAEHRLEISTUNG_MITTEILUNG.pngBreite)
    const verhaeltnis = (m.height ?? 0) / (m.width ?? 1)
    expect(Math.abs(verhaeltnis - A4) / A4).toBeLessThanOrEqual(0.01)
    // Weißer Grund statt Durchsicht: Ein Mailprogramm im dunklen Modus zeigte sonst schwarze Schrift auf Schwarz.
    expect(m.hasAlpha).toBe(false)
  })

  it('dasselbe Verhältnis wie die SVG selbst (gemessen, nicht nur die Konstante)', async () => {
    const svg = await sharp(SVG).metadata()
    expect(Math.abs((svg.height ?? 0) / (svg.width ?? 1) - A4) / A4).toBeLessThanOrEqual(0.01)
    expect(GEWAEHRLEISTUNG_MITTEILUNG.hoehe / GEWAEHRLEISTUNG_MITTEILUNG.breite).toBeCloseTo(A4, 5)
  })
})

describe('eine Quelle: die Pfade stehen unter src/ nur in gewaehrleistung-mitteilung.ts', () => {
  const PFAD = /recht\/gewaehrleistung-mitteilung-de\.(?:svg|png)/

  // Liest jede Datei unter src/ — unter Last länger als 5 s, deshalb ein eigenes Limit.
  it('keine zweite Stelle schreibt den Pfad (kein Bild-Baustein, kein next/image daneben)', () => {
    const stellen = [...dateien(join(WURZEL, 'src'))]
      .filter((pfad) => PFAD.test(readFileSync(pfad, 'utf8')))
      .map((pfad) => relative(WURZEL, pfad).split(sep).join('/'))
    expect(stellen).toEqual(['src/lib/rechtstexte/gewaehrleistung-mitteilung.ts'])
  }, 30_000)

  it('Gegenprobe: das Muster trifft beide Pfade', () => {
    expect(PFAD.test("src: '/recht/gewaehrleistung-mitteilung-de.svg'")).toBe(true)
    expect(PFAD.test('https://example.com/recht/gewaehrleistung-mitteilung-de.png')).toBe(true)
    expect(PFAD.test('/recht/gewaehrleistung-mitteilung-en.svg')).toBe(false)
  })
})
