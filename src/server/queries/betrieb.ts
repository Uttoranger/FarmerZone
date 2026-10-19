import { prisma } from '@/lib/prisma'
import {
  MESS_ARTEN,
  MESS_BEGINN_ART,
  VERLAUF_TAGE,
  TREND_TAGE,
  betriebHinweis,
  utcMonatsbeginn,
  utcTag,
  utcTagVersetzt,
  type AblaufLaufDaten,
  type BetriebHinweis,
  type Messung,
} from '@/lib/betrieb'
import { betriebArtSchema } from '@/schemas/betrieb-messung'

/*
 * Lesen für Admin › Betrieb (Register N18, Nr. 103). Gerechnet wird in
 * src/lib/betrieb.ts; hier nur Abfragen und die EINE Stelle, an der `wert`
 * (BigInt) zur Zahl wird — die Werte liegen weit unter 2^53, und ein BigInt
 * darf weder an eine Client-Komponente noch in JSON.stringify.
 */

/** BigInt → Zahl, an genau dieser Stelle. */
function alsZahl(wert: bigint): number {
  return Number(wert)
}

/** Ein Tag aus einer @db.Date-Spalte (00:00 UTC) als JJJJ-MM-TT. */
function tagText(tag: Date): string {
  return tag.toISOString().slice(0, 10)
}

/** Messungen ab einem UTC-Tag — Arten außerhalb der Liste fallen weg (Zod, src/schemas/betrieb-messung.ts). */
async function ladeMessungenAb(abTag: string): Promise<Messung[]> {
  const zeilen = await prisma.betriebMessung.findMany({
    where: { tag: { gte: new Date(`${abTag}T00:00:00.000Z`) } },
    select: { tag: true, art: true, wert: true, gemessenAm: true },
  })
  return zeilen.flatMap((z) => {
    const art = betriebArtSchema.safeParse(z.art)
    return art.success ? [{ tag: tagText(z.tag), art: art.data, wert: alsZahl(z.wert), gemessenAm: z.gemessenAm }] : []
  })
}

/** Die Messungen für Kacheln und Verlauf: 90 Tage, mindestens aber der laufende Monat (E-Mails im Monat). */
export async function ladeMessungenFuerSeite(jetzt: Date): Promise<Messung[]> {
  const heute = utcTag(jetzt)
  const ab = [utcTagVersetzt(heute, -(Math.max(VERLAUF_TAGE, TREND_TAGE) - 1)), utcTag(utcMonatsbeginn(jetzt))].sort()[0]
  return ladeMessungenAb(ab)
}

/** Die Messungen für die Prüfung der Grenzen: der laufende Monat, gestern (Vortag der Mails) und 30 Tage für den Trend in der Mail. */
export async function ladeMessungenFuerPruefung(jetzt: Date): Promise<Messung[]> {
  const heute = utcTag(jetzt)
  const ab = [utcTagVersetzt(heute, -TREND_TAGE), utcTag(utcMonatsbeginn(jetzt))].sort()[0]
  return ladeMessungenAb(ab)
}

/**
 * Wann zuletzt gemessen wurde (nur, was `messeBetrieb` schreibt — der
 * Mail-Zähler zählt nicht). `mitBeginn`: auch der Merker von „Jetzt messen“
 * (Nr. 113) — dann sagt die Zeit, warum gerade nicht neu gemessen wird, auch
 * wenn eine Messung noch läuft.
 */
export async function letzteMessungAm(mitBeginn = false): Promise<Date | null> {
  const zeile = await prisma.betriebMessung.findFirst({
    where: { art: { in: mitBeginn ? [...MESS_ARTEN, MESS_BEGINN_ART] : [...MESS_ARTEN] } },
    orderBy: { gemessenAm: 'desc' },
    select: { gemessenAm: true },
  })
  return zeile?.gemessenAm ?? null
}

/** Die E-Mail-Zahl eines Monats bis heute und die eigenen Auflistungen des Bild-Speichers im Monat. */
export async function summeImMonat(art: 'mails' | 'bilderAuflistungen', jetzt: Date): Promise<number> {
  const summe = await prisma.betriebMessung.aggregate({
    where: { art, tag: { gte: utcMonatsbeginn(jetzt) } },
    _sum: { wert: true },
  })
  return summe._sum.wert === null ? 0 : alsZahl(summe._sum.wert)
}

export type WarnZeile = { art: string; stufe: number; seit: Date; gemeldetAm: Date }

export async function ladeWarnungen(): Promise<WarnZeile[]> {
  return prisma.betriebWarnung.findMany({ select: { art: true, stufe: true, seit: true, gemeldetAm: true } })
}

/** Der Herzschlag aller Abläufe, nach Name. */
export async function ladeLaeufe(): Promise<Map<string, AblaufLaufDaten>> {
  const zeilen = await prisma.ablaufLauf.findMany({
    select: { name: true, gestartetAm: true, beendetAm: true, ok: true, fehlerKlasse: true, dauerMs: true },
  })
  return new Map(zeilen.map(({ name, ...lauf }) => [name, lauf]))
}

export type TabellenZeile = { name: string; bytes: number; zeilen: number | null }

/**
 * Die fünf größten Tabellen des eigenen Schemas — nur lesen, ohne Parameter
 * von außen. `reltuples` ist die Schätzung von Postgres (nach ANALYZE);
 * -1 heißt „noch nie geschätzt“ und wird zu null.
 */
export async function ladeGroessteTabellen(): Promise<TabellenZeile[]> {
  const zeilen = await prisma.$queryRaw<Array<{ name: string; bytes: bigint; zeilen: bigint | null }>>`
    SELECT c.relname AS name,
           pg_total_relation_size(c.oid)::bigint AS bytes,
           CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END AS zeilen
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema() AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 5`
  return zeilen.map((z) => ({ name: z.name, bytes: alsZahl(z.bytes), zeilen: z.zeilen === null ? null : alsZahl(z.zeilen) }))
}

/** Alle Messungen für „Messungen als CSV“ — nur Tag, Art, Zahl. */
export async function ladeAlleMessungen(): Promise<Array<Pick<Messung, 'tag' | 'art' | 'wert'>>> {
  const zeilen = await prisma.betriebMessung.findMany({ orderBy: [{ tag: 'asc' }, { art: 'asc' }], select: { tag: true, art: true, wert: true } })
  return zeilen.flatMap((z) => {
    const art = betriebArtSchema.safeParse(z.art)
    return art.success ? [{ tag: tagText(z.tag), art: art.data, wert: alsZahl(z.wert) }] : []
  })
}

/**
 * Für Punkt und Hinweis der AdminShell (Register N15): offene Warnungen und
 * der Herzschlag — zwei kleine Abfragen ohne Rechnung, die Regel steht in
 * `betriebHinweis`. Ruft nur ladeAdminbereich, und nur in der Produktion.
 */
export async function ladeBetriebHinweis(jetzt: Date): Promise<BetriebHinweis | null> {
  const [warnungen, laeufe] = await Promise.all([prisma.betriebWarnung.findMany({ where: { stufe: { gt: 0 } }, select: { art: true, stufe: true } }), ladeLaeufe()])
  return betriebHinweis(warnungen, laeufe, jetzt)
}
