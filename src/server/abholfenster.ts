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
import type { AbholFenster } from '@/lib/hofuebersicht'

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

/** Eine Abholzeit, wie Hofliste und Hofseite sie kennen: Wochentag, Beginn, Ende. */
type Wochenfenster = Pick<AbholFenster, 'dayOfWeek' | 'startTime' | 'endTime'>

/**
 * Der Schlüssel einer Abholzeit: „Wochentag|HH:MM|HH:MM" — wie `abholSchluessel`,
 * nur mit dem Wochentag statt des Kalendertags. Die Selects der Abholzeiten in
 * Hofliste und Hofseite tragen keine id; Wochentag, Beginn und Ende sind je Hof
 * eindeutig (src/lib/pickup-slot-rules.ts sperrt Dubletten und Überlappungen).
 */
export function fensterSchluessel(fenster: Wochenfenster): string {
  return `${fenster.dayOfWeek}|${fenster.startTime}|${fenster.endTime}`
}

/** Eine Abholzeit, die im Vorlauf an mindestens einem Tag voll ist — mit diesen Wiener Kalendertagen, aufsteigend. */
export type AusgebuchtesFenster = Wochenfenster & { ausgebuchtAm: string[] }

/** Je Hof (id) und Abholzeit (`fensterSchluessel`) die vollen Tage; Höfe und Abholzeiten ohne vollen Tag fehlen. */
export type AusgebuchteTage = ReadonlyMap<string, ReadonlyMap<string, AusgebuchtesFenster>>

const BEGRENZT_AUSWAHL = {
  farmId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  maxOrders: true,
} satisfies Prisma.PickupSlotSelect

/**
 * Die vollen Abholfenster vieler Höfe im Vorlauf (`ABHOL_VORLAUF_TAGE`, Register
 * N19, Ergänzung 21.10.2026) — die eine Zählung für Kasse, Hofliste und Hofseite.
 * Gezählt wird wie beim Anlegen (`BELEGT`, `istVoll`), nur für Abholzeiten mit
 * Höchstzahl. Zwei Abfragen für alle Höfe zusammen: die aktiven Abholzeiten mit
 * Höchstzahl, danach EIN groupBy nur für die Höfe, die eine haben — ohne sie
 * läuft die zweite nicht.
 *
 * Filtert die Sichtbarkeit NICHT: Die Hofliste gibt nur Höfe aus ihrer Abfrage
 * mit `IN_LISTEN_SICHTBAR` hinein, Kasse und Hofseite ihren eigenen Hof — auch
 * einen Testhof, bei dem man bestellen kann (Register N21).
 */
export async function ausgebuchteTage(farmIds: readonly string[], jetzt: Date): Promise<AusgebuchteTage> {
  const ergebnis = new Map<string, Map<string, AusgebuchtesFenster>>()
  if (farmIds.length === 0) return ergebnis
  const slots = await prisma.pickupSlot.findMany({
    where: { farmId: { in: [...farmIds] }, isActive: true, maxOrders: { not: null } },
    select: BEGRENZT_AUSWAHL,
  })
  const begrenzt = angeboteneAbholfenster(slots, jetzt)
  if (begrenzt.length === 0) return ergebnis

  const gruppen = await prisma.order.groupBy({
    by: ['farmId', 'pickupDate', 'pickupTimeStart', 'pickupTimeEnd'],
    where: {
      ...BELEGT,
      farmId: { in: [...new Set(slots.map((s) => s.farmId))] },
      pickupDate: { gte: wienerTag(begrenzt[0].datum).von, lte: wienerTag(begrenzt[begrenzt.length - 1].datum).bis },
    },
    _count: { _all: true },
  })
  const belegt = new Map<string, number>()
  for (const g of gruppen) {
    const schluessel = `${g.farmId}|${abholSchluessel({
      datum: kalendertagInWien(g.pickupDate),
      start: g.pickupTimeStart,
      ende: g.pickupTimeEnd,
    })}`
    belegt.set(schluessel, (belegt.get(schluessel) ?? 0) + g._count._all)
  }

  for (const f of begrenzt) {
    if (!istVoll(belegt.get(`${f.slot.farmId}|${abholSchluessel(f)}`) ?? 0, f.slot.maxOrders)) continue
    const jeFenster = ergebnis.get(f.slot.farmId) ?? new Map<string, AusgebuchtesFenster>()
    const schluessel = fensterSchluessel(f.slot)
    const voll = jeFenster.get(schluessel) ?? {
      dayOfWeek: f.slot.dayOfWeek,
      startTime: f.slot.startTime,
      endTime: f.slot.endTime,
      ausgebuchtAm: [],
    }
    voll.ausgebuchtAm.push(f.datum)
    jeFenster.set(schluessel, voll)
    ergebnis.set(f.slot.farmId, jeFenster)
  }
  return ergebnis
}

/**
 * Eine Abholzeit für Hofliste und Hofseite — ausdrücklich gebaut aus Wochentag,
 * Beginn und Ende, `ausgebuchtAm` nur bei einer im Vorlauf vollen: Sonst fehlt
 * das Feld, und der Zwischenspeicher wächst nicht. `maxOrders` geht nie mit.
 */
export function alsAbholFenster(slot: Wochenfenster, voll: ReadonlyMap<string, AusgebuchtesFenster> | undefined): AbholFenster {
  const tage = voll?.get(fensterSchluessel(slot))?.ausgebuchtAm
  return {
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    ...(tage ? { ausgebuchtAm: tage } : {}),
  }
}

/**
 * Die ausgebuchten Fenster der nächsten Tage als Schlüssel (`abholSchluessel`)
 * — der Checkout zeigt sie ausgegraut. Aus `ausgebuchteTage`, damit Kasse,
 * Hofliste und Hofseite dieselben vollen Fenster nennen; Reihenfolge wie
 * `angeboteneAbholfenster` (Tag, dann Beginn).
 */
export async function ausgebuchteAbholfenster(farmId: string, jetzt: Date): Promise<string[]> {
  const volle = (await ausgebuchteTage([farmId], jetzt)).get(farmId)
  return [...(volle?.values() ?? [])]
    .flatMap((f) => f.ausgebuchtAm.map((datum) => ({ datum, start: f.startTime, ende: f.endTime })))
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.start.localeCompare(b.start))
    .map(abholSchluessel)
}
