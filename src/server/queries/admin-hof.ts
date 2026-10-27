import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAdminFarms, type AdminFarmRow } from '@/server/queries/admin'
import { lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { IM_SHOP_WHERE } from '@/server/queries/einstellungen'
import { gruendungEinstellungAus } from '@/lib/plattform-einstellung'
import { gruendungsplaetze } from '@/lib/gruendungshof'
import { adminHofZeile } from '@/lib/admin-hoefe'
import { gruendungAenderung, gruendungZuletztText, platzBeiFreischaltung, testhofAenderung } from '@/lib/admin-hoefe-seite'
import { AKTIVITAET_TAGE, hoefeListenZeile, sortiereHoefeListe, type HoefeListenZeile } from '@/lib/admin-hoefe-liste'
import * as Sentry from '@sentry/nextjs'
import { ohneTestzahlungenSql } from '@/lib/testzahlung'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import type { AdminHof } from '@/components/admin/hoefe-ansicht'

/*
 * Admin › Höfe und die Akte eines Hofs (Register N32, N33; Nachtlauf Nr. 187).
 *
 * `ladeAdminHoefe` baut die Zeilen samt Gründung und Testhof, wie die Seite
 * /admin es bisher selbst tat — EINE Stelle für Liste und Akte, damit die
 * Dialoge (Freischalten, Servicegebühr, Gründung, Testhof) dieselben Daten
 * bekommen wie vorher.
 *
 * `ladeHofAkte` liest nur, was die Akte zusätzlich zeigt: Kontakt, Aktivität
 * der letzten 30 Tage, Zustand und das Protokoll. NIE Daten der Kundschaft —
 * nur Zahlen; die Anmelde-E-Mail des Hofs verlässt den Server nur gekürzt
 * (die Seite kürzt mit maskiereAdresse, bevor sie an den Browser geht).
 */

/**
 * Die Zeilen der Liste /admin/hoefe, wer Blick braucht zuerst — null, wenn das
 * Laden scheitert (gemeldet nur mit dem Bereich, nie mit Hofnamen).
 */
export async function ladeHoefeListe(jetzt: Date): Promise<HoefeListenZeile[] | null> {
  try {
    const farms = await getAdminFarms(jetzt)
    return sortiereHoefeListe(farms.map((f) => hoefeListenZeile(f, jetzt)))
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'hoefe' } })
    return null
  }
}

export type AdminHoefeDaten = { rows: AdminFarmRow[]; hoefe: AdminHof[] }

export async function ladeAdminHoefe(jetzt: Date): Promise<AdminHoefeDaten> {
  const [farms, einstellung] = await Promise.all([
    getAdminFarms(jetzt),
    // Die Zahl der Plätze frisch aus der Einstellung (Register K2) — dieselbe, mit der die Actions prüfen.
    lesePlattformEinstellung(),
  ])
  const regeln = gruendungEinstellungAus(einstellung)
  const { plaetze: maxPlaetze, bis: standardBis } = regeln
  // Wer zuletzt aus- oder wieder aufgenommen hat (Nr. 109) — nur der Name, eine Abfrage für alle Höfe.
  const personIds = [...new Set(farms.flatMap((f) => (f.gruendungGeaendertVonUserId ? [f.gruendungGeaendertVonUserId] : [])))]
  const personen = personIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: personIds } }, select: { id: true, name: true } }) : []
  const nameVon = new Map(personen.map((p) => [p.id, p.name]))
  const plaetze = gruendungsplaetze(farms)
  const hoefe = farms.map((f): AdminHof => {
    const imRennenOderAusgenommen = f.approvedAt !== null && f.archivedAt === null
    return {
      ...adminHofZeile(f, { gruendungsplatz: plaetze.get(f.id) ?? null, maxPlaetze }, jetzt),
      aktivitaet: f.aktivitaet,
      gruendung: f.gruendung,
      platzBeiFreischaltung: f.approvedAt === null && f.archivedAt === null ? platzBeiFreischaltung(f.id, farms, jetzt, regeln) : null,
      gruendungAenderung: imRennenOderAusgenommen ? gruendungAenderung(f, farms, maxPlaetze, standardBis) : null,
      testhofAenderung: testhofAenderung(f, farms, maxPlaetze),
      gruendungZuletzt: gruendungZuletztText(
        f.gruendungGeaendertAm,
        f.gruendungGeaendertVonUserId ? (nameVon.get(f.gruendungGeaendertVonUserId) ?? null) : null
      ),
    }
  })
  return { rows: farms, hoefe }
}

// ─── Akte ───────────────────────────────────────────────────────────────────

const AKTE_HOF_SELECT = {
  id: true,
  phone: true,
  email: true,
  postalCode: true,
  city: true,
  country: true,
  isPaused: true,
  adminGesperrtAm: true,
  adminSperrGrund: true,
  owner: {
    select: {
      email: true,
      // Zuletzt angemeldet: die jüngste Sitzung — nur Zeitpunkt, Gerät (gekürzt) und Art, nie die IP.
      sessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, userAgent: true, anmeldeart: true } },
    },
  },
  pickupSlots: { where: { isActive: true }, select: { dayOfWeek: true } },
  products: { where: IM_SHOP_WHERE, select: { stock: true } },
} satisfies Prisma.FarmSelect

export type HofAkteRoh = {
  hof: Prisma.FarmGetPayload<{ select: typeof AKTE_HOF_SELECT }>
  /** Letzte 30 Tage, ohne Testzahlungen; Beträge in Cent. */
  zahlen: { bestellungen: number; storniert: number; nichtAbgeholt: number; umsatzCents: number; servicegebuehrCents: number }
  erstattungenOffen: number
  nachrichten: Array<{ unterhaltungId: string; vonHof: boolean; system: boolean; am: Date }>
  protokoll: Array<{ id: string; wann: Date; wer: string | null; art: string; grund: string | null; mitPasskey: boolean }>
}

/** Wie weit die Antwortzeit im Postfach zurückschaut. */
const ANTWORT_TAGE = 90
/** So viele Einträge zeigt die Akte aus dem Protokoll. */
export const AKTE_PROTOKOLL_HOECHSTENS = 30

export async function ladeHofAkte(farmId: string, jetzt: Date, stripeLiveAb: Date | null = STRIPE_LIVE_AB): Promise<HofAkteRoh | null> {
  const seit = new Date(jetzt.getTime() - AKTIVITAET_TAGE * 86_400_000)
  const [hof, zahlen, erstattungenOffen, nachrichten, protokoll] = await Promise.all([
    prisma.farm.findUnique({ where: { id: farmId }, select: AKTE_HOF_SELECT }),
    prisma.$queryRaw<HofAkteRoh['zahlen'][]>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE "status" <> 'CANCELLED')::int AS "bestellungen",
        COUNT(*) FILTER (WHERE "status" = 'CANCELLED')::int AS "storniert",
        COUNT(*) FILTER (WHERE "status" = 'NOT_PICKED_UP')::int AS "nichtAbgeholt",
        COALESCE(SUM(ROUND("totalAmount" * 100)) FILTER (WHERE "status" <> 'CANCELLED'), 0)::int AS "umsatzCents",
        COALESCE(SUM("serviceFeeCents") FILTER (WHERE "status" <> 'CANCELLED' AND "serviceFeeRefundedAt" IS NULL), 0)::int AS "servicegebuehrCents"
      FROM "Order"
      WHERE "farmId" = ${farmId} AND "createdAt" >= ${seit}
        AND ${ohneTestzahlungenSql(Prisma.sql, stripeLiveAb)}
    `),
    prisma.order.count({ where: { farmId, erstattungOffenSeit: { not: null } } }),
    prisma.nachricht.findMany({
      where: { unterhaltung: { farmId }, createdAt: { gte: new Date(jetzt.getTime() - ANTWORT_TAGE * 86_400_000) } },
      // Nur Zeit, Faden und wer — nie der Text.
      select: { unterhaltungId: true, vonFarmId: true, art: true, createdAt: true },
    }),
    prisma.adminAktion.findMany({
      where: { bezugArt: 'hof', bezugId: farmId },
      orderBy: { wann: 'desc' },
      take: AKTE_PROTOKOLL_HOECHSTENS,
      select: { id: true, wann: true, wer: true, art: true, grund: true, mitPasskey: true },
    }),
  ])
  if (!hof) return null
  return {
    hof,
    zahlen: zahlen[0] ?? { bestellungen: 0, storniert: 0, nichtAbgeholt: 0, umsatzCents: 0, servicegebuehrCents: 0 },
    erstattungenOffen,
    nachrichten: nachrichten.map((n) => ({ unterhaltungId: n.unterhaltungId, vonHof: n.vonFarmId !== null, system: n.art === 'SYSTEM', am: n.createdAt })),
    protokoll,
  }
}
