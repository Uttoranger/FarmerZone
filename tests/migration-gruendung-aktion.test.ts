/**
 * Wache: Die Migration „Aktion 100 Gründungshöfe“ (Nachtlauf Nr. 116, Register
 * K2 geändert) ist NUR Expand und berührt nur Farm und PlattformEinstellung.
 *
 * Die Freigabe erlaubt: Farm.gruendungPlatz INTEGER (nullable, eindeutig),
 * Farm.gruendungAbzeichenZeigen BOOLEAN NOT NULL DEFAULT true,
 * PlattformEinstellung.gruendungMonate INTEGER NOT NULL DEFAULT 24,
 * gruendungAktionBis DATE und gruendungFestAm TIMESTAMP(3) nullable — kein
 * Backfill, keine Datenänderung (ARCHITECTURE §5). Ein Push spielt sie über den
 * Vorschau-Build sofort ein — was hier steht, ist endgültig.
 *
 * Reine Dateiarbeit — die Datenbank-Seite prüft
 * tests/integration/gruendung-aktion.int.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ORDNER = '20261019200000_gruendung_aktion'
const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', ORDNER, 'migration.sql'), 'utf8')
const SCHEMA = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

/** Was eine Expand-Migration nie tut. Geprüft wird der SQL-Text ohne Kommentare. */
const VERBOTEN =
  /\bDROP\b|\bRENAME\b|ALTER\s+TYPE|ALTER\s+COLUMN|SET\s+NOT\s+NULL|SET\s+DATA\s+TYPE|^\s*UPDATE\b|^\s*DELETE\b|^\s*INSERT\b|\bTRUNCATE\b|CREATE\s+TABLE|FOREIGN\s+KEY|REFERENCES/im

function ohneKommentare(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((zeile) => zeile.replace(/--.*$/, ''))
    .join('\n')
}

function anweisungen(sql: string): string[] {
  return ohneKommentare(sql)
    .split(';')
    .map((teil) => teil.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function modell(schema: string, name: string): string {
  const start = schema.indexOf(`model ${name} {`)
  return schema.slice(start, schema.indexOf('\n}', start))
}

describe(`Migration ${ORDNER}: nur Expand`, () => {
  it('enthält nichts, was Bestehendes entfernt, umbenennt, umschreibt, Zeilen schreibt oder verknüpft', () => {
    expect(ohneKommentare(MIGRATION)).not.toMatch(VERBOTEN)
  })

  it('genau vier Anweisungen: lock_timeout, zwei ALTER TABLE mit neuen Spalten (Pflichtspalten mit Default) und der eindeutige Index, alles wiederholbar', () => {
    expect(anweisungen(MIGRATION)).toEqual([
      "SET lock_timeout = '5s'",
      'ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "gruendungAbzeichenZeigen" BOOLEAN NOT NULL DEFAULT true, ' +
        'ADD COLUMN IF NOT EXISTS "gruendungPlatz" INTEGER',
      'ALTER TABLE "PlattformEinstellung" ADD COLUMN IF NOT EXISTS "gruendungAktionBis" DATE, ' +
        'ADD COLUMN IF NOT EXISTS "gruendungFestAm" TIMESTAMP(3), ' +
        'ADD COLUMN IF NOT EXISTS "gruendungMonate" INTEGER NOT NULL DEFAULT 24',
      'CREATE UNIQUE INDEX IF NOT EXISTS "Farm_gruendungPlatz_key" ON "Farm"("gruendungPlatz")',
    ])
  })

  it('schema.prisma: dieselben Spalten an Hof und Einstellung', () => {
    const farm = modell(SCHEMA, 'Farm')
    expect(farm).toMatch(/^\s*gruendungPlatz\s+Int\?\s+@unique\s*$/m)
    expect(farm).toMatch(/^\s*gruendungAbzeichenZeigen\s+Boolean\s+@default\(true\)\s*$/m)
    const einstellung = modell(SCHEMA, 'PlattformEinstellung')
    expect(einstellung).toMatch(/^\s*gruendungMonate\s+Int\s+@default\(24\)\s*$/m)
    expect(einstellung).toMatch(/^\s*gruendungAktionBis\s+DateTime\?\s+@db\.Date\s*$/m)
    expect(einstellung).toMatch(/^\s*gruendungFestAm\s+DateTime\?\s*$/m)
  })

  it('Gegenprobe: die Suche erkennt jede verbotene Form', () => {
    for (const sql of [
      'ALTER TABLE "Farm" DROP COLUMN "gruendungBis";',
      'ALTER TABLE "PlattformEinstellung" ALTER COLUMN "gruendungPlaetze" SET DEFAULT 100;',
      'UPDATE "PlattformEinstellung" SET "gruendungFestAm" = now();',
      'INSERT INTO "PlattformEinstellung" ("id") VALUES (\'plattform\');',
      'CREATE TABLE "Aktion" ("id" TEXT);',
    ]) {
      expect(sql, sql).toMatch(VERBOTEN)
    }
    expect(ohneKommentare('-- Kein DROP, kein UPDATE\nSELECT 1;')).not.toMatch(VERBOTEN)
  })
})
