/**
 * Fehlerzustände für Bilder (Nr. 262): eine DB-KOPIE eines Fotografen sperren
 * bzw. wieder öffnen — dann zeigt sein Server Ladefehler und „Speichern
 * fehlgeschlagen“, ohne dass App-Code etwas davon weiß.
 *
 *   tsx scripts/pruefung/db-schalter.ts aus|an <kopie>
 *   tsx scripts/pruefung/db-schalter.ts tabelle-aus|tabelle-an <kopie> <Tabelle…>
 *
 * Läuft unter `env -i` mit der Liste aus pruef-env.sh für genau diese Kopie
 * (fotograf.sh db-aus/db-an). Sperre zuerst: Name mit Kopie-Präfix (nie die
 * Prüf-Haupt-DB), Adressen wie beim Prüf-Seed (localhost, beide gleich),
 * DATABASE_URL zeigt auf genau diese Kopie, `inet_server_addr()` Loopback.
 * Verbunden wird mit der Verwaltungs-DB `postgres` desselben Servers, denn die
 * Kopie selbst nimmt nach dem Sperren keine Verbindung mehr an.
 *
 *   aus: ALTER DATABASE <kopie> WITH ALLOW_CONNECTIONS false, dann
 *        pg_terminate_backend nur für Verbindungen auf diese Kopie
 *   an:  ALTER DATABASE <kopie> WITH ALLOW_CONNECTIONS true
 *
 * Teilausfall (Nr. 262c): Die Seite lädt, nur ein Lesezugriff scheitert — so
 * wird der Ladefehler-Kasten prüfbar statt der ganzen 500. Die Anwendung
 * verbindet sich als `postgres` (Superuser): REVOKE und Row-Level-Security
 * (auch mit FORCE) wirken dann nicht. Die Tabelle wandert deshalb innerhalb
 * der Kopie in ein eigenes Schema; Prisma fragt `"public"."<Tabelle>"` und
 * bekommt „relation does not exist“. Name, Indizes, Fremdschlüssel und
 * Daten bleiben, nichts an Schema, Migration oder App ändert sich.
 * Verbunden wird hier mit der Kopie selbst (ALTER TABLE wirkt nur dort).
 *
 *   tabelle-aus: ALTER TABLE "public"."<T>" SET SCHEMA "pruef_gesperrt"
 *   tabelle-an:  ALTER TABLE "pruef_gesperrt"."<T>" SET SCHEMA "public"
 *
 * Tabellen nur aus den Modellen von prisma/schema.prisma (exakter Name), in
 * einer Transaktion, mit lock_timeout; schon gesperrt bzw. schon frei wird
 * übersprungen (idempotent).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hostUndPort, istLoopbackServerAdresse, pflichtOrdner, pruefeDatenbankAdressen, pruefeOhneEnvDateien, pruefWerteAus, werkzeugWorktree } from './sperre'

/** Kopien heißen `kopie_<…>` (createdb -T <prüf-db> kopie_<n>_<prüf-db>); die Prüf-Haupt-DB trägt das Präfix nie. */
export const KOPIE_PRAEFIX = 'kopie_'

/** Ist das ein erlaubter Name einer Kopie? null = ja, sonst der Grund. */
export function pruefeKopieName(name: string | undefined): string | null {
  if (!name) return 'Name der Kopie fehlt.'
  if (!/^[a-z0-9_]+$/.test(name)) return 'Name der Kopie nur aus a-z, 0-9 und _.'
  if (!name.startsWith(KOPIE_PRAEFIX) || name.length <= KOPIE_PRAEFIX.length) {
    return `„${name}“ ist keine Kopie (Präfix ${KOPIE_PRAEFIX}). Die Prüf-Haupt-DB wird nie gesperrt.`
  }
  return null
}

/** Zeigt DATABASE_URL auf genau diese Kopie? Sonst sperrte der Befehl eine DB, die die Sperre nie gesehen hat. */
export function pruefeZielKopie(datenbankUrl: string | undefined, kopie: string): string | null {
  try {
    const name = decodeURIComponent(new URL(datenbankUrl ?? '').pathname.slice(1))
    return name === kopie ? null : `DATABASE_URL zeigt nicht auf die Kopie ${kopie}.`
  } catch {
    return 'DATABASE_URL ist keine lesbare Adresse.'
  }
}

/** Die Adresse der Verwaltungs-DB auf demselben Server (nur der Pfad ändert sich). */
export function verwaltungsAdresse(datenbankUrl: string): string {
  const url = new URL(datenbankUrl)
  url.pathname = '/postgres'
  return url.toString()
}

/** Das Schema, in das gesperrte Tabellen wandern (nur in einer Kopie). */
export const SPERR_SCHEMA = 'pruef_gesperrt'

export type Modus = 'aus' | 'an' | 'tabelle-aus' | 'tabelle-an'
export type Aufruf = { modus: Modus; kopie: string | undefined; tabellen: string[] }

/** Aufruf lesen; ein String ist der Grund für den Abbruch. */
export function leseAufruf(argv: readonly string[]): Aufruf | string {
  const [modus, kopie, ...tabellen] = argv
  const nutzung = 'Aufruf: db-schalter.ts aus|an <kopie> | tabelle-aus|tabelle-an <kopie> <Tabelle…>'
  if (modus === 'aus' || modus === 'an') return tabellen.length === 0 ? { modus, kopie, tabellen } : nutzung
  if (modus === 'tabelle-aus' || modus === 'tabelle-an') return tabellen.length > 0 ? { modus, kopie, tabellen } : nutzung
  return nutzung
}

/** Die Modellnamen aus prisma/schema.prisma — ohne @@map sind das die Tabellennamen. */
export function tabellenAusSchema(schemaText: string): string[] {
  return [...schemaText.matchAll(/^model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/gm)].map((m) => m[1] as string)
}

/** Nur Namen der Allowlist, jeder höchstens einmal. null = ja, sonst der Grund. */
export function pruefeTabellen(tabellen: readonly string[], erlaubt: readonly string[]): string | null {
  if (tabellen.length === 0) return 'Keine Tabelle angegeben.'
  if (new Set(tabellen).size !== tabellen.length) return 'Eine Tabelle steht doppelt da.'
  const fremd = tabellen.filter((t) => !erlaubt.includes(t))
  // Nur Zeichen eines Bezeichners in die Meldung, nie freier Text aus dem Aufruf.
  if (fremd.length > 0) return `Keine Tabelle aus prisma/schema.prisma: ${fremd.map((t) => t.replace(/[^A-Za-z0-9_]/g, '?')).join(', ')}.`
  return null
}

/** Ein Bezeichner in doppelten Anführungszeichen; alles außer [A-Za-z_][A-Za-z0-9_]* bricht ab. */
export function bezeichner(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('Ungültiger Bezeichner.')
  return `"${name}"`
}

/** Das SQL für eine Tabelle: aus = public → Sperr-Schema, an = zurück. */
export function tabellenSql(modus: 'aus' | 'an', tabelle: string): string {
  const [von, nach] = modus === 'aus' ? ['public', SPERR_SCHEMA] : [SPERR_SCHEMA, 'public']
  return `ALTER TABLE ${bezeichner(von)}.${bezeichner(tabelle)} SET SCHEMA ${bezeichner(nach)}`
}

function abbruch(grund: string): never {
  console.error(`DB-Schalter: ${grund}`)
  process.exit(1)
}

async function main(): Promise<void> {
  const aufruf = leseAufruf(process.argv.slice(2))
  if (typeof aufruf === 'string') abbruch(aufruf)
  const { modus, kopie, tabellen } = aufruf
  const name = pruefeKopieName(kopie)
  if (name) abbruch(name)
  const env = pruefeOhneEnvDateien(pflichtOrdner(process.cwd()))
  if (env) abbruch(env)
  const adressen = pruefeDatenbankAdressen(pruefWerteAus(process.env))
  if (adressen) abbruch(adressen)
  const ziel = pruefeZielKopie(process.env['DATABASE_URL'], kopie as string)
  if (ziel) abbruch(ziel)
  if (modus === 'tabelle-aus' || modus === 'tabelle-an') {
    const erlaubt = tabellenAusSchema(readFileSync(join(werkzeugWorktree(), 'prisma', 'schema.prisma'), 'utf8'))
    const tab = pruefeTabellen(tabellen, erlaubt)
    if (tab) abbruch(tab)
    return schalteTabellen(modus === 'tabelle-aus' ? 'aus' : 'an', kopie as string, tabellen)
  }

  const url = process.env['DATABASE_URL'] as string
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: verwaltungsAdresse(url) })
  try {
    await client.connect()
  } catch {
    abbruch(`Verbindung zur Datenbank gescheitert (${hostUndPort(url)}).`)
  }
  // Abbrechen erst nach client.end(): process.exit im try ließe die Verbindung offen.
  let fehler: string | null = null
  try {
    const adresse = (await client.query<{ a: string | null }>('SELECT inet_server_addr()::text AS a')).rows[0]?.a ?? null
    if (!istLoopbackServerAdresse(adresse)) fehler = `Der Server meldet keine Loopback-Adresse (${hostUndPort(url)}).`
    else if ((await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [kopie])).rowCount !== 1) fehler = `Die Kopie ${kopie} gibt es nicht.`
    else {
      // Der Name ist oben auf [a-z0-9_] geprüft; ALTER DATABASE nimmt keinen Parameter.
      await client.query(`ALTER DATABASE "${kopie}" WITH ALLOW_CONNECTIONS ${modus === 'an' ? 'true' : 'false'}`)
      if (modus === 'aus') {
        await client.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [kopie])
      }
    }
  } catch (err) {
    // Nur der SQLSTATE-Code, nie der Text: Er kann Namen oder Adressen tragen.
    const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : 'unbekannt'
    fehler = `Befehl auf dem Datenbank-Server gescheitert (Code ${code}).`
  } finally {
    await client.end().catch(() => undefined)
  }
  if (fehler) abbruch(fehler)
  console.log(`DB-Schalter: ${kopie} ${modus === 'an' ? 'offen' : 'gesperrt'} (${hostUndPort(url)}).`)
}

/** Verbindet mit der Kopie selbst, prüft Server und Namen der DB, verschiebt die Tabellen in einer Transaktion. */
async function schalteTabellen(richtung: 'aus' | 'an', kopie: string, tabellen: readonly string[]): Promise<void> {
  const url = process.env['DATABASE_URL'] as string
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: url })
  try {
    await client.connect()
  } catch {
    abbruch(`Verbindung zur Kopie gescheitert (${hostUndPort(url)}; gesperrt mit db-aus?).`)
  }
  let fehler: string | null = null
  const erledigt: string[] = []
  try {
    const kopf = (await client.query<{ a: string | null; db: string }>('SELECT inet_server_addr()::text AS a, current_database() AS db')).rows[0]
    if (!istLoopbackServerAdresse(kopf?.a ?? null)) fehler = `Der Server meldet keine Loopback-Adresse (${hostUndPort(url)}).`
    else if (kopf?.db !== kopie) fehler = `Verbunden ist nicht die Kopie ${kopie}.`
    else {
      await client.query('BEGIN')
      // Hält die App gerade eine Sperre, lieber abbrechen als hängen.
      await client.query("SET LOCAL lock_timeout = '5s'")
      if (richtung === 'aus') await client.query(`CREATE SCHEMA IF NOT EXISTS ${bezeichner(SPERR_SCHEMA)}`)
      const [von, nach] = richtung === 'aus' ? ['public', SPERR_SCHEMA] : [SPERR_SCHEMA, 'public']
      for (const tabelle of tabellen) {
        const orte = (
          await client.query<{ s: string }>(
            "SELECT n.nspname AS s FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND c.relkind IN ('r', 'p') AND n.nspname = ANY($2)",
            [tabelle, ['public', SPERR_SCHEMA]],
          )
        ).rows.map((r) => r.s)
        if (orte.length === 1 && orte[0] === nach) continue
        if (orte.length !== 1 || orte[0] !== von) {
          fehler = `Tabelle ${tabelle} steht nicht eindeutig in ${von}.`
          break
        }
        await client.query(tabellenSql(richtung, tabelle))
        erledigt.push(tabelle)
      }
      if (fehler) await client.query('ROLLBACK')
      else {
        // Leeres Sperr-Schema wieder weg: Die Kopie sieht danach aus wie vorher.
        if (richtung === 'an') {
          const rest = await client.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 LIMIT 1", [SPERR_SCHEMA])
          if (rest.rowCount === 0) await client.query(`DROP SCHEMA IF EXISTS ${bezeichner(SPERR_SCHEMA)}`)
        }
        await client.query('COMMIT')
      }
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    // Nur der SQLSTATE-Code, nie der Text: Er kann Namen oder Adressen tragen.
    const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : 'unbekannt'
    fehler = `Befehl auf dem Datenbank-Server gescheitert (Code ${code}).`
  } finally {
    await client.end().catch(() => undefined)
  }
  if (fehler) abbruch(fehler)
  const zustand = richtung === 'aus' ? 'gesperrt' : 'frei'
  const neu = erledigt.length > 0 ? erledigt.join(', ') : 'nichts (schon so)'
  console.log(`DB-Schalter: ${kopie} ${tabellen.join(', ')} ${zustand}; geändert: ${neu} (${hostUndPort(url)}).`)
}

// Nur als Befehl ausführen, nicht beim Import in Tests.
if (process.argv[1]?.endsWith('db-schalter.ts')) {
  main().catch((err: unknown) => abbruch(`Unerwarteter Fehler (${err instanceof Error ? err.name : 'unbekannt'}).`))
}
