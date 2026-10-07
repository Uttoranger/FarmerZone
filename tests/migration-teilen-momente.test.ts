/**
 * Wache: Die Migration der Teilen-Momente (Nachtlauf Nr. 30) ist NUR Expand.
 *
 * freigabe.md §10 „30" erlaubt in Lauf 6 genau eine Migration, und nur
 * additiv: eine neue Spalte mit Default, nichts umbenennen, nichts entfernen,
 * keinen Typ ändern (ARCHITECTURE §5, Expand/Contract). Ein Push spielt sie
 * über den Vorschau-Build sofort ein — was hier steht, ist endgültig.
 *
 * Beweist:
 *  - kein DROP, kein RENAME, kein ALTER TYPE, kein ALTER COLUMN, kein
 *    SET NOT NULL, kein UPDATE/DELETE/TRUNCATE, keine neue Tabelle;
 *  - genau eine neue Spalte: Farm.teilenMomenteAus, BOOLEAN NOT NULL DEFAULT
 *    false, wiederholbar (IF NOT EXISTS), mit lock_timeout;
 *  - schema.prisma sagt dasselbe (@default(false));
 *  - Gegenprobe: Die Suche schlägt bei jeder verbotenen Form an.
 *
 * Reine Dateiarbeit — die Datenbank-Seite prüft
 * tests/integration/teilen-momente.int.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ORDNER = '20261007120000_teilen_momente_aus'
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

describe(`Migration ${ORDNER}: nur Expand`, () => {
  it('enthält nichts, was Bestehendes entfernt, umbenennt, im Typ ändert oder umschreibt', () => {
    expect(ohneKommentare(MIGRATION)).not.toMatch(VERBOTEN)
  })

  it('genau zwei Anweisungen: lock_timeout und eine neue Spalte mit Default, wiederholbar', () => {
    expect(anweisungen(MIGRATION)).toEqual([
      "SET lock_timeout = '5s'",
      'ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "teilenMomenteAus" BOOLEAN NOT NULL DEFAULT false',
    ])
  })

  it('schema.prisma: dieselbe Spalte mit @default(false) am Hof', () => {
    expect(SCHEMA).toMatch(/^\s*teilenMomenteAus\s+Boolean\s+@default\(false\)/m)
  })

  it('Gegenprobe: die Suche erkennt jede verbotene Form', () => {
    for (const sql of [
      'ALTER TABLE "Farm" DROP COLUMN "isPaused";',
      'ALTER TABLE "Farm" RENAME COLUMN "isPaused" TO "pausiert";',
      'ALTER TYPE "Tarif" RENAME VALUE \'HOFTOR\' TO \'TOR\';',
      'ALTER TABLE "Farm" ALTER COLUMN "teilenMomenteAus" TYPE TEXT;',
      'ALTER TABLE "Farm" ALTER COLUMN "tarif" SET NOT NULL;',
      'UPDATE "Farm" SET "teilenMomenteAus" = true;',
      'DELETE FROM "Farm";',
      'TRUNCATE "Farm";',
      'CREATE TABLE "Teilen" ("id" TEXT);',
    ]) {
      expect(sql, sql).toMatch(VERBOTEN)
    }
    // Ein Kommentar ist keine Anweisung.
    expect(ohneKommentare('-- Kein DROP, kein RENAME\nSELECT 1;')).not.toMatch(VERBOTEN)
  })
})
