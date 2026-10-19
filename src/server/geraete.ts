import { createHmac, randomBytes } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { APP_URL } from '@/lib/umgebung-server'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import {
  EINMAL_LINK_ART,
  EINMAL_TOKEN_BYTES,
  GERAETE_KENNUNG_BYTES,
  bezugAusZweck,
  einmalLinkAblauf,
  einmalLinkZweck,
  geraeteZeilen,
  geraetName,
  gueltigeGeraeteKennung,
  merktGeraete,
  nichtIchLink,
  type GeraeteZeile,
} from '@/lib/geraete'

/*
 * Angemeldete Geräte, Geräte-Kennung und Einmal-Links (Register E7,
 * Ergänzung Lauf 17; Nr. 114) — der Teil mit Datenbank und Geheimnis. Die
 * Regeln stehen in src/lib/geraete.ts.
 *
 * Schnittstellen auch für Nr. 115 (Admin-Anmeldung):
 *  - erkenneGeraet: nach jeder erfolgreichen Anmeldung (hooks.after in
 *    src/lib/auth.ts), gibt die Kennung fürs Cookie zurück.
 *  - erzeugeEinmalLink / leseEinmalLink / loeseEinmalLinkEin: ein Link, der
 *    einmal und bis zu einer Frist gilt, zweck = `<art>:<bezug>`.
 *  - ladeAngemeldeteGeraete: die Zeilen des Bausteins AngemeldeteGeraete.
 *
 * Kennung und Token stehen nie in der Datenbank, nie im Log, nie bei Sentry —
 * nur ihr HMAC mit dem Server-Geheimnis. Ein nackter Hash ginge auch (128 bzw.
 * 256 bit Zufall), mit Geheimnis ist es dasselbe Muster wie die Bremsen
 * (bremsSchluessel) und trennt die Verwendungen über das Präfix.
 */

function hmac(zweck: 'geraet' | 'einmal-link', wert: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET).update(`${zweck}:${wert}`).digest('hex')
}

export function geraeteKennungHash(kennung: string): string {
  return hmac('geraet', kennung)
}

export function einmalTokenHash(token: string): string {
  return hmac('einmal-link', token)
}

// ── Neues Gerät erkennen ────────────────────────────────────────────────────

/**
 * Nach einer erfolgreichen Anmeldung: Kennt das Konto dieses Gerät?
 *  - Kundschaft: nichts — kein Cookie, keine Zeile, keine Mail (`kennung: null`).
 *  - Hof oder Admin, Gerät bekannt: „zuletzt" auffrischen.
 *  - Hof oder Admin, Gerät neu: merken; hatte das Konto schon ein Gerät, geht
 *    nach der Antwort die Mail „Neue Anmeldung" hinaus. Das erste Gerät (nach
 *    dem Deploy oder der Registrierung) wird still gemerkt.
 * Fehlt die Kennung oder hat sie eine fremde Form, gibt es eine neue. Die
 * Kennung kommt bei jeder Anmeldung eines Hofs zurück: Das Cookie wird neu
 * gesetzt und hält damit wieder 400 Tage.
 *
 * Zwei gleichzeitige allererste Anmeldungen eines Kontos auf zwei Geräten
 * sehen beide „noch kein Gerät" — dann geht keine Mail. Das betrifft nur den
 * Moment nach dem Deploy und ist bewusst so einfach gehalten.
 */
export async function erkenneGeraet(eingabe: {
  userId: string
  kennung: string | null
  userAgent: string | null
  jetzt?: Date
}): Promise<{ kennung: string | null }> {
  const jetzt = eingabe.jetzt ?? new Date()
  const konto = await prisma.user.findUnique({
    where: { id: eingabe.userId },
    select: { role: true, isAdmin: true, email: true, farm: { select: { name: true } } },
  })
  if (!konto || !merktGeraete(konto)) return { kennung: null }

  const kennung = gueltigeGeraeteKennung(eingabe.kennung) ?? randomBytes(GERAETE_KENNUNG_BYTES).toString('base64url')
  const kennungHash = geraeteKennungHash(kennung)
  const bekannt = await prisma.bekanntesGeraet.updateMany({
    where: { userId: eingabe.userId, kennungHash },
    data: { zuletztAm: jetzt },
  })
  if (bekannt.count > 0) return { kennung }

  const vorher = await prisma.bekanntesGeraet.count({ where: { userId: eingabe.userId } })
  const name = geraetName(eingabe.userAgent)
  // Eindeutig je Konto und Kennung: Kommt eine zweite Anmeldung desselben
  // Geräts dazwischen, legt nur eine die Zeile an — und nur sie schickt.
  const neu = await prisma.bekanntesGeraet.createManyAndReturn({
    data: [{ userId: eingabe.userId, kennungHash, name, erstmalsAm: jetzt, zuletztAm: jetzt }],
    skipDuplicates: true,
    select: { id: true },
  })
  const geraet = neu[0]
  if (geraet && vorher > 0) {
    const empfaenger = { userId: eingabe.userId, email: konto.email, hofName: konto.farm?.name ?? null }
    nachDerAntwort(() => meldeNeueAnmeldung(empfaenger, { id: geraet.id, name, zeitpunkt: jetzt }))
  }
  return { kennung }
}

/**
 * Mail „Neue Anmeldung" mit dem Link „Das war ich nicht" — nach der Antwort.
 * Wirft nie: Ein Fehler geht ohne Adresse, Link oder Token nach Sentry (nur
 * die Art), die Anmeldung selbst ist längst durch.
 */
async function meldeNeueAnmeldung(
  an: { userId: string; email: string; hofName: string | null },
  geraet: { id: string; name: string; zeitpunkt: Date }
): Promise<void> {
  try {
    const token = await erzeugeEinmalLink({
      userId: an.userId,
      zweck: einmalLinkZweck(EINMAL_LINK_ART.nichtIch, geraet.id),
      jetzt: geraet.zeitpunkt,
    })
    const { sendNeueAnmeldungEmail } = await import('@/lib/email')
    // Ohne RESEND_API_KEY schreibt sendRaw nur Betreff und Empfänger ins Log —
    // der Link mit dem Token steht nie im Terminal oder in den Vercel-Logs.
    const ergebnis = await sendNeueAnmeldungEmail(an.email, {
      hof: an.hofName !== null,
      name: an.hofName,
      geraet: geraet.name,
      zeitpunkt: geraet.zeitpunkt,
      link: nichtIchLink(APP_URL, token),
    })
    // Ohne Schlüssel (lokal, Log-Modus) ist „nicht verschickt" gewollt, kein
    // Versandfehler; die Post-Sperre (Z3) antwortet ohnehin mit `gesperrt`.
    if (ergebnis.error && process.env.RESEND_API_KEY) meldeFehler('resend_fehler')
  } catch (err) {
    console.error('[Neue Anmeldung] Mail-Fehler:', err instanceof Error ? err.name : 'unbekannt')
    meldeFehler('nachlauf_fehler', err)
  }
}

function meldeFehler(grund: 'resend_fehler' | 'nachlauf_fehler', err?: unknown): void {
  const kontext = { tags: { aufgabe: 'neue-anmeldung', grund } }
  if (err === undefined) {
    Sentry.captureMessage('Mail „Neue Anmeldung" nicht verschickt', { level: 'error', ...kontext })
    return
  }
  const meldung = new Error('Mail „Neue Anmeldung" nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, kontext)
}

// ── Einmal-Links ────────────────────────────────────────────────────────────

/**
 * Legt einen Link an und gibt den Token zurück — der steht danach nur noch im
 * Link der Mail. Frist Standard 7 Tage (`tage`).
 */
export async function erzeugeEinmalLink(eingabe: { userId: string; zweck: string; jetzt: Date; tage?: number }): Promise<string> {
  const token = randomBytes(EINMAL_TOKEN_BYTES).toString('base64url')
  await prisma.einmalLink.create({
    data: {
      userId: eingabe.userId,
      zweck: eingabe.zweck,
      tokenHash: einmalTokenHash(token),
      ablaufAm: einmalLinkAblauf(eingabe.jetzt, eingabe.tage),
    },
  })
  return token
}

/** Der Zweck passt zur Art: genau die Art oder die Art mit einem Bezug nach „:". */
function zweckDerArt(art: string): Prisma.EinmalLinkWhereInput {
  return { OR: [{ zweck: art }, { zweck: { startsWith: `${art}:` } }] }
}

export type EinmalLinkTreffer = { userId: string; zweck: string }

/** Nur lesen (GET der Seite): gilt der Link noch? Ändert nichts. Frist beim Lesen. */
export async function leseEinmalLink(token: string, art: string, jetzt: Date): Promise<EinmalLinkTreffer | null> {
  return prisma.einmalLink.findFirst({
    where: { tokenHash: einmalTokenHash(token), benutztAm: null, ablaufAm: { gt: jetzt }, ...zweckDerArt(art) },
    select: { userId: true, zweck: true },
  })
}

/**
 * Löst den Link ein — genau einmal: EIN bedingtes Schreiben (noch nicht
 * benutzt, nicht abgelaufen, passende Art) setzt benutztAm und gibt die Zeile
 * zurück. Ein zweiter Klick, auch ein gleichzeitiger, findet nichts mehr.
 * Muster wie `bestaetigeEmpfaenger` (src/server/zustellung-bestaetigen.ts).
 * `db`: der Transaktions-Client, wenn das, was der Link auslöst, mit dem
 * Einlösen stehen oder fallen soll (scheitert es, bleibt der Link gültig).
 */
export async function loeseEinmalLinkEin(
  token: string,
  art: string,
  jetzt: Date,
  db: Pick<Prisma.TransactionClient, 'einmalLink'> = prisma
): Promise<EinmalLinkTreffer | null> {
  const [treffer] = await db.einmalLink.updateManyAndReturn({
    where: { tokenHash: einmalTokenHash(token), benutztAm: null, ablaufAm: { gt: jetzt }, ...zweckDerArt(art) },
    data: { benutztAm: jetzt },
    select: { userId: true, zweck: true },
  })
  return treffer ?? null
}

// ── „Das war ich nicht" ─────────────────────────────────────────────────────

export type NichtIchStand = { gueltig: false } | { gueltig: true; geraet: { name: string; erstmalsAm: Date } | null }

/** Was die Seite /sicherheit/nicht-ich beim Öffnen zeigt — nur lesen. */
export async function ladeNichtIch(token: string, jetzt: Date): Promise<NichtIchStand> {
  const link = await leseEinmalLink(token, EINMAL_LINK_ART.nichtIch, jetzt)
  if (!link) return { gueltig: false }
  const geraetId = bezugAusZweck(link.zweck, EINMAL_LINK_ART.nichtIch)
  const geraet = geraetId
    ? await prisma.bekanntesGeraet.findFirst({ where: { id: geraetId, userId: link.userId }, select: { name: true, erstmalsAm: true } })
    : null
  return { gueltig: true, geraet }
}

// ── Liste „Angemeldete Geräte" ──────────────────────────────────────────────

/**
 * Die gültigen Sitzungen des eigenen Kontos als Zeilen — gelesen werden nur
 * Kennung, Browserangabe und die beiden Zeitpunkte, nie Token oder IP.
 */
export async function ladeAngemeldeteGeraete(userId: string, aktuelleSitzungId: string, jetzt: Date): Promise<GeraeteZeile[]> {
  const sitzungen = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: jetzt } },
    select: { id: true, userAgent: true, createdAt: true, updatedAt: true },
  })
  return geraeteZeilen(sitzungen, aktuelleSitzungId, jetzt)
}
