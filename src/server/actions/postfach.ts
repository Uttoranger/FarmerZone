'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import type { Prisma, UnterhaltungSeite } from '@prisma/client'
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
import { gelesenSchema, hofAntwortSchema, rundschreibenSchema, teamAntwortSchema } from '@/schemas/postfach'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { ladeEmpfaengerHoefe, ladeMailEmpfaenger } from '@/server/queries/postfach'

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

const EIGENE_SAETZE = new Set<string>(Object.values(POSTFACH_FEHLER))

/** Nur die eigenen deutschen Sätze aus dem Schema; jeder andere Zod-Text (Englisch) wird zum festen Satz. */
function satzAus(fehler: z.ZodError): string {
  const satz = fehler.issues[0]?.message
  return satz !== undefined && EIGENE_SAETZE.has(satz) ? satz : POSTFACH_FEHLER.eingabe
}

/**
 * Der Hof der Sitzung — nie aus dem Formular: der Hof, dessen Besitzer
 * angemeldet ist (wie getFarmForUser in den übrigen Hof-Actions). Die Rolle
 * aus der Sitzung zählt hier nicht — sie kann aus dem Sitzungs-Cookie stammen;
 * entscheidend ist der Besitz, frisch aus der Datenbank.
 */
async function hofDerSitzung(): Promise<{ id: string } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: POSTFACH_FEHLER.anmelden }
  const hof = await prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true } })
  return hof ?? { error: POSTFACH_FEHLER.keinHof }
}

/**
 * Der Lesestand einer Seite rückt bis `bis` vor — angelegt, wenn es keinen
 * gibt, sonst nur vorwärts (neuerLesestand als Bedingung im UPDATE): Zwei
 * Tabs mit verschiedenem Stand setzen ihn nie zurück. Nacheinander, auch in
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
 * Keine E-Mail — der Zähler beim Team reicht.
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
    // Besitz in der WHERE-Klausel, nicht in einem vorherigen if: Ein fremder
    // Faden ergibt 0 Zeilen, und es entsteht keine Nachricht.
    const { count } = await tx.unterhaltung.updateMany({ where: { id: unterhaltungId, farmId: hof.id }, data: { letzteNachrichtAm: jetzt } })
    if (count === 0) return false
    await tx.nachricht.create({ data: { unterhaltungId, vonFarmId: hof.id, text, createdAt: jetzt } })
    await setzeLesestand(tx, unterhaltungId, 'HOF', jetzt)
    return true
  })
  if (!angelegt) return { error: POSTFACH_FEHLER.nichtGefunden }

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
    const { count } = await prisma.unterhaltung.updateMany({
      where: { id: unterhaltungId, OR: [{ letzteMailAm: null }, { letzteMailAm: { lte: new Date(jetzt.getTime() - MAIL_ABSTAND_MS) } }] },
      data: { letzteMailAm: jetzt },
    })
    mail = count === 1 ? 'unterwegs' : 'gedrosselt'
    if (count === 1) {
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
  const { titel, text, art, link, perMail, empfaenger } = geprueft.data

  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const hofIds = empfaengerFuer(empfaenger, await ladeEmpfaengerHoefe())
  if (hofIds.length === 0) return { error: POSTFACH_FEHLER.keineEmpfaenger }
  // Gespeichert wird, wen das Senden wirklich traf — bei „Ausgewählte" die geprüften Kennungen.
  const regel: EmpfaengerRegel = empfaenger.art === 'ausgewaehlt' ? { art: 'ausgewaehlt', hofIds } : empfaenger

  const jetzt = new Date()
  const faeden = await prisma.$transaction(async (tx) => {
    const rundschreiben = await tx.rundschreiben.create({
      data: { titel, text, linkUrl: link, art, perMail, empfaengerRegel: regel, empfaenger: hofIds.length, gesendetAm: jetzt, erstelltVonUserId: guard.userId },
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
