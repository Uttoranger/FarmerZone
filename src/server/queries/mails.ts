import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { GRENZE, MAIL_HAENGT_MINUTEN, MAIL_PROTOKOLL_AUFBEWAHREN_TAGE, QUOTE_TAGE, utcTag, utcTagesbeginn, utcTagVersetzt } from '@/lib/betrieb'
import {
  MAIL_VERLAUF_TAGE,
  NOCHMAL_AUF_EINMAL,
  zeitraumAb,
  type AlleMailRoh,
  type ArtZahlen,
  type KannWartenSumme,
  type LetzterDurchlauf,
  type NochmalStand,
  type ProblemAuftrag,
  type SuchBestellung,
  type SuchMail,
  type VerlaufTag,
  type WarteschlangeDaten,
} from '@/lib/betrieb-mails'
import { empfaengerFingerabdruck } from '@/lib/mail-empfaenger'
import { hofKontaktEmail, HOF_KONTAKT_FELDER } from '@/lib/hof-kontakt'
import { MAIL_WEG, VORRANG, type MailArt } from '@/schemas/mail-auftrag'
import type { AlleMailsFilter, MailStandFilter, MailSuche } from '@/schemas/betrieb-mails'
import { kannWartenPausiert } from '@/server/mail-warteschlange'
import { summeImMonat } from '@/server/queries/betrieb'

/*
 * Lesen für Admin › Betrieb › E-Mails (Register N26, N18-Ergänzung; Nr. 161).
 * Gerechnet wird in src/lib/betrieb-mails.ts; hier nur Abfragen. Gelesen
 * werden nur Art, Weg, Stand, Zeiten, Fehlercode und Kennungen — nie
 * `empfaengerHash` (der dient nur als Bedingung der Suche). `bezug` lesen nur
 * zwei Stellen aus Nr. 167, und keine zeigt ihn: die Summen „Kann warten“
 * (nur die Kennung des Beitrags bzw. der Meldung zum Gruppieren) und
 * `ladeGescheiterteDerArt` (für die Action, die ihn in den neuen Auftrag kopiert).
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
      select: { id: true, art: true, status: true, versuche: true, fehlerCode: true, naechsterVersuchAm: true, erstelltAm: true, bestellungId: true },
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
          status: aeltesteWichtige.status,
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
  ausloeser: true,
  nochmalVon: true,
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

// ─── Alle Mails (Register N27, Nr. 167) ──────────────────────────────────────

/** Was „Alle Mails“ und das Detail aus einer Zeile lesen — nie `bezug`, nie `empfaengerHash`. */
const ALLE_FELDER = {
  id: true,
  art: true,
  vorrang: true,
  status: true,
  versuche: true,
  fehlerCode: true,
  erstelltAm: true,
  gesendetAm: true,
  naechsterVersuchAm: true,
  zugestelltAm: true,
  bounceAm: true,
  beschwerdeAm: true,
  bestellungId: true,
  farmId: true,
  ausloeser: true,
  nochmalVon: true,
} as const satisfies Prisma.MailAuftragSelect

/** Je Seite so viele Mails. */
export const ALLE_SEITE = 50

/** Die Bedingung eines Stands — dieselben Wörter wie `standWort`. */
function standBedingung(stand: MailStandFilter): Prisma.MailAuftragWhereInput {
  switch (stand) {
    case 'gesendet':
      return { status: 'gesendet' }
    case 'zugestellt':
      return { zugestelltAm: { not: null } }
    case 'offen':
      return { status: { in: ['offen', 'in_arbeit'] } }
    case 'gescheitert':
      return { status: 'gescheitert' }
    case 'gesperrt':
      return { status: { in: ['gesperrt', 'ohne_schluessel'] } }
    case 'verworfen':
      return { status: 'verworfen' }
    case 'abgelehnt':
      return { OR: [{ bounceAm: { not: null } }, { beschwerdeAm: { not: null } }] }
  }
}

/**
 * Die Bedingung der einzelnen Mails: Zeitraum (höchstens 90 Tage), Art, Weg,
 * Stand, Hof, nur vom Support. „Kann warten“ steht NIE einzeln (N27) — die
 * Bedingung schließt den Weg immer aus; ein Filter auf ihn trifft nichts.
 */
export function alleMailsBedingung(f: AlleMailsFilter, jetzt: Date): Prisma.MailAuftragWhereInput {
  const und: Prisma.MailAuftragWhereInput[] = [{ erstelltAm: { gte: zeitraumAb(f.zeitraum, jetzt) } }, { vorrang: { not: VORRANG.kannWarten } }]
  if (f.weg) und.push({ vorrang: VORRANG[f.weg] })
  if (f.art) und.push({ art: f.art })
  if (f.stand) und.push(standBedingung(f.stand))
  if (f.hof) und.push({ farmId: f.hof })
  if (f.support) und.push({ ausloeser: 'support' })
  return { AND: und }
}

/**
 * Eine Seite „Alle Mails“: neueste zuerst, 50 je Seite, Cursor über
 * (`erstelltAm`, `id`). Dazu die Trefferzahl (dieselbe Bedingung) und die
 * Namen für die Spalte „Bestellung bzw. Hof“ — die Bestellnummer (keine
 * Personenangabe, §2 der Freigabe), nie eine Adresse.
 */
export async function ladeAlleMails(
  f: AlleMailsFilter,
  nach: { am: Date; id: string } | null,
  jetzt: Date
): Promise<{ zeilen: AlleMailRoh[]; weiter: AlleMailRoh | null; anzahl: number; bestellnummern: Map<string, string>; hoefe: Map<string, string> }> {
  const bedingung = alleMailsBedingung(f, jetzt)
  const seite = nach ? { AND: [bedingung, { OR: [{ erstelltAm: { lt: nach.am } }, { erstelltAm: nach.am, id: { lt: nach.id } }] }] } : bedingung
  const [roh, anzahl] = await Promise.all([
    prisma.mailAuftrag.findMany({ where: seite, orderBy: [{ erstelltAm: 'desc' }, { id: 'desc' }], take: ALLE_SEITE + 1, select: ALLE_FELDER }),
    prisma.mailAuftrag.count({ where: bedingung }),
  ])
  const zeilen = roh.slice(0, ALLE_SEITE)
  const bestellIds = [...new Set(zeilen.flatMap((z) => (z.bestellungId ? [z.bestellungId] : [])))]
  const hofIds = [...new Set(zeilen.flatMap((z) => (z.farmId ? [z.farmId] : [])))]
  const [bestellungen, hoefe] = await Promise.all([
    bestellIds.length === 0 ? [] : prisma.order.findMany({ where: { id: { in: bestellIds } }, select: { id: true, orderNumber: true } }),
    hofIds.length === 0 ? [] : prisma.farm.findMany({ where: { id: { in: hofIds } }, select: { id: true, name: true } }),
  ])
  return {
    zeilen,
    weiter: roh.length > ALLE_SEITE ? (zeilen.at(-1) ?? null) : null,
    anzahl,
    bestellnummern: new Map(bestellungen.map((b) => [b.id, b.orderNumber])),
    hoefe: new Map(hoefe.map((h) => [h.id, h.name])),
  }
}

/** Die Arten, die nur als Summe erscheinen. */
const KANN_WARTEN_ARTEN = (Object.keys(MAIL_WEG) as MailArt[]).filter((a) => MAIL_WEG[a] === 'kannWarten')

/**
 * Kann warten als Summe je Beitrag, Rundschreiben oder Bescheid (N27) — nie
 * eine Zeile mit Empfänger. Gruppiert wird über die Kennung im Bezug (Beitrag,
 * Meldung) bzw. über das Rundschreiben des Fadens; gelesen wird aus `bezug`
 * nur diese Kennung. Höchstens 20 Summen, neueste zuerst. Mit Filter auf
 * Stand oder „nur vom Support“ gibt es keine Summen (die Summe zeigt alle
 * Stände; Kann warten schickt der Support nie nochmal).
 */
export async function ladeKannWartenSummen(f: AlleMailsFilter, jetzt: Date): Promise<KannWartenSumme[]> {
  if (f.support || f.stand) return []
  if (f.weg && f.weg !== 'kannWarten') return []
  if (f.art && !KANN_WARTEN_ARTEN.includes(f.art)) return []
  const arten = f.art ? [f.art] : KANN_WARTEN_ARTEN
  const ab = zeitraumAb(f.zeitraum, jetzt)
  const hof = f.hof ? Prisma.sql`AND m."farmId" = ${f.hof}` : Prisma.empty
  const zeilen = await prisma.$queryRaw<
    Array<{ art: string; gruppe: string | null; erstelltAm: Date; gesendet: bigint; offen: bigint; gescheitert: bigint; abgelehnt: bigint; spam: bigint }>
  >`
    SELECT m."art",
      CASE m."art" WHEN 'beitrag' THEN m."bezug"->>'postId' WHEN 'rundschreiben' THEN u."rundschreibenId" ELSE m."bezug"->>'meldungId' END AS "gruppe",
      MIN(m."erstelltAm") AS "erstelltAm",
      COUNT(*) FILTER (WHERE m."status" = 'gesendet') AS "gesendet",
      COUNT(*) FILTER (WHERE m."status" IN ('offen', 'in_arbeit')) AS "offen",
      COUNT(*) FILTER (WHERE m."status" = 'gescheitert') AS "gescheitert",
      COUNT(*) FILTER (WHERE m."bounceAm" IS NOT NULL) AS "abgelehnt",
      COUNT(*) FILTER (WHERE m."beschwerdeAm" IS NOT NULL) AS "spam"
    FROM "MailAuftrag" m
    LEFT JOIN "Unterhaltung" u ON m."art" = 'rundschreiben' AND u."id" = m."bezug"->>'unterhaltungId'
    WHERE m."vorrang" = ${VORRANG.kannWarten} AND m."erstelltAm" >= ${ab} AND m."art" = ANY(${arten}::text[]) ${hof}
    GROUP BY 1, 2
    ORDER BY MIN(m."erstelltAm") DESC
    LIMIT 20`
  const postIds = zeilen.flatMap((z) => (z.art === 'beitrag' && z.gruppe ? [z.gruppe] : []))
  const rundIds = zeilen.flatMap((z) => (z.art === 'rundschreiben' && z.gruppe ? [z.gruppe] : []))
  const [posts, rund] = await Promise.all([
    postIds.length === 0 ? [] : prisma.statusPost.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true } }),
    rundIds.length === 0 ? [] : prisma.rundschreiben.findMany({ where: { id: { in: rundIds } }, select: { id: true, titel: true } }),
  ])
  const titel = new Map<string, string>([...posts.map((p): [string, string] => [p.id, p.title]), ...rund.map((r): [string, string] => [r.id, r.titel])])
  return zeilen.map((z) => ({
    art: z.art,
    gruppe: z.gruppe,
    // Ein Bescheid trägt keinen Titel — der Text der Meldung ist Fremdtext einer Kundin.
    titel: z.art !== 'bescheid' && z.gruppe ? (titel.get(z.gruppe) ?? null) : null,
    erstelltAm: z.erstelltAm,
    gesendet: zahl(z.gesendet),
    offen: zahl(z.offen),
    gescheitert: zahl(z.gescheitert),
    abgelehnt: zahl(z.abgelehnt),
    spam: zahl(z.spam),
  }))
}

/** Die Höfe für den Filter, nach Namen. */
export async function ladeHofAuswahl(): Promise<Array<{ id: string; name: string }>> {
  return prisma.farm.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 500 })
}

/** Was `passtNochmal` und der Bestätigungsschritt von der Bestellung brauchen — dazu die Adresse für die gekürzte Anzeige. */
const NOCHMAL_BESTELLUNG_FELDER = {
  id: true,
  orderNumber: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  cancelReason: true,
  createdAt: true,
  pickupDate: true,
  pickupTimeStart: true,
  customerEmail: true,
  // Mit der Anmelde-Adresse: ohne Hof-E-Mail ginge die Hof-Mail dorthin (hofKontaktEmail, Nr. 194).
  farm: { select: { name: true, archivedAt: true, ...HOF_KONTAKT_FELDER } },
} as const satisfies Prisma.OrderSelect

export type NochmalBezugStand = NochmalStand & {
  /** Die heute hinterlegte Adresse — nur für die gekürzte Anzeige, nie gespeichert. */
  adresse: string | null
  bestellung: (NochmalStand['bestellung'] & { id: string; orderNumber: string; farm: { name: string } }) | null
  hofName: string | null
}

type NochmalQuelle = 'bestellung' | 'hof' | 'hofInhaber' | null
type NochmalBestellung = Prisma.OrderGetPayload<{ select: typeof NOCHMAL_BESTELLUNG_FELDER }>
const NOCHMAL_HOF_FELDER = { id: true, name: true, approvedAt: true, archivedAt: true, owner: { select: { email: true } } } as const satisfies Prisma.FarmSelect
type NochmalHof = Prisma.FarmGetPayload<{ select: typeof NOCHMAL_HOF_FELDER }>

/** Der Stand aus dem Hof — Freischaltung an die Inhaberin. */
function standAusHof(hof: NochmalHof | null): NochmalBezugStand {
  return { bestellung: null, hof: hof ? { approvedAt: hof.approvedAt, archivedAt: hof.archivedAt } : null, adresse: hof?.owner.email ?? null, hofName: hof?.name ?? null }
}

/** Der Stand aus der Bestellung — Kundin aus der Bestellung, Hof aus dem Hof der Bestellung. */
function standAusBestellung(b: NochmalBestellung | null, quelle: NochmalQuelle): NochmalBezugStand {
  const adresse = !b || quelle === null ? null : quelle === 'hof' ? hofKontaktEmail(b.farm) : b.customerEmail
  return { bestellung: b, hof: null, adresse, hofName: b?.farm.name ?? null }
}

/**
 * Der heutige Stand für „Nochmal schicken“ (N27): Bestellung bzw. Hof frisch
 * aus der Datenbank, dazu die Adresse, an die die Mail HEUTE ginge —
 * Kundin aus der Bestellung, Hof aus dem Hof, Freischaltung an die Inhaberin.
 */
export async function ladeNochmalStand(m: { art: string; bestellungId: string | null; farmId: string | null }, quelle: NochmalQuelle): Promise<NochmalBezugStand> {
  if (quelle === 'hofInhaber') {
    return standAusHof(m.farmId ? await prisma.farm.findUnique({ where: { id: m.farmId }, select: NOCHMAL_HOF_FELDER }) : null)
  }
  return standAusBestellung(m.bestellungId ? await prisma.order.findUnique({ where: { id: m.bestellungId }, select: NOCHMAL_BESTELLUNG_FELDER }) : null, quelle)
}

/**
 * Derselbe Stand für viele Mails auf einmal („Alle nochmal schicken“, Nr. 170):
 * höchstens EINE Abfrage je Bezugstabelle (Bestellungen, Höfe) statt einer je
 * Mail. Ergebnis je Kennung der Mail.
 */
export async function ladeNochmalStaende(
  mails: ReadonlyArray<{ id: string; art: string; bestellungId: string | null; farmId: string | null }>,
  quelleVon: (art: string) => NochmalQuelle
): Promise<Map<string, NochmalBezugStand>> {
  const zuHof = mails.filter((m) => quelleVon(m.art) === 'hofInhaber')
  const zuBestellung = mails.filter((m) => quelleVon(m.art) !== 'hofInhaber')
  const hofIds = [...new Set(zuHof.flatMap((m) => (m.farmId ? [m.farmId] : [])))]
  const bestellIds = [...new Set(zuBestellung.flatMap((m) => (m.bestellungId ? [m.bestellungId] : [])))]
  const [hoefe, bestellungen] = await Promise.all([
    hofIds.length === 0 ? [] : prisma.farm.findMany({ where: { id: { in: hofIds } }, select: NOCHMAL_HOF_FELDER }),
    bestellIds.length === 0 ? [] : prisma.order.findMany({ where: { id: { in: bestellIds } }, select: NOCHMAL_BESTELLUNG_FELDER }),
  ])
  const hofJe = new Map(hoefe.map((h) => [h.id, h]))
  const bestellungJe = new Map(bestellungen.map((b) => [b.id, b]))
  const ergebnis = new Map<string, NochmalBezugStand>()
  for (const m of zuHof) ergebnis.set(m.id, standAusHof(m.farmId ? (hofJe.get(m.farmId) ?? null) : null))
  for (const m of zuBestellung) ergebnis.set(m.id, standAusBestellung(m.bestellungId ? (bestellungJe.get(m.bestellungId) ?? null) : null, quelleVon(m.art)))
  return ergebnis
}

/** Wie oft eine Mail in den letzten 24 Stunden nochmal ging — gezählt über `nochmalVon` (N27). */
export async function zaehleNochmalHeute(wurzel: string, jetzt: Date): Promise<number> {
  return prisma.mailAuftrag.count({ where: { nochmalVon: wurzel, erstelltAm: { gte: new Date(jetzt.getTime() - TAG_MS) } } })
}

/** Dasselbe für viele ursprüngliche Mails in EINER Abfrage (Nr. 170) — eine fehlende Kennung heißt 0. */
export async function zaehleNochmalHeuteJe(wurzeln: readonly string[], jetzt: Date): Promise<Map<string, number>> {
  if (wurzeln.length === 0) return new Map()
  const gruppen = await prisma.mailAuftrag.groupBy({
    by: ['nochmalVon'],
    where: { nochmalVon: { in: [...wurzeln] }, erstelltAm: { gte: new Date(jetzt.getTime() - TAG_MS) } },
    _count: { _all: true },
  })
  return new Map(gruppen.flatMap((g) => (g.nochmalVon ? [[g.nochmalVon, g._count._all] as [string, number]] : [])))
}

/**
 * Das Detail einer Mail: die Zeile, alle Mails mit `nochmalVon` auf ihre
 * ursprüngliche, wie oft davon in 24 Stunden, und der heutige Stand samt
 * Adresse (nur für die gekürzte Anzeige). `null`: steht nicht (mehr) im Protokoll.
 */
export async function ladeMailDetail(
  id: string,
  quelleVon: (art: string) => 'bestellung' | 'hof' | 'hofInhaber' | null,
  jetzt: Date
): Promise<{ mail: AlleMailRoh; nochmal: AlleMailRoh[]; heute: number; stand: NochmalBezugStand } | null> {
  const mail = await prisma.mailAuftrag.findUnique({ where: { id }, select: ALLE_FELDER })
  if (!mail) return null
  const wurzel = mail.nochmalVon ?? mail.id
  const [nochmal, heute, stand] = await Promise.all([
    prisma.mailAuftrag.findMany({ where: { nochmalVon: wurzel }, orderBy: { erstelltAm: 'asc' }, take: 50, select: ALLE_FELDER }),
    zaehleNochmalHeute(wurzel, jetzt),
    ladeNochmalStand(mail, quelleVon(mail.art)),
  ])
  return { mail, nochmal, heute, stand }
}

/** Die gescheiterten Mails einer Art aus „Braucht dich“ — für „Alle nochmal schicken“, höchstens 100. */
export async function ladeGescheiterteDerArt(art: MailArt, jetzt: Date): Promise<Array<{ id: string; art: string; status: string; bestellungId: string | null; farmId: string | null; nochmalVon: string | null; bezug: Prisma.JsonValue }>> {
  return prisma.mailAuftrag.findMany({
    where: { AND: [{ art, status: 'gescheitert', vorrang: VORRANG.wichtig }, problemBedingung(jetzt)] },
    orderBy: { naechsterVersuchAm: 'desc' },
    take: NOCHMAL_AUF_EINMAL,
    select: { id: true, art: true, status: true, bestellungId: true, farmId: true, nochmalVon: true, bezug: true },
  })
}
