/**
 * Wache: Die Migration des Postfachs (Register N12, Nachtlauf Nr. 87) ist NUR
 * Expand.
 *
 * Die Freigabe erlaubt in Lauf 13 genau eine Migration, nur additiv: vier neue
 * Tabellen (Rundschreiben, Unterhaltung, Nachricht, UnterhaltungStand), nichts
 * an bestehenden Tabellen (ARCHITECTURE §5, Expand/Contract). Ein Push spielt
 * sie über den Vorschau-Build sofort ein — was hier steht, ist endgültig.
 *
 * Beweist:
 *  - kein DROP, kein RENAME, kein ALTER TYPE/COLUMN, kein SET NOT NULL, kein
 *    UPDATE/DELETE/TRUNCATE, kein ADD COLUMN; ALTER TABLE nur an den vier
 *    neuen Tabellen;
 *  - wiederholbar: jede Tabelle und jeder Index mit IF NOT EXISTS, jeder Typ
 *    und jeder Fremdschlüssel im DO-Block mit duplicate_object; lock_timeout
 *    zuerst;
 *  - RLS an jeder neuen Tabelle; je Fremdschlüssel ein Index, der mit seiner
 *    Spalte beginnt (oder der Primärschlüssel);
 *  - der Ordner enthält genau diese eine Datei; schema.prisma kennt dieselben
 *    vier Modelle und keine Spalte für Fäden zwischen Höfen;
 *  - Gegenprobe: Die Suche schlägt bei jeder verbotenen Form an.
 *
 * Reine Dateiarbeit — die Datenbank-Seite prüft
 * tests/integration/postfach.int.test.ts (auch den zweiten Lauf).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ORDNER = '20261013210000_postfach'
const PFAD = join(process.cwd(), 'prisma', 'migrations', ORDNER)
const MIGRATION = readFileSync(join(PFAD, 'migration.sql'), 'utf8')
const SCHEMA = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

const NEUE_TABELLEN = ['Rundschreiben', 'Unterhaltung', 'Nachricht', 'UnterhaltungStand'] as const

/** Was eine Expand-Migration nie tut. Geprüft wird der SQL-Text ohne Kommentare. */
const VERBOTEN =
  /\bDROP\b|\bRENAME\b|ALTER\s+TYPE|ALTER\s+COLUMN|SET\s+NOT\s+NULL|SET\s+DATA\s+TYPE|^\s*UPDATE\b|^\s*DELETE\b|\bTRUNCATE\b|ADD\s+COLUMN/im

function ohneKommentare(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((zeile) => zeile.replace(/--.*$/, ''))
    .join('\n')
}

/** Anweisungen ohne Kommentare, ein DO-Block als eine Anweisung (sein Inneres trägt eigene Semikolons). */
function anweisungen(sql: string): string[] {
  const text = ohneKommentare(sql)
  const teile: string[] = []
  const muster = /\s*DO \$\$[\s\S]*?END \$\$;|[^;]+;/g
  for (const treffer of text.matchAll(muster)) {
    const teil = treffer[0].replace(/\s+/g, ' ').trim()
    if (teil !== ';' && teil !== '') teile.push(teil.replace(/;$/, ''))
  }
  return teile
}

/** Tabellen, an denen ALTER TABLE etwas ändert. */
function geaenderteTabellen(sql: string): string[] {
  return [...ohneKommentare(sql).matchAll(/ALTER\s+TABLE\s+(?:"public"\.)?"(\w+)"/g)].map((m) => m[1])
}

/** Je Fremdschlüssel: Tabelle und Spalte. */
function fremdschluessel(sql: string): { tabelle: string; spalte: string }[] {
  return [...ohneKommentare(sql).matchAll(/ALTER TABLE "(\w+)" ADD CONSTRAINT "\w+" FOREIGN KEY \("(\w+)"\)/g)].map((m) => ({
    tabelle: m[1],
    spalte: m[2],
  }))
}

/** Die erste Spalte jedes Index und Primärschlüssels je Tabelle. */
function ersteIndexSpalten(sql: string): Set<string> {
  const text = ohneKommentare(sql)
  const erste = new Set<string>()
  for (const m of text.matchAll(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS "\w+" ON "(\w+)"\("(\w+)"/g)) erste.add(`${m[1]}.${m[2]}`)
  for (const m of text.matchAll(/CREATE TABLE IF NOT EXISTS "(\w+)" \(([\s\S]*?)\n\);/g)) {
    const pk = /PRIMARY KEY \("(\w+)"/.exec(m[2])
    if (pk) erste.add(`${m[1]}.${pk[1]}`)
  }
  return erste
}

describe(`Migration ${ORDNER}: nur Expand`, () => {
  it('der Ordner enthält genau diese eine Datei', () => {
    expect(readdirSync(PFAD)).toEqual(['migration.sql'])
  })

  it('enthält nichts, was Bestehendes entfernt, umbenennt, im Typ ändert oder umschreibt', () => {
    expect(ohneKommentare(MIGRATION)).not.toMatch(VERBOTEN)
  })

  it('ALTER TABLE nur an den vier neuen Tabellen — keine bestehende Tabelle wird angefasst', () => {
    const tabellen = new Set(geaenderteTabellen(MIGRATION))
    expect([...tabellen].sort()).toEqual([...NEUE_TABELLEN].sort())
  })

  it('wiederholbar: lock_timeout zuerst, IF NOT EXISTS an Tabellen und Indizes, Typen und Fremdschlüssel im DO-Block', () => {
    const liste = anweisungen(MIGRATION)
    expect(liste[0]).toBe("SET lock_timeout = '5s'")
    const tabellen = liste.filter((a) => /^CREATE TABLE/.test(a))
    const indizes = liste.filter((a) => /^CREATE (UNIQUE )?INDEX/.test(a))
    const bloecke = liste.filter((a) => a.startsWith('DO $$'))
    expect(tabellen.map((a) => /^CREATE TABLE IF NOT EXISTS "(\w+)"/.exec(a)?.[1])).toEqual([...NEUE_TABELLEN])
    expect(indizes).toHaveLength(4)
    for (const a of indizes) expect(a).toMatch(/^CREATE (UNIQUE )?INDEX IF NOT EXISTS /)
    // Drei Typen und vier Fremdschlüssel, jeder für sich geschützt.
    expect(bloecke).toHaveLength(7)
    for (const b of bloecke) expect(b).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL; END \$\$/)
    expect(bloecke.filter((b) => /CREATE TYPE/.test(b))).toHaveLength(3)
    expect(bloecke.filter((b) => /FOREIGN KEY/.test(b))).toHaveLength(4)
    // Nichts außerhalb dieser Formen.
    const rest = liste.filter((a) => !tabellen.includes(a) && !indizes.includes(a) && !bloecke.includes(a))
    expect(rest).toEqual([
      "SET lock_timeout = '5s'",
      ...NEUE_TABELLEN.map((t) => `ALTER TABLE "public"."${t}" ENABLE ROW LEVEL SECURITY`),
    ])
  })

  it('je Fremdschlüssel ein Index, der mit seiner Spalte beginnt', () => {
    const fks = fremdschluessel(MIGRATION)
    expect(fks).toHaveLength(4)
    const erste = ersteIndexSpalten(MIGRATION)
    for (const { tabelle, spalte } of fks) expect(erste.has(`${tabelle}.${spalte}`), `${tabelle}.${spalte}`).toBe(true)
  })

  it('schema.prisma: dieselben vier Modelle; keine Spalte für Fäden zwischen Höfen (K3/T8 kommen mit ihrem Lauf)', () => {
    for (const t of NEUE_TABELLEN) expect(SCHEMA).toMatch(new RegExp(`^model ${t} \\{`, 'm'))
    const unterhaltung = SCHEMA.match(/model Unterhaltung \{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(unterhaltung).toMatch(/@@unique\(\[farmId, rundschreibenId\]\)/)
    expect(unterhaltung).toMatch(/@@index\(\[farmId, letzteNachrichtAm\]\)/)
    expect(unterhaltung).not.toMatch(/beginner|partnerFarmId|zweiterHof|anFarmId/i)
    const stand = SCHEMA.match(/model UnterhaltungStand \{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(stand).toMatch(/@@id\(\[unterhaltungId, seite\]\)/)
  })

  it('Gegenprobe: die Suche erkennt jede verbotene Form und eine Änderung an einer bestehenden Tabelle', () => {
    for (const sql of [
      'ALTER TABLE "Farm" DROP COLUMN "isPaused";',
      'ALTER TABLE "Farm" RENAME COLUMN "isPaused" TO "pausiert";',
      'ALTER TYPE "Tarif" RENAME VALUE \'HOFTOR\' TO \'TOR\';',
      'ALTER TABLE "Nachricht" ALTER COLUMN "text" TYPE VARCHAR(1000);',
      'ALTER TABLE "Farm" ALTER COLUMN "tarif" SET NOT NULL;',
      'UPDATE "Farm" SET "isPaused" = true;',
      'DELETE FROM "Farm";',
      'TRUNCATE "Farm";',
      'ALTER TABLE "Farm" ADD COLUMN "postfach" TEXT;',
    ]) {
      expect(sql, sql).toMatch(VERBOTEN)
    }
    expect(geaenderteTabellen('ALTER TABLE "Farm" ENABLE ROW LEVEL SECURITY;')).toEqual(['Farm'])
    // Ein Fremdschlüssel ohne Index fällt auf.
    const ohneIndex = 'CREATE TABLE IF NOT EXISTS "X" (\n "id" TEXT,\n CONSTRAINT "X_pkey" PRIMARY KEY ("id")\n);\nALTER TABLE "X" ADD CONSTRAINT "X_y_fkey" FOREIGN KEY ("y") REFERENCES "Y"("id");'
    expect(ersteIndexSpalten(ohneIndex).has('X.y')).toBe(false)
    expect(fremdschluessel(ohneIndex)).toEqual([{ tabelle: 'X', spalte: 'y' }])
    // Ein Kommentar ist keine Anweisung.
    expect(ohneKommentare('-- Kein DROP, kein RENAME\nSELECT 1;')).not.toMatch(VERBOTEN)
  })
})
