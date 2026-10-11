/**
 * Tests für das Kategorie-Fallback-Bild-Mapping (src/lib/product-image.ts).
 *
 * Beweist: category → /categories/{slug}.webp, null/fehlende Kategorie → null,
 * fehlende Asset-Datei → null (die WebP-Assets folgen als eigener Commit).
 * Seit Nr. 51 kennt auch der Browser die Zuordnung (kategorieBildPfad in
 * taxonomie.ts, Käufer-Vorschau im Produktdialog) — es bleibt EINE Zuordnung.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { CATEGORY_SLUGS, categoryImagePath } from '@/lib/product-image'
import { KATEGORIE_BILD_SLUG, PRODUCT_CATEGORY_VALUES, kategorieBildPfad } from '@/lib/taxonomie'

describe('categoryImagePath', () => {
  it('mappt Kategorien auf /categories/{slug}.webp, wenn die Datei existiert', () => {
    const exists = () => true
    expect(categoryImagePath('MILCH', exists)).toBe('/categories/milch.webp')
    expect(categoryImagePath('EIER', exists)).toBe('/categories/eier.webp')
    expect(categoryImagePath('GEMUESE', exists)).toBe('/categories/gemuese.webp')
    expect(categoryImagePath('BRENNHOLZ', exists)).toBe('/categories/brennholz.webp')
    expect(categoryImagePath('SONSTIGES', exists)).toBe('/categories/sonstiges.webp')
  })

  it('gibt null zurück, wenn die Asset-Datei fehlt', () => {
    expect(categoryImagePath('MILCH', () => false)).toBeNull()
  })

  it('gibt null zurück ohne Kategorie', () => {
    expect(categoryImagePath(null)).toBeNull()
    expect(categoryImagePath(undefined)).toBeNull()
  })

  it('prüft gegen das echte Dateisystem: vorhandene Assets liefern den Pfad, fehlende null', () => {
    // Seit dem Illustrationen-Commit existieren die 5 Kern-Assets …
    expect(categoryImagePath('MILCH')).toBe('/categories/milch.webp')
    // … die übrigen liefert der Betreiber nach und muss sie NUR ablegen —
    // deshalb entscheidet hier das Dateisystem, nicht eine feste Erwartung
    // (eine harte `null`-Erwartung bräche in dem Moment, in dem gemuese.webp
    // ankommt). Der Rückfall selbst steht oben mit `() => false` unter Test.
    const gemuese = fs.existsSync(path.join(process.cwd(), 'public', 'categories', 'gemuese.webp'))
    expect(categoryImagePath('GEMUESE')).toBe(gemuese ? '/categories/gemuese.webp' : null)
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

  it('fragt die Existenz mit dem relativen public-Pfad ab', () => {
    const seen: string[] = []
    categoryImagePath('HONIG', (p) => {
      seen.push(p)
      return false
    })
    expect(seen).toEqual(['categories/honig.webp'])
  })
})

describe('kategorieBildPfad — dieselbe Zuordnung im Browser (Käufer-Vorschau, Nr. 51)', () => {
  it('ergibt für jede Kategorie den Pfad, den der Server bei vorhandener Datei liefert', () => {
    for (const kategorie of PRODUCT_CATEGORY_VALUES) {
      expect(kategorieBildPfad(kategorie), kategorie).toBe(categoryImagePath(kategorie, () => true))
    }
  })

  it('ohne Kategorie kein Bild', () => {
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
