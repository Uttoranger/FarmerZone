import * as Sentry from '@sentry/nextjs'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { getClientIp } from '@/lib/rate-limit'
import {
  DB_BREMSEN,
  DB_BREMSE_ZEITLIMIT_MS,
  ZU_VIELE_ANFRAGEN,
  adressMerkmal,
  bremsSchluessel,
  fensterBeginn,
  fensterEnde,
  innerhalbDerGrenze,
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

/** Fester Text, nur die Art des Fehlers und die Zwecke — nie Schlüssel oder Merkmal. */
function meldeBremsFehler(err: unknown, versuche: readonly Versuch[]): void {
  const meldung = new Error('Bremse über alle Instanzen nicht erreichbar')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, {
    level: 'warning',
    tags: {
      aufgabe: 'bremse-datenbank',
      grund: err instanceof BremseZeitlimit ? 'zeitlimit' : 'datenbank',
      zweck: [...new Set(versuche.map((v) => v.bremse.zweck))].join(','),
    },
  })
}

/**
 * Die zweite Stufe für einen Aufruf: true = erlaubt (und gezählt), false =
 * mindestens ein Merkmal ist über seiner Grenze. Alle Versuche werden
 * gezählt, auch wenn einer schon drüber ist (wie `enforceRateLimit`). Bei
 * Datenbankfehler oder Zeitlimit: true (fail-open, siehe Kopf).
 *
 * Gilt immer — ob nur in Produktion gebremst wird, entscheidet der Aufrufer
 * zusammen mit seiner ersten Stufe.
 */
export async function bremseUeberAlleInstanzen(versuche: readonly Versuch[], jetzt: Date = new Date()): Promise<boolean> {
  if (versuche.length === 0) return true
  try {
    const staende = await mitFrist(zaehleVersuche(versuche, jetzt), DB_BREMSE_ZEITLIMIT_MS)
    return staende.every((stand, i) => innerhalbDerGrenze(stand, versuche[i].bremse.max))
  } catch (err) {
    meldeBremsFehler(err, versuche)
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

/**
 * Für den täglichen Cron (api/cron/cleanup-reservations): Zeilen, deren
 * Fenster vorbei ist. Gelesen werden sie nie mehr — ein neues Fenster ist
 * eine neue Zeile.
 */
export async function raeumeBremsZaehlerAuf(jetzt: Date = new Date()): Promise<number> {
  const { count } = await prisma.rateLimitZaehler.deleteMany({ where: { ablauf: { lt: jetzt } } })
  return count
}
