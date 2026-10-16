import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { FarmAktivitaet } from '@/lib/farm-aktivitaet'
import { alsLand, type Land } from '@/lib/laender'
import { monatsgrenzenWien } from '@/lib/servicegebuehr'
import { BAR_SERVICEGEBUEHR_AB } from '@/lib/konditionen'
import { ohneTestzahlungenSql } from '@/lib/testzahlung'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import { bestaetigungOffen } from '@/lib/email-bestaetigung'
import { nummerAnzeige } from '@/lib/admin-hoefe'
import { baueGruendungAnzeige, bestimmeGruendungBis, type GruendungAnzeige } from '@/lib/gruendungshof'

/**
 * Die Monatsspalten je Hof (Sprint servicegebuehr, E-3) — das Fundament der
 * Monatsabrechnung (Sprint 3). Alle Beträge in Cent, Bezugsmonat = laufender
 * Kalendermonat in Wiener Zeit, Stichtag = Bestelleingang (createdAt).
 *   bestellungen        Bestellungen des Monats ohne stornierte
 *   gebuehrOnlineCents  online EINBEHALTEN: bezahlte Online-Bestellungen,
 *                       Gebühr nicht entfallen
 *   gebuehrBarCents     bar OFFEN: vor Ort kassierte (abgeholte) Bestellungen,
 *                       Gebühr nicht entfallen — schuldet der Hof der Abrechnung.
 *                       Ohne Barzahlungen vor dem SEPA-Start (Register B1:
 *                       keine Gebühr, ältere werden nicht eingezogen) — dieselbe
 *                       Regel wie `barOhneServicegebuehr` in finanzen.ts.
 *   gebuehrEntfallenCents  entfallen (nicht abgeholt oder storniert)
 * Testzahlungen (online vor dem Stichtag der Live-Schaltung, Register Z4)
 * zählen in keiner Spalte — wie in topfVonBestellung, wo sie „keiner" sind.
 */
export type AdminMonatsSpalten = {
  bestellungen: number
  gebuehrOnlineCents: number
  gebuehrBarCents: number
  gebuehrEntfallenCents: number
}

const MONAT_LEER: AdminMonatsSpalten = {
  bestellungen: 0,
  gebuehrOnlineCents: 0,
  gebuehrBarCents: 0,
  gebuehrEntfallenCents: 0,
}

export type AdminFarmRow = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  /** E-Mail des Inhabers bestätigt (S3, Nr. 17b) — frisch aus der Datenbank. */
  emailBestaetigt: boolean
  /** Bestätigung steht aus und ist Pflicht (Konto ab Stichtag): Freischalten gesperrt. */
  emailBestaetigungOffen: boolean
  createdAt: Date
  approvedAt: Date | null
  archivedAt: Date | null
  /** Das Land des Hofes — deutsche Höfe tragen in der Liste eine Marke und
   *  vor der Freischaltung eine Klär-Erinnerung (src/lib/laender.ts). */
  land: Land
  /** Lebenszeichen: was der Bauer seit der Anmeldung angelegt hat. */
  aktivitaet: FarmAktivitaet
  /** Servicegebühr-Einstellung des Hofes (Farm.serviceFee*), Prozent als Zahl. */
  serviceFeePercent: number
  serviceFeeMinCents: number
  serviceFeeActiveFrom: Date | null
  /** Laufender Monat: Bestellungen und Gebühren (siehe AdminMonatsSpalten). */
  monat: AdminMonatsSpalten
  /** Der Bezugsmonat der Spalten, z. B. „September 2026". */
  monatBezeichnung: string
  /** Stripe-Konto fertig (Farm.stripeAccountReady) — Bedingung fürs Freischalten für jeden Hof (Register Z1). */
  stripeBereit: boolean
  /** Farm.acceptsOnline — nur für das Kennzeichen „Online-Zahlung aus" (Bestandshöfe vor Z1); das Freischalten fragt es nicht. */
  onlineAn: boolean
  /** Bestellungen pausiert (Urlaubsmodus) — nur für Status und Filter der Liste. */
  isPaused: boolean
  /** Betriebsnummer, wie der Hof sie angegeben hat (E9: nur Anzeige, nie geprüft). */
  betriebsnummer: string | null
  /** SEPA-Mandat erteilt (Farm.sepaMandatAm gesetzt) — nur Anzeige. */
  sepaErteilt: boolean
  /** Farm.gruendungBis, die Spalte selbst (null = Standard, Register K2). */
  gruendungBis: Date | null
  /** Das wirksame Gründungs-Ende als Text (Nr. 62); null ohne Gründungsplatz. */
  gruendung: GruendungAnzeige | null
  /** Aus der Vergabe der Gründungsplätze genommen (Register K2, Nr. 109). */
  gruendungAusgenommen: boolean
  /** Wer zuletzt aus- oder wieder aufgenommen hat und wann (Nr. 109) — null, wenn nie. */
  gruendungGeaendertAm: Date | null
  gruendungGeaendertVonUserId: string | null
}

/** Ist der angemeldete Nutzer Plattformbetreiber? Frisch aus der DB, nie aus der Session. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  })
  return user?.isAdmin === true
}

/**
 * Die Monatsspalten ALLER Höfe in EINER Abfrage — gruppiert nach Hof, die
 * Bedingungen als FILTER-Klauseln. Ein aggregate() je Hof wäre ein N+1, das
 * mit jeder Bot-Anmeldung teurer würde. Typisiert über Prisma.sql (gebundene
 * Parameter, kein String-Zusammenbau). Höfe ohne Bestellung im Monat fehlen
 * im Ergebnis und bekommen die Nullzeile. Die Testzahlungen nimmt der
 * Baustein aus der EINEN Regel heraus (`ohneTestzahlungenSql`,
 * src/lib/testzahlung.ts) — ohne Stichtag ist er TRUE.
 */
async function monatsSpaltenJeHof(von: Date, bis: Date, stripeLiveAb: Date | null): Promise<Map<string, AdminMonatsSpalten>> {
  const zeilen = await prisma.$queryRaw<
    Array<{ farmId: string; bestellungen: number; online: number; bar: number; entfallen: number }>
  >(Prisma.sql`
    SELECT
      "farmId",
      COUNT(*) FILTER (WHERE "status" <> 'CANCELLED')::int AS "bestellungen",
      COALESCE(SUM("serviceFeeCents") FILTER (
        WHERE "paymentMethod" = 'ONLINE'
          AND "paymentStatus" = 'PAID'
          AND "serviceFeeRefundedAt" IS NULL
      ), 0)::int AS "online",
      COALESCE(SUM("serviceFeeCents") FILTER (
        WHERE "paymentMethod" IN ('ONSITE_CASH', 'ONSITE_CARD')
          AND "status" = 'PICKED_UP'
          AND "serviceFeeRefundedAt" IS NULL
          AND NOT ("paymentMethod" = 'ONSITE_CASH' AND "createdAt" < ${BAR_SERVICEGEBUEHR_AB})
      ), 0)::int AS "bar",
      COALESCE(SUM("serviceFeeCents") FILTER (
        WHERE "serviceFeeRefundedAt" IS NOT NULL
      ), 0)::int AS "entfallen"
    FROM "Order"
    WHERE "createdAt" >= ${von} AND "createdAt" < ${bis}
      AND ${ohneTestzahlungenSql(Prisma.sql, stripeLiveAb)}
    GROUP BY "farmId"
  `)

  return new Map(
    zeilen.map((z) => [
      z.farmId,
      {
        bestellungen: Number(z.bestellungen),
        gebuehrOnlineCents: Number(z.online),
        gebuehrBarCents: Number(z.bar),
        gebuehrEntfallenCents: Number(z.entfallen),
      },
    ])
  )
}

/**
 * Alle Höfe für den Admin-Bereich — wartende zuerst, dann die jüngsten.
 *
 * Die Zählwerte kommen per `_count` aus DERSELBEN Abfrage. Ein `findMany` je
 * Hof wäre bequemer zu schreiben und bei zwölf Höfen auch nicht spürbar, würde
 * aber mit jeder Bot-Anmeldung teurer — und genau die sollen hier ja auffallen.
 *
 * Gezählt wird alles Angelegte, auch Unveröffentlichtes: ein deaktiviertes
 * Produkt und eine abgeschaltete Abholzeit sind trotzdem Lebenszeichen. Die
 * Frage lautet „hat hier jemand gearbeitet?", nicht „ist der Hof verkaufsfertig?".
 *
 * Die Monatsspalten laufen als ZWEITE Abfrage parallel dazu (Promise.all) —
 * zwei Abfragen insgesamt, unabhängig von der Zahl der Höfe.
 *
 * `stripeLiveAb`: Stichtag der Live-Schaltung (Register Z4); Standard ist die
 * Variable des Servers, Tests geben ihn mit.
 */
export async function getAdminFarms(
  jetzt: Date = new Date(),
  stripeLiveAb: Date | null = STRIPE_LIVE_AB
): Promise<AdminFarmRow[]> {
  const monat = monatsgrenzenWien(jetzt)

  const [farms, spalten] = await Promise.all([
    prisma.farm.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        approvedAt: true,
        archivedAt: true,
        // Deutsche Höfe müssen in der Liste erkennbar sein — sie dürfen nicht
        // beiläufig freigeschaltet werden (Stripe DE, Steuer, Kennzeichnung).
        country: true,
        // Beide nur, um daraus ein Ja/Nein zu machen — der Rohtext und die
        // Bild-URL verlassen diese Funktion nicht.
        description: true,
        logoUrl: true,
        serviceFeePercent: true,
        serviceFeeMinCents: true,
        serviceFeeActiveFrom: true,
        // Nr. 22f: Status, Freischalt-Sperre und Anzeige der Liste. Die
        // Stripe-Kennung selbst verlässt diese Funktion nicht.
        stripeAccountReady: true,
        acceptsOnline: true,
        isPaused: true,
        betriebsnummer: true,
        sepaMandatAm: true,
        gruendungBis: true,
        // Register K2, Nr. 109: gruendungsplaetze lässt ausgenommene Höfe weg.
        gruendungAusgenommen: true,
        gruendungGeaendertAm: true,
        gruendungGeaendertVonUserId: true,
        owner: { select: { email: true, emailVerified: true, createdAt: true } },
        _count: { select: { products: true, farmPhotos: true, pickupSlots: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    monatsSpaltenJeHof(monat.von, monat.bis, stripeLiveAb),
  ])

  const rows = farms.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    ownerEmail: f.owner.email,
    emailBestaetigt: f.owner.emailVerified === true,
    emailBestaetigungOffen: bestaetigungOffen(f.owner),
    createdAt: f.createdAt,
    approvedAt: f.approvedAt,
    archivedAt: f.archivedAt,
    land: alsLand(f.country),
    aktivitaet: {
      produkte: f._count.products,
      fotos: f._count.farmPhotos,
      abholzeiten: f._count.pickupSlots,
      // `description` ist eine PFLICHTSPALTE (prisma/schema.prisma:165), im
      // Onboarding aber ein optionales Feld. Ein Hof ohne Beschreibung trägt
      // deshalb einen leeren String, kein null — ein `!== null` ginge hier
      // immer als „vorhanden" durch. Getrimmt, damit ein versehentliches
      // Leerzeichen nicht als Inhalt zählt.
      hatBeschreibung: f.description.trim().length > 0,
      hatLogo: (f.logoUrl ?? '').trim().length > 0,
    },
    // Decimal → Zahl: die Liste ist eine Client-Komponente.
    serviceFeePercent: Number(f.serviceFeePercent),
    serviceFeeMinCents: f.serviceFeeMinCents,
    serviceFeeActiveFrom: f.serviceFeeActiveFrom,
    monat: spalten.get(f.id) ?? MONAT_LEER,
    monatBezeichnung: monat.bezeichnung,
    stripeBereit: f.stripeAccountReady === true,
    onlineAn: f.acceptsOnline !== false,
    isPaused: f.isPaused === true,
    betriebsnummer: nummerAnzeige(f.betriebsnummer ?? null),
    sepaErteilt: f.sepaMandatAm != null,
    gruendungBis: f.gruendungBis,
    // Aus derselben Liste wie die Plätze (gruendungsplaetze filtert selbst) —
    // keine zweite Abfrage.
    gruendung: baueGruendungAnzeige(f, farms),
    gruendungAusgenommen: f.gruendungAusgenommen,
    gruendungGeaendertAm: f.gruendungGeaendertAm,
    gruendungGeaendertVonUserId: f.gruendungGeaendertVonUserId,
  }))

  // Wartende zuerst — das ist die einzige Liste, in der der Betreiber
  // tatsächlich etwas tun muss. Innerhalb der Gruppen bleibt es bei
  // „jüngste zuerst" aus der Query.
  return [...rows.filter((r) => r.approvedAt === null), ...rows.filter((r) => r.approvedAt !== null)]
}

const HOF_FUER_GRUENDUNG = {
  id: true,
  ownerId: true,
  approvedAt: true,
  createdAt: true,
  archivedAt: true,
  gruendungBis: true,
  // Register K2, Nr. 109: ein ausgenommener Hof belegt keinen Platz.
  gruendungAusgenommen: true,
} satisfies Prisma.FarmSelect

/** Ein Hof der Platzvergabe samt seinem Gründungs-Ende (HofFuerPlatz plus Inhaber und Spalte). */
export type HofFuerGruendung = Prisma.FarmGetPayload<{ select: typeof HOF_FUER_GRUENDUNG }>

/**
 * Die schmale Liste der Platzvergabe (Register K2, Nr. 62): alle
 * freigeschalteten, nicht stillgelegten Höfe — nur sie belegen Plätze
 * (gruendungsplaetze) — mit genau den Feldern, die Platz und Enddatum
 * brauchen. Keine Namen, keine E-Mail: Sie läuft vor jeder Seite des
 * Hofbereichs (Tarif-Zeile), deshalb nicht über getAdminFarms.
 *
 * `db`: Freischalten, Ausnehmen und Wiederaufnehmen lesen die Liste in ihrer
 * Transaktion NACH der Sperre (GRUENDUNGSPLAETZE_SPERRE, Nr. 109) — sonst
 * rechneten sie mit einem Stand von vor dem anderen Weg.
 */
export async function ladeHoefeFuerGruendung(db: Pick<Prisma.TransactionClient, 'farm'> = prisma): Promise<HofFuerGruendung[]> {
  return db.farm.findMany({ where: { approvedAt: { not: null }, archivedAt: null }, select: HOF_FUER_GRUENDUNG })
}

/**
 * Das wirksame Gründungs-Enddatum eines Hofs (Register K2, Nr. 62) — der EINE
 * Lader für Tarif-Zeile, „Deine Konditionen" und die Übersicht der
 * Einstellungen. Eine Abfrage: Der eigene Hof steckt mit seiner Spalte in der
 * Liste der Platzvergabe; fehlt er dort (wartet, stillgelegt), hat er keinen
 * Platz und damit kein Datum. Nach Kennung oder Inhaber, weil die Einstellungen
 * den Hof über den Inhaber laden.
 */
export async function ladeGruendungBis(hof: { id: string } | { ownerId: string }): Promise<Date | null> {
  const hoefe = await ladeHoefeFuerGruendung()
  const eigener = hoefe.find((h) => ('id' in hof ? h.id === hof.id : h.ownerId === hof.ownerId))
  return eigener ? bestimmeGruendungBis(eigener, hoefe) : null
}

/**
 * Höfe, die auf Freischaltung warten — die Zahl am Reiter „Höfe" der
 * AdminShell. Dieselbe Regel wie die Liste: wartend heißt approvedAt null.
 */
export async function zaehleWartendeHoefe(): Promise<number> {
  return prisma.farm.count({ where: { approvedAt: null } })
}
