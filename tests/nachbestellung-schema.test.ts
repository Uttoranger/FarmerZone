/**
 * Tests für den Nachbestell-Parameter der Hofseite (src/schemas/nachbestellung.ts).
 *
 * Beweist: Ein Token ist ein nicht leerer Text mit Obergrenze; fehlt es, ist es
 * leer, mehrfach oder überlang, gibt es keins — ohne Fehler. Ob es echt ist,
 * entscheidet danach verifyReorderToken (src/lib/reorder-token.ts) mit der Signatur.
 */
import { describe, it, expect } from 'vitest'
import { nachbestellToken } from '@/schemas/nachbestellung'

describe('nachbestellToken', () => {
  it('nimmt einen Text als Token', () => {
    expect(nachbestellToken('YWJj.ZGVm')).toBe('YWJj.ZGVm')
  })

  it('verwirft, was nicht taugt — ohne Fehler', () => {
    expect(nachbestellToken(undefined)).toBeNull()
    expect(nachbestellToken('')).toBeNull()
    expect(nachbestellToken(['a.b', 'c.d'])).toBeNull()
    expect(nachbestellToken('x'.repeat(513))).toBeNull()
  })
})
