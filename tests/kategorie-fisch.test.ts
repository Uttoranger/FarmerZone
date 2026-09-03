/**
 * Tests für die Kategorie FISCH (Sprint kategorie-fisch).
 *
 * Beweist: FISCH steht im Prisma-Schema, in der Wertliste und in der
 * Anzeigeliste UNMITTELBAR nach FLEISCH — und alle drei haben dieselbe
 * Reihenfolge (die Filterleiste auf /hoefe und das Produktformular leiten
 * sich aus CATEGORY_OPTIONS ab, die Hofübersicht sortiert nach
 * PRODUCT_CATEGORY_VALUES). Der Anzeigename ist schlicht „Fisch". Die
 * Illustrationszuordnung kennt fisch.webp und fällt ohne Datei STILL auf
 * null zurück — kein gebrochenes Bild, kein Eintrag im Log.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CATEGORY_OPTIONS, PRODUCT_CATEGORY_VALUES, productFormSchema } from '@/schemas/product'
import type { ProductCategoryValue } from '@/schemas/product'
import { categoryImagePath } from '@/lib/product-image'
import { sammleKategorien } from '@/lib/hofuebersicht'

/** Die Enum-Werte aus prisma/schema.prisma in Dateireihenfolge — die Quelle,
 *  an der sich pg_enum.enumsortorder und damit die Migration orientieren. */
function schemaEnumWerte(): string[] {
  const schema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
  const block = schema.match(/enum ProductCategory \{([^}]*)\}/)
  if (!block) throw new Error('enum ProductCategory nicht in prisma/schema.prisma gefunden')
  return block[1]
    .split('\n')
    // Nachgestellte Kommentare wie bei OrderStatus (`PAID // bezahlt`) abstreifen
    .map((zeile) => zeile.replace(/\/\/.*$/, '').trim())
    .filter((zeile) => zeile !== '')
}

/** Das SQL der Migration dieses Sprints — die einzige Stelle, die die
 *  Datenbank wirklich verändert, und deshalb hier festgenagelt. */
function migrationsSql(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'prisma', 'migrations', '20260903142727_kategorie_fisch', 'migration.sql'),
    'utf8'
  )
}

/** Die Kategorien, für die der Betreiber die Illustration noch liefert. */
const NOCH_OHNE_DATEI = ['FISCH', 'GEMUESE', 'OBST', 'BROT', 'HONIG', 'GETRAENKE'] as const

describe('Kategorie FISCH — Reihenfolge', () => {
  it('steht im Prisma-Schema unmittelbar nach FLEISCH', () => {
    const werte = schemaEnumWerte()
    expect(werte).toContain('FISCH')
    expect(werte.indexOf('FISCH')).toBe(werte.indexOf('FLEISCH') + 1)
  })

  it('Schema, Wertliste und Anzeigeliste haben DIESELBE Reihenfolge', () => {
    expect([...PRODUCT_CATEGORY_VALUES]).toEqual(schemaEnumWerte())
    expect(CATEGORY_OPTIONS.map((o) => o.value)).toEqual([...PRODUCT_CATEGORY_VALUES])
  })

  it('elf Werte, FISCH an vierter Stelle — direkt nach FLEISCH', () => {
    expect(PRODUCT_CATEGORY_VALUES).toHaveLength(11)
    expect(PRODUCT_CATEGORY_VALUES[2]).toBe('FLEISCH')
    expect(PRODUCT_CATEGORY_VALUES[3]).toBe('FISCH')
    expect(PRODUCT_CATEGORY_VALUES[4]).toBe('GEMUESE')
  })

  it('die Migration fügt FISCH wiederholbar und unmittelbar nach FLEISCH ein — und schreibt keine Produkte um', () => {
    const sql = migrationsSql()
      .split('\n')
      .filter((zeile) => !zeile.trimStart().startsWith('--'))
      .join('\n')
    expect(sql).toMatch(
      /ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'FISCH' AFTER 'FLEISCH';/
    )
    expect(sql).toMatch(/SET lock_timeout/)
    // BEWUSST NICHT: keine Datenmigration FLEISCH → FISCH, keine weiteren Werte
    expect(sql).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/i)
    expect(sql.match(/ADD VALUE/g)).toHaveLength(1)
  })

  it('die Hofübersicht reiht FISCH nach FLEISCH, egal wie die Produkte kommen', () => {
    const kategorien = sammleKategorien(
      [{ category: 'GEMUESE' }, { category: 'FISCH' }, { category: null }, { category: 'FLEISCH' }],
      PRODUCT_CATEGORY_VALUES
    )
    expect(kategorien).toEqual(['FLEISCH', 'FISCH', 'GEMUESE'])
  })
})

describe('Kategorie FISCH — Anzeigename', () => {
  it('heißt schlicht „Fisch"', () => {
    expect(CATEGORY_OPTIONS.find((o) => o.value === 'FISCH')?.label).toBe('Fisch')
  })

  it('genau EINE Option trägt „Fisch" im Namen — Fleisch & Wurst bleibt unverändert', () => {
    const mitFisch = CATEGORY_OPTIONS.filter((o) => /fisch/i.test(o.label))
    expect(mitFisch.map((o) => o.value)).toEqual(['FISCH'])
    expect(CATEGORY_OPTIONS.find((o) => o.value === 'FLEISCH')?.label).toBe('Fleisch & Wurst')
  })

  it('das Produktformular nimmt FISCH an', () => {
    const parsed = productFormSchema.parse({ name: 'Wels', price: 18, unit: 'KG', category: 'FISCH' })
    expect(parsed.category).toBe('FISCH')
  })
})

describe('Kategorie FISCH — Illustration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liefert /categories/fisch.webp, sobald die Datei da ist — und fragt genau diesen Pfad ab', () => {
    const gesehen: string[] = []
    const pfad = categoryImagePath('FISCH', (p) => {
      gesehen.push(p)
      return true
    })
    expect(pfad).toBe('/categories/fisch.webp')
    expect(gesehen).toEqual(['categories/fisch.webp'])
  })

  it('fällt ohne Datei auf null zurück (Rückfall statt gebrochenem Bild)', () => {
    expect(categoryImagePath('FISCH', () => false)).toBeNull()
  })

  it('die noch fehlenden Kategorien haben bereits ihren Dateinamen — Bild nur noch ablegen', () => {
    for (const kategorie of NOCH_OHNE_DATEI) {
      expect(categoryImagePath(kategorie, () => true)).toBe(
        `/categories/${kategorie.toLowerCase()}.webp`
      )
    }
  })

  it('alle elf Kategorien haben eine Zuordnung — keine läuft ins Leere', () => {
    for (const kategorie of PRODUCT_CATEGORY_VALUES) {
      expect(categoryImagePath(kategorie as ProductCategoryValue, () => true)).toMatch(
        /^\/categories\/[a-z]+\.webp$/
      )
    }
  })

  it('echtes Dateisystem: fehlende Datei → null, vorhandene → Pfad; nichts landet im Log', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {})

    for (const kategorie of PRODUCT_CATEGORY_VALUES) {
      const datei = path.join(process.cwd(), 'public', 'categories', `${kategorie.toLowerCase()}.webp`)
      const erwartet = fs.existsSync(datei) ? `/categories/${kategorie.toLowerCase()}.webp` : null
      expect(categoryImagePath(kategorie)).toBe(erwartet)
    }
    // Heute (Stand dieses Sprints) liegt fisch.webp noch nicht vor — die
    // Prüfung oben bleibt aber auch dann richtig, wenn der Betreiber die
    // Datei abgelegt hat: dann liefert sie den Pfad.
    expect(fehler).not.toHaveBeenCalled()
    expect(warnung).not.toHaveBeenCalled()
  })
})
