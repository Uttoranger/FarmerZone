/**
 * Tests für die Farbraum-Umrechnung (src/lib/farbraum.ts).
 *
 * Beweist: Hex ↔ OKLCH stimmt an bekannten Punkten (Weiß, Schwarz, reines
 * Rot), der Hin- und Rückweg trifft jeden Kanal wieder, und die Leser
 * verstehen die Schreibweisen aus globals.css und der Token-Tabelle.
 */
import { describe, it, expect } from 'vitest'
import { hexAbstand, hexZuOklch, kontrast, leseHex, leseOklch, oklchZuHex } from '@/lib/farbraum'

describe('bekannte Punkte', () => {
  it('Weiß und Schwarz liegen bei L = 1 und L = 0 ohne Buntheit', () => {
    const weiss = hexZuOklch('#FFFFFF')
    expect(weiss.l).toBeCloseTo(1, 3)
    expect(weiss.c).toBeCloseTo(0, 3)
    const schwarz = hexZuOklch('#000000')
    expect(schwarz.l).toBeCloseTo(0, 3)
    expect(schwarz.c).toBeCloseTo(0, 3)
  })

  it('reines Rot: L ≈ 0,628, C ≈ 0,258, H ≈ 29°', () => {
    const rot = hexZuOklch('#FF0000')
    expect(rot.l).toBeCloseTo(0.628, 2)
    expect(rot.c).toBeCloseTo(0.258, 2)
    expect(rot.h).toBeCloseTo(29.2, 0)
  })
})

describe('Hin- und Rückweg', () => {
  it('trifft die Tokenwerte des Design-Systems Kanal für Kanal', () => {
    for (const hex of ['#0B100C', '#F4F1E7', '#2E6B45', '#E07A4A', '#231208', '#9C4D20', '#9FD0AF', '#5D6A5C']) {
      expect(oklchZuHex(hexZuOklch(hex)), hex).toBe(hex)
    }
  })

  it('verträgt gerundete Werte, wie sie in globals.css stehen', () => {
    // Vier Stellen für L und C, eine für den Winkel — so schreibt die Datei.
    const { l, c, h } = hexZuOklch('#E07A4A')
    const gerundet = { l: Number(l.toFixed(4)), c: Number(c.toFixed(4)), h: Number(h.toFixed(1)) }
    expect(hexAbstand(oklchZuHex(gerundet), '#E07A4A')).toBeLessThanOrEqual(1)
  })
})

describe('Leser', () => {
  it('leseHex normalisiert Kurz- und Langform, lehnt anderes ab', () => {
    expect(leseHex('#abc')).toBe('#AABBCC')
    expect(leseHex('e07a4a')).toBe('#E07A4A')
    expect(leseHex('oklch(0.5 0.1 40)')).toBeNull()
    expect(leseHex('#12345')).toBeNull()
  })

  it('leseOklch liest die Schreibweise aus globals.css', () => {
    expect(leseOklch('oklch(0.9577 0.0136 93.0)')).toEqual({ l: 0.9577, c: 0.0136, h: 93 })
    expect(leseOklch('oklch(1 0 0 / 0.12)')).toBeNull()
    expect(leseOklch('#FFFFFF')).toBeNull()
  })

  it('hexAbstand misst den größten Kanalabstand', () => {
    expect(hexAbstand('#000000', '#000000')).toBe(0)
    expect(hexAbstand('#000000', '#010203')).toBe(3)
  })
})

describe('Kontrast nach WCAG', () => {
  it('Schwarz auf Weiß ist 21:1, gleiche Farbe 1:1, die Reihenfolge ist egal', () => {
    expect(kontrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(kontrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
    expect(kontrast('#2E6B45', '#2E6B45')).toBe(1)
  })

  it('Grau #767676 auf Weiß liegt knapp über 4,5 — die bekannte Grenze', () => {
    expect(kontrast('#767676', '#FFFFFF')).toBeGreaterThan(4.5)
    expect(kontrast('#777777', '#FFFFFF')).toBeLessThan(4.6)
  })
})
