import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  CODE_ABHOLFENSTER_UNGUELTIG,
  CODE_ABHOLFENSTER_VOLL,
  abholSchluessel,
  angeboteneAbholfenster,
  findeAbholfenster,
  istVoll,
  tagesZeitraum,
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

/** Ein Fenster aus der Datenbank — mit Zeile (für die Sperre) und Höchstzahl. */
export type HofSlot = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  maxOrders: number | null
  isActive: boolean
}
export type HofFenster = AngebotenesFenster<HofSlot>

/** Die aktiven Fenster des Hofs. */
function ladeSlots(farmId: string): Promise<HofSlot[]> {
  return prisma.pickupSlot.findMany({
    where: { farmId, isActive: true },
    select: { id: true, dayOfWeek: true, startTime: true, endTime: true, maxOrders: true, isActive: true },
  })
}

/** Nicht stornierte Bestellungen dieses Hofs für Tag und Fenster. */
async function belegung(db: Db, farmId: string, wahl: Abholwahl): Promise<number> {
  const tag = tagesZeitraum(wahl.datum)
  if (!tag) return 0
  return db.order.count({
    where: {
      farmId,
      pickupDate: { gte: tag.von, lt: tag.bis },
      pickupTimeStart: wahl.start,
      pickupTimeEnd: wahl.ende,
      status: { not: 'CANCELLED' },
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
 * — der Checkout zeigt sie ausgegraut. Nur Fenster mit Höchstzahl werden
 * gezählt.
 */
export async function ausgebuchteAbholfenster(farmId: string, jetzt: Date): Promise<string[]> {
  const begrenzt = angeboteneAbholfenster(await ladeSlots(farmId), jetzt).filter((f) => f.slot.maxOrders !== null)
  const voll: string[] = []
  for (const fenster of begrenzt) {
    if (istVoll(await belegung(prisma, farmId, fenster), fenster.slot.maxOrders)) voll.push(abholSchluessel(fenster))
  }
  return voll
}
