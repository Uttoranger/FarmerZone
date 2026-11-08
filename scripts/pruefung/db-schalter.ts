/**
 * Fehlerzustände für Bilder (Nr. 262): eine DB-KOPIE eines Fotografen sperren
 * bzw. wieder öffnen — dann zeigt sein Server Ladefehler und „Speichern
 * fehlgeschlagen“, ohne dass App-Code etwas davon weiß.
 *
 *   tsx scripts/pruefung/db-schalter.ts aus|an <kopie>
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
 */
import { hostUndPort, istLoopbackServerAdresse, pflichtOrdner, pruefeDatenbankAdressen, pruefeOhneEnvDateien, pruefWerteAus } from './sperre'

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

function abbruch(grund: string): never {
  console.error(`DB-Schalter: ${grund}`)
  process.exit(1)
}

async function main(): Promise<void> {
  const [modus, kopie, ...rest] = process.argv.slice(2)
  if ((modus !== 'aus' && modus !== 'an') || rest.length > 0) abbruch('Aufruf: db-schalter.ts aus|an <kopie>')
  const name = pruefeKopieName(kopie)
  if (name) abbruch(name)
  const env = pruefeOhneEnvDateien(pflichtOrdner(process.cwd()))
  if (env) abbruch(env)
  const adressen = pruefeDatenbankAdressen(pruefWerteAus(process.env))
  if (adressen) abbruch(adressen)
  const ziel = pruefeZielKopie(process.env['DATABASE_URL'], kopie as string)
  if (ziel) abbruch(ziel)

  const url = process.env['DATABASE_URL'] as string
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: verwaltungsAdresse(url) })
  await client.connect()
  try {
    const adresse = (await client.query<{ a: string | null }>('SELECT inet_server_addr()::text AS a')).rows[0]?.a ?? null
    if (!istLoopbackServerAdresse(adresse)) abbruch(`Der Server meldet keine Loopback-Adresse (${hostUndPort(url)}).`)
    const da = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [kopie])
    if (da.rowCount !== 1) abbruch(`Die Kopie ${kopie} gibt es nicht.`)
    // Der Name ist oben auf [a-z0-9_] geprüft; ALTER DATABASE nimmt keinen Parameter.
    await client.query(`ALTER DATABASE "${kopie}" WITH ALLOW_CONNECTIONS ${modus === 'an' ? 'true' : 'false'}`)
    if (modus === 'aus') {
      await client.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [kopie])
    }
  } finally {
    await client.end().catch(() => undefined)
  }
  console.log(`DB-Schalter: ${kopie} ${modus === 'an' ? 'offen' : 'gesperrt'} (${hostUndPort(url)}).`)
}

// Nur als Befehl ausführen, nicht beim Import in Tests.
if (process.argv[1]?.endsWith('db-schalter.ts')) {
  main().catch(() => abbruch('Verbindung zur Datenbank gescheitert.'))
}
