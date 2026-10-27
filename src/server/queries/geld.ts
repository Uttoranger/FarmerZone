import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import { alsCents } from '@/lib/order-totals'
import { ohneTestzahlungenWhere } from '@/lib/testzahlung'
import { umsatzBestellungWhere } from '@/lib/umsatz'
import { monatVerschoben, monatsgrenzenWienFuer, type Monatsschluessel } from '@/lib/servicegebuehr'
import { GELD_ABWEICHUNG_ART, STRIPE_GEBUEHR_ART, erwartetLautDatenbank, leseAbweichungArt, type BestellungFuerAbgleich, type OffeneAbweichung } from '@/lib/geld-abgleich'
import { erstattungenImMonat, stripeGebuehrenImMonat, type ErstattungenMonat } from '@/lib/finanzen'
import type { AblaufLaufDaten } from '@/lib/betrieb'

/*
 * Die Abfragen des Geld-Abgleichs und der Seite Geld (Register N37, Nr. 191).
 * Hier und nicht in src/server/geld-abgleich.ts, weil der Stichtag der
 * Live-Schaltung (Testzahlungen, Register Z4) nur unter src/server/queries
 * gelesen wird (tests/testzahlung-wache.test.ts). Gelesen werden nur
 * Kennungen, Stände und Beträge — kein Name, keine Adresse; Decimal wird hier
 * einmal in ganze Cent gewandelt (`alsCents`).
 */

/** Die offenen Abweichungen, wie sie in BetriebMessung stehen (Art, Tag, Wert). */
export async function ladeAbweichungZeilen(): Promise<Array<{ tag: Date; art: string; wert: bigint }>> {
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
  gebuehrModell: true,
  items: { select: { totalPrice: true, gebuehrCents: true } },
} as const satisfies Prisma.OrderSelect

type AbgleichZeile = Prisma.OrderGetPayload<{ select: typeof BESTELLUNG_FUER_ABGLEICH }>

/** Eine Zeile als Bestellung für den Vergleich — Decimal → Cent an genau dieser Stelle. */
function alsAbgleichBestellung(o: AbgleichZeile): BestellungFuerAbgleich {
  return {
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
    gebuehrModell: o.gebuehrModell,
    gebuehrPositionenCents: o.items.reduce((s, i) => s + i.gebuehrCents, 0),
  }
}

/**
 * Die Online-Bestellungen für einen Lauf: alle zu den gelesenen Zahlungen,
 * alle seit `bezahltAb` bezahlten (auch wenn Stripe sie nicht listete) und die
 * mit offener Abweichung — ohne Testzahlungen (online vor der Live-Schaltung,
 * Register Z4: die gibt es im Live-Konto nicht).
 */
export async function ladeBestellungenFuerAbgleich(
  e: { paymentIntentIds: string[]; bezahltAb: Date; orderIds: string[] },
  stripeLiveAb: Date | null = STRIPE_LIVE_AB
): Promise<BestellungFuerAbgleich[]> {
  const zeilen = await prisma.order.findMany({
    where: {
      paymentMethod: 'ONLINE',
      stripePaymentIntentId: { not: null },
      OR: [
        { stripePaymentIntentId: { in: e.paymentIntentIds } },
        { paymentStatus: { in: ['PAID', 'REFUNDED'] }, paidAt: { gte: e.bezahltAb } },
        { id: { in: e.orderIds } },
      ],
      AND: [ohneTestzahlungenWhere(stripeLiveAb)],
    },
    select: BESTELLUNG_FUER_ABGLEICH,
  })
  return zeilen.flatMap((o) => (o.stripePaymentIntentId ? [alsAbgleichBestellung(o)] : []))
}

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
      erstattetCents: erwartetLautDatenbank(alsAbgleichBestellung(o)).erstattetCents,
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
