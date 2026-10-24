import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { GRENZE, MAIL_HAENGT_MINUTEN, MAIL_PROTOKOLL_AUFBEWAHREN_TAGE, QUOTE_TAGE, utcTag, utcTagesbeginn, utcTagVersetzt } from '@/lib/betrieb'
import { MAIL_VERLAUF_TAGE, type ArtZahlen, type LetzterDurchlauf, type ProblemAuftrag, type SuchBestellung, type SuchMail, type VerlaufTag, type WarteschlangeDaten } from '@/lib/betrieb-mails'
import { empfaengerFingerabdruck } from '@/lib/mail-empfaenger'
import { VORRANG } from '@/schemas/mail-auftrag'
import type { MailSuche } from '@/schemas/betrieb-mails'
import { kannWartenPausiert } from '@/server/mail-warteschlange'
import { summeImMonat } from '@/server/queries/betrieb'

/*
 * Lesen für Admin › Betrieb › E-Mails (Register N26, N18-Ergänzung; Nr. 161).
 * Gerechnet wird in src/lib/betrieb-mails.ts; hier nur Abfragen. Gelesen
 * werden nur Art, Weg, Stand, Zeiten, Fehlercode und Kennungen — nie
 * `bezug`, nie `empfaengerHash` (der dient nur als Bedingung der Suche).
 *
 * Die Adresse einer Bestellung (`customerEmail`) liest nur die Suche, und
 * nur für die gekürzte Anzeige; die Suche per Adresse ist exakt: gleich der
 * klein geschriebenen, getrimmten Eingabe bzw. gleich ihrem Fingerabdruck.
 * Kein LIKE, kein `contains`, kein `mode: 'insensitive'` (das wäre ILIKE, und
 * `_` ist dort ein Platzhalter) — tests/betrieb-mails-suche.test.ts wacht.
 */

const TAG_MS = 86_400_000
/** Offen oder in Arbeit: was die Warteschlange gerade hält. */
const WARTEND = ['offen', 'in_arbeit']

/** Zahl aus COUNT/SUM (bigint) bzw. AVG (Decimal als Text) — an genau dieser Stelle. */
function zahl(wert: bigint | number | string | null | { toString(): string }): number {
  if (wert === null) return 0
  return typeof wert === 'number' ? wert : Number(wert.toString())
}

/** Mails des UTC-Tags (Zähler von Admin › Betrieb) und des Abrechnungszeitraums — dieselben Zahlen wie Kachel und Warnung. */
export async function ladeMailZaehler(jetzt: Date): Promise<{ heute: number; imZeitraum: number }> {
  const [heute, imZeitraum] = await Promise.all([
    prisma.betriebMessung.findUnique({ where: { tag_art: { tag: utcTagesbeginn(jetzt), art: 'mails' } }, select: { wert: true } }),
    summeImMonat('mails', jetzt),
  ])
  return { heute: heute ? zahl(heute.wert) : 0, imZeitraum }
}

/**
 * Die Warteschlange gerade: je Weg Zahl und ältester Auftrag, die älteste
 * wartende wichtige Mail und seit wann der älteste FÄLLIGE Auftrag ungeholt
 * liegt (offen und an der Reihe, oder in Arbeit mit abgelaufener Belegung;
 * „Kann warten“ zählt nur, solange es nicht pausiert).
 */
export async function ladeWarteschlange(jetzt: Date, zaehler: { heute: number; imZeitraum: number }): Promise<WarteschlangeDaten> {
  const pausiert = kannWartenPausiert(zaehler, { mailsTag: GRENZE.mailsTag, mailsMonat: GRENZE.mailsMonat })
  const [gruppen, aeltesteWichtige, faellig] = await Promise.all([
    prisma.mailAuftrag.groupBy({ by: ['vorrang'], where: { status: { in: WARTEND }, vorrang: { gt: VORRANG.sofort } }, _count: { _all: true } }),
    prisma.mailAuftrag.findFirst({
      where: { status: { in: WARTEND }, vorrang: VORRANG.wichtig },
      orderBy: { erstelltAm: 'asc' },
      select: { id: true, art: true, versuche: true, fehlerCode: true, naechsterVersuchAm: true, erstelltAm: true, bestellungId: true },
    }),
    prisma.$queryRaw<Array<{ seit: Date | null }>>`
      SELECT MIN(CASE WHEN "status" = 'in_arbeit' THEN "belegtBis" ELSE "naechsterVersuchAm" END) AS "seit"
      FROM "MailAuftrag"
      WHERE ("vorrang" = ${VORRANG.wichtig} OR (${!pausiert} AND "vorrang" = ${VORRANG.kannWarten}))
        AND (("status" = 'offen' AND "naechsterVersuchAm" <= ${jetzt}) OR ("status" = 'in_arbeit' AND "belegtBis" < ${jetzt}))`,
  ])
  const anzahl = (vorrang: number): number => gruppen.find((g) => g.vorrang === vorrang)?._count._all ?? 0
  return {
    wichtig: anzahl(VORRANG.wichtig),
    kannWarten: anzahl(VORRANG.kannWarten),
    aeltesteWichtigeAm: aeltesteWichtige?.erstelltAm ?? null,
    aeltesteWichtige: aeltesteWichtige
      ? {
          id: aeltesteWichtige.id,
          art: aeltesteWichtige.art,
          versuche: aeltesteWichtige.versuche,
          fehlerCode: aeltesteWichtige.fehlerCode,
          naechsterVersuchAm: aeltesteWichtige.naechsterVersuchAm,
          zuBestellung: aeltesteWichtige.bestellungId !== null,
        }
      : null,
    faelligSeit: faellig[0]?.seit ?? null,
    kannWartenPausiert: pausiert,
  }
}

/**
 * Wer in „Braucht dich“ steht (Nr. 161 Punkt 6): aufgegebene Aufträge der
 * letzten 24 Stunden (letzter Versuch = `naechsterVersuchAm`), Aufträge, die
 * es nach einem Fehler von selbst wieder versuchen, und solche, die länger
 * als 15 Minuten fällig liegen. Eine Bedingung für Liste, Zahl und die
 * Aktionen „alle einer Art“ — sonst träfe „Alle n verwerfen“ auch eine
 * Bestellbestätigung, die gerade normal wartet, und „Alle n jetzt schicken“
 * eine Mail, die vor Wochen gescheitert ist.
 */
export function problemBedingung(jetzt: Date): Prisma.MailAuftragWhereInput {
  const vor24h = new Date(jetzt.getTime() - TAG_MS)
  const haengtAb = new Date(jetzt.getTime() - MAIL_HAENGT_MINUTEN * 60_000)
  return {
    OR: [
      { status: 'gescheitert', naechsterVersuchAm: { gte: vor24h } },
      { status: 'offen', versuche: { gt: 0 } },
      { status: 'offen', vorrang: { gt: VORRANG.sofort }, naechsterVersuchAm: { lt: haengtAb } },
      { status: 'in_arbeit', belegtBis: { lt: haengtAb } },
    ],
  }
}

/**
 * „Braucht dich“ und die Kachel „Gescheitert · 24 h“ (`problemBedingung`).
 * Höchstens 100 — die Seite zeigt die Zahl, die Liste ist zum Handeln da.
 */
export async function ladeProbleme(jetzt: Date): Promise<ProblemAuftrag[]> {
  return prisma.mailAuftrag.findMany({
    where: problemBedingung(jetzt),
    orderBy: { naechsterVersuchAm: 'desc' },
    take: 100,
    select: { id: true, art: true, vorrang: true, status: true, versuche: true, fehlerCode: true, erstelltAm: true, naechsterVersuchAm: true, belegtBis: true },
  })
}

/** Nur die Zahl für den Unterreiter „E-Mails“ im Überblick — dieselbe Bedingung wie `ladeProbleme`, ohne Obergrenze. */
export async function zaehleProbleme(jetzt: Date): Promise<number> {
  return prisma.mailAuftrag.count({ where: problemBedingung(jetzt) })
}

/**
 * Je Art und Weg die Zahlen der letzten 7 Tage (eingestellt seit): gesendet,
 * zugestellt, gescheitert, abgelehnt, Spam gemeldet und die mittlere
 * Wartezeit vom Einstellen bis zum Versand (nur über die Warteschlange).
 */
export async function ladeArtZahlen(jetzt: Date): Promise<ArtZahlen[]> {
  const ab = new Date(jetzt.getTime() - QUOTE_TAGE * TAG_MS)
  const zeilen = await prisma.$queryRaw<
    Array<{ art: string; vorrang: number; gesendet: bigint; zugestellt: bigint; gescheitert: bigint; abgelehnt: bigint; spam: bigint; wartezeit: Prisma.Decimal | number | null }>
  >`
    SELECT "art", "vorrang",
      COUNT(*) FILTER (WHERE "status" = 'gesendet') AS "gesendet",
      COUNT(*) FILTER (WHERE "zugestelltAm" IS NOT NULL) AS "zugestellt",
      COUNT(*) FILTER (WHERE "status" = 'gescheitert') AS "gescheitert",
      COUNT(*) FILTER (WHERE "bounceAm" IS NOT NULL) AS "abgelehnt",
      COUNT(*) FILTER (WHERE "beschwerdeAm" IS NOT NULL) AS "spam",
      AVG(EXTRACT(EPOCH FROM ("gesendetAm" - "erstelltAm")) * 1000) FILTER (WHERE "gesendetAm" IS NOT NULL AND "vorrang" > ${VORRANG.sofort}) AS "wartezeit"
    FROM "MailAuftrag"
    WHERE "erstelltAm" >= ${ab}
    GROUP BY "art", "vorrang"`
  return zeilen.map((z) => ({
    art: z.art,
    vorrang: z.vorrang,
    gesendet: zahl(z.gesendet),
    zugestellt: zahl(z.zugestellt),
    gescheitert: zahl(z.gescheitert),
    abgelehnt: zahl(z.abgelehnt),
    spam: zahl(z.spam),
    wartezeitMs: z.wartezeit === null ? null : zahl(z.wartezeit),
  }))
}

/** Gesendet und gescheitert je UTC-Tag, 30 Tage bis heute. */
export async function ladeMailVerlauf(jetzt: Date): Promise<VerlaufTag[]> {
  const ab = new Date(`${utcTagVersetzt(utcTag(jetzt), -(MAIL_VERLAUF_TAGE - 1))}T00:00:00.000Z`)
  const [gesendet, gescheitert] = await Promise.all([
    prisma.$queryRaw<Array<{ tag: string; anzahl: bigint }>>`
      SELECT to_char("gesendetAm", 'YYYY-MM-DD') AS "tag", COUNT(*) AS "anzahl"
      FROM "MailAuftrag" WHERE "status" = 'gesendet' AND "gesendetAm" >= ${ab}
      GROUP BY 1`,
    prisma.$queryRaw<Array<{ tag: string; anzahl: bigint }>>`
      SELECT to_char("naechsterVersuchAm", 'YYYY-MM-DD') AS "tag", COUNT(*) AS "anzahl"
      FROM "MailAuftrag" WHERE "status" = 'gescheitert' AND "naechsterVersuchAm" >= ${ab}
      GROUP BY 1`,
  ])
  const tage = new Set([...gesendet.map((z) => z.tag), ...gescheitert.map((z) => z.tag)])
  return [...tage].map((tag) => ({
    tag,
    gesendet: zahl(gesendet.find((z) => z.tag === tag)?.anzahl ?? null),
    gescheitert: zahl(gescheitert.find((z) => z.tag === tag)?.anzahl ?? null),
  }))
}

/** Der letzte Lauf des Ablaufs „E-Mails“ und wie viele Mails über die Warteschlange er geschickt hat. */
export async function ladeLetztenDurchlauf(): Promise<LetzterDurchlauf> {
  const lauf = await prisma.ablaufLauf.findUnique({ where: { name: 'mails' }, select: { gestartetAm: true, beendetAm: true, dauerMs: true } })
  if (!lauf) return null
  const mails = lauf.beendetAm
    ? await prisma.mailAuftrag.count({ where: { vorrang: { gt: VORRANG.sofort }, gesendetAm: { gte: lauf.gestartetAm, lte: lauf.beendetAm } } })
    : 0
  return { gestartetAm: lauf.gestartetAm, dauerMs: lauf.dauerMs, mails }
}

/** Für die Prüfung der Mail-Warnungen (Ablauf „E-Mails“) und das Lebenszeichen: nur, was die Regeln brauchen. */
export async function ladeQuoten(jetzt: Date): Promise<{ gesendet: number; abgelehnt: number; spam: number }> {
  const ab = new Date(jetzt.getTime() - QUOTE_TAGE * TAG_MS)
  const [gesendet, abgelehnt, spam] = await Promise.all([
    prisma.mailAuftrag.count({ where: { erstelltAm: { gte: ab }, status: 'gesendet' } }),
    prisma.mailAuftrag.count({ where: { erstelltAm: { gte: ab }, bounceAm: { not: null } } }),
    prisma.mailAuftrag.count({ where: { erstelltAm: { gte: ab }, beschwerdeAm: { not: null } } }),
  ])
  return { gesendet, abgelehnt, spam }
}

const SUCH_MAIL_FELDER = {
  id: true,
  art: true,
  vorrang: true,
  status: true,
  bestellungId: true,
  erstelltAm: true,
  gesendetAm: true,
  zugestelltAm: true,
  bounceAm: true,
  beschwerdeAm: true,
} as const satisfies Prisma.MailAuftragSelect

const SUCH_BESTELLUNG_FELDER = {
  id: true,
  orderNumber: true,
  pickupDate: true,
  paymentMethod: true,
  paymentStatus: true,
  status: true,
  customerEmail: true,
  farm: { select: { name: true } },
} as const satisfies Prisma.OrderSelect

function alsBestellung(o: Prisma.OrderGetPayload<{ select: typeof SUCH_BESTELLUNG_FELDER }>): SuchBestellung {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    hofName: o.farm.name,
    pickupDate: o.pickupDate,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    customerEmail: o.customerEmail,
  }
}

/**
 * Die Suche (Nr. 161 Punkt 5; Nr. 167 nimmt dieselbe Abfrage): nur mit einer
 * schon geprüften Eingabe (`mailSucheAus`) — eine ungültige kommt hier nie an.
 *
 *  - Bestellnummer: die Bestellung (gleich der Nummer, in den letzten 90
 *    Tagen) und alle Aufträge mit ihrer `bestellungId`.
 *  - Adresse: die Bestellungen der letzten 90 Tage mit genau dieser Adresse
 *    und alle Aufträge mit ihrem Fingerabdruck (auch ohne Bestellung, etwa
 *    Anmeldecodes); dazu die Bestellungen, auf die diese Aufträge zeigen.
 */
export async function sucheMails(suche: Extract<MailSuche, { art: 'bestellung' | 'adresse' }>, jetzt: Date): Promise<{ bestellungen: SuchBestellung[]; mails: SuchMail[] }> {
  const ab = new Date(jetzt.getTime() - MAIL_PROTOKOLL_AUFBEWAHREN_TAGE * TAG_MS)
  if (suche.art === 'bestellung') {
    const bestellung = await prisma.order.findFirst({ where: { orderNumber: suche.nummer, createdAt: { gte: ab } }, select: SUCH_BESTELLUNG_FELDER })
    if (!bestellung) return { bestellungen: [], mails: [] }
    const mails = await prisma.mailAuftrag.findMany({ where: { bestellungId: bestellung.id }, orderBy: { erstelltAm: 'asc' }, select: SUCH_MAIL_FELDER })
    return { bestellungen: [alsBestellung(bestellung)], mails }
  }
  const [vonAdresse, mails] = await Promise.all([
    prisma.order.findMany({ where: { customerEmail: suche.adresse, createdAt: { gte: ab } }, orderBy: { createdAt: 'desc' }, take: 20, select: SUCH_BESTELLUNG_FELDER }),
    prisma.mailAuftrag.findMany({
      where: { empfaengerHash: empfaengerFingerabdruck(suche.adresse), erstelltAm: { gte: ab } },
      orderBy: { erstelltAm: 'asc' },
      take: 200,
      select: SUCH_MAIL_FELDER,
    }),
  ])
  const bekannt = new Set(vonAdresse.map((o) => o.id))
  const fehlend = [...new Set(mails.flatMap((m) => (m.bestellungId !== null && !bekannt.has(m.bestellungId) ? [m.bestellungId] : [])))]
  const dazu = fehlend.length === 0 ? [] : await prisma.order.findMany({ where: { id: { in: fehlend } }, select: SUCH_BESTELLUNG_FELDER })
  return { bestellungen: [...vonAdresse, ...dazu].map(alsBestellung), mails }
}
