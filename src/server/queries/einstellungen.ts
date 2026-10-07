import { prisma } from '@/lib/prisma'
import { hofseiteFortschritt, hofseiteStand } from '@/lib/hofseite-fortschritt'
import type { EinstellungenDaten, KonditionenHof } from '@/lib/hof-einstellungen'
import { getFarmSettings, getOwnerFarm } from './farm'

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
  const [hof, farm, einstellungen] = await Promise.all([
    prisma.farm.findUnique({
      where: { ownerId },
      select: { stripeAccountId: true, acceptsOnline: true, tarif: true, archivedAt: true },
    }),
    getOwnerFarm(ownerId),
    getFarmSettings(ownerId),
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
    isPaused: einstellungen.isPaused,
    stillgelegt: hof.archivedAt !== null,
  }
}

/**
 * Die gespeicherten Sätze des eigenen Hofs für /settings/konditionen — als
 * Text (Decimal → string), damit die reine Rechnung (konditionenRechenbeispiel)
 * ohne Prisma-Objekte auskommt und nichts über `Number()` läuft.
 */
export async function ladeKonditionenHof(ownerId: string): Promise<KonditionenHof | null> {
  const hof = await prisma.farm.findUnique({
    where: { ownerId },
    select: {
      tarif: true,
      serviceFeePercent: true,
      serviceFeeMinCents: true,
      serviceFeeActiveFrom: true,
      platformFeePercent: true,
    },
  })
  if (!hof) return null
  return {
    tarif: hof.tarif,
    serviceFeePercent: hof.serviceFeePercent.toString(),
    serviceFeeMinCents: hof.serviceFeeMinCents,
    serviceFeeActiveFrom: hof.serviceFeeActiveFrom,
    platformFeePercent: hof.platformFeePercent.toString(),
  }
}
