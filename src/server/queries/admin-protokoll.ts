import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { bestellnummerSchema } from '@/schemas/bestellnummer'
import type { ProtokollFilter } from '@/schemas/betrieb-mails'

/*
 * Admin › Betrieb › Protokoll lesen (Register N33, Nr. 193; Mockup
 * admin-protokoll). Nur lesend, Recht „ansehen“ (die Seite prüft).
 *
 * NIE Adresse, Name einer Person, Inhalt oder Token: Das Protokoll selbst
 * trägt nur Kennungen (protokolliere, src/server/admin-protokoll.ts). Für die
 * Anzeige werden genau zwei Dinge nachgeschlagen — der Name eines Hofs (öffentlich,
 * steht auf der Hofseite) und die Nummer einer Bestellung. Von der Bestellung
 * wird NUR `orderNumber` gelesen, nie die Adresse der Kundin.
 */

/** Höchstens so viele Zeilen auf der Seite; die CSV nimmt alle im Zeitraum bis EXPORT_HOECHSTENS. */
export const PROTOKOLL_SEITE = 100
export const PROTOKOLL_EXPORT_HOECHSTENS = 5000

export type ProtokollRoh = {
  id: string
  wann: Date
  wer: string | null
  art: string
  bezugArt: string
  bezugId: string
  grund: string | null
  mitPasskey: boolean
}

export type ProtokollNamen = {
  /** Kennung des Hofs → Name des Hofs. */
  hoefe: Map<string, string>
  /** Kennung der Bestellung → Bestellnummer. */
  bestellungen: Map<string, string>
}

/**
 * Die Bedingung aus dem Filter. Der Bezug ist genau eine Kennung oder eine
 * Bestellnummer — die Nummer wird in die Kennung der Bestellung übersetzt
 * (eine Abfrage, nur `id`). Keine Teilsuche.
 */
async function bedingung(f: ProtokollFilter, ich: string, jetzt: Date): Promise<Prisma.AdminAktionWhereInput> {
  const und: Prisma.AdminAktionWhereInput[] = [{ wann: { gte: new Date(jetzt.getTime() - f.tage * 86_400_000) } }]
  if (f.wer === 'system') und.push({ wer: null })
  if (f.wer === 'ich') und.push({ wer: ich })
  if (f.wer === 'team') und.push({ wer: { not: null } }, { NOT: { wer: ich } })
  if (f.art !== 'alle') und.push({ art: f.art })
  if (f.nurPasskey) und.push({ mitPasskey: true })
  if (f.bezug) {
    const nummer = bestellnummerSchema.safeParse(f.bezug)
    const bestellung = nummer.success ? await prisma.order.findUnique({ where: { orderNumber: nummer.data }, select: { id: true } }) : null
    und.push({ bezugId: { in: bestellung ? [f.bezug, bestellung.id] : [f.bezug] } })
  }
  return { AND: und }
}

/** Die Namen zu den Kennungen der Zeilen — Hofname und Bestellnummer, sonst nichts. */
async function ladeNamen(zeilen: readonly ProtokollRoh[]): Promise<ProtokollNamen> {
  const hofIds = [...new Set(zeilen.filter((z) => z.bezugArt === 'hof').map((z) => z.bezugId))]
  const bestellIds = [...new Set(zeilen.filter((z) => z.bezugArt === 'bestellung').map((z) => z.bezugId))]
  const [hoefe, bestellungen] = await Promise.all([
    hofIds.length > 0 ? prisma.farm.findMany({ where: { id: { in: hofIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    bestellIds.length > 0 ? prisma.order.findMany({ where: { id: { in: bestellIds } }, select: { id: true, orderNumber: true } }) : Promise.resolve([]),
  ])
  return {
    hoefe: new Map(hoefe.map((h) => [h.id, h.name])),
    bestellungen: new Map(bestellungen.map((b) => [b.id, b.orderNumber])),
  }
}

const AUSWAHL = { id: true, wann: true, wer: true, art: true, bezugArt: true, bezugId: true, grund: true, mitPasskey: true } as const

/** Die Zeilen der Seite (neueste zuerst), die Zahl im Zeitraum und die Namen der Bezüge. */
export async function ladeProtokoll(
  f: ProtokollFilter,
  ich: string,
  jetzt: Date,
  hoechstens: number = PROTOKOLL_SEITE
): Promise<{ zeilen: ProtokollRoh[]; gesamt: number; namen: ProtokollNamen }> {
  const where = await bedingung(f, ich, jetzt)
  const [zeilen, gesamt] = await Promise.all([
    prisma.adminAktion.findMany({ where, orderBy: [{ wann: 'desc' }, { id: 'desc' }], take: hoechstens, select: AUSWAHL }),
    prisma.adminAktion.count({ where }),
  ])
  return { zeilen, gesamt, namen: await ladeNamen(zeilen) }
}
