/**
 * Die Loopback-Sperre als Befehl — für fotograf.sh, pruef-env.sh und
 * passkey-browser.mjs, die keine TypeScript-Datei importieren können.
 *
 *   tsx scripts/pruefung/sperre-cli.ts [--ordner <pfad>]… [--db]
 *
 *   --ordner  Ordner, in dem keine .env-Datei liegen darf (mehrfach).
 *   --db      Adressen aus DATABASE_URL/DIRECT_URL prüfen, verbinden und
 *             `SELECT inet_server_addr()` verlangen: Loopback oder Socket.
 *
 * Exit 0 = erlaubt, Exit 1 = Abbruch. Meldungen nennen nur Host und Port.
 */
import { hostUndPort, istLoopbackServerAdresse, pruefeDatenbankAdressen, pruefeOhneEnvDateien, pruefWerteAus } from './sperre'

function abbruch(grund: string): never {
  console.error(`Prüf-Sperre: ${grund}`)
  process.exit(1)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const ordner: string[] = []
  let mitDb = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--db') mitDb = true
    else if (a === '--ordner' && args[i + 1]) ordner.push(args[++i] as string)
    else abbruch(`unbekannte Angabe ${a ?? ''}`)
  }

  const env = pruefeOhneEnvDateien(ordner)
  if (env) abbruch(env)
  if (!mitDb) return

  const adressen = pruefeDatenbankAdressen(pruefWerteAus(process.env))
  if (adressen) abbruch(adressen)

  // Erst NACH der Adressprüfung laden und verbinden.
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: process.env['DATABASE_URL'] })
  try {
    await client.connect()
    const antwort = await client.query<{ adresse: string | null }>('SELECT inet_server_addr()::text AS adresse')
    const adresse = antwort.rows[0]?.adresse ?? null
    if (!istLoopbackServerAdresse(adresse)) abbruch(`Der Datenbank-Server meldet keine Loopback-Adresse (${hostUndPort(process.env['DATABASE_URL'])}).`)
  } finally {
    await client.end().catch(() => undefined)
  }
  console.log(`Prüf-Sperre: frei (${hostUndPort(process.env['DATABASE_URL'])}).`)
}

main().catch(() => abbruch('Verbindung zur Datenbank gescheitert.'))
