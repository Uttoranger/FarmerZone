/**
 * Tests für stripStatusVariables (Status-Paket E): {Vorname} darf beim
 * Kunden nie roh erscheinen — Token wird entfernt, übrig bleibende
 * Satzzeichen/Leerzeichen werden bereinigt.
 */
import { describe, it, expect } from 'vitest'
import { stripStatusVariables } from '@/lib/status-body'

describe('stripStatusVariables', () => {
  it('Anrede mit Komma: "Hallo {Vorname}, …" → "Hallo, …"', () => {
    expect(stripStatusVariables('Hallo {Vorname}, heute gibt es frische Eier!')).toBe(
      'Hallo, heute gibt es frische Eier!'
    )
  })

  it('Token mehrfach im Text', () => {
    expect(
      stripStatusVariables('Hallo {Vorname}! Schön, dass du da bist, {Vorname}.')
    ).toBe('Hallo! Schön, dass du da bist.')
  })

  it('Token mittendrin ohne Satzzeichen', () => {
    expect(stripStatusVariables('Extra für {Vorname} reserviert')).toBe('Extra für reserviert')
  })

  it('Token am Anfang: kein führendes Komma oder Leerzeichen', () => {
    expect(stripStatusVariables('{Vorname}, schau vorbei!')).toBe('schau vorbei!')
  })

  it('ohne Token: Text bleibt unverändert', () => {
    const text = 'Heute Hofladen bis 17 Uhr geöffnet.'
    expect(stripStatusVariables(text)).toBe(text)
  })

  it('mehrzeiliger Text bleibt mehrzeilig', () => {
    expect(stripStatusVariables('Hallo {Vorname},\nmorgen ist Markt.')).toBe(
      'Hallo,\nmorgen ist Markt.'
    )
  })
})
