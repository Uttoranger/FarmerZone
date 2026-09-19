/**
 * geheimnisGleich (src/lib/geheimnis.ts): Vergleich in konstanter Zeit für
 * Bearer-Token. Geprüft wird das Verhalten — gleich, ungleich, ungleich lang,
 * Nicht-ASCII —, nicht die Laufzeit selbst (die ist Sache von timingSafeEqual).
 */
import { describe, it, expect } from 'vitest'
import { geheimnisGleich } from '@/lib/geheimnis'

describe('geheimnisGleich', () => {
  it('erkennt gleiche Zeichenketten', () => {
    expect(geheimnisGleich('Bearer abc123', 'Bearer abc123')).toBe(true)
  })

  it('lehnt ungleiche Zeichenketten gleicher Länge ab', () => {
    expect(geheimnisGleich('Bearer abc123', 'Bearer abc124')).toBe(false)
    expect(geheimnisGleich('Bearer abc123', 'bearer abc123')).toBe(false)
  })

  it('lehnt ungleich lange Zeichenketten ab, ohne zu werfen', () => {
    expect(geheimnisGleich('Bearer abc', 'Bearer abc123')).toBe(false)
    expect(geheimnisGleich('', 'Bearer abc123')).toBe(false)
    expect(geheimnisGleich('Bearer abc123', '')).toBe(false)
  })

  it('vergleicht Byte für Byte, auch bei Umlauten', () => {
    expect(geheimnisGleich('Bearer straße', 'Bearer straße')).toBe(true)
    expect(geheimnisGleich('Bearer straße', 'Bearer strasse')).toBe(false)
  })
})
