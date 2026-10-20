import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdminUser } from '@/server/queries/admin'
import { einmalLinkZweck } from '@/lib/geraete'
import {
  ADMIN_AKTION_FEHLER,
  ADMIN_PFAD,
  EINRICHTUNGSCODE_ART,
  FRISCH_FEHLER,
  adminSitzungAbgelaufen,
  bestaetigenAdresse,
  frischBestaetigt,
  passkeyPflicht,
} from '@/lib/admin-anmeldung'

/**
 * Die Admin-Prüfung — EINE Stelle für Seiten und Aktionen.
 *
 * Vorher lag sie an vier Stellen und in zwei Fassungen: dreimal wortgleich in
 * den Admin-Seiten und einmal als privates `requireAdmin` in
 * src/server/actions/admin.ts, das `isAdminUser` nicht benutzte, sondern die
 * Abfrage selbst wiederholte. Zwei Implementierungen derselben Frage sind eine
 * Einladung, dass eine davon irgendwann anders antwortet — und die Frage
 * lautet „darf dieser Mensch die Plattform verwalten?".
 *
 * Das Admin-Recht wird IMMER frisch aus der Datenbank gelesen, nie aus der
 * Session: `isAdmin` steckt bewusst nicht in den Better-Auth-additionalFields,
 * damit ein zurückgenommenes Recht sofort greift und nicht bis zum Ablauf des
 * Session-Cookies weiterwirkt (isAdminUser in src/server/queries/admin.ts).
 *
 * Admin nur mit Passkey (Register N20, Ergänzung Lauf 18; Nr. 115) — nach dem
 * Recht, in dieser Reihenfolge:
 *  - 12 Stunden: Eine Sitzung, die älter ist, endet hier (abmelden, dann
 *    /login/admin). Kein „Gerät merken".
 *  - Pflicht: Ohne Passkey, oder nach einem Ersatzcode ohne neuen, bleibt der
 *    Admin-Bereich zu → /admin/einrichten. Die Prüfung sitzt in der Wache
 *    JEDER Seite, nicht nur im Layout: Das Layout rendert beim Wechsel
 *    zwischen Unterseiten nicht neu. `ohnePasskey` nur für das Layout und die
 *    Pflichtseite samt ihren Actions (tests/admin-seiten-wache.test.ts).
 *  - Frische Bestätigung (verlangeFrischeBestaetigung): heikle Aktionen nur,
 *    wenn die letzte Bestätigung mit Passkey höchstens 5 Minuten zurückliegt.
 *
 * Zwei Ausgänge, weil eine Seite und eine Aktion verschieden scheitern:
 * Die Seite wirft (`redirect`/`notFound`), die Aktion gibt einen Satz zurück.
 * Eine Seite schützt die Ansicht, eine Aktion schützt die Wirkung — beides
 * muss geprüft werden, nie nur eines.
 *
 * Kein `server-only`-Import: Die Datei lebt ohnehin nur hinter Server
 * Components und `'use server'`, und `next/navigation` bringt die Grenze mit.
 */

export type AdminWacheOptionen = {
  /** Nur Layout und Pflichtseite (/admin/einrichten) samt ihren Actions: kein Passkey nötig. */
  ohnePasskey?: true
}

type Geprueft =
  | { art: 'abgemeldet' }
  | { art: 'kein-recht' }
  | { art: 'abgelaufen' }
  | { art: 'pflicht' }
  | { art: 'ok'; userId: string; sitzungId: string; passkeyAm: Date | null }

/**
 * Ob für dieses Konto die Pflicht „erst Passkey" gilt — gelesen werden nur
 * die Zahl der Passkeys, der jüngste und der zuletzt benutzte Ersatzcode.
 */
export async function adminPflichtOffen(userId: string): Promise<boolean> {
  const [passkeys, ersatzcode] = await Promise.all([
    prisma.passkey.aggregate({ where: { userId }, _count: { _all: true }, _max: { createdAt: true } }),
    prisma.adminErsatzcode.aggregate({ where: { userId, benutztAm: { not: null } }, _max: { benutztAm: true } }),
  ])
  return passkeyPflicht({
    anzahl: passkeys._count._all,
    juengsterPasskey: passkeys._max.createdAt,
    letzterErsatzcode: ersatzcode._max.benutztAm,
  })
}

async function pruefe(optionen: AdminWacheOptionen): Promise<Geprueft> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { art: 'abgemeldet' }
  const userId = session.user.id
  if (!(await isAdminUser(userId))) return { art: 'kein-recht' }
  if (adminSitzungAbgelaufen(session.session.createdAt, new Date())) {
    // „Danach Abmelden" (N20): die eigene Sitzung, Besitz in der WHERE-Klausel.
    await prisma.session.deleteMany({ where: { id: session.session.id, userId } })
    return { art: 'abgelaufen' }
  }
  if (!optionen.ohnePasskey && (await adminPflichtOffen(userId))) return { art: 'pflicht' }
  return { art: 'ok', userId, sitzungId: session.session.id, passkeyAm: session.session.passkeyAm ?? null }
}

/**
 * Die Wache einer Admin-SEITE. Gibt die Nutzer-ID zurück oder kehrt nie
 * zurück: nicht angemeldet → `/login`, angemeldet ohne Recht → 404, Sitzung
 * älter als 12 Stunden → /login/admin, ohne Passkey → /admin/einrichten.
 *
 * `notFound()` statt `redirect` oder 403: Der Bereich soll sich Unbefugten
 * nicht einmal zu erkennen geben — für sie existiert /admin schlicht nicht.
 */
export async function verlangeAdminSeite(optionen: AdminWacheOptionen = {}): Promise<string> {
  const geprueft = await pruefe(optionen)
  switch (geprueft.art) {
    case 'abgemeldet':
      redirect('/login')
    case 'kein-recht':
      notFound()
    case 'abgelaufen':
      redirect(ADMIN_PFAD.anmelden)
    case 'pflicht':
      redirect(ADMIN_PFAD.einrichten)
    case 'ok':
      return geprueft.userId
  }
}

function alsAktionsFehler(art: Exclude<Geprueft['art'], 'ok'>): { error: string } {
  switch (art) {
    case 'abgemeldet':
      return { error: 'Nicht angemeldet.' }
    case 'kein-recht':
      return { error: 'Kein Zugriff.' }
    case 'abgelaufen':
      return { error: ADMIN_AKTION_FEHLER.abgelaufen }
    case 'pflicht':
      return { error: ADMIN_AKTION_FEHLER.pflicht }
  }
}

/**
 * Die Wache einer Admin-AKTION. Kein Wurf, sondern die Antwortform der
 * Server Actions ({ ok } | { error }) — der Aufrufer gibt den Satz an die
 * Oberfläche weiter, statt eine Navigation auszulösen.
 */
export async function verlangeAdminAktion(optionen: AdminWacheOptionen = {}): Promise<{ ok: true; userId: string } | { error: string }> {
  const geprueft = await pruefe(optionen)
  if (geprueft.art !== 'ok') return alsAktionsFehler(geprueft.art)
  return { ok: true, userId: geprueft.userId }
}

/**
 * Die Wache einer HEIKLEN Admin-Aktion (N20): erst alles von
 * verlangeAdminAktion, dann die frische Bestätigung — die letzte Anmeldung
 * mit Passkey (bzw. das Einrichten eines Passkeys) liegt höchstens 5 Minuten
 * zurück. Sonst `{ error: 'frisch' }`: useFrischBestaetigt
 * (src/components/admin/frisch-bestaetigen.tsx) öffnet dann den Dialog und
 * wiederholt die Aktion nach der Bestätigung genau einmal.
 */
export async function verlangeFrischeBestaetigung(
  optionen: AdminWacheOptionen = {}
): Promise<{ ok: true; userId: string; sitzungId: string } | { error: string }> {
  const geprueft = await pruefe(optionen)
  if (geprueft.art !== 'ok') return alsAktionsFehler(geprueft.art)
  if (!frischBestaetigt(geprueft.passkeyAm, new Date())) return { error: FRISCH_FEHLER }
  return { ok: true, userId: geprueft.userId, sitzungId: geprueft.sitzungId }
}

/**
 * Für die CSV-Exporte unter /admin (Route Handler, nach verlangeAdminAktion):
 * ohne frische Bestätigung 303 auf /admin/bestaetigen?weiter=<Pfad> — nur ein
 * relativer Pfad unter /admin (sichererWeiterPfad). null = weiter im Export.
 */
export async function frischOderBestaetigen(weiter: string): Promise<NextResponse | null> {
  const frisch = await verlangeFrischeBestaetigung()
  if ('ok' in frisch) return null
  if (frisch.error === FRISCH_FEHLER) return new NextResponse(null, { status: 303, headers: { Location: bestaetigenAdresse(weiter) } })
  return new NextResponse('Kein Zugriff.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export type EinrichtenStand = {
  userId: string
  /** Wann das Admin-Recht vergeben wurde; null = leer (Einrichtung gesperrt). */
  adminSeit: Date | null
  passkeys: number
  ersatzcodes: number
  sitzung: { id: string; angemeldetAm: Date; anmeldeart: string | null; passkeyAm: Date | null }
  /** Wann der E-Mail-Code der Einrichtung in dieser Sitzung bestätigt wurde; null = noch nicht. */
  codeBestaetigtAm: Date | null
  /** Ein unbenutzter, noch gültiger Code dieser Sitzung liegt bereit (Feld zeigen). */
  codeOffen: boolean
}

/**
 * Was die Pflichtseite zeigt — frisch aus der Datenbank, für die eigene
 * Sitzung. Nur nach `verlangeAdminSeite({ ohnePasskey: true })` aufrufen.
 */
export async function ladeEinrichtenStand(jetzt: Date): Promise<EinrichtenStand> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const userId = session.user.id
  const zweck = einmalLinkZweck(EINRICHTUNGSCODE_ART, session.session.id)
  const [konto, passkeys, ersatzcodes, bestaetigt, offen] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { adminSeit: true } }),
    prisma.passkey.count({ where: { userId } }),
    prisma.adminErsatzcode.count({ where: { userId, benutztAm: null } }),
    prisma.einmalLink.findFirst({ where: { userId, zweck, benutztAm: { not: null } }, select: { benutztAm: true }, orderBy: { benutztAm: 'desc' } }),
    prisma.einmalLink.count({ where: { userId, zweck, benutztAm: null, ablaufAm: { gt: jetzt } } }),
  ])
  return {
    userId,
    adminSeit: konto?.adminSeit ?? null,
    passkeys,
    ersatzcodes,
    sitzung: {
      id: session.session.id,
      angemeldetAm: session.session.createdAt,
      anmeldeart: session.session.anmeldeart ?? null,
      passkeyAm: session.session.passkeyAm ?? null,
    },
    codeBestaetigtAm: bestaetigt?.benutztAm ?? null,
    codeOffen: offen > 0,
  }
}
