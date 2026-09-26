import type { Prisma } from '@prisma/client'
import { berechneServicegebuehr } from '../src/lib/servicegebuehr'
import {
  SEED_BESTELLUNGEN,
  SEED_HANDVERKAEUFE,
  SEED_HOEFE,
  SEED_KONTEN,
  SEED_KOSTENPOSTEN,
  SEED_MELDUNGEN,
  SEED_PASSWORT,
  type SeedHof,
  type SeedProdukt,
} from './seed-daten'

/**
 * Der Seed-LAUF — was geschrieben wird, in welcher Reihenfolge.
 *
 * ⚠️ NUR über den Einstieg `prisma/seed.ts` aufrufen oder in Tests mit
 * GEMOCKTEM Prisma. Diese Datei prüft die Datenbank NICHT: Die Sperre
 * `istDevDatenbank` läuft im Einstieg, bevor dort überhaupt ein Prisma-Client
 * entsteht. Wer `seed()` mit einem echten Client aufruft, umgeht sie — und
 * schreibt im schlimmsten Fall in die Produktionsdatenbank.
 *
 * Warum überhaupt getrennt: Der Einstieg prüfte die Sperre auf Modulebene und
 * rief `main()` beim Import. Ein Test, der die Datei importiert, wäre damit
 * gestorben, bevor er etwas mocken konnte — die Zusicherung „ein zweiter Lauf
 * erzeugt keine Dubletten" war nicht prüfbar. Jetzt ist sie es.
 *
 * IDEMPOTENZ IST DIE REGEL, NICHT DIE HOFFNUNG: Jede Zeile hat einen stabilen
 * Schlüssel und wird mit `upsert` geschrieben. `createMany({ skipDuplicates })`
 * kommt hier nicht mehr vor — es überspringt nur, was einen EINDEUTIGEN Index
 * verletzt, und `PickupSlot` wie `ManualSale` haben keinen. Vor diesem Sprint
 * legte deshalb jeder `pnpm db:seed` zwei Abholzeiten und drei Handverkäufe
 * erneut an.
 */

/** Was der Lauf von Better Auth braucht — nicht mehr, damit ein Test stubben kann. */
export type SeedAuth = {
  api: {
    signUpEmail(eingabe: {
      body: { email: string; password: string; name: string }
    }): Promise<{ user?: { id: string } | null } | null>
  }
}

/**
 * Was der Lauf von Prisma braucht — genau diese sieben Tabellen und genau eine
 * Schreibart je Tabelle.
 *
 * Die ARGUMENTE sind mit den echten Prisma-Typen getippt, nicht mit `unknown`:
 * Nur so fällt ein falscher Feldname beim Typecheck auf und nicht erst beim
 * Lauf gegen die Datenbank. Die RÜCKGABEN sind schmal — ein Test reicht ein
 * Objekt mit genau diesen Feldern herein und braucht keinen echten Client.
 */
export type SeedPrisma = {
  user: {
    findUnique(argumente: Prisma.UserFindUniqueArgs): Promise<{ id: string } | null>
    update(argumente: Prisma.UserUpdateArgs): Promise<unknown>
  }
  farm: {
    findUnique(argumente: Prisma.FarmFindUniqueArgs): Promise<HofStand | null>
    upsert(argumente: Prisma.FarmUpsertArgs): Promise<HofStand>
  }
  product: { upsert(argumente: Prisma.ProductUpsertArgs): Promise<unknown> }
  pickupSlot: { upsert(argumente: Prisma.PickupSlotUpsertArgs): Promise<unknown> }
  manualSale: { upsert(argumente: Prisma.ManualSaleUpsertArgs): Promise<unknown> }
  order: { upsert(argumente: Prisma.OrderUpsertArgs): Promise<unknown> }
  kostenposten: { upsert(argumente: Prisma.KostenpostenUpsertArgs): Promise<unknown> }
  meldung: { upsert(argumente: Prisma.MeldungUpsertArgs): Promise<unknown> }
}

/**
 * Der Stand eines Hofes, soweit der Lauf ihn braucht: die Gebühreneinstellung
 * (für die Bestellrechnung) und die Felder, die bei einem Bestandshof nur
 * ERGÄNZT werden, wenn sie leer sind.
 */
type HofStand = {
  id: string
  slug: string
  name: string
  serviceFeePercent: number | string | { toString(): string }
  serviceFeeMinCents: number
  serviceFeeActiveFrom: Date | null
  latitude: number | null
  longitude: number | null
  betriebsnummer: string | null
}

/** Die Servicegebühr gilt ab hier — sonst wären alle Bestellungen gebührenfrei. */
const GEBUEHR_AKTIV_VOR_TAGEN = 200

/** Die Gebühreneinstellung der NEUEN Höfe — dieselben Werte wie die
 *  Schema-Vorgaben. Sie wird auf den Hof GESCHRIEBEN, und die Bestellrechnung
 *  liest sie danach von dort zurück: Sonst stünde in den Bestellungen eine
 *  Gebühr, die nicht zu der Einstellung passt, aus der /admin/finanzen rechnet. */
const GEBUEHR_PROZENT = 4.9
const GEBUEHR_MIND_CENTS = 50

const TAG_MS = 24 * 60 * 60 * 1000

function vorTagen(jetzt: Date, tage: number): Date {
  return new Date(jetzt.getTime() - tage * TAG_MS)
}

/** Der Erste eines Monats, `zurueck` Monate vor dem laufenden — als UTC-Datum
 *  für die DATE-Spalten von `Kostenposten` (src/lib/finanzen.ts). */
function ersterDesMonats(jetzt: Date, zurueck: number): Date {
  return new Date(Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth() - zurueck, 1))
}

/** Euro → ganze Cent. */
function cents(euro: number): number {
  return Math.round(euro * 100)
}

/**
 * Ein Konto anlegen — oder das vorhandene nehmen. Better Auth macht das
 * Passwort-Hashing; ein zweiter Lauf legt nichts erneut an.
 */
async function konto(
  prisma: SeedPrisma,
  auth: SeedAuth,
  daten: {
    email: string
    name: string
    telefon: string
    rolle: 'FARMER' | 'CUSTOMER'
    istAdmin?: boolean
  }
): Promise<string> {
  // `isAdmin` wird nur GESETZT, nie zurückgenommen: Ein Seed-Lauf darf einem
  // Konto, dem jemand in Dev von Hand das Betreiberrecht gegeben hat, nicht
  // stillschweigend das Recht entziehen. Deshalb steht das Feld nur im Objekt,
  // wenn die Fixture es ausdrücklich verlangt.
  const felder = {
    role: daten.rolle,
    phone: daten.telefon,
    emailVerified: true,
    ...(daten.istAdmin === true ? { isAdmin: true } : {}),
  }

  const vorhanden = await prisma.user.findUnique({ where: { email: daten.email } })
  if (vorhanden) {
    // Auch beim zweiten Lauf setzen: Eine alte Dev-DB kann das Konto ohne
    // Rolle oder Telefonnummer haben.
    await prisma.user.update({ where: { id: vorhanden.id }, data: felder })
    return vorhanden.id
  }

  const ergebnis = await auth.api.signUpEmail({
    body: { email: daten.email, password: SEED_PASSWORT, name: daten.name },
  })
  const id = ergebnis?.user?.id
  if (!id) throw new Error(`Konto ${daten.email} konnte nicht angelegt werden`)

  await prisma.user.update({ where: { id }, data: felder })
  return id
}

/** Ein Produkt schreiben. Taxonomie und Kennzeichnung stehen auch im `update`,
 *  damit ein Lauf auf einer alten Dev-DB Bestandsprodukte nachrüstet. */
async function produkt(prisma: SeedPrisma, farmId: string, p: SeedProdukt): Promise<void> {
  const gemeinsam = {
    name: p.name,
    description: p.beschreibung,
    price: p.preis.toFixed(2),
    vatRate: p.mwst.toFixed(2),
    unit: p.einheit,
    unitSize: p.gebindeGroesse === null ? null : p.gebindeGroesse.toFixed(3),
    stock: p.bestand,
    isAvailable: p.imShop,
    category: p.category,
    subcategory: p.subcategory,
    labels: p.labels,
    allergens: p.allergene ?? [],
    abgabe: p.abgabe ?? 'ALLE',
    requiresCool: p.kuehlpflichtig === true,
    requiresFreezer: p.gefrierpflichtig === true,
    seasonStart: p.saisonVon ?? null,
    seasonEnd: p.saisonBis ?? null,
    // NUR wenn die Fixture es ausdrücklich sagt. Ob eine Position zur
    // 55.000-€-Grenze zählt, ist eine Steuerfrage und gehört dem Hof — der Seed
    // leitet sie nicht aus der Kategorie ab (siehe SeedProdukt.zaehltZurGrenze).
    ...(p.zaehltZurGrenze === undefined ? {} : { countsTowardLimit: p.zaehltZurGrenze }),
  }

  // `bestaetigtAm` steht nicht in den Fixtures: Es ist ein Zeitpunkt, und
  // Zeitpunkte entstehen im Lauf, nicht in den Daten. `registrierungsnummer`
  // bleibt null — Altlast, die Nummer gehört dem Hof.
  const kennzeichnung =
    p.futter === undefined
      ? undefined
      : { ...p.futter, registrierungsnummer: null, bestaetigtAm: new Date() }

  await prisma.product.upsert({
    where: { id: p.id },
    update: {
      ...gemeinsam,
      ...(kennzeichnung ? { futter: { upsert: { create: kennzeichnung, update: kennzeichnung } } } : {}),
    },
    create: {
      id: p.id,
      farmId,
      ...gemeinsam,
      ...(kennzeichnung ? { futter: { create: kennzeichnung } } : {}),
    },
  })
}

/** Ein Hof samt Inhaber-Konto, Abholzeiten und Produkten. */
async function hof(
  prisma: SeedPrisma,
  auth: SeedAuth,
  h: SeedHof,
  jetzt: Date
): Promise<HofStand> {
  const ownerId = await konto(prisma, auth, {
    email: h.inhaber.email,
    name: h.inhaber.name,
    telefon: h.inhaber.telefon,
    rolle: 'FARMER',
  })

  const stamm = {
    name: h.name,
    ownerName: h.inhaber.name,
    description: h.beschreibung,
    address: h.adresse,
    postalCode: h.plz,
    city: h.ort,
    phone: h.inhaber.telefon,
    email: h.inhaber.email,
    acceptsOnline: h.nimmtOnline,
    acceptsOnsite: h.nimmtVorOrt,
    isActive: true,
    isPaused: false,
    betriebsnummer: h.betriebsnummer,
    betriebsstatus: h.betriebsstatus,
    latitude: h.breite,
    longitude: h.laenge,
    serviceFeePercent: GEBUEHR_PROZENT.toFixed(2),
    serviceFeeMinCents: GEBUEHR_MIND_CENTS,
    serviceFeeActiveFrom: vorTagen(jetzt, GEBUEHR_AKTIV_VOR_TAGEN),
    approvedAt: h.freigegeben ? vorTagen(jetzt, 120) : null,
  }

  /**
   * Ein BESTANDSHOF (der Pilothof) wird nur ERGÄNZT, und zwar wörtlich: Jedes
   * Feld nur dann, wenn es leer ist. Alles andere — Adresse, Beschreibung,
   * Freischaltdatum, Gebühreneinstellung — bleibt, wie es ist. Ein `update` mit
   * relativen Datumswerten hätte die Wirklichkeit bei jedem Lauf verschoben.
   */
  const ergaenzung: Prisma.FarmUpdateInput = {}
  if (h.bestandsHof === true) {
    const stand = await prisma.farm.findUnique({ where: { slug: h.slug } })
    if (stand === null || stand.latitude === null) ergaenzung.latitude = h.breite
    if (stand === null || stand.longitude === null) ergaenzung.longitude = h.laenge
    if (stand === null || stand.betriebsnummer === null) {
      ergaenzung.betriebsnummer = h.betriebsnummer
      ergaenzung.betriebsstatus = h.betriebsstatus
    }
    if (stand === null || stand.serviceFeeActiveFrom === null) {
      ergaenzung.serviceFeeActiveFrom = vorTagen(jetzt, GEBUEHR_AKTIV_VOR_TAGEN)
    }
  }

  const angelegt = await prisma.farm.upsert({
    where: { slug: h.slug },
    update: h.bestandsHof === true ? ergaenzung : stamm,
    create: { slug: h.slug, ownerId, ...stamm },
  })

  for (const [nummer, zeit] of h.abholzeiten.entries()) {
    // Stabile ID statt createMany: PickupSlot hat keinen eindeutigen Index,
    // `skipDuplicates` überspränge also nichts.
    const id = `slot-${h.slug}-${nummer}`
    const felder = { dayOfWeek: zeit.tag, startTime: zeit.von, endTime: zeit.bis, isActive: true }
    await prisma.pickupSlot.upsert({
      where: { id },
      update: felder,
      create: { id, farmId: angelegt.id, ...felder },
    })
  }

  for (const p of h.produkte) await produkt(prisma, angelegt.id, p)

  return angelegt
}

export type SeedErgebnis = {
  /** Für die Abschlussausgabe: E-Mail → wofür das Konto gut ist. */
  konten: Array<{ email: string; wofuer: string }>
  /** Für die Abschlussausgabe: Hof → ein Satz, was dort zu testen ist. */
  hoefe: Array<{ name: string; slug: string; ort: string; hinweis: string }>
  produkte: number
  bestellungen: number
  handverkaeufe: number
  kostenposten: number
  meldungen: number
}

/**
 * Legt den ganzen Testdatensatz an. Zweimal aufrufbar: jede Zeile wird über
 * ihren stabilen Schlüssel geschrieben.
 *
 * `jetzt` ist ein Parameter, nicht `new Date()` im Rumpf — alle Zeitpunkte
 * liegen relativ dazu, und ein Test kann die Uhr festhalten.
 */
export async function seed(
  prisma: SeedPrisma,
  auth: SeedAuth,
  jetzt: Date = new Date()
): Promise<SeedErgebnis> {
  const konten: SeedErgebnis['konten'] = []
  const hoefe: SeedErgebnis['hoefe'] = []

  // 1. Betreiber und Kundinnen
  for (const k of SEED_KONTEN) {
    await konto(prisma, auth, k)
    konten.push({ email: k.email, wofuer: k.wofuer })
  }

  // 2. Höfe samt Inhabern, Abholzeiten und Produkten
  const hoefeNachSlug = new Map<string, HofStand>()
  const produkte = new Map<string, { name: string; preisCents: number; mwst: number }>()
  let produktZahl = 0

  for (const h of SEED_HOEFE) {
    const angelegt = await hof(prisma, auth, h, jetzt)
    hoefeNachSlug.set(h.slug, angelegt)
    konten.push({ email: h.inhaber.email, wofuer: `${h.name} — /${h.slug}` })
    hoefe.push({ name: h.name, slug: h.slug, ort: `${h.plz} ${h.ort}`, hinweis: h.testhinweis })
    for (const p of h.produkte) {
      produkte.set(p.id, { name: p.name, preisCents: cents(p.preis), mwst: p.mwst })
      produktZahl++
    }
  }

  // 3. Bestellungen. Warenpreis und Servicegebühr rechnet der ECHTE Helfer
  //    (src/lib/servicegebuehr.ts) — ein Testdatensatz mit eigener
  //    Gebührenrechnung wäre eine zweite Wahrheit.
  for (const b of SEED_BESTELLUNGEN) {
    const hofStand = hoefeNachSlug.get(b.hofSlug)
    if (!hofStand) throw new Error(`Bestellung ${b.nummer}: Hof ${b.hofSlug} fehlt`)
    const farmId = hofStand.id

    const eingang = vorTagen(jetzt, b.vorTagen)
    const positionen = b.positionen.map((pos) => {
      const p = produkte.get(pos.produktId)
      if (!p) throw new Error(`Bestellung ${b.nummer}: Produkt ${pos.produktId} fehlt`)
      return { ...pos, ...p, zeileCents: p.preisCents * pos.menge }
    })
    const warenpreisCents = positionen.reduce((summe, p) => summe + p.zeileCents, 0)
    // Die Einstellung kommt vom HOF, wie sie eben geschrieben wurde — nicht aus
    // einer Konstante hier. Bei einem Bestandshof mit abweichenden Werten
    // rechnet der Seed damit dieselbe Gebühr, die die Plattform gerechnet hätte.
    const { gebuehrCents, prozentAngewendet } = berechneServicegebuehr(
      warenpreisCents,
      {
        serviceFeePercent: hofStand.serviceFeePercent,
        serviceFeeMinCents: hofStand.serviceFeeMinCents,
        serviceFeeActiveFrom: hofStand.serviceFeeActiveFrom,
      },
      eingang
    )

    const kunde = SEED_KONTEN.find((k) => k.email === b.kundenEmail)
    if (!kunde) throw new Error(`Bestellung ${b.nummer}: Konto ${b.kundenEmail} fehlt`)
    const abholung = vorTagen(jetzt, Math.max(0, b.vorTagen - 2))
    const danach = vorTagen(jetzt, Math.max(0, b.vorTagen - 1))

    const felder = {
      farmId,
      customerEmail: b.kundenEmail,
      customerName: kunde.name,
      customerPhone: kunde.telefon,
      status: b.status,
      totalAmount: (warenpreisCents / 100).toFixed(2),
      pickupDate: abholung,
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: b.zahlart,
      paymentStatus: b.zahlstatus,
      // Auch bei REFUNDED: Erstattet werden kann nur, was vorher bezahlt war.
      paidAt: b.zahlstatus === 'PAID' || b.zahlstatus === 'REFUNDED' ? eingang : null,
      serviceFeeCents: gebuehrCents,
      serviceFeePercentApplied: prozentAngewendet === null ? null : prozentAngewendet.toFixed(2),
      serviceFeeRefundedAt: b.gebuehrEntfallen === true ? danach : null,
      kaeuferArt: b.kaeuferArt,
      // Snapshot der Eingabe, nur bei BETRIEB — erfunden wie alles hier.
      betriebsnummer: b.kaeuferArt === 'BETRIEB' ? 'TEST-99999' : null,
      cancelledAt: b.status === 'CANCELLED' ? danach : null,
      cancelReason: b.status === 'CANCELLED' ? 'Testdaten: storniert' : null,
      pickedUpAt: b.status === 'PICKED_UP' ? abholung : null,
      createdAt: eingang,
    }

    await prisma.order.upsert({
      where: { orderNumber: b.nummer },
      // Die Positionen stehen NICHT im `update`: Sie hängen an der Bestellung
      // und wären beim zweiten Lauf sonst doppelt.
      update: felder,
      create: {
        orderNumber: b.nummer,
        ...felder,
        items: {
          create: positionen.map((p) => ({
            productId: p.produktId,
            productName: p.name,
            quantity: p.menge,
            unitPrice: (p.preisCents / 100).toFixed(2),
            totalPrice: (p.zeileCents / 100).toFixed(2),
            // MwSt-Satz zum Kaufzeitpunkt — ein Snapshot, nie nachgelesen.
            vatRate: p.mwst.toFixed(2),
          })),
        },
      },
    })
  }

  // 4. Handverkäufe
  for (const v of SEED_HANDVERKAEUFE) {
    const farmId = hoefeNachSlug.get(v.hofSlug)?.id
    if (!farmId) throw new Error(`Handverkauf ${v.id}: Hof ${v.hofSlug} fehlt`)
    const felder = {
      productId: v.produktId,
      productName: v.produktName,
      quantity: v.menge,
      unit: v.einheit,
      totalAmount: v.betrag.toFixed(2),
      channel: v.kanal,
      saleDate: vorTagen(jetzt, v.vorTagen),
      note: v.notiz,
    }
    await prisma.manualSale.upsert({
      where: { id: v.id },
      update: felder,
      create: { id: v.id, farmId, ...felder },
    })
  }

  // 5. Kostenposten der Plattform
  for (const k of SEED_KOSTENPOSTEN) {
    const felder = {
      name: k.name,
      kategorie: k.kategorie,
      betrag: k.betrag,
      rhythmus: k.rhythmus,
      ab: ersterDesMonats(jetzt, k.abVorMonaten),
      bis: k.bisVorMonaten === null ? null : ersterDesMonats(jetzt, k.bisVorMonaten),
      notiz: k.notiz,
    }
    await prisma.kostenposten.upsert({
      where: { id: k.id },
      update: felder,
      create: { id: k.id, ...felder },
    })
  }

  // 6. Briefkasten
  for (const m of SEED_MELDUNGEN) {
    const felder = {
      art: m.art,
      status: m.status,
      text: m.text,
      seiteUrl: m.seiteUrl,
      userAgent: 'Testdaten (Seed)',
      viewport: '375x812',
      farmId: m.hofSlug === null ? null : (hoefeNachSlug.get(m.hofSlug)?.id ?? null),
      clusterKey: m.clusterKey,
      createdAt: vorTagen(jetzt, m.vorTagen),
    }
    await prisma.meldung.upsert({
      where: { id: m.id },
      update: felder,
      create: { id: m.id, ...felder },
    })
  }

  return {
    konten,
    hoefe,
    produkte: produktZahl,
    bestellungen: SEED_BESTELLUNGEN.length,
    handverkaeufe: SEED_HANDVERKAEUFE.length,
    kostenposten: SEED_KOSTENPOSTEN.length,
    meldungen: SEED_MELDUNGEN.length,
  }
}
