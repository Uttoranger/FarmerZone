import { prisma } from '@/lib/prisma'
import { wienJetzt } from '@/lib/hofuebersicht'
import { ausgebuchteTage } from '@/server/abholfenster'
import { PRODUCT_ORDER_BY } from './products'
import {
  IN_LISTEN_SICHTBAR,
  UEBERSICHT_HOF_SELECT,
  UEBERSICHT_ZEILEN_SELECT,
  baueHofUebersicht,
  type HofUebersichtEintrag,
} from './farm'

/**
 * Region ohne eigenen Standort (Register N23, Board v2 §4): „So steht dein Hof
 * gerade in der Liste der Kundschaft". Der Eintrag entsteht genau so wie auf
 * /hoefe — dieselben Felder (UEBERSICHT_*_SELECT), dieselbe Reihenfolge der
 * Produkte, derselbe Zusammenbau (baueHofUebersicht) und dieselbe
 * Sichtbarkeit (IN_LISTEN_SICHTBAR, kein Testhof, Register N21) —, nur für
 * den EIGENEN Hof: Die farmId kommt aus der Sitzung, nie aus der Anfrage.
 *
 * null: Der Hof steht gerade nicht in der Liste (Testhof, noch nicht
 * freigeschaltet, stillgelegt) — dann zeigt Region einen Satz statt der Karte.
 */
export async function ladeEigenenListeneintrag(farmId: string): Promise<HofUebersichtEintrag | null> {
  const jetzt = new Date()
  const [hof, zeilen, ausgebucht] = await Promise.all([
    prisma.farm.findFirst({ where: { ...IN_LISTEN_SICHTBAR, id: farmId }, select: UEBERSICHT_HOF_SELECT }),
    prisma.product.findMany({
      where: { isAvailable: true, farmId, farm: IN_LISTEN_SICHTBAR },
      orderBy: PRODUCT_ORDER_BY,
      select: UEBERSICHT_ZEILEN_SELECT,
    }),
    // Die vollen Abholfenster des eigenen Hofs, wie auf /hoefe (Register N19, Ergänzung 21.10.2026).
    ausgebuchteTage([farmId], jetzt),
  ])
  if (!hof) return null
  return baueHofUebersicht([hof], zeilen, wienJetzt(jetzt), ausgebucht)[0] ?? null
}
