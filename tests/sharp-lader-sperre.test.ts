/**
 * Die Lader-Sperre wirkt im echten sharp (Schicht c, Sicherheitsupdate 20.10.2026).
 *
 * sperreFremdeLader sperrt alle Lader von libvips und gibt nur JPEG, PNG, WebP
 * und HEIF frei. Hier mit dem echten nativen Modul: Die erlaubten Formate lassen
 * sich weiter lesen, SVG, GIF und TIFF nicht — auch wenn sie die Byte-Prüfung
 * (Schicht b) einmal überstehen sollten. Ein AVIF liest der HEIF-Lader: Das
 * belegt, dass sein Name stimmt (unblock wirft bei einem Tippfehler nicht);
 * AVIF hält die Byte-Prüfung ab, nicht die Sperre.
 *
 * Die Sperre gilt für den ganzen Prozess. Die Testbilder entstehen deshalb VOR
 * der Sperre (Kodieren braucht keinen Lader), und am Ende wird sie wieder
 * aufgehoben.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import sharp, { type Sharp } from 'sharp'
import { PIXEL_GRENZE_FEHLER, istPixelGrenzeFehler, sperreFremdeLader } from '@/lib/bild-format'

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>')

// withGainMap gibt es seit sharp 0.35.0, in den Typen von 0.35.5 fehlt es noch.
type MitGainMap = Sharp & { withGainMap(): Sharp }

const bilder = new Map<'jpeg' | 'png' | 'webp' | 'gif' | 'tiff' | 'ultrahdr' | 'avif', Buffer>()

function testbild(name: Parameters<typeof bilder.get>[0]): Buffer {
  const b = bilder.get(name)
  if (!b) throw new Error(`Testbild ${name} fehlt`)
  return b
}

beforeAll(async () => {
  const leer = () => sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 10, g: 120, b: 40 } } })
  bilder.set('jpeg', await leer().jpeg().toBuffer())
  bilder.set('png', await leer().png().toBuffer())
  bilder.set('webp', await leer().webp().toBuffer())
  bilder.set('gif', await leer().gif().toBuffer())
  bilder.set('tiff', await leer().tiff().toBuffer())
  bilder.set('avif', await leer().avif().toBuffer())
  // Ein JPEG mit Gain Map (UltraHDR), wie es neuere Handys schreiben: libvips
  // nähme dafür sonst einen eigenen Lader, der nach der Sperre gesperrt bleibt.
  // libvips verlangt dafür mindestens 8 × 8 Pixel.
  const hdr = sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 120, b: 40 } } }) as MitGainMap
  bilder.set('ultrahdr', await hdr.withGainMap().jpeg().toBuffer())
  // Gegenprobe: Das Testbild trägt wirklich eine Gain Map, das einfache JPEG nicht.
  expect((await sharp(testbild('ultrahdr')).metadata()).gainMap).toBeDefined()
  expect((await sharp(testbild('jpeg')).metadata()).gainMap).toBeUndefined()
  // Gegenprobe vor der Sperre: SVG lässt sich ohne sie lesen.
  expect((await sharp(SVG).metadata()).format).toBe('svg')
  sperreFremdeLader(sharp)
})

afterAll(() => {
  sharp.unblock({ operation: ['VipsForeignLoad'] })
})

describe('nach der Sperre', () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    it(`${format} lässt sich lesen und verkleinern`, async () => {
      const bild = sharp(testbild(format))
      expect((await bild.metadata()).format).toBe(format)
      expect((await bild.resize(2, 2).webp().toBuffer()).length).toBeGreaterThan(0)
    })
  }

  it('der HEIF-Lader ist frei: ein AVIF lässt sich lesen (der Name in SHARP_LADER_ERLAUBT stimmt)', async () => {
    expect((await sharp(testbild('avif')).metadata()).format).toBe('heif')
  })

  it('ein UltraHDR-JPEG vom Handy läuft weiter über den JPEG-Lader', async () => {
    const bild = sharp(testbild('ultrahdr'))
    expect((await bild.metadata()).format).toBe('jpeg')
    expect((await bild.resize(2, 2).webp().toBuffer()).length).toBeGreaterThan(0)
  })

  // Ein gesperrter Lader wird schon beim Erkennen übersprungen: sharp findet
  // keinen Lader. Der Text zählt, damit ein anderer Fehler (etwa ein Fehler
  // beim Lesen des SVG bei NICHT greifender Sperre) nicht als Erfolg gilt.
  for (const format of ['gif', 'tiff'] as const) {
    it(`${format} wird nicht gelesen`, async () => {
      await expect(sharp(testbild(format)).metadata()).rejects.toThrow('unsupported image format')
    })
  }

  it('SVG wird nicht gelesen', async () => {
    await expect(sharp(SVG).metadata()).rejects.toThrow('unsupported image format')
    await expect(sharp(SVG).toBuffer()).rejects.toThrow('unsupported image format')
  })
})

describe('Pixelgrenze am echten sharp', () => {
  it('der Fehlertext ist der, den die Route erkennt — schon beim Lesen des Kopfs', async () => {
    const fehler = await sharp(testbild('jpeg'), { limitInputPixels: 15 }).metadata().catch((e: unknown) => e)
    expect((fehler as Error).message).toBe(PIXEL_GRENZE_FEHLER)
    expect(istPixelGrenzeFehler(fehler)).toBe(true)
    // Der Weg der Hof-Fotos ruft kein metadata(): dort wirft erst das Dekodieren — mit genau demselben Text.
    const beimDekodieren = await sharp(testbild('jpeg'), { limitInputPixels: 15 })
      .rotate()
      .resize({ width: 2, height: 2, fit: 'inside' })
      .webp()
      .toBuffer()
      .catch((e: unknown) => e)
    expect(istPixelGrenzeFehler(beimDekodieren)).toBe(true)
  })

  it('genau an der Grenze geht es noch (4 × 4 = 16 Pixel)', async () => {
    expect((await sharp(testbild('jpeg'), { limitInputPixels: 16 }).metadata()).width).toBe(4)
  })

  it('Gegenprobe: ein Formatfehler ist kein Pixelfehler', async () => {
    const fehler = await sharp(SVG).metadata().catch((e: unknown) => e)
    expect(istPixelGrenzeFehler(fehler)).toBe(false)
    expect(istPixelGrenzeFehler('Input image exceeds pixel limit')).toBe(false)
  })
})
