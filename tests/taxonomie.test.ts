/**
 * Tests für die Produkt-Taxonomie (src/lib/taxonomie.ts, Sprint Taxonomie 1).
 *
 * Beweist: Die Wertlisten sind deckungsgleich mit den Prisma-Enums (Reihenfolge
 * inklusive); jede Unterkategorie gehört zu genau EINER Kategorie und kommt
 * nur einmal vor; jedes Siegel hat Namen und Erklärsatz; jede Tierart ein
 * deutsches Plural-Label; die Entscheidungen gehoertZu, hatUnterkategorien
 * und zeigeUnterkategorien verhalten sich an den Rändern richtig; und
 * formatKategorie schreibt L1 und L2 in EINER Schreibweise.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  PRODUCT_CATEGORY_VALUES,
  PRODUCT_SUBCATEGORY_VALUES,
  PRODUCT_LABEL_VALUES,
  TIERART_VALUES,
  TAXONOMIE,
  KATEGORIE_LABEL,
  UNTERKATEGORIE_LABEL,
  SIEGEL,
  TIERART_LABEL,
  CATEGORY_OPTIONS,
  gehoertZu,
  hatUnterkategorien,
  kategorieVon,
  unterkategorienVon,
  zeigeUnterkategorien,
  bereinigeSiegel,
  FUTTERMITTELART_VALUES,
  NETTO_EINHEIT_VALUES,
  ABGABE_VALUES,
  BETRIEBSSTATUS_VALUES,
  type ProductCategoryValue,
  type ProductSubcategoryValue,
} from '@/lib/taxonomie'
import { formatKategorie } from '@/lib/format'

/** Die Werte eines Enums aus prisma/schema.prisma in Dateireihenfolge. */
function schemaEnumWerte(name: string): string[] {
  const schema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
  const block = schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`))
  if (!block) throw new Error(`enum ${name} nicht in prisma/schema.prisma gefunden`)
  // \r?\n: Die Datei liegt unter Windows mit CRLF vor; `.` frisst kein \r.
  return block[1]
    .split(/\r?\n/)
    .map((zeile) => zeile.replace(/\/\/.*$/, '').trim())
    .filter((zeile) => zeile !== '')
}

describe('Abgleich mit dem Prisma-Schema', () => {
  it('Kategorien: dieselben Werte in derselben Reihenfolge', () => {
    expect([...PRODUCT_CATEGORY_VALUES]).toEqual(schemaEnumWerte('ProductCategory'))
  })

  it('Altlast FUTTERMITTEL steht vor den vier Futter-Kategorien, diese direkt vor BRENNHOLZ', () => {
    // Postgres hängt neue Werte per ADD VALUE ... BEFORE BRENNHOLZ ein — das
    // Schema muss dieselbe Reihenfolge tragen wie die Datenbank.
    const werte = [...PRODUCT_CATEGORY_VALUES]
    const b = werte.indexOf('BRENNHOLZ')
    expect(werte.slice(b - 5, b)).toEqual([
      'FUTTERMITTEL', 'HEU_STROH', 'GETREIDE_KOERNER', 'MISCHFUTTER', 'ERGAENZUNGSFUTTER',
    ])
  })

  it('Futtermittelart, Nettoeinheit, Abgabe und Betriebsstatus: dieselben Werte in derselben Reihenfolge', () => {
    expect([...FUTTERMITTELART_VALUES]).toEqual(schemaEnumWerte('Futtermittelart'))
    expect([...NETTO_EINHEIT_VALUES]).toEqual(schemaEnumWerte('NettoEinheit'))
    expect([...ABGABE_VALUES]).toEqual(schemaEnumWerte('Abgabe'))
    expect([...BETRIEBSSTATUS_VALUES]).toEqual(schemaEnumWerte('Betriebsstatus'))
  })

  it('Unterkategorien: dieselben Werte in derselben Reihenfolge', () => {
    expect([...PRODUCT_SUBCATEGORY_VALUES]).toEqual(schemaEnumWerte('ProductSubcategory'))
  })

  it('Siegel: dieselben Werte in derselben Reihenfolge', () => {
    expect([...PRODUCT_LABEL_VALUES]).toEqual(schemaEnumWerte('ProductLabel'))
  })

  it('Tierarten: dieselben Werte in derselben Reihenfolge', () => {
    expect([...TIERART_VALUES]).toEqual(schemaEnumWerte('Tierart'))
  })
})

describe('TAXONOMIE — jede L2 gehört zu genau einer L1', () => {
  it('jede Kategorie hat einen Eintrag, auch die ohne Unterkategorien', () => {
    expect(Object.keys(TAXONOMIE).sort()).toEqual([...PRODUCT_CATEGORY_VALUES].sort())
  })

  it('keine Unterkategorie kommt doppelt vor', () => {
    const alle = Object.values(TAXONOMIE).flat()
    expect(new Set(alle).size).toBe(alle.length)
    expect(alle.length).toBe(PRODUCT_SUBCATEGORY_VALUES.length)
  })

  it('jede Unterkategorie gehört zu genau einer Kategorie', () => {
    for (const l2 of PRODUCT_SUBCATEGORY_VALUES) {
      const zugehoerig = PRODUCT_CATEGORY_VALUES.filter((l1) => gehoertZu(l1, l2))
      expect(zugehoerig, l2).toHaveLength(1)
      expect(kategorieVon(l2)).toBe(zugehoerig[0])
    }
  })

  it('Fisch, Brot, Getränke, Brennholz, Sonstiges, Mischfutter und Ergänzungsfutter haben keine Unterkategorien', () => {
    for (const l1 of ['FISCH', 'BROT', 'GETRAENKE', 'BRENNHOLZ', 'SONSTIGES', 'MISCHFUTTER', 'ERGAENZUNGSFUTTER'] as const) {
      expect(hatUnterkategorien(l1)).toBe(false)
      expect(unterkategorienVon(l1)).toEqual([])
    }
  })

  it('die übrigen neun Kategorien haben Unterkategorien (inklusive Altlast FUTTERMITTEL)', () => {
    for (const l1 of ['MILCH', 'EIER', 'FLEISCH', 'GEMUESE', 'OBST', 'HONIG', 'FUTTERMITTEL', 'HEU_STROH', 'GETREIDE_KOERNER'] as const) {
      expect(hatUnterkategorien(l1)).toBe(true)
      expect(unterkategorienVon(l1).length).toBeGreaterThan(0)
    }
  })

  it('hatUnterkategorien ohne Kategorie ist false', () => {
    expect(hatUnterkategorien(null)).toBe(false)
    expect(hatUnterkategorien(undefined)).toBe(false)
  })

  it('gehoertZu: passend true, fremd false, ohne Kategorie false', () => {
    expect(gehoertZu('FLEISCH', 'RIND')).toBe(true)
    expect(gehoertZu('EIER', 'RIND')).toBe(false)
    expect(gehoertZu('FISCH', 'RIND')).toBe(false)
    expect(gehoertZu(null, 'RIND')).toBe(false)
    expect(gehoertZu(undefined, 'RIND')).toBe(false)
  })
})

describe('Labels', () => {
  it('jede Kategorie hat ein deutsches Label; Honig heißt „Honig & Bienenprodukte"', () => {
    for (const l1 of PRODUCT_CATEGORY_VALUES) expect(KATEGORIE_LABEL[l1].length).toBeGreaterThan(1)
    expect(KATEGORIE_LABEL.HONIG).toBe('Honig & Bienenprodukte')
    expect(KATEGORIE_LABEL.FUTTERMITTEL).toBe('Futtermittel')
    expect(KATEGORIE_LABEL.HEU_STROH).toBe('Heu & Stroh')
    expect(KATEGORIE_LABEL.GETREIDE_KOERNER).toBe('Getreide & Körner')
    expect(KATEGORIE_LABEL.MISCHFUTTER).toBe('Mischfutter')
    expect(KATEGORIE_LABEL.ERGAENZUNGSFUTTER).toBe('Ergänzungsfutter')
  })

  it('CATEGORY_OPTIONS folgt der Enum-Reihenfolge mit denselben Labels, ohne Altlast', () => {
    expect(CATEGORY_OPTIONS.map((o) => o.value)).toEqual(
      PRODUCT_CATEGORY_VALUES.filter((v) => v !== 'FUTTERMITTEL')
    )
    for (const o of CATEGORY_OPTIONS) expect(o.label).toBe(KATEGORIE_LABEL[o.value])
  })

  it('jede Unterkategorie hat ein deutsches Label mit Umlauten statt Umschrift', () => {
    for (const l2 of PRODUCT_SUBCATEGORY_VALUES) expect(UNTERKATEGORIE_LABEL[l2].length).toBeGreaterThan(1)
    expect(UNTERKATEGORIE_LABEL.BLATT_SALAT).toBe('Blatt & Salat')
    expect(UNTERKATEGORIE_LABEL.EINGEKOCHT_GETROCKNET).toBe('Eingekocht & Getrocknet')
    expect(UNTERKATEGORIE_LABEL.ERDAEPFEL).toBe('Erdäpfel')
    expect(UNTERKATEGORIE_LABEL.KAESE).toBe('Käse')
  })

  it('Eier-Unterkategorien tragen die L1 nicht im Namen — sie steht daneben', () => {
    expect(UNTERKATEGORIE_LABEL.EIER_FREILAND).toBe('Freiland')
    expect(UNTERKATEGORIE_LABEL.EIER_BIO).toBe('Bio')
    expect(UNTERKATEGORIE_LABEL.EIER_BODENHALTUNG).toBe('Bodenhaltung')
  })
})

describe('Siegel', () => {
  it('jedes Siegel hat Namen und einen Erklärsatz', () => {
    for (const label of PRODUCT_LABEL_VALUES) {
      expect(SIEGEL[label].name.length).toBeGreaterThan(1)
      expect(SIEGEL[label].erklaerung.length).toBeGreaterThan(20)
      expect(SIEGEL[label].erklaerung.endsWith('.')).toBe(true)
      expect(typeof SIEGEL[label].hatIcon).toBe('boolean')
    }
  })

  it('Gentechnikfrei trägt den vorgegebenen Erklärsatz', () => {
    expect(SIEGEL.GENTECHNIKFREI.erklaerung).toBe(
      'Die Tiere wurden ohne gentechnisch veränderte Futtermittel gefüttert.'
    )
  })

  it('nur Bio hat ein Symbol', () => {
    expect(SIEGEL.BIO.hatIcon).toBe(true)
    expect(SIEGEL.GENTECHNIKFREI.hatIcon).toBe(false)
    expect(SIEGEL.AMA_GUETESIEGEL.hatIcon).toBe(false)
  })

  it('bereinigeSiegel entfernt Doppelte und sortiert in Enum-Reihenfolge', () => {
    expect(bereinigeSiegel(['GENTECHNIKFREI', 'BIO', 'BIO'])).toEqual(['BIO', 'GENTECHNIKFREI'])
    expect(bereinigeSiegel([])).toEqual([])
  })
})

describe('Tierarten', () => {
  it('jede Tierart hat ein deutsches Plural-Label', () => {
    for (const t of TIERART_VALUES) expect(TIERART_LABEL[t].length).toBeGreaterThan(1)
    expect(TIERART_LABEL.PFERD).toBe('Pferde')
    expect(TIERART_LABEL.SCHAF_ZIEGE).toBe('Schafe & Ziegen')
  })
})

describe('zeigeUnterkategorien', () => {
  const p = (subcategory: ProductSubcategoryValue | null) => ({ subcategory })

  it('0 Produkte → false', () => {
    expect(zeigeUnterkategorien([])).toBe(false)
  })

  it('1 Unterkategorie → false, auch wenn sie mehrfach vorkommt', () => {
    expect(zeigeUnterkategorien([p('RIND')])).toBe(false)
    expect(zeigeUnterkategorien([p('RIND'), p('RIND'), p(null)])).toBe(false)
  })

  it('2 verschiedene Unterkategorien → true', () => {
    expect(zeigeUnterkategorien([p('RIND'), p('SCHWEIN')])).toBe(true)
    expect(zeigeUnterkategorien([p(null), p('RIND'), p(null), p('WURST')])).toBe(true)
  })

  it('nur Produkte ohne Unterkategorie → false', () => {
    expect(zeigeUnterkategorien([p(null), p(null)])).toBe(false)
  })
})

describe('formatKategorie', () => {
  it('mit Unterkategorie: „Kategorie · Unterkategorie"', () => {
    expect(formatKategorie('FLEISCH', 'RIND')).toBe('Fleisch & Wurst · Rind')
    expect(formatKategorie('EIER', 'EIER_FREILAND')).toBe('Eier · Freiland')
  })

  it('ohne Unterkategorie nur die Kategorie', () => {
    expect(formatKategorie('FLEISCH')).toBe('Fleisch & Wurst')
    expect(formatKategorie('FLEISCH', null)).toBe('Fleisch & Wurst')
    expect(formatKategorie('BRENNHOLZ', undefined)).toBe('Brennholz')
  })

  it('kennt jede Kategorie', () => {
    for (const l1 of PRODUCT_CATEGORY_VALUES as readonly ProductCategoryValue[]) {
      expect(formatKategorie(l1)).toBe(KATEGORIE_LABEL[l1])
    }
  })
})
