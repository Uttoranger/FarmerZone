import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { wienerTag } from '@/lib/heute'
import { kalendertagInWien } from '@/lib/servicegebuehr'
import {
  CODE_ABHOLFENSTER_UNGUELTIG,
  CODE_ABHOLFENSTER_VOLL,
  abholSchluessel,
  angeboteneAbholfenster,
  findeAbholfenster,
  istVoll,
  type Abholwahl,
  type AngebotenesFenster,
} from '@/lib/abholfenster'

/**
 * Die Abholfenster gegen die Datenbank: Welche Fenster der Hof anbietet,
 * entscheidet src/lib/abholfenster.ts; hier wird geladen und gezählt.
 *
 * DIE HÖCHSTZAHL (PickupSlot.maxOrders) gilt beim ANLEGEN: `imAbholfenster`
 * sperrt die Zeile des Fensters (`SELECT … FOR UPDATE`), zählt und legt die
 * Bestellung in DERSELBEN Transaktion an. Zwei gleichzeitige Bestellungen auf
 * den letzten Platz laufen so nacheinander — die zweite zählt die erste mit.
 * Die Vorprüfung in `pruefeAbholfenster` erspart nur die Bestandsbuchung,
 * wenn das Fenster schon vorher voll ist; verbindlich ist die Transaktion.
 */

type Db = Prisma.TransactionClient | typeof prisma

const SLOT_AUSWAHL = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  maxOrders: true,
  isActive: true,
} satisfies Prisma.PickupSlotSelect

/** Ein Fenster aus der Datenbank — mit Zeile (für die Sperre) und Höchstzahl. */
export type HofSlot = Prisma.PickupSlotGetPayload<{ select: typeof SLOT_AUSWAHL }>
export type HofFenster = AngebotenesFenster<HofSlot>

/** Die aktiven Fenster des Hofs. */
function ladeSlots(farmId: string): Promise<HofSlot[]> {
  return prisma.pickupSlot.findMany({ where: { farmId, isActive: true }, select: SLOT_AUSWAHL })
}

/**
 * Was einen Platz im Fenster belegt: jede nicht stornierte Bestellung — auch
 * abgeholte und „nicht abgeholt" markierte. Bewusst NICHT `abholWhere`
 * (src/lib/heute.ts): Das blendet Erledigtes aus, weil es um die Packliste
 * geht; hier geht es um die Zusage des Hofs, wie viele Bestellungen er für
 * dieses Fenster annimmt.
 */
const BELEGT: Prisma.OrderWhereInput = { status: { not: 'CANCELLED' } }

/** Belegte Plätze dieses Hofs für Tag (Wiener Kalendertag) und Fenster. */
function belegung(db: Db, farmId: string, wahl: Abholwahl): Promise<number> {
  const tag = wienerTag(wahl.datum)
  return db.order.count({
    where: {
      ...BELEGT,
      farmId,
      pickupDate: { gte: tag.von, lte: tag.bis },
      pickupTimeStart: wahl.start,
      pickupTimeEnd: wahl.ende,
    },
  })
}

export type AbholPruefung =
  | { ok: true; fenster: HofFenster }
  | { ok: false; code: typeof CODE_ABHOLFENSTER_UNGUELTIG | typeof CODE_ABHOLFENSTER_VOLL }

/** Bietet der Hof dieses Fenster jetzt an, und ist (noch) Platz? */
export async function pruefeAbholfenster(farmId: string, wahl: Abholwahl, jetzt: Date): Promise<AbholPruefung> {
  const fenster = findeAbholfenster(await ladeSlots(farmId), wahl, jetzt)
  if (!fenster) return { ok: false, code: CODE_ABHOLFENSTER_UNGUELTIG }
  const { maxOrders } = fenster.slot
  if (maxOrders !== null && istVoll(await belegung(prisma, farmId, wahl), maxOrders)) {
    return { ok: false, code: CODE_ABHOLFENSTER_VOLL }
  }
  return { ok: true, fenster }
}

/** Das Fenster war beim Anlegen voll — eine gleichzeitige Bestellung war schneller. */
export class AbholfensterVoll extends Error {
  constructor() {
    super('Abholfenster voll')
    this.name = 'AbholfensterVoll'
  }
}

/**
 * Legt die Bestellung an — bei einem Fenster mit Höchstzahl unter der Sperre
 * seiner Zeile, mit erneuter Zählung. Voll → `AbholfensterVoll`, nichts
 * angelegt. Ohne Höchstzahl ist nichts zu zählen: direkt anlegen.
 */
export async function imAbholfenster<T>(
  farmId: string,
  fenster: HofFenster,
  anlegen: (db: Db) => Promise<T>
): Promise<T> {
  const { id, maxOrders } = fenster.slot
  if (maxOrders === null) return anlegen(prisma)
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PickupSlot" WHERE id = ${id} FOR UPDATE`
    if (istVoll(await belegung(tx, farmId, fenster), maxOrders)) throw new AbholfensterVoll()
    return anlegen(tx)
  })
}

/**
 * Die ausgebuchten Fenster der nächsten Tage als Schlüssel (`abholSchluessel`)
 * — der Checkout zeigt sie ausgegraut. Eine Abfrage für den ganzen Zeitraum
 * (groupBy), nicht eine je Fenster: Sie läuft beim Rendern der Seite.
 */
export async function ausgebuchteAbholfenster(farmId: string, jetzt: Date): Promise<string[]> {
  const begrenzt = angeboteneAbholfenster(await ladeSlots(farmId), jetzt).filter((f) => f.slot.maxOrders !== null)
  if (begrenzt.length === 0) return []

  const erster = wienerTag(begrenzt[0].datum).von
  const letzter = wienerTag(begrenzt[begrenzt.length - 1].datum).bis
  const gruppen = await prisma.order.groupBy({
    by: ['pickupDate', 'pickupTimeStart', 'pickupTimeEnd'],
    where: { ...BELEGT, farmId, pickupDate: { gte: erster, lte: letzter } },
    _count: { _all: true },
  })
  const belegt = new Map<string, number>()
  for (const g of gruppen) {
    const schluessel = abholSchluessel({
      datum: kalendertagInWien(g.pickupDate),
      start: g.pickupTimeStart,
      ende: g.pickupTimeEnd,
    })
    belegt.set(schluessel, (belegt.get(schluessel) ?? 0) + g._count._all)
  }

  return begrenzt
    .filter((f) => istVoll(belegt.get(abholSchluessel(f)) ?? 0, f.slot.maxOrders))
    .map(abholSchluessel)
}
