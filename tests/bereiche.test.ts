/**
 * Tests für die Bereiche (src/lib/taxonomie.ts, Sprint Bereiche 1,
 * docs/konzepte/bereiche.md).
 *
 * Beweist: Jede wählbare Kategorie gehört zu genau einem Bereich; die Altlast
 * zählt als Futter; die Futtermittelart ist an die Kategorie gebunden
 * (Tabelle 2.4) und trägt den Satz aus Rückfrage F4; Großgebinde beginnt bei
 * genau 25 kg; Ballen und Big Bags gibt es nicht bei Lebensmitteln (F7); die
 * Betriebsnummer kommt vom Hof, die Kennzeichnung ist nur Rückfall (F6).
 */
import { describe, it, expect } from 'vitest'
import {
  BEREICH_KATEGORIEN,
  BEREICH_VALUES,
  CATEGORY_OPTIONS,
  ANZEIGE_BEREICHE,
  FUTTERMITTELART_VALUES,
  FUTTERMITTELART_LABEL,
  FUTTERMITTELART_ERKLAERUNG,
  GROSSGEBINDE_AB_KG,
  PRODUCT_CATEGORY_VALUES,
  PRODUCT_SUBCATEGORY_VALUES,
  BETRIEBSSTATUS,
  BETRIEBSSTATUS_VALUES,
  bereichVon,
  betriebsnummerFuerAnzeige,
  futtermittelartenFuer,
  futtermittelartSatz,
  grossgebindeEinheitenAngeboten,
  istAltlastKategorie,
  istAltlastUnterkategorie,
  istFuttermittel,
  istGrossgebinde,
  istGrossgebindeEinheit,
  anzeigeBereichVon,
  type ProductCategoryValue,
} from '@/lib/taxonomie'

describe('bereichVon', () => {
  it('ordnet die vier Futter-Kategorien dem Bereich Futtermittel zu', () => {
    for (const l1 of ['HEU_STROH', 'GETREIDE_KOERNER', 'MISCHFUTTER', 'ERGAENZUNGSFUTTER'] as const) {
      expect(bereichVon(l1)).toBe('FUTTERMITTEL')
    }
  })

  it('ordnet Eier, Milch und Getränke den Lebensmitteln zu', () => {
    expect(bereichVon('EIER')).toBe('LEBENSMITTEL')
    expect(bereichVon('MILCH')).toBe('LEBENSMITTEL')
    expect(bereichVon('GETRAENKE')).toBe('LEBENSMITTEL')
  })

  it('ordnet Brennholz, Sonstiges und fehlende Kategorie dem Bereich Sonstiges zu', () => {
    expect(bereichVon('BRENNHOLZ')).toBe('SONSTIGES')
    expect(bereichVon('SONSTIGES')).toBe('SONSTIGES')
    expect(bereichVon(null)).toBe('SONSTIGES')
    expect(bereichVon(undefined)).toBe('SONSTIGES')
  })

  it('zählt die Altlast FUTTERMITTEL als Futter, damit Bestandsdaten nicht bei den Lebensmitteln landen', () => {
    expect(bereichVon('FUTTERMITTEL')).toBe('FUTTERMITTEL')
    expect(istFuttermittel('FUTTERMITTEL')).toBe(true)
  })

  it('istFuttermittel folgt bereichVon', () => {
    expect(istFuttermittel('HEU_STROH')).toBe(true)
    expect(istFuttermittel('EIER')).toBe(false)
    expect(istFuttermittel(null)).toBe(false)
  })
})

describe('BEREICH_KATEGORIEN', () => {
  it('jede wählbare Kategorie steht in genau einem Bereich', () => {
    for (const { value } of CATEGORY_OPTIONS) {
      const bereiche = BEREICH_VALUES.filter((b) =>
        (BEREICH_KATEGORIEN[b] as readonly ProductCategoryValue[]).includes(value)
      )
      expect(bereiche, value).toHaveLength(1)
      expect(bereichVon(value)).toBe(bereiche[0])
    }
  })

  it('die Altlast steht in keinem Bereich — sie ist nicht wählbar', () => {
    const alle = Object.values(BEREICH_KATEGORIEN).flat() as readonly ProductCategoryValue[]
    expect(alle).not.toContain('FUTTERMITTEL')
    expect(alle.length).toBe(PRODUCT_CATEGORY_VALUES.length - 1)
  })

  it('entspricht der Tabelle 2.1 des Konzepts', () => {
    expect(BEREICH_KATEGORIEN.FUTTERMITTEL).toEqual(['HEU_STROH', 'GETREIDE_KOERNER', 'MISCHFUTTER', 'ERGAENZUNGSFUTTER'])
    expect(BEREICH_KATEGORIEN.SONSTIGES).toEqual(['BRENNHOLZ', 'SONSTIGES'])
  })
})

describe('Altlast', () => {
  it('erkennt FUTTERMITTEL als Altlast-Kategorie, die neuen nicht', () => {
    expect(istAltlastKategorie('FUTTERMITTEL')).toBe(true)
    expect(istAltlastKategorie('HEU_STROH')).toBe(false)
    expect(istAltlastKategorie(null)).toBe(false)
  })

  it('erkennt die drei Rechtsbegriffe als Altlast-Unterkategorien', () => {
    expect(istAltlastUnterkategorie('EINZELFUTTERMITTEL')).toBe(true)
    expect(istAltlastUnterkategorie('MISCHFUTTERMITTEL')).toBe(true)
    expect(istAltlastUnterkategorie('ERGAENZUNGSFUTTERMITTEL')).toBe(true)
    expect(istAltlastUnterkategorie('WIESENHEU')).toBe(false)
    expect(istAltlastUnterkategorie(null)).toBe(false)
  })

  it('die neuen Unterkategorien stehen im Enum', () => {
    for (const l2 of ['WIESENHEU', 'LUZERNE', 'STROH', 'SILAGE', 'MAIS', 'HAFER', 'GERSTE', 'WEIZEN', 'ROGGEN', 'TRITICALE']) {
      expect(PRODUCT_SUBCATEGORY_VALUES as readonly string[]).toContain(l2)
    }
  })
})

describe('Formular-Kacheln', () => {
  it('Lebensmittel trägt Lebensmittel UND Sonstiges, Futtermittel nur die vier Futter-Kategorien', () => {
    expect(ANZEIGE_BEREICHE.LEBENSMITTEL.kategorien).toEqual([
      ...BEREICH_KATEGORIEN.LEBENSMITTEL,
      ...BEREICH_KATEGORIEN.SONSTIGES,
    ])
    expect(ANZEIGE_BEREICHE.FUTTERMITTEL.kategorien).toEqual([...BEREICH_KATEGORIEN.FUTTERMITTEL])
  })

  it('anzeigeBereichVon: Futter → Futtermittel, alles andere und leer → Lebensmittel', () => {
    expect(anzeigeBereichVon('MISCHFUTTER')).toBe('FUTTERMITTEL')
    expect(anzeigeBereichVon('BRENNHOLZ')).toBe('LEBENSMITTEL')
    expect(anzeigeBereichVon(null)).toBe('LEBENSMITTEL')
  })
})

describe('futtermittelartenFuer', () => {
  it('Heu & Stroh und Getreide & Körner: nur Einzelfuttermittel', () => {
    expect(futtermittelartenFuer('HEU_STROH')).toEqual(['EINZELFUTTERMITTEL'])
    expect(futtermittelartenFuer('GETREIDE_KOERNER')).toEqual(['EINZELFUTTERMITTEL'])
  })

  it('Mischfutter: nur Alleinfuttermittel', () => {
    expect(futtermittelartenFuer('MISCHFUTTER')).toEqual(['ALLEINFUTTERMITTEL'])
  })

  it('Ergänzungsfutter: Ergänzungs- oder Mineralfuttermittel', () => {
    expect(futtermittelartenFuer('ERGAENZUNGSFUTTER')).toEqual(['ERGAENZUNGSFUTTERMITTEL', 'MINERALFUTTERMITTEL'])
  })

  it('außerhalb der Futtermittel, bei der Altlast und ohne Kategorie: keine', () => {
    expect(futtermittelartenFuer('EIER')).toEqual([])
    expect(futtermittelartenFuer('FUTTERMITTEL')).toEqual([])
    expect(futtermittelartenFuer(null)).toEqual([])
  })

  it('jede Futter-Kategorie erlaubt mindestens eine Art', () => {
    for (const l1 of BEREICH_KATEGORIEN.FUTTERMITTEL) expect(futtermittelartenFuer(l1).length).toBeGreaterThan(0)
  })
})

describe('futtermittelartSatz — Fehlertext und Begründung (F4)', () => {
  it('nennt je Kategorie den vereinbarten Satz mit richtigem Artikel', () => {
    expect(futtermittelartSatz('HEU_STROH')).toBe('Ein Produkt aus Heu & Stroh ist ein Einzelfuttermittel.')
    expect(futtermittelartSatz('GETREIDE_KOERNER')).toBe('Ein Produkt aus Getreide & Körnern ist ein Einzelfuttermittel.')
    expect(futtermittelartSatz('MISCHFUTTER')).toBe('Mischfutter ist ein Alleinfuttermittel.')
    expect(futtermittelartSatz('ERGAENZUNGSFUTTER')).toBe(
      'Ergänzungsfutter ist ein Ergänzungsfuttermittel oder Mineralfuttermittel.'
    )
  })

  it('ohne Futter-Kategorie gibt es keinen Satz', () => {
    expect(futtermittelartSatz('EIER')).toBeNull()
    expect(futtermittelartSatz(null)).toBeNull()
  })

  it('jede Futtermittelart hat Label und Erklärsatz', () => {
    for (const art of FUTTERMITTELART_VALUES) {
      expect(FUTTERMITTELART_LABEL[art].length).toBeGreaterThan(5)
      expect(FUTTERMITTELART_ERKLAERUNG[art].endsWith('.')).toBe(true)
    }
  })
})

describe('istGrossgebinde', () => {
  it('die Schwelle liegt bei 25 kg', () => {
    expect(GROSSGEBINDE_AB_KG).toBe(25)
  })

  it('knapp darunter klein, genau 25 und darüber groß', () => {
    expect(istGrossgebinde(24.999, 'KG')).toBe(false)
    expect(istGrossgebinde(25, 'KG')).toBe(true)
    expect(istGrossgebinde(25.001, 'KG')).toBe(true)
    expect(istGrossgebinde(300, 'KG')).toBe(true)
  })

  it('Liter zählen 1:1 als kg', () => {
    expect(istGrossgebinde(20, 'LITER')).toBe(false)
    expect(istGrossgebinde(1000, 'LITER')).toBe(true)
  })

  it('nimmt Prisma-Decimal-artige Werte an', () => {
    expect(istGrossgebinde({ toString: () => '25.000' }, 'KG')).toBe(true)
    expect(istGrossgebinde({ toString: () => '5.5' }, 'KG')).toBe(false)
  })

  it('Unlesbares ist kein Großgebinde', () => {
    expect(istGrossgebinde(Number.NaN, 'KG')).toBe(false)
  })
})

describe('Ballen und Big Bags (F7)', () => {
  it('erkennt die beiden Großgebinde-Einheiten', () => {
    expect(istGrossgebindeEinheit('BALLEN')).toBe(true)
    expect(istGrossgebindeEinheit('BIGBAG')).toBe(true)
    expect(istGrossgebindeEinheit('KG')).toBe(false)
  })

  it('angeboten bei Futtermitteln und Sonstiges, nicht bei Lebensmitteln', () => {
    expect(grossgebindeEinheitenAngeboten('HEU_STROH')).toBe(true)
    expect(grossgebindeEinheitenAngeboten('BRENNHOLZ')).toBe(true)
    expect(grossgebindeEinheitenAngeboten(null)).toBe(true)
    expect(grossgebindeEinheitenAngeboten('EIER')).toBe(false)
    expect(grossgebindeEinheitenAngeboten('GEMUESE')).toBe(false)
  })
})

describe('Betriebsnummer (F6)', () => {
  it('jeder Betriebsstatus hat Namen und Hilfesatz', () => {
    for (const s of BETRIEBSSTATUS_VALUES) {
      expect(BETRIEBSSTATUS[s].name.length).toBeGreaterThan(3)
      expect(BETRIEBSSTATUS[s].hilfe.endsWith('.')).toBe(true)
    }
    expect(BETRIEBSSTATUS.PRIMAERPRODUKTION.hilfe).toContain('LFBIS')
    expect(BETRIEBSSTATUS.ZUGELASSEN.hilfe).toContain('α-Nummer')
  })

  it('zeigt die Nummer des Hofs, auch wenn die Kennzeichnung eine andere trägt', () => {
    expect(
      betriebsnummerFuerAnzeige({ betriebsnummer: 'AT 1111111' }, { registrierungsnummer: 'LFBIS 2222222' })
    ).toBe('AT 1111111')
  })

  it('fällt auf die Altlast der Kennzeichnung zurück, wenn der Hof keine hat', () => {
    expect(betriebsnummerFuerAnzeige({ betriebsnummer: null }, { registrierungsnummer: 'LFBIS 2222222' })).toBe(
      'LFBIS 2222222'
    )
    expect(betriebsnummerFuerAnzeige({ betriebsnummer: '   ' }, { registrierungsnummer: 'LFBIS 2222222' })).toBe(
      'LFBIS 2222222'
    )
  })

  it('ohne beide Nummern: null', () => {
    expect(betriebsnummerFuerAnzeige({ betriebsnummer: null }, null)).toBeNull()
    expect(betriebsnummerFuerAnzeige({ betriebsnummer: null }, { registrierungsnummer: '' })).toBeNull()
  })
})
