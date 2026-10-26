import * as Sentry from '@sentry/nextjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import {
  ABLAEUFE,
  GRENZ_REGEL,
  GRENZ_WERTE,
  GRENZE,
  MAIL_PRUEFUNG_ALLE_MS,
  MAIL_PRUEFUNG_ART,
  MAIL_WARN_ARTEN,
  MESS_ARTEN,
  MESS_BEGINN_ART,
  VERCEL_WARN_ART,
  abrechnungsBeginn,
  ablaufSchritt,
  ablaufStand,
  ablaufWarnArt,
  anteil,
  bildVorgaengeSchaetzung,
  fehlerKlasse,
  grenzSchritt,
  grenzStandText,
  grenzeVon,
  neuMessenAb,
  ohneVerwendungKarte,
  monatsBeginn,
  utcMonatsbeginn,
  utcTag,
  utcTagesbeginn,
  utcTagVersetzt,
  vercelSchritt,
  vercelStufe,
  vollIn,
  vollInText,
  wannText,
  zuletztText,
  zuwachsText,
  type AblaufName,
  type BetriebArt,
  type BetriebMailAnlass,
  type GrenzRegel,
  type GrenzWert,
  type Messung,
  type Stufe,
  type WarnArt,
  type WarnStand,
} from '@/lib/betrieb'
import { ladeLaeufe, ladeMessungenFuerPruefung, ladeWarnungen, summeImMonat } from '@/server/queries/betrieb'
import { ladeMailZaehler, ladeQuoten, ladeWarteschlange } from '@/server/queries/mails'
import { mailWarnLage, mailWarnSchritt } from '@/lib/betrieb-mails'
import { ladeBetreiberEmpfaenger } from '@/server/queries/postfach'
import { ohneVerwendungMesswerte } from '@/server/betrieb-bilder'
import { getOeffentlicheHoefe } from '@/server/queries/farm'

/*
 * Admin › Betrieb im Hintergrund (Register N18, Nr. 103): messen, Herzschlag,
 * warnen. Die Regeln stehen rein in src/lib/betrieb.ts; hier nur Quellen,
 * Schreiben und die bedingten Anweisungen.
 *
 * Messen: Datenbank per `pg_database_size`, Bilder über `list()` von
 * @vercel/blob (seitenweise, nur lesen; EIN Speicher für Vorschau und
 * Produktion), E-Mails aus dem Zähler (src/server/betrieb-zaehler.ts). Eine
 * Quelle, die scheitert, hält die anderen nicht auf.
 *
 * Warnen: ERST die Stufe bedingt setzen (die Bedingung steht in derselben
 * Anweisung), NUR wenn sie eine Zeile traf, die Mail — zwei gleichzeitige
 * Prüfungen ergeben so nie zwei Mails für dieselbe Stufe. Außerhalb der
 * Produktion weder Warnung noch Überfällig-Prüfung (`produktion`).
 *
 * E-Mail und @vercel/blob kommen per `await import()`: Die Action „Jetzt
 * messen“ bindet diese Datei ein, und keine Seite zieht Versand statisch mit
 * (ARCHITECTURE §4, tests/schwere-module.test.ts).
 */

type Optionen = {
  produktion?: boolean
  /** Warn-Mails erst nach der Antwort (`nachDerAntwort`) — für „Jetzt messen“ und den Webhook: Niemand wartet auf den Versand. */
  nachher?: boolean
}

// ─── Fehler nach Sentry: fester Satz, nur die Klasse ─────────────────────────

function meldeFehler(satz: string, err: unknown, tags: Record<string, string>): void {
  const meldung = new Error(satz)
  meldung.name = fehlerKlasse(err)
  Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'betrieb', ...tags } })
}

// ─── Bild-Speicher ───────────────────────────────────────────────────────────

class BildSpeicherOhneZugang extends Error {
  constructor() {
    super('Bild-Speicher ohne Schlüssel')
    this.name = 'BildSpeicherOhneZugang'
  }
}

export type BildDatei = { pathname: string; url: string; size: number; uploadedAt: Date }

/**
 * Alle Dateien im Bild-Speicher, seitenweise zu je 1 000 (Cursor). Jede Seite
 * ist ein Vorgang bei Vercel — `auflistungen` sagt, wie viele. Nur lesen.
 * Nr. 104 nimmt dieselbe Auflistung für die Bilder ohne Verwendung.
 */
export async function listeBilder(): Promise<{ dateien: BildDatei[]; auflistungen: number }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new BildSpeicherOhneZugang()
  const { list } = await import('@vercel/blob')
  const dateien: BildDatei[] = []
  let auflistungen = 0
  let cursor: string | undefined
  do {
    const seite = await list({ limit: 1000, cursor, token })
    auflistungen += 1
    for (const b of seite.blobs) dateien.push({ pathname: b.pathname, url: b.url, size: b.size, uploadedAt: new Date(b.uploadedAt) })
    cursor = seite.hasMore ? seite.cursor : undefined
  } while (cursor)
  return { dateien, auflistungen }
}

// ─── Messen ──────────────────────────────────────────────────────────────────

export type MessErgebnis = { gemessen: BetriebArt[]; fehler: Array<'bilder' | 'datenbank' | 'hofliste'> }

/**
 * Die Hofliste, wie sie im Zwischenspeicher steht (Nr. 163, Register N19,
 * Ergänzung 24.10.2026): `getOeffentlicheHoefe` OHNE Cache — gemessen wird,
 * was `ladeOeffentlicheHoefe` speichern müsste, auch wenn Vercel den Eintrag
 * schon nicht mehr nimmt. Bytes des JSON in UTF-8 (Umlaute zählen doppelt) und
 * die Zahl der Höfe. Nur lesen.
 */
export async function messeHofliste(): Promise<{ bytes: number; hoefe: number }> {
  const liste = await getOeffentlicheHoefe()
  return { bytes: Buffer.byteLength(JSON.stringify(liste)), hoefe: liste.length }
}

/** Schreibt die Werte eines UTC-Tags in EINER Anweisung (upsert auf tag+art: ein zweiter Lauf am selben Tag überschreibt). */
async function schreibeMessungen(tag: string, werte: ReadonlyArray<readonly [BetriebArt, number]>, jetzt: Date): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "BetriebMessung" ("tag", "art", "wert", "gemessenAm")
    VALUES ${Prisma.join(werte.map(([art, wert]) => Prisma.sql`(${tag}::date, ${art}, ${BigInt(Math.round(wert))}, ${jetzt})`))}
    ON CONFLICT ("tag", "art")
    DO UPDATE SET "wert" = EXCLUDED."wert", "gemessenAm" = EXCLUDED."gemessenAm"`
}

/** Zählt die eigenen Auflistungen des Tages hoch (sie sind Bild-Vorgänge bei Vercel) — auch die der „Liste als CSV“ (Nr. 104). */
export async function zaehleAuflistungen(tag: string, anzahl: number, jetzt: Date): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "BetriebMessung" ("tag", "art", "wert", "gemessenAm")
    VALUES (${tag}::date, 'bilderAuflistungen', ${anzahl}, ${jetzt})
    ON CONFLICT ("tag", "art")
    DO UPDATE SET "wert" = "BetriebMessung"."wert" + EXCLUDED."wert", "gemessenAm" = EXCLUDED."gemessenAm"`
}

/**
 * Belegt den Beginn einer Messung für „Jetzt messen“ (Nr. 113) — in EINER
 * Anweisung statt Lesen-dann-Schreiben: Der Merker des Tages wird nur
 * angelegt bzw. überschrieben, wenn in den letzten 10 Minuten weder eine
 * Messung (MESS_ARTEN) noch ein anderer Beginn stattfand. Zwei gleichzeitige
 * Klicks: Der zweite trifft auf die Zeile des ersten, die Bedingung im
 * DO UPDATE gilt für deren neuen Stand — er bekommt keine Zeile zurück.
 * Die Casts stehen da, weil der Treiber Zeitpunkte als Text ohne Zone schickt
 * (UTC, wie Prisma speichert) und ein SELECT sonst Text einfügen wollte.
 */
export async function beginneMessung(jetzt: Date): Promise<boolean> {
  const ab = neuMessenAb(jetzt)
  const getroffen = await prisma.$queryRaw<Array<{ art: string }>>`
    INSERT INTO "BetriebMessung" ("tag", "art", "wert", "gemessenAm")
    SELECT ${utcTag(jetzt)}::date, ${MESS_BEGINN_ART}::text, 0::bigint, ${jetzt}::timestamp(3)
    WHERE NOT EXISTS (
      SELECT 1 FROM "BetriebMessung"
      WHERE "art" IN (${Prisma.join([...MESS_ARTEN, MESS_BEGINN_ART])}) AND "gemessenAm" > ${ab}::timestamp(3)
    )
    ON CONFLICT ("tag", "art") DO UPDATE SET "gemessenAm" = EXCLUDED."gemessenAm"
    WHERE "BetriebMessung"."gemessenAm" <= ${ab}::timestamp(3)
    RETURNING "art"`
  return getroffen.length > 0
}

/**
 * Misst Datenbank, Bild-Speicher und (seit Nr. 163) die Hofliste und schreibt je Wert eine Zeile
 * BetriebMessung für den UTC-Tag. Wirft nicht wegen einer Quelle: Deren
 * Fehlerklasse geht nach Sentry (ohne Inhalt), die anderen laufen weiter.
 * Nur in der Produktion zählt sie aus DERSELBEN Auflistung die Bilder ohne
 * Verwendung (Nr. 104) — die Vorschau teilt den Speicher, kennt aber die
 * Höfe der Produktion nicht.
 */
export async function messeBetrieb(jetzt: Date = new Date(), { produktion = UMGEBUNG.vercelProduktion }: Optionen = {}): Promise<MessErgebnis> {
  const tag = utcTag(jetzt)
  const werte: Array<readonly [BetriebArt, number]> = []
  const fehler: MessErgebnis['fehler'] = []

  try {
    // Nur lesen, ohne Parameter.
    const [db] = await prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_database_size(current_database())::bigint AS bytes`
    werte.push(['datenbankBytes', Number(db.bytes)])
  } catch (err) {
    fehler.push('datenbank')
    meldeFehler('Betrieb: Datenbank nicht gemessen', err, { quelle: 'datenbank' })
  }

  try {
    const { dateien, auflistungen } = await listeBilder()
    const monatsbeginn = utcMonatsbeginn(jetzt).getTime()
    const uploads = dateien.filter((d) => d.uploadedAt.getTime() >= monatsbeginn).length
    await zaehleAuflistungen(tag, auflistungen, jetzt)
    const auflistungenImMonat = await summeImMonat('bilderAuflistungen', jetzt)
    werte.push(
      ['bilderBytes', dateien.reduce((s, d) => s + d.size, 0)],
      ['bilderDateien', dateien.length],
      ['bilderUploadsMonat', uploads],
      ['bildVorgaengeMonat', bildVorgaengeSchaetzung(uploads, auflistungenImMonat)]
    )
    if (produktion) {
      // Eigenes try: Scheitert eine Abfrage der Adressen, bleiben die Werte des Speichers gültig.
      try {
        werte.push(...(await ohneVerwendungMesswerte(dateien, jetzt)))
      } catch (err) {
        meldeFehler('Betrieb: Bilder ohne Verwendung nicht gezählt', err, { quelle: 'ohneVerwendung' })
      }
    }
  } catch (err) {
    fehler.push('bilder')
    meldeFehler('Betrieb: Bild-Speicher nicht gemessen', err, { quelle: 'bilder' })
  }

  try {
    const { bytes, hoefe } = await messeHofliste()
    werte.push(['hoflisteBytes', bytes], ['hoflisteHoefe', hoefe])
  } catch (err) {
    fehler.push('hofliste')
    meldeFehler('Betrieb: Hofliste nicht gemessen', err, { quelle: 'hofliste' })
  }

  if (werte.length > 0) await schreibeMessungen(tag, werte, jetzt)
  return { gemessen: werte.map(([art]) => art), fehler }
}

// ─── Warnen ──────────────────────────────────────────────────────────────────

/** Wo der Monat einer Warnart beginnt — nur E-Mails im Monat zählen im Abrechnungszeitraum von Resend (Nr. 162). */
function monatsBeginnVon(art: WarnArt, jetzt: Date): Date {
  return monatsBeginn(art === 'mailsMonat' ? 'mailsMonat' : 'bildVorgaenge', jetzt)
}

/** Die Regel einer Warnart: Grenzwert, Ablauf oder Vercel-Ausgaben (je Abrechnungszeitraum, Nr. 113). */
type WarnRegel = GrenzRegel | 'ablauf' | 'abrechnung'

/**
 * Die Bedingung, unter der eine Warnung (neu) gesetzt wird — als SQL in
 * derselben Anweisung wie das Setzen. Der Monat beginnt je Art: E-Mails im
 * Abrechnungszeitraum von Resend, Bild-Vorgänge im Kalendermonat (Nr. 162).
 */
function warnBedingung(regel: WarnRegel, jetzt: Date, art: WarnArt): Prisma.Sql {
  if (regel === 'abrechnung') return Prisma.sql`("BetriebWarnung"."stufe" < EXCLUDED."stufe" OR "BetriebWarnung"."gemeldetAm" < ${abrechnungsBeginn(jetzt)})`
  if (regel === 'speicher') return Prisma.sql`"BetriebWarnung"."stufe" < EXCLUDED."stufe"`
  if (regel === 'monat') return Prisma.sql`("BetriebWarnung"."stufe" < EXCLUDED."stufe" OR "BetriebWarnung"."gemeldetAm" < ${monatsBeginnVon(art, jetzt)})`
  if (regel === 'tag') return Prisma.sql`"BetriebWarnung"."gemeldetAm" < ${utcTagesbeginn(jetzt)}`
  return Prisma.sql`("BetriebWarnung"."stufe" = 0 OR "BetriebWarnung"."gemeldetAm" < ${utcTagesbeginn(jetzt)})`
}

/**
 * Setzt die Stufe bedingt: neu anlegen oder — nur wenn die Bedingung der
 * Regel gilt — überschreiben. true = diese Prüfung hat gesetzt und schickt
 * die Mail; eine gleichzeitige zweite findet die Zeile schon gesetzt.
 */
async function setzeStufe(art: WarnArt, neu: Exclude<Stufe, 0>, regel: WarnRegel, jetzt: Date): Promise<boolean> {
  const getroffen = await prisma.$queryRaw<Array<{ art: string }>>`
    INSERT INTO "BetriebWarnung" ("art", "stufe", "seit", "gemeldetAm")
    VALUES (${art}, ${neu}, ${jetzt}, ${jetzt})
    ON CONFLICT ("art") DO UPDATE SET
      "stufe" = EXCLUDED."stufe",
      "gemeldetAm" = EXCLUDED."gemeldetAm",
      "seit" = CASE WHEN "BetriebWarnung"."stufe" = 0 THEN EXCLUDED."seit" ELSE "BetriebWarnung"."seit" END
    WHERE ${warnBedingung(regel, jetzt, art)}
    RETURNING "art"`
  return getroffen.length > 0
}

/** Entwarnung bzw. stiller Neubeginn: Stufe auf 0, nur wenn eine offen war. Gelöscht wird nichts. */
async function setzeNull(art: WarnArt): Promise<boolean> {
  const getroffen = await prisma.$queryRaw<Array<{ art: string }>>`
    UPDATE "BetriebWarnung" SET "stufe" = 0 WHERE "art" = ${art} AND "stufe" > 0 RETURNING "art"`
  return getroffen.length > 0
}

/**
 * Stiller Neubeginn der Vercel-Ausgaben: Stufe auf 0 nur, wenn sie VOR dem
 * Beginn des laufenden Abrechnungszeitraums gemeldet wurde — geprüft in
 * derselben Anweisung. Setzt der Webhook zwischen dem Lesen der Warnungen und
 * diesem Schreiben eine frische Stufe, bleibt sie stehen (sonst fiele sie
 * still auf 0, und die Warnung verschwände von der Seite, obwohl Vercel sie
 * gerade gemeldet hat).
 */
async function setzeNullVorZeitraum(jetzt: Date): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "BetriebWarnung" SET "stufe" = 0
    WHERE "art" = ${VERCEL_WARN_ART} AND "stufe" > 0 AND "gemeldetAm" < ${abrechnungsBeginn(jetzt)}`
}

/** Die Warn-Mail an die Empfänger der Art „Betrieb“ (fest an, mindestens SUPPORT_EMAIL). Scheitert sie, bleibt die Stufe gesetzt. */
async function versendeWarnMail(anlass: BetriebMailAnlass): Promise<void> {
  try {
    const [{ sendBetriebWarnung }, an] = await Promise.all([import('@/lib/email'), ladeBetreiberEmpfaenger('betrieb')])
    await sendBetriebWarnung(anlass, an)
  } catch (err) {
    meldeFehler('Betrieb: Warn-Mail nicht verschickt', err, { grund: 'warn-mail', anlass: anlass.art })
  }
}

/** Sofort (Abläufe, Mess-Lauf) oder nach der Antwort (`nachher`: „Jetzt messen“, Webhook) — die Stufe ist vorher schon gesetzt. */
async function sendeWarnMail(anlass: BetriebMailAnlass, nachher = false): Promise<void> {
  if (nachher) {
    nachDerAntwort(() => versendeWarnMail(anlass))
    return
  }
  await versendeWarnMail(anlass)
}

/**
 * Der Stand eines Grenzwerts heute: Zahl und Anteil — null, wenn heute nicht
 * gemessen (dann wird nicht gewarnt). Ohne feste Grenze (Vercel Pro) ist der
 * Anteil null: keine Warnstufe, eine alte geht still auf 0.
 */
function grenzStand(wert: GrenzWert, messungen: readonly Messung[], mailsImMonat: number, jetzt: Date): { zahl: number; anteil: number | null } | null {
  const heute = utcTag(jetzt)
  const vonHeute = (art: BetriebArt): number | null => messungen.find((m) => m.art === art && m.tag === heute)?.wert ?? null
  const grenze = grenzeVon(wert)
  const mitAnteil = (zahl: number | null): { zahl: number; anteil: number | null } | null =>
    zahl === null ? null : { zahl, anteil: grenze === null ? null : anteil(zahl, grenze) }
  if (wert === 'bilder') return mitAnteil(vonHeute('bilderBytes'))
  if (wert === 'datenbank') return mitAnteil(vonHeute('datenbankBytes'))
  if (wert === 'bildVorgaenge') return mitAnteil(vonHeute('bildVorgaengeMonat'))
  if (wert === 'hofliste') return mitAnteil(vonHeute('hoflisteBytes'))
  if (wert === 'mailsMonat') return mitAnteil(mailsImMonat)
  const gestern = utcTagVersetzt(heute, -1)
  return mitAnteil(messungen.find((m) => m.art === 'mails' && m.tag === gestern)?.wert ?? 0)
}

function trendFuer(wert: GrenzWert, messungen: readonly Messung[], jetzt: Date): string | null {
  const art: BetriebArt | null = wert === 'bilder' ? 'bilderBytes' : wert === 'datenbank' ? 'datenbankBytes' : wert === 'hofliste' ? 'hoflisteBytes' : null
  const grenze = grenzeVon(wert)
  if (!art || grenze === null) return null
  const t = vollIn(
    messungen.filter((m) => m.art === art).map((m) => ({ tag: m.tag, wert: m.wert })),
    grenze,
    utcTag(jetzt)
  )
  return t ? `${zuwachsText(t.zuwachs, t.tage)} – ${vollInText(t.vollIn)}` : null
}

function warnStandVon(zeilen: ReadonlyArray<{ art: string; stufe: number; gemeldetAm: Date }>, art: WarnArt): WarnStand {
  const z = zeilen.find((w) => w.art === art)
  return z ? { stufe: z.stufe, gemeldetAm: z.gemeldetAm } : null
}

/**
 * Prüft die Grenzen gegen die Messung von heute (nur im Mess-Lauf und bei
 * „Jetzt messen“, nie in sendRaw). Gibt die Zahl der angestoßenen Mails zurück.
 * Beim Bilder-Speicher nennt die Mail die Bilder ohne Verwendung (Summe der
 * jüngsten Zählung, Nr. 113). Danach: Hat ein neuer Abrechnungszeitraum bei
 * Vercel begonnen, geht die Stufe der Vercel-Ausgaben still auf 0 — der
 * Webhook kommt erst wieder ab 50 %.
 */
export async function pruefeGrenzen(
  jetzt: Date = new Date(),
  { produktion = UMGEBUNG.vercelProduktion, nachher = false }: Optionen = {}
): Promise<number> {
  if (!produktion) return 0
  const [messungen, warnungen, mailsImMonat] = await Promise.all([ladeMessungenFuerPruefung(jetzt), ladeWarnungen(), summeImMonat('mails', jetzt)])
  let mails = 0
  for (const wert of GRENZ_WERTE) {
    const stand = grenzStand(wert, messungen, mailsImMonat, jetzt)
    if (stand === null) continue
    const regel = GRENZ_REGEL[wert]
    const schritt = grenzSchritt(regel, warnStandVon(warnungen, wert), stand.anteil, jetzt, monatsBeginnVon(wert, jetzt))
    // grenzSchritt warnt und entwarnt nur mit Anteil; ohne Grenze kommt höchstens „still“.
    const anteilHeute = stand.anteil ?? 0
    if (schritt.tun === 'warnen' && (await setzeStufe(wert, schritt.stufe, regel, jetzt))) {
      const ohneVerwendungBytes = wert === 'bilder' ? (ohneVerwendungKarte(messungen, jetzt)?.bytes ?? null) : null
      await sendeWarnMail(
        { art: 'grenze', wert, anteil: anteilHeute, stand: grenzStandText(wert, stand.zahl), trend: trendFuer(wert, messungen, jetzt), ohneVerwendungBytes },
        nachher
      )
      mails += 1
    } else if (schritt.tun === 'entwarnen' && (await setzeNull(wert))) {
      await sendeWarnMail({ art: 'entwarnung', wert, anteil: anteilHeute, stand: grenzStandText(wert, stand.zahl) }, nachher)
      mails += 1
    } else if (schritt.tun === 'still') {
      await setzeNull(wert)
    }
  }
  if (vercelSchritt(warnStandVon(warnungen, VERCEL_WARN_ART), 0, jetzt).tun === 'still') await setzeNullVorZeitraum(jetzt)
  return mails
}

/**
 * Belegt den Merker der Mail-Prüfung in EINER Anweisung (Muster
 * `beginneMessung`): true nur, wenn die letzte Prüfung mindestens 10 Minuten
 * zurückliegt (oder heute noch keine war). Zwei gleichzeitige Läufe prüfen so
 * nur einmal.
 */
export async function beginneMailPruefung(jetzt: Date): Promise<boolean> {
  const ab = new Date(jetzt.getTime() - MAIL_PRUEFUNG_ALLE_MS)
  const getroffen = await prisma.$queryRaw<Array<{ art: string }>>`
    INSERT INTO "BetriebMessung" ("tag", "art", "wert", "gemessenAm")
    VALUES (${utcTag(jetzt)}::date, ${MAIL_PRUEFUNG_ART}::text, 0::bigint, ${jetzt}::timestamp(3))
    ON CONFLICT ("tag", "art") DO UPDATE SET "gemessenAm" = EXCLUDED."gemessenAm"
    WHERE "BetriebMessung"."gemessenAm" <= ${ab}::timestamp(3)
    RETURNING "art"`
  return getroffen.length > 0
}

/**
 * Die Warnungen der Mail-Warteschlange (Register N18, Ergänzung 24.10.2026;
 * Nr. 161) — nach dem Ablauf „E-Mails“, höchstens alle 10 Minuten (eigene
 * Drossel), nur in der Produktion:
 *
 *  - eine wichtige Mail wartet über 5 Minuten, die Warteschlange hängt über
 *    15 Minuten, abgelehnt über 2 % bzw. Spam gemeldet über 0,05 % in 7 Tagen
 *    (ab 50 Mails) — je höchstens eine Mail am Tag, still auf 0, sobald es
 *    nicht mehr gilt (`mailWarnSchritt`);
 *  - das Kontingent des Abrechnungszeitraums 80/95/100 % — dieselbe Regel und
 *    dieselbe Zeile wie im Mess-Lauf (`mailsMonat`), die bedingte Anweisung
 *    verhindert eine zweite Mail.
 *
 * Erst die Stufe bedingt setzen, nur nach getroffener Zeile die Warn-Mail
 * (direkt, nicht über die Warteschlange — N18-Ergänzung). Gibt die Zahl der
 * Mails zurück.
 */
export async function pruefeMailWarnungen(jetzt: Date = new Date(), { produktion = UMGEBUNG.vercelProduktion }: Optionen = {}): Promise<number> {
  if (!produktion) return 0
  if (!(await beginneMailPruefung(jetzt))) return 0
  const [warnungen, zaehler, quoten] = await Promise.all([ladeWarnungen(), ladeMailZaehler(jetzt), ladeQuoten(jetzt)])
  const mailsImMonat = zaehler.imZeitraum
  const schlange = await ladeWarteschlange(jetzt, zaehler)
  const lage = mailWarnLage(schlange, quoten, jetzt)
  let mails = 0
  for (const art of MAIL_WARN_ARTEN) {
    const schritt = mailWarnSchritt(lage[art].gilt, warnStandVon(warnungen, art), jetzt)
    if (schritt.tun === 'warnen' && (await setzeStufe(art, 1, 'ablauf', jetzt))) {
      await sendeWarnMail({ art: 'mails', warnung: art, wert: lage[art].wert })
      mails += 1
    } else if (schritt.tun === 'still') {
      await setzeNull(art)
    }
  }
  const anteilMonat = anteil(mailsImMonat, GRENZE.mailsMonat)
  const schritt = grenzSchritt('monat', warnStandVon(warnungen, 'mailsMonat'), anteilMonat, jetzt, monatsBeginnVon('mailsMonat', jetzt))
  if (schritt.tun === 'warnen' && (await setzeStufe('mailsMonat', schritt.stufe, 'monat', jetzt))) {
    await sendeWarnMail({ art: 'grenze', wert: 'mailsMonat', anteil: anteilMonat, stand: grenzStandText('mailsMonat', mailsImMonat), trend: null, ohneVerwendungBytes: null })
    mails += 1
  }
  return mails
}

export type VercelAusgabenMeldung = { ausgabenCent: number; limitCent: number; schwelleProzent: number }

/**
 * Eine Meldung von Spend Management (Nr. 113, Webhook): Ausgaben und Limit
 * als BetriebMessung des UTC-Tags (ein zweiter Aufruf am selben Tag
 * überschreibt), dann — nur in der Produktion — die Stufe bedingt wie die
 * anderen Warnungen (50/75/100 % → 1/2/3, je Abrechnungszeitraum einmal) und
 * nur nach getroffener Zeile EINE Warn-Mail, nach der Antwort. Gibt die Zahl
 * der Mails zurück (0 oder 1).
 */
export async function verbucheVercelAusgaben(
  meldung: VercelAusgabenMeldung,
  jetzt: Date = new Date(),
  { produktion = UMGEBUNG.vercelProduktion }: Optionen = {}
): Promise<number> {
  await schreibeMessungen(
    utcTag(jetzt),
    [
      ['vercelAusgaben', meldung.ausgabenCent],
      ['vercelLimit', meldung.limitCent],
    ],
    jetzt
  )
  if (!produktion) return 0
  const warnungen = await ladeWarnungen()
  const schritt = vercelSchritt(warnStandVon(warnungen, VERCEL_WARN_ART), vercelStufe(meldung.schwelleProzent), jetzt)
  if (schritt.tun === 'warnen' && (await setzeStufe(VERCEL_WARN_ART, schritt.stufe, 'abrechnung', jetzt))) {
    await sendeWarnMail({ art: 'vercelAusgaben', stufe: schritt.stufe, ausgabenCent: meldung.ausgabenCent, limitCent: meldung.limitCent }, true)
    return 1
  }
  if (schritt.tun === 'still') await setzeNullVorZeitraum(jetzt)
  return 0
}

/**
 * Prüft alle Abläufe (nach jedem Ablauf, über mitHerzschlag): überfällig oder
 * gescheitert → Warnung, höchstens eine Mail je Ablauf und Tag; der nächste
 * gute Lauf entwarnt; „noch kein Lauf“ warnt nie. So fällt auch ein
 * ausgefallener Mess-Lauf auf.
 */
export async function pruefeAblaeufe(jetzt: Date = new Date(), { produktion = UMGEBUNG.vercelProduktion }: Optionen = {}): Promise<number> {
  if (!produktion) return 0
  const [laeufe, warnungen] = await Promise.all([ladeLaeufe(), ladeWarnungen()])
  let mails = 0
  for (const ablauf of ABLAEUFE) {
    const lauf = laeufe.get(ablauf.name) ?? null
    const stand = ablaufStand(ablauf, lauf, jetzt)
    const art = ablaufWarnArt(ablauf.name)
    const schritt = ablaufSchritt(stand, warnStandVon(warnungen, art), jetzt)
    if (schritt.tun === 'warnen' && (stand === 'ueberfaellig' || stand === 'fehler') && (await setzeStufe(art, 1, 'ablauf', jetzt))) {
      await sendeWarnMail({
        art: 'ablauf',
        name: ablauf.name,
        stand,
        zuletzt: lauf ? zuletztText(lauf.gestartetAm, jetzt) : null,
        stundenSeit: lauf ? Math.floor((jetzt.getTime() - lauf.gestartetAm.getTime()) / 3_600_000) : null,
        wann: wannText(ablauf, jetzt),
      })
      mails += 1
    } else if (schritt.tun === 'entwarnen' && (await setzeNull(art))) {
      await sendeWarnMail({ art: 'ablaufWieder', name: ablauf.name })
      mails += 1
    }
  }
  return mails
}

// ─── Herzschlag ──────────────────────────────────────────────────────────────

/**
 * Schreibt den Herzschlag eines Ablaufs (AblaufLauf) vor und nach dem Lauf —
 * ok, Dauer, bei einem Fehler nur die Fehlerklasse — und gibt das Ergebnis
 * des Laufs unverändert zurück bzw. wirft dessen Fehler weiter. Danach prüft
 * er die anderen Abläufe (`danach`, Standard pruefeAblaeufe), auch wenn der
 * Lauf scheiterte. Fail-open: Ein Fehler beim Schreiben des Herzschlags oder
 * in der Prüfung danach hält den Lauf nicht auf und ändert sein Ergebnis nicht.
 */
export async function mitHerzschlag<T>(
  name: AblaufName,
  lauf: () => Promise<T>,
  danach: (jetzt: Date) => Promise<unknown> = pruefeAblaeufe
): Promise<T> {
  const start = new Date()
  try {
    await prisma.ablaufLauf.upsert({
      where: { name },
      create: { name, gestartetAm: start, ok: false },
      update: { gestartetAm: start, beendetAm: null, ok: false, fehlerKlasse: null, dauerMs: null },
    })
  } catch (err) {
    meldeFehler('Betrieb: Herzschlag nicht geschrieben', err, { ablauf: name, schritt: 'start' })
  }

  const ende = async (ok: boolean, klasse: string | null): Promise<void> => {
    const beendetAm = new Date()
    try {
      // Nur die eigene Zeile: Hat inzwischen ein neuer Lauf begonnen, bleibt dessen Start stehen.
      await prisma.ablaufLauf.updateMany({
        where: { name, gestartetAm: start },
        data: { beendetAm, ok, fehlerKlasse: klasse, dauerMs: beendetAm.getTime() - start.getTime() },
      })
    } catch (err) {
      meldeFehler('Betrieb: Herzschlag nicht geschrieben', err, { ablauf: name, schritt: 'ende' })
    }
    try {
      await danach(new Date())
    } catch (err) {
      meldeFehler('Betrieb: Abläufe nicht geprüft', err, { ablauf: name, schritt: 'pruefen' })
    }
  }

  let ergebnis: T
  try {
    ergebnis = await lauf()
  } catch (err) {
    await ende(false, fehlerKlasse(err))
    throw err
  }
  await ende(true, null)
  return ergebnis
}

// ─── Herzschlag von außen (Register N18, Ergänzung 26.10.2026; Nr. 184) ─────

/** Höchstens ein Herzschlag „von außen“ je Minute — auch wenn der Uptime-Dienst öfter oder von mehreren Orten ruft. */
export const VON_AUSSEN_ABSTAND_MS = 60 * 1000

/**
 * Der Herzschlag des Uptime-Dienstes (Ablauf `von-aussen` in ABLAEUFE): Jeder
 * Aufruf von /api/gesund schreibt die Zeile in AblaufLauf — in EINER
 * Anweisung (Muster `beginneMailPruefung`) und nur, wenn der letzte
 * Herzschlag mindestens eine Minute zurückliegt. Zwei gleichzeitige Aufrufe
 * schreiben so nur einmal. Ein Herzschlag ist immer „ok“: Er sagt nur, dass
 * der Dienst gerufen hat; ob die Seite gesund war, sagt ihm die Antwort.
 *
 * Die Warnung kommt aus der bestehenden Prüfung `pruefeAblaeufe` (nach jedem
 * Lauf der Mail-Warteschlange, also jede Minute): überfällig nach 30 Minuten
 * → BetriebWarnung `ablauf:von-aussen` und eine Warn-Mail am Tag; ohne Zeile
 * (nie gerufen) keine Warnung. true = diese Anfrage hat geschrieben.
 */
export async function schlageVonAussen(jetzt: Date = new Date()): Promise<boolean> {
  const ab = new Date(jetzt.getTime() - VON_AUSSEN_ABSTAND_MS)
  const name: AblaufName = 'von-aussen'
  const getroffen = await prisma.$queryRaw<Array<{ name: string }>>`
    INSERT INTO "AblaufLauf" ("name", "gestartetAm", "beendetAm", "ok", "fehlerKlasse", "dauerMs")
    VALUES (${name}, ${jetzt}::timestamp(3), ${jetzt}::timestamp(3), true, NULL, 0)
    ON CONFLICT ("name") DO UPDATE SET
      "gestartetAm" = EXCLUDED."gestartetAm", "beendetAm" = EXCLUDED."beendetAm", "ok" = true, "fehlerKlasse" = NULL, "dauerMs" = 0
    WHERE "AblaufLauf"."gestartetAm" <= ${ab}::timestamp(3)
    RETURNING "name"`
  return getroffen.length > 0
}

/** „Jetzt messen“ und der Mess-Lauf: messen, dann die Grenzen prüfen. `nachher`: die Warn-Mails nach der Antwort („Jetzt messen“). */
export async function messeUndPruefe(jetzt: Date = new Date(), { nachher = false }: Pick<Optionen, 'nachher'> = {}): Promise<MessErgebnis> {
  const ergebnis = await messeBetrieb(jetzt)
  await pruefeGrenzen(jetzt, { nachher })
  return ergebnis
}
