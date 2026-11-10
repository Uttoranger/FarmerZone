import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  SPERR_SCHEMA,
  bezeichner,
  leseAufruf,
  pruefeTabellen,
  tabellenAusSchema,
  tabellenSql,
} from '../scripts/pruefung/db-schalter'
import { tempWorktree } from './pruefung-worktree'

/**
 * Teilausfall für Bilder (Nr. 262c, Zwischen-Morgenbericht 33 B, Regelvorschlag 2, freigegeben
 * 9.11.2026): `fotograf.sh tabelle-aus <kopie> <Tabelle…>` macht in EINER Kopie einzelne Tabellen
 * unlesbar, damit eine Seite lädt und nur ihr Ladefehler-Kasten erscheint. Die Anwendung verbindet sich
 * als `postgres` (Superuser) — REVOKE und Row-Level-Security wirken dann nicht. Die Tabelle wandert
 * deshalb in ein eigenes Schema; Prisma fragt `"public"."<Tabelle>"` und findet sie nicht mehr.
 * Keine Datenbank wird hier angefasst: der Befehl bricht in jedem Fall vor dem Verbinden ab.
 */

const wt = tempWorktree('db-schalter-tabellen-')
afterAll(() => wt.weg())

const SCHEMA_PROBE = `
// model Kommentar { ist keins }
enum Rolle {
  KUNDE
}
model User {
  id String @id
}

model Order {
  id String @id
}
view Umsatz {
  id String
}
`

describe('Tabellen aus dem Prisma-Schema', () => {
  it('liest nur Modelle, keine Enums, Views oder Kommentare', () => {
    expect(tabellenAusSchema(SCHEMA_PROBE)).toEqual(['User', 'Order'])
  })

  it('kennt die Tabellen des echten Schemas, aus denen die Ladefehler-Seiten lesen', () => {
    const erlaubt = tabellenAusSchema(readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8'))
    expect(erlaubt).toEqual(expect.arrayContaining(['Order', 'User', 'Unterhaltung', 'Nachricht', 'Farm']))
  })
})

describe('pruefeTabellen: nur Namen aus der Allowlist', () => {
  const erlaubt = ['User', 'Order', 'Nachricht']

  it('nimmt Modellnamen genau so, wie das Schema sie schreibt', () => {
    expect(pruefeTabellen(['Order', 'Nachricht'], erlaubt)).toBeNull()
  })

  it.each([
    ['keine Tabelle', []],
    ['falsche Groß- und Kleinschreibung', ['order']],
    ['eine Tabelle, die es im Schema nicht gibt', ['Bestellung']],
    ['angehängtes SQL', ['Order; DROP TABLE "User"']],
    ['einen gequoteten Namen', ['"Order"']],
    ['einen Schema-Namen davor', ['public.Order']],
    ['dieselbe Tabelle doppelt', ['Order', 'Order']],
  ])('lehnt %s ab', (_fall, tabellen) => {
    expect(pruefeTabellen(tabellen, erlaubt)).not.toBeNull()
  })
})

describe('bezeichner: korrekt gequotet, sonst Abbruch', () => {
  it('setzt doppelte Anführungszeichen um einen einfachen Namen', () => {
    expect(bezeichner('Order')).toBe('"Order"')
    expect(bezeichner(SPERR_SCHEMA)).toBe('"pruef_gesperrt"')
  })

  it.each(['', 'Or"der', 'a b', '1abc', 'x;y', 'ä'])('wirft bei %j', (name) => {
    expect(() => bezeichner(name)).toThrow()
  })
})

describe('tabellenSql: das erzeugte SQL', () => {
  it('sperrt durch Verschieben aus public in das Sperr-Schema', () => {
    expect(SPERR_SCHEMA).toBe('pruef_gesperrt')
    expect(tabellenSql('aus', 'Order')).toBe('ALTER TABLE "public"."Order" SET SCHEMA "pruef_gesperrt"')
  })

  it('gibt durch Zurückschieben frei', () => {
    expect(tabellenSql('an', 'Order')).toBe('ALTER TABLE "pruef_gesperrt"."Order" SET SCHEMA "public"')
  })

  it('erzeugt kein SQL für einen ungeprüften Namen', () => {
    expect(() => tabellenSql('aus', 'Order"; DROP TABLE "User')).toThrow()
  })
})

describe('leseAufruf: Modus, Kopie, Tabellen', () => {
  it('nimmt aus und an ohne Tabellen wie bisher', () => {
    expect(leseAufruf(['aus', 'kopie_1_a'])).toEqual({ modus: 'aus', kopie: 'kopie_1_a', tabellen: [] })
    expect(leseAufruf(['an', 'kopie_1_a'])).toEqual({ modus: 'an', kopie: 'kopie_1_a', tabellen: [] })
  })

  it('nimmt tabelle-aus und tabelle-an mit mindestens einer Tabelle', () => {
    expect(leseAufruf(['tabelle-aus', 'kopie_1_a', 'Order', 'Nachricht'])).toEqual({
      modus: 'tabelle-aus',
      kopie: 'kopie_1_a',
      tabellen: ['Order', 'Nachricht'],
    })
  })

  it.each([
    ['tabelle-aus ohne Tabelle', ['tabelle-aus', 'kopie_1_a']],
    ['aus mit Tabelle', ['aus', 'kopie_1_a', 'Order']],
    ['einen unbekannten Modus', ['weg', 'kopie_1_a']],
    ['gar nichts', []],
  ])('lehnt %s ab', (_fall, argv) => {
    expect(typeof leseAufruf(argv)).toBe('string')
  })
})

describe('Befehl db-schalter.ts tabelle-aus / tabelle-an (bricht vor dem Verbinden ab)', () => {
  /** Aus dem Temp-Worktree, mit einer Umgebung wie `env -i`. */
  function schalter(args: string[], url: string) {
    return spawnSync(join(wt.ordner, 'node_modules', '.bin', 'tsx'), [wt.skript('db-schalter.ts'), ...args], {
      cwd: wt.ordner,
      encoding: 'utf8',
      env: { PATH: process.env['PATH'], HOME: process.env['HOME'], DATABASE_URL: url, DIRECT_URL: url } as Record<string, string | undefined> as NodeJS.ProcessEnv,
    })
  }

  it('lehnt eine Integrations-DB ab', () => {
    const lauf = schalter(['tabelle-aus', 'fz_int_262c', 'Order'], 'postgresql://postgres:pw@localhost:5432/fz_int_262c')
    expect(lauf.status).toBe(1)
    expect(lauf.stderr).toContain('keine Kopie')
  }, 30_000)

  it('lehnt einen fremden Host ab, ohne das Passwort zu zeigen', () => {
    const lauf = schalter(['tabelle-aus', 'kopie_1_a', 'Order'], 'postgresql://postgres:pw@db.example.com:5432/kopie_1_a')
    expect(lauf.status).toBe(1)
    expect(lauf.stderr).toContain('db.example.com:5432')
    expect(lauf.stderr).not.toContain('pw@')
  }, 30_000)

  it('lehnt eine Tabelle ab, die nicht im Prisma-Schema steht', () => {
    const lauf = schalter(['tabelle-an', 'kopie_1_a', 'pg_authid'], 'postgresql://postgres:pw@localhost:5432/kopie_1_a')
    expect(lauf.status).toBe(1)
    expect(lauf.stderr).toContain('pg_authid')
  }, 30_000)
})

describe('fotograf.sh tabelle-aus / tabelle-an', () => {
  const quelle = readFileSync(wt.skript('fotograf.sh'), 'utf8')

  it('gehen nur über den DB-Schalter mit der Liste der Kopie', () => {
    expect(quelle).toContain('tabelle-aus|tabelle-an)')
    expect(quelle).toContain('db-schalter.ts" "$MODUS" "$KOPIE" "${@:3}"')
  })
})
