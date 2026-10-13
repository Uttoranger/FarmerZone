/**
 * Tests für die Illustrationen unter public/categories/ (Register I1, Nr. 74).
 *
 * Beweist:
 *  - Jede Unterkategorie hat genau eines von beidem: einen Dateinamen in
 *    UNTERKATEGORIE_BILD_SLUG oder einen Platz in OHNE_EIGENE_ILLUSTRATION —
 *    und zu jedem Eintrag liegen die Farb- und die Schwarzweiß-Datei.
 *  - Das Prüfskript (scripts/illustrationen.ts, `pnpm illustrationen`) lässt ein
 *    gültiges Bild durch und meldet falsche Maße, falsches Format, zu große
 *    Dateien und einen Rand, der nicht einfarbig ist; Ausgabe und Exitcode
 *    stehen fest. Die echten 114 Dateien prüft die CI mit dem Skript selbst.
 *
 * Die Beispielbilder entstehen verlustfrei in einem temporären Ordner: Bei
 * verlustbehaftetem WebP wichen Pixelwerte um ein, zwei Stufen ab, und die
 * Grenze „±6“ ließe sich nicht auf die Stufe genau prüfen.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  OHNE_EIGENE_ILLUSTRATION,
  PRODUCT_CATEGORY_VALUES,
  PRODUCT_SUBCATEGORY_VALUES,
  UNTERKATEGORIE_BILD_SLUG,
  ZUGEORDNETE_UNTERKATEGORIEN,
  illustrationPfad,
  kategorieVon,
  unterkategorienVon,
} from '@/lib/taxonomie'
import { erwarteteIllustrationen, fuehreAus, pruefeBild } from '../scripts/illustrationen'

const ALS_SCHWARZWEISS = (pfad: string) => pfad.replace('/categories/', '/categories/sw/')

describe('Zuordnung der Illustrationen zu den Unterkategorien', () => {
  const mitBild: readonly string[] = Object.keys(UNTERKATEGORIE_BILD_SLUG)
  const ausnahmen: readonly string[] = OHNE_EIGENE_ILLUSTRATION

  it('jede Unterkategorie hat ein Bild ODER steht in der Ausnahmeliste — nie beides, nie keins', () => {
    // Über ALLE Werte des Enums, nicht nur die zugeordneten (Nr. 75): Eine neue L2 ohne Bild und ohne Ausnahme fiele sonst durch.
    for (const l2 of PRODUCT_SUBCATEGORY_VALUES) {
      expect(mitBild.includes(l2) !== ausnahmen.includes(l2), l2).toBe(true)
    }
  })

  it('beide Listen kennen nur Unterkategorien, die es gibt', () => {
    const alle: readonly string[] = ZUGEORDNETE_UNTERKATEGORIEN
    for (const l2 of [...mitBild, ...ausnahmen]) expect(alle.includes(l2), l2).toBe(true)
  })

  it('ein Dateiname kommt in einem Kategorie-Ordner nur einmal vor', () => {
    const slugs: Record<string, string> = UNTERKATEGORIE_BILD_SLUG
    for (const l1 of PRODUCT_CATEGORY_VALUES) {
      const namen = unterkategorienVon(l1).filter((l2) => mitBild.includes(l2)).map((l2) => slugs[l2])
      expect(new Set(namen).size, l1).toBe(namen.length)
    }
  })

  it('zu jedem Eintrag liegen die Farbdatei und die Schwarzweiß-Datei — und zu jeder Kategorie', () => {
    const erwartet = erwarteteIllustrationen()
    expect(erwartet.length).toBeGreaterThan(0)
    for (const { pfad } of erwartet) {
      expect(existsSync(join(process.cwd(), 'public', pfad)), pfad).toBe(true)
    }
  })

  it('die Prüfliste des Skripts: Kategorien und Unterkategorien mit Bild, je Farbe und Schwarzweiß, keine Ausnahme', () => {
    const erwartet = erwarteteIllustrationen()
    const farbe = erwartet.filter((e) => e.fassung === 'farbe').map((e) => e.pfad)
    const sw = erwartet.filter((e) => e.fassung === 'sw').map((e) => e.pfad)
    expect(new Set(erwartet.map((e) => e.pfad)).size).toBe(erwartet.length)
    expect(sw).toEqual(farbe.map(ALS_SCHWARZWEISS))
    expect(farbe).toContain('/categories/heu-stroh/wiesenheu.webp')
    // Die Futter-Altlast teilt sich die Datei mit „Sonstiges“: sie steht einmal da.
    expect(farbe.filter((p) => p === '/categories/sonstiges.webp')).toHaveLength(1)
    // Ausnahmen: keine eigene Datei unter ihrer Kategorie.
    expect(farbe.filter((p) => p.startsWith('/categories/eier/') || p.startsWith('/categories/sonstiges/'))).toEqual([])
    // Jede Unterkategorie mit Bild steht drin.
    for (const l2 of ZUGEORDNETE_UNTERKATEGORIEN.filter((l) => mitBild.includes(l))) {
      expect(farbe, l2).toContain(illustrationPfad(kategorieVon(l2), l2))
    }
  })
})

describe('Prüfskript (pnpm illustrationen)', () => {
  const CREME = '#F3EFE3'
  const WEISS = '#FFFFFF'
  const dunkel = (breite: number, hoehe: number) =>
    sharp({ create: { width: breite, height: hoehe, channels: 3, background: '#335533' } }).png().toBuffer()

  /**
   * Ein Bild: Grund, dunkle Fläche in der Mitte, auf Wunsch eine dunkle Zeile
   * zwischen den Seitenrändern (Pixel 8 bis 1015) — so berührt sie den Rand nur,
   * wenn ihre Zeile selbst in den äußeren 8 Pixeln liegt.
   */
  async function bild(optionen: { grund?: string; kante?: number; streifenZeile?: number } = {}): Promise<Buffer> {
    const kante = optionen.kante ?? 1024
    const mitte = Math.floor(kante / 3)
    const lagen = [{ input: await dunkel(mitte, mitte), left: mitte, top: mitte }]
    if (optionen.streifenZeile !== undefined) lagen.push({ input: await dunkel(kante - 16, 1), left: 8, top: optionen.streifenZeile })
    return sharp({ create: { width: kante, height: kante, channels: 3, background: optionen.grund ?? CREME } })
      .composite(lagen)
      .webp({ lossless: true })
      .toBuffer()
  }

  /** Rauschen lässt sich nicht kleinrechnen: eine Datei weit über 80 KB. */
  function rauschen(): Buffer {
    const bytes = Buffer.alloc(1024 * 1024 * 3)
    let zustand = 2463534242
    for (let i = 0; i < bytes.length; i++) {
      zustand = (zustand ^ (zustand << 13)) >>> 0
      zustand = (zustand ^ (zustand >>> 17)) >>> 0
      zustand = (zustand ^ (zustand << 5)) >>> 0
      bytes[i] = zustand & 255
    }
    return bytes
  }

  describe('pruefeBild', () => {
    it('lässt ein gültiges Bild durch — in Farbe mit Creme-Rand, in Schwarzweiß mit weißem Rand', async () => {
      expect(await pruefeBild(await bild(), 'farbe')).toEqual([])
      expect(await pruefeBild(await bild({ grund: WEISS }), 'sw')).toEqual([])
    })

    it('falsche Maße: sagt, welche', async () => {
      expect(await pruefeBild(await bild({ kante: 512 }), 'farbe')).toEqual(['512×512 Pixel statt 1024×1024'])
    })

    it('kein WebP: sagt das Format', async () => {
      const png = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: CREME } }).png().toBuffer()
      expect(await pruefeBild(png, 'farbe')).toEqual(['Format png statt WebP'])
    })

    it('über 80 KB: sagt die Größe', async () => {
      const gross = await sharp(rauschen(), { raw: { width: 1024, height: 1024, channels: 3 } })
        .webp({ lossless: true, effort: 0 })
        .toBuffer()
      expect(await pruefeBild(gross, 'farbe')).toEqual(expect.arrayContaining([expect.stringMatching(/^\d+ KB, erlaubt sind höchstens 80 KB$/)]))
    })

    it('Kopf lesbar, Pixel nicht (Datei beschädigt): ein Grund statt eines Abbruchs ohne FEHLER-Zeile (Nr. 75)', async () => {
      const muster = Buffer.alloc(1024 * 1024 * 3)
      for (let i = 0; i < muster.length; i++) muster[i] = (i * 7919) % 251
      const gut = await sharp(muster, { raw: { width: 1024, height: 1024, channels: 3 } }).webp({ quality: 50 }).toBuffer()
      // Auf ein Zehntel gekürzt (unter 80 KB), die Längen im RIFF-Kopf passend gemacht: Maße und Format lesen sich, die Pixel nicht.
      const kaputt = Buffer.from(gut.subarray(0, Math.floor(gut.length / 10) & ~1))
      kaputt.writeUInt32LE(kaputt.length - 8, 4)
      kaputt.writeUInt32LE(kaputt.length - 20, 16)
      expect(await pruefeBild(kaputt, 'farbe')).toEqual(['Pixel nicht lesbar (Datei beschädigt)'])
    })

    it('keine Bilddatei: sagt das', async () => {
      expect(await pruefeBild(Buffer.from('<html>kein Bild</html>'), 'farbe')).toEqual(['keine lesbare Bilddatei'])
    })

    it('der Rand zählt bis 8 Pixel: eine dunkle Zeile bei Zeile 7 fällt auf, bei Zeile 8 nicht', async () => {
      expect(await pruefeBild(await bild({ streifenZeile: 7 }), 'farbe')).toEqual([expect.stringContaining('Rand nicht einfarbig Creme #F3EFE3')])
      expect(await pruefeBild(await bild({ streifenZeile: 8 }), 'farbe')).toEqual([])
    })

    it('Creme gilt auf 6 Stufen genau, 7 nicht', async () => {
      expect(await pruefeBild(await bild({ grund: '#F9EFE3' }), 'farbe')).toEqual([])
      expect(await pruefeBild(await bild({ grund: '#FAEFE3' }), 'farbe')).toEqual([expect.stringContaining('Abweichung bis 7')])
    })

    it('jede Fassung hat ihren Rand: Weiß besteht bei Farbe nicht, Creme bei Schwarzweiß nicht', async () => {
      expect(await pruefeBild(await bild({ grund: WEISS }), 'farbe')).toEqual([expect.stringContaining('Creme #F3EFE3')])
      expect(await pruefeBild(await bild({ grund: CREME }), 'sw')).toEqual([expect.stringContaining('Weiß')])
    })
  })

  describe('fuehreAus — an zwei Beispieldateien in einem temporären Ordner', () => {
    let wurzel = ''
    const schreibe = (pfad: string, bytes: Buffer) => {
      const datei = join(wurzel, 'public', pfad)
      mkdirSync(dirname(datei), { recursive: true })
      writeFileSync(datei, bytes)
    }

    beforeAll(async () => {
      wurzel = mkdtempSync(join(tmpdir(), 'illustrationen-'))
      schreibe('categories/gut.webp', await bild())
      schreibe('categories/sw/gut.webp', await bild({ grund: WEISS }))
      schreibe('categories/sw/falsch.webp', await bild({ kante: 512, grund: WEISS }))
    })
    afterAll(() => rmSync(wurzel, { recursive: true, force: true }))

    it('gültige Dateien: eine Zeile, Exit 0', async () => {
      const lauf = await fuehreAus(wurzel, [
        { pfad: '/categories/gut.webp', fassung: 'farbe' },
        { pfad: '/categories/sw/gut.webp', fassung: 'sw' },
      ])
      expect(lauf).toEqual({ zeilen: ['Illustrationen: 2 Dateien geprüft (1 Farbe, 1 Schwarzweiß), alle in Ordnung.'], exitCode: 0 })
    })

    it('falsche Maße und eine fehlende Datei: je eine Zeile mit Pfad und Grund, Exit 1 — und immer dieselbe Ausgabe', async () => {
      const erwartet = [
        { pfad: '/categories/gut.webp', fassung: 'farbe' },
        { pfad: '/categories/sw/falsch.webp', fassung: 'sw' },
        { pfad: '/categories/fehlt.webp', fassung: 'farbe' },
      ] as const
      const lauf = await fuehreAus(wurzel, erwartet)
      expect(lauf).toEqual({
        zeilen: [
          'FEHLER public/categories/sw/falsch.webp: 512×512 Pixel statt 1024×1024',
          'FEHLER public/categories/fehlt.webp: fehlt',
          'Illustrationen: 3 Dateien geprüft (2 Farbe, 1 Schwarzweiß), 2 mit Verstoß.',
        ],
        exitCode: 1,
      })
      expect(await fuehreAus(wurzel, erwartet)).toEqual(lauf)
    })
  })
})
