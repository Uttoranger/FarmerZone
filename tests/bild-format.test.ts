/**
 * Was sharp in der Verarbeitungs-Route sehen darf (src/lib/bild-format.ts).
 *
 * formatFuerSharp entscheidet an den Bytes, bevor sharp sie anfasst: das
 * Format erkennt `bildFormat` (src/lib/foto-wege.ts, eine Erkennung für
 * Browser und Server; ihre Einzelfälle prüft tests/foto-wege.test.ts). Dazu
 * kommt nur auf dem Server die Suche nach AV1: Ein AVIF, dessen Marken auf
 * HEIC umgeschrieben sind, sieht vorne aus wie ein Handyfoto, trägt aber den
 * Kasten `av1C` — ohne ihn dekodiert libheif kein AV1.
 * Die Bytes hier sind erfundene Köpfe, keine echten Bilder.
 */
import { describe, expect, it } from 'vitest'
import { BILD_PIXEL_GRENZE, PIXEL_GRENZE_FEHLER, formatFuerSharp, istPixelGrenzeFehler } from '@/lib/bild-format'

function bytes(...teile: (number[] | string)[]): Uint8Array {
  const liste: number[] = []
  for (const teil of teile) {
    if (typeof teil === 'string') for (const z of teil) liste.push(z.charCodeAt(0))
    else liste.push(...teil)
  }
  return new Uint8Array(liste)
}

const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10], 'JFIF', [0])
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d], 'IHDR')
const WEBP = bytes('RIFF', [0x24, 0, 0, 0], 'WEBP', 'VP8 ')
/** Ein HEIC-Kopf: ftyp-Kasten, dann ein Stück meta mit der HEVC-Konfiguration. */
const HEIC = bytes([0, 0, 0, 0x18], 'ftyp', 'heic', [0, 0, 0, 0], 'mif1', 'heic', [0, 0, 0, 0x10], 'hvcC', [1, 0, 0, 0])
/** Dieselben ersten Bytes, aber mit AV1-Konfiguration: ein AVIF unter HEIC-Marke. */
const AVIF_GETARNT = bytes([0, 0, 0, 0x18], 'ftyp', 'heic', [0, 0, 0, 0], 'mif1', 'miaf', [0, 0, 0, 0x10], 'av1C', [0x81, 0, 0, 0])

describe('formatFuerSharp — erlaubt', () => {
  it('JPEG, PNG, WebP und HEIC', () => {
    expect(formatFuerSharp(JPEG)).toBe('jpeg')
    expect(formatFuerSharp(PNG)).toBe('png')
    expect(formatFuerSharp(WEBP)).toBe('webp')
    expect(formatFuerSharp(HEIC)).toBe('heic')
  })

  it('nimmt ArrayBuffer wie Uint8Array', () => {
    expect(formatFuerSharp(JPEG.slice().buffer)).toBe('jpeg')
  })

  it('ein JPEG, in dessen Daten zufällig „av1C" steht, bleibt ein JPEG — die Suche gilt nur HEIF', () => {
    expect(formatFuerSharp(bytes([0xff, 0xd8, 0xff, 0xe0], 'av1C', [0]))).toBe('jpeg')
  })
})

describe('formatFuerSharp — alles andere fällt durch', () => {
  it('SVG, GIF, TIFF und AVIF mit AVIF-Marke', () => {
    expect(formatFuerSharp(bytes('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>'))).toBeNull()
    expect(formatFuerSharp(bytes('GIF89a', [1, 0, 1, 0, 0, 0, 0]))).toBeNull()
    expect(formatFuerSharp(bytes('II*', [0, 8, 0, 0, 0]))).toBeNull()
    expect(formatFuerSharp(bytes([0, 0, 0, 0x18], 'ftyp', 'avif', [0, 0, 0, 0], 'mif1', 'miaf'))).toBeNull()
  })

  it('AVIF unter HEIC-Marke: der Kasten av1C verrät es, auch weit hinten in der Datei', () => {
    expect(formatFuerSharp(AVIF_GETARNT)).toBeNull()
    const weitHinten = new Uint8Array(4096)
    weitHinten.set(HEIC.subarray(0, 24))
    weitHinten.set(bytes('av1C'), 4000)
    expect(formatFuerSharp(weitHinten)).toBeNull()
    // Gegenprobe: ohne av1C ist es HEIC.
    weitHinten.set(bytes('hvcC'), 4000)
    expect(formatFuerSharp(weitHinten)).toBe('heic')
  })

  it('ein gzip-Kopf mit „ftyp" an Stelle 4 ist kein HEIF', () => {
    expect(formatFuerSharp(bytes([0x1f, 0x8b, 0x08, 0x08], 'ftyp', 'heic', [0, 0, 0, 0], 'mif1'))).toBeNull()
  })

  it('leer oder zu kurz', () => {
    expect(formatFuerSharp(new Uint8Array())).toBeNull()
    expect(formatFuerSharp(bytes([0xff, 0xd8]))).toBeNull()
  })
})

describe('formatFuerSharp — Laufzeit', () => {
  it('ein 25-MB-Original voller „a" hinter einem HEIC-Kopf ist schnell geprüft (die Suche nach av1C ist linear)', () => {
    const gross = new Uint8Array(25 * 1024 * 1024).fill(0x61)
    gross.set(HEIC.subarray(0, 24))
    const beginn = performance.now()
    expect(formatFuerSharp(gross)).toBe('heic')
    // Großzügig: nativ sind es Millisekunden; die frühere Schleife brauchte gut eine Sekunde.
    expect(performance.now() - beginn).toBeLessThan(500)
  })
})

describe('Pixelgrenze', () => {
  it('ist 50 Millionen Pixel', () => {
    expect(BILD_PIXEL_GRENZE).toBe(50_000_000)
  })

  it('erkennt nur den Fehler von sharp für zu viele Pixel', () => {
    expect(istPixelGrenzeFehler(new Error(PIXEL_GRENZE_FEHLER))).toBe(true)
    expect(istPixelGrenzeFehler(new Error('Input buffer contains unsupported image format'))).toBe(false)
    expect(istPixelGrenzeFehler(PIXEL_GRENZE_FEHLER)).toBe(false)
  })
})
