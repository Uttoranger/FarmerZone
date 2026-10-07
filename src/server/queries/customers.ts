import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { kundeIdAus } from '@/lib/kunden-id'
import { alsCents } from '@/lib/order-totals'
import { fasseKundinZusammen, kundenSchluessel, type KundenBestellung, type KundenZusammenfassung } from '@/lib/hof-kunden'

/*
 * Kunden des Hofs (/customers, /customers/[kundeId]). Jede Abfrage trägt die
 * farmId des angemeldeten Hofs in der WHERE-Klausel — eine Kundin gibt es nur
 * als „Bestellungen bei diesem Hof", nie hofübergreifend. Geld wandelt diese
 * Servergrenze einmal in Cent (alsCents), gerechnet wird in src/lib/hof-kunden.ts.
 */

/** Die Kennung einer Kundin dieses Hofs für die Adresse /customers/<kundeId>. */
export function kundeIdFuer(farmId: string, email: string): string {
  return kundeIdAus(env.BETTER_AUTH_SECRET, farmId, email)
}

/**
 * Alle Schreibweisen der E-Mail zu einer Kennung — nur unter den Bestellungen
 * des eigenen Hofs gesucht (Besitz steckt in der WHERE-Klausel). Eine Kennung
 * lässt sich nicht zurückrechnen, also rechnen wir alle Kennungen des Hofs
 * vorwärts; für einen Hof sind das einige hundert Adressen. Leer = keine
 * Kundin dieses Hofs (auch bei einer Kennung aus einem anderen Hof).
 *
 * Mehrere Schreibweisen („Erika@…", „erika@… ") sind dieselbe Kundin — so
 * fasst auch die Liste zusammen. Das Detail fragt dann genau diese Werte ab
 * (`in`), statt mit ILIKE zu vergleichen: dort wären „_" und „%" Platzhalter.
 */
export async function findeKundenAdressen(farmId: string, kundeId: string): Promise<string[]> {
  const zeilen = await prisma.order.findMany({
    where: { farmId },
    select: { customerEmail: true },
    distinct: ['customerEmail'],
  })
  return zeilen.map((z) => z.customerEmail).filter((email) => kundeIdFuer(farmId, email) === kundeId)
}

export interface CustomerSummary extends KundenZusammenfassung {
  /** Für den Link auf die Kundenseite — nie die E-Mail in eine Adresse. */
  kundeId: string
}

export interface CustomerOrderSummary {
  id: string
  orderNumber: string
  createdAt: string
  /** Warenpreis der Bestellung in Cent (nach „Artikel fehlt" der aktuelle Stand). */
  betragCents: number
  status: string
  items: { productName: string; quantity: number }[]
}

export interface CustomerDetail extends CustomerSummary {
  recentOrders: CustomerOrderSummary[]
  subscription: { optInEmail: boolean; optInWhatsApp: boolean } | null
}

/** So viele Bestellungen lädt das Detail; gezeigt werden davon die ersten fünf. */
const LETZTE_BESTELLUNGEN = 10

const BESTELL_FELDER = {
  customerEmail: true,
  customerName: true,
  customerPhone: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  // Fehlende Artikel (E14) wurden nicht übergeben — sie zählen nicht als gekauft.
  items: { where: { fehltSeit: null }, select: { productName: true, quantity: true } },
} as const

type BestellZeile = {
  customerEmail: string
  customerName: string
  customerPhone: string
  status: string
  totalAmount: { toString(): string }
  createdAt: Date
  items: { productName: string; quantity: number }[]
}

function alsKundenBestellung(o: BestellZeile): KundenBestellung {
  return {
    customerEmail: o.customerEmail,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    status: o.status,
    betragCents: alsCents(o.totalAmount),
    createdAt: o.createdAt,
    items: o.items,
  }
}

export async function getCustomersForFarm(farmId: string, jetzt: Date = new Date()): Promise<CustomerSummary[]> {
  const [orders, subscriptions] = await Promise.all([
    prisma.order.findMany({ where: { farmId }, select: BESTELL_FELDER, orderBy: { createdAt: 'asc' } }),
    prisma.customerFarmSubscription.findMany({
      where: { farmId },
      select: { customerEmail: true, optInEmail: true, optInWhatsApp: true },
    }),
  ])

  const abos = new Map(subscriptions.map((s) => [kundenSchluessel(s.customerEmail), s]))

  const jeKundin = new Map<string, KundenBestellung[]>()
  for (const order of orders) {
    const schluessel = kundenSchluessel(order.customerEmail)
    const liste = jeKundin.get(schluessel) ?? []
    liste.push(alsKundenBestellung(order))
    jeKundin.set(schluessel, liste)
  }

  const result: CustomerSummary[] = [...jeKundin].map(([schluessel, bestellungen]) => ({
    kundeId: kundeIdFuer(farmId, schluessel),
    ...fasseKundinZusammen(bestellungen, abos.get(schluessel) ?? null, jetzt),
  }))
  result.sort((a, b) => b.orderCount - a.orderCount)
  return result
}

/**
 * Eine Kundin des Hofs mit ihren letzten Bestellungen. `adressen` kommt aus
 * findeKundenAdressen (alle Schreibweisen bei diesem Hof); null, wenn es
 * unter diesen Adressen bei diesem Hof keine Bestellung gibt.
 */
export async function getCustomerDetail(
  farmId: string,
  adressen: readonly string[],
  jetzt: Date = new Date()
): Promise<CustomerDetail | null> {
  if (adressen.length === 0) return null
  const schluessel = kundenSchluessel(adressen[0])

  const [orders, abos] = await Promise.all([
    prisma.order.findMany({
      where: { farmId, customerEmail: { in: [...adressen] } },
      select: { ...BESTELL_FELDER, id: true, orderNumber: true },
      orderBy: { createdAt: 'desc' },
    }),
    // Dieselbe Zuordnung wie die Liste (kundenSchluessel: klein, ohne Rand) —
    // im Code statt per ILIKE, das weder Rand noch Platzhalter richtig kennt.
    // Abos eines Hofs sind höchstens so viele wie seine Kundinnen.
    prisma.customerFarmSubscription.findMany({
      where: { farmId },
      select: { customerEmail: true, optInEmail: true, optInWhatsApp: true },
    }),
  ])

  if (orders.length === 0) return null
  const abo = abos.find((a) => kundenSchluessel(a.customerEmail) === schluessel)
  const subscription = abo ? { optInEmail: abo.optInEmail, optInWhatsApp: abo.optInWhatsApp } : null

  return {
    kundeId: kundeIdFuer(farmId, schluessel),
    ...fasseKundinZusammen(orders.map(alsKundenBestellung), subscription, jetzt),
    recentOrders: orders.slice(0, LETZTE_BESTELLUNGEN).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toISOString(),
      betragCents: alsCents(o.totalAmount),
      status: o.status,
      items: o.items,
    })),
    subscription,
  }
}
