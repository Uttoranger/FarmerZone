import { describe, expect, it } from 'vitest'
import { ausverkauftHinweis, entfernteNamen, korbHinweisMitNamen } from '@/lib/korb-hinweis'
import { befundMeldung, gleicheKorbMitHofseite, KORB_PREIS_GEAENDERT, RESERVIERUNG_ABGELAUFEN, type PositionsBefund } from '@/lib/reservierung'

/*
 * Nr. 276 (Liste Lauf 32, korb, B-Zeile): Der Korb-Hinweis nennt das entfernte Produkt. Die Sätze der Quelle entstehen
 * hier über befundMeldung selbst — so prüft der Test gegen den echten Wortlaut, nicht gegen eine Abschrift.
 */

function befund(zustaende: PositionsBefund['zustand'][], abgelaufen = false): string {
  const positionen: PositionsBefund[] = zustaende.map((zustand, i) => ({
    productId: `p${i}`,
    gewuenscht: 2,
    moeglich: zustand === 'weg' ? 0 : zustand === 'gekuerzt' ? 1 : 2,
    abgelaufen,
    zustand,
  }))
  const satz = befundMeldung({ positionen, etwasAbgelaufen: abgelaufen, etwasGeaendert: zustaende.some((z) => z !== 'ok') })
  if (!satz) throw new Error('Befund ohne Satz')
  return satz
}

const pos = (productId: string, name: string, quantity = 1) => ({ productId, name, price: 4.5, unit: 'STUECK', unitSize: null, imageUrl: null, quantity })

describe('korbHinweisMitNamen', () => {
  it('eine entfernte Position: Satz des Boards mit dem Produktnamen', () => {
    expect(korbHinweisMitNamen(befund(['weg']), ['Bergkäse'])).toBe('Bergkäse ist gerade ausverkauft – wir haben es herausgenommen.')
  })

  it('zwei entfernte Positionen: beide Namen, „sie“', () => {
    expect(korbHinweisMitNamen(befund(['weg', 'weg']), ['Bergkäse', 'Heumilch frisch'])).toBe(
      'Bergkäse und Heumilch frisch sind gerade ausverkauft – wir haben sie herausgenommen.'
    )
  })

  it('drei entfernte Positionen: Aufzählung mit Komma und „und“', () => {
    expect(ausverkauftHinweis(['A', 'B', 'C'])).toBe('A, B und C sind gerade ausverkauft – wir haben sie herausgenommen.')
  })

  it('mehrere Positionen desselben Produkts: Satz der Quelle bleibt', () => {
    const quelle = befund(['weg', 'weg'])
    const namen = entfernteNamen([pos('kaese', 'Bergkäse'), pos('kaese', 'Bergkäse')], [])
    expect(namen).toBeNull()
    expect(korbHinweisMitNamen(quelle, namen)).toBe(quelle)
  })

  it('entfernt plus Preis geändert: Board-Satz, dahinter KORB_PREIS_GEAENDERT wörtlich', () => {
    const quelle = `${befund(['weg'])} ${KORB_PREIS_GEAENDERT}`
    expect(korbHinweisMitNamen(quelle, ['Bergkäse'])).toBe(`Bergkäse ist gerade ausverkauft – wir haben es herausgenommen. ${KORB_PREIS_GEAENDERT}`)
  })

  it('entfernt plus gekürzt plus abgelaufen: nur der Teil zu entfernten Positionen wird ersetzt', () => {
    const quelle = befund(['weg', 'gekuerzt'], true)
    const ergebnis = korbHinweisMitNamen(quelle, ['Bergkäse'])
    const entferntSatz = befund(['weg']) // „Eine Position … entfernt.“ aus der Quelle
    const ohneEntfernt = quelle.replace(entferntSatz, '')
    expect(ergebnis.startsWith(RESERVIERUNG_ABGELAUFEN)).toBe(true)
    expect(ergebnis).toContain('Bergkäse ist gerade ausverkauft – wir haben es herausgenommen.')
    expect(ergebnis).not.toContain(entferntSatz)
    // Abgelaufen vorn, gekürzt hinten: wörtlich wie in der Quelle.
    expect(ergebnis.replace('Bergkäse ist gerade ausverkauft – wir haben es herausgenommen.', '')).toBe(ohneEntfernt)
  })

  it('der zu ersetzende Satz kommt nicht vor: Satz der Quelle unverändert', () => {
    const nurGekuerzt = befund(['gekuerzt'])
    expect(korbHinweisMitNamen(nurGekuerzt, ['Bergkäse'])).toBe(nurGekuerzt)
    // Anzahl passt nicht: Die Quelle sagt eine Position, der Korb kennt zwei Namen.
    const eine = befund(['weg'])
    expect(korbHinweisMitNamen(eine, ['A', 'B'])).toBe(eine)
    expect(korbHinweisMitNamen(KORB_PREIS_GEAENDERT, ['Bergkäse'])).toBe(KORB_PREIS_GEAENDERT)
  })

  it('Wortgrenze: Quelle über 12 Positionen, Korb kennt 2 Namen → Satz der Quelle', () => {
    const zwoelf = befund(Array.from({ length: 12 }, () => 'weg' as const))
    expect(zwoelf.startsWith('12 ')).toBe(true)
    expect(korbHinweisMitNamen(zwoelf, ['A', 'B'])).toBe(zwoelf)
  })

  it('ohne Namen: Satz der Quelle unverändert', () => {
    const quelle = befund(['weg'])
    expect(korbHinweisMitNamen(quelle, null)).toBe(quelle)
    expect(korbHinweisMitNamen(quelle, [])).toBe(quelle)
  })

  it('Sonderzeichen im Namen ($&) landen wörtlich im Satz', () => {
    expect(korbHinweisMitNamen(befund(['weg']), ['Käse $& Co'])).toBe('Käse $& Co ist gerade ausverkauft – wir haben es herausgenommen.')
  })
})

describe('entfernteNamen', () => {
  it('nennt nur Positionen, die im berichtigten Korb fehlen, in der Reihenfolge des Korbs', () => {
    const vorher = [pos('a', 'Heumilch frisch'), pos('b', 'Bergkäse'), pos('c', 'Eier')]
    expect(entfernteNamen(vorher, [{ productId: 'a' }])).toEqual(['Bergkäse', 'Eier'])
  })

  it('gekürzt ist nicht entfernt; nichts entfernt ergibt null', () => {
    expect(entfernteNamen([pos('a', 'Heumilch', 3)], [{ productId: 'a' }])).toBeNull()
  })

  it('leerer Name: nicht sicher zuzuordnen', () => {
    expect(entfernteNamen([pos('a', '  ')], [])).toBeNull()
  })
})

describe('Abgleich der Hofseite mit Namen (product-grid)', () => {
  it('ausverkauftes Produkt: der Satz von gleicheKorbMitHofseite wird zum Board-Satz', () => {
    const vorher = [pos('milch', 'Heumilch frisch', 2), pos('kaese', 'Bergkäse')]
    const produkte = [{ id: 'milch', name: 'Heumilch frisch', price: 4.5, unit: 'STUECK', unitSize: null, imageUrl: null, stock: 5 }]
    const abgleich = gleicheKorbMitHofseite(vorher, produkte, null)
    expect(abgleich?.satz).toBeTruthy()
    const satz = korbHinweisMitNamen(abgleich?.satz ?? '', entfernteNamen(vorher, abgleich?.positionen ?? []))
    expect(satz).toBe('Bergkäse ist gerade ausverkauft – wir haben es herausgenommen.')
  })

  it('nur gekürzt: Satz der Quelle bleibt', () => {
    const vorher = [pos('milch', 'Heumilch frisch', 4)]
    const produkte = [{ id: 'milch', name: 'Heumilch frisch', price: 4.5, unit: 'STUECK', unitSize: null, imageUrl: null, stock: 2 }]
    const abgleich = gleicheKorbMitHofseite(vorher, produkte, null)
    const satz = korbHinweisMitNamen(abgleich?.satz ?? '', entfernteNamen(vorher, abgleich?.positionen ?? []))
    expect(satz).toBe(abgleich?.satz)
  })
})
