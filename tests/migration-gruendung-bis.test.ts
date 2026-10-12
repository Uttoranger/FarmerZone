/**
 * Wache: Die Migration des Gründungs-Enddatums (Nachtlauf Nr. 62, Register K2)
 * ist NUR Expand.
 *
 * Die Freigabe erlaubt genau eine Spalte: Farm.gruendungBis vom Typ DATE,
 * nullable, ohne Default, ohne Backfill und ohne jede andere Schema-Änderung
 * (ARCHITECTURE §5). Ein Push spielt sie über den Vorschau-Build sofort ein —
 * was hier steht, ist endgültig.
 *
 * Beweist:
 *  - kein DROP, kein RENAME, kein ALTER TYPE, kein ALTER COLUMN, kein
 *    SET NOT NULL, kein UPDATE/DELETE/TRUNCATE, keine neue Tabelle;
 *  - genau eine neue Spalte: Farm.gruendungBis DATE, ohne NOT NULL und ohne
 *    DEFAULT (null = Standard), wiederholbar (IF NOT EXISTS), mit lock_timeout;
 *  - schema.prisma sagt dasselbe (DateTime? @db.Date, kein @default);
 *  - Gegenprobe: Die Suche schlägt bei jeder verbotenen Form an.
 *
 * Reine Dateiarbeit — die Datenbank-Seite prüft
 * tests/integration/gruendung-bis.int.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ORDNER = '20261012120000_gruendung_bis'
const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', ORDNER, 'migration.sql'), 'utf8')
const SCHEMA = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

/** Was eine Expand-Migration nie tut. Geprüft wird der SQL-Text ohne Kommentare. */
const VERBOTEN =
  /\bDROP\b|\bRENAME\b|ALTER\s+TYPE|ALTER\s+COLUMN|SET\s+NOT\s+NULL|SET\s+DATA\s+TYPE|^\s*UPDATE\b|^\s*DELETE\b|\bTRUNCATE\b|CREATE\s+TABLE/im

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

/** Der Block des Modells Farm in schema.prisma. */
function farmModell(schema: string): string {
  const start = schema.indexOf('model Farm {')
  return schema.slice(start, schema.indexOf('\n}', start))
}

describe(`Migration ${ORDNER}: nur Expand`, () => {
  it('enthält nichts, was Bestehendes entfernt, umbenennt, im Typ ändert oder umschreibt', () => {
    expect(ohneKommentare(MIGRATION)).not.toMatch(VERBOTEN)
  })

  it('genau zwei Anweisungen: lock_timeout und eine neue DATE-Spalte ohne Default, wiederholbar', () => {
    expect(anweisungen(MIGRATION)).toEqual([
      "SET lock_timeout = '5s'",
      'ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "gruendungBis" DATE',
    ])
  })

  it('schema.prisma: dieselbe Spalte am Hof, nullable, ohne @default', () => {
    expect(farmModell(SCHEMA)).toMatch(/^\s*gruendungBis\s+DateTime\?\s+@db\.Date\s*$/m)
  })

  it('Gegenprobe: die Suche erkennt jede verbotene Form', () => {
    for (const sql of [
      'ALTER TABLE "Farm" DROP COLUMN "isPaused";',
      'ALTER TABLE "Farm" RENAME COLUMN "isPaused" TO "pausiert";',
      'ALTER TYPE "Tarif" RENAME VALUE \'HOFTOR\' TO \'TOR\';',
      'ALTER TABLE "Farm" ALTER COLUMN "gruendungBis" TYPE TEXT;',
      'ALTER TABLE "Farm" ALTER COLUMN "gruendungBis" SET NOT NULL;',
      'UPDATE "Farm" SET "gruendungBis" = \'2027-12-31\';',
      'DELETE FROM "Farm";',
      'TRUNCATE "Farm";',
      'CREATE TABLE "Gruendung" ("id" TEXT);',
    ]) {
      expect(sql, sql).toMatch(VERBOTEN)
    }
    // Ein Kommentar ist keine Anweisung.
    expect(ohneKommentare('-- Kein DROP, kein UPDATE\nSELECT 1;')).not.toMatch(VERBOTEN)
    // Die Spalten-Prüfung schlägt bei Default oder Pflichtfeld an.
    for (const zeile of ['  gruendungBis DateTime @db.Date', '  gruendungBis DateTime? @default(now()) @db.Date']) {
      expect(`model Farm {\n${zeile}\n}`, zeile).not.toMatch(/^\s*gruendungBis\s+DateTime\?\s+@db\.Date\s*$/m)
    }
  })
})
