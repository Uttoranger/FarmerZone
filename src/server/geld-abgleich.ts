import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import { alsCents } from '@/lib/order-totals'
import { ohneTestzahlungenWhere } from '@/lib/testzahlung'
import { umsatzBestellungWhere } from '@/lib/umsatz'
import { utcTagesbeginn } from '@/lib/betrieb'
import { monatVerschoben, monatsgrenzenWienFuer, type Monatsschluessel } from '@/lib/servicegebuehr'
import {
  GELD_ABGLEICH_FENSTER_MS,
  GELD_ABWEICHUNG_ART,
  STRIPE_GEBUEHR_ART,
  abweichungArt,
  abweichungCents,
  erwartetLautDatenbank,
  gleicheAb,
  leseAbweichungArt,
  stripeGebuehrenJeTag,
  type BestellungFuerAbgleich,
  type OffeneAbweichung,
  type SaldoBuchung,
  type StripeZahlung,
} from '@/lib/geld-abgleich'
import { erstattungenImMonat, stripeGebuehrenImMonat, type ErstattungenMonat } from '@/lib/finanzen'
import type { AblaufLaufDaten } from '@/lib/betrieb'

/*
 * Der Geld-Abgleich mit Stripe (Register N37, Nr. 191) — die Servergrenze.
 * Der Ablauf `geld-abgleich` (täglich 06:30 UTC, /api/cron/geld-abgleich)
 * liest bei Stripe NUR LESEND: PaymentIntents, Erstattungen und Buchungen im
 * Saldo des Plattformkontos (Balance Transactions) der letzten 48 Stunden —
 * mit `expand` statt einer Abfrage je Zahlung, den Seiten folgt die
 * Auto-Paginierung des SDK. Der Vergleich ist rein (src/lib/geld-abgleich.ts).
 *
 * ERST ALLES LESEN, DANN SCHREIBEN: Scheitert Stripe mittendrin, schreibt der
 * Lauf nichts — sonst hielte er eine offene Abweichung für geklärt, nur weil
 * ihre Zahlung nicht mehr gelesen wurde. Der Fehler geht als Warnung an
 * Sentry (nur Art und Klasse, nie ein Betrag oder eine Kennung) und als
 * `GeldAbgleichStripeFehler` an den Herzschlag: Der Ablauf steht dann auf
 * Admin › Betrieb als gescheitert; die anderen Abläufe laufen davon
 * unberührt weiter (jeder hat seine eigene Route).
 *
 * Offene Abweichungen prüft jeder Lauf mit — auch wenn ihre Zahlung älter als
 * 48 Stunden ist: Ihr PaymentIntent wird einzeln nachgeladen (höchstens
 * NACHLADEN_HOECHSTENS). So verschwindet eine Abweichung erst, wenn Datenbank
 * und Stripe wieder übereinstimmen („erledigt verschwindet von selbst“, N32).
 *
 * Nie Adresse, Name, Inhalt oder Token: gelesen werden nur Kennungen,
 * Stände und Beträge; gespeichert nur Kennung und Cent.
 */

/** Höchstens so viele PaymentIntents lädt ein Lauf einzeln nach (offene Abweichungen, Zahlungen ohne Treffer in der Liste). */
export const NACHLADEN_HOECHSTENS = 50

/** Schutz gegen eine endlose Liste: mehr Einträge je Liste liest ein Lauf nicht. */
export const LISTE_HOECHSTENS = 10_000

/** Stripe war beim Lesen nicht erreichbar oder lehnte ab — der Lauf schreibt nichts. */
export class GeldAbgleichStripeFehler extends Error {
  constructor() {
    super('Geld-Abgleich: Stripe nicht gelesen')
    this.name = 'GeldAbgleichStripeFehler'
  }
}

export type GeldAbgleichErgebnis = {
  zahlungen: number
  verglichen: number
  abweichungen: number
  neu: number
  geklaert: number
  stripeGebuehrTage: number
}

async function alle<T>(liste: AsyncIterable<T>): Promise<T[]> {
  const ergebnis: T[] = []
  for await (const eintrag of liste) {
    ergebnis.push(eintrag)
    if (ergebnis.length >= LISTE_HOECHSTENS) break
  }
  return ergebnis
}

/** Ein PaymentIntent als Zahlung in Cent — die Erstattung aus der letzten Belastung (expand). */
function alsZahlung(pi: Stripe.PaymentIntent): StripeZahlung {
  const belastung = pi.latest_charge !== null && typeof pi.latest_charge === 'object' ? pi.latest_charge : null
  return {
    paymentIntentId: pi.id,
    betragCents: pi.amount_received,
    gebuehrCents: pi.application_fee_amount ?? 0,
    erstattetCents: belastung?.amount_refunded ?? 0,
  }
}

function istNichtGefunden(err: unknown): boolean {
  const e = err as { code?: unknown; statusCode?: unknown } | null
  return e?.code === 'resource_missing' || e?.statusCode === 404
}

/** Die offenen Abweichungen, wie sie in BetriebMessung stehen (Art, Tag, Wert). */
async function ladeAbweichungZeilen(): Promise<Array<{ tag: Date; art: string; wert: bigint }>> {
  return prisma.betriebMessung.findMany({ where: { art: { startsWith: `${GELD_ABWEICHUNG_ART}:` } }, select: { tag: true, art: true, wert: true } })
}

const BESTELLUNG_FUER_ABGLEICH = {
  id: true,
  orderNumber: true,
  stripePaymentIntentId: true,
  paymentStatus: true,
  totalAmount: true,
  serviceFeeCents: true,
  platformFeeAmount: true,
  erstattetCents: true,
  serviceFeeRefundedAt: true,
  items: { select: { totalPrice: true } },
} as const

/**
 * Der tägliche Lauf (Herzschlag in der Route). Liest Stripe, vergleicht,
 * schreibt Abweichungen und Stripe-Gebühren je Tag in BetriebMessung.
 */
export async function gleicheGeldAb(jetzt: Date, stripeLiveAb: Date | null = STRIPE_LIVE_AB): Promise<GeldAbgleichErgebnis> {
  const ab = Math.floor((jetzt.getTime() - GELD_ABGLEICH_FENSTER_MS) / 1000)
  // Gebühren ab Mitternacht (UTC) des ersten Tages: So ist jeder Tag ganz gelesen, nur heute nicht — den schreibt morgen der nächste Lauf ganz.
  const gebuehrenAb = Math.floor(utcTagesbeginn(new Date(jetzt.getTime() - GELD_ABGLEICH_FENSTER_MS)).getTime() / 1000)
  const offeneZeilen = await ladeAbweichungZeilen()
  const offen = offeneZeilen.flatMap((z) => {
    const gelesen = leseAbweichungArt(z.art)
    return gelesen ? [{ ...gelesen, tag: z.tag, art: z.art }] : []
  })

  // ─── Stripe lesen (nur lesend) ───
  // Erst hier geladen: Heute und Geld lesen aus dieser Datei, ohne den Stripe-Client (server-only) mitzuziehen.
  const { stripe } = await import('@/lib/stripe')
  const zahlungen = new Map<string, StripeZahlung>()
  let buchungen: SaldoBuchung[] = []
  try {
    const [intents, erstattungen, saldo] = await Promise.all([
      alle(stripe.paymentIntents.list({ created: { gte: ab }, limit: 100, expand: ['data.latest_charge'] })),
      alle(stripe.refunds.list({ created: { gte: ab }, limit: 100, expand: ['data.payment_intent.latest_charge'] })),
      alle(stripe.balanceTransactions.list({ created: { gte: gebuehrenAb }, limit: 100 })),
    ])
    for (const pi of intents) zahlungen.set(pi.id, alsZahlung(pi))
    for (const r of erstattungen) {
      if (r.payment_intent !== null && typeof r.payment_intent === 'object') zahlungen.set(r.payment_intent.id, alsZahlung(r.payment_intent))
    }
    buchungen = saldo.map((b) => ({ created: b.created, fee: b.fee, type: b.type, amount: b.amount }))
  } catch (err) {
    meldeStripe(err, 'liste')
    throw new GeldAbgleichStripeFehler()
  }

  // ─── Bestellungen: Zahlungen aus Stripe, bezahlte der letzten 48 h, offene Abweichungen ───
  const piIds = [...zahlungen.keys()]
  const zeilen = await prisma.order.findMany({
    where: {
      paymentMethod: 'ONLINE',
      stripePaymentIntentId: { not: null },
      OR: [
        { stripePaymentIntentId: { in: piIds } },
        { paymentStatus: { in: ['PAID', 'REFUNDED'] }, paidAt: { gte: new Date(ab * 1000) } },
        { id: { in: [...new Set(offen.map((o) => o.orderId))] } },
      ],
      AND: [ohneTestzahlungenWhere(stripeLiveAb)],
    },
    select: BESTELLUNG_FUER_ABGLEICH,
  })
  const bestellungen: BestellungFuerAbgleich[] = zeilen.flatMap((o) =>
    o.stripePaymentIntentId
      ? [
          {
            id: o.id,
            orderNumber: o.orderNumber,
            paymentIntentId: o.stripePaymentIntentId,
            paymentStatus: o.paymentStatus,
            warenCents: alsCents(o.totalAmount),
            warenOriginalCents: o.items.reduce((s, i) => s + alsCents(i.totalPrice), 0),
            serviceFeeCents: o.serviceFeeCents,
            provisionCents: alsCents(o.platformFeeAmount),
            erstattetCents: o.erstattetCents,
            gebuehrEntfallen: o.serviceFeeRefundedAt !== null,
          },
        ]
      : []
  )

  // Zahlungen, die die Listen nicht brachten (älter als 48 h oder vor 48 h angelegt und erst jetzt bezahlt): einzeln nachladen.
  const nichtBeiStripe = new Set<string>()
  const fehlend = bestellungen.filter((b) => !zahlungen.has(b.paymentIntentId)).slice(0, NACHLADEN_HOECHSTENS)
  try {
    for (const b of fehlend) {
      try {
        zahlungen.set(b.paymentIntentId, alsZahlung(await stripe.paymentIntents.retrieve(b.paymentIntentId, { expand: ['latest_charge'] })))
      } catch (err) {
        if (!istNichtGefunden(err)) throw err
        nichtBeiStripe.add(b.paymentIntentId)
      }
    }
  } catch (err) {
    meldeStripe(err, 'nachladen')
    throw new GeldAbgleichStripeFehler()
  }

  const { verglichen, abweichungen } = gleicheAb(bestellungen, zahlungen, nichtBeiStripe)

  // ─── Schreiben ───
  const heute = utcTagesbeginn(jetzt)
  const verglichenSet = new Set(verglichen)
  const jetztArten = new Set(abweichungen.map((a) => abweichungArt(a.orderId, a.feld)))
  const geklaert = offen.filter((o) => verglichenSet.has(o.orderId) && !jetztArten.has(o.art))
  const offenNachArt = new Map(offen.map((o) => [o.art, o]))
  const neu = abweichungen.filter((a) => !offenNachArt.has(abweichungArt(a.orderId, a.feld)))

  if (geklaert.length > 0) {
    await prisma.betriebMessung.deleteMany({ where: { art: { in: geklaert.map((g) => g.art) } } })
  }
  if (neu.length > 0) {
    await prisma.betriebMessung.createMany({
      data: neu.map((a) => ({ tag: heute, art: abweichungArt(a.orderId, a.feld), wert: BigInt(abweichungCents(a)) })),
      skipDuplicates: true,
    })
  }
  // Bestehende behalten ihren ersten Tag (die Frist in Heute zählt ab da); nur der Betrag kann sich ändern.
  for (const a of abweichungen) {
    const alt = offenNachArt.get(abweichungArt(a.orderId, a.feld))
    if (!alt) continue
    await prisma.betriebMessung.updateMany({ where: { tag: alt.tag, art: alt.art }, data: { wert: BigInt(abweichungCents(a)), gemessenAm: jetzt } })
  }

  const gebuehren = stripeGebuehrenJeTag(buchungen)
  for (const [tag, cents] of gebuehren) {
    const tagDatum = new Date(`${tag}T00:00:00.000Z`)
    await prisma.betriebMessung.upsert({
      where: { tag_art: { tag: tagDatum, art: STRIPE_GEBUEHR_ART } },
      create: { tag: tagDatum, art: STRIPE_GEBUEHR_ART, wert: BigInt(cents) },
      update: { wert: BigInt(cents), gemessenAm: jetzt },
    })
  }

  return { zahlungen: zahlungen.size, verglichen: verglichen.length, abweichungen: abweichungen.length, neu: neu.length, geklaert: geklaert.length, stripeGebuehrTage: gebuehren.size }
}

/** Warnung an Sentry — nur Schritt und Fehlerklasse, nie Text, Betrag oder Kennung. */
function meldeStripe(err: unknown, schritt: 'liste' | 'nachladen'): void {
  const meldung = new Error('Geld-Abgleich: Stripe nicht gelesen')
  if (err instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(err.name)) meldung.name = err.name
  Sentry.captureException(meldung, { level: 'warning', tags: { aufgabe: 'geld-abgleich', schritt } })
}

// ─── Lesen für Heute und Geld ────────────────────────────────────────────────

/** Die offenen Abweichungen mit Bestellnummer — für Heute (Aufgabe) und Geld. Eine Zeile ohne Bestellung fällt weg. */
export async function ladeOffeneAbweichungen(): Promise<OffeneAbweichung[]> {
  const zeilen = await ladeAbweichungZeilen()
  const gelesen = zeilen.flatMap((z) => {
    const g = leseAbweichungArt(z.art)
    return g ? [{ ...g, tag: z.tag, wert: z.wert }] : []
  })
  if (gelesen.length === 0) return []
  const nummern = await prisma.order.findMany({ where: { id: { in: [...new Set(gelesen.map((g) => g.orderId))] } }, select: { id: true, orderNumber: true } })
  const nummer = new Map(nummern.map((n) => [n.id, n.orderNumber]))
  return gelesen.flatMap((g) => {
    const orderNumber = nummer.get(g.orderId)
    return orderNumber ? [{ orderId: g.orderId, orderNumber, feld: g.feld, differenzCents: Number(g.wert), seit: g.tag }] : []
  })
}

/** Die abgeschlossenen Monate (Protokoll `monat_abgeschlossen`), mit dem Zeitpunkt des Abschlusses. */
export async function ladeAbgeschlosseneMonate(): Promise<Map<Monatsschluessel, Date>> {
  const zeilen = await prisma.adminAktion.findMany({
    where: { art: 'monat_abgeschlossen', bezugArt: 'monat' },
    select: { bezugId: true, wann: true },
    orderBy: { wann: 'asc' },
  })
  const monate = new Map<Monatsschluessel, Date>()
  for (const z of zeilen) if (!monate.has(z.bezugId)) monate.set(z.bezugId, z.wann)
  return monate
}

export type GeldMonat = {
  umsatz: { cents: number; anzahl: number; bar: number }
  erstattungen: ErstattungenMonat
  stripeGebuehrCents: number
  /** Offene Abweichungen zu Bestellungen dieses Monats. */
  abweichungen: OffeneAbweichung[]
  /** Alle offenen Abweichungen (auch anderer Monate) — für den Satz im Abgleich. */
  abweichungenGesamt: number
  lauf: AblaufLaufDaten | null
  abgeschlossenAm: Date | null
  /** Für die Prüfliste (monatsabschlussPruefliste). */
  abgleichNachMonatsende: boolean
  csvGeladen: boolean
}

/**
 * Was die Seite Geld für EINEN Monat neben `getFinanzen` braucht: Umsatz der
 * Höfe (Umsatzregel, abgeholt im Monat, ohne Testzahlungen), Erstattungen der
 * Bestellungen des Monats, Stripe-Gebühren, offene Abweichungen, der letzte
 * Lauf und der Stand des Monatsabschlusses. Bestellungen nur mit Kennung,
 * Stand und Beträgen — kein Name, keine Adresse.
 */
export async function ladeGeldMonat(monat: Monatsschluessel, stripeLiveAb: Date | null = STRIPE_LIVE_AB): Promise<GeldMonat> {
  const grenzen = monatsgrenzenWienFuer(monat)
  const umsatzWhere = umsatzBestellungWhere('', { von: grenzen.von, bis: new Date(grenzen.bis.getTime() - 1) }, stripeLiveAb)
  delete umsatzWhere.farmId
  const imMonat = { createdAt: { gte: grenzen.von, lt: grenzen.bis }, AND: [ohneTestzahlungenWhere(stripeLiveAb)] }

  const [umsatz, bar, online, gebuehrTage, offene, lauf, abgeschlossen, csv] = await Promise.all([
    prisma.order.aggregate({ where: umsatzWhere, _sum: { totalAmount: true }, _count: { _all: true } }),
    prisma.order.count({ where: { ...umsatzWhere, paymentMethod: { not: 'ONLINE' } } }),
    prisma.order.findMany({
      where: { ...imMonat, paymentMethod: 'ONLINE', OR: [{ erstattetCents: { gt: 0 } }, { paymentStatus: 'REFUNDED' }, { serviceFeeRefundedAt: { not: null } }, { erstattungOffenSeit: { not: null } }] },
      select: { ...BESTELLUNG_FUER_ABGLEICH, erstattungOffenSeit: true },
    }),
    prisma.betriebMessung.findMany({ where: { art: STRIPE_GEBUEHR_ART, tag: { gte: new Date(`${monat}-01T00:00:00.000Z`), lt: new Date(`${monatVerschoben(monat, 1)}-01T00:00:00.000Z`) } }, select: { tag: true, wert: true } }),
    ladeOffeneAbweichungen(),
    prisma.ablaufLauf.findUnique({ where: { name: 'geld-abgleich' }, select: { gestartetAm: true, beendetAm: true, ok: true, fehlerKlasse: true, dauerMs: true } }),
    prisma.adminAktion.findFirst({ where: { art: 'monat_abgeschlossen', bezugArt: 'monat', bezugId: monat }, orderBy: { wann: 'asc' }, select: { wann: true } }),
    prisma.adminAktion.findFirst({ where: { art: 'finanzen_export', bezugArt: 'monat', bezugId: monat.slice(0, 4), wann: { gte: grenzen.bis } }, select: { wann: true } }),
  ])

  // Abweichungen dieses Monats: die Bestellung entstand im Monat.
  const imMonatIds =
    offene.length === 0
      ? new Set<string>()
      : new Set((await prisma.order.findMany({ where: { id: { in: offene.map((o) => o.orderId) }, createdAt: { gte: grenzen.von, lt: grenzen.bis } }, select: { id: true } })).map((o) => o.id))

  const erstattungen = erstattungenImMonat(
    online.map((o) => ({
      erstattetCents: erwartetLautDatenbank({
        id: o.id,
        orderNumber: o.orderNumber,
        paymentIntentId: o.stripePaymentIntentId ?? '',
        paymentStatus: o.paymentStatus,
        warenCents: alsCents(o.totalAmount),
        warenOriginalCents: o.items.reduce((s, i) => s + alsCents(i.totalPrice), 0),
        serviceFeeCents: o.serviceFeeCents,
        provisionCents: alsCents(o.platformFeeAmount),
        erstattetCents: o.erstattetCents,
        gebuehrEntfallen: o.serviceFeeRefundedAt !== null,
      }).erstattetCents,
      erstattungOffen: o.erstattungOffenSeit !== null,
    }))
  )

  return {
    umsatz: { cents: umsatz._sum.totalAmount ? alsCents(umsatz._sum.totalAmount) : 0, anzahl: umsatz._count._all, bar },
    erstattungen,
    stripeGebuehrCents: stripeGebuehrenImMonat(
      gebuehrTage.map((t) => ({ tag: t.tag.toISOString().slice(0, 10), cents: Number(t.wert) })),
      monat
    ),
    abweichungen: offene.filter((o) => imMonatIds.has(o.orderId)),
    abweichungenGesamt: offene.length,
    lauf,
    abgeschlossenAm: abgeschlossen?.wann ?? null,
    abgleichNachMonatsende: lauf !== null && lauf.ok && lauf.beendetAm !== null && lauf.gestartetAm.getTime() >= grenzen.bis.getTime(),
    csvGeladen: csv !== null,
  }
}
