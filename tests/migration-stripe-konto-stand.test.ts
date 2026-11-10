/**
 * Wache: Die Migration des Stripe-Kontostatus (Auftrag A012) ist NUR Expand.
 *
 * Der Auftrag erlaubt genau eine Migration mit zwei nullbaren Spalten an
 * Farm, ohne Default, ohne Backfill, ohne Index (ARCHITECTURE §5,
 * Expand/Contract). Ein Push spielt sie über den Vorschau-Build sofort ein —
 * was hier steht, ist endgültig.
 *
 * Beweist:
 *  - kein DROP, kein RENAME, kein ALTER TYPE, kein ALTER COLUMN, kein
 *    SET NOT NULL, kein UPDATE/DELETE/TRUNCATE, keine neue Tabelle, kein
 *    Index, kein DEFAULT;
 *  - genau zwei neue Spalten: Farm.stripeKontoGelesenAm TIMESTAMP(3) und
 *    Farm.stripeKontoStand TEXT, beide nullbar, wiederholbar (IF NOT EXISTS),
 *    mit lock_timeout;
 *  - schema.prisma sagt dasselbe (String? und DateTime?, ohne @default);
 *  - Gegenprobe: Die Suche schlägt bei jeder verbotenen Form an.
 *
 * Reine Dateiarbeit — die Datenbank-Seite prüft
 * tests/integration/stripe-konto.int.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ORDNER = '20261110120000_stripe_konto_stand'
const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', ORDNER, 'migration.sql'), 'utf8')
const SCHEMA = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

/** Was diese Expand-Migration nie tut. Geprüft wird der SQL-Text ohne Kommentare. */
const VERBOTEN =
  /\bDROP\b|\bRENAME\b|ALTER\s+TYPE|ALTER\s+COLUMN|SET\s+NOT\s+NULL|\bNOT\s+NULL\b|SET\s+DATA\s+TYPE|\bDEFAULT\b|^\s*UPDATE\b|^\s*DELETE\b|^\s*INSERT\b|\bTRUNCATE\b|CREATE\s+TABLE|CREATE\s+(UNIQUE\s+)?INDEX/im

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

/** Der Block des Modells Farm, damit gleichnamige Felder anderer Modelle nicht zählen. */
function farmBlock(schema: string): string {
  const treffer = schema.match(/^model Farm \{[\s\S]*?^\}/m)
  if (!treffer) throw new Error('model Farm fehlt in schema.prisma')
  return treffer[0]
}

describe(`Migration ${ORDNER}: nur Expand`, () => {
  it('enthält nichts, was Bestehendes entfernt, umbenennt, im Typ ändert, umschreibt oder vorbelegt', () => {
    expect(ohneKommentare(MIGRATION)).not.toMatch(VERBOTEN)
  })

  it('genau zwei Anweisungen: lock_timeout und zwei nullbare Spalten ohne Default, wiederholbar', () => {
    expect(anweisungen(MIGRATION)).toEqual([
      "SET lock_timeout = '5s'",
      'ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "stripeKontoGelesenAm" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "stripeKontoStand" TEXT',
    ])
  })

  it('schema.prisma: dieselben zwei Spalten am Hof, nullbar und ohne @default', () => {
    const farm = farmBlock(SCHEMA)
    expect(farm).toMatch(/^\s*stripeKontoStand\s+String\?\s*$/m)
    expect(farm).toMatch(/^\s*stripeKontoGelesenAm\s+DateTime\?\s*$/m)
    // Nirgends sonst im Schema (kein zweites Feld, Auftrag A012 „Nicht“).
    expect(SCHEMA.match(/^\s*stripeKonto(Stand|GelesenAm)\b/gm)).toHaveLength(2)
  })

  it('Gegenprobe: die Suche erkennt jede verbotene Form', () => {
    for (const sql of [
      'ALTER TABLE "Farm" DROP COLUMN "stripeAccountReady";',
      'ALTER TABLE "Farm" RENAME COLUMN "stripeKontoStand" TO "stand";',
      'ALTER TYPE "Tarif" RENAME VALUE \'HOFTOR\' TO \'TOR\';',
      'ALTER TABLE "Farm" ALTER COLUMN "stripeKontoStand" TYPE VARCHAR(20);',
      'ALTER TABLE "Farm" ALTER COLUMN "stripeKontoStand" SET NOT NULL;',
      'ALTER TABLE "Farm" ADD COLUMN "stripeKontoStand" TEXT NOT NULL;',
      'ALTER TABLE "Farm" ADD COLUMN "stripeKontoStand" TEXT DEFAULT \'unklar\';',
      'UPDATE "Farm" SET "stripeKontoStand" = \'bereit\';',
      'INSERT INTO "Farm" ("id") VALUES (\'x\');',
      'DELETE FROM "Farm";',
      'TRUNCATE "Farm";',
      'CREATE TABLE "StripeKonto" ("id" TEXT);',
      'CREATE INDEX "Farm_stripeKontoStand_idx" ON "Farm"("stripeKontoStand");',
    ]) {
      expect(sql, sql).toMatch(VERBOTEN)
    }
    // Ein Kommentar ist keine Anweisung.
    expect(ohneKommentare('-- Kein DROP, kein UPDATE, kein DEFAULT\nSELECT 1;')).not.toMatch(VERBOTEN)
  })
})
