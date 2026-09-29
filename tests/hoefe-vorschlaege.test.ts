/**
 * Hofübersicht: Kategorien zuerst, Vorschläge nur beim Tippen.
 *
 * Der Fehler: Unter dem Suchfeld standen IMMER bis zu zwölf Produktnamen als
 * Knöpfe — auch ohne Eingabe. Sie sahen aus wie Filter und schoben die
 * Kategorie-Chips nach unten.
 *
 * Beweist:
 *  - Leeres Suchfeld (auch nur Leerzeichen) → keine Vorschläge.
 *  - Mit Eingabe höchstens sechs, nur aus dem gewählten Bereich.
 *  - Die Kategorie-Chips zählen die Höfe mit kaufbarem Angebot (istKaufbar).
 *  - Tastatur (tasteInVorschlaegen): Pfeile wandern und öffnen wieder, Enter
 *    übernimmt, Escape schließt, ohne das Feld zu leeren; markiert wird über
 *    den Namen, damit ein Filterwechsel die Markierung nicht verschiebt.
 *  - Am Quelltext: Die Vorschläge sind eine Liste unter dem Suchfeld
 *    (role="listbox"), die beim Verlassen des Felds schließt; die Chips
 *    zeigen ihre Zahl.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { berechneHofAuswahl, bewegeMarkierung, tasteInVorschlaegen, VORSCHLAGS_DECKEL } from '@/lib/hofuebersicht'
import { baueAngebotsZeile, kategorieChips, type AngebotsZeile } from '@/lib/bereiche-anzeige'
import { LEERER_HOEFE_FILTER } from '@/schemas/hoefe-filter'
import type { ProductCategoryValue } from '@/schemas/product'

const FILTER = { ...LEERER_HOEFE_FILTER, bezugspunkt: null, umkreis: null }

function zeile(name: string, category: ProductCategoryValue): AngebotsZeile {
  return { name, category, subcategory: null, labels: [], tiere: [], grundpreis: null, grossgebinde: null }
}

function hof(name: string, angebot: AngebotsZeile[]) {
  return { name, angebot, kategorien: [], suchNamen: [], latitude: 48.2, longitude: 13.5 }
}

const HOEFE = [
  hof('Hof Ost', [
    zeile('Freilandeier', 'EIER'),
    zeile('Eierlikör', 'GETRAENKE'),
    zeile('Emmerbrot', 'BROT'),
    zeile('Erdäpfel', 'GEMUESE'),
    zeile('Essig', 'SONSTIGES'),
    zeile('Edelschimmelkäse', 'MILCH'),
    zeile('Eisbergsalat', 'GEMUESE'),
    zeile('Heu', 'HEU_STROH'),
  ]),
  hof('Hof West', [zeile('Eier', 'EIER'), zeile('Heulage', 'HEU_STROH')]),
]

describe('Vorschläge nur beim Tippen', () => {
  it('leeres Suchfeld → keine Vorschläge', () => {
    expect(berechneHofAuswahl(HOEFE, { ...FILTER, suchtext: '' }).vorschlaege).toEqual([])
    expect(berechneHofAuswahl(HOEFE, { ...FILTER, suchtext: '   ' }).vorschlaege).toEqual([])
  })

  it('mit Eingabe höchstens sechs', () => {
    expect(VORSCHLAGS_DECKEL).toBe(6)
    const { vorschlaege } = berechneHofAuswahl(HOEFE, { ...FILTER, suchtext: 'e' })
    expect(vorschlaege.length).toBeGreaterThan(0)
    expect(vorschlaege.length).toBeLessThanOrEqual(6)
  })

  it('aktive Marken kosten keinen Platz — es bleiben sechs, wenn es mehr gibt', () => {
    const { vorschlaege } = berechneHofAuswahl(HOEFE, { ...FILTER, suchtext: 'e', suchMarken: ['Eier', 'Essig'] })
    expect(vorschlaege).toHaveLength(6)
    expect(vorschlaege.map((v) => v.name)).not.toContain('Eier')
    expect(vorschlaege.map((v) => v.name)).not.toContain('Essig')
  })

  it('nur aus dem gewählten Bereich', () => {
    const hofladen = berechneHofAuswahl(HOEFE, { ...FILTER, suchtext: 'heu' }).vorschlaege.map((v) => v.name)
    expect(hofladen).toEqual([])
    const futter = berechneHofAuswahl(HOEFE, { ...FILTER, bereich: 'FUTTERMITTEL', suchtext: 'e' }).vorschlaege
    expect(futter.map((v) => v.name).sort()).toEqual(['Heu', 'Heulage'])
  })
})

describe('bewegeMarkierung — Pfeiltasten in der Liste', () => {
  it('ohne Markierung: ↓ zum ersten, ↑ zum letzten', () => {
    expect(bewegeMarkierung(-1, 4, 1)).toBe(0)
    expect(bewegeMarkierung(-1, 4, -1)).toBe(3)
  })

  it('ringsum, und eine zu große Markierung beginnt neu', () => {
    expect(bewegeMarkierung(3, 4, 1)).toBe(0)
    expect(bewegeMarkierung(0, 4, -1)).toBe(3)
    expect(bewegeMarkierung(1, 4, 1)).toBe(2)
    expect(bewegeMarkierung(7, 4, 1)).toBe(0)
  })

  it('leere Liste: nichts markiert', () => {
    expect(bewegeMarkierung(0, 0, 1)).toBe(-1)
  })
})

describe('tasteInVorschlaegen — Enter, Escape, Pfeile', () => {
  const NAMEN = ['Eier', 'Freilandeier', 'Eierlikör']
  const offen = (markiert: string | null = null) => ({ offen: true, markiert })

  it('↓ markiert den ersten, ↑ den letzten — und öffnet eine geschlossene Liste wieder', () => {
    expect(tasteInVorschlaegen('ArrowDown', offen(), NAMEN)).toEqual({
      lage: { offen: true, markiert: 'Eier' },
      uebernehmen: null,
      verbrauchen: true,
    })
    expect(tasteInVorschlaegen('ArrowUp', offen(), NAMEN).lage.markiert).toBe('Eierlikör')
    expect(tasteInVorschlaegen('ArrowDown', { offen: false, markiert: null }, NAMEN).lage).toEqual({
      offen: true,
      markiert: 'Eier',
    })
  })

  it('Enter übernimmt den markierten Vorschlag und schließt; ohne Markierung passiert nichts', () => {
    expect(tasteInVorschlaegen('Enter', offen('Freilandeier'), NAMEN)).toEqual({
      lage: { offen: false, markiert: null },
      uebernehmen: 'Freilandeier',
      verbrauchen: true,
    })
    expect(tasteInVorschlaegen('Enter', offen(), NAMEN)).toMatchObject({ uebernehmen: null, verbrauchen: false })
  })

  it('Escape schließt und verbraucht die Taste — sonst leert der Browser das Suchfeld', () => {
    expect(tasteInVorschlaegen('Escape', offen('Eier'), NAMEN)).toEqual({
      lage: { offen: false, markiert: null },
      uebernehmen: null,
      verbrauchen: true,
    })
    // Ist die Liste schon zu, gehört Escape wieder dem Feld.
    expect(tasteInVorschlaegen('Escape', { offen: false, markiert: null }, NAMEN).verbrauchen).toBe(false)
  })

  it('markiert wird über den Namen: Ändert ein Filter die Liste, bleibt Enter beim selben Vorschlag', () => {
    // Nach einem Filterwechsel steht „Freilandeier" an erster Stelle.
    const nachFilter = ['Freilandeier', 'Eier']
    expect(tasteInVorschlaegen('Enter', offen('Eier'), nachFilter).uebernehmen).toBe('Eier')
    // Ein Name, den der Filter entfernt hat, zählt als keine Markierung.
    expect(tasteInVorschlaegen('Enter', offen('Eierlikör'), nachFilter).uebernehmen).toBeNull()
    expect(tasteInVorschlaegen('ArrowDown', offen('Eierlikör'), nachFilter).lage.markiert).toBe('Freilandeier')
  })

  it('andere Tasten und leere Listen lassen alles, wie es ist', () => {
    expect(tasteInVorschlaegen('a', offen('Eier'), NAMEN)).toEqual({
      lage: offen('Eier'),
      uebernehmen: null,
      verbrauchen: false,
    })
    expect(tasteInVorschlaegen('ArrowDown', offen(), []).verbrauchen).toBe(false)
  })
})

describe('Kategorie-Chips zählen Höfe mit kaufbarem Angebot', () => {
  it('ein ausverkauftes Produkt zählt nicht', () => {
    const roh = { isAvailable: true, price: 3, subcategory: null, labels: [], futter: null }
    const angebot = (stock: number, reserviert = 0) =>
      [baueAngebotsZeile({ ...roh, name: 'Eier', category: 'EIER', stock, reservedStock: reserviert })].flatMap((z) =>
        z ? [z] : []
      )
    const hoefe = [{ angebot: angebot(5) }, { angebot: angebot(3, 3) }, { angebot: angebot(2) }]
    const eier = kategorieChips(hoefe, LEERER_HOEFE_FILTER).find((c) => c.wert === 'EIER')
    expect(eier?.anzahl).toBe(2)
  })
})

describe('am Quelltext', () => {
  const client = readFileSync(join(process.cwd(), 'src/components/hoefe/hoefe-client.tsx'), 'utf8')

  it('die Vorschläge sind eine Liste unter dem Suchfeld, mit Tastatur bedienbar', () => {
    expect(client).toContain('role="listbox"')
    expect(client).toContain('role="combobox"')
    expect(client).toContain('aria-activedescendant')
    // Die Tastenlogik ist tasteInVorschlaegen (oben getestet) — und Escape
    // wird verbraucht, sonst leert type="search" das Feld.
    expect(client).toContain('tasteInVorschlaegen(e.key, vorschlagsLage, vorschlagsNamen)')
    expect(client).toContain('if (ergebnis.verbrauchen) e.preventDefault()')
    // Die Liste folgt direkt auf das Suchfeld, noch vor den Kategorie-Chips.
    const feld = client.indexOf('role="combobox"')
    const liste = client.indexOf('role="listbox"')
    expect(feld).toBeGreaterThan(-1)
    expect(liste).toBeGreaterThan(feld)
    expect(client).not.toContain('Vorschläge aus dem verfügbaren Angebot')
  })

  it('die Liste schließt, wenn das Feld den Fokus verliert — Antippen eines Vorschlags nimmt ihn nicht', () => {
    expect(client).toContain('onBlur={() => setVorschlagsLage({ offen: false, markiert: null })}')
    expect(client).toContain('onMouseDown={(e) => e.preventDefault()}')
  })

  it('die Kategorie-Chips zeigen ihre Zahl', () => {
    const chips = client.slice(client.indexOf('const filterMarken'), client.indexOf('const sortenReihe'))
    expect(chips).toContain('option.anzahl')
  })
})
