/**
 * Tests für das Illustrations-Mapping (src/lib/product-image.ts, Register I1).
 *
 * Beweist: Rückfall-Kette Unterkategorie → Kategorie → „Sonstiges", je Stufe nur,
 * wenn die Datei liegt; null erst, wenn nicht einmal „Sonstiges" liegt.
 * Ohne Unterkategorie (Startseite, „Für Höfe") beginnt die Kette bei der
 * Kategorie. Seit Nr. 51 kennt auch der Browser die Zuordnung (illustrationPfad
 * und kategorieBildPfad in taxonomie.ts, Käufer-Vorschau im Produktdialog) — es
 * bleibt EINE Zuordnung.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { CATEGORY_SLUGS, categoryImagePath } from '@/lib/product-image'
import {
  KATEGORIE_BILD_SLUG,
  PRODUCT_CATEGORY_VALUES,
  SONSTIGES_BILD_PFAD,
  illustrationPfad,
  kategorieBildPfad,
} from '@/lib/taxonomie'

describe('categoryImagePath', () => {
  it('mappt Kategorien auf /categories/{slug}.webp, wenn die Datei existiert', () => {
    const exists = () => true
    expect(categoryImagePath('MILCH', null, exists)).toBe('/categories/milch.webp')
    expect(categoryImagePath('EIER', null, exists)).toBe('/categories/eier.webp')
    expect(categoryImagePath('GEMUESE', null, exists)).toBe('/categories/gemuese.webp')
    expect(categoryImagePath('BRENNHOLZ', null, exists)).toBe('/categories/brennholz.webp')
    expect(categoryImagePath('SONSTIGES', null, exists)).toBe('/categories/sonstiges.webp')
  })

  it('gibt null zurück, wenn keine Asset-Datei liegt — auch nicht „Sonstiges"', () => {
    expect(categoryImagePath('MILCH', null, () => false)).toBeNull()
    expect(categoryImagePath(null, null, () => false)).toBeNull()
  })

  it('ohne Kategorie steht „Sonstiges" da (Rückfall je Produkt, Register I1)', () => {
    expect(categoryImagePath(null)).toBe('/categories/sonstiges.webp')
    expect(categoryImagePath(undefined)).toBe('/categories/sonstiges.webp')
  })

  it('prüft gegen das echte Dateisystem: vorhandene Assets liefern den Pfad, fehlende die nächste Stufe', () => {
    expect(categoryImagePath('MILCH')).toBe('/categories/milch.webp')
    // Fehlt die Datei einer Kategorie, entscheidet das Dateisystem — „Sonstiges"
    // statt eines gebrochenen Bilds (der Rückfall selbst steht unten mit Attrappen).
    const gemuese = fs.existsSync(path.join(process.cwd(), 'public', 'categories', 'gemuese.webp'))
    expect(categoryImagePath('GEMUESE')).toBe(gemuese ? '/categories/gemuese.webp' : '/categories/sonstiges.webp')
  })

  it('die Futter-Kategorien haben eigene Bilder; nur die Altlast FUTTERMITTEL bleibt bei Sonstiges', () => {
    expect(CATEGORY_SLUGS.HEU_STROH).toBe('heu-stroh')
    expect(CATEGORY_SLUGS.GETREIDE_KOERNER).toBe('getreide-koerner')
    expect(CATEGORY_SLUGS.MISCHFUTTER).toBe('mischfutter')
    expect(CATEGORY_SLUGS.ERGAENZUNGSFUTTER).toBe('ergaenzungsfutter')
    expect(CATEGORY_SLUGS.FUTTERMITTEL).toBe('sonstiges')
  })

  it('zu jeder Kategorie in CATEGORY_SLUGS liegt die Datei in public/categories', () => {
    for (const [kategorie, slug] of Object.entries(CATEGORY_SLUGS)) {
      const datei = path.join(process.cwd(), 'public', 'categories', `${slug}.webp`)
      expect(fs.existsSync(datei), `${kategorie} → ${slug}.webp`).toBe(true)
    }
  })
})

describe('categoryImagePath mit Unterkategorie — Unterkategorie → Kategorie → Sonstiges (Register I1, Nr. 74)', () => {
  /** Eine Attrappe des Dateisystems: nur diese Dateien liegen. */
  const liegen = (...dateien: string[]) => (publicPfad: string) => dateien.includes(publicPfad)

  it('liefert die Datei der Unterkategorie im Ordner ihrer Kategorie, wenn sie liegt', () => {
    expect(categoryImagePath('HEU_STROH', 'WIESENHEU', () => true)).toBe('/categories/heu-stroh/wiesenheu.webp')
    expect(categoryImagePath('MILCH', 'JOGHURT_TOPFEN', () => true)).toBe('/categories/milch/joghurt-topfen.webp')
    expect(categoryImagePath('BRENNHOLZ', 'BRENNHOLZ_SCHEIT', () => true)).toBe('/categories/brennholz/brennholz-scheit.webp')
  })

  it('fehlt die Datei der Unterkategorie, fällt es auf die Kategorie zurück — nie auf null', () => {
    const nurKategorie = liegen('categories/heu-stroh.webp', 'categories/sonstiges.webp')
    expect(categoryImagePath('HEU_STROH', 'WIESENHEU', nurKategorie)).toBe('/categories/heu-stroh.webp')
  })

  it('fehlt auch die Datei der Kategorie, steht „Sonstiges" da', () => {
    expect(categoryImagePath('HEU_STROH', 'WIESENHEU', liegen('categories/sonstiges.webp'))).toBe(SONSTIGES_BILD_PFAD)
  })

  it('null erst, wenn nicht einmal „Sonstiges" liegt', () => {
    expect(categoryImagePath('HEU_STROH', 'WIESENHEU', liegen('categories/milch.webp'))).toBeNull()
  })

  it('fragt Stufe für Stufe und nie doppelt: Unterkategorie, Kategorie, Sonstiges', () => {
    const gefragt: string[] = []
    categoryImagePath('HONIG', 'WALDHONIG', (p) => {
      gefragt.push(p)
      return false
    })
    expect(gefragt).toEqual(['categories/honig/waldhonig.webp', 'categories/honig.webp', 'categories/sonstiges.webp'])

    const ohneUnterkategorie: string[] = []
    categoryImagePath('SONSTIGES', null, (p) => {
      ohneUnterkategorie.push(p)
      return false
    })
    expect(ohneUnterkategorie).toEqual(['categories/sonstiges.webp'])
  })

  it('eine Unterkategorie ohne eigene Illustration (Eier-Haltungsform, Futter-Altlast) fragt nie nach einer eigenen Datei', () => {
    for (const [kategorie, unterkategorie, erwartet] of [
      ['EIER', 'EIER_FREILAND', '/categories/eier.webp'],
      ['FUTTERMITTEL', 'EINZELFUTTERMITTEL', '/categories/sonstiges.webp'],
    ] as const) {
      const gefragt: string[] = []
      const pfad = categoryImagePath(kategorie, unterkategorie, (p) => {
        gefragt.push(p)
        return true
      })
      expect(pfad, unterkategorie).toBe(erwartet)
      expect(gefragt, unterkategorie).toEqual([erwartet.slice(1)])
    }
  })

  it('eine Unterkategorie, die nicht zur Kategorie gehört, ergibt nie einen Pfad ins Leere', () => {
    expect(categoryImagePath('MILCH', 'RIND', () => true)).toBe('/categories/milch.webp')
    expect(categoryImagePath(null, 'RIND', () => true)).toBe('/categories/sonstiges.webp')
  })

  it('Produktraster: ein Heu-Produkt ohne Foto zeigt den Wiesenheu-Ballen (echtes Dateisystem)', () => {
    expect(categoryImagePath('HEU_STROH', 'WIESENHEU')).toBe('/categories/heu-stroh/wiesenheu.webp')
    expect(fs.existsSync(path.join(process.cwd(), 'public', 'categories', 'heu-stroh', 'wiesenheu.webp'))).toBe(true)
  })
})

describe('illustrationPfad — dieselbe Kette im Browser, ohne Dateisystem (Käufer-Vorschau, Nr. 51)', () => {
  it('Unterkategorie mit Bild, sonst Kategorie, sonst „Sonstiges"', () => {
    expect(illustrationPfad('FLEISCH', 'RIND')).toBe('/categories/fleisch/rind.webp')
    expect(illustrationPfad('EIER', 'EIER_BIO')).toBe('/categories/eier.webp')
    expect(illustrationPfad('GETRAENKE')).toBe('/categories/getraenke.webp')
    expect(illustrationPfad(null)).toBe(SONSTIGES_BILD_PFAD)
    expect(illustrationPfad(undefined, 'RIND')).toBe(SONSTIGES_BILD_PFAD)
  })

  it('ohne Unterkategorie ist es genau die Kategorie-Zuordnung (kategorieBildPfad) — für jede Kategorie', () => {
    for (const kategorie of PRODUCT_CATEGORY_VALUES) {
      expect(illustrationPfad(kategorie), kategorie).toBe(kategorieBildPfad(kategorie))
    }
  })
})

describe('kategorieBildPfad — dieselbe Zuordnung im Browser (Käufer-Vorschau, Nr. 51)', () => {
  it('ergibt für jede Kategorie den Pfad, den der Server bei vorhandener Datei liefert', () => {
    for (const kategorie of PRODUCT_CATEGORY_VALUES) {
      expect(kategorieBildPfad(kategorie), kategorie).toBe(categoryImagePath(kategorie, null, () => true))
    }
  })

  it('ohne Kategorie kein Bild — für Aufrufer ohne Unterkategorie und ohne Rückfall', () => {
    expect(kategorieBildPfad(null)).toBeNull()
    expect(kategorieBildPfad(undefined)).toBeNull()
  })

  it('eine Zuordnung: product-image.ts nimmt sie aus taxonomie.ts, keine zweite Liste', () => {
    expect(CATEGORY_SLUGS).toBe(KATEGORIE_BILD_SLUG)
    const text = fs.readFileSync(path.join(process.cwd(), 'src/lib/product-image.ts'), 'utf8')
    expect(text).not.toMatch(/MILCH:\s*'milch'/)
    // Gegenprobe: In taxonomie.ts steht sie.
    expect(fs.readFileSync(path.join(process.cwd(), 'src/lib/taxonomie.ts'), 'utf8')).toMatch(/MILCH:\s*'milch'/)
  })
})
