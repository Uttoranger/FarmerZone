/**
 * Tests für das Sammelergebnis der Foto-Serie (src/lib/upload-batch.ts).
 *
 * Beweist: Ein- und Mehrzahl stimmen, übersprungene Fotos werden mit Namen und
 * Grund genannt, und lange Listen werden gekürzt, damit die Meldung auf dem
 * Telefon lesbar bleibt.
 */
import { describe, it, expect } from 'vitest'
import { summarizeUploadBatch } from '@/lib/upload-batch'

describe('summarizeUploadBatch', () => {
  it('nennt nur die Anzahl, wenn alles durchgelaufen ist', () => {
    expect(summarizeUploadBatch(5, [])).toBe('5 Fotos hochgeladen')
  })

  it('benutzt die Einzahl bei genau einem Foto', () => {
    expect(summarizeUploadBatch(1, [])).toBe('1 Foto hochgeladen')
  })

  it('nennt übersprungene Fotos mit Namen und Grund', () => {
    expect(
      summarizeUploadBatch(6, [{ name: 'IMG_0042', reason: 'Format nicht unterstützt' }])
    ).toBe('6 Fotos hochgeladen, 1 übersprungen: IMG_0042 — Format nicht unterstützt')
  })

  it('zählt mehrere übersprungene Fotos auf', () => {
    expect(
      summarizeUploadBatch(1, [
        { name: 'a.heic', reason: 'Format nicht unterstützt' },
        { name: 'b.jpg', reason: 'zu groß' },
      ])
    ).toBe('1 Foto hochgeladen, 2 übersprungen: a.heic — Format nicht unterstützt; b.jpg — zu groß')
  })

  it('kürzt lange Listen nach drei Namen', () => {
    const skips = ['a', 'b', 'c', 'd', 'e'].map((n) => ({ name: n, reason: 'Format nicht unterstützt' }))
    const text = summarizeUploadBatch(0, skips)
    expect(text).toContain('0 Fotos hochgeladen, 5 übersprungen:')
    expect(text).toContain('und 2 weitere')
    expect(text).not.toContain('d —')
  })

  it('kommt auch ohne einen einzigen Erfolg mit einer klaren Meldung zurück', () => {
    expect(summarizeUploadBatch(0, [{ name: 'foto.heic', reason: 'Format nicht unterstützt' }])).toBe(
      '0 Fotos hochgeladen, 1 übersprungen: foto.heic — Format nicht unterstützt'
    )
  })
})
