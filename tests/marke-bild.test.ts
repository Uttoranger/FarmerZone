/**
 * Die Bildmarke als Daten (src/lib/marke-bild.ts, Register M1, Ergänzung
 * 14.10.2026): zwei Fassungen derselben Form, die Grenze 48 px, die Pfade der
 * Quellen und Ziele und die reinen Umformungen des SVG-Texts, aus denen das
 * Skript (`pnpm marke`) und die Satori-Bilder ihre Marke machen.
 *
 * Beweist:
 *  - Ab 48 px die volle Fassung, darunter die kleine (Favicon 16/32, Kopfzeile 32).
 *  - Die Adresse im Browser ist derselbe Pfad wie die Datei unter public/.
 *  - Rundung und Sicherheitszone entstehen außerhalb des SVG: als clipPath bzw.
 *    als verkleinerte Zeichnung auf der randlosen Kachel — das SVG selbst
 *    bleibt, wie die Projektleitung es geliefert hat (eine Zeichnung, eine Quelle).
 *  - Der Lader liest die Datei einmal und gibt denselben Text zurück.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MARKE_FAVICON,
  MARKE_ICON_SVG,
  MARKE_KOPF_PX,
  MARKE_KOPF_RUNDUNG_PROZENT,
  MARKE_MASKIERBAR_ANTEIL,
  MARKE_OG,
  MARKE_RUNDUNG_PROZENT,
  MARKE_SVG,
  MARKE_SVG_KLEIN,
  MARKE_SVG_VOLL,
  MARKE_VOLL_AB_PX,
  MARKE_ZIELE,
  ladeMarkeDataUrl,
  ladeMarkeSvg,
  markeBildUrl,
  markeFassungFuer,
  markeMaskierbarSvg,
  markeMitRundungSvg,
  svgAlsDataUrl,
  svgInGroesse,
} from '@/lib/marke-bild'

const BEISPIEL =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">\n' +
  '<rect width="100" height="100" fill="#111111"/>\n' +
  '<path d="M1,1 L2,2Z" fill="#222222"/>\n' +
  '<path d="M3,3 L4,4Z" fill="#333333" fill-rule="evenodd"/>\n' +
  '</svg>'

describe('zwei Fassungen, eine Grenze', () => {
  it('ab 48 px die volle Fassung, darunter die kleine', () => {
    expect(MARKE_VOLL_AB_PX).toBe(48)
    expect(markeFassungFuer(48)).toBe('voll')
    expect(markeFassungFuer(47)).toBe('klein')
    expect([16, 32].map(markeFassungFuer)).toEqual(['klein', 'klein'])
    expect([180, 192, 512].map(markeFassungFuer)).toEqual(['voll', 'voll', 'voll'])
  })

  it('die Ziele des Skripts folgen der Grenze: Favicon 16/32 klein und 48 voll, alle PNG voll, icon.svg klein', () => {
    expect(MARKE_FAVICON.groessen).toEqual([16, 32, 48])
    expect(MARKE_FAVICON.groessen.map(markeFassungFuer)).toEqual(['klein', 'klein', 'voll'])
    for (const ziel of Object.values(MARKE_ZIELE)) expect(markeFassungFuer(ziel.px), ziel.pfad).toBe(ziel.fassung)
    expect(MARKE_ICON_SVG.fassung).toBe('klein')
    expect(MARKE_RUNDUNG_PROZENT).toBe(22)
    expect(MARKE_MASKIERBAR_ANTEIL).toBe(0.8)
    // Kopfzeile: 32 px, also die kleine Fassung, mit 8 px Rundung = 25 %.
    expect(markeFassungFuer(MARKE_KOPF_PX)).toBe('klein')
    expect((MARKE_KOPF_PX * MARKE_KOPF_RUNDUNG_PROZENT) / 100).toBe(8)
  })
})

describe('Pfade', () => {
  it('Quellen und Ziele liegen im Repo, die Browser-Adresse ist der Pfad unter public/', () => {
    expect(MARKE_SVG).toEqual({ voll: MARKE_SVG_VOLL, klein: MARKE_SVG_KLEIN })
    for (const pfad of [MARKE_SVG_VOLL, MARKE_SVG_KLEIN, MARKE_OG]) expect(readFileSync(join(process.cwd(), pfad)).length, pfad).toBeGreaterThan(0)
    expect(markeBildUrl('klein')).toBe(MARKE_SVG_KLEIN.replace(/^public/, ''))
    expect(markeBildUrl('voll')).toMatch(/^\/marke\/.+\.svg$/)
    // Die Ziele sind die Dateien, die Next über die Dateikonvention und das Manifest ausliefert.
    expect(Object.values(MARKE_ZIELE).map((z) => z.pfad).sort()).toEqual(
      ['public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/icon-maskable-512.png', 'src/app/apple-icon.png'].sort()
    )
    expect(MARKE_FAVICON.pfad).toBe('src/app/favicon.ico')
    expect(MARKE_ICON_SVG.pfad).toBe('src/app/icon.svg')
  })
})

describe('Umformungen des SVG-Texts (rein)', () => {
  it('svgInGroesse setzt nur Breite und Höhe der Wurzel, der Rest bleibt', () => {
    const klein = svgInGroesse(BEISPIEL, 64)
    expect(klein).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="64" height="64">')
    expect(klein.slice(klein.indexOf('>') + 1)).toBe(BEISPIEL.slice(BEISPIEL.indexOf('>') + 1))
  })

  it('markeMitRundungSvg legt die Rundung als clipPath um die ganze Zeichnung — das SVG selbst bleibt eckig', () => {
    const rund = markeMitRundungSvg(BEISPIEL)
    expect(rund).toContain('<clipPath id="kachel"><rect width="100" height="100" rx="22" ry="22"/></clipPath>')
    expect(rund).toMatch(/<g clip-path="url\(#kachel\)">\s*<rect width="100" height="100" fill="#111111"\/>[\s\S]*<path d="M3,3 L4,4Z"[^>]*\/>\s*<\/g>\s*<\/svg>$/)
    // Gegenprobe: ein anderer Anteil, und die Quelle trägt keine Rundung.
    expect(markeMitRundungSvg(BEISPIEL, 50)).toContain('rx="50"')
    expect(BEISPIEL).not.toContain('rx=')
  })

  it('markeMaskierbarSvg lässt die Kachel randlos und verkleinert nur die Zeichnung auf 80 % in der Mitte', () => {
    const maskierbar = markeMaskierbarSvg(BEISPIEL)
    expect(maskierbar).toContain('<rect width="100" height="100" fill="#111111"/>')
    expect(maskierbar).toMatch(/<g transform="translate\(10 10\) scale\(0\.8\)">\s*<path d="M1,1 L2,2Z"[^>]*\/>\s*<path d="M3,3 L4,4Z"[^>]*\/>\s*<\/g>/)
    expect((maskierbar.match(/<rect\b/g) ?? []).length).toBe(1)
    expect((maskierbar.match(/<path\b/g) ?? []).length).toBe(2)
    // Gegenprobe: 50 % sitzt bei 25 Einheiten Rand.
    expect(markeMaskierbarSvg(BEISPIEL, 0.5)).toContain('translate(25 25) scale(0.5)')
  })

  it('svgAlsDataUrl: base64, damit Satori das Bild als <img> zeichnet', () => {
    expect(svgAlsDataUrl('<svg/>')).toBe(`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`)
  })
})

describe('Lader', () => {
  it('liest die Datei aus public/marke und gibt beim zweiten Mal denselben Text', async () => {
    const einmal = await ladeMarkeSvg('voll')
    expect(einmal).toBe(readFileSync(join(process.cwd(), MARKE_SVG_VOLL), 'utf8'))
    expect(einmal).toContain('fill-rule="evenodd"')
    // Einmal gelesen heißt: dasselbe Versprechen, nicht nur derselbe Text.
    expect(ladeMarkeSvg('voll')).toBe(ladeMarkeSvg('voll'))
    expect(await ladeMarkeSvg('voll')).toBe(einmal)
    // Auch bei kaltem Zwischenspeicher: Zwei Aufrufe zugleich lesen einmal (dasselbe Versprechen vor dem ersten await).
    const erstes = ladeMarkeSvg('klein')
    expect(ladeMarkeSvg('klein')).toBe(erstes)
    expect(await erstes).toBe(readFileSync(join(process.cwd(), MARKE_SVG_KLEIN), 'utf8'))
    expect(await ladeMarkeDataUrl('klein')).toBe(svgAlsDataUrl(await ladeMarkeSvg('klein')))
  })

  it('die gelieferten SVG sind, was die Umformungen voraussetzen: viewBox 0 0 100 100, eine Kachel, Pfade mit evenodd', async () => {
    for (const fassung of ['voll', 'klein'] as const) {
      const svg = await ladeMarkeSvg(fassung)
      expect(svg, fassung).toMatch(/^<svg [^>]*viewBox="0 0 100 100"/)
      expect((svg.match(/<rect\b/g) ?? []).length, fassung).toBe(1)
      expect(svg, fassung).toMatch(/<path [^>]*fill-rule="evenodd"/)
      expect(svg, fassung).not.toContain('rx=')
    }
  })
})
