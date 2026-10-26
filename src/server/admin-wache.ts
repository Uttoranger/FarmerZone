import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ADMIN_RECHT_FEHLER, darf, type AdminRecht } from '@/lib/admin-rechte'
import { einmalLinkZweck } from '@/lib/geraete'
import {
  ADMIN_AKTION_FEHLER,
  ADMIN_PFAD,
  EINRICHTUNGSCODE_ART,
  FRISCH_FEHLER,
  adminPasskeyWo,
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
 *    zwischen Unterseiten nicht neu. Die Pflichtseite prüft mit
 *    verlangeEinrichtenSeite, ihre Actions mit `ohnePasskey`, das Layout mit
 *    verlangeAdminShell (tests/admin-seiten-wache.test.ts).
 *  - Sitzung mit Passkey: Hat das Konto einen, muss auch DIESE Sitzung mit
 *    Passkey angemeldet oder bestätigt sein (`passkeyAm`) → sonst
 *    /login/admin, ohne sie zu löschen (der Hof bleibt erreichbar). Sonst
 *    öffnete eine Passwort-Sitzung von vor dem ersten Passkey (anderes Gerät,
 *    oder von vor dem Deploy) den Bereich bis zum Ende ihrer 12 Stunden.
 *  - Frische Bestätigung (`verlangeAdminAktion({ frisch: true })` bzw.
 *    verlangeFrischeBestaetigung): heikle Aktionen nur, wenn die letzte
 *    Bestätigung mit Passkey höchstens 5 Minuten zurückliegt.
 *
 * Rechte je Person (Register N35, Nr. 188) — zuletzt, nach Passkey und
 * Sitzung: `recht` nennt, was die Aktion bzw. Seite braucht; ohne `recht`
 * gilt nur „ansehen“ (das hat jede Person mit Admin-Recht). Was eine Person
 * darf, entscheidet `darf` (src/lib/admin-rechte.ts), gelesen frisch aus der
 * Datenbank in DERSELBEN Abfrage wie `isAdmin`. Ohne Recht: die Aktion
 * antwortet mit ADMIN_RECHT_FEHLER, die Seite leitet nach /admin.
 *
 * Für jede neue Admin-Aktion (Freigabe Lauf 26, §2):
 *   const wache = await verlangeAdminAktion({ frisch: true, recht: 'geld' })
 *   if ('error' in wache) return { error: wache.error }
 *   … Wirkung …
 *   await protokolliere({ wer: wache.userId, art, bezugArt, bezugId, grund, mitPasskey: wache.mitPasskey })
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
  /** Nur die Actions der Pflichtseite (/admin/einrichten): kein Passkey nötig. Die Seite selbst prüft mit verlangeEinrichtenSeite. */
  ohnePasskey?: true
  /** Was die Aktion bzw. Seite braucht (N35); ohne = nur „ansehen“. */
  recht?: AdminRecht
}

export type AdminAktionOptionen = AdminWacheOptionen & {
  /** Heikel (N20): nur frisch mit Passkey bestätigt (höchstens 5 Minuten), sonst `{ error: 'frisch' }`. */
  frisch?: true
}

/** Was eine Admin-Aktion von der Wache bekommt — `mitPasskey` geht so ins Protokoll (N33). */
export type AdminAktionErlaubt = { ok: true; userId: string; sitzungId: string; mitPasskey: boolean }

type Geprueft =
  | { art: 'abgemeldet' }
  | { art: 'kein-recht' }
  | { art: 'abgelaufen' }
  | { art: 'pflicht' }
  | { art: 'ohne-passkey' }
  | { art: 'ohne-recht' }
  | { art: 'ok'; userId: string; sitzungId: string; passkeyAm: Date | null }

/**
 * Ob für dieses Konto die Pflicht „erst Passkey" gilt — gelesen werden nur
 * die Zahl der Passkeys, der jüngste und der zuletzt benutzte Ersatzcode.
 * Es zählen nur Passkeys aus der Admin-Einrichtung (ab `adminSeit`,
 * adminPasskeyWo; Nr. 179): Ein Hof-Passkey von vor dem Recht erfüllt die
 * Pflicht nicht.
 */
export async function adminPflichtOffen(userId: string): Promise<boolean> {
  const konto = await prisma.user.findUnique({ where: { id: userId }, select: { adminSeit: true } })
  const [passkeys, ersatzcode] = await Promise.all([
    prisma.passkey.aggregate({ where: { userId, ...adminPasskeyWo(konto?.adminSeit ?? null) }, _count: { _all: true }, _max: { createdAt: true } }),
    prisma.adminErsatzcode.aggregate({ where: { userId, benutztAm: { not: null } }, _max: { benutztAm: true } }),
  ])
  return passkeyPflicht({
    anzahl: passkeys._count._all,
    juengsterPasskey: passkeys._max.createdAt,
    letzterErsatzcode: ersatzcode._max.benutztAm,
  })
}

/**
 * Was ohne `ohnePasskey` zusätzlich gilt (N20): zuerst die Pflicht des Kontos
 * (Einrichten geht vor), dann die Sitzung selbst. `passkeyAm` setzen nur die
 * Anmeldung mit Passkey und das Einrichten in dieser Sitzung (src/lib/auth.ts)
 * — also auch die Sitzung der Einrichtung und die nach Ersatzcode plus neuem
 * Passkey. Freigabe Lauf 18 Punkt 5: kein Admin-Inhalt im Browser einer
 * Sitzung ohne Passkey.
 */
async function passkeySperre(userId: string, passkeyAm: Date | null): Promise<'pflicht' | 'ohne-passkey' | null> {
  if (await adminPflichtOffen(userId)) return 'pflicht'
  return passkeyAm === null ? 'ohne-passkey' : null
}

async function pruefe(optionen: AdminWacheOptionen): Promise<Geprueft> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { art: 'abgemeldet' }
  const userId = session.user.id
  // Frisch aus der Datenbank, nie aus der Sitzung — Admin-Recht und Rechte je Person in EINER Abfrage.
  const konto = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, adminInhaber: true, adminRechte: true } })
  if (konto?.isAdmin !== true) return { art: 'kein-recht' }
  if (adminSitzungAbgelaufen(session.session.createdAt, new Date())) {
    // „Danach Abmelden" (N20): die eigene Sitzung, Besitz in der WHERE-Klausel.
    await prisma.session.deleteMany({ where: { id: session.session.id, userId } })
    return { art: 'abgelaufen' }
  }
  const passkeyAm = session.session.passkeyAm ?? null
  if (!optionen.ohnePasskey) {
    const sperre = await passkeySperre(userId, passkeyAm)
    if (sperre) return { art: sperre }
  }
  if (!darf({ adminInhaber: konto.adminInhaber === true, adminRechte: konto.adminRechte ?? [] }, optionen.recht ?? 'ansehen')) return { art: 'ohne-recht' }
  return { art: 'ok', userId, sitzungId: session.session.id, passkeyAm }
}

/** Wie eine Seite scheitert — kehrt nie zurück. */
function seiteScheitert(art: Exclude<Geprueft['art'], 'ok'>): never {
  switch (art) {
    case 'abgemeldet':
      redirect('/login')
    case 'kein-recht':
      notFound()
    case 'abgelaufen':
    case 'ohne-passkey':
      redirect(ADMIN_PFAD.anmelden)
    case 'pflicht':
      redirect(ADMIN_PFAD.einrichten)
    case 'ohne-recht':
      // Den Bereich kennt die Person — nur diese Seite nicht (N35): zurück zu „Heute“.
      redirect(ADMIN_PFAD.bereich)
  }
}

/**
 * Die Wache einer Admin-SEITE. Gibt die Nutzer-ID zurück oder kehrt nie
 * zurück: nicht angemeldet → `/login`, angemeldet ohne Recht → 404, Sitzung
 * älter als 12 Stunden → /login/admin, ohne Passkey → /admin/einrichten,
 * Sitzung ohne Passkey → /login/admin. Ohne Optionen: Keine Seite kommt um
 * die Pflicht herum, auch nicht aus Versehen.
 *
 * `notFound()` statt `redirect` oder 403: Der Bereich soll sich Unbefugten
 * nicht einmal zu erkennen geben — für sie existiert /admin schlicht nicht.
 */
export async function verlangeAdminSeite(optionen: { recht?: AdminRecht } = {}): Promise<string> {
  const geprueft = await pruefe({ recht: optionen.recht })
  if (geprueft.art !== 'ok') return seiteScheitert(geprueft.art)
  return geprueft.userId
}

/**
 * Die Wache der Pflichtseite /admin/einrichten: wie verlangeAdminSeite, nur
 * die offene Pflicht lässt sie durch — dort wird sie erledigt (kein Passkey,
 * oder nach einem Ersatzcode ohne neuen). Bei erledigter Pflicht verlangt sie
 * wie jede Admin-Seite `passkeyAm` der Sitzung (Ersatzcodes, zweiter Passkey),
 * sonst /login/admin: Eine Passwort-Sitzung von vor dem ersten Passkey sah
 * hier sonst den Zustand „eingerichtet" samt Admin-Kopf (sichter Runde 2;
 * Freigabe Lauf 18 Punkt 5). `pflicht` gibt sie mit, damit die Seite nicht
 * ein zweites Mal zählt.
 */
export async function verlangeEinrichtenSeite(): Promise<{ userId: string; pflicht: boolean }> {
  const geprueft = await pruefe({ ohnePasskey: true })
  if (geprueft.art !== 'ok') return seiteScheitert(geprueft.art)
  const sperre = await passkeySperre(geprueft.userId, geprueft.passkeyAm)
  if (sperre === 'ohne-passkey') return seiteScheitert(sperre)
  return { userId: geprueft.userId, pflicht: sperre === 'pflicht' }
}

/**
 * Die Wache des Layouts (ladeAdminbereich): scheitert wie jede Admin-Seite,
 * lässt aber Pflicht und Sitzung ohne Passkey durch — das Layout umhüllt auch
 * die Pflichtseite, die Umleitung macht die Seite —, sagt dazu, ob Kopf und
 * Zähler Daten zeigen dürfen: nur ohne
 * Pflicht und in einer Sitzung mit Passkey. Das Layout rendert parallel zur
 * Seite und wird vor ihrer Umleitung gestreamt; mit einer Abfrage der Sitzung.
 */
export async function verlangeAdminShell(): Promise<{ userId: string; inhaltOffen: boolean }> {
  const geprueft = await pruefe({ ohnePasskey: true })
  if (geprueft.art !== 'ok') return seiteScheitert(geprueft.art)
  return { userId: geprueft.userId, inhaltOffen: (await passkeySperre(geprueft.userId, geprueft.passkeyAm)) === null }
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
    case 'ohne-passkey':
      return { error: ADMIN_AKTION_FEHLER.ohnePasskey }
    case 'ohne-recht':
      return { error: ADMIN_RECHT_FEHLER }
  }
}

/**
 * Die Wache einer Admin-AKTION. Kein Wurf, sondern die Antwortform der
 * Server Actions ({ ok } | { error }) — der Aufrufer gibt den Satz an die
 * Oberfläche weiter, statt eine Navigation auszulösen.
 *
 * `recht` (N35): was die Aktion braucht; `frisch` (N20): heikel, nur frisch
 * mit Passkey bestätigt. `mitPasskey` sagt, ob die letzte Bestätigung mit
 * Passkey in diesem Moment frisch war — so steht es im Protokoll (N33).
 */
export async function verlangeAdminAktion(optionen: AdminAktionOptionen = {}): Promise<AdminAktionErlaubt | { error: string }> {
  const geprueft = await pruefe(optionen)
  if (geprueft.art !== 'ok') return alsAktionsFehler(geprueft.art)
  const mitPasskey = frischBestaetigt(geprueft.passkeyAm, new Date())
  if (optionen.frisch && !mitPasskey) return { error: FRISCH_FEHLER }
  return { ok: true, userId: geprueft.userId, sitzungId: geprueft.sitzungId, mitPasskey }
}

/**
 * Die Wache einer HEIKLEN Admin-Aktion (N20): erst alles von
 * verlangeAdminAktion, dann die frische Bestätigung — die letzte Anmeldung
 * mit Passkey (bzw. das Einrichten eines Passkeys) liegt höchstens 5 Minuten
 * zurück. Sonst `{ error: 'frisch' }`: useFrischBestaetigt
 * (src/components/admin/frisch-bestaetigen.tsx) öffnet dann den Dialog und
 * wiederholt die Aktion nach der Bestätigung genau einmal.
 *
 * Eine heikle Aktion ruft NUR diese Wache (Nr. 126): Sie fragt dieselbe
 * `pruefe()` wie verlangeAdminAktion und gibt `userId` und `sitzungId` mit —
 * eine zweite Wache dahinter läse dieselbe Datenbank noch einmal und könnte
 * nichts Neues sagen (tests/admin-heikel-eine-wache.test.ts).
 */
export async function verlangeFrischeBestaetigung(optionen: AdminWacheOptionen = {}): Promise<AdminAktionErlaubt | { error: string }> {
  // Dasselbe wie verlangeAdminAktion({ frisch: true, … }) — der Name bleibt für die Quelltext-Wachen der heiklen Aktionen.
  return verlangeAdminAktion({ ...optionen, frisch: true })
}

/**
 * Für die CSV-Exporte unter /admin (Route Handler, nach verlangeAdminAktion):
 * ohne frische Bestätigung 303 auf /admin/bestaetigen?weiter=<Pfad> — nur ein
 * relativer Pfad unter /admin (sichererWeiterPfad). null = weiter im Export.
 */
export async function frischOderBestaetigen(weiter: string, optionen: { recht?: AdminRecht } = {}): Promise<NextResponse | null> {
  const frisch = await verlangeFrischeBestaetigung({ recht: optionen.recht })
  if ('ok' in frisch) return null
  if (frisch.error === FRISCH_FEHLER) return new NextResponse(null, { status: 303, headers: { Location: bestaetigenAdresse(weiter) } })
  return new NextResponse('Kein Zugriff.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export type EinrichtenStand = {
  userId: string
  /** Wann das Admin-Recht vergeben wurde; null = leer (Einrichtung gesperrt). */
  adminSeit: Date | null
  /** Passkeys aus der Admin-Einrichtung (adminPasskeyWo). */
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
 * Sitzung. Nur nach verlangeEinrichtenSeite() aufrufen.
 */
export async function ladeEinrichtenStand(jetzt: Date): Promise<EinrichtenStand> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const userId = session.user.id
  const zweck = einmalLinkZweck(EINRICHTUNGSCODE_ART, session.session.id)
  const konto = await prisma.user.findUnique({ where: { id: userId }, select: { adminSeit: true } })
  const [passkeys, ersatzcodes, bestaetigt, offen] = await Promise.all([
    // Nur Passkeys aus der Admin-Einrichtung (Nr. 179) — ein Hof-Passkey ersetzt den ersten nicht.
    prisma.passkey.count({ where: { userId, ...adminPasskeyWo(konto?.adminSeit ?? null) } }),
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
