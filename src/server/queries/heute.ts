import { prisma } from '@/lib/prisma'
import { wienKalendertag } from '@/lib/kalender'
import {
  UEBERFAELLIG_EINZELN,
  type AbholZeile,
  type BrauchtDichEintrag,
  type NaechsteAbholung,
  type Wochenvergleich,
  abholtage,
  abholtagName,
  abholWhere,
  abholZeilen,
  brauchtDich,
  naechsteAbholungWhere,
  ueberfaelligWhere,
  wienerTag,
  wochenvergleich,
} from '@/lib/heute'
import { umsatzfenster } from '@/lib/umsatz'
import { umsatzCent } from '@/server/queries/umsatz'
import { statusReminder } from '@/lib/dashboard-hints'
import { ersteSchritte, ersteSchritteDaten, type ErsteSchritteErgebnis } from '@/lib/erste-schritte'
import { onlineZahlungPausiert } from '@/lib/stripe-konto'

/**
 * Alles für den Heute-Bildschirm (/dashboard) in einem Zug. Die Regeln stehen
 * rein in src/lib/heute.ts, der Umsatz kommt aus der gemeinsamen Regel
 * (src/lib/umsatz.ts, src/server/queries/umsatz.ts).
 */

export type Heute = {
  abholungen: AbholZeile[]
  /** Der nächste Abholtag nach heute mit offenen Bestellungen; null = keiner in Sicht (die Zeile entfällt). */
  naechsteAbholung: NaechsteAbholung | null
  brauchtDich: BrauchtDichEintrag[]
  woche: Wochenvergleich
  ersteSchritte: ErsteSchritteErgebnis
  wartetAufFreigabe: boolean
  /**
   * Der Hof will online kassieren, Stripe lässt es gerade nicht zu — dann der
   * Hinweis mit dem Weg zu Stripe; `kontoVorhanden` entscheidet, ob der Knopf
   * erst ein Konto anlegt.
   */
  onlinePausiert: { kontoVorhanden: boolean } | null
}

export async function getHeute(farmId: string, jetzt: Date = new Date()): Promise<Heute> {
  const { heute } = abholtage(jetzt)
  // Dieselbe Regel wie Verkauf und Auswertung: src/lib/umsatz.ts.
  const wochenfenster = umsatzfenster('woche', jetzt)

  const [
    heutige,
    naechste,
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
    prisma.order.findFirst({
      where: naechsteAbholungWhere(farmId, jetzt),
      orderBy: { pickupDate: 'asc' },
      select: { pickupDate: true },
    }),
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
    umsatzCent(farmId, wochenfenster.aktuell),
    umsatzCent(farmId, wochenfenster.vergleich),
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
        stripeAccountId: true,
        acceptsOnline: true,
        approvedAt: true,
      },
    }),
    prisma.product.count({ where: { farmId } }),
    prisma.pickupSlot.count({ where: { farmId, isActive: true } }),
  ])

  // Erst der Tag, dann seine Bestellungen — über dieselbe Bedingung wie
  // „Heute abholen", damit Zeile und Bestellliste dieselben Bestellungen zählen.
  let naechsteAbholung: NaechsteAbholung | null = null
  if (naechste) {
    const tag = wienKalendertag(naechste.pickupDate)
    const anzahl = await prisma.order.count({ where: abholWhere(farmId, wienerTag(tag)) })
    naechsteAbholung = { tag, name: abholtagName(wienKalendertag(jetzt), tag), anzahl }
  }

  return {
    abholungen: abholZeilen(heutige),
    naechsteAbholung,
    brauchtDich: brauchtDich({
      ueberfaellig: { anzahl: ueberfaelligAnzahl, juengste: ueberfaelligJuengste },
      ausverkauft,
      ohneKategorie,
      statusErinnerung: statusReminder(letzterStatus?.publishedAt ?? null, jetzt),
    }),
    woche: wochenvergleich(umsatzDieseWoche, umsatzVorwoche),
    ersteSchritte: ersteSchritte(ersteSchritteDaten(hof, { produkte, aktiveAbholzeiten })),
    wartetAufFreigabe: hof?.approvedAt == null,
    onlinePausiert:
      hof && onlineZahlungPausiert(hof) ? { kontoVorhanden: hof.stripeAccountId != null } : null,
  }
}
