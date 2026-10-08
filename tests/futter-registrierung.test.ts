/**
 * Sperre je Gebinde (Gate 6, Nachtlauf Nr. 20; Register E9, E10; S7) —
 * src/lib/futter-registrierung.ts, rein und ohne Mock.
 *
 * Beweist die Matrix Verpackung × Status × Kategorie: lose Ernte braucht die
 * LFBIS-Nummer, abgepacktes Heimtierfutter, Mischfutter und Ergänzungsfutter
 * die BAES-Meldung (Registriert/Zugelassen). Bestandsprodukte ohne Verpackung
 * und alles außer Futter sperrt die Regel nie. Dazu die Stände der sieben
 * Fälle (nie ein Haken ohne Angabe) und die Sätze des Formulars.
 */
import { describe, it, expect } from 'vitest'
import {
  BAES_KATEGORIEN,
  HAUPT_FAELLE,
  REGISTRIERUNGS_FAELLE,
  SPERR_GRUND,
  fallStand,
  fallZeile,
  gebindeSperre,
  hatRegistrierung,
  istGebindeGesperrt,
  noetigeRegistrierung,
  nummerOhneKuerzel,
  registrierungsSaetze,
  speichernHinweis,
  type HofRegistrierung,
} from '@/lib/futter-registrierung'
import { BETRIEBSSTATUS_VALUES, type BetriebsstatusValue } from '@/lib/taxonomie'

const OHNE: HofRegistrierung = { betriebsnummer: null, betriebsstatus: null }
const LFBIS: HofRegistrierung = { betriebsnummer: 'AT 1234567', betriebsstatus: 'PRIMAERPRODUKTION' }
const BAES: HofRegistrierung = { betriebsnummer: 'AT 1234567', betriebsstatus: 'REGISTRIERT' }
const ALPHA: HofRegistrierung = { betriebsnummer: 'α AT 99999', betriebsstatus: 'ZUGELASSEN' }

describe('noetigeRegistrierung — was ein Gebinde braucht (E10)', () => {
  it('Ballen und lose Ware aus Heu oder Getreide brauchen die LFBIS-Nummer', () => {
    expect(noetigeRegistrierung({ category: 'HEU_STROH', verpackung: 'LOSE_BALLEN' })).toBe('LFBIS')
    expect(noetigeRegistrierung({ category: 'GETREIDE_KOERNER', verpackung: 'LOSE_BALLEN' })).toBe('LFBIS')
  })

  it('abgepacktes Heimtierfutter mit Etikett braucht die BAES-Meldung', () => {
    expect(noetigeRegistrierung({ category: 'HEU_STROH', verpackung: 'ABGEPACKT_ETIKETT' })).toBe('BAES')
  })

  it.each(BAES_KATEGORIEN)('%s (Mischen oder Zukauf) braucht immer die BAES-Meldung — auch lose', (category) => {
    expect(noetigeRegistrierung({ category, verpackung: 'LOSE_BALLEN' })).toBe('BAES')
    expect(noetigeRegistrierung({ category, verpackung: 'ABGEPACKT_ETIKETT' })).toBe('BAES')
  })

  it('ein Bestandsprodukt ohne Verpackung braucht nichts — die Regel sperrt nur, was das Formular angelegt hat', () => {
    expect(noetigeRegistrierung({ category: 'HEU_STROH', verpackung: null })).toBeNull()
    expect(noetigeRegistrierung({ category: 'MISCHFUTTER', verpackung: null })).toBeNull()
  })

  it('außerhalb der Futtermittel nie, auch mit Verpackung', () => {
    expect(noetigeRegistrierung({ category: 'BRENNHOLZ', verpackung: 'ABGEPACKT_ETIKETT' })).toBeNull()
    expect(noetigeRegistrierung({ category: 'EIER', verpackung: 'LOSE_BALLEN' })).toBeNull()
    expect(noetigeRegistrierung({ category: null, verpackung: 'LOSE_BALLEN' })).toBeNull()
  })

  it('die Altlast FUTTERMITTEL ist Futter und wird wie lose Ernte behandelt', () => {
    expect(noetigeRegistrierung({ category: 'FUTTERMITTEL', verpackung: 'LOSE_BALLEN' })).toBe('LFBIS')
  })
})

describe('hatRegistrierung — was der Hof eingetragen hat (E9: die Plattform prüft nicht)', () => {
  it('LFBIS: jede eingetragene Nummer genügt', () => {
    expect(hatRegistrierung('LFBIS', LFBIS)).toBe(true)
    expect(hatRegistrierung('LFBIS', BAES)).toBe(true)
    expect(hatRegistrierung('LFBIS', { betriebsnummer: 'AT 1234567', betriebsstatus: null })).toBe(true)
  })

  it('ohne Nummer gibt es nichts — auch nicht mit Status, auch nicht mit Leerzeichen', () => {
    expect(hatRegistrierung('LFBIS', OHNE)).toBe(false)
    expect(hatRegistrierung('LFBIS', { betriebsnummer: '   ', betriebsstatus: 'REGISTRIERT' })).toBe(false)
    expect(hatRegistrierung('BAES', { betriebsnummer: null, betriebsstatus: 'REGISTRIERT' })).toBe(false)
  })

  it.each<[BetriebsstatusValue | null, boolean]>([
    ['PRIMAERPRODUKTION', false],
    ['REGISTRIERT', true],
    ['ZUGELASSEN', true],
    [null, false],
  ])('BAES bei Status %s: %s', (status, erwartet) => {
    expect(hatRegistrierung('BAES', { betriebsnummer: 'AT 1234567', betriebsstatus: status })).toBe(erwartet)
  })

  it('jeder Status des Enums ist bedacht', () => {
    expect([...BETRIEBSSTATUS_VALUES]).toEqual(['PRIMAERPRODUKTION', 'REGISTRIERT', 'ZUGELASSEN'])
  })
})

describe('gebindeSperre — Abnahme „Heu mit vier Größen, davon zwei ohne Meldung gesperrt"', () => {
  const groessen = [
    { name: '1 kg-Sackerl', verpackung: 'ABGEPACKT_ETIKETT' as const },
    { name: '5 kg-Sack', verpackung: 'ABGEPACKT_ETIKETT' as const },
    { name: 'Kleinballen', verpackung: 'LOSE_BALLEN' as const },
    { name: 'Rundballen', verpackung: 'LOSE_BALLEN' as const },
  ]

  it('mit LFBIS: Sackerl und Sack gesperrt (Heimtierfutter), Ballen frei', () => {
    const gesperrt = groessen.filter((g) => istGebindeGesperrt({ category: 'HEU_STROH', verpackung: g.verpackung }, LFBIS))
    expect(gesperrt.map((g) => g.name)).toEqual(['1 kg-Sackerl', '5 kg-Sack'])
    expect(gebindeSperre({ category: 'HEU_STROH', verpackung: 'ABGEPACKT_ETIKETT' }, LFBIS)).toEqual({
      registrierung: 'BAES',
      grund: SPERR_GRUND.heimtierfutter,
    })
  })

  it('mit BAES-Meldung (oder Zulassung): alle vier frei', () => {
    for (const hof of [BAES, ALPHA]) {
      expect(groessen.filter((g) => istGebindeGesperrt({ category: 'HEU_STROH', verpackung: g.verpackung }, hof))).toEqual([])
    }
  })

  it('ohne Nummer: alle vier gesperrt, Ballen mit dem LFBIS-Grund', () => {
    expect(groessen.every((g) => istGebindeGesperrt({ category: 'HEU_STROH', verpackung: g.verpackung }, OHNE))).toBe(true)
    expect(gebindeSperre({ category: 'HEU_STROH', verpackung: 'LOSE_BALLEN' }, OHNE)?.grund).toBe(SPERR_GRUND.lfbis)
  })

  it('Mischfutter lose ohne Meldung nennt Mischen oder Zukauf als Grund', () => {
    expect(gebindeSperre({ category: 'MISCHFUTTER', verpackung: 'LOSE_BALLEN' }, LFBIS)?.grund).toBe(SPERR_GRUND.mischenZukauf)
  })

  it('Brennmaterial ist nie gesperrt — es braucht keine Futtermittel-Registrierung', () => {
    expect(gebindeSperre({ category: 'BRENNHOLZ', verpackung: null }, OHNE)).toBeNull()
  })

  it('der Grund ist der Satz aus dem Mockup (mobil-h2-neues-futter-meldung-fehlt)', () => {
    expect(SPERR_GRUND.heimtierfutter).toBe('Wird erst sichtbar mit BAES-Meldung für Heimtierfutter')
  })
})

describe('Die sieben Fälle (Mockup web-h2-neues-futter)', () => {
  it('sind sieben, in der Reihenfolge des Mockups, die ersten zwei entscheidet das Formular', () => {
    expect(REGISTRIERUNGS_FAELLE).toHaveLength(7)
    expect(REGISTRIERUNGS_FAELLE[0].titel).toBe('Eigene Ernte, lose oder in Ballen')
    expect(REGISTRIERUNGS_FAELLE[6].titel).toBe('Fertige Packungen anderer Hersteller')
    expect(HAUPT_FAELLE).toEqual(['eigene-ernte-lose', 'heimtierfutter-abgepackt'])
  })

  it('LFBIS-Hof: Ernte erfüllt, Heimtierfutter fehlt, Handel ohne Angabe', () => {
    expect(fallStand('eigene-ernte-lose', LFBIS)).toBe('erfuellt')
    expect(fallStand('heimtierfutter-abgepackt', LFBIS)).toBe('fehlt')
    expect(fallStand('zukauf', LFBIS)).toBe('info')
  })

  it('gemeldeter Hof: Heimtierfutter und Handel erfüllt; Zusatzstoffe erst mit Zulassung', () => {
    expect(fallStand('heimtierfutter-abgepackt', BAES)).toBe('erfuellt')
    expect(fallStand('zukauf', BAES)).toBe('erfuellt')
    expect(fallStand('zusatzstoffe', BAES)).toBe('info')
    expect(fallStand('zusatzstoffe', ALPHA)).toBe('erfuellt')
  })

  it('wofür das Modell keine Angabe kennt, steht nie ein Haken — auch nicht beim zugelassenen Hof', () => {
    for (const id of ['mischfutter', 'tierisches-heimtierfutter', 'fertige-packungen'] as const) {
      expect(fallStand(id, ALPHA), id).toBe('info')
    }
  })

  it('die Zeile unter den Hauptfällen: Nummer ohne doppeltes Kürzel, sonst „fehlt"', () => {
    expect(fallZeile('eigene-ernte-lose', { betriebsnummer: 'LFBIS 1234567', betriebsstatus: 'PRIMAERPRODUKTION' })).toBe(
      'LFBIS 1234567 · automatisch erfasst'
    )
    expect(fallZeile('eigene-ernte-lose', OHNE)).toBe('LFBIS-Nummer · fehlt')
    expect(fallZeile('heimtierfutter-abgepackt', LFBIS)).toBe('BAES-Meldung · fehlt')
    expect(fallZeile('heimtierfutter-abgepackt', BAES)).toBe('BAES-Meldung · eingetragen')
    expect(fallZeile('zukauf', BAES)).toBeNull()
  })

  it('nummerOhneKuerzel', () => {
    expect(nummerOhneKuerzel(' LFBIS: 1234567 ')).toBe('1234567')
    expect(nummerOhneKuerzel('1234567')).toBe('1234567')
    expect(nummerOhneKuerzel('LFBIS')).toBeNull()
    expect(nummerOhneKuerzel(null)).toBeNull()
  })
})

describe('Sätze im Formular', () => {
  it('LFBIS-Hof: Ballen grün, Sackerl orange mit dem BAES-Satz (Mockup, seit Nr. 36 Meldung statt Registrierung)', () => {
    const saetze = registrierungsSaetze(LFBIS)
    expect(saetze.map((s) => s.ton)).toEqual(['gruen', 'orange'])
    expect(saetze[1].text).toContain('dafür brauchst du eine Meldung beim BAES, keine Registrierung')
  })

  it('gemeldeter Hof: beide grün; ohne Nummer: beide orange', () => {
    expect(registrierungsSaetze(BAES).map((s) => s.ton)).toEqual(['gruen', 'gruen'])
    expect(registrierungsSaetze(OHNE).map((s) => s.ton)).toEqual(['orange', 'orange'])
  })

  it('speichernHinweis: nichts, wenn nichts wartet; sonst sofort und wartend mit Einzahl', () => {
    expect(speichernHinweis(4, 0)).toBeNull()
    expect(speichernHinweis(2, 2)).toBe('2 Größen sind sofort sichtbar. 2 Größen folgen nach der Meldung.')
    expect(speichernHinweis(1, 1)).toBe('1 Größe ist sofort sichtbar. 1 Größe folgt nach der Meldung.')
    expect(speichernHinweis(0, 3)).toContain('Noch keine Größe kann online gehen')
  })
})
