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
import type { Abgabe, Farm, Prisma, Product, User } from '@prisma/client'

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
  }

  return new NextRequest('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(koerper),
  })
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
  await prisma.order.deleteMany({
    where: {
      OR: [
        { farm: { slug: { startsWith: INT_PRAEFIX } } },
        { customerEmail: { startsWith: INT_PRAEFIX } },
      ],
    },
  })
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
}
