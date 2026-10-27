'use server'

import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { genauesIlikeMuster } from '@/lib/ilike-muster'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { KONTO_ANFRAGE_TEXT } from '@/lib/konto-anfragen'
import { verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { ADMIN_RECHTE, ADMIN_RECHT_TEXT, eingestellteRechte } from '@/lib/admin-rechte'
import { TEAM_SPERRE, TEAM_TEXT, letzterInhaber, type TeamAnlass } from '@/lib/admin-team'
import { teamEinladenSchema, teamEntfernenSchema, teamInhaberSchema, teamRechteSchema } from '@/schemas/admin-team'
import type { AdminAktionArt } from '@/schemas/admin-aktion'

/*
 * Einstellungen › Team (Register N35, Nachtlauf Nr. 190): einladen, Rechte
 * ändern, Inhaber machen bzw. entziehen, aus dem Team entfernen. NUR Inhaber
 * (Recht „team“, nie weitergebbar), jede Änderung frisch mit Passkey (die EINE
 * Wache verlangeFrischeBestaetigung als erste Anweisung), danach Mail an die
 * Person (Nachlauf) und Eintrag im Protokoll (N33).
 *
 * Diese Datei und src/server/admin-wache.ts sind die einzigen Stellen, die
 * `isAdmin`, `adminInhaber` und `adminRechte` schreiben bzw. lesen (Wache:
 * tests/admin-rechte-wache.test.ts). Alle Änderungen laufen unter EINER
 * Sperre (pg_advisory_xact_lock(TEAM_SPERRE)) — sonst könnten sich zwei
 * Inhaber gleichzeitig gegenseitig das Recht nehmen, und niemand bliebe.
 * Den letzten Inhaber kann niemand entfernen (`letzterInhaber`).
 *
 * Einladen verrät nie, ob es zu einer Adresse ein Konto gibt: Die Antwort
 * ist immer dieselbe (Freigabe Lauf 26, §2).
 */

type Ergebnis = { ok: true } | { error: string }
type Tx = Prisma.TransactionClient

const PERSON = { id: true, email: true, name: true, isAdmin: true, adminInhaber: true, adminRechte: true } as const satisfies Prisma.UserSelect
type Person = Prisma.UserGetPayload<{ select: typeof PERSON }>

function revalidiere(): void {
  revalidatePath('/admin/einstellungen')
}

async function sperre(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TEAM_SPERRE})`
}

/** Inhaber außer dieser Person — nur Personen mit Admin-Recht zählen. */
async function andereInhaber(tx: Tx, userId: string): Promise<number> {
  return tx.user.count({ where: { isAdmin: true, adminInhaber: true, id: { not: userId } } })
}

/** Rechte als Wörter für die Mail — ein Inhaber hat alle. */
function rechteWoerter(person: { adminInhaber: boolean; adminRechte: readonly string[] }): string[] {
  return [ADMIN_RECHT_TEXT.ansehen, ...eingestellteRechte(person).map((r) => ADMIN_RECHT_TEXT[r])]
}

/** Sicherheitsmail an die Person — Nachlauf: Ein Fehler nimmt die Änderung nie zurück; nach Sentry nur der Anlass. */
async function sagEsDerPerson(person: { email: string; name: string | null }, anlass: TeamAnlass, rechte: string[]): Promise<void> {
  try {
    const { sendTeamRechtGeaendert } = await import('@/lib/email')
    const versand = await sendTeamRechtGeaendert(person.email, { anlass, name: person.name, rechte })
    if (versand.error && process.env.RESEND_API_KEY) {
      Sentry.captureMessage('Mail „Team: Recht geändert“ nicht verschickt', { level: 'error', tags: { aufgabe: 'team-recht-geaendert', anlass } })
    }
  } catch (err) {
    const meldung = new Error('Mail „Team: Recht geändert“ nicht verschickt')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { tags: { aufgabe: 'team-recht-geaendert', anlass } })
  }
}

/** Liest die Person im Team unter der Sperre — null, wenn sie (nicht mehr) im Team ist. */
async function personImTeam(tx: Tx, userId: string): Promise<Person | null> {
  const person = await tx.user.findUnique({ where: { id: userId }, select: PERSON })
  return person?.isAdmin ? person : null
}

/**
 * „Person einladen …“: nur ein bestehendes Konto per genauer Adresse. Setzt
 * `isAdmin`, `adminSeit = jetzt` (das 24-Stunden-Fenster der
 * Passkey-Einrichtung, N20) und `adminRechte = []` — die Person hat zuerst
 * nur „ansehen“. Gibt es kein Konto oder ist die Person schon im Team,
 * passiert nichts — die Antwort ist dieselbe.
 */
export async function ladePersonEin(eingabe: unknown): Promise<Ergebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'team' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = teamEinladenSchema.safeParse(eingabe)
  if (!parsed.success) return { error: KONTO_ANFRAGE_TEXT.email.ungueltig }

  const eingeladen = await prisma.$transaction(async (tx) => {
    await sperre(tx)
    const konten = await tx.user.findMany({ where: { email: { equals: genauesIlikeMuster(parsed.data.adresse), mode: 'insensitive' } }, select: PERSON })
    // Zwei Konten zu einer Adresse gäbe es nur von Hand — dann keines (wie die Anmeldung mit Ersatzcode).
    const konto = konten.length === 1 ? konten[0] : null
    if (!konto || konto.isAdmin) return null
    await tx.user.update({ where: { id: konto.id }, data: { isAdmin: true, adminInhaber: false, adminRechte: [], adminSeit: new Date() } })
    return konto
  })
  if (eingeladen) {
    // Protokoll und Mail erst nach der Antwort: Sonst verriete die Antwortzeit,
    // ob es zu der Adresse ein Konto gibt (Freigabe 190, Punkt 4).
    nachDerAntwort(async () => {
      await protokolliere({ wer: frisch.userId, art: 'team_eingeladen', bezugArt: 'person', bezugId: eingeladen.id, mitPasskey: frisch.mitPasskey })
      await sagEsDerPerson(eingeladen, 'eingeladen', [ADMIN_RECHT_TEXT.ansehen])
    })
    revalidiere()
  }
  return { ok: true }
}

/** Rechte einer Person setzen (Schalter, Vorlagen) — genau die Liste aus ADMIN_RECHTE, in fester Reihenfolge. */
export async function setzeTeamRechte(eingabe: unknown): Promise<Ergebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'team' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = teamRechteSchema.safeParse(eingabe)
  if (!parsed.success) return { error: TEAM_TEXT.nichtImTeam }
  const { userId } = parsed.data
  const rechte = ADMIN_RECHTE.filter((r) => parsed.data.rechte.includes(r))

  const person = await prisma.$transaction(async (tx) => {
    await sperre(tx)
    const p = await personImTeam(tx, userId)
    if (!p) return null
    await tx.user.update({ where: { id: userId }, data: { adminRechte: rechte } })
    return p
  })
  if (!person) return { error: TEAM_TEXT.nichtImTeam }

  await protokolliere({ wer: frisch.userId, art: 'team_rechte_geaendert', bezugArt: 'person', bezugId: userId, mitPasskey: frisch.mitPasskey })
  nachDerAntwort(() => sagEsDerPerson(person, 'rechte', rechteWoerter({ adminInhaber: person.adminInhaber, adminRechte: rechte })))
  revalidiere()
  return { ok: true }
}

/** Inhaber machen bzw. entziehen. Entziehen nie beim letzten Inhaber — auch nicht bei sich selbst. */
export async function setzeInhaber(eingabe: unknown): Promise<Ergebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'team' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = teamInhaberSchema.safeParse(eingabe)
  if (!parsed.success) return { error: TEAM_TEXT.nichtImTeam }
  const { userId, inhaber } = parsed.data

  const ergebnis = await prisma.$transaction(async (tx): Promise<{ person: Person } | { error: string }> => {
    await sperre(tx)
    const p = await personImTeam(tx, userId)
    if (!p) return { error: TEAM_TEXT.nichtImTeam }
    if (!inhaber && letzterInhaber(p, await andereInhaber(tx, userId))) return { error: TEAM_TEXT.letzterInhaber }
    await tx.user.update({ where: { id: userId }, data: { adminInhaber: inhaber } })
    return { person: p }
  })
  if ('error' in ergebnis) return ergebnis

  const art: AdminAktionArt = inhaber ? 'team_inhaber_gesetzt' : 'team_inhaber_entzogen'
  await protokolliere({ wer: frisch.userId, art, bezugArt: 'person', bezugId: userId, mitPasskey: frisch.mitPasskey })
  const { person } = ergebnis
  nachDerAntwort(() => sagEsDerPerson(person, inhaber ? 'inhaber' : 'inhaber-entzogen', rechteWoerter({ adminInhaber: inhaber, adminRechte: person.adminRechte })))
  revalidiere()
  return { ok: true }
}

/**
 * Aus dem Team entfernen: `isAdmin = false`, Inhaber und Rechte leer,
 * `adminSeit` leer (eine neue Einladung beginnt ein neues Fenster). Der Zugang
 * endet sofort — die Wache liest das Recht bei jeder Anfrage frisch. Nie den
 * letzten Inhaber.
 */
export async function entfernePerson(eingabe: unknown): Promise<Ergebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'team' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = teamEntfernenSchema.safeParse(eingabe)
  if (!parsed.success) return { error: TEAM_TEXT.nichtImTeam }
  const { userId } = parsed.data

  const ergebnis = await prisma.$transaction(async (tx): Promise<{ person: Person } | { error: string }> => {
    await sperre(tx)
    const p = await personImTeam(tx, userId)
    if (!p) return { error: TEAM_TEXT.nichtImTeam }
    if (letzterInhaber(p, await andereInhaber(tx, userId))) return { error: TEAM_TEXT.letzterInhaber }
    await tx.user.update({ where: { id: userId }, data: { isAdmin: false, adminInhaber: false, adminRechte: [], adminSeit: null } })
    return { person: p }
  })
  if ('error' in ergebnis) return ergebnis

  await protokolliere({ wer: frisch.userId, art: 'team_entfernt', bezugArt: 'person', bezugId: userId, mitPasskey: frisch.mitPasskey })
  const { person } = ergebnis
  nachDerAntwort(() => sagEsDerPerson(person, 'entfernt', []))
  revalidiere()
  return { ok: true }
}
