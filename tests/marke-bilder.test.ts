/**
 * Die erzeugten Icon-Dateien der Marke (scripts/marke.ts, `pnpm marke`;
 * Register M1, Ergänzung 14.10.2026) — nach dem Muster von
 * tests/bausteine-verzeichnis.test.ts: Der Test erzeugt die Dateien im
 * Speicher aus den zwei SVG und vergleicht sie mit dem Repo. Ein Pixelvergleich
 * mit kleiner Toleranz statt Byte für Byte, weil ein anderer Rasterer (eine
 * neue sharp-Version) an Kanten um eine Stufe abweichen darf, ohne dass die
 * Marke eine andere wäre; auf derselben Maschine sind zwei Läufe gleich.
 *
 * Beweist dazu:
 *  - Maße und Formen: 192/512 gerundet (Ecke durchsichtig), Apple 180 randlos,
 *    maskierbar 512 mit der Kachel bis zum Rand und der Zeichnung in der
 *    inneren 80-%-Zone, Favicon als ICO mit PNG 16/32/48, icon.svg geclippt.
 *  - Die Farben kommen aus den SVG, nicht aus dem Skript.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { MARKE_FAVICON, MARKE_ICON_SVG, MARKE_MASKIERBAR_ANTEIL, MARKE_ZIELE, ladeMarkeSvg, markeMitRundungSvg } from '@/lib/marke-bild'
import { erzeugeMarkeDateien, leseIco, schreibeIco, type MarkeDatei } from '../scripts/marke'

const WURZEL = process.cwd()

type Raster = { breite: number; hoehe: number; daten: Buffer }

async function raster(png: Buffer): Promise<Raster> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { breite: info.width, hoehe: info.height, daten: data }
}

/** Größte und mittlere Abweichung je Kanal zwischen zwei gleich großen Rastern. */
function abweichung(a: Raster, b: Raster): { max: number; mittel: number } {
  expect(a.breite).toBe(b.breite)
  expect(a.hoehe).toBe(b.hoehe)
  let max = 0
  let summe = 0
  for (let i = 0; i < a.daten.length; i++) {
    const d = Math.abs(a.daten[i] - b.daten[i])
    if (d > max) max = d
    summe += d
  }
  return { max, mittel: summe / a.daten.length }
}

function pixel(r: Raster, x: number, y: number): [number, number, number, number] {
  const i = (y * r.breite + x) * 4
  return [r.daten[i], r.daten[i + 1], r.daten[i + 2], r.daten[i + 3]]
}

/** Die Kachelfarbe aus dem SVG — der Test schreibt keinen Farbwert selbst. */
async function kachelFarbe(): Promise<[number, number, number]> {
  const svg = await ladeMarkeSvg('voll')
  const hex = svg.match(/<rect\b[^>]*fill="#([0-9A-Fa-f]{6})"/)?.[1] ?? ''
  expect(hex).toHaveLength(6)
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

const nahe = (a: readonly number[], b: readonly number[], toleranz = 2): boolean => a.every((wert, i) => Math.abs(wert - b[i]) <= toleranz)

describe('pnpm marke erzeugt keinen Diff', () => {
  let dateien: MarkeDatei[]
  beforeAll(async () => {
    dateien = await erzeugeMarkeDateien()
  }, 30_000)

  it('jede Zieldatei liegt im Repo und entspricht dem frischen Lauf — Pixel für Pixel innerhalb der Toleranz', async () => {
    expect(dateien.map((d) => d.pfad)).toEqual(
      [...Object.values(MARKE_ZIELE).map((z) => z.pfad), MARKE_FAVICON.pfad, MARKE_ICON_SVG.pfad].sort((a, b) => a.localeCompare(b))
    )
    for (const { pfad, inhalt } of dateien) {
      const ziel = join(WURZEL, pfad)
      expect(existsSync(ziel), `${pfad} fehlt – pnpm marke ausführen`).toBe(true)
      const vorhanden = readFileSync(ziel)
      if (vorhanden.equals(inhalt)) continue
      const paare: [Buffer, Buffer][] = pfad.endsWith('.ico')
        ? leseIco(vorhanden).map((e, i) => [e.png, leseIco(inhalt)[i].png])
        : pfad.endsWith('.svg')
          ? []
          : [[vorhanden, inhalt]]
      if (pfad.endsWith('.svg')) expect(vorhanden.toString('utf8'), `${pfad} veraltet – pnpm marke ausführen`).toBe(inhalt.toString('utf8'))
      for (const [alt, neu] of paare) {
        const { max, mittel } = abweichung(await raster(alt), await raster(neu))
        expect(max, `${pfad} weicht ab – pnpm marke ausführen`).toBeLessThanOrEqual(8)
        expect(mittel, `${pfad} weicht ab – pnpm marke ausführen`).toBeLessThan(0.2)
      }
    }
  }, 30_000)

  it('zwei Läufe auf derselben Maschine ergeben dieselben Bytes', async () => {
    const zweiter = await erzeugeMarkeDateien()
    for (const [i, datei] of dateien.entries()) expect(zweiter[i].inhalt.equals(datei.inhalt), datei.pfad).toBe(true)
  }, 30_000)

  it('Maße und Formen: gerundet, randlos, maskierbar mit 80-%-Zone', async () => {
    const kachel = await kachelFarbe()
    const bild = async (pfad: string) => raster(dateien.find((d) => d.pfad === pfad)?.inhalt ?? Buffer.alloc(0))
    for (const schluessel of ['icon192', 'icon512'] as const) {
      const r = await bild(MARKE_ZIELE[schluessel].pfad)
      expect(r.breite).toBe(MARKE_ZIELE[schluessel].px)
      expect(pixel(r, 0, 0)[3], 'Ecke durchsichtig (Rundung)').toBe(0)
      expect(pixel(r, r.breite / 2, 2)[3], 'Rand oben in der Mitte deckend').toBe(255)
    }
    const apple = await bild(MARKE_ZIELE.apple180.pfad)
    expect(apple.breite).toBe(180)
    expect(pixel(apple, 0, 0)[3], 'Apple randlos, iOS rundet selbst').toBe(255)
    expect(nahe(pixel(apple, 0, 0).slice(0, 3), kachel)).toBe(true)

    const m = await bild(MARKE_ZIELE.maskierbar512.pfad)
    expect(m.breite).toBe(512)
    // Die Sicherheitszone maskierbarer Icons ist ein Kreis mit 80 % der Kante als Durchmesser (Radius 40 %):
    // Außerhalb des Kreises darf nur die Kachel liegen — Android beschneidet bis dorthin.
    const radius = (512 * MARKE_MASKIERBAR_ANTEIL) / 2
    let aussen = 0
    let innenAnders = 0
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const p = pixel(m, x, y)
        const istKachel = p[3] === 255 && nahe(p.slice(0, 3), kachel)
        const draussen = Math.hypot(x + 0.5 - 256, y + 0.5 - 256) > radius
        if (draussen && !istKachel) aussen++
        if (!draussen && !istKachel) innenAnders++
      }
    }
    expect(aussen, 'außerhalb des 80-%-Kreises nur die Kachel').toBe(0)
    // Gegenprobe: Innen ist die Zeichnung da.
    expect(innenAnders).toBeGreaterThan(5_000)
  })

  it('das Favicon ist ein ICO mit drei PNG-Einträgen 16, 32 und 48, gerundet', async () => {
    const ico = dateien.find((d) => d.pfad === MARKE_FAVICON.pfad)?.inhalt ?? Buffer.alloc(0)
    const eintraege = leseIco(ico)
    expect(eintraege.map((e) => e.px)).toEqual([16, 32, 48])
    for (const e of eintraege) {
      const r = await raster(e.png)
      expect([r.breite, r.hoehe]).toEqual([e.px, e.px])
      expect(pixel(r, 0, 0)[3], `${e.px}: Ecke durchsichtig`).toBe(0)
    }
    // Gegenprobe des Schreibers: Lesen gibt zurück, was geschrieben wurde — auch bei 256 (im Kopf als 0).
    const probe = schreibeIco([{ px: 256, png: eintraege[0].png }, eintraege[1]])
    expect(leseIco(probe).map((e) => [e.px, e.png.equals(eintraege[0].png) || e.png.equals(eintraege[1].png)])).toEqual([
      [256, true],
      [32, true],
    ])
  })

  it('icon.svg ist die kleine Fassung mit der Rundung als clipPath — und das Quell-SVG trägt keine', async () => {
    const svg = (dateien.find((d) => d.pfad === MARKE_ICON_SVG.pfad)?.inhalt ?? Buffer.alloc(0)).toString('utf8')
    expect(svg).toBe(`${markeMitRundungSvg(await ladeMarkeSvg('klein'))}\n`)
    expect(svg).toContain('clip-path="url(#kachel)"')
    expect(await ladeMarkeSvg('klein')).not.toContain('clipPath')
  })
})
