/**
 * Die gemeinsame Grundlage der Integrationstests: Faktoren, Aufräumen und der
 * Bau einer Checkout-Anfrage.
 *
 * DATENTRENNUNG OHNE ROLLBACK-TRICK. Jeder Test legt seine eigenen Objekte an
 * und räumt sie danach weg. Kein „alles in eine Transaktion und zurückrollen":
 * Genau die Transaktionsgrenzen sind hier ein Prüfgegenstand (`$transaction` im
 * Storno, bedingte Buchung im Checkout), und was in einer fremden Transaktion
 * läuft, verhält sich anders als im Ernstfall.
 *
 * DAS PRÄFIX IST DIE SICHERUNG. Alles, was ein Test anlegt, trägt `int-` im
 * Schlüssel: Hof-Slug, Produkt-ID, Sitzungs-ID, E-Mail-Adresse. `raeumeAuf()`
 * löscht ausschließlich danach. Die Seed-Daten (`hof-mueller`, `prod-*`) werden
 * nur GELESEN und bleiben unberührt — auch, damit eine unterbrochene Suite
 * nichts hinterlässt, das den nächsten Lauf kippt.
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { neueFrist } from '@/lib/reservierung'
import { kalendertagInWien } from '@/lib/servicegebuehr'
import { tagVersetzt } from '@/lib/kalender'
import { DB_BREMSEN, bremsSchluessel } from '@/lib/bremse-datenbank'
import { env } from '@/lib/env'
import type { Abgabe, Farm, Prisma, Product, User } from '@prisma/client'
import { liegengebliebene, type Zaehlung } from './zaehlung'

export const INT_PRAEFIX = 'int-'

let zaehler = 0

/**
 * Ein eindeutiger Schlüssel mit Präfix. Die Prozess-ID steckt mit drin, damit
 * zwei Vitest-Worker sich nie über denselben eindeutigen Index streiten.
 */
export function intKennung(was: string): string {
  zaehler += 1
  return `${INT_PRAEFIX}${was}-${process.pid}-${zaehler}`
}

/** Testdaten-Regeln aus TESTING_GUIDELINES §5: erfundene Namen, example.com. */
const TEST_TELEFON = '+43 660 0000000'

export async function erstelleHof(
  abweichend: Partial<Prisma.FarmUncheckedCreateInput> = {}
): Promise<{ farm: Farm; owner: User }> {
  const kennung = intKennung('hof')
  const owner = await prisma.user.create({
    data: {
      id: kennung,
      email: `${kennung}@example.com`,
      name: 'Max Mustermann',
      role: 'FARMER',
      emailVerified: true,
    },
  })

  const farm = await prisma.farm.create({
    data: {
      slug: kennung,
      name: 'Hof Test',
      ownerName: 'Max Mustermann',
      description: 'Erfundener Hof für die Integrationsschicht.',
      address: 'Teststraße 1',
      postalCode: '8700',
      city: 'Teststadt',
      phone: TEST_TELEFON,
      email: `${kennung}@example.com`,
      acceptsOnline: false,
      acceptsOnsite: true,
      isActive: true,
      isPaused: false,
      // Freigeschaltet, sonst lehnt der Checkout mit 409 ab, bevor er zur
      // eigentlichen Prüfung kommt (src/app/api/checkout/route.ts, 1b²).
      approvedAt: new Date(),
      betriebsnummer: 'LFBIS 0000000',
      betriebsstatus: 'PRIMAERPRODUKTION',
      ownerId: owner.id,
      // Ein Abholfenster an jedem Tag, 15–18 Uhr, ohne Höchstzahl: Der
      // Checkout nimmt nur Fenster an, die der Hof anbietet
      // (src/lib/abholfenster.ts) — checkoutAnfrage bestellt für morgen 15–18.
      pickupSlots: {
        create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '15:00', endTime: '18:00' })),
      },
      ...abweichend,
    },
  })

  return { farm, owner }
}

/**
 * Ein Hof mit echter Anmeldung: Der Besitzer geht durch Better Auth, damit die
 * Server-Actions ihre Berechtigung wirklich prüfen können. Der Rückgabewert
 * enthält den Cookie-Kopf, den ein gemocktes `headers()` ausliefern kann.
 */
export async function erstelleHofMitAnmeldung(
  abweichend: Partial<Prisma.FarmUncheckedCreateInput> = {}
): Promise<{ farm: Farm; ownerId: string; cookie: string }> {
  const kennung = intKennung('bauer')
  const email = `${kennung}@example.com`
  const passwort = 'test-passwort-1234'

  // Registrieren meldet seit Nr. 27 nicht mehr an (`autoSignIn: false`,
  // Register F6 „19b") — die Sitzung kommt aus der Anmeldung danach.
  await auth.api.signUpEmail({ body: { email, password: passwort, name: 'Max Mustermann' } })
  const angemeldet = await auth.api.signInEmail({
    body: { email, password: passwort },
    asResponse: true,
  })
  const cookie = angemeldet.headers
    .getSetCookie()
    .map((keks) => keks.split(';')[0])
    .join('; ')
  if (!cookie) throw new Error('Anmeldung lieferte kein Sitzungs-Cookie')

  const owner = await prisma.user.update({
    where: { email },
    data: { role: 'FARMER', emailVerified: true, phone: TEST_TELEFON },
    select: { id: true },
  })

  const farm = await prisma.farm.create({
    data: {
      slug: kennung,
      name: 'Hof Test',
      ownerName: 'Max Mustermann',
      description: 'Erfundener Hof für die Integrationsschicht.',
      address: 'Teststraße 1',
      postalCode: '8700',
      city: 'Teststadt',
      phone: TEST_TELEFON,
      email,
      acceptsOnline: false,
      acceptsOnsite: true,
      approvedAt: new Date(),
      ownerId: owner.id,
      ...abweichend,
    },
  })

  return { farm, ownerId: owner.id, cookie }
}

/**
 * Macht ein Konto zum Admin, wie die Admin-Wache ihn seit Nr. 115 verlangt
 * (Register N20): Recht, ein Passkey (ohne echtes Gerät — die Wache zählt nur
 * Zeilen) und frisch bestätigte Sitzungen. Für Tests, die Admin-Aktionen
 * prüfen, nicht die Anmeldung selbst (die prüft admin-passkey.int.test.ts).
 * Die Zeilen gehen mit dem Konto per Cascade.
 */
export async function machePasskeyAdmin(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { isAdmin: true } })
  await prisma.passkey.create({
    data: { id: intKennung('passkey'), userId, publicKey: 'int-schluessel', credentialID: intKennung('credential'), counter: 0, deviceType: 'singleDevice', backedUp: false },
  })
  await prisma.session.updateMany({ where: { userId }, data: { passkeyAm: new Date() } })
}

export async function erstelleProdukt(
  farmId: string,
  abweichend: { stock?: number; vatRate?: number; abgabe?: Abgabe; price?: number; name?: string } = {}
): Promise<Product> {
  return prisma.product.create({
    data: {
      id: intKennung('produkt'),
      farmId,
      name: abweichend.name ?? 'Testprodukt',
      price: abweichend.price ?? 10,
      vatRate: abweichend.vatRate ?? 10,
      unit: 'STUECK',
      stock: abweichend.stock ?? 1,
      isAvailable: true,
      abgabe: abweichend.abgabe ?? 'ALLE',
    },
  })
}

/**
 * Ein gültiger eigener Halt für diese Sitzung.
 *
 * PFLICHT für jeden Checkout-Test: `pruefeWarenkorb` behandelt eine FEHLENDE
 * eigene Reservierung wie eine abgelaufene (src/lib/reservierung.ts) — ohne
 * Halt antwortet der Checkout mit 409 RESERVIERUNG_ABGELAUFEN, und der Test
 * bewiese nur das.
 */
export async function setzeHalt(
  productId: string,
  sessionId: string,
  quantity: number,
  jetzt: Date = new Date()
): Promise<void> {
  await prisma.stockReservation.create({
    data: { productId, sessionId, quantity, expiresAt: neueFrist(jetzt) },
  })
}

export type CheckoutPosition = {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

/** Der morgige Kalendertag in Wien (JJJJ-MM-TT) — der Abholtag von checkoutAnfrage. */
export function morgenInWien(): string {
  return tagVersetzt(kalendertagInWien(new Date()), 1)
}

/**
 * Eine echte POST-Anfrage an /api/checkout — kein HTTP-Server, kein
 * Next-Prozess: Der Handler wird direkt importiert und mit dieser Anfrage
 * gerufen. Zod läuft dabei unverändert (TESTING_GUIDELINES §3).
 */
export function checkoutAnfrage(eingabe: {
  farm: { id: string; slug: string }
  sessionId: string
  positionen: CheckoutPosition[]
  idempotencyKey?: string
  kaeuferArt?: 'PRIVAT' | 'BETRIEB'
  betriebsnummer?: string
  customerEmail?: string
  paymentMethod?: 'ONSITE_CASH' | 'ONSITE_CARD' | 'ONLINE'
  /** Abholtag JJJJ-MM-TT, Standard: morgen in Wien. */
  pickupDate?: string
  /** Weitere Felder des Bodys, roh — auch ungültige (Teilen-Kanal, Nr. 21). */
  zusatz?: Record<string, unknown>
}): NextRequest {
  // Morgen im Wiener Kalender — so prüft der Checkout das Abholfenster.
  const datum = eingabe.pickupDate ?? morgenInWien()

  const koerper = {
    farmId: eingabe.farm.id,
    farmSlug: eingabe.farm.slug,
    sessionId: eingabe.sessionId,
    idempotencyKey: eingabe.idempotencyKey,
    customerName: 'Erika Mustermann',
    customerEmail: eingabe.customerEmail ?? `${intKennung('kundin')}@example.com`,
    customerPhone: TEST_TELEFON,
    pickupDate: datum,
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    paymentMethod: eingabe.paymentMethod ?? 'ONSITE_CASH',
    kaeuferArt: eingabe.kaeuferArt ?? 'PRIVAT',
    betriebsnummer: eingabe.betriebsnummer,
    items: eingabe.positionen,
    ...eingabe.zusatz,
  }

  return new NextRequest('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(koerper),
  })
}

/**
 * Wie viele Zeilen je Tabelle an einem Test-Konto (`User.email` mit `int-`) oder Test-Hof (`Farm.slug` mit
 * `int-`) hängen — und wie viele die Tabelle insgesamt hat. Welche Tabellen das sind, liest der Katalog:
 * jede Tabelle mit einem einspaltigen Fremdschlüssel auf `User` oder `Farm`.
 *
 * Warum: Better Auth vergibt Kennungen ohne `int-`; was an einem Konto hängt, trägt das Präfix nicht
 * selbst. Hängt eine Zeile mit ON DELETE SET NULL am Konto, bleibt sie nach dem Löschen des Kontos
 * liegen — ein Rundschreiben blieb so in der Test-DB. Gefunden wird das nur durch Zählen vor und
 * nach dem Aufräumen: Die Zeilen, die vorher an Test-Konten hingen, dürfen nachher nicht mehr da sein.
 */
type Bindung = { tabelle: string; bedingung: string }

let bindungen: Promise<Bindung[]> | null = null

function ladeBindungen(): Promise<Bindung[]> {
  bindungen ??= prisma
    .$queryRaw<{ tabelle: string; spalte: string; eigentuemer: string }[]>`
      SELECT c.conrelid::regclass::text AS tabelle, a.attname AS spalte, c.confrelid::regclass::text AS eigentuemer
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
        AND c.confrelid IN ('"User"'::regclass, '"Farm"'::regclass)
      ORDER BY 1, 2`
    .then((zeilen) => {
      // Eine Tabelle, ein Eintrag: mehrere Fremdschlüssel einer Tabelle gelten zusammen (ODER).
      const je = new Map<string, string[]>()
      for (const z of zeilen) {
        const eigentuemer =
          z.eigentuemer.replace(/"/g, '') === 'User'
            ? `(SELECT id FROM "User" WHERE email LIKE '${INT_PRAEFIX}%')`
            : `(SELECT id FROM "Farm" WHERE slug LIKE '${INT_PRAEFIX}%')`
        je.set(z.tabelle, [...(je.get(z.tabelle) ?? []), `"${z.spalte}" IN ${eigentuemer}`])
      }
      return [...je].map(([tabelle, teile]) => ({ tabelle, bedingung: teile.join(' OR ') }))
    })
  return bindungen
}

/** Zeilen je Tabelle mit Fremdschlüssel auf Konto oder Hof: insgesamt und die, die an Test-Konten oder -Höfen hängen. */
async function zaehleAnTestEigentuemern(): Promise<Zaehlung> {
  const liste = await ladeBindungen()
  const anfrage = liste
    .map(
      (b) =>
        `SELECT '${b.tabelle.replace(/'/g, "''")}' AS tabelle, (SELECT count(*)::int FROM ${b.tabelle}) AS gesamt, ` +
        `(SELECT count(*)::int FROM ${b.tabelle} WHERE ${b.bedingung}) AS haengt`
    )
    .join(' UNION ALL ')
  const zeilen = await prisma.$queryRawUnsafe<{ tabelle: string; gesamt: number; haengt: number }[]>(anfrage)
  return new Map(zeilen.map((z) => [z.tabelle, { gesamt: z.gesamt, haengt: z.haengt }]))
}

/**
 * Alles mit `int-`-Präfix löschen, in Fremdschlüssel-Reihenfolge.
 *
 * Bestellungen zuerst: Order → Farm und OrderItem → Product sind NICHT
 * kaskadierend (prisma/schema.prisma), ein Produkt mit Bestellposition ließe
 * sich sonst nicht löschen. Sitzungen und Konten des Bauern hängen
 * kaskadierend am User.
 */
export async function raeumeAuf(): Promise<void> {
  const vorher = await zaehleAnTestEigentuemern()
  const testBestellungen = {
    OR: [{ farm: { slug: { startsWith: INT_PRAEFIX } } }, { customerEmail: { startsWith: INT_PRAEFIX } }],
  } satisfies Prisma.OrderWhereInput
  // Die Bremse je Bestellung (Neuigkeiten, Nr. 46 Runde 1) zählt mit der
  // Bestell-ID im HMAC — ihre Zeilen tragen kein Präfix, deshalb über die
  // Kennungen der Testbestellungen, bevor diese weg sind.
  const kennungen = await prisma.order.findMany({ where: testBestellungen, select: { id: true } })
  if (kennungen.length > 0) {
    await prisma.rateLimitZaehler.deleteMany({
      where: {
        schluessel: {
          in: kennungen.map(({ id }) => bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.neuigkeitenBestellung.zweck, id)),
        },
      },
    })
  }
  // Ebenso die Drossel der Mail „Ein Hof hat geantwortet" (Nr. 105): Merkmal
  // ist die Kennung des Fadens — über die Fäden der Testhöfe, bevor sie weg sind.
  const faeden = await prisma.unterhaltung.findMany({ where: { farm: { slug: { startsWith: INT_PRAEFIX } } }, select: { id: true } })
  if (faeden.length > 0) {
    await prisma.rateLimitZaehler.deleteMany({
      where: { schluessel: { in: faeden.map(({ id }) => bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.antwortHofMail.zweck, id)) } },
    })
  }
  await prisma.order.deleteMany({ where: testBestellungen })
  await prisma.stockReservation.deleteMany({
    where: { sessionId: { startsWith: INT_PRAEFIX } },
  })
  await prisma.customerFarmSubscription.deleteMany({
    where: { customerEmail: { startsWith: INT_PRAEFIX } },
  })
  await prisma.product.deleteMany({
    where: {
      OR: [{ id: { startsWith: INT_PRAEFIX } }, { farm: { slug: { startsWith: INT_PRAEFIX } } }],
    },
  })
  // Monatsabrechnung → Farm ist RESTRICT (Aufbewahrungspflicht), sie muss vor
  // dem Hof weg. TeilenAufruf und BrennmaterialAngaben hängen kaskadierend an
  // Hof bzw. Produkt.
  await prisma.monatsabrechnung.deleteMany({ where: { farm: { slug: { startsWith: INT_PRAEFIX } } } })
  await prisma.farm.deleteMany({ where: { slug: { startsWith: INT_PRAEFIX } } })
  await prisma.user.deleteMany({ where: { email: { startsWith: INT_PRAEFIX } } })
  // Die Webhook-Tests vergeben Event-IDs mit Präfix; ohne Aufräumen hielte
  // die Idempotenz-Tabelle sie fest, und ein nächster Lauf sähe „schon erledigt".
  await prisma.webhookEvent.deleteMany({ where: { stripeEventId: { startsWith: INT_PRAEFIX } } })

  // Zählung nach dem Aufräumen: Zeilen, die vorher an Test-Konten oder -Höfen hingen, dürfen nicht stehen bleiben.
  const uebrig = liegengebliebene(vorher, await zaehleAnTestEigentuemern())
  if (uebrig.length > 0) {
    throw new Error(
      `raeumeAuf: Zeilen von Test-Konten oder Test-Höfen blieben liegen — ${uebrig.join(', ')}. ` +
        `Besser vor dem Löschen des Kontos über die gemerkten Kennungen wegräumen (TESTING_GUIDELINES §5).`
    )
  }
}
