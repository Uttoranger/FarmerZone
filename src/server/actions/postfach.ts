'use server'

import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { revalidatePath, updateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { Prisma, type UnterhaltungSeite } from '@prisma/client'
import type { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createRateLimiter } from '@/lib/rate-limit'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import {
  ADMIN_POSTFACH_HREF,
  MAIL_ABSTAND_MS,
  NACHRICHTEN_JE_HOF_UND_TAG,
  POSTFACH_DB_BREMSE,
  POSTFACH_FEHLER,
  POSTFACH_HREF,
  POSTFACH_TEXT,
  TAG_MS,
  empfaengerFuer,
  fadenHref,
  nachrichtArtVon,
  type EmpfaengerRegel,
} from '@/lib/postfach'
import {
  empfaengerEntfernenSchema,
  empfaengerHinzufuegenSchema,
  empfaengerTokenSchema,
  gelesenSchema,
  hofAntwortSchema,
  rundschreibenSchema,
  teamAntwortSchema,
  zustellRegelnSpeichernSchema,
} from '@/schemas/postfach'
import {
  HINZUFUEGEN_JE_STUNDE,
  STUNDE_MS,
  TESTMAIL_ABSTAND_MS,
  ZUSTELLUNG_FEHLER,
  empfaengerliste,
  empfaengerZustand,
  tokenBisAb,
} from '@/lib/zustellung'
import { SUPPORT_EMAIL } from '@/lib/support'
import { ZU_LANG } from '@/lib/eingabegrenzen'
import { PLATTFORM_EINSTELLUNG_ID, PLATTFORM_EINSTELLUNG_TAG } from '@/lib/plattform-einstellung'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { getFarmForUser } from '@/server/queries/dashboard'
import {
  empfaengerTokenHash,
  ladeAntwortFuerTeam,
  ladeBetreiberEmpfaenger,
  ladeEmpfaengerHoefe,
  ladeMailEmpfaenger,
  ladeZustellung,
} from '@/server/queries/postfach'

/*
 * Das Postfach, Stufe 1 (Register N12, Nachtlauf Nr. 87) — die schreibenden
 * Wege. Hof: antworten und „gelesen" nur im EIGENEN Faden — der Hof kommt aus
 * der Sitzung (Rolle FARMER, eigener Hof), seine farmId steht in der
 * WHERE-Klausel desselben Schreibens; ein fremder Faden ergibt 0 Zeilen und
 * denselben Satz wie ein unbekannter. Admin: antworten, „gelesen" und
 * Rundschreiben senden nur nach verlangeAdminAktion. Jede Seite setzt nur
 * ihren eigenen Lesestand (HOF bzw. TEAM, nie aus dem Browser).
 *
 * Nachrichtentexte sind Fremdtext: Sie gehen nie nach Sentry, auch nicht über
 * einen Fehlertext — gemeldet wird ein fester Satz mit Klasse und Kennungen.
 * Die E-Mails laufen nach der Antwort (nachDerAntwort) über sendRaw mit der
 * Post-Sperre; ein gescheiterter Versand nimmt nie eine gespeicherte
 * Nachricht zurück.
 */

type Ergebnis = { ok: true } | { error: string }

/** Erste Stufe des Rate-Limits je Instanz (R1); die zweite zählt POSTFACH_DB_BREMSE über alle Instanzen. */
const hofDrossel = createRateLimiter({ max: NACHRICHTEN_JE_HOF_UND_TAG, windowMs: TAG_MS })
/** Zustellung (N14): höchstens fünf neue Adressen je Admin und Stunde, eine Testmail je Minute. */
const hinzufuegenDrossel = createRateLimiter({ max: HINZUFUEGEN_JE_STUNDE, windowMs: STUNDE_MS })
const testmailDrossel = createRateLimiter({ max: 1, windowMs: TESTMAIL_ABSTAND_MS })

const EIGENE_SAETZE = new Set<string>(Object.values(POSTFACH_FEHLER))

/** Nur die eigenen deutschen Sätze aus dem Schema; jeder andere Zod-Text (Englisch) wird zum festen Satz. */
function satzAus(fehler: z.ZodError): string {
  const satz = fehler.issues[0]?.message
  return satz !== undefined && EIGENE_SAETZE.has(satz) ? satz : POSTFACH_FEHLER.eingabe
}

/**
 * Der Hof der Sitzung — nie aus dem Formular: getFarmForUser wie die
 * Hof-Seiten und die übrigen Hof-Actions (der Besitz, frisch aus der
 * Datenbank). Die Rolle aus der Sitzung zählt hier nicht — sie kann aus dem
 * Sitzungs-Cookie stammen. Nicht ladeHofbereich: Das leitet um und lädt
 * Zähler, Banner und Tarif — fünf Abfragen, die eine Action nicht braucht.
 */
async function hofDerSitzung(): Promise<{ id: string } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: POSTFACH_FEHLER.anmelden }
  return (await getFarmForUser(session.user.id)) ?? { error: POSTFACH_FEHLER.keinHof }
}

/**
 * Der Lesestand einer Seite rückt bis `bis` vor — angelegt, wenn es keinen
 * gibt, sonst nur vorwärts: Die Regel ist die Bedingung `gelesenBis < bis` im
 * UPDATE, so setzen zwei Tabs mit verschiedenem Stand ihn nie zurück
 * (geprüft in tests/integration/postfach.int.test.ts). Nacheinander, auch in
 * einer Transaktion (CODING_STANDARDS §4).
 */
async function setzeLesestand(
  db: Prisma.TransactionClient,
  unterhaltungId: string,
  seite: UnterhaltungSeite,
  bis: Date
): Promise<void> {
  await db.unterhaltungStand.createMany({ data: [{ unterhaltungId, seite, gelesenBis: bis }], skipDuplicates: true })
  await db.unterhaltungStand.updateMany({ where: { unterhaltungId, seite, gelesenBis: { lt: bis } }, data: { gelesenBis: bis } })
}

/** Ein Fehler im Nachlauf geht ohne Text nach Sentry: nur ein fester Satz, die Klasse und Kennungen. */
function meldeNachlauf(err: unknown, aufgabe: string, kennung: string): void {
  const meldung = new Error('Postfach: E-Mail nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'postfach', aufgabe }, extra: { kennung } })
}

function hofSeitenNeu(unterhaltungId: string): void {
  revalidatePath(POSTFACH_HREF)
  revalidatePath(fadenHref(unterhaltungId))
  revalidatePath('/dashboard')
}

// ─── Hof ─────────────────────────────────────────────────────────────────────

/**
 * Der Hof antwortet im eigenen Faden (N12: Höfe beginnen keine Fäden). Höchstens
 * NACHRICHTEN_JE_HOF_UND_TAG je Hof und Tag (nur in Produktion, zwei Stufen
 * wie R1). Wer antwortet, hat gelesen: Der Lesestand des Hofs rückt mit.
 * Hat das Rundschreiben „Antwort möglich" aus (N14), entsteht nichts — die
 * Bedingung steht in derselben WHERE-Klausel wie der Besitz; ein Faden ohne
 * Rundschreiben (Gründungs-Nachricht, Nr. 93) bleibt beantwortbar. Nach der
 * Antwort geht nach der Regel „Antwort eines Hofs" eine Mail an die
 * Empfängerliste (Zustellung) — nie an den Hof.
 */
export async function antworteAlsHof(eingabe: unknown): Promise<Ergebnis> {
  const geprueft = hofAntwortSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: satzAus(geprueft.error) }
  const { unterhaltungId, text } = geprueft.data

  const hof = await hofDerSitzung()
  if ('error' in hof) return hof

  if (process.env.NODE_ENV === 'production') {
    if (!hofDrossel.check(hof.id)) return { error: POSTFACH_FEHLER.zuViele }
    if (!(await bremseUeberAlleInstanzen([{ bremse: POSTFACH_DB_BREMSE, merkmal: hof.id }]))) return { error: POSTFACH_FEHLER.zuViele }
  }

  const jetzt = new Date()
  const angelegt = await prisma.$transaction(async (tx) => {
    // Besitz und „Antwort möglich" in der WHERE-Klausel, nicht in einem
    // vorherigen if: Ein fremder Faden oder ein Rundschreiben ohne Antwort
    // ergibt 0 Zeilen, und es entsteht keine Nachricht.
    const { count } = await tx.unterhaltung.updateMany({
      where: { id: unterhaltungId, farmId: hof.id, OR: [{ rundschreibenId: null }, { rundschreiben: { antwortMoeglich: true } }] },
      data: { letzteNachrichtAm: jetzt },
    })
    if (count === 0) return false
    await tx.nachricht.create({ data: { unterhaltungId, vonFarmId: hof.id, text, createdAt: jetzt } })
    await setzeLesestand(tx, unterhaltungId, 'HOF', jetzt)
    return true
  })
  if (!angelegt) {
    // Nur für den richtigen Satz, nach dem Schreiben: Gehört der Faden dem
    // Hof, war „Antwort möglich" aus — sonst gibt es ihn für diesen Hof nicht.
    const eigener = await prisma.unterhaltung.count({ where: { id: unterhaltungId, farmId: hof.id } })
    return { error: eigener > 0 ? POSTFACH_FEHLER.antwortNichtMoeglich : POSTFACH_FEHLER.nichtGefunden }
  }

  nachDerAntwort(async () => {
    try {
      const an = await ladeBetreiberEmpfaenger('antwortHof')
      if (an.length === 0) return
      const faden = await ladeAntwortFuerTeam(unterhaltungId)
      if (!faden) return
      const { sendHofAntwortAnTeam } = await import('@/lib/email')
      const ergebnis = await sendHofAntwortAnTeam(an, { hofName: faden.hofName, titel: faden.titel ?? POSTFACH_TEXT.ohneTitel, text, unterhaltungId })
      if (ergebnis.gescheitert > 0) meldeNachlauf(new Error('Versand'), 'antwort-team-mail', unterhaltungId)
    } catch (err) {
      meldeNachlauf(err, 'antwort-team-mail', unterhaltungId)
    }
  })

  hofSeitenNeu(unterhaltungId)
  revalidatePath(ADMIN_POSTFACH_HREF)
  return { ok: true }
}

/**
 * „Gelesen" auf Heute und das Öffnen des Fadens: Der Lesestand des Hofs rückt
 * bis zu dieser Nachricht vor — nur, wenn sie in einem Faden dieses Hofs
 * steht (farmId in der WHERE-Klausel der Abfrage).
 */
export async function markiereGelesen(eingabe: unknown): Promise<Ergebnis> {
  const geprueft = gelesenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: satzAus(geprueft.error) }
  const { unterhaltungId, nachrichtId } = geprueft.data

  const hof = await hofDerSitzung()
  if ('error' in hof) return hof

  const nachricht = await prisma.nachricht.findFirst({
    where: { id: nachrichtId, unterhaltungId, unterhaltung: { farmId: hof.id } },
    select: { createdAt: true },
  })
  if (!nachricht) return { error: POSTFACH_FEHLER.nichtGefunden }

  await prisma.$transaction(async (tx) => setzeLesestand(tx, unterhaltungId, 'HOF', nachricht.createdAt))
  hofSeitenNeu(unterhaltungId)
  return { ok: true }
}

/**
 * „Gelesen" auf der Karte von Heute als Formular (Mockup
 * mobil-h3-heute-post-karte) — geht auch ohne JavaScript. Dieselbe Regel wie
 * markiereGelesen; danach steht Heute ohne die Karte da (revalidatePath).
 * Scheitert es, bleibt die Karte stehen und der Knopf lässt sich noch einmal
 * tippen — ein unerwarteter Fehler wirft wie in jeder Action.
 */
export async function markiereGelesenFormular(formular: FormData): Promise<void> {
  await markiereGelesen({ unterhaltungId: formular.get('unterhaltungId'), nachrichtId: formular.get('nachrichtId') })
}

// ─── Admin ───────────────────────────────────────────────────────────────────

/** Ob zur Antwort eine E-Mail unterwegs ist — „gedrosselt": in der letzten Stunde ging zu diesem Faden schon eine. */
export type TeamAntwortErgebnis = { ok: true; mail: 'unterwegs' | 'gedrosselt' | 'aus' } | { error: string }

/**
 * Das Team antwortet im Faden eines Hofs („Als Wichtig markieren", „Link
 * einfügen", „Auch per E-Mail (Betriebsmitteilung)"). Die E-Mail geht nur mit
 * Haken und höchstens einmal je Faden und Stunde: Den Platz belegt ein
 * bedingtes UPDATE auf letzteMailAm — zwei gleichzeitige Antworten schicken
 * nie zwei Mails.
 */
export async function antworteAlsTeam(eingabe: unknown): Promise<TeamAntwortErgebnis> {
  const geprueft = teamAntwortSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: satzAus(geprueft.error) }
  const { unterhaltungId, text, wichtig, link, perMail } = geprueft.data

  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const jetzt = new Date()
  const angelegt = await prisma.$transaction(async (tx) => {
    const { count } = await tx.unterhaltung.updateMany({ where: { id: unterhaltungId }, data: { letzteNachrichtAm: jetzt } })
    if (count === 0) return false
    await tx.nachricht.create({
      data: { unterhaltungId, vonFarmId: null, text, linkUrl: link, art: wichtig ? 'WICHTIG' : 'NORMAL', createdAt: jetzt },
    })
    await setzeLesestand(tx, unterhaltungId, 'TEAM', jetzt)
    return true
  })
  if (!angelegt) return { error: POSTFACH_FEHLER.nichtGefunden }

  let mail: 'unterwegs' | 'gedrosselt' | 'aus' = 'aus'
  if (perMail) {
    // Nachlauf: Die Antwort ist gespeichert. Scheitert das Belegen der Stunde,
    // geht keine Mail ('aus') — aber kein Fehler an den Admin, sonst schickte
    // er dieselbe Antwort ein zweites Mal. Gemeldet wird nur die Fehlerklasse.
    try {
      const { count } = await prisma.unterhaltung.updateMany({
        where: { id: unterhaltungId, OR: [{ letzteMailAm: null }, { letzteMailAm: { lte: new Date(jetzt.getTime() - MAIL_ABSTAND_MS) } }] },
        data: { letzteMailAm: jetzt },
      })
      mail = count === 1 ? 'unterwegs' : 'gedrosselt'
    } catch (err) {
      meldeNachlauf(err, 'antwort-mail-stunde', unterhaltungId)
    }
    if (mail === 'unterwegs') {
      nachDerAntwort(async () => {
        try {
          const [empfaenger] = await ladeMailEmpfaenger([unterhaltungId])
          if (!empfaenger) return
          const { sendPostfachMail } = await import('@/lib/email')
          const ergebnis = await sendPostfachMail({
            art: 'antwort',
            an: empfaenger.email,
            titel: empfaenger.titel ?? POSTFACH_TEXT.ohneTitel,
            text,
            link,
            unterhaltungId,
          })
          if (ergebnis.error) meldeNachlauf(new Error('Versand'), 'antwort-mail', unterhaltungId)
        } catch (err) {
          meldeNachlauf(err, 'antwort-mail', unterhaltungId)
        }
      })
    }
  }

  revalidatePath(ADMIN_POSTFACH_HREF)
  revalidatePath(POSTFACH_HREF)
  revalidatePath(fadenHref(unterhaltungId))
  return { ok: true, mail }
}

/** Das Öffnen eines Fadens im Admin: Der Lesestand des Teams rückt bis zu dieser Nachricht vor. */
export async function markiereGelesenTeam(eingabe: unknown): Promise<Ergebnis> {
  const geprueft = gelesenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: satzAus(geprueft.error) }
  const { unterhaltungId, nachrichtId } = geprueft.data

  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const nachricht = await prisma.nachricht.findFirst({ where: { id: nachrichtId, unterhaltungId }, select: { createdAt: true } })
  if (!nachricht) return { error: POSTFACH_FEHLER.nichtGefunden }

  await prisma.$transaction(async (tx) => setzeLesestand(tx, unterhaltungId, 'TEAM', nachricht.createdAt))
  revalidatePath(ADMIN_POSTFACH_HREF)
  return { ok: true }
}

export type RundschreibenErgebnis = { ok: true; empfaenger: number } | { error: string }

/**
 * Ein Rundschreiben senden: Die Empfänger rechnet der Server aus der Regel
 * (empfaengerFuer über die nicht stillgelegten Höfe) — nie eine Liste aus dem
 * Browser übernehmen. In EINER Transaktion: das Rundschreiben, je Empfänger
 * genau ein Faden (Unique farmId + rundschreibenId) mit der ersten Nachricht
 * vom Team. Mit Haken gehen danach die E-Mails raus; letzteMailAm belegt die
 * Stunde schon in der Transaktion.
 */
export async function sendeRundschreiben(eingabe: unknown): Promise<RundschreibenErgebnis> {
  const geprueft = rundschreibenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: satzAus(geprueft.error) }
  const { titel, text, art, link, perMail, antwortMoeglich, empfaenger } = geprueft.data

  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const hofIds = empfaengerFuer(empfaenger, await ladeEmpfaengerHoefe())
  if (hofIds.length === 0) return { error: POSTFACH_FEHLER.keineEmpfaenger }
  // Gespeichert wird, wen das Senden wirklich traf — bei „Ausgewählte" die geprüften Kennungen.
  const regel: EmpfaengerRegel = empfaenger.art === 'ausgewaehlt' ? { art: 'ausgewaehlt', hofIds } : empfaenger

  const jetzt = new Date()
  const faeden = await prisma.$transaction(async (tx) => {
    const rundschreiben = await tx.rundschreiben.create({
      data: { titel, text, linkUrl: link, art, perMail, antwortMoeglich, empfaengerRegel: regel, empfaenger: hofIds.length, gesendetAm: jetzt, erstelltVonUserId: guard.userId },
      select: { id: true },
    })
    const angelegt = await tx.unterhaltung.createManyAndReturn({
      data: hofIds.map((farmId) => ({ farmId, rundschreibenId: rundschreiben.id, letzteNachrichtAm: jetzt, letzteMailAm: perMail ? jetzt : null })),
      select: { id: true },
    })
    await tx.nachricht.createMany({
      data: angelegt.map((f) => ({ unterhaltungId: f.id, vonFarmId: null, text, linkUrl: link, art: nachrichtArtVon(art), createdAt: jetzt })),
    })
    return angelegt.map((f) => f.id)
  })

  if (perMail) {
    nachDerAntwort(async () => {
      try {
        const empfaengerListe = await ladeMailEmpfaenger(faeden)
        const { sendPostfachMail } = await import('@/lib/email')
        let gescheitert = 0
        // Nacheinander: Resend begrenzt die Anfragen je Sekunde, und ein Fehler bei einem Hof hält die übrigen nicht auf.
        for (const e of empfaengerListe) {
          const ergebnis = await sendPostfachMail({ art: 'rundschreiben', an: e.email, titel, text, link, unterhaltungId: e.unterhaltungId })
          if (ergebnis.error) gescheitert += 1
        }
        if (gescheitert > 0) meldeNachlauf(new Error(`${gescheitert} gescheitert`), 'rundschreiben-mail', String(faeden.length))
      } catch (err) {
        meldeNachlauf(err, 'rundschreiben-mail', String(faeden.length))
      }
    })
  }

  revalidatePath(ADMIN_POSTFACH_HREF)
  revalidatePath(POSTFACH_HREF)
  revalidatePath('/dashboard')
  return { ok: true, empfaenger: faeden.length }
}

// ─── Zustellung (Register N14, Nr. 95) ───────────────────────────────────────

export type HinzufuegenErgebnis = { ok: true; email: string } | { error: string }

/**
 * Eine weitere Adresse eintragen: Sie bekommt erst Mails, wenn sie über den
 * Link bestätigt ist (Double-Opt-in, S11). Der Link trägt 32 zufällige Bytes;
 * gespeichert wird nur ihr SHA-256 (empfaengerTokenHash), gültig 48 Stunden.
 * Eine noch unbestätigte Adresse bekommt einen neuen Link (der alte gilt nicht
 * mehr), eine bestätigte bleibt, wie sie ist. Bedingt geschrieben, ohne Lesen
 * davor: Zwei gleichzeitige Klicks legen nie zwei Zeilen an (Unique email).
 * Die Mail geht nach der Antwort; ein Fehler meldet nur die Klasse.
 */
export async function fuegeEmpfaengerHinzu(eingabe: unknown): Promise<HinzufuegenErgebnis> {
  const geprueft = empfaengerHinzufuegenSchema.safeParse(eingabe)
  if (!geprueft.success) {
    // Nur die eigenen Sätze des Schemas (Format, ZU_LANG); jeder andere Zod-Text (Englisch) wird zum festen Satz.
    const satz = geprueft.error.issues[0]?.message
    return { error: satz === ZU_LANG.email ? ZU_LANG.email : ZUSTELLUNG_FEHLER.email }
  }
  const { email } = geprueft.data

  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  if (email === SUPPORT_EMAIL.toLowerCase()) return { error: ZUSTELLUNG_FEHLER.schonFest }
  if (process.env.NODE_ENV === 'production' && !hinzufuegenDrossel.check(guard.userId)) return { error: ZUSTELLUNG_FEHLER.zuViele }

  const token = randomBytes(32).toString('base64url')
  const link = { token: empfaengerTokenHash(token), tokenBis: tokenBisAb(new Date()) }
  const { count } = await prisma.betreiberEmpfaenger.updateMany({ where: { email, bestaetigtAm: null }, data: link })
  if (count === 0) {
    try {
      await prisma.betreiberEmpfaenger.create({ data: { email, ...link, erstelltVonUserId: guard.userId } })
    } catch (err) {
      // Es gibt die Adresse schon, und sie ist bestätigt (das bedingte Update traf nichts).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { error: ZUSTELLUNG_FEHLER.schonBestaetigt }
      throw err
    }
  }

  nachDerAntwort(async () => {
    try {
      const { sendBetreiberBestaetigung } = await import('@/lib/email')
      const ergebnis = await sendBetreiberBestaetigung(email, token)
      if (ergebnis.error) meldeZustellung(new Error('Versand'), 'bestaetigung')
    } catch (err) {
      meldeZustellung(err, 'bestaetigung')
    }
  })

  revalidatePath(ADMIN_POSTFACH_HREF)
  return { ok: true, email }
}

/** Ein Fehler der Zustellung geht ohne Adresse nach Sentry: fester Satz, Klasse, Aufgabe. */
function meldeZustellung(err: unknown, aufgabe: string): void {
  const meldung = new Error('Zustellung: E-Mail nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'zustellung', aufgabe } })
}

/** Eine weitere Adresse entfernen — sofort; ab dann bekommt sie nichts mehr. */
export async function entferneEmpfaenger(eingabe: unknown): Promise<Ergebnis> {
  const geprueft = empfaengerEntfernenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: ZUSTELLUNG_FEHLER.eingabe }

  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const { count } = await prisma.betreiberEmpfaenger.deleteMany({ where: { id: geprueft.data.id } })
  if (count === 0) return { error: ZUSTELLUNG_FEHLER.nichtGefunden }
  revalidatePath(ADMIN_POSTFACH_HREF)
  return { ok: true }
}

/**
 * Die Regeln speichern (nur die schaltbaren; „Erstattung offen" und
 * Wünsche/Fragen sind fest). Geschrieben wird NUR zustellRegeln — nicht
 * geaendertVonUserId, das ist die Protokollzeile der Gruppe Gründungshöfe
 * (Nr. 93). Danach das Etikett der gecachten Einstellung leeren.
 */
export async function speichereZustellRegeln(eingabe: unknown): Promise<Ergebnis> {
  const geprueft = zustellRegelnSpeichernSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: ZUSTELLUNG_FEHLER.eingabe }

  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const zustellRegeln = geprueft.data
  await prisma.plattformEinstellung.upsert({
    where: { id: PLATTFORM_EINSTELLUNG_ID },
    create: { id: PLATTFORM_EINSTELLUNG_ID, zustellRegeln },
    update: { zustellRegeln },
  })
  // updateTag statt revalidateTag: In Next 16 verlangt revalidateTag ein Profil (wie Nr. 93).
  updateTag(PLATTFORM_EINSTELLUNG_TAG)
  revalidatePath(ADMIN_POSTFACH_HREF)
  return { ok: true }
}

export type TestmailErgebnis = { ok: true; empfaenger: number } | { error: string }

/** „Testmail an alle senden": an die ganze Liste (SUPPORT_EMAIL und jede bestätigte Adresse), höchstens eine je Minute. */
export async function sendeTestmail(): Promise<TestmailErgebnis> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }
  if (process.env.NODE_ENV === 'production' && !testmailDrossel.check('alle')) return { error: ZUSTELLUNG_FEHLER.testZuOft }

  const an = empfaengerliste((await ladeZustellung()).bestaetigte)
  nachDerAntwort(async () => {
    try {
      const { sendBetreiberTestmail } = await import('@/lib/email')
      const ergebnis = await sendBetreiberTestmail(an)
      if (ergebnis.gescheitert > 0) meldeZustellung(new Error(`${ergebnis.gescheitert} gescheitert`), 'testmail')
    } catch (err) {
      meldeZustellung(err, 'testmail')
    }
  })
  return { ok: true, empfaenger: an.length }
}

export type BestaetigenErgebnis = { ok: true } | { error: 'abgelaufen' | 'ungueltig' }

/**
 * Den Link aus der Bestätigungsmail einlösen — OHNE Anmeldung: Der Token ist
 * der Ausweis. Einmalig: In EINEM bedingten Schreiben (Hash über den
 * eindeutigen Index, noch gültig, noch nicht bestätigt) wird bestaetigtAm
 * gesetzt und der Token gelöscht — ein zweiter Klick findet nichts mehr.
 * Aufgerufen von der Bestätigungsseite per Knopf (POST), nie beim Öffnen des
 * Links.
 */
export async function bestaetigeEmpfaenger(eingabe: unknown): Promise<BestaetigenErgebnis> {
  const token = empfaengerTokenSchema.safeParse(eingabe)
  if (!token.success) return { error: 'ungueltig' }
  const jetzt = new Date()
  const hash = empfaengerTokenHash(token.data)
  const { count } = await prisma.betreiberEmpfaenger.updateMany({
    where: { token: hash, bestaetigtAm: null, tokenBis: { gt: jetzt } },
    data: { bestaetigtAm: jetzt, token: null, tokenBis: null },
  })
  if (count === 1) {
    revalidatePath(ADMIN_POSTFACH_HREF)
    return { ok: true }
  }
  // Nur für den richtigen Satz: Gibt es den Link noch, ist er abgelaufen.
  const zeile = await prisma.betreiberEmpfaenger.findUnique({ where: { token: hash }, select: { bestaetigtAm: true, tokenBis: true } })
  return { error: zeile && empfaengerZustand(zeile, jetzt) === 'abgelaufen' ? 'abgelaufen' : 'ungueltig' }
}
