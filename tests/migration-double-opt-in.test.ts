/**
 * Wache: Die Migration des Double-Opt-in (Register S11, Nachtlauf Nr. 38) ist
 * NUR Expand.
 *
 * freigabe.md §11 „38" erlaubt eine Migration, nur additiv: zwei neue,
 * nullable Spalten am Abo, nichts umbenennen, nichts entfernen, keinen Typ
 * ändern, keine Bestandszeile anfassen (ARCHITECTURE §5, Expand/Contract).
 * Ein Push spielt sie über den Vorschau-Build sofort ein — was hier steht,
 * ist endgültig.
 *
 * Reine Dateiarbeit — die Datenbank-Seite prüft
 * tests/integration/double-opt-in.int.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ORDNER = '20261007180000_double_opt_in'
const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', ORDNER, 'migration.sql'), 'utf8')
const SCHEMA = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

/** Was eine Expand-Migration nie tut. Geprüft wird der SQL-Text ohne Kommentare. */
const VERBOTEN =
  /\bDROP\b|\bRENAME\b|ALTER\s+TYPE|ALTER\s+COLUMN|NOT\s+NULL|SET\s+DATA\s+TYPE|^\s*UPDATE\b|^\s*DELETE\b|\bTRUNCATE\b|CREATE\s+TABLE/im

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

describe(`Migration ${ORDNER}: nur Expand`, () => {
  it('enthält nichts, was Bestehendes entfernt, umbenennt, im Typ ändert, Pflicht macht oder umschreibt', () => {
    expect(ohneKommentare(MIGRATION)).not.toMatch(VERBOTEN)
  })

  it('genau drei Anweisungen: lock_timeout und zwei nullable Spalten, wiederholbar', () => {
    expect(anweisungen(MIGRATION)).toEqual([
      "SET lock_timeout = '5s'",
      'ALTER TABLE "CustomerFarmSubscription" ADD COLUMN IF NOT EXISTS "emailOptInAngefragtAm" TIMESTAMP(3)',
      'ALTER TABLE "CustomerFarmSubscription" ADD COLUMN IF NOT EXISTS "emailOptInBestaetigtAm" TIMESTAMP(3)',
    ])
  })

  it('schema.prisma: dieselben Spalten, optional, ohne Default', () => {
    expect(SCHEMA).toMatch(/^\s*emailOptInAngefragtAm\s+DateTime\?\s*$/m)
    expect(SCHEMA).toMatch(/^\s*emailOptInBestaetigtAm\s+DateTime\?\s*$/m)
  })

  it('liegt nach allen älteren Migrationen', () => {
    expect(ORDNER > '20261007120000_teilen_momente_aus').toBe(true)
  })

  it('Gegenprobe: die Suche erkennt jede verbotene Form', () => {
    for (const sql of [
      'ALTER TABLE "CustomerFarmSubscription" DROP COLUMN "optInEmail";',
      'ALTER TABLE "CustomerFarmSubscription" RENAME COLUMN "optInEmail" TO "email";',
      'ALTER TABLE "CustomerFarmSubscription" ALTER COLUMN "optInEmail" TYPE TEXT;',
      'ALTER TABLE "CustomerFarmSubscription" ADD COLUMN "x" TIMESTAMP(3) NOT NULL;',
      'UPDATE "CustomerFarmSubscription" SET "optInEmail" = false;',
      'DELETE FROM "CustomerFarmSubscription";',
      'TRUNCATE "CustomerFarmSubscription";',
      'CREATE TABLE "Abo" ("id" TEXT);',
    ]) {
      expect(sql, sql).toMatch(VERBOTEN)
    }
    expect(ohneKommentare('-- Kein DROP, kein UPDATE\nSELECT 1;')).not.toMatch(VERBOTEN)
  })
})
