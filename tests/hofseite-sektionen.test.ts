import { describe, it, expect } from 'vitest'
import {
  hofseiteSektionen,
  naechsterAktiverReiter,
  type SektionSichtbarkeit,
} from '@/lib/hofseite-sektionen'

const ALLE_SICHTBAR: SektionSichtbarkeit[] = [
  { key: 'status', visible: true },
  { key: 'about', visible: true },
  { key: 'values', visible: true },
  { key: 'gallery', visible: true },
  { key: 'products', visible: true },
]

describe('hofseiteSektionen', () => {
  it('führt die Sektionen in Dokumentreihenfolge auf: Übersicht, Fotos, Produkte', () => {
    const sektionen = hofseiteSektionen(ALLE_SICHTBAR, true)

    expect(sektionen.map((s) => s.id)).toEqual(['uebersicht', 'fotos', 'produkte'])
  })

  it('stellt Fotos vor Produkte — sonst springt der letzte Reiter nach oben', () => {
    const ids = hofseiteSektionen(ALLE_SICHTBAR, true).map((s) => s.id)

    expect(ids.indexOf('fotos')).toBeLessThan(ids.indexOf('produkte'))
  })

  it('lässt Fotos weg, wenn der Hof kein einziges Foto hat', () => {
    const sektionen = hofseiteSektionen(ALLE_SICHTBAR, false)

    expect(sektionen.map((s) => s.id)).toEqual(['uebersicht', 'produkte'])
  })

  it('lässt Fotos weg, wenn die Galerie ausgeblendet ist — auch mit Fotos', () => {
    const ohneGalerie = ALLE_SICHTBAR.map((s) =>
      s.key === 'gallery' ? { ...s, visible: false } : s
    )

    const sektionen = hofseiteSektionen(ohneGalerie, true)

    expect(sektionen.map((s) => s.id)).toEqual(['uebersicht', 'produkte'])
  })

  it('zeigt eine Sektion, deren Schlüssel in der Konfiguration fehlt', () => {
    const sektionen = hofseiteSektionen([{ key: 'products', visible: true }], true)

    expect(sektionen.map((s) => s.id)).toContain('fotos')
  })

  it('behält Übersicht und Produkte auch bei leerer Konfiguration', () => {
    const sektionen = hofseiteSektionen([], false)

    expect(sektionen.map((s) => s.id)).toEqual(['uebersicht', 'produkte'])
  })

  it('beschriftet die Reiter deutsch', () => {
    const sektionen = hofseiteSektionen(ALLE_SICHTBAR, true)

    expect(sektionen.map((s) => s.label)).toEqual(['Übersicht', 'Fotos', 'Produkte'])
  })
})

describe('naechsterAktiverReiter', () => {
  const reihenfolge = ['uebersicht', 'fotos', 'produkte']

  it('hält das Sprungziel fest, solange der angetippte Sprung läuft', () => {
    const aktiv = naechsterAktiverReiter({
      sichtbare: ['uebersicht'],
      reihenfolge,
      bisher: 'uebersicht',
      gesperrtAuf: 'produkte',
    })

    expect(aktiv).toBe('produkte')
  })

  it('lässt den Beobachter wieder entscheiden, sobald die Sperre fällt', () => {
    const aktiv = naechsterAktiverReiter({
      sichtbare: ['uebersicht'],
      reihenfolge,
      bisher: 'produkte',
      gesperrtAuf: null,
    })

    expect(aktiv).toBe('uebersicht')
  })

  it('ignoriert eine Sperre auf einen Abschnitt, den es gar nicht gibt', () => {
    const aktiv = naechsterAktiverReiter({
      sichtbare: ['uebersicht'],
      reihenfolge,
      bisher: 'uebersicht',
      gesperrtAuf: 'fotos-gibt-es-nicht',
    })

    expect(aktiv).toBe('uebersicht')
  })

  it('wählt den untersten sichtbaren Abschnitt, wenn zwei gleichzeitig im Streifen liegen', () => {
    const aktiv = naechsterAktiverReiter({
      sichtbare: ['uebersicht', 'fotos'],
      reihenfolge,
      bisher: 'uebersicht',
    })

    expect(aktiv).toBe('fotos')
  })

  it('entscheidet nach Dokumentreihenfolge, nicht nach Reihenfolge der Meldungen', () => {
    const aktiv = naechsterAktiverReiter({
      sichtbare: ['produkte', 'uebersicht', 'fotos'],
      reihenfolge,
      bisher: 'uebersicht',
    })

    expect(aktiv).toBe('produkte')
  })

  it('behält die Markierung, wenn zwischen zwei Abschnitten keiner im Streifen liegt', () => {
    const aktiv = naechsterAktiverReiter({
      sichtbare: [],
      reihenfolge,
      bisher: 'fotos',
    })

    expect(aktiv).toBe('fotos')
  })

  it('ignoriert gemeldete Abschnitte, die nicht zur Leiste gehören', () => {
    const aktiv = naechsterAktiverReiter({
      sichtbare: ['footer'],
      reihenfolge,
      bisher: 'produkte',
    })

    expect(aktiv).toBe('produkte')
  })

  it('kommt mit einer Seite ohne Fotos zurecht', () => {
    const ohneFotos = ['uebersicht', 'produkte']

    const aktiv = naechsterAktiverReiter({
      sichtbare: ['produkte'],
      reihenfolge: ohneFotos,
      bisher: 'uebersicht',
    })

    expect(aktiv).toBe('produkte')
  })
})
