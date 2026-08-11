/**
 * Tests für die Initialen-Ableitung (src/lib/hof-initialen.ts).
 *
 * Sie füllen den Logo-Platz der Hof-Identitätskarte, solange kein Logo
 * hochgeladen ist. Ein Hofname ist keine saubere Vorname-Nachname-Kombination:
 * „Öko-Hof Ötscher", „Müllerhof", „4-Jahreszeiten-Hof" — die Ableitung muss
 * mit allem etwas Vernünftiges anfangen und darf nie mehr als zwei Zeichen
 * liefern, sonst sprengt sie den Kreis.
 */
import { describe, it, expect } from 'vitest'
import { hofInitialen } from '@/lib/hof-initialen'

describe('hofInitialen', () => {
  it('nimmt bei zwei Wörtern beide Anfangsbuchstaben', () => {
    expect(hofInitialen('Hof Müller')).toBe('HM')
    expect(hofInitialen('Biohof Sonnleitner')).toBe('BS')
  })

  it('nimmt bei einem Wort nur den ersten Buchstaben', () => {
    expect(hofInitialen('Müllerhof')).toBe('M')
    expect(hofInitialen('Sonnleitner')).toBe('S')
  })

  it('schreibt Umlaute richtig groß', () => {
    expect(hofInitialen('ötscherhof')).toBe('Ö')
    expect(hofInitialen('änger überacker')).toBe('ÄÜ')
    expect(hofInitialen('Öko-Hof Ötscher')).toBe('ÖH')
  })

  it('trennt auch am Bindestrich — „ÖH" liest sich besser als ein einsames „Ö"', () => {
    expect(hofInitialen('Öko-Hof')).toBe('ÖH')
    expect(hofInitialen('Berg-und-Tal-Hof')).toBe('BU')
  })

  it('nimmt Ziffern mit, statt leer auszugehen', () => {
    expect(hofInitialen('4-Jahreszeiten-Hof')).toBe('4J')
  })

  it('liefert nie mehr als zwei Zeichen', () => {
    for (const name of [
      'Hof Müller',
      'Der große Bauernhof am Berg',
      'Öko-Hof Ötscher Innviertel',
      'ßhof ßacker',
    ]) {
      expect(hofInitialen(name).length).toBeLessThanOrEqual(2)
    }
  })

  it('kommt mit Rand- und Mehrfach-Leerzeichen zurecht', () => {
    expect(hofInitialen('  Hof   Müller  ')).toBe('HM')
    expect(hofInitialen('-Hof-')).toBe('H')
  })

  it('gibt bei leerem Namen einen leeren String zurück, statt zu werfen', () => {
    // Der Hofname ist eine Pflichtspalte — das hier ist das Netz darunter.
    expect(hofInitialen('')).toBe('')
    expect(hofInitialen('   ')).toBe('')
  })

  it('zerschneidet ein Emoji nicht in der Mitte', () => {
    // Kein sinnvoller Hofname, aber ein halbes Ersatzzeichen wäre sichtbarer
    // Müll im Kreis — [...wort][0] statt wort[0] verhindert das.
    expect([...hofInitialen('🌱hof')].length).toBe(1)
  })
})
