/**
 * Test für die Auflösungsgrenzen beim Bild-Upload
 * (MAX_LONG_SIDE in src/components/shared/image-upload.tsx).
 *
 * Warum überhaupt ein Test auf eine Zahl: Das Titelbild ist das einzige Bild,
 * das über die volle Bildschirmbreite läuft. Fiele der Wert bei einem späteren
 * Aufräumen zurück auf die 2400 der übrigen Varianten, wäre das Cover wieder
 * unscharf — und zwar lautlos, denn nichts bricht dabei. Der Test hält den
 * Unterschied fest und nennt den Grund.
 *
 * Was hier NICHT geprüft wird: wie groß eine Datei nach dem Verkleinern
 * tatsächlich wird. Das hängt am Canvas-WebP-Encoder des Browsers und ist in
 * Node nicht nachstellbar — gemessen wurde es einmalig in echtem Chromium,
 * das Ergebnis steht im Kommentar über MAX_LONG_SIDE.
 */
import { describe, it, expect } from 'vitest'
import { MAX_LONG_SIDE } from '@/components/shared/image-upload'

describe('MAX_LONG_SIDE', () => {
  it('gibt dem Titelbild 3200px — mehr als allen anderen Varianten', () => {
    expect(MAX_LONG_SIDE.banner).toBe(3200)
  })

  it('lässt die übrigen Varianten unverändert', () => {
    expect(MAX_LONG_SIDE.logo).toBe(800)
    expect(MAX_LONG_SIDE.product).toBe(2400)
    expect(MAX_LONG_SIDE.gallery).toBe(2400)
    expect(MAX_LONG_SIDE.status).toBe(2400)
  })

  it('hält das Titelbild über allen anderen Bildvarianten', () => {
    const andere = Object.entries(MAX_LONG_SIDE)
      .filter(([variante]) => variante !== 'banner')
      .map(([, wert]) => wert)

    expect(Math.max(...andere)).toBeLessThan(MAX_LONG_SIDE.banner)
  })
})
