import * as Sentry from '@sentry/nextjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import {
  ABLAEUFE,
  GRENZ_REGEL,
  GRENZ_WERTE,
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
import { ladeBetreiberEmpfaenger } from '@/server/queries/postfach'
import { ohneVerwendungMesswerte } from '@/server/betrieb-bilder'

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

export type MessErgebnis = { gemessen: BetriebArt[]; fehler: Array<'bilder' | 'datenbank'> }

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
 * Misst Datenbank und Bild-Speicher und schreibt je Wert eine Zeile
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

  if (werte.length > 0) await schreibeMessungen(tag, werte, jetzt)
  return { gemessen: werte.map(([art]) => art), fehler }
}

// ─── Warnen ──────────────────────────────────────────────────────────────────

/** Die Regel einer Warnart: Grenzwert, Ablauf oder Vercel-Ausgaben (je Abrechnungszeitraum, Nr. 113). */
type WarnRegel = GrenzRegel | 'ablauf' | 'abrechnung'

/** Die Bedingung, unter der eine Warnung (neu) gesetzt wird — als SQL in derselben Anweisung wie das Setzen. */
function warnBedingung(regel: WarnRegel, jetzt: Date): Prisma.Sql {
  if (regel === 'abrechnung') return Prisma.sql`("BetriebWarnung"."stufe" < EXCLUDED."stufe" OR "BetriebWarnung"."gemeldetAm" < ${abrechnungsBeginn(jetzt)})`
  if (regel === 'speicher') return Prisma.sql`"BetriebWarnung"."stufe" < EXCLUDED."stufe"`
  if (regel === 'monat') return Prisma.sql`("BetriebWarnung"."stufe" < EXCLUDED."stufe" OR "BetriebWarnung"."gemeldetAm" < ${utcMonatsbeginn(jetzt)})`
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
    WHERE ${warnBedingung(regel, jetzt)}
    RETURNING "art"`
  return getroffen.length > 0
}

/** Entwarnung bzw. stiller Neubeginn: Stufe auf 0, nur wenn eine offen war. Gelöscht wird nichts. */
async function setzeNull(art: WarnArt): Promise<boolean> {
  const getroffen = await prisma.$queryRaw<Array<{ art: string }>>`
    UPDATE "BetriebWarnung" SET "stufe" = 0 WHERE "art" = ${art} AND "stufe" > 0 RETURNING "art"`
  return getroffen.length > 0
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
  if (wert === 'mailsMonat') return mitAnteil(mailsImMonat)
  const gestern = utcTagVersetzt(heute, -1)
  return mitAnteil(messungen.find((m) => m.art === 'mails' && m.tag === gestern)?.wert ?? 0)
}

function trendFuer(wert: GrenzWert, messungen: readonly Messung[], jetzt: Date): string | null {
  const art: BetriebArt | null = wert === 'bilder' ? 'bilderBytes' : wert === 'datenbank' ? 'datenbankBytes' : null
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
    const schritt = grenzSchritt(regel, warnStandVon(warnungen, wert), stand.anteil, jetzt)
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
  if (vercelSchritt(warnStandVon(warnungen, VERCEL_WARN_ART), 0, jetzt).tun === 'still') await setzeNull(VERCEL_WARN_ART)
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
  if (schritt.tun === 'still') await setzeNull(VERCEL_WARN_ART)
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

/** „Jetzt messen“ und der Mess-Lauf: messen, dann die Grenzen prüfen. `nachher`: die Warn-Mails nach der Antwort („Jetzt messen“). */
export async function messeUndPruefe(jetzt: Date = new Date(), { nachher = false }: Pick<Optionen, 'nachher'> = {}): Promise<MessErgebnis> {
  const ergebnis = await messeBetrieb(jetzt)
  await pruefeGrenzen(jetzt, { nachher })
  return ergebnis
}
