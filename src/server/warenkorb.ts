import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { istGebindeGesperrt } from '@/lib/futter-registrierung'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import { FARM_NOT_APPROVED_MESSAGE } from '@/lib/farm-approval'
import { kaufSperre, kaufSperreHinweis } from '@/lib/bereiche-anzeige'
import { alsAbholFenster, ausgebuchteTage } from '@/server/abholfenster'
import { leseBestellstopp } from '@/server/queries/plattform-einstellung'
import { bestellstoppAktiv } from '@/lib/notbremse'
import {
  pruefeWarenkorb,
  befundMeldung,
  neueFrist,
  type Bestandslage,
  type WarenkorbBefund,
  type WarenkorbPosition,
} from '@/lib/reservierung'

/**
 * Der Abgleich eines Warenkorbs mit der Wirklichkeit — EINE Stelle für die
 * beiden Momente am Server (Bug-Report Befund 3):
 *   1. beim Öffnen des Checkouts (mit Erneuern der Halte),
 *   2. im POST /api/checkout, bevor irgendetwas geschrieben wird (verbindlich).
 * Die Hofseite gleicht beim Laden im Browser ab, gegen ihre eigenen Produkte
 * und ohne Halte (`gleicheKorbMitHofseite`, Register N28) — nicht hier.
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

// ─── Prüfkette je Hof (Register N24, Ergänzung 24.10.2026; Nr. 165) ─────────

/**
 * Was vom Hof gebraucht wird, um zu entscheiden, ob man bei ihm gerade kaufen
 * kann — nur die AKTIVEN Abholzeiten, wie in der Kasse.
 */
export const HOF_KAUFBARKEIT_AUSWAHL = {
  id: true,
  name: true,
  isPaused: true,
  archivedAt: true,
  approvedAt: true,
  pickupSlots: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } },
} satisfies Prisma.FarmSelect

export type HofZurKaufbarkeit = Prisma.FarmGetPayload<{ select: typeof HOF_KAUFBARKEIT_AUSWAHL }>

export type HofSperrGrund = 'notbremse' | 'stillgelegt' | 'nicht-freigeschaltet' | 'pause' | 'keine-abholzeit' | 'ausgebucht'

/** Der Code der 409-Antwort bei Notbremse — /api/warenkorb/pruefen und /api/checkout (Nr. 189). */
export const BESTELLSTOPP_CODE = 'BESTELLSTOPP'

/** Der Grund und der Satz, den die Kundin liest — dieselben Sätze wie bisher in /api/reserve. */
export type HofSperre = { grund: HofSperrGrund; text: string }

/**
 * Die Notbremse (Register N34, Nr. 189) als Sperre: null, wenn sie gerade
 * nicht gilt. Frisch gelesen (nie aus dem Cache) und mit `jetzt` entschieden —
 * nach „bis“ ist sie aus, ohne dass jemand schreibt. Der Satz des Admins ist
 * der Text an die Kundschaft. Ein Ladefehler wirft wie jede andere Abfrage
 * der Kette (die Routen antworten dann mit ihrem Serverfehler).
 *
 * Die Kasse fragt sie selbst (/api/checkout prüft den Hof ohne diese Kette,
 * eine Zeile vor der Stilllegung) — dieselbe Funktion, kein Nachbau.
 */
export async function pruefeBestellstopp(jetzt: Date): Promise<HofSperre | null> {
  const stopp = bestellstoppAktiv(await leseBestellstopp(), jetzt)
  return stopp ? { grund: 'notbremse', text: stopp.satz } : null
}

/**
 * Die Prüfkette für mehrere Höfe: je Hof der ERSTE Grund, aus dem man bei ihm
 * nicht kaufen kann; bestellbare Höfe fehlen in der Antwort.
 *
 * Reihenfolge (verbindlich, gleich für /api/reserve und /api/warenkorb/pruefen):
 *  0. Notbremse — gilt für alle Höfe zugleich, darum vor allem anderen und
 *     ohne weitere Abfrage (Nr. 189),
 *  1. Stilllegung — der dauerhafte Zustand sticht den vorübergehenden
 *     (src/lib/farm-archive.ts),
 *  2. Freischaltung — nach der Stilllegung, vor der Pause (src/lib/farm-approval.ts),
 *  3. Pause,
 *  4. Kaufsperre (keine Abholzeit, ausgebucht) — dieselbe Regel und Zählung
 *     wie die Kasse (`kaufSperre`, `ausgebuchteTage`).
 * Die vollen Tage werden EINMAL gezählt, und nur für Höfe, die 1–3 bestehen:
 * Wer schon pausiert, kostet keine Abfrage. Die verwaisten Bestellungen gibt der
 * Aufrufer vorher frei (Frist gilt beim Lesen), sonst zählte ein Fenster voll,
 * das die Kasse annähme.
 */
export async function pruefeKaufbarkeitHoefe(
  hoefe: readonly HofZurKaufbarkeit[],
  jetzt: Date
): Promise<Map<string, HofSperre>> {
  const sperren = new Map<string, HofSperre>()
  if (hoefe.length === 0) return sperren
  const stopp = await pruefeBestellstopp(jetzt)
  if (stopp) {
    for (const hof of hoefe) sperren.set(hof.id, stopp)
    return sperren
  }
  const offen: HofZurKaufbarkeit[] = []
  const gesehen = new Set<string>()
  for (const hof of hoefe) {
    if (gesehen.has(hof.id)) continue
    gesehen.add(hof.id)
    if (hof.archivedAt) sperren.set(hof.id, { grund: 'stillgelegt', text: FARM_ARCHIVED_MESSAGE })
    else if (!hof.approvedAt) sperren.set(hof.id, { grund: 'nicht-freigeschaltet', text: FARM_NOT_APPROVED_MESSAGE })
    else if (hof.isPaused) sperren.set(hof.id, { grund: 'pause', text: SHOP_PAUSED_MESSAGE })
    else offen.push(hof)
  }
  if (offen.length === 0) return sperren

  const volle = await ausgebuchteTage(
    offen.map((h) => h.id),
    jetzt
  )
  for (const hof of offen) {
    const voll = volle.get(hof.id)
    // Die Pause ist oben schon beantwortet; die Sperre kann hier nur „keine
    // Abholzeit" oder „ausgebucht" sein.
    const sperre = kaufSperre({ isPaused: false, pickupSlots: hof.pickupSlots.map((s) => alsAbholFenster(s, voll)) }, jetzt)
    if (sperre === 'keine-abholzeit' || sperre === 'ausgebucht') {
      sperren.set(hof.id, { grund: sperre, text: kaufSperreHinweis(sperre, hof.name).titel })
    }
  }
  return sperren
}

/** Die Prüfkette für EINEN Hof (/api/reserve): null, wenn man bei ihm kaufen kann. */
export async function pruefeKaufbarkeitHof(hof: HofZurKaufbarkeit, jetzt: Date): Promise<HofSperre | null> {
  return (await pruefeKaufbarkeitHoefe([hof], jetzt)).get(hof.id) ?? null
}

/** Die Sperre eines Produkts samt dem Hof, an dem sie hängt. */
export type ProduktHofSperre = HofSperre & { farmId: string }

/**
 * Die Sperren der Höfe hinter diesen Produkten, je Produkt (für den Warenkorb).
 * Unbekannte Produkte fehlen — sie fallen im Abgleich ohnehin als „weg“.
 * Die Hof-ID reist mit, damit der Warenkorb ALLE Halte der Sitzung bei einem
 * gesperrten Hof freigeben kann, nicht nur die der mitgeschickten Positionen.
 */
export async function hofSperrenFuerProdukte(
  productIds: readonly string[],
  jetzt: Date
): Promise<Map<string, ProduktHofSperre>> {
  const ids = [...new Set(productIds)]
  if (ids.length === 0) return new Map()
  const produkte = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, farm: { select: HOF_KAUFBARKEIT_AUSWAHL } },
  })
  const jeHof = await pruefeKaufbarkeitHoefe(
    produkte.map((p) => p.farm),
    jetzt
  )
  const jeProdukt = new Map<string, ProduktHofSperre>()
  for (const p of produkte) {
    const sperre = jeHof.get(p.farm.id)
    if (sperre) jeProdukt.set(p.id, { ...sperre, farmId: p.farm.id })
  }
  return jeProdukt
}

/**
 * Liest Bestandslage und eigene Halte und wendet die Regeln an. Schreibt nichts.
 * `gesperrt`: Produkte, deren Hof die Prüfkette nicht besteht (Nr. 165) — sie
 * zählen wie ausgeblendet und fallen aus dem Korb. Der Checkout gibt keine mit,
 * er prüft Hof und Abholfenster selbst.
 */
export async function pruefeSitzungsWarenkorb(
  positionen: readonly WarenkorbPosition[],
  sessionId: string,
  jetzt: Date = new Date(),
  gesperrt: ReadonlySet<string> = new Set()
): Promise<WarenkorbPruefung> {
  if (positionen.length === 0) {
    const leer = pruefeWarenkorb([], [], [], jetzt)
    return { befund: leer, meldung: null, berichtigt: [] }
  }

  const ids = [...new Set(positionen.map((p) => p.productId))]

  const [produkte, fremdeHalte, eigeneHalte] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids } },
      // Kategorie, Verpackung und die Registrierung des Hofs für die Sperre je
      // Gebinde (S7, Nr. 20) — gegen eine Größe, die nach dem Einlegen in den
      // Korb gesperrt wurde (der Hof hat seinen Status geändert).
      select: {
        id: true,
        stock: true,
        isAvailable: true,
        category: true,
        verpackung: true,
        farm: { select: { betriebsnummer: true, betriebsstatus: true } },
      },
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
    // Gesperrt zählt wie ausgeblendet: Die Position fällt mit der bekannten
    // Meldung aus dem Korb, bevor der Checkout Bestand bucht.
    verkaeuflich: p.isAvailable && !istGebindeGesperrt(p, p.farm) && !gesperrt.has(p.id),
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
 * Wird nach der Prüfung beim Öffnen des Checkouts gerufen (die Hofseite setzt
 * und erneuert keine Halte, Register N28): Wer weiterhin am Einkauf sitzt, soll seinen Halt behalten,
 * statt ihn stillschweigend zu verlieren. Der Checkout selbst erneuert NICHT —
 * dort wird geprüft und gekauft, nicht verlängert.
 */
export async function erneuereHalte(
  positionen: readonly WarenkorbPosition[],
  sessionId: string,
  jetzt: Date = new Date()
): Promise<Date | null> {
  const bis = neueFrist(jetzt)
  for (const p of positionen) {
    await prisma.stockReservation.upsert({
      where: { productId_sessionId: { productId: p.productId, sessionId } },
      create: { productId: p.productId, sessionId, quantity: p.quantity, expiresAt: bis },
      update: { quantity: p.quantity, expiresAt: bis },
    })
  }
  // Die Frist, die jetzt in den Halten steht — die Kasse zeigt sie an
  // (Nachtlauf Nr. 12). Ohne Positionen gibt es keinen Halt und keine Frist.
  return positionen.length > 0 ? bis : null
}

/** Halte dieser Sitzung für diese Produkte freigeben — nach der Prüfung der Kasse und beim Entfernen aus dem Korb (DELETE /api/reserve, Register N28). */
export async function loescheHalte(productIds: readonly string[], sessionId: string): Promise<void> {
  if (productIds.length === 0) return
  await prisma.stockReservation.deleteMany({
    where: { sessionId, productId: { in: [...productIds] } },
  })
}

/**
 * Gibt ALLE Halte dieser Sitzung bei diesen Höfen frei (Register N24,
 * Ergänzung 24.10.2026: „die Halte der Sitzung bei diesem Hof“) — auch für
 * Produkte, die nicht mehr im mitgeschickten Korb stehen. Sonst hielte ein
 * gesperrter Hof Ware bis zum Ablauf der Frist fest. Fremde Sitzungen bleiben.
 *
 * `StockReservation` hat keine Relation zum Produkt (nur `productId`), darum in
 * zwei Schritten: erst die Halte der Sitzung (wenige), dann die davon, deren
 * Produkt an einem dieser Höfe hängt.
 */
export async function loescheHalteBeiHoefen(farmIds: readonly string[], sessionId: string): Promise<void> {
  if (farmIds.length === 0) return
  const halte = await prisma.stockReservation.findMany({ where: { sessionId }, select: { productId: true } })
  if (halte.length === 0) return
  const betroffen = await prisma.product.findMany({
    where: { id: { in: [...new Set(halte.map((h) => h.productId))] }, farmId: { in: [...new Set(farmIds)] } },
    select: { id: true },
  })
  await loescheHalte(
    betroffen.map((p) => p.id),
    sessionId
  )
}
