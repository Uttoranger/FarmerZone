import { prisma } from '@/lib/prisma'
import {
  pruefeWarenkorb,
  befundMeldung,
  neueFrist,
  type Bestandslage,
  type WarenkorbBefund,
  type WarenkorbPosition,
} from '@/lib/reservierung'

/**
 * Der Abgleich eines Warenkorbs mit der Wirklichkeit — EINE Stelle für alle
 * drei Momente, in denen er gebraucht wird (Bug-Report Befund 3):
 *   1. beim Laden des Warenkorbs,
 *   2. beim Öffnen des Checkouts,
 *   3. im POST /api/checkout, bevor irgendetwas geschrieben wird.
 *
 * Die Entscheidung trifft die reine Funktion in src/lib/reservierung.ts; hier
 * wird nur gelesen und angewendet.
 *
 * DREI ABFRAGEN statt zwei je Position: Der Checkout fragte bisher in einer
 * Schleife je Artikel Produkt und fremde Reservierungen einzeln ab. Bei zehn
 * Positionen sind das zwanzig Rundreisen zur Datenbank — spürbar in der
 * Antwortzeit (Befund 4). Jetzt: Produkte, fremde Halte und eigene Halte je
 * einmal, der Rest ist Rechnen im Speicher.
 */

export type WarenkorbPruefung = {
  befund: WarenkorbBefund
  /** Die Meldung für die Kundin, oder null wenn alles unverändert gilt. */
  meldung: string | null
  /** Der berichtigte Warenkorb: gekürzte Mengen, entfernte Positionen fehlen. */
  berichtigt: WarenkorbPosition[]
}

/** Liest Bestandslage und eigene Halte und wendet die Regeln an. Schreibt nichts. */
export async function pruefeSitzungsWarenkorb(
  positionen: readonly WarenkorbPosition[],
  sessionId: string,
  jetzt: Date = new Date()
): Promise<WarenkorbPruefung> {
  if (positionen.length === 0) {
    const leer = pruefeWarenkorb([], [], [], jetzt)
    return { befund: leer, meldung: null, berichtigt: [] }
  }

  const ids = [...new Set(positionen.map((p) => p.productId))]

  const [produkte, fremdeHalte, eigeneHalte] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, stock: true, isAvailable: true },
    }),
    prisma.stockReservation.findMany({
      where: { productId: { in: ids }, sessionId: { not: sessionId }, expiresAt: { gt: jetzt } },
      select: { productId: true, quantity: true },
    }),
    prisma.stockReservation.findMany({
      where: { productId: { in: ids }, sessionId },
      select: { productId: true, quantity: true, expiresAt: true },
    }),
  ])

  // Fremde Halte je Produkt aufsummieren — sie allein mindern, was dieser
  // Sitzung offensteht. Die eigenen zählen nicht gegen sie selbst.
  const fremdSumme = new Map<string, number>()
  for (const h of fremdeHalte) {
    fremdSumme.set(h.productId, (fremdSumme.get(h.productId) ?? 0) + h.quantity)
  }

  const lage: Bestandslage[] = produkte.map((p) => ({
    productId: p.id,
    verfuegbar: p.stock - (fremdSumme.get(p.id) ?? 0),
    verkaeuflich: p.isAvailable,
  }))

  const befund = pruefeWarenkorb(positionen, eigeneHalte, lage, jetzt)

  return {
    befund,
    meldung: befundMeldung(befund),
    berichtigt: befund.positionen
      .filter((p) => p.moeglich > 0)
      .map((p) => ({ productId: p.productId, quantity: p.moeglich })),
  }
}

/**
 * Setzt die Halte dieser Sitzung neu — für die Positionen, die es noch gibt.
 * Wird nach der Prüfung beim Laden des Warenkorbs und beim Öffnen des
 * Checkouts gerufen: Wer weiterhin am Einkauf sitzt, soll seinen Halt behalten,
 * statt ihn stillschweigend zu verlieren. Der Checkout selbst erneuert NICHT —
 * dort wird geprüft und gekauft, nicht verlängert.
 */
export async function erneuereHalte(
  positionen: readonly WarenkorbPosition[],
  sessionId: string,
  jetzt: Date = new Date()
): Promise<void> {
  const bis = neueFrist(jetzt)
  for (const p of positionen) {
    await prisma.stockReservation.upsert({
      where: { productId_sessionId: { productId: p.productId, sessionId } },
      create: { productId: p.productId, sessionId, quantity: p.quantity, expiresAt: bis },
      update: { quantity: p.quantity, expiresAt: bis },
    })
  }
}

/** Halte dieser Sitzung für Produkte, die aus dem Warenkorb geflogen sind, aufräumen. */
export async function loescheHalte(productIds: readonly string[], sessionId: string): Promise<void> {
  if (productIds.length === 0) return
  await prisma.stockReservation.deleteMany({
    where: { sessionId, productId: { in: [...productIds] } },
  })
}
