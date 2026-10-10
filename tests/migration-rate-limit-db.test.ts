/**
 * Wache: Die Migration der Bremse über alle Instanzen (Register R1,
 * Nachtlauf Nr. 40) ist NUR Expand.
 *
 * freigabe.md §11 „40" erlaubt eine Migration, nur additiv: eine neue Tabelle
 * mit Schlüssel, Fenster und Zähler (ARCHITECTURE §5, Expand/Contract). Ein
 * Push spielt sie über den Vorschau-Build sofort ein — was hier steht, ist
 * endgültig.
 *
 * Beweist:
 *  - kein DROP, kein RENAME, kein ALTER TYPE/COLUMN, kein SET NOT NULL, kein
 *    UPDATE/DELETE/TRUNCATE, keine Änderung an einer bestehenden Tabelle;
 *  - genau: lock_timeout, eine neue Tabelle (wiederholbar), ein Index
 *    (wiederholbar), RLS an der neuen Tabelle;
 *  - die Tabelle hat keine Spalte für IP, Adresse, Sitzung oder Gerät;
 *  - schema.prisma sagt dasselbe;
 *  - Gegenprobe: Die Suche schlägt bei jeder verbotenen Form an.
 *
 * Reine Dateiarbeit — die Datenbank-Seite prüft
 * tests/integration/bremse-datenbank.int.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ORDNER = '20261007200000_rate_limit_db'
const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', ORDNER, 'migration.sql'), 'utf8')
const SCHEMA = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

/** Was eine Expand-Migration nie tut. Geprüft wird der SQL-Text ohne Kommentare. */
const VERBOTEN =
  /\bDROP\b|\bRENAME\b|ALTER\s+TYPE|ALTER\s+COLUMN|SET\s+NOT\s+NULL|SET\s+DATA\s+TYPE|^\s*UPDATE\b|^\s*DELETE\b|\bTRUNCATE\b|ADD\s+COLUMN/im

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

  it('genau vier Anweisungen: lock_timeout, neue Tabelle, Index, RLS — wiederholbar', () => {
    expect(anweisungen(MIGRATION)).toEqual([
      "SET lock_timeout = '5s'",
      'CREATE TABLE IF NOT EXISTS "RateLimitZaehler" ( "schluessel" TEXT NOT NULL, "fensterStart" TIMESTAMP(3) NOT NULL, "zaehler" INTEGER NOT NULL DEFAULT 0, "ablauf" TIMESTAMP(3) NOT NULL, CONSTRAINT "RateLimitZaehler_pkey" PRIMARY KEY ("schluessel","fensterStart") )',
      'CREATE INDEX IF NOT EXISTS "RateLimitZaehler_ablauf_idx" ON "RateLimitZaehler"("ablauf")',
      'ALTER TABLE "public"."RateLimitZaehler" ENABLE ROW LEVEL SECURITY',
    ])
  })

  it('keine Spalte für IP, Adresse, Sitzung oder Gerät — der Schlüssel ist ein HMAC', () => {
    expect(ohneKommentare(MIGRATION)).not.toMatch(/"(ip|ipAdresse|email|adresse|sessionId|sitzung|userAgent)"/i)
  })

  it('schema.prisma: dasselbe Modell mit zusammengesetztem Schlüssel und Index auf ablauf', () => {
    const modell = SCHEMA.match(/model RateLimitZaehler \{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(modell).toMatch(/^\s*schluessel\s+String\s*$/m)
    expect(modell).toMatch(/^\s*fensterStart\s+DateTime\s*$/m)
    expect(modell).toMatch(/^\s*zaehler\s+Int\s+@default\(0\)\s*$/m)
    expect(modell).toMatch(/^\s*ablauf\s+DateTime\s*$/m)
    expect(modell).toMatch(/@@id\(\[schluessel, fensterStart\]\)/)
    expect(modell).toMatch(/@@index\(\[ablauf\]\)/)
  })

  it('Gegenprobe: die Suche erkennt jede verbotene Form', () => {
    for (const sql of [
      'ALTER TABLE "Farm" DROP COLUMN "isPaused";',
      'ALTER TABLE "Farm" RENAME COLUMN "isPaused" TO "pausiert";',
      'ALTER TYPE "Tarif" RENAME VALUE \'HOFTOR\' TO \'TOR\';',
      'ALTER TABLE "RateLimitZaehler" ALTER COLUMN "zaehler" TYPE BIGINT;',
      'ALTER TABLE "Farm" ALTER COLUMN "tarif" SET NOT NULL;',
      'UPDATE "Farm" SET "isPaused" = true;',
      'DELETE FROM "Farm";',
      'TRUNCATE "Farm";',
      'ALTER TABLE "Farm" ADD COLUMN "neu" TEXT;',
    ]) {
      expect(sql, sql).toMatch(VERBOTEN)
    }
    // Ein Kommentar ist keine Anweisung.
    expect(ohneKommentare('-- Kein DROP, kein RENAME\nSELECT 1;')).not.toMatch(VERBOTEN)
  })
})
