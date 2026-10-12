/**
 * Wache: Die Migration „wer geöffnet bekam" (Nachtlauf Nr. 66, Register W1)
 * ist NUR Expand.
 *
 * Die Freigabe erlaubt genau eine Spalte: StatusPost.whatsappGetippt vom Typ
 * TEXT[] (Abonnements-IDs), nullable, mit leerem Default wie
 * linkedProductIds, ohne Backfill und ohne jede andere Schema-Änderung
 * (ARCHITECTURE §5). Jede andere Form — NOT NULL, Json, eine zweite Spalte —
 * ist nicht freigegeben. Ein Push spielt sie über den Vorschau-Build sofort
 * ein — was hier steht, ist endgültig.
 *
 * Beweist:
 *  - kein DROP, kein RENAME, kein ALTER TYPE, kein ALTER COLUMN, kein
 *    NOT NULL, kein Json, kein UPDATE/DELETE/TRUNCATE, keine neue Tabelle;
 *  - genau eine neue Spalte: StatusPost.whatsappGetippt TEXT[] mit Default
 *    ARRAY[]::TEXT[], wiederholbar (IF NOT EXISTS), mit lock_timeout;
 *  - schema.prisma sagt dasselbe (String[] @default([]));
 *  - Gegenprobe: Die Suche schlägt bei jeder verbotenen Form an.
 *
 * Reine Dateiarbeit — die Datenbank-Seite prüft
 * tests/integration/whatsapp-getippt.int.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ORDNER = '20261012200000_whatsapp_getippt'
const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', ORDNER, 'migration.sql'), 'utf8')
const SCHEMA = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

/** Was diese Expand-Migration nie tut. Geprüft wird der SQL-Text ohne Kommentare. */
const VERBOTEN =
  /\bDROP\b|\bRENAME\b|ALTER\s+TYPE|ALTER\s+COLUMN|NOT\s+NULL|SET\s+DATA\s+TYPE|\bJSONB?\b|^\s*UPDATE\b|^\s*DELETE\b|\bTRUNCATE\b|CREATE\s+TABLE/im

const ERLAUBTE_ANWEISUNGEN = [
  "SET lock_timeout = '5s'",
  'ALTER TABLE "StatusPost" ADD COLUMN IF NOT EXISTS "whatsappGetippt" TEXT[] DEFAULT ARRAY[]::TEXT[]',
]

/** Die Spalte in schema.prisma: Liste von Texten mit leerem Default, sonst nichts. */
const SPALTE_IM_SCHEMA = /^\s*whatsappGetippt\s+String\[\]\s+@default\(\[\]\)\s*$/m

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

/** Der Block des Modells StatusPost in schema.prisma. */
function beitragModell(schema: string): string {
  const start = schema.indexOf('model StatusPost {')
  return schema.slice(start, schema.indexOf('\n}', start))
}

describe(`Migration ${ORDNER}: nur Expand`, () => {
  it('enthält nichts, was Bestehendes entfernt, umbenennt, im Typ ändert, zur Pflicht macht oder umschreibt', () => {
    expect(ohneKommentare(MIGRATION)).not.toMatch(VERBOTEN)
  })

  it('genau zwei Anweisungen: lock_timeout und eine TEXT[]-Spalte mit leerem Default, wiederholbar', () => {
    expect(anweisungen(MIGRATION)).toEqual(ERLAUBTE_ANWEISUNGEN)
  })

  it('schema.prisma: dieselbe Spalte am Beitrag, String[] mit @default([]) — und nur diese neu', () => {
    const modell = beitragModell(SCHEMA)
    expect(modell).toMatch(SPALTE_IM_SCHEMA)
    // Zähler und Empfängerzahl bleiben (Contract später, eigene Freigabe).
    expect(modell).toMatch(/^\s*whatsappSentCount\s+Int\s+@default\(0\)\s*$/m)
    expect(modell).toMatch(/^\s*whatsappRecipientCount\s+Int\s+@default\(0\)\s*$/m)
  })

  it('Gegenprobe: die Suche erkennt jede verbotene Form', () => {
    for (const sql of [
      'ALTER TABLE "StatusPost" DROP COLUMN "whatsappSentCount";',
      'ALTER TABLE "StatusPost" RENAME COLUMN "whatsappSentCount" TO "gezaehlt";',
      'ALTER TABLE "StatusPost" ALTER COLUMN "whatsappGetippt" TYPE JSONB;',
      'ALTER TABLE "StatusPost" ADD COLUMN "whatsappGetippt" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];',
      'ALTER TABLE "StatusPost" ADD COLUMN "whatsappGetippt" JSONB;',
      'UPDATE "StatusPost" SET "whatsappGetippt" = ARRAY[]::TEXT[];',
      'DELETE FROM "StatusPost";',
      'TRUNCATE "StatusPost";',
      'CREATE TABLE "WhatsAppTipp" ("id" TEXT);',
    ]) {
      expect(sql, sql).toMatch(VERBOTEN)
    }
    // Ein Kommentar ist keine Anweisung.
    expect(ohneKommentare('-- Kein DROP, kein UPDATE, kein NOT NULL\nSELECT 1;')).not.toMatch(VERBOTEN)
    // Eine zweite Spalte fällt in der Liste der Anweisungen auf.
    expect(anweisungen(`${MIGRATION}\nALTER TABLE "StatusPost" ADD COLUMN IF NOT EXISTS "whatsappGeoeffnet" TEXT[];`)).not.toEqual(
      ERLAUBTE_ANWEISUNGEN
    )
    // Die Spalten-Prüfung schlägt bei Json, Pflichtfeld ohne Default oder anderem Default an.
    for (const zeile of ['  whatsappGetippt Json?', '  whatsappGetippt String[]', '  whatsappGetippt String[] @default(["x"])']) {
      expect(`model StatusPost {\n${zeile}\n}`, zeile).not.toMatch(SPALTE_IM_SCHEMA)
    }
  })
})
