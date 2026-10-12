import { prisma } from '@/lib/prisma'
import { hofseiteFortschritt, hofseiteStand } from '@/lib/hofseite-fortschritt'
import type { EinstellungenDaten, KonditionenHof } from '@/lib/hof-einstellungen'
import type { TarifId } from '@/lib/konditionen'
import { getFarmSettings, getOwnerFarm } from './farm'
import { ladeGruendungBis } from './admin'

/**
 * Was die Übersicht der Einstellungen (/settings, Nachtlauf Nr. 22d) über den
 * eigenen Hof braucht. Was fehlt, zählt dieselbe Liste wie „Mein Hof" und
 * „Einrichten" (getOwnerFarm + getFarmSettings → hofseiteFortschritt), damit
 * alle drei Seiten dasselbe sagen. Nur der eigene Hof (ownerId); an die Seite
 * gehen nur Text, Zahlen und Wahrheitswerte — keine Stripe-Kennung.
 *
 * null heißt „kein Hof" (das Layout schickt dann schon nach /onboarding).
 */
export async function ladeEinstellungenUebersicht(ownerId: string): Promise<EinstellungenDaten | null> {
  const [hof, farm, einstellungen, gruendungBis] = await Promise.all([
    prisma.farm.findUnique({
      where: { ownerId },
      select: { stripeAccountId: true, acceptsOnline: true, tarif: true, archivedAt: true, teilenMomenteAus: true },
    }),
    getOwnerFarm(ownerId),
    getFarmSettings(ownerId),
    ladeGruendungBis({ ownerId }),
  ])
  if (!hof || !farm || !einstellungen) return null

  const fortschritt = hofseiteFortschritt(hofseiteStand(farm, einstellungen))
  return {
    name: einstellungen.name,
    address: einstellungen.address,
    postalCode: einstellungen.postalCode,
    city: einstellungen.city,
    hofseiteZeilen: fortschritt.gruppen.flatMap((g) => g.zeilen),
    // getFarmSettings liefert alle Abholzeiten; zählen tun für Kunden nur aktive.
    abholzeiten: einstellungen.pickupSlots
      .filter((s) => s.isActive)
      .map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
    abholzeitenGesamt: einstellungen.pickupSlots.length,
    stripeKontoDa: hof.stripeAccountId !== null,
    stripeBereit: farm.stripeAccountReady,
    onlineAn: hof.acceptsOnline,
    betriebsnummer: einstellungen.betriebsnummer,
    betriebsstatus: einstellungen.betriebsstatus,
    tarif: hof.tarif,
    // Das wirksame Ende (K2, Nr. 62): mit Gründungsplatz Spalte oder Standard, sonst null.
    gruendungBis,
    isPaused: einstellungen.isPaused,
    stillgelegt: hof.archivedAt !== null,
    teilenMomenteAus: hof.teilenMomenteAus,
  }
}

/** Was „im Shop" heißt (produkt-sichtbarkeit.ts: Schalter „Im Shop") — Tarif-Zeile und Vergleich zählen gleich. */
const IM_SHOP_WHERE = { isAvailable: true } as const

/**
 * Die gespeicherten Sätze des eigenen Hofs für /settings/konditionen — als
 * Text (Decimal → string), damit die reine Rechnung (konditionenRechenbeispiel)
 * ohne Prisma-Objekte auskommt und nichts über `Number()` läuft. Dazu für den
 * Vergleich mit Hoftor (Nr. 61) die Produkte im Shop und die aktiven
 * Abholzeiten — gezählt in derselben Abfrage.
 */
export async function ladeKonditionenHof(ownerId: string): Promise<KonditionenHof | null> {
  const [hof, gruendungBis] = await Promise.all([
    prisma.farm.findUnique({
      where: { ownerId },
      select: {
        tarif: true,
        serviceFeePercent: true,
        serviceFeeMinCents: true,
        serviceFeeActiveFrom: true,
        platformFeePercent: true,
        _count: { select: { products: { where: IM_SHOP_WHERE }, pickupSlots: { where: { isActive: true } } } },
      },
    }),
    ladeGruendungBis({ ownerId }),
  ])
  if (!hof) return null
  return {
    tarif: hof.tarif,
    serviceFeePercent: hof.serviceFeePercent.toString(),
    serviceFeeMinCents: hof.serviceFeeMinCents,
    serviceFeeActiveFrom: hof.serviceFeeActiveFrom,
    platformFeePercent: hof.platformFeePercent.toString(),
    // Das wirksame Ende (K2, Nr. 62): mit Gründungsplatz Spalte oder Standard, sonst null.
    gruendungBis,
    produkteImShop: hof._count.products,
    abholzeitenJeWoche: hof._count.pickupSlots,
  }
}

/** Was die Tarif-Zeile der HofShell über den Hof braucht (Nr. 61; das wirksame Gründungs-Ende seit Nr. 62). */
export type TarifStand = { tarif: TarifId | null; produkteImShop: number; gruendungBis: Date | null }

/**
 * Tarif und Produkte im Shop für die Tarif-Zeile — EINE Abfrage, weil jede
 * Seite des Hofbereichs sie lädt (über `ladeTarifZeile`). Ein Hof, den es
 * zwischen Sitzung und Abfrage nicht mehr gibt, zählt wie einer ohne Tarif.
 */
export async function ladeTarifStand(farmId: string): Promise<TarifStand> {
  const [hof, gruendungBis] = await Promise.all([
    prisma.farm.findUnique({
      where: { id: farmId },
      select: { tarif: true, _count: { select: { products: { where: IM_SHOP_WHERE } } } },
    }),
    ladeGruendungBis({ id: farmId }),
  ])
  return { tarif: hof?.tarif ?? null, produkteImShop: hof?._count.products ?? 0, gruendungBis }
}

/**
 * Der Schalter für /settings/teilen (Nr. 30) — nur der eigene Hof (ownerId).
 * null heißt „kein Hof".
 */
export async function ladeTeilenMomente(ownerId: string): Promise<{ teilenMomenteAus: boolean } | null> {
  return prisma.farm.findUnique({ where: { ownerId }, select: { teilenMomenteAus: true } })
}
