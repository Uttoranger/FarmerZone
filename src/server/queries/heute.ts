import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  UEBERFAELLIG_EINZELN,
  type AbholZeile,
  type BrauchtDichEintrag,
  type Wochenvergleich,
  abholtage,
  abholWhere,
  abholZeilen,
  brauchtDich,
  ueberfaelligWhere,
  wochenfenster,
  wochenvergleich,
} from '@/lib/heute'
import { statusReminder } from '@/lib/dashboard-hints'
import { ersteSchritte, ersteSchritteDaten, type ErsteSchritteErgebnis } from '@/lib/erste-schritte'

/**
 * Alles für den Heute-Bildschirm (/dashboard) in einem Zug. Die Regeln stehen
 * rein in src/lib/heute.ts; hier werden nur Zeilen beschafft und Decimal
 * einmal in Cent gewandelt (CODING_STANDARDS §2 Geld).
 */

function centsAusDecimal(betrag: Prisma.Decimal | null): number {
  return betrag ? Math.round(betrag.mul(100).toNumber()) : 0
}

/** Umsatz nach der Regel der Auswertung: abgeholte Bestellungen nach Abholzeitpunkt plus manuelle Verkäufe nach Verkaufsdatum. */
async function umsatzCent(farmId: string, zeitraum: { von: Date; bis: Date }): Promise<number> {
  const [bestellungen, verkaeufe] = await Promise.all([
    prisma.order.aggregate({
      where: { farmId, status: 'PICKED_UP', pickedUpAt: { gte: zeitraum.von, lte: zeitraum.bis } },
      _sum: { totalAmount: true },
    }),
    prisma.manualSale.aggregate({
      where: { farmId, saleDate: { gte: zeitraum.von, lte: zeitraum.bis } },
      _sum: { totalAmount: true },
    }),
  ])
  return centsAusDecimal(bestellungen._sum.totalAmount) + centsAusDecimal(verkaeufe._sum.totalAmount)
}

export type Heute = {
  abholungen: AbholZeile[]
  /** Bestellungen für morgen — nur für die schmale Zeile „Morgen: n Bestellungen". */
  morgenAnzahl: number
  brauchtDich: BrauchtDichEintrag[]
  woche: Wochenvergleich
  ersteSchritte: ErsteSchritteErgebnis
  wartetAufFreigabe: boolean
}

export async function getHeute(farmId: string, jetzt: Date = new Date()): Promise<Heute> {
  const { heute, morgen } = abholtage(jetzt)
  const { dieseWoche, vorwoche } = wochenfenster(jetzt)

  const [
    heutige,
    morgenAnzahl,
    ueberfaelligAnzahl,
    ueberfaelligJuengste,
    ausverkauft,
    ohneKategorie,
    letzterStatus,
    umsatzDieseWoche,
    umsatzVorwoche,
    hof,
    produkte,
    aktiveAbholzeiten,
  ] = await Promise.all([
    prisma.order.findMany({
      where: abholWhere(farmId, heute),
      select: {
        id: true,
        customerName: true,
        pickupTimeStart: true,
        pickupTimeEnd: true,
        paymentMethod: true,
        status: true,
        items: { select: { productName: true, quantity: true } },
      },
    }),
    prisma.order.count({ where: abholWhere(farmId, morgen) }),
    prisma.order.count({ where: ueberfaelligWhere(farmId, jetzt) }),
    prisma.order.findMany({
      where: ueberfaelligWhere(farmId, jetzt),
      select: { id: true, customerName: true, pickupDate: true },
      orderBy: { pickupDate: 'desc' },
      take: UEBERFAELLIG_EINZELN,
    }),
    // Dieselbe Regel wie produktZustand (produkt-sichtbarkeit.ts): im Shop, Bestand 0.
    prisma.product.findMany({
      where: { farmId, isAvailable: true, stock: { lte: 0 } },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    // Nur Produkte im Shop: Ein ausgeblendetes ohne Kategorie stört keine Kundin.
    prisma.product.findMany({
      where: { farmId, isAvailable: true, category: null },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.statusPost.findFirst({
      where: { farmId, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    }),
    umsatzCent(farmId, dieseWoche),
    umsatzCent(farmId, vorwoche),
    // Einstiegs-Checkliste: dieselben Daten wie bisher auf der Übersicht.
    prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        description: true,
        latitude: true,
        longitude: true,
        logoUrl: true,
        bannerType: true,
        bannerUrl: true,
        stripeAccountReady: true,
        approvedAt: true,
      },
    }),
    prisma.product.count({ where: { farmId } }),
    prisma.pickupSlot.count({ where: { farmId, isActive: true } }),
  ])

  return {
    abholungen: abholZeilen(heutige),
    morgenAnzahl,
    brauchtDich: brauchtDich({
      ueberfaellig: { anzahl: ueberfaelligAnzahl, juengste: ueberfaelligJuengste },
      ausverkauft,
      ohneKategorie,
      statusErinnerung: statusReminder(letzterStatus?.publishedAt ?? null, jetzt),
    }),
    woche: wochenvergleich(umsatzDieseWoche, umsatzVorwoche),
    ersteSchritte: ersteSchritte(ersteSchritteDaten(hof, { produkte, aktiveAbholzeiten })),
    wartetAufFreigabe: hof?.approvedAt == null,
  }
}
