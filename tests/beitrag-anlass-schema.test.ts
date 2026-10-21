/**
 * `?anlass=` für „Neuer Beitrag“ (Register E12, Nr. 129; Schema seit Nr. 134 in
 * src/schemas/beitrag-anlass.ts): Die Adresse ist Fremddaten — nur ein Anlass aus der
 * Liste kommt an, alles andere wird still zu `null`. Die Seite selbst prüft
 * tests/status-new-anlass.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { anlassParameterSchema } from '@/schemas/beitrag-anlass'
import { BEITRAG_ANLAESSE } from '@/lib/beitrag-anlass'

describe('anlassParameterSchema', () => {
  it.each([...BEITRAG_ANLAESSE])('lässt den Anlass %s durch', (anlass) => {
    expect(anlassParameterSchema.parse(anlass)).toBe(anlass)
  })

  it.each([['WERBUNG'], ['new_season'], [''], [['NEW_SEASON', 'PROMOTION']], [42], [undefined]])(
    'Gegenprobe: %j wird zu null, ohne Fehler',
    (roh) => {
      expect(anlassParameterSchema.parse(roh)).toBeNull()
    }
  )

  it('null bleibt null (kein Parameter)', () => {
    expect(anlassParameterSchema.parse(null)).toBeNull()
  })
})
