/**
 * Die Kennung einer Kundin in der Adresse der Kundenseite (src/lib/kunden-id.ts).
 * Aussage: stabil je Hof und E-Mail, verschieden je Hof, nicht ohne das
 * Geheimnis nachrechenbar, und alte Adressen mit E-Mail werden erkannt.
 * Das Geheimnis ist hier ein Parameter — kein env, keine Mocks.
 */
import { describe, it, expect } from 'vitest'
import { KUNDE_ID_MUSTER, alteKundenAdresse, kundeIdAus } from '@/lib/kunden-id'

const GEHEIM = 'test-geheimnis-nur-fuer-tests'

describe('kundeIdAus', () => {
  it('gibt für denselben Hof und dieselbe E-Mail dieselbe Kennung', () => {
    const a = kundeIdAus(GEHEIM, 'hof-1', 'kundin@beispiel.at')
    const b = kundeIdAus(GEHEIM, 'hof-1', 'kundin@beispiel.at')
    expect(a).toBe(b)
  })

  it('gruppiert wie die Kundenliste: Groß-/Kleinschreibung und Rand zählen nicht', () => {
    expect(kundeIdAus(GEHEIM, 'hof-1', ' Kundin@Beispiel.AT ')).toBe(kundeIdAus(GEHEIM, 'hof-1', 'kundin@beispiel.at'))
  })

  it('gibt bei einem anderen Hof eine andere Kennung', () => {
    expect(kundeIdAus(GEHEIM, 'hof-1', 'kundin@beispiel.at')).not.toBe(
      kundeIdAus(GEHEIM, 'hof-2', 'kundin@beispiel.at')
    )
  })

  it('gibt bei einer anderen E-Mail eine andere Kennung', () => {
    expect(kundeIdAus(GEHEIM, 'hof-1', 'kundin@beispiel.at')).not.toBe(
      kundeIdAus(GEHEIM, 'hof-1', 'kunde@beispiel.at')
    )
  })

  it('hängt am Geheimnis — ohne es lässt sich die Kennung nicht nachrechnen', () => {
    expect(kundeIdAus(GEHEIM, 'hof-1', 'kundin@beispiel.at')).not.toBe(
      kundeIdAus('anderes-geheimnis', 'hof-1', 'kundin@beispiel.at')
    )
  })

  it('ist kurz, adresstauglich und trägt keinen Teil der E-Mail', () => {
    const id = kundeIdAus(GEHEIM, 'hof-1', 'kundin@beispiel.at')
    expect(id).toMatch(KUNDE_ID_MUSTER)
    expect(encodeURIComponent(id)).toBe(id)
    expect(id).not.toContain('@')
    expect(id.toLowerCase()).not.toContain('kundin')
  })
})

describe('alteKundenAdresse', () => {
  it('erkennt die E-Mail im Pfad, roh und kodiert', () => {
    expect(alteKundenAdresse('kundin@beispiel.at')).toBe('kundin@beispiel.at')
    expect(alteKundenAdresse('kundin%40beispiel.at')).toBe('kundin@beispiel.at')
  })

  it('lässt eine neue Kennung durch', () => {
    expect(alteKundenAdresse(kundeIdAus(GEHEIM, 'hof-1', 'kundin@beispiel.at'))).toBeNull()
  })

  it('wirft nicht bei kaputter Kodierung', () => {
    expect(alteKundenAdresse('%E0%A4%A')).toBeNull()
  })
})
