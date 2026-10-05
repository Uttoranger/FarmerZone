/**
 * Schema-Expand Redesign (Gate 3, Nachtlauf Nr. 06) — was die Datenbank schon
 * kennt, darf die App noch nicht anbieten.
 *
 * Beweist:
 *   1. Die neuen Einheiten RAUMMETER/SCHUETTRAUMMETER und die vorbereiteten
 *      Brennmaterial-Arten stehen im Prisma-Enum, aber kein Formular bietet sie
 *      an und Zod nimmt sie nicht an — keine Verhaltensänderung vor Gate 6.
 *   2. Ein Link mit einer vorbereiteten Sorte filtert auf /hoefe nichts.
 *   3. TeilenAufruf hält nur Zähler: keine Spalte für Personen-, Geräte- oder
 *      IP-Daten (Invariante aus docs/umsetzungsprompt.md §5, S8) — mit
 *      Gegenprobe, dass die Suche anschlägt.
 *   4. Die Migration ist rein additiv (kein DROP, kein ALTER COLUMN, kein
 *      Umschreiben von Bestandszeilen) — mit Gegenprobe.
 *
 * Reine Dateiarbeit und Zod, keine Datenbank. Die Datenbank-Seite prüft
 * tests/integration/schema-expand.int.test.ts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { productFormSchema, unitOptionsFuer, PRODUCT_UNIT_VALUES, UNIT_OPTIONS } from '@/schemas/product'
import { leseHoefeFilter } from '@/schemas/hoefe-filter'
import { hatUnterkategorien, unterkategorienVon, VORBEREITETE_UNTERKATEGORIEN } from '@/lib/taxonomie'

const SCHEMA = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), 'prisma', 'migrations', '20261005120000_schema_expand_redesign', 'migration.sql'),
  'utf8'
)

/** Der Rumpf eines Blocks (`enum X {…}` oder `model X {…}`) ohne Kommentare. */
function block(art: 'enum' | 'model', name: string, quelle: string = SCHEMA): string[] {
  const treffer = quelle.match(new RegExp(`${art} ${name} \\{([^}]*)\\}`))
  if (!treffer) throw new Error(`${art} ${name} nicht gefunden`)
  return treffer[1]
    .split(/\r?\n/)
    .map((zeile) => zeile.replace(/\/\/.*$/, '').trim())
    .filter((zeile) => zeile !== '')
}

const NEUE_EINHEITEN = ['RAUMMETER', 'SCHUETTRAUMMETER'] as const

describe('Neue Einheiten: in der Datenbank, noch nicht wählbar', () => {
  it('stehen im Prisma-Enum ProductUnit', () => {
    expect(block('enum', 'ProductUnit')).toEqual(expect.arrayContaining([...NEUE_EINHEITEN]))
  })

  it('stehen weder in den Formular-Optionen noch in den von Zod angenommenen Werten', () => {
    const angenommen: readonly string[] = PRODUCT_UNIT_VALUES
    const optionen = UNIT_OPTIONS.map((u): string => u.value)
    const brennholz = unitOptionsFuer('BRENNHOLZ').map((u): string => u.value)
    for (const einheit of NEUE_EINHEITEN) {
      expect(angenommen).not.toContain(einheit)
      expect(optionen).not.toContain(einheit)
      expect(brennholz).not.toContain(einheit)
    }
  })

  it('ein Brennholz-Produkt in Raummetern wird abgelehnt', () => {
    const r = productFormSchema.safeParse({ name: 'Buche', price: 129, unit: 'RAUMMETER', category: 'BRENNHOLZ' })
    expect(r.success).toBe(false)
  })

  it('Gegenprobe: dasselbe Produkt im Big Bag ist gültig', () => {
    const r = productFormSchema.safeParse({ name: 'Buche', price: 129, unit: 'BIGBAG', category: 'BRENNHOLZ' })
    expect(r.success).toBe(true)
  })
})

describe('Vorbereitete Brennmaterial-Arten: in der Datenbank, noch nicht wählbar', () => {
  it('stehen im Prisma-Enum ProductSubcategory', () => {
    expect(block('enum', 'ProductSubcategory')).toEqual(expect.arrayContaining([...VORBEREITETE_UNTERKATEGORIEN]))
  })

  it('Brennholz hat weiterhin keine Unterkategorien — kein Hinweis, keine Auswahl', () => {
    expect(hatUnterkategorien('BRENNHOLZ')).toBe(false)
    expect(unterkategorienVon('BRENNHOLZ')).toEqual([])
  })

  it.each(VORBEREITETE_UNTERKATEGORIEN)('Zod lehnt Brennholz mit %s ab', (l2) => {
    const r = productFormSchema.safeParse({
      name: 'Buche', price: 99, unit: 'BIGBAG', category: 'BRENNHOLZ', subcategory: l2,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues.map((i) => i.path.join('.'))).toContain('subcategory')
  })

  it('ein Link mit einer vorbereiteten Sorte filtert auf /hoefe nichts', () => {
    const filter = leseHoefeFilter(new URLSearchParams('kat=BRENNHOLZ&sorte=HACKSCHNITZEL'))
    expect(filter.kategorien).toEqual(['BRENNHOLZ'])
    expect(filter.sorten).toEqual([])
  })
})

describe('TeilenAufruf hält nur Zähler (S8)', () => {
  // Was die Tabelle tragen darf: Schlüssel, Hof, Kanal, Kalendertag, zwei Zähler.
  const ERLAUBT = ['id', 'farmId', 'kanal', 'tag', 'besuche', 'bestellungen', 'farm']
  const VERDAECHTIG = /ip|user|session|email|phone|telefon|geraet|device|agent|cookie|name|customer|kunde/i

  function felder(rumpf: string[]): string[] {
    return rumpf.filter((zeile) => !zeile.startsWith('@@')).map((zeile) => zeile.split(/\s+/)[0])
  }

  it('hat genau die erlaubten Felder und keines mit Personen-, Geräte- oder IP-Bezug', () => {
    const vorhanden = felder(block('model', 'TeilenAufruf'))
    expect(vorhanden.sort()).toEqual([...ERLAUBT].sort())
    expect(vorhanden.filter((f) => VERDAECHTIG.test(f))).toEqual([])
  })

  it('Gegenprobe: die Suche erkennt ein Feld mit Personenbezug', () => {
    const mitIp = `model TeilenAufruf {\n  id String @id\n  ipAddress String\n  customerEmail String\n}`
    const vorhanden = felder(block('model', 'TeilenAufruf', mitIp))
    expect(vorhanden.filter((f) => VERDAECHTIG.test(f))).toEqual(['ipAddress', 'customerEmail'])
  })

  it('Order bekommt nur den Kanal, keine Kennung', () => {
    const order = felder(block('model', 'Order'))
    expect(order).toContain('teilenKanal')
    expect(order.filter((f) => /teilen/i.test(f))).toEqual(['teilenKanal'])
  })
})

describe('Die Migration ist rein additiv', () => {
  // Was eine Expand-Migration nie tut: löschen, umbenennen, Typ ändern,
  // NOT NULL nachziehen, Bestandszeilen umschreiben.
  const VERBOTEN = /\bDROP\b|\bRENAME\b|ALTER\s+COLUMN|SET\s+NOT\s+NULL|^\s*UPDATE\b|^\s*DELETE\b|\bTRUNCATE\b/im

  function ohneKommentare(sql: string): string {
    return sql
      .split(/\r?\n/)
      .map((zeile) => zeile.replace(/--.*$/, ''))
      .join('\n')
  }

  it('enthält nichts, was Bestehendes entfernt, ändert oder umschreibt', () => {
    expect(ohneKommentare(MIGRATION)).not.toMatch(VERBOTEN)
  })

  it('jede neue Spalte an einer bestehenden Tabelle ist nullable oder hat einen Default', () => {
    const neueSpalten = ohneKommentare(MIGRATION).match(/ADD COLUMN IF NOT EXISTS[^;]*;/g) ?? []
    expect(neueSpalten.length).toBeGreaterThan(0)
    for (const spalte of neueSpalten) {
      if (/NOT NULL/.test(spalte)) expect(spalte, spalte).toMatch(/DEFAULT/)
    }
  })

  it('Gegenprobe: die Suche erkennt DROP, ALTER COLUMN und ein UPDATE', () => {
    expect(`ALTER TABLE "Order" DROP COLUMN "x";`).toMatch(VERBOTEN)
    expect(`ALTER TABLE "Order" ALTER COLUMN "x" TYPE TEXT;`).toMatch(VERBOTEN)
    expect(`UPDATE "Farm" SET "tarif" = 'HOFTOR';`).toMatch(VERBOTEN)
  })
})
