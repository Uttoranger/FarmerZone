/**
 * Der Prüf-Seed (freigabe.md §36, Nr. 243) — nur auf einer frischen
 * Wegwerf-DB auf localhost.
 *
 *   pnpm pruefen:seed [--stichtag vergangenheit|zukunft] [--links <pfad>] [--passkey <pfad>]
 *
 * Läuft unter `env -i` mit der Liste aus pruef-env.sh (DATABASE_URL und
 * DIRECT_URL gleich, auf localhost; LINK_SECRET des Laufs). Schritte:
 *  1. Sperre (sperre.ts) — VOR jedem Import von Prisma, auth oder env.
 *  2. Verbinden, `inet_server_addr()` prüfen, Wegwerf-DB prüfen.
 *  3. Seed wie prisma/seed.ts (seed-lauf.ts), ohne dessen Abschlussausgabe —
 *     die nennt das Seed-Passwort, und das gehört in keine Datei.
 *  4. Stichtag hofpreisModellAb setzen; Gründung bleibt unberührt (P2).
 *  5. Admin: adminSeit, Inhaberin und die Zeile „Prüf-Passkey“; der private Schlüssel nur
 *     nach .nachtlauf/admin-passkey.json (chmod 600).
 *  6. Signierte Links je Zustand mit den Signier-Funktionen der App nach
 *     .nachtlauf/pruef-links.json (chmod 600).
 * Schreibt keine Codes und keine Passwörter; gibt nur Host und Port aus.
 */
import { randomBytes } from 'node:crypto'
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { leseSeedOptionen, stichtagFuer, type SeedOptionen } from './optionen'
import {
  hostUndPort,
  istLoopbackServerAdresse,
  pruefeDatenbankAdressen,
  pruefWerteAus,
  pruefeDatenbankZustand,
  pruefeOhneEnvDateien,
} from './sperre'

function abbruch(grund: string): never {
  console.error(`Prüf-Seed abgebrochen: ${grund}`)
  process.exit(1)
}

function schreibeGeheim(pfad: string, inhalt: unknown): void {
  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, `${JSON.stringify(inhalt, null, 2)}\n`, { mode: 0o600 })
  chmodSync(pfad, 0o600)
}

const TAG_MS = 24 * 60 * 60 * 1000

async function main(): Promise<void> {
  // 1. Sperre zuerst.
  const optionen = leseSeedOptionen(process.argv.slice(2))
  if (typeof optionen === 'string') abbruch(optionen)
  const adressen = pruefeDatenbankAdressen(pruefWerteAus(process.env))
  if (adressen) abbruch(adressen)
  const env = pruefeOhneEnvDateien([process.cwd()])
  if (env) abbruch(env)
  const url = process.env['DATABASE_URL'] as string
  console.log(`Prüf-Seed gegen ${hostUndPort(url)} (Stichtag: ${optionen.stichtag}).`)

  // 2. Verbinden und Server-Adresse prüfen — mit pg, noch ohne Prisma.
  const { SEED_KONTEN, SEED_HOEFE } = await import('../../prisma/seed-daten')
  const seedKonten = SEED_KONTEN.length + SEED_HOEFE.length
  const { default: pg } = await import('pg')
  const roh = new pg.Client({ connectionString: url })
  await roh.connect()
  try {
    const adresse = (await roh.query<{ a: string | null }>('SELECT inet_server_addr()::text AS a')).rows[0]?.a ?? null
    if (!istLoopbackServerAdresse(adresse)) abbruch(`Der Server meldet keine Loopback-Adresse (${hostUndPort(url)}).`)
    const passkeys = Number((await roh.query<{ n: string }>('SELECT count(*)::text AS n FROM "Passkey"')).rows[0]?.n ?? '0')
    const konten = Number((await roh.query<{ n: string }>('SELECT count(*)::text AS n FROM "User"')).rows[0]?.n ?? '0')
    const zustand = pruefeDatenbankZustand({ passkeys, konten, seedKonten })
    if (zustand) abbruch(zustand)
  } finally {
    await roh.end()
  }

  // 3. Erst jetzt Prisma, auth und den Seed laden.
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { auth } = await import('../../src/lib/auth')
  const { seed } = await import('../../prisma/seed-lauf')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  try {
    const jetzt = new Date()
    const ergebnis = await seed(prisma, auth, jetzt)
    const nachher = await prisma.user.count()
    if (nachher !== ergebnis.konten.length) abbruch(`Nach dem Seed ${nachher} Konten statt ${ergebnis.konten.length}.`)

    // 4. Stichtag.
    const stichtag = stichtagFuer(optionen.stichtag, jetzt)
    await prisma.plattformEinstellung.upsert({
      where: { id: 'plattform' },
      update: { hofpreisModellAb: stichtag },
      create: { id: 'plattform', hofpreisModellAb: stichtag },
    })

    // 5. Admin-Passkey.
    await legePasskeyAn(prisma, jetzt, optionen)

    // 6. Signierte Links.
    await schreibeLinks(prisma, jetzt, optionen)
    console.log(`Fertig: ${ergebnis.konten.length} Konten, Stichtag ${stichtag.toISOString().slice(0, 10)}, Passkey und Links unter .nachtlauf/.`)
  } finally {
    await prisma.$disconnect()
  }
}

type Prisma = InstanceType<(typeof import('@prisma/client'))['PrismaClient']>

async function legePasskeyAn(prisma: Prisma, jetzt: Date, optionen: SeedOptionen): Promise<void> {
  const { erzeugePruefPasskey } = await import('./passkey')
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' }, select: { id: true, isAdmin: true } })
  if (!admin.isAdmin) abbruch('Das Seed-Konto admin@example.com hat kein Admin-Recht.')
  // adminSeit vor dem Passkey: adminPasskeyWo zählt nur Passkeys ab adminSeit.
  const adminSeit = new Date(jetzt.getTime() - 60 * 60 * 1000)
  const passkey = erzeugePruefPasskey(admin.id, new Date(jetzt.getTime() - 30 * 60 * 1000))
  // Inhaberin, damit alle Admin-Seiten erreichbar sind (Geld braucht das Recht
  // „geld“, N35); die Boards zeigen das Betreiber-Konto mit allen Rechten.
  await prisma.user.update({ where: { id: admin.id }, data: { adminSeit, adminInhaber: true } })
  await prisma.passkey.create({ data: passkey.zeile })
  schreibeGeheim(optionen.passkey, passkey.geheim)
}

type LinkEintrag = { pfad: string | null; zustand: string; hinweis?: string }

async function schreibeLinks(prisma: Prisma, jetzt: Date, optionen: SeedOptionen): Promise<void> {
  const { bestellungPfad, bestaetigungsPfad, barBestaetigungsPfad, widerrufPfad } = await import('../../src/lib/bestell-link')
  const { generateUnsubscribeToken } = await import('../../src/lib/unsubscribe')
  const { abmeldeSeitenPfad } = await import('../../src/lib/abmelde-link')
  const { erzeugeAboBestaetigungsToken, aboBestaetigungsPfad } = await import('../../src/lib/abo-bestaetigung-token')

  const bestellung = async (nummer: string) =>
    prisma.order.findUniqueOrThrow({ where: { orderNumber: nummer }, include: { farm: { select: { slug: true, id: true } }, items: true } })

  // Ein falscher Link: gleiche Länge, falsche Signatur.
  const falsch = (pfad: string, feld: string) => pfad.replace(new RegExp(`${feld}=[^&]+`), `${feld}=${randomBytes(32).toString('base64url')}`)

  const links: Record<string, LinkEintrag> = {}
  for (const [nummer, zustand] of [
    ['TD-0004', 'online, abholbereit'],
    ['TD-0015', 'bar, bestätigt'],
    ['TD-0005', 'nicht abgeholt, Gebühr entfallen'],
    ['TD-0003', 'storniert, erstattet'],
    ['TD-0009', 'online, in Vorbereitung'],
  ] as const) {
    const b = await bestellung(nummer)
    links[`bestellung-${nummer}`] = { pfad: bestellungPfad(b.farm.slug, b.id), zustand }
    links[`bestaetigung-${nummer}`] = { pfad: bestaetigungsPfad(b.farm.slug, b.id), zustand }
  }
  const td4 = await bestellung('TD-0004')
  links['bestellung-ungueltig'] = { pfad: falsch(bestellungPfad(td4.farm.slug, td4.id), 's'), zustand: 'ungültige Signatur' }
  links['bestaetigung-ungueltig'] = { pfad: falsch(bestaetigungsPfad(td4.farm.slug, td4.id), 'sig'), zustand: 'ungültige Signatur' }
  links['widerruf-TD-0004'] = { pfad: widerrufPfad(td4.id), zustand: 'online, abholbereit' }
  links['widerruf-ungueltig'] = { pfad: falsch(widerrufPfad(td4.id), 'sig'), zustand: 'ungültige Signatur' }

  // Bar-Bestätigung: zwei neue Bestellungen als Abzug von TD-0015 (Beträge
  // unverändert übernommen, keine eigene Rechnung) — offen und verwaist.
  const vorlage = await bestellung('TD-0015')
  for (const [nummer, zustand, alter] of [
    ['TP-BAR-1', 'offen', 0],
    ['TP-BAR-2', 'abgelaufen (Frist vorbei)', 3],
  ] as const) {
    const token = randomBytes(24).toString('base64url')
    const eingang = new Date(jetzt.getTime() - alter * TAG_MS)
    const abholung = new Date(jetzt.getTime() + (alter === 0 ? 2 : -1) * TAG_MS)
    await prisma.order.create({
      data: {
        orderNumber: nummer,
        farmId: vorlage.farmId,
        customerEmail: vorlage.customerEmail,
        customerName: vorlage.customerName,
        customerPhone: vorlage.customerPhone,
        status: 'PENDING_CONFIRMATION',
        totalAmount: vorlage.totalAmount,
        pickupDate: abholung,
        pickupTimeStart: vorlage.pickupTimeStart,
        pickupTimeEnd: vorlage.pickupTimeEnd,
        paymentMethod: 'ONSITE_CASH',
        paymentStatus: 'PENDING',
        serviceFeeCents: vorlage.serviceFeeCents,
        serviceFeePercentApplied: vorlage.serviceFeePercentApplied,
        gebuehrModell: vorlage.gebuehrModell,
        kaeuferArt: vorlage.kaeuferArt,
        confirmationToken: token,
        createdAt: eingang,
        items: {
          create: vorlage.items.map((p) => ({
            productId: p.productId,
            productName: p.productName,
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            totalPrice: p.totalPrice,
            vatRate: p.vatRate,
          })),
        },
      },
    })
    links[`bar-bestaetigen-${nummer}`] = { pfad: barBestaetigungsPfad(vorlage.farm.slug, token), zustand }
  }
  links['bar-bestaetigen-ungueltig'] = {
    pfad: barBestaetigungsPfad(vorlage.farm.slug, randomBytes(24).toString('base64url')),
    zustand: 'unbekannter Token',
  }

  // Abmelden und Neuigkeiten: eigene Abo-Zeilen der Seed-Kundinnen.
  const mueller = await prisma.farm.findUniqueOrThrow({ where: { slug: 'hof-mueller' }, select: { id: true } })
  const sonnleiten = await prisma.farm.findUniqueOrThrow({ where: { slug: 'hof-sonnleiten' }, select: { id: true } })
  await prisma.customerFarmSubscription.create({
    data: { customerEmail: 'kundin@example.com', farmId: mueller.id, optInEmail: true, emailOptInAngefragtAm: new Date(jetzt.getTime() - 10 * TAG_MS), emailOptInBestaetigtAm: new Date(jetzt.getTime() - 9 * TAG_MS) },
  })
  const abmelden = abmeldeSeitenPfad(generateUnsubscribeToken('kundin@example.com', mueller.id))
  links['abmelden'] = { pfad: abmelden, zustand: 'gültig' }
  links['abmelden-ungueltig'] = { pfad: falsch(abmelden, 'token'), zustand: 'ungültiger Token' }

  const frisch = new Date(jetzt.getTime() - 60 * 60 * 1000)
  const alt = new Date(jetzt.getTime() - 30 * TAG_MS)
  const aboFrisch = await prisma.customerFarmSubscription.create({
    data: { customerEmail: 'kunde@example.com', farmId: mueller.id, optInEmail: false, emailOptInAngefragtAm: frisch },
  })
  const aboAlt = await prisma.customerFarmSubscription.create({
    data: { customerEmail: 'kunde@example.com', farmId: sonnleiten.id, optInEmail: false, emailOptInAngefragtAm: alt },
  })
  const neu = aboBestaetigungsPfad(erzeugeAboBestaetigungsToken(aboFrisch.id, frisch))
  links['neuigkeiten-bestaetigen'] = { pfad: neu, zustand: 'gültig' }
  // „Abgelaufen“ über den vorhandenen Parameter angefragtAm, ohne Uhr-Trick.
  links['neuigkeiten-abgelaufen'] = { pfad: aboBestaetigungsPfad(erzeugeAboBestaetigungsToken(aboAlt.id, alt)), zustand: 'abgelaufen' }
  links['neuigkeiten-ungueltig'] = { pfad: falsch(neu, 'token'), zustand: 'ungültiger Token' }

  for (const name of ['sicherheit-nicht-ich', 'konto-email-bestaetigen']) {
    links[name] = { pfad: null, zustand: 'nicht erzeugt', hinweis: 'Token von Better Auth, nicht mit den Signier-Funktionen der App herstellbar' }
  }
  schreibeGeheim(optionen.links, { erzeugtAm: jetzt.toISOString(), links })
}

main().catch((fehler: unknown) => {
  // Nur Art und Text des Fehlers, nie die Umgebung: Ein Prisma-Fehler kann die Adresse enthalten.
  const text = fehler instanceof Error ? fehler.message.replace(/postgres(ql)?:\/\/\S+/g, '(Adresse)') : 'unbekannter Fehler'
  abbruch(text)
})
