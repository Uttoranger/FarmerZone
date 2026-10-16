/**
 * Wache: Die Migration „Testhöfe ausnehmen“ (Nachtlauf Nr. 109, Register K2)
 * ist NUR Expand.
 *
 * Die Freigabe erlaubt genau drei Spalten an Farm: gruendungAusgenommen
 * BOOLEAN NOT NULL DEFAULT false (Default = zählt wie bisher), dazu
 * gruendungGeaendertAm und gruendungGeaendertVonUserId nullable, ohne
 * Fremdschlüssel, ohne Backfill (ARCHITECTURE §5). Ein Push spielt sie über
 * den Vorschau-Build sofort ein — was hier steht, ist endgültig.
 *
 * Reine Dateiarbeit — die Datenbank-Seite prüft
 * tests/integration/gruendung-ausgenommen.int.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ORDNER = '20261016120000_gruendung_ausgenommen'
const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', ORDNER, 'migration.sql'), 'utf8')
const SCHEMA = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

/** Was eine Expand-Migration nie tut. Geprüft wird der SQL-Text ohne Kommentare. */
const VERBOTEN =
  /\bDROP\b|\bRENAME\b|ALTER\s+TYPE|ALTER\s+COLUMN|SET\s+NOT\s+NULL|SET\s+DATA\s+TYPE|^\s*UPDATE\b|^\s*DELETE\b|\bTRUNCATE\b|CREATE\s+TABLE|FOREIGN\s+KEY|REFERENCES/im

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

function farmModell(schema: string): string {
  const start = schema.indexOf('model Farm {')
  return schema.slice(start, schema.indexOf('\n}', start))
}

describe(`Migration ${ORDNER}: nur Expand`, () => {
  it('enthält nichts, was Bestehendes entfernt, umbenennt, umschreibt oder verknüpft', () => {
    expect(ohneKommentare(MIGRATION)).not.toMatch(VERBOTEN)
  })

  it('genau zwei Anweisungen: lock_timeout und drei neue Spalten, wiederholbar, die Pflichtspalte mit Default false', () => {
    expect(anweisungen(MIGRATION)).toEqual([
      "SET lock_timeout = '5s'",
      'ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "gruendungAusgenommen" BOOLEAN NOT NULL DEFAULT false, ' +
        'ADD COLUMN IF NOT EXISTS "gruendungGeaendertAm" TIMESTAMP(3), ' +
        'ADD COLUMN IF NOT EXISTS "gruendungGeaendertVonUserId" TEXT',
    ])
  })

  it('schema.prisma: dieselben Spalten am Hof, ohne Relation', () => {
    const farm = farmModell(SCHEMA)
    expect(farm).toMatch(/^\s*gruendungAusgenommen\s+Boolean\s+@default\(false\)\s*$/m)
    expect(farm).toMatch(/^\s*gruendungGeaendertAm\s+DateTime\?\s*$/m)
    expect(farm).toMatch(/^\s*gruendungGeaendertVonUserId\s+String\?\s*$/m)
  })

  it('Gegenprobe: die Suche erkennt jede verbotene Form', () => {
    for (const sql of [
      'ALTER TABLE "Farm" DROP COLUMN "gruendungBis";',
      'ALTER TABLE "Farm" ALTER COLUMN "gruendungAusgenommen" SET DEFAULT true;',
      'UPDATE "Farm" SET "gruendungAusgenommen" = true;',
      'ALTER TABLE "Farm" ADD CONSTRAINT "x" FOREIGN KEY ("gruendungGeaendertVonUserId") REFERENCES "user"("id");',
      'CREATE TABLE "Ausnahme" ("id" TEXT);',
    ]) {
      expect(sql, sql).toMatch(VERBOTEN)
    }
    expect(ohneKommentare('-- Kein DROP, kein UPDATE\nSELECT 1;')).not.toMatch(VERBOTEN)
  })
})
