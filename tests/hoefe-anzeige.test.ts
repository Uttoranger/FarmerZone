/**
 * Tests für die reine Anzeige-Logik der Hofübersicht
 * (src/lib/hoefe-anzeige.ts): die gemeinsame Auswahl-Grammatik, die drei
 * Pin-Zustände samt Stil-Stufen und die Karussell-Snap-Erkennung.
 */
import { describe, it, expect } from 'vitest'
import {
  LEERE_LAGE,
  nachLeerTipp,
  nachPinTipp,
  nachZeiger,
  pinDarstellung,
  pinZustand,
  zentrierterIndex,
} from '@/lib/hoefe-anzeige'

describe('Auswahl-Grammatik', () => {
  it('Pin-Tipp setzt die Auswahl', () => {
    expect(nachPinTipp(LEERE_LAGE, 'hof-a').ausgewaehlt).toBe('hof-a')
  })

  it('Leertipp hebt die Auswahl auf', () => {
    const lage = nachLeerTipp(nachPinTipp(LEERE_LAGE, 'hof-a'))
    expect(lage.ausgewaehlt).toBeNull()
  })

  it('Zeiger-Hervorhebung ändert die Auswahl NICHT — Betreten wie Verlassen', () => {
    const gewaehlt = nachPinTipp(LEERE_LAGE, 'hof-a')
    const mitZeiger = nachZeiger(gewaehlt, 'hof-b')
    expect(mitZeiger.ausgewaehlt).toBe('hof-a')
    expect(mitZeiger.hervorgehoben).toBe('hof-b')
    const ohneZeiger = nachZeiger(mitZeiger, null)
    expect(ohneZeiger.ausgewaehlt).toBe('hof-a')
    expect(ohneZeiger.hervorgehoben).toBeNull()
  })

  it('ein neuer Pin-Tipp lässt eine bestehende Zeiger-Hervorhebung stehen', () => {
    const lage = nachPinTipp(nachZeiger(LEERE_LAGE, 'hof-b'), 'hof-a')
    expect(lage).toEqual({ ausgewaehlt: 'hof-a', hervorgehoben: 'hof-b' })
  })
})

describe('pinZustand', () => {
  it('Auswahl schlägt Zeiger, Zeiger schlägt normal', () => {
    const lage = { ausgewaehlt: 'hof-a', hervorgehoben: 'hof-b' }
    expect(pinZustand('hof-a', lage)).toBe('ausgewaehlt')
    expect(pinZustand('hof-b', lage)).toBe('hervorgehoben')
    expect(pinZustand('hof-c', lage)).toBe('normal')
  })

  it('der gewählte Pin bleibt gewählt, auch wenn der Zeiger über ihm steht', () => {
    expect(pinZustand('hof-a', { ausgewaehlt: 'hof-a', hervorgehoben: 'hof-a' })).toBe('ausgewaehlt')
  })
})

describe('pinDarstellung — drei Stufen, Haus-Stil ohne Orange', () => {
  it('ausgewählt ist am größten und im Hof-Grün gefüllt, Nummer weiß', () => {
    expect(pinDarstellung('ausgewaehlt')).toEqual({
      groesse: 34,
      hintergrund: '#2D5F3F',
      schrift: '#FFFFFF',
      rand: '#FFFFFF',
    })
  })

  it('hervorgehoben ist die Zwischenstufe auf Sandgrün', () => {
    const stil = pinDarstellung('hervorgehoben')
    expect(stil.groesse).toBe(31)
    expect(stil.hintergrund).toBe('#E8F0E2')
    expect(stil.schrift).toBe('#1F4630')
  })

  it('normal ist die weiße Scheibe mit grüner Nummer', () => {
    const stil = pinDarstellung('normal')
    expect(stil.groesse).toBe(28)
    expect(stil.hintergrund).toBe('#FFFFFF')
    expect(stil.schrift).toBe('#2D5F3F')
  })

  it('die Größen steigen streng: normal < hervorgehoben < ausgewählt', () => {
    expect(pinDarstellung('normal').groesse).toBeLessThan(pinDarstellung('hervorgehoben').groesse)
    expect(pinDarstellung('hervorgehoben').groesse).toBeLessThan(
      pinDarstellung('ausgewaehlt').groesse
    )
  })
})

describe('zentrierterIndex — die Karussell-Snap-Erkennung', () => {
  const SCHRITT = 272 // 260 Kartenbreite + 12 Abstand

  it('Anfang: Scrollposition 0 ist die erste Karte', () => {
    expect(zentrierterIndex(0, SCHRITT, 5)).toBe(0)
  })

  it('Mitte: die nächstgelegene Karte gewinnt, auch zwischen zwei Rastpunkten', () => {
    expect(zentrierterIndex(2 * SCHRITT, SCHRITT, 5)).toBe(2)
    expect(zentrierterIndex(2 * SCHRITT + 100, SCHRITT, 5)).toBe(2)
    expect(zentrierterIndex(2 * SCHRITT + 200, SCHRITT, 5)).toBe(3)
  })

  it('Ende: hinter der letzten Karte wird auf sie geklemmt', () => {
    expect(zentrierterIndex(99 * SCHRITT, SCHRITT, 5)).toBe(4)
    expect(zentrierterIndex(-50, SCHRITT, 5)).toBe(0)
  })

  it('leere Liste und Unsinn-Schritt fallen ruhig auf 0', () => {
    expect(zentrierterIndex(100, SCHRITT, 0)).toBe(0)
    expect(zentrierterIndex(100, 0, 5)).toBe(0)
  })
})
