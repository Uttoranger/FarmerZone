import * as Sentry from '@sentry/nextjs'
import { createHash, randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { GRENZE, fehlerKlasse, utcTagesbeginn } from '@/lib/betrieb'
import { empfaengerFingerabdruck } from '@/lib/mail-empfaenger'
import { summeImMonat } from '@/server/queries/betrieb'
import { RENDERER, type RendererTabelle } from '@/server/mail-arten'
import { bezugSchemaFuer, mailArtSchema, VORRANG, type MailArt, type MailStatus } from '@/schemas/mail-auftrag'
import type { StapelMail } from '@/lib/email'

/*
 * Die Mail-Warteschlange (Register N26, Nr. 158).
 *
 *  - stelleMailEin: Aufträge anlegen (ein Aufruf auch für 5.000), doppelte
 *    fachliche Schlüssel fallen still weg; danach arbeitet der Worker nach
 *    der Antwort. Liegt eine fachliche Änderung vor, gehört das Einstellen in
 *    dieselbe Transaktion (Parameter `db`) — dann fehlt nie eine Mail zu einer
 *    gespeicherten Bestellung.
 *  - arbeiteWarteschlange: der Worker — nur einer zur Zeit (Advisory-Lock),
 *    Seiten zu 100, Wichtig vor Kann warten, Versand als Stapel über
 *    `versendeStapel` (src/lib/email.ts), zwischen zwei Anfragen an Resend
 *    mindestens 200 ms.
 *  - protokolliereSofortMail: die Zeile jeder direkten Mail aus `sendRaw`.
 *
 * In der Tabelle steht nie eine Adresse, ein Name, ein Inhalt oder ein Token:
 * Adresse und Inhalt lädt der Renderer je Art frisch (src/server/mail-arten/),
 * die Adresse lebt nur im Speicher dieses Laufs.
 *
 * email.ts kommt nur per `await import()`: Diese Datei laden Actions, und
 * kein Seitenmodul zieht den Versand statisch mit (ARCHITECTURE §4).
 */

/** Aufträge je Seite — zugleich die Obergrenze von `batch.send`. */
export const SEITE = 100
/** Mindestabstand zweier Anfragen an Resend: höchstens 5 von 10 je Sekunde, der Rest bleibt für die Sofort-Mails. */
export const ABSTAND_MS = 200
/** So lange gehört ein geholter Auftrag dem Worker; danach gilt er wieder als offen. */
export const BELEGT_MS = 2 * 60_000
/**
 * So viel Belegung muss vor einer Anfrage an Resend noch übrig sein (Anfrage
 * plus Schreiben der Ergebnisse). Sonst geht die Anfrage nicht mehr hinaus:
 * Ein zweiter Worker könnte die Aufträge sonst schon neu geholt haben.
 */
export const BELEGUNG_REST_MS = 30_000
/** Wartezeit vor der n-ten Wiederholung nach 429/5xx; danach gescheitert. */
export const WIEDERHOLUNG_MINUTEN = [1, 5, 15, 60, 240] as const
/** „Kann warten“ pausiert ab 70 % der Tagesgrenze bzw. 90 % der Grenze des Abrechnungszeitraums (N26). */
export const KANN_WARTEN_PAUSE = { tagProzent: 70, zeitraumProzent: 90 } as const
/** Feste Zahl des Advisory-Locks — nur ein Worker zur Zeit. */
const WORKER_SPERRE = 158_026
/** Puffer vor `biszeitMs`: In dieser Zeit holt der Worker keine neue Seite mehr. */
const PUFFER_MS = 5_000

type Grenzen = { mailsTag: number | null; mailsMonat: number | null }
type Db = { mailAuftrag: Pick<typeof prisma.mailAuftrag, 'createMany'> }

export type EinstellAuftrag = {
  art: MailArt
  vorrang: typeof VORRANG.wichtig | typeof VORRANG.kannWarten
  /** Fachlicher Schlüssel gegen Doppelversand, z. B. `beitrag:<postId>:<aboId>`. */
  schluessel: string
  /** Nur Kennungen (src/schemas/mail-auftrag.ts). */
  bezug: Record<string, string>
  bestellungId?: string
  farmId?: string
}

/**
 * Stellt einen oder viele Aufträge ein — EIN `createMany` mit
 * `skipDuplicates` über `schluessel`, auch für 5.000 Abos. Gibt die Zahl der
 * neu angelegten zurück. Der Bezug wird je Art geprüft; ein falscher wirft
 * (Programmierfehler, nie Nutzereingabe).
 */
export async function stelleMailEin(auftraege: EinstellAuftrag | readonly EinstellAuftrag[], db: Db = prisma): Promise<number> {
  const liste: readonly EinstellAuftrag[] = 'art' in auftraege ? [auftraege] : auftraege
  if (liste.length === 0) return 0
  const { count } = await db.mailAuftrag.createMany({
    data: liste.map((a) => ({
      art: a.art,
      vorrang: a.vorrang,
      schluessel: a.schluessel,
      bezug: bezugSchemaFuer(a.art).parse(a.bezug),
      bestellungId: a.bestellungId ?? null,
      farmId: a.farmId ?? null,
    })),
    skipDuplicates: true,
  })
  // Mit `db = tx` läuft der Worker unter Umständen vor dem Commit und sieht
  // diese Aufträge noch nicht — dann nimmt sie der nächste Lauf (Cron jede
  // Minute) mit. Verloren geht keiner, er kommt nur bis zu einer Minute später.
  nachDerAntwort(async () => {
    try {
      await arbeiteWarteschlange({ biszeitMs: 45_000 })
    } catch (err) {
      meldeFehler('Mail-Warteschlange: Worker nach dem Einstellen gescheitert', err)
    }
  })
  return count
}

/** Die Zeile einer direkten Mail (vorrang 0) — aus `sendRaw`, fail-open beim Aufrufer. */
export async function protokolliereSofortMail(zeile: {
  art: MailArt
  bestellungId?: string
  empfaengerHash: string
  status: Extract<MailStatus, 'gesendet' | 'gescheitert' | 'gesperrt' | 'ohne_schluessel'>
  resendId?: string
  fehlerCode?: string
}): Promise<void> {
  const jetzt = new Date()
  await prisma.mailAuftrag.create({
    data: {
      art: zeile.art,
      vorrang: VORRANG.sofort,
      // Sofort-Mails haben keinen fachlichen Schlüssel — jede Zeile ist ein Versuch.
      schluessel: `sofort:${randomUUID()}`,
      bestellungId: zeile.bestellungId ?? null,
      status: zeile.status,
      resendId: zeile.resendId ?? null,
      fehlerCode: zeile.fehlerCode ?? null,
      empfaengerHash: zeile.empfaengerHash,
      gesendetAm: zeile.status === 'gesendet' ? jetzt : null,
      naechsterVersuchAm: jetzt,
    },
  })
}

// ─── Regeln ──────────────────────────────────────────────────────────────────

/** Ob „Kann warten“ liegen bleibt: Tagesgrenze zu 70 % (nur mit Tagesgrenze) oder Zeitraum zu 90 % verbraucht. */
export function kannWartenPausiert(stand: { heute: number; imZeitraum: number }, grenze: Grenzen): boolean {
  if (grenze.mailsTag !== null && stand.heute * 100 >= KANN_WARTEN_PAUSE.tagProzent * grenze.mailsTag) return true
  return grenze.mailsMonat !== null && stand.imZeitraum * 100 >= KANN_WARTEN_PAUSE.zeitraumProzent * grenze.mailsMonat
}

/** Nach einem Fehler, der sich wiederholen lässt: nächster Versuch nach 1, 5, 15, 60, 240 Minuten, danach gescheitert. */
export function naechsterVersuch(versucheBisher: number, jetzt: Date): { versuche: number; am: Date | null } {
  const versuche = versucheBisher + 1
  const minuten = WIEDERHOLUNG_MINUTEN[versuche - 1]
  return { versuche, am: minuten === undefined ? null : new Date(jetzt.getTime() + minuten * 60_000) }
}

/** 429, 5xx und kein Status (Netz, Ausnahme) lassen sich wiederholen; jeder andere 4xx nicht. */
export function laesstSichWiederholen(statusCode: number | null): boolean {
  return statusCode === null || statusCode === 429 || statusCode >= 500
}

// ─── Worker ──────────────────────────────────────────────────────────────────

export type WorkerOptionen = {
  /** Bis dahin endet der Lauf (Cron 50 s, nach dem Einstellen 45 s). */
  biszeitMs: number
  /** Nur für Tests: andere Renderer, Grenzen, Abstand. */
  renderer?: RendererTabelle
  grenze?: Grenzen
  abstandMs?: number
}

export type WorkerErgebnis = {
  /** false = ein anderer Worker hielt die Sperre. */
  gelaufen: boolean
  seiten: number
  gesendet: number
  wiederholen: number
  gescheitert: number
  verworfen: number
  gesperrt: number
  ohneSchluessel: number
}

type Geholt = {
  id: string
  art: string
  vorrang: number
  bezug: unknown
  versuche: number
  /** Die eigene Belegung — genau dieser Wert steht in der Zeile, solange sie uns gehört. */
  belegtBis: Date
  /** Belegung eines abgebrochenen Laufs (Zeile war „in Arbeit“, Belegung abgelaufen), sonst null. */
  vorherBelegtBis: Date | null
}

/** Ob die eigene Belegung für eine weitere Anfrage an Resend samt Schreiben noch reicht. */
export function belegungReicht(belegtBis: Date, jetztMs: number): boolean {
  return belegtBis.getTime() - jetztMs >= BELEGUNG_REST_MS
}

type Versand = { auftrag: Geholt; mail: StapelMail; hash: string }

/** Was nach einem Auftrag in die Zeile kommt — eine Anweisung je Seite schreibt alle. */
type Ausgang = {
  id: string
  status: Exclude<MailStatus, 'in_arbeit'>
  versuche: number
  naechsterVersuchAm: Date | null
  fehlerCode: string | null
  empfaengerHash: string | null
  resendId: string | null
}

/**
 * Der Worker. Nur einer zur Zeit: `pg_try_advisory_xact_lock` in einer
 * Transaktion, die den Lauf über offen bleibt — eine Sitzungssperre ginge
 * über den Pooler (Transaktionsmodus) nicht sicher auf dieselbe Verbindung
 * zurück. Hält ein anderer die Sperre, endet der Aufruf sofort. Dass jede
 * Mail genau einmal geht, hängt nicht an der Sperre, sondern am Holen mit
 * `FOR UPDATE SKIP LOCKED`.
 */
export async function arbeiteWarteschlange(optionen: WorkerOptionen): Promise<WorkerErgebnis> {
  const start = Date.now()
  let ergebnis = leeresErgebnis(false)
  let fehler: unknown = null
  try {
    await prisma.$transaction(
      async (tx) => {
        const [sperre] = await tx.$queryRaw<{ frei: boolean }[]>`SELECT pg_try_advisory_xact_lock(${WORKER_SPERRE}::bigint) AS frei`
        if (!sperre?.frei) return
        try {
          ergebnis = await arbeite(optionen, start)
        } catch (err) {
          fehler = err
        }
      },
      { timeout: optionen.biszeitMs + 30_000, maxWait: 10_000 }
    )
  } catch (err) {
    // Lief der Worker schon, scheiterte nur das Ende der Sperr-Transaktion
    // (Zeitlimit) — die Sperre ist dann ohnehin frei, die Arbeit geschrieben.
    if (!ergebnis.gelaufen) throw err
  }
  if (fehler) throw fehler
  return ergebnis
}

async function arbeite(optionen: WorkerOptionen, start: number): Promise<WorkerErgebnis> {
  const ergebnis = leeresErgebnis(true)
  const renderer = optionen.renderer ?? RENDERER
  const grenze = optionen.grenze ?? { mailsTag: GRENZE.mailsTag, mailsMonat: GRENZE.mailsMonat }
  const abstand = optionen.abstandMs ?? ABSTAND_MS
  const ende = start + optionen.biszeitMs - Math.min(PUFFER_MS, optionen.biszeitMs / 5)
  const email = await import('@/lib/email')

  let letzteAnfrage = 0
  const nachAbstand = async <T>(anfrage: () => Promise<T>): Promise<T> => {
    const warten = letzteAnfrage + abstand - Date.now()
    if (warten > 0) await new Promise((fertig) => setTimeout(fertig, warten))
    letzteAnfrage = Date.now()
    return anfrage()
  }

  while (Date.now() < ende) {
    const jetzt = new Date()
    const pausiert = grenze.mailsTag === null && grenze.mailsMonat === null ? false : kannWartenPausiert(await mailStand(jetzt), grenze)
    const seite = await holeFaelligeSeite(jetzt, !pausiert)
    if (seite.length === 0) break
    ergebnis.seiten += 1

    const ausgaenge: Ausgang[] = []
    const versand: Versand[] = []
    const schluesselDa = email.hatResendSchluessel()
    for (const auftrag of seite) {
      const fertig = (status: Ausgang['status'], fehlerCode: string | null, hash: string | null = null): void => {
        ausgaenge.push({ id: auftrag.id, status, versuche: auftrag.versuche, naechsterVersuchAm: null, fehlerCode, empfaengerHash: hash, resendId: null })
      }
      const art = mailArtSchema.safeParse(auftrag.art)
      const rendere = art.success ? renderer[art.data] : undefined
      if (!art.success || !rendere) {
        fertig('verworfen', 'kein_renderer')
        continue
      }
      const bezug = bezugSchemaFuer(art.data).safeParse(auftrag.bezug)
      if (!bezug.success) {
        fertig('verworfen', 'bezug_ungueltig')
        continue
      }
      let mail: Awaited<ReturnType<typeof rendere>>
      try {
        mail = await rendere(bezug.data)
      } catch (err) {
        // Datenbank oder Vorlage hakt: später nochmal, wie bei einem 5xx.
        meldeFehler('Mail-Warteschlange: Renderer gescheitert', err, art.data)
        ausgaenge.push(wiederholung(auftrag, 'renderer_fehler', null, jetzt))
        continue
      }
      if ('verworfen' in mail) {
        fertig('verworfen', mail.verworfen)
        continue
      }
      const hash = empfaengerFingerabdruck(mail.an)
      if (!schluesselDa) fertig('ohne_schluessel', null, hash)
      else if (!email.postSperreLaesstDurch(mail.an)) fertig('gesperrt', null, hash)
      else versand.push({ auftrag, mail, hash })
    }

    // Eine Seite trägt EINE Belegung (alle Zeilen mit demselben belegtBis).
    const belegtBis = seite[0].belegtBis
    const freizugeben: Geholt[] = []
    const versende = async (gruppe: readonly Versand[]): Promise<void> => {
      if (!belegungReicht(belegtBis, Date.now())) {
        freizugeben.push(...gruppe.map((v) => v.auftrag))
        return
      }
      const antwort = await nachAbstand(() => email.versendeStapel(gruppe.map((v) => v.mail), stapelSchluessel(gruppe.map((v) => v.auftrag))))
      if (antwort.ok) {
        gruppe.forEach((v, i) => ausgaenge.push(gesendet(v.auftrag, antwort.ids[i] ?? null, v.hash)))
      } else if (laesstSichWiederholen(antwort.statusCode) || gruppe.length === 1) {
        for (const v of gruppe) {
          ausgaenge.push(
            laesstSichWiederholen(antwort.statusCode) ? wiederholung(v.auftrag, antwort.code, v.hash, jetzt) : gescheitert(v.auftrag, antwort.code, v.hash)
          )
        }
      } else {
        // Strikte Prüfung lehnt den ganzen Stapel ab, wenn eine Mail nicht
        // passt — dann einzeln, damit eine kaputte nicht 99 andere mitnimmt.
        for (const v of gruppe) {
          if (!belegungReicht(belegtBis, Date.now())) {
            freizugeben.push(v.auftrag)
            continue
          }
          const einzeln = await nachAbstand(() => email.versendeStapel([v.mail], `mail-${v.auftrag.id}-${v.auftrag.versuche}`))
          if (einzeln.ok) ausgaenge.push(gesendet(v.auftrag, einzeln.ids[0] ?? null, v.hash))
          else if (laesstSichWiederholen(einzeln.statusCode)) ausgaenge.push(wiederholung(v.auftrag, einzeln.code, v.hash, jetzt))
          else ausgaenge.push(gescheitert(v.auftrag, einzeln.code, v.hash))
        }
      }
    }
    for (const gruppe of nachBelegung(versand)) await versende(gruppe)

    const geschrieben = await schreibeAusgaenge(ausgaenge, new Date(), belegtBis)
    if (geschrieben < ausgaenge.length) meldeFehler('Mail-Warteschlange: Belegung verloren, Ergebnis nicht geschrieben', new Error('belegung_verloren'))
    await gibFrei(freizugeben, belegtBis)
    for (const a of ausgaenge) zaehle(ergebnis, a)
  }
  return ergebnis
}

/**
 * Holt bis zu 100 fällige Aufträge und belegt sie in EINER Anweisung —
 * `FOR UPDATE SKIP LOCKED`: Zwei Worker bekommen nie dieselbe Zeile.
 * Fällig = offen und an der Reihe, oder in Arbeit mit abgelaufener Belegung
 * (ein abgebrochener Lauf). Wichtig zuerst, dann nach dem nächsten Versuch.
 *
 * Die Belegung ist zugleich die Kennung dieses Laufs: Jedes Schreiben danach
 * verlangt genau diesen `belegtBis`. Ein später Lauf, dessen Zeilen ein
 * anderer inzwischen neu geholt hat, schreibt so nichts mehr. Eindeutig ist
 * der Wert, weil eine Zeile erst nach Ablauf neu geholt wird — der zweite
 * `belegtBis` liegt also immer später als der erste.
 */
export async function holeFaelligeSeite(jetzt: Date, auchKannWarten: boolean): Promise<Geholt[]> {
  const belegtBis = new Date(jetzt.getTime() + BELEGT_MS)
  const zeilen = await prisma.$queryRaw<Omit<Geholt, 'belegtBis'>[]>`
    WITH kandidaten AS (
      SELECT "id", CASE WHEN "status" = 'in_arbeit' THEN "belegtBis" END AS "vorherBelegtBis"
      FROM "MailAuftrag"
      WHERE ("vorrang" = ${VORRANG.wichtig} OR (${auchKannWarten} AND "vorrang" = ${VORRANG.kannWarten}))
        AND (("status" = 'offen' AND "naechsterVersuchAm" <= ${jetzt}) OR ("status" = 'in_arbeit' AND "belegtBis" < ${jetzt}))
      ORDER BY "vorrang", "naechsterVersuchAm"
      LIMIT ${SEITE}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "MailAuftrag" AS m SET "status" = 'in_arbeit', "belegtBis" = ${belegtBis}
    FROM kandidaten k
    WHERE m."id" = k."id"
    RETURNING m."id", m."art", m."vorrang", m."bezug", m."versuche", k."vorherBelegtBis"`
  return zeilen.map((z) => ({ ...z, belegtBis })).sort((a, b) => a.vorrang - b.vorrang)
}

/**
 * Teilt den Versand einer Seite nach der Belegung, aus der die Aufträge
 * kommen: frische Aufträge in einen Stapel, jeden abgebrochenen Lauf in einen
 * eigenen. Bricht ein Lauf nach dem Versand ab, kommt seine Seite so wieder
 * als eigene Anfrage mit demselben Idempotenz-Schlüssel (`stapelSchluessel`
 * über dieselben Kennungen und Versuche) — und nicht vermischt mit neuen
 * Aufträgen, deren Schlüssel Resend nie gesehen hätte.
 */
function nachBelegung(versand: readonly Versand[]): Versand[][] {
  const gruppen = new Map<string, Versand[]>()
  for (const v of versand) {
    const kennung = v.auftrag.vorherBelegtBis === null ? 'frisch' : String(v.auftrag.vorherBelegtBis.getTime())
    gruppen.set(kennung, [...(gruppen.get(kennung) ?? []), v])
  }
  return [...gruppen.values()]
}

/**
 * Gibt Aufträge frei, die dieser Lauf nicht mehr verschickt hat (Belegung zu
 * knapp) — nur solange die Belegung noch uns gehört. Frische werden wieder
 * offen; Aufträge eines abgebrochenen Laufs bekommen dessen alte, abgelaufene
 * Belegung zurück, damit der nächste Lauf sie wieder als solche erkennt.
 */
async function gibFrei(auftraege: readonly Geholt[], belegtBis: Date): Promise<void> {
  if (auftraege.length === 0) return
  await prisma.$executeRaw`
    UPDATE "MailAuftrag" AS m SET
      "status" = CASE WHEN v.vorher IS NULL THEN 'offen' ELSE 'in_arbeit' END,
      "belegtBis" = v.vorher::timestamp(3)
    FROM unnest(
      ${auftraege.map((a) => a.id)}::text[],
      ${auftraege.map((a) => a.vorherBelegtBis?.toISOString() ?? null)}::text[]
    ) AS v(id, vorher)
    WHERE m."id" = v.id AND m."status" = 'in_arbeit' AND m."belegtBis" = ${belegtBis}`
}

/**
 * Schreibt die Ausgänge einer Seite in EINER Anweisung (unnest) — 100
 * Einzel-Updates je Seite wären der Engpass. Nur Zeilen mit der eigenen
 * Belegung; gibt zurück, wie viele geschrieben wurden.
 */
async function schreibeAusgaenge(ausgaenge: readonly Ausgang[], jetzt: Date, belegtBis: Date): Promise<number> {
  if (ausgaenge.length === 0) return 0
  const spalte = <K extends keyof Ausgang>(k: K) => ausgaenge.map((a) => a[k])
  return prisma.$executeRaw`
    UPDATE "MailAuftrag" AS m SET
      "status" = v.status,
      "versuche" = v.versuche,
      "naechsterVersuchAm" = COALESCE(v.naechster::timestamp(3), m."naechsterVersuchAm"),
      "fehlerCode" = v.code,
      "empfaengerHash" = COALESCE(v.hash, m."empfaengerHash"),
      "resendId" = v.rid,
      "gesendetAm" = CASE WHEN v.status = 'gesendet' THEN ${jetzt} ELSE m."gesendetAm" END,
      "belegtBis" = NULL
    FROM unnest(
      ${spalte('id')}::text[], ${spalte('status')}::text[], ${spalte('versuche')}::int[],
      ${ausgaenge.map((a) => a.naechsterVersuchAm?.toISOString() ?? null)}::text[],
      ${spalte('fehlerCode')}::text[], ${spalte('empfaengerHash')}::text[], ${spalte('resendId')}::text[]
    ) AS v(id, status, versuche, naechster, code, hash, rid)
    WHERE m."id" = v.id AND m."status" = 'in_arbeit' AND m."belegtBis" = ${belegtBis}`
}

/** Mails des UTC-Tags und des Abrechnungszeitraums aus dem Zähler von Admin › Betrieb. */
async function mailStand(jetzt: Date): Promise<{ heute: number; imZeitraum: number }> {
  const [heute, imZeitraum] = await Promise.all([
    prisma.betriebMessung.findUnique({ where: { tag_art: { tag: utcTagesbeginn(jetzt), art: 'mails' } }, select: { wert: true } }),
    mailsImAbrechnungszeitraum(jetzt),
  ])
  return { heute: heute ? Number(heute.wert) : 0, imZeitraum }
}

/**
 * Abrechnungszeitraum aus 162: Bis Nr. 162 den Zeitraum von Resend (ab dem
 * 17., N18-Ergänzung) liefert, zählt hier der Kalendermonat wie bisher auf der
 * Seite; der Dirigent zieht die Stelle im Zwischenstand nach.
 */
async function mailsImAbrechnungszeitraum(jetzt: Date): Promise<number> {
  return summeImMonat('mails', jetzt)
}

function gesendet(a: Geholt, resendId: string | null, hash: string): Ausgang {
  return { id: a.id, status: 'gesendet', versuche: a.versuche, naechsterVersuchAm: null, fehlerCode: null, empfaengerHash: hash, resendId }
}

function gescheitert(a: Geholt, code: string, hash: string | null): Ausgang {
  return { id: a.id, status: 'gescheitert', versuche: a.versuche + 1, naechsterVersuchAm: null, fehlerCode: code, empfaengerHash: hash, resendId: null }
}

function wiederholung(a: Geholt, code: string, hash: string | null, jetzt: Date): Ausgang {
  const naechster = naechsterVersuch(a.versuche, jetzt)
  if (naechster.am === null) return { ...gescheitert(a, code, hash), versuche: naechster.versuche }
  return { id: a.id, status: 'offen', versuche: naechster.versuche, naechsterVersuchAm: naechster.am, fehlerCode: code, empfaengerHash: hash, resendId: null }
}

/**
 * Idempotenz-Schlüssel einer Stapel-Anfrage: aus Kennung und Versuch jeder
 * Mail, sortiert (die Reihenfolge aus RETURNING ist nicht fest). Bricht ein
 * Lauf nach dem Versand ab, schickt der nächste dieselben Aufträge als
 * eigene Anfrage (`nachBelegung`) — Resend verschickt sie nicht ein zweites
 * Mal (24 Stunden lang).
 *
 * Grenze: Der Schutz greift nur, wenn dieselben Mails wieder zusammen
 * hinausgehen. Teilt das Seitenlimit den abgebrochenen Lauf auf zwei Seiten
 * oder fällt beim neuen Rendern eine Mail weg (z. B. abgemeldet), ist der
 * Schlüssel ein anderer, und diese Mails können ein zweites Mal hinausgehen.
 * Ganz schließen ließe sich das nur mit einer gespeicherten Kennung der
 * Anfrage je Auftrag (Schema-Änderung).
 */
export function stapelSchluessel(auftraege: readonly Pick<Geholt, 'id' | 'versuche'>[]): string {
  const roh = auftraege
    .map((a) => `${a.id}:${a.versuche}`)
    .sort()
    .join(',')
  return `mail-stapel-${createHash('sha256').update(roh).digest('hex').slice(0, 40)}`
}

function leeresErgebnis(gelaufen: boolean): WorkerErgebnis {
  return { gelaufen, seiten: 0, gesendet: 0, wiederholen: 0, gescheitert: 0, verworfen: 0, gesperrt: 0, ohneSchluessel: 0 }
}

function zaehle(e: WorkerErgebnis, a: Ausgang): void {
  if (a.status === 'gesendet') e.gesendet += 1
  else if (a.status === 'offen') e.wiederholen += 1
  else if (a.status === 'gescheitert') e.gescheitert += 1
  else if (a.status === 'verworfen') e.verworfen += 1
  else if (a.status === 'gesperrt') e.gesperrt += 1
  else if (a.status === 'ohne_schluessel') e.ohneSchluessel += 1
}

/** Nach Sentry nur die Fehlerklasse unter festem Satz, dazu höchstens die Art — nie Adresse, Bezug oder Text. */
function meldeFehler(satz: string, err: unknown, art?: MailArt): void {
  try {
    const meldung = new Error(satz)
    meldung.name = fehlerKlasse(err)
    Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'mail-warteschlange', ...(art ? { art } : {}) } })
  } catch {
    // Telemetrie scheitert leise.
  }
}
