/**
 * Migrationswache — schützt das Deploy-Fenster.
 *
 * `vercel-build` führt `prisma migrate deploy` VOR `next build` aus. Zwischen
 * Migration und Live-Schaltung läuft der ALTE Code auf dem NEUEN Schema.
 * Eine NOT-NULL-Spalte ohne Default auf einer bestehenden Tabelle lässt in
 * diesem Fenster jeden INSERT des alten Codes mit P2011 scheitern — passiert
 * am 2026-09-23 (DEVELOPMENT.md → Vorfälle). Regel: ARCHITECTURE.md §5.
 *
 * Die Wache liest jede migration.sql unter prisma/migrations und schlägt bei
 * jedem `ADD COLUMN … NOT NULL` ohne `DEFAULT` an. Ausnahme: In den fünf Zeilen vor
 * dem zugehörigen `ALTER TABLE` steht einer der Marker
 *   -- EXPAND-CONTRACT: Tabelle leer
 *   -- EXPAND-CONTRACT: Schritt 2 von 2
 * Der Marker ist eine bewusste, begründete Entscheidung — kein Freibrief.
 *
 * Bewusst NICHT geprüft: `ALTER COLUMN … SET NOT NULL` (das ist Schritt 2 des
 * Expand/Contract-Musters, nach dem Backfill) und `CREATE TABLE` (eine neue
 * Tabelle kennt der alte Code nicht, er schreibt nicht hinein).
 *
 * Reine Dateiarbeit, kein Datenbankzugriff — läuft in der normalen Suite und
 * damit im Stop-Hook.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MARKER = [
  '-- EXPAND-CONTRACT: Tabelle leer',
  '-- EXPAND-CONTRACT: Schritt 2 von 2',
] as const

/** Wie viele Zeilen über dem ALTER TABLE der Marker stehen darf. */
const MARKER_FENSTER = 5

type Befund = { zeile: number; klausel: string }

/**
 * Schneidet ab `start` genau eine ADD-COLUMN-Klausel aus der Zeile: bis zum
 * ersten Komma oder Semikolon AUSSERHALB von Klammern. Das Komma in
 * `DECIMAL(10,3)` beendet die Klausel nicht — sonst ginge das `NOT NULL`
 * dahinter verloren und die Wache wäre blind für den echten Vorfall.
 */
function klauselAb(zeile: string, start: number): string {
  let klammerTiefe = 0
  for (let i = start; i < zeile.length; i++) {
    const zeichen = zeile[i]
    if (zeichen === '(') klammerTiefe++
    else if (zeichen === ')') klammerTiefe--
    else if ((zeichen === ',' || zeichen === ';') && klammerTiefe === 0) {
      return zeile.slice(start, i)
    }
  }
  return zeile.slice(start)
}

/**
 * Prüft den SQL-Text einer Migration und liefert jede ADD-COLUMN-Klausel mit
 * NOT NULL ohne DEFAULT, die keinen EXPAND-CONTRACT-Marker in den fünf Zeilen
 * über ihrem ALTER TABLE trägt. Leeres Ergebnis = Migration in Ordnung.
 */
function pruefeMigrationsSql(sql: string): Befund[] {
  const zeilen = sql.split('\n')
  const befunde: Befund[] = []

  for (let i = 0; i < zeilen.length; i++) {
    // SQL-Kommentare sind keine Klauseln — `-- ADD COLUMN …` zählt nicht.
    const ohneKommentar = zeilen[i].split('--')[0]
    const muster = /ADD\s+COLUMN/gi
    let treffer: RegExpExecArray | null

    while ((treffer = muster.exec(ohneKommentar)) !== null) {
      const klausel = klauselAb(ohneKommentar, treffer.index)
      // `IF NOT EXISTS` enthält NOT, aber nie NOT NULL — das Muster ist exakt.
      if (!/\bNOT\s+NULL\b/i.test(klausel)) continue
      if (/\bDEFAULT\b/i.test(klausel)) continue

      // Anfang des Statements: die ALTER-TABLE-Zeile dieser Klausel (bei
      // mehrzeiligen Statements liegt sie über der Klauselzeile).
      let statementZeile = i
      while (
        statementZeile > 0 &&
        !/ALTER\s+TABLE/i.test(zeilen[statementZeile].split('--')[0])
      ) {
        statementZeile--
      }

      const davor = zeilen.slice(Math.max(0, statementZeile - MARKER_FENSTER), statementZeile)
      const markiert = davor.some((zeile) => MARKER.some((marker) => zeile.includes(marker)))
      if (!markiert) befunde.push({ zeile: i + 1, klausel: klausel.trim() })
    }
  }

  return befunde
}

// ─── Die Regel selbst, an Fixtures ──────────────────────────────────────────

describe('pruefeMigrationsSql — NOT NULL ohne Default im Deploy-Fenster', () => {
  it('schlägt bei NOT NULL ohne Default und ohne Marker an', () => {
    const sql = `ALTER TABLE "Farm" ADD COLUMN "hofArt" TEXT NOT NULL;`

    const befunde = pruefeMigrationsSql(sql)

    expect(befunde).toHaveLength(1)
    expect(befunde[0]).toEqual({ zeile: 1, klausel: `ADD COLUMN "hofArt" TEXT NOT NULL` })
  })

  it('lässt NOT NULL durch, wenn ein EXPAND-CONTRACT-Marker direkt davor steht', () => {
    const tabelleLeer = [
      `-- EXPAND-CONTRACT: Tabelle leer — Schutzabfrage darüber belegt es.`,
      `ALTER TABLE "Farm" ADD COLUMN "hofArt" TEXT NOT NULL;`,
    ].join('\n')
    const schrittZwei = [
      `-- EXPAND-CONTRACT: Schritt 2 von 2 — Backfill lief im letzten Sprint.`,
      `ALTER TABLE "Farm" ADD COLUMN "hofArt" TEXT NOT NULL;`,
    ].join('\n')

    expect(pruefeMigrationsSql(tabelleLeer)).toHaveLength(0)
    expect(pruefeMigrationsSql(schrittZwei)).toHaveLength(0)
  })

  it('lässt NOT NULL mit DEFAULT durch — der alte Code kann die Spalte auslassen', () => {
    const sql = `ALTER TABLE "Farm" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'AT';`

    expect(pruefeMigrationsSql(sql)).toHaveLength(0)
  })

  it('lässt nullable Spalten und SET NOT NULL nach Backfill durch (vatRate-Muster)', () => {
    const sql = [
      `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2);`,
      `UPDATE "OrderItem" SET "vatRate" = 10 WHERE "vatRate" IS NULL;`,
      `ALTER TABLE "OrderItem" ALTER COLUMN "vatRate" SET NOT NULL;`,
    ].join('\n')

    expect(pruefeMigrationsSql(sql)).toHaveLength(0)
  })

  it('beendet die Klausel nicht am Komma in DECIMAL(10,3) — der Vorfallsfall', () => {
    // Mehrzeiliges ALTER TABLE wie in Bereiche 1: ohne Klammerzählung stünde
    // das NOT NULL hinter dem Typ-Komma und die Wache sähe nichts.
    const sql = [
      `ALTER TABLE "FutterKennzeichnung"`,
      `  ADD COLUMN IF NOT EXISTS "nettoMenge" DECIMAL(10,3) NOT NULL,`,
      `  ADD COLUMN IF NOT EXISTS "rohprotein" DECIMAL(5,2);`,
    ].join('\n')

    const befunde = pruefeMigrationsSql(sql)

    expect(befunde).toHaveLength(1)
    expect(befunde[0].klausel).toContain('"nettoMenge"')
  })

  it('gilt der Marker für das Statement, deckt er alle Klauseln des mehrzeiligen ALTER TABLE', () => {
    const sql = [
      `-- EXPAND-CONTRACT: Tabelle leer`,
      `ALTER TABLE "FutterKennzeichnung"`,
      `  ADD COLUMN "futtermittelart" TEXT NOT NULL,`,
      `  ADD COLUMN "nettoMenge" DECIMAL(10,3) NOT NULL,`,
      `  ADD COLUMN "nettoEinheit" TEXT NOT NULL;`,
    ].join('\n')

    expect(pruefeMigrationsSql(sql)).toHaveLength(0)
  })

  it('sieht den Marker genau fünf Zeilen über dem ALTER TABLE — sechs sind zu weit', () => {
    const mitAbstand = (leerzeilen: number): string =>
      [
        `-- EXPAND-CONTRACT: Tabelle leer`,
        ...Array.from({ length: leerzeilen }, () => ``),
        `ALTER TABLE "Farm" ADD COLUMN "hofArt" TEXT NOT NULL;`,
      ].join('\n')

    // Marker als 5. Zeile davor: gerade noch im Fenster.
    expect(pruefeMigrationsSql(mitAbstand(4))).toHaveLength(0)
    // Eine Zeile weiter weg: draußen — der Marker soll bei seiner Klausel stehen.
    expect(pruefeMigrationsSql(mitAbstand(5))).toHaveLength(1)
  })

  it('wertet einen auskommentierten ADD COLUMN nicht als Klausel', () => {
    const sql = `-- ALTER TABLE "Farm" ADD COLUMN "alt" TEXT NOT NULL;`

    expect(pruefeMigrationsSql(sql)).toHaveLength(0)
  })
})

// ─── Der echte Bestand ──────────────────────────────────────────────────────

describe('prisma/migrations — der echte Bestand', () => {
  it('keine NOT-NULL-Spalte ohne Default auf bestehender Tabelle ohne EXPAND-CONTRACT-Marker', () => {
    const wurzel = join(__dirname, '..', 'prisma', 'migrations')
    const ordner = readdirSync(wurzel).filter((eintrag) =>
      statSync(join(wurzel, eintrag)).isDirectory()
    )
    // Bricht der Test, weil der Ordner leer wäre, stimmt etwas Grundlegendes nicht.
    expect(ordner.length).toBeGreaterThan(0)

    const verstoesse: string[] = []
    for (const eintrag of ordner) {
      const datei = join(wurzel, eintrag, 'migration.sql')
      const befunde = pruefeMigrationsSql(readFileSync(datei, 'utf8'))
      for (const befund of befunde) {
        verstoesse.push(`${eintrag}/migration.sql:${befund.zeile} — ${befund.klausel}`)
      }
    }

    expect(
      verstoesse,
      `NOT-NULL-Spalte ohne Default auf bestehender Tabelle: Im Deploy-Fenster ` +
        `(migrate deploy läuft vor next build) scheitert jeder INSERT des alten ` +
        `Codes mit P2011 — siehe ARCHITECTURE.md §5. Entweder Default setzen, ` +
        `in zwei Schritten migrieren (erst nullable + Code, dann NOT NULL) oder, ` +
        `wenn die Tabelle nachweislich leer ist, in den fünf Zeilen vor dem ` +
        `ALTER TABLE begründet markieren mit »${MARKER[0]}« bzw. »${MARKER[1]}«.\n` +
        verstoesse.join('\n')
    ).toHaveLength(0)
  })
})
