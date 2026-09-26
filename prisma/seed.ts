import { datenbankHost, istDevDatenbank, istTestDatenbank } from '../src/lib/umgebung'

/**
 * Der EINSTIEG des Seeds — hier und nur hier wird die Datenbank geprüft.
 *
 * Reihenfolge ist die Zusicherung: Die Sperre läuft, BEVOR ein Prisma-Client
 * entsteht. Deshalb stehen die Importe von `@prisma/client`, `auth` und dem
 * Lauf nicht oben, sondern in `main()` hinter der Prüfung — ein Import ganz
 * oben würde den Client anlegen, ehe jemand gefragt hat, wohin er zeigt.
 *
 * `pnpm db:seed` und das globalSetup der Integrationstests rufen diese Datei
 * (package.json → db:seed, tests/integration/setup/global-setup.ts). Der Lauf
 * selbst liegt in `seed-lauf.ts` und ist dadurch mit gemocktem Prisma prüfbar.
 */

/**
 * Sperre VOR dem ersten Schreibzugriff.
 *
 * Der Seed legt Daten an und überschreibt bestehende (`upsert`). Ein
 * versehentliches `pnpm db:seed` mit der falschen Adresse in der Umgebung
 * schriebe damit in die Produktionsdatenbank.
 *
 * ZWEI ALLOWLISTS, beide erlaubt. `istDevDatenbank` deckt `pnpm db:seed` ab.
 * `istTestDatenbank` muss dazu, weil das globalSetup der Integrationstests
 * diesen Seed gegen die TESTdatenbank ruft — und die darf auf dem
 * Docker-Dienstnamen `postgres` liegen, den die Dev-Allowlist nicht kennt.
 * Nur `istDevDatenbank` zu prüfen ließe einen solchen Lauf mitten im Setup
 * sterben. Beide zusammen bleiben eng: Produktion kommt durch keine von beiden.
 *
 * In der Meldung steht NUR der Host: Die Verbindungsadresse enthält das
 * Passwort und hat weder im Terminal noch in einem CI-Protokoll etwas verloren.
 */
function verlangeEigeneDatenbank(): void {
  const url = process.env['DATABASE_URL']
  if (istDevDatenbank(url) || istTestDatenbank(url)) return
  console.error(
    `\nSeed abgebrochen: DATABASE_URL zeigt auf ${datenbankHost(url)}.\n` +
      'Das ist weder die Dev- noch eine lokale Testdatenbank. Der Seed legt Daten\n' +
      'an und überschreibt bestehende — erlaubt sind localhost, 127.0.0.1, der\n' +
      'Docker-Dienstname postgres und die Dev-Datenbank.\n' +
      'Prüfe DATABASE_URL in .env.local.\n'
  )
  process.exit(1)
}

async function main(): Promise<void> {
  verlangeEigeneDatenbank()

  // Erst NACH der Sperre laden: Diese Importe bauen den Client und die
  // Auth-Instanz auf.
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { auth } = await import('../src/lib/auth')
  const { seed } = await import('./seed-lauf')

  // `!` ist hier sicher: `verlangeEigeneDatenbank()` oben hat die Adresse
  // gelesen und den Lauf abgebrochen, falls sie fehlt oder nicht erlaubt ist.
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! })
  const prisma = new PrismaClient({ adapter })

  console.log('Testdaten werden angelegt...\n')
  try {
    const ergebnis = await seed(prisma, auth)
    berichte(ergebnis)
  } finally {
    await prisma.$disconnect()
  }
}

/** Die Abschlussausgabe: was angelegt wurde, wo man sich anmeldet, was je Hof
 *  zu testen ist. Sie ist der eigentliche Nutzen des Seeds — ohne sie muss man
 *  die Datei lesen, um zu wissen, was in der Datenbank steht. */
function berichte(e: {
  konten: Array<{ email: string; wofuer: string }>
  hoefe: Array<{ name: string; slug: string; ort: string; hinweis: string }>
  produkte: number
  bestellungen: number
  handverkaeufe: number
  kostenposten: number
  meldungen: number
}): void {
  console.log(
    `✓ ${e.hoefe.length} Höfe · ${e.produkte} Produkte · ${e.bestellungen} Bestellungen · ` +
      `${e.handverkaeufe} Handverkäufe · ${e.kostenposten} Kostenposten · ${e.meldungen} Meldungen`
  )

  console.log('\nHÖFE')
  for (const h of e.hoefe) {
    console.log(`  /${h.slug}  ${h.name}, ${h.ort}`)
    console.log(`      ${h.hinweis}`)
  }

  console.log('\nANMELDUNG — Passwort überall: test1234')
  const breite = Math.max(...e.konten.map((k) => k.email.length))
  for (const k of e.konten) {
    console.log(`  ${k.email.padEnd(breite)}  ${k.wofuer}`)
  }

  console.log('\nAlle Daten sind erfunden. Keine Zeile stammt aus der Produktion.\n')
}

main().catch((fehler) => {
  console.error(fehler)
  process.exit(1)
})
