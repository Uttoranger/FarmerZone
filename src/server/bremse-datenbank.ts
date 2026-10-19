import * as Sentry from '@sentry/nextjs'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { getClientIp } from '@/lib/rate-limit'
import { genauesIlikeMuster } from '@/lib/ilike-muster'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import type { FehlversuchArt } from '@/lib/anmeldecode'
import {
  DB_BREMSEN,
  DB_BREMSE_ZEITLIMIT_MS,
  FEHLVERSUCH_BREMSEN,
  ZU_VIELE_ANFRAGEN,
  adressMerkmal,
  bremsMeldungFaellig,
  bremsSchluessel,
  fehlversuchSperreBis,
  fensterBeginn,
  fensterEnde,
  innerhalbDerGrenze,
  pauseBeginntBis,
  sekundenBisFensterEnde,
  type DbBremse,
} from '@/lib/bremse-datenbank'

/*
 * Die zweite Stufe der Bremse (Register R1, Nr. 40): zählt in der Tabelle
 * `RateLimitZaehler` über alle Instanzen. Regeln und Grenzen in
 * src/lib/bremse-datenbank.ts; die erste Stufe (Speicher je Instanz) fragt
 * jeder Aufrufer VORHER selbst.
 *
 * FAIL-OPEN: Ist die Datenbank nicht erreichbar oder zu langsam, lässt die
 * zweite Stufe durch und meldet es an Sentry — ohne Schlüssel, ohne IP, ohne
 * Adresse. Die erste Stufe wirkt weiter. Eine Bremse, die bei einem
 * Datenbank-Schluckauf Kundinnen aussperrt oder eine Bestellung verhindert,
 * richtet mehr Schaden an als ein paar ungezählte Versuche.
 *
 * Gemeldet wird höchstens einmal je Instanz und zehn Minuten (Nr. 47,
 * `BREMSE_MELDE_ABSTAND_MS`); die nächste Meldung nennt, wie viele Ausfälle
 * dazwischen still blieben.
 */

export type Versuch = { bremse: DbBremse; merkmal: string }

/**
 * Zählt je Versuch einen Treffer im laufenden Fenster und gibt die neuen
 * Stände in derselben Reihenfolge zurück. Ein einziges INSERT … ON CONFLICT
 * DO UPDATE … RETURNING: Postgres zählt atomar, auch wenn viele Instanzen
 * gleichzeitig zählen (ein Prisma-upsert läse erst und schriebe dann). Wirft
 * bei einem Datenbankfehler — das Durchlassen entscheidet der Aufrufer.
 */
export async function zaehleVersuche(versuche: readonly Versuch[], jetzt: Date = new Date()): Promise<number[]> {
  if (versuche.length === 0) return []
  const zeilen = versuche.map(({ bremse, merkmal }) => ({
    schluessel: bremsSchluessel(env.BETTER_AUTH_SECRET, bremse.zweck, merkmal),
    fensterStart: fensterBeginn(jetzt, bremse.fensterMs),
    ablauf: fensterEnde(jetzt, bremse.fensterMs),
  }))
  // Derselbe Schlüssel zweimal in einem INSERT … ON CONFLICT bricht ab
  // („cannot affect row a second time") — doppelte Versuche zählen einmal.
  const eindeutig = [...new Map(zeilen.map((z) => [`${z.schluessel}|${z.fensterStart.getTime()}`, z])).values()]

  const staende = await prisma.$queryRaw<Array<{ schluessel: string; zaehler: number }>>`
    INSERT INTO "RateLimitZaehler" ("schluessel", "fensterStart", "zaehler", "ablauf")
    VALUES ${Prisma.join(eindeutig.map((z) => Prisma.sql`(${z.schluessel}, ${z.fensterStart}, 1, ${z.ablauf})`))}
    ON CONFLICT ("schluessel", "fensterStart")
    DO UPDATE SET "zaehler" = "RateLimitZaehler"."zaehler" + 1
    RETURNING "schluessel", "zaehler"`

  const nachSchluessel = new Map(staende.map((s) => [s.schluessel, Number(s.zaehler)]))
  return zeilen.map((z) => nachSchluessel.get(z.schluessel) ?? 0)
}

class BremseZeitlimit extends Error {
  constructor() {
    super('Bremse über alle Instanzen: Zeitlimit')
    this.name = 'BremseZeitlimit'
  }
}

/** Ein Versprechen mit Verfallszeit; der Timer wird in jedem Ausgang aufgeräumt. */
function mitFrist<T>(arbeit: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const ablauf = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BremseZeitlimit()), ms)
  })
  return Promise.race([arbeit, ablauf]).finally(() => clearTimeout(timer))
}

/**
 * Wann diese Instanz zuletzt gemeldet hat und wie viele Ausfälle seither
 * still blieben. Modul-Zustand: auf Vercel je warmer Instanz, ein Kaltstart
 * beginnt neu — gewollt, „je Instanz" ist die Zusage.
 */
export type BremsMeldungen = { letzteMeldungMs: number | null; unterdrueckt: number }

/** Ein frischer Stand — der Modul-Zustand unten, und für Tests ein eigener je „Instanz". */
export function neueBremsMeldungen(): BremsMeldungen {
  return { letzteMeldungMs: null, unterdrueckt: 0 }
}

const MELDUNGEN_DIESER_INSTANZ = neueBremsMeldungen()

/** Fester Text, nur die Art des Fehlers und die Zwecke — nie Schlüssel oder Merkmal. */
function meldeBremsFehler(err: unknown, versuche: readonly Versuch[], jetzt: Date, meldungen: BremsMeldungen): void {
  if (!bremsMeldungFaellig(meldungen.letzteMeldungMs, jetzt.getTime())) {
    meldungen.unterdrueckt += 1
    return
  }
  const unterdruecktSeitLetzterMeldung = meldungen.unterdrueckt
  meldungen.letzteMeldungMs = jetzt.getTime()
  meldungen.unterdrueckt = 0
  const meldung = new Error('Bremse über alle Instanzen nicht erreichbar')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, {
    level: 'warning',
    tags: {
      aufgabe: 'bremse-datenbank',
      grund: err instanceof BremseZeitlimit ? 'zeitlimit' : 'datenbank',
      zweck: [...new Set(versuche.map((v) => v.bremse.zweck))].join(','),
    },
    extra: { unterdruecktSeitLetzterMeldung },
  })
}

/**
 * Die zweite Stufe für einen Aufruf: true = erlaubt (und gezählt), false =
 * mindestens ein Merkmal ist über seiner Grenze. Alle Versuche werden
 * gezählt, auch wenn einer schon drüber ist (wie `enforceRateLimit`). Bei
 * Datenbankfehler oder Zeitlimit: true (fail-open, siehe Kopf).
 *
 * Gilt immer — ob nur in Produktion gebremst wird, entscheidet der Aufrufer
 * zusammen mit seiner ersten Stufe. `meldungen` lassen die Aufrufer weg (der
 * Stand dieser Instanz); Tests geben einen eigenen mit.
 */
export async function bremseUeberAlleInstanzen(
  versuche: readonly Versuch[],
  jetzt: Date = new Date(),
  meldungen: BremsMeldungen = MELDUNGEN_DIESER_INSTANZ
): Promise<boolean> {
  if (versuche.length === 0) return true
  try {
    const staende = await mitFrist(zaehleVersuche(versuche, jetzt), DB_BREMSE_ZEITLIMIT_MS)
    return staende.every((stand, i) => innerhalbDerGrenze(stand, versuche[i].bremse.max))
  } catch (err) {
    meldeBremsFehler(err, versuche, jetzt, meldungen)
    return true
  }
}

/**
 * Checkout, zweite Stufe nach `enforceRateLimit('checkout', …)`: je IP und je
 * Sitzung 20 in der Minute über alle Instanzen. Nur in Produktion, wie die
 * erste Stufe. null = weiter, sonst die 429-Antwort der ersten Stufe.
 */
export async function bremseCheckout(
  request: Request,
  sessionId: string | null | undefined,
  jetzt: Date = new Date()
): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== 'production') return null
  const versuche: Versuch[] = [{ bremse: DB_BREMSEN.checkoutIp, merkmal: getClientIp(request.headers) }]
  if (sessionId) versuche.push({ bremse: DB_BREMSEN.checkoutSitzung, merkmal: sessionId })
  if (await bremseUeberAlleInstanzen(versuche, jetzt)) return null
  return NextResponse.json(
    { error: ZU_VIELE_ANFRAGEN },
    { status: 429, headers: { 'Retry-After': String(sekundenBisFensterEnde(jetzt, DB_BREMSEN.checkoutIp.fensterMs)) } }
  )
}

/**
 * Anmeldecode, zweite Stufe im before-Hook von auth.ts — die erste Stufe
 * (Better Auth je IP und Pfad, `codeAnforderungen` je Adresse) ist da schon
 * gelaufen. Anfordern zählt je IP und je Adresse, Anmelden mit Code je IP.
 * Nur in Produktion. true = gebremst.
 *
 * Ohne Anfrage-Header (ein Aufruf über `auth.api` vom Server) zählt keine
 * IP: Die erste Stufe von Better Auth gilt dort auch nicht, und alle
 * Server-Aufrufe teilten sich sonst einen Schlüssel.
 */
export async function anmeldecodeGebremst(
  schritt: 'anfordern' | 'pruefen',
  anfrage: Headers | undefined,
  email: string | null,
  jetzt: Date = new Date()
): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return false
  const versuche: Versuch[] = []
  if (anfrage) {
    versuche.push({
      bremse: schritt === 'anfordern' ? DB_BREMSEN.anmeldecodeAnfordernIp : DB_BREMSEN.anmeldecodePruefenIp,
      merkmal: getClientIp(anfrage),
    })
  }
  if (schritt === 'anfordern' && email !== null) {
    versuche.push({ bremse: DB_BREMSEN.anmeldecodeAdresse, merkmal: adressMerkmal(email) })
  }
  return !(await bremseUeberAlleInstanzen(versuche, jetzt))
}

/**
 * Neuigkeiten auf der Bestätigungsseite (Nr. 46, Runde 1): höchstens
 * `NEUIGKEITEN_JE_BESTELLUNG_UND_TAG` Anfragen je Bestellung und Tag, über
 * alle Instanzen. true = gebremst.
 *
 * Gilt überall, nicht nur in Produktion: Das Merkmal ist die Bestellung, keine
 * IP — lokal und in Tests teilen sich nicht alle einen Schlüssel, und drei
 * Anfragen je Bestellung stören dort niemanden. Fail-open wie jede zweite
 * Stufe: Die Bremse des Abos (zehn Minuten) wirkt weiter.
 */
export async function neuigkeitenGebremst(orderId: string, jetzt: Date = new Date()): Promise<boolean> {
  return !(await bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.neuigkeitenBestellung, merkmal: orderId }], jetzt))
}

/*
 * FALSCHE CODES UND PASSWÖRTER JE ADRESSE (Register E7, Ergänzung Lauf 17,
 * Nr. 112) — der Helfer für Fehlversuche. Anders als alle Bremsen oben
 * FAIL-CLOSED: Antwortet die Datenbank nicht (Fehler oder Zeitlimit), gilt
 * die Adresse als pausiert. Hier schützt die Bremse ein Konto vor dem Raten,
 * und ohne Datenbank kann ohnehin niemand angemeldet werden — durchzulassen
 * hieße nur, ungezählt raten zu lassen. Gemeldet wird gedrosselt wie oben.
 *
 * Gilt in jeder Umgebung, nicht nur in Produktion: Das Merkmal ist die
 * Adresse, keine IP — lokal und in Tests teilen sich nicht alle einen
 * Schlüssel (wie neuigkeitenGebremst). So prüft die Integrationsschicht die
 * echte Bremse, ohne Schalter.
 *
 * Geprüft wird VOR dem Code bzw. Passwort (nur lesen), gezählt danach, nur
 * wenn der Versuch scheiterte — zwei Schritte, weil erst Better Auth weiß, ob
 * der Code stimmte (hooks.before und hooks.after in src/lib/auth.ts).
 */

/** Die Versuche einer Art für diese Adresse — dieselben Schlüssel beim Prüfen, Zählen und Löschen. */
function fehlversuche(art: FehlversuchArt, email: string): Versuch[] {
  const merkmal = adressMerkmal(email)
  return FEHLVERSUCH_BREMSEN[art].map((bremse) => ({ bremse, merkmal }))
}

/** Die Stände im laufenden Fenster, OHNE zu zählen; keine Zeile = 0. */
async function leseStaende(versuche: readonly Versuch[], jetzt: Date): Promise<number[]> {
  const zeilen = versuche.map(({ bremse, merkmal }) => ({
    schluessel: bremsSchluessel(env.BETTER_AUTH_SECRET, bremse.zweck, merkmal),
    fensterStart: fensterBeginn(jetzt, bremse.fensterMs),
  }))
  const gefunden = await prisma.rateLimitZaehler.findMany({
    where: { OR: zeilen },
    select: { schluessel: true, fensterStart: true, zaehler: true },
  })
  return zeilen.map(
    (z) =>
      gefunden.find((g) => g.schluessel === z.schluessel && g.fensterStart.getTime() === z.fensterStart.getTime())
        ?.zaehler ?? 0
  )
}

/** Pausiert bis `bis`; `bis: null` = die Datenbank antwortete nicht (fail-closed, Ende unbekannt). */
export type FehlversuchSperre = { gesperrt: false } | { gesperrt: true; bis: Date | null }

/**
 * Ist diese Adresse für Codes bzw. Passwörter pausiert? Zählt nicht. Bei
 * Datenbankfehler oder Zeitlimit: pausiert (fail-closed, siehe oben).
 */
export async function fehlversucheGesperrt(
  art: FehlversuchArt,
  email: string,
  jetzt: Date = new Date(),
  meldungen: BremsMeldungen = MELDUNGEN_DIESER_INSTANZ
): Promise<FehlversuchSperre> {
  const versuche = fehlversuche(art, email)
  try {
    const staende = await mitFrist(leseStaende(versuche, jetzt), DB_BREMSE_ZEITLIMIT_MS)
    const bis = fehlversuchSperreBis(FEHLVERSUCH_BREMSEN[art], staende, jetzt)
    return bis === null ? { gesperrt: false } : { gesperrt: true, bis }
  } catch (err) {
    meldeBremsFehler(err, versuche, jetzt, meldungen)
    return { gesperrt: true, bis: null }
  }
}

/**
 * Zählt einen Fehlversuch. Macht genau dieser die Bremse voll, geht nach der
 * Antwort EINE Mail an die Adresse (nur wenn es ein Konto gibt). Wirft nie:
 * Scheitert das Zählen, bleibt der Versuch ungezählt — antwortet die
 * Datenbank nicht, pausiert schon die Prüfung vor dem nächsten Versuch.
 */
export async function zaehleFehlversuch(
  art: FehlversuchArt,
  email: string,
  jetzt: Date = new Date(),
  meldungen: BremsMeldungen = MELDUNGEN_DIESER_INSTANZ
): Promise<void> {
  const versuche = fehlversuche(art, email)
  let staende: number[]
  try {
    staende = await mitFrist(zaehleVersuche(versuche, jetzt), DB_BREMSE_ZEITLIMIT_MS)
  } catch (err) {
    meldeBremsFehler(err, versuche, jetzt, meldungen)
    return
  }
  const bis = pauseBeginntBis(FEHLVERSUCH_BREMSEN[art], staende, jetzt)
  if (bis !== null) {
    const merkmal = adressMerkmal(email)
    nachDerAntwort(() => schickeWarnMail(art, merkmal, bis))
  }
}

/** Fester Text, nur die Art — nie Adresse oder Fehlertext (ein Datenbank- oder Resend-Text kann die Adresse tragen). */
function meldeWarnMailFehler(grund: 'resend_fehler' | 'nachlauf_fehler', err?: unknown): void {
  const kontext = { tags: { aufgabe: 'zu-viele-versuche', grund } }
  if (err === undefined) {
    Sentry.captureMessage('Mail zu vielen Fehlversuchen nicht verschickt', { level: 'error', ...kontext })
    return
  }
  const meldung = new Error('Mail zu vielen Fehlversuchen nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, kontext)
}

/**
 * Die Mail „Zu viele falsche Codes" bzw. „… Passwörter" — nach der Antwort,
 * damit eine Adresse mit Konto nicht langsamer antwortet als eine ohne. Nur
 * an eine Adresse, die es gibt (genau, ohne Platzhalter, ohne Rücksicht auf
 * Groß-/Kleinschreibung); beim Passwort höchstens eine am Tag (Drossel in der
 * Datenbank, geschrieben nur, wenn es das Konto gibt). Nie mit Code oder
 * Link; im Log (ohne RESEND_API_KEY) steht nur der Betreff.
 */
async function schickeWarnMail(art: FehlversuchArt, merkmal: string, bis: Date): Promise<void> {
  try {
    const konto = await prisma.user.findFirst({
      where: { email: { equals: genauesIlikeMuster(merkmal), mode: 'insensitive' } },
      select: { email: true },
    })
    if (!konto) return
    if (art === 'passwort') {
      const [stand] = await zaehleVersuche([{ bremse: DB_BREMSEN.passwortFehlerMail, merkmal }])
      if (!innerhalbDerGrenze(stand, DB_BREMSEN.passwortFehlerMail.max)) return
    }
    const { sendZuVieleVersucheEmail } = await import('@/lib/email')
    const ergebnis = await sendZuVieleVersucheEmail(konto.email, art, bis)
    if (ergebnis.error) meldeWarnMailFehler('resend_fehler')
  } catch (err) {
    console.error('[Zu viele Versuche] E-Mail-Fehler:', err instanceof Error ? err.name : 'unbekannt')
    meldeWarnMailFehler('nachlauf_fehler', err)
  }
}

/**
 * Nach einem erfolgreichen Zurücksetzen des Passworts (hooks.after in
 * auth.ts): löscht die Zeilen von `passwort-fehler` für genau diese Adresse,
 * in jedem Fenster — sonst bliebe ein Hof nach dem neuen Passwort bis zum
 * Ende der Stunde ausgesperrt. Nur Zeilen der Bremse, kein Konto. Wirft nie:
 * Das Passwort ist da schon geändert.
 */
export async function loeschePasswortFehlversuche(email: string, jetzt: Date = new Date()): Promise<void> {
  const [versuch] = fehlversuche('passwort', email)
  try {
    await prisma.rateLimitZaehler.deleteMany({
      where: { schluessel: bremsSchluessel(env.BETTER_AUTH_SECRET, versuch.bremse.zweck, versuch.merkmal) },
    })
  } catch (err) {
    meldeBremsFehler(err, [versuch], jetzt, MELDUNGEN_DIESER_INSTANZ)
  }
}

/**
 * Für den täglichen Cron (api/cron/cleanup-reservations): Zeilen, deren
 * Fenster vorbei ist. Gelesen werden sie nie mehr — ein neues Fenster ist
 * eine neue Zeile.
 */
export async function raeumeBremsZaehlerAuf(jetzt: Date = new Date()): Promise<number> {
  const { count } = await prisma.rateLimitZaehler.deleteMany({ where: { ablauf: { lt: jetzt } } })
  return count
}
