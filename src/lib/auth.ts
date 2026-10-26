import * as Sentry from '@sentry/nextjs'
import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { emailOTP } from 'better-auth/plugins'
import { APIError, createAuthEndpoint, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api'
import { deleteSessionCookie, setSessionCookie } from 'better-auth/cookies'
import { passkey } from '@better-auth/passkey'
import { prisma } from '@/lib/prisma'
import { APP_URL, UMGEBUNG } from '@/lib/umgebung-server'
import {
  ANMELDECODE_PLUGIN_OPTIONEN,
  CODE_ANFORDERUNGEN_JE_ADRESSE,
  GESPERRTE_AUTH_PFADE,
  PASSWORT_LINK_SEKUNDEN,
  codeVersandErlaubt,
  istFehlversuch,
  rolleAusTreffern,
  zuVieleFehlversucheAntwort,
  type FehlversuchArt,
} from '@/lib/anmeldecode'
import { genauesIlikeMuster } from '@/lib/ilike-muster'
import { erzeugeAnforderungsSperre } from '@/lib/anmeldecode-sperre'
import {
  anmeldecodeGebremst,
  gibVersuchZurueck,
  loeschePasswortFehlversuche,
  zaehleAlsFehlversuch,
  zaehleVersuchVorab,
  type VorabVersuch,
} from '@/server/bremse-datenbank'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { GERAETE_COOKIE, GERAETE_COOKIE_OPTIONEN, einmalLinkZweck, geraetName } from '@/lib/geraete'
import { env } from '@/lib/env'
import { MARKE } from '@/lib/marke'
import { DB_BREMSEN, adressMerkmal, type DbBremse } from '@/lib/bremse-datenbank'
import { adminBremseVoll } from '@/server/admin-bremse'
import { AUTH_BREMSE_SPEICHER } from '@/server/auth-bremse'
import {
  ADMIN_ANMELDEN_FEHLER,
  ANMELDEART,
  EINRICHTUNGSCODE_ART,
  ERSATZCODE_ANMELDEN_PFAD,
  REGISTRIERUNG_GESPERRT,
  adminPasskeyWo,
  anmeldeartFuerPfad,
  istAdminPasskey,
  lokaleHerkunft,
  passkeyAdresse,
  registrierungsFall,
  type AdminSicherheitAnlass,
  type RegistrierungsFall,
} from '@/lib/admin-anmeldung'
import { ersatzcodeAnmeldenSchema, ersatzcodeHash, normalisiereErsatzcode } from '@/lib/ersatzcodes'
import { erkenneGeraet } from '@/server/geraete'
import { sendeRegistrierungsHinweis } from '@/server/registrierung-hinweis'
import { leereKontaktdatenNachFremdemPasswort } from '@/server/kontaktdaten-fremd'
import {
  BESTAETIGUNG_GESPERRTE_AUTH_PFADE,
  BESTAETIGUNG_GUELTIG_SEKUNDEN,
  REGISTRIERUNG_GESPERRTE_AUTH_PFADE,
  bestaetigungPerLinkErlaubt,
  bestaetigungsPfad,
} from '@/lib/email-bestaetigung'
import { passwordSchema } from '@/schemas/register'
import { sitzungAbgelaufen, sitzungRolle } from '@/lib/sitzung-dauer'

// Franz-tauglich: 10 Login-Versuche pro Minute pro IP sperren keinen echten
// Nutzer aus (auch nicht bei Tippfehlern), bremsen aber Passwort-Rater.
// Better-Auth wendet das Limit auf alle /api/auth/*-Endpunkte an.
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60
const AUTH_RATE_LIMIT_MAX = 10

// Höchstens 5 Anmeldecodes je Adresse in 15 Minuten (src/lib/anmeldecode.ts),
// je Instanz — gegen ein Postfach, das von vielen IPs aus zugeschüttet wird.
const codeAnforderungen = erzeugeAnforderungsSperre()

/**
 * „Passwort vergessen" je Adresse (Nr. 178): dieselben 5 in 15 Minuten wie
 * `codeAnforderungen`, aber über alle Instanzen in der Tabelle und
 * FAIL-CLOSED — antwortet die Datenbank nicht (Fehler oder 1,5 s), ist die
 * Adresse gebremst (adminBremseVoll). Gezählt wird jede Anfrage VOR jeder
 * Frage nach dem Konto: Eine unbekannte Adresse zählt und antwortet genauso
 * wie eine bekannte. Vorher bremste nur die IP — ein Postfach ließ sich von
 * vielen IPs aus mit Links zuschütten.
 */
export const PASSWORT_VERGESSEN_JE_ADRESSE: DbBremse = { zweck: 'passwort-vergessen-adresse', ...CODE_ANFORDERUNGEN_JE_ADRESSE }

/**
 * Die Rolle hinter einer Adresse, ohne Rücksicht auf Groß-/Kleinschreibung.
 * Better Auth schreibt Adressen klein, ältere oder von Hand angelegte Konten
 * können Großbuchstaben tragen — ein exakter Vergleich hielte einen Hof dann
 * für „unbekannt", schickte ihm einen Code und legte beim Anmelden ein
 * zweites Kundenkonto an. `null` = kein Konto.
 *
 * Genau diese Adresse, keine Platzhalter: Prisma macht aus dem Vergleich ein
 * ILIKE, in dem „_" und „%" sonst ein fremdes Konto träfen — ein Hof
 * „max_hof@…" hielte der Hook für die Kundin „max-hof@…" (die bis Nr. 17a
 * jeder per Checkout anlegen konnte), und der Code meldete den Hof an. ALLE Treffer
 * zählen (rolleAusTreffern), nicht der erste beliebige; das Betreiber-Recht
 * (isAdmin) zählt wie die Rolle ADMIN. Maskiert statt per $queryRaw mit
 * lower(): kein Roh-SQL ohne Not (TECH_STACK.md), typisiert über Prisma, und
 * dieselbe Funktion wie in der Bestellsuche (Nr. 14).
 */
async function rolleZurAdresse(email: string): Promise<string | null> {
  const treffer = await prisma.user.findMany({
    where: { email: { equals: genauesIlikeMuster(email), mode: 'insensitive' } },
    select: { role: true, isAdmin: true },
  })
  // /admin prüft isAdmin, nicht die Rolle (src/server/admin-wache.ts): Ein
  // Betreiber ohne Hof kann CUSTOMER sein und zählt hier trotzdem als Admin.
  return rolleAusTreffern(treffer.map((nutzer) => (nutzer.isAdmin ? 'ADMIN' : nutzer.role)))
}

/**
 * Die Adresse so, wie das emailOTP-Plugin sie liest: in JS klein geschrieben,
 * nicht getrimmt. Beide Hooks prüfen GENAU diese Form — das Kleinschreiben
 * darf nicht der Datenbank überlassen bleiben: JS macht aus dem Kelvin-
 * Zeichen (U+212A) ein „k", eine reine C-Collation nicht. Fragte der Hook
 * mit der getippten Form, hielte er einen Hof für unbekannt, den das Plugin
 * anschließend findet und anmeldet.
 */
function adresseWieDasPlugin(email: string): string {
  return email.toLowerCase()
}

/**
 * Meldet einen gescheiterten Code-Versand an Sentry — nur WAS schiefging,
 * nie Adresse oder Code. Der Text ist fest, vom Fehler geht nur seine Art
 * mit: Ein Datenbank- oder Resend-Fehlertext kann die Adresse tragen, und
 * der Adressfilter in src/lib/sentry-hygiene.ts (beforeSend) erkennt nicht
 * jede Schreibweise. Ohne Meldung bliebe eine Kundin still ohne Code.
 */
function meldeCodeVersandFehler(grund: 'resend_fehler' | 'nachlauf_fehler', err?: unknown): void {
  const kontext = { tags: { aufgabe: 'anmeldecode', grund } }
  if (err === undefined) {
    Sentry.captureMessage('Anmeldecode-Mail nicht verschickt', { level: 'error', ...kontext })
    return
  }
  const meldung = new Error('Anmeldecode-Mail nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, kontext)
}

/**
 * Meldet eine gescheiterte Bestätigungs-Mail (S3, Nr. 17b) — wie oben nur die
 * Art, nie Adresse oder Link (der Link trägt einen gültigen Token).
 */
function meldeBestaetigungsFehler(grund: 'resend_fehler' | 'nachlauf_fehler', err?: unknown): void {
  const kontext = { tags: { aufgabe: 'email-bestaetigung', grund } }
  if (err === undefined) {
    Sentry.captureMessage('Bestätigungs-Mail nicht verschickt', { level: 'error', ...kontext })
    return
  }
  const meldung = new Error('Bestätigungs-Mail nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, kontext)
}

/**
 * Dieselbe Antwort wie bei einem falschen Code — Form und Text so, wie das
 * emailOTP-Plugin sie wirft (EMAIL_OTP_ERROR_CODES.INVALID_OTP, nicht
 * exportiert). Wer eine Hof-Adresse probiert, soll nicht erfahren, dass sie
 * einem Hof gehört.
 */
function falscherCodeFehler(): APIError {
  return APIError.from('BAD_REQUEST', { code: 'INVALID_OTP', message: 'Invalid OTP' })
}

/**
 * Ein abgelaufener oder zu oft probierter Code antwortet wie ein falscher (E7,
 * Ergänzung; Nr. 112): Ein Hof bekommt nie einen Code — „OTP expired" oder
 * „Too many attempts" (403) verrieten sonst, dass für die Adresse einer lag,
 * also dass sie keinem Hof gehört. Über HTTP als fertige Antwort in der Form
 * von Better Auths Fehlerantwort: Einen in hooks.after geworfenen Fehler
 * nähme Better Auth nur als Körper, den Status behielte es vom Plugin
 * (dispatchAuthEndpoint → toResponse). Ohne Request (auth.api) geworfen.
 */
function alsFalscherCode(request: Request | undefined): Response {
  const fehler = falscherCodeFehler()
  if (!request) throw fehler
  return new Response(JSON.stringify(fehler.body), {
    status: fehler.statusCode,
    statusText: fehler.status.toString(),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * 429, wenn eine Adresse für Codes bzw. Passwörter pausiert ist (E7,
 * Ergänzung; Nr. 112): Satz mit Uhrzeit und Code fürs Formular
 * (src/lib/anmeldecode.ts). `bis: null` heißt, die Datenbank antwortete nicht
 * (fail-closed) — dann der allgemeine Satz ohne Uhrzeit, für jede Adresse gleich.
 */
function zuVieleFehlversucheFehler(art: FehlversuchArt, bis: Date | null): APIError {
  if (bis === null) return new APIError('TOO_MANY_REQUESTS', { message: 'Zu viele Anfragen.' })
  return new APIError('TOO_MANY_REQUESTS', zuVieleFehlversucheAntwort(art, bis, new Date()))
}

/**
 * Wessen Passwort gerade zurückgesetzt wird — hooks.before merkt es sich,
 * hooks.after löscht nach Erfolg den Zähler dieser Adresse. Danach steht der
 * Token nicht mehr in der Datenbank. Schlüssel ist `ctx.context`: Better Auth
 * legt es je Aufruf neu an und reicht dasselbe Objekt an beide Hooks
 * (dispatchAuthEndpoint); schwach gehalten, verschwindet es mit der Anfrage.
 * Belegt in tests/integration/code-bremse.int.test.ts.
 */
const adresseBeimZuruecksetzen = new WeakMap<object, string>()

/**
 * Der vorab gezählte Versuch einer Anmeldung mit Code bzw. Passwort —
 * hooks.before zählt ihn, hooks.after lässt ihn als Fehlversuch stehen oder
 * gibt ihn zurück. Schlüssel wie oben `ctx.context`. Wirft hooks.before oder
 * der Endpunkt etwas anderes als einen APIError, läuft hooks.after nicht
 * (dispatchAuthEndpoint): Der Versuch bleibt gezählt, zur sicheren Seite.
 */
const vorabGezaehlt = new WeakMap<object, VorabVersuch>()

/**
 * Die Geräte-Kennung nach einer erfolgreichen Anmeldung (E7, Ergänzung;
 * Nr. 114, src/server/geraete.ts): null = kein Cookie (Kundschaft). Scheitert
 * die Datenbank, bleibt die Anmeldung gültig — nur Gerät und Mail fallen aus,
 * gemeldet ohne Adresse und ohne Kennung (wie ein Nachlauf).
 */
async function geraeteKennungNachAnmeldung(userId: string, kennung: string | null, userAgent: string | null): Promise<string | null> {
  try {
    return (await erkenneGeraet({ userId, kennung, userAgent })).kennung
  } catch (err) {
    const meldung = new Error('Gerät nach der Anmeldung nicht erkannt')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { tags: { aufgabe: 'geraet-erkennen' } })
    return null
  }
}

// ── Admin nur mit Passkey (Register N20, Ergänzung Lauf 18; Nr. 115) ─────────

/**
 * rpID und Herkunft der Passkeys aus der App-Adresse, GESCHÜTZT bestimmt
 * (passkeyAdresse): Ist sie unlesbar oder fehlt sie, bleibt der Wert null,
 * hooks.before lehnt alle /passkey/*-Wege und die Anmeldung mit Ersatzcode mit
 * 503 ab, und alle anderen Anmeldungen laufen weiter — beim Laden dieser Datei
 * wirft nichts. Lokal (pnpm dev) ist appUrl fest localhost:3000; läuft der
 * Server auf einem anderen Port, nennt NEXT_PUBLIC_APP_URL ihn (nur
 * http://localhost:<Port>, nur lokal).
 */
const LOKALE_HERKUNFT = UMGEBUNG.art === 'lokal' ? lokaleHerkunft(process.env.NEXT_PUBLIC_APP_URL) : null
const PASSKEY_ADRESSE = passkeyAdresse(UMGEBUNG.appUrl, LOKALE_HERKUNFT)

/** Wie Better Auth bei falschem Passwort antwortet (BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD, nicht exportiert). */
function falschesPasswortFehler(): APIError {
  return APIError.from('UNAUTHORIZED', { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' })
}

/**
 * Hat die Adresse ein Konto mit Admin-Recht UND mindestens einem Passkey aus
 * der Admin-Einrichtung? Dann sind Passwort und „Passwort vergessen" gesperrt
 * (N20) — auch für seinen Hof. Ein Hof-Passkey von vor dem Admin-Recht zählt
 * nicht (istAdminPasskey, Nr. 179): Sonst wäre ein Hof, der Admin wird, ohne
 * Passwort und ohne gültigen Passkey ausgesperrt. Genau diese Adresse, alle
 * Treffer (wie rolleZurAdresse).
 */
async function adminMitPasskey(email: string): Promise<boolean> {
  const treffer = await prisma.user.findMany({
    where: { email: { equals: genauesIlikeMuster(email), mode: 'insensitive' }, isAdmin: true, passkeys: { some: {} } },
    select: { adminSeit: true, passkeys: { select: { createdAt: true } } },
  })
  return treffer.some((konto) => konto.passkeys.some((p) => istAdminPasskey(p.createdAt, konto.adminSeit)))
}

/**
 * Mail „Admin-Sicherheit" (Passkey hinzugefügt, Ersatzcode benutzt) nach der
 * Antwort — mit Gerät und Uhrzeit, ohne Link zum Anmelden. Wirft nie: Ein
 * Fehler geht ohne Adresse nach Sentry, die Anmeldung ist längst durch.
 */
async function meldeAdminSicherheit(userId: string, anlass: AdminSicherheitAnlass, userAgent: string | null, zeitpunkt: Date): Promise<void> {
  try {
    const konto = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (!konto) return
    const { sendAdminSicherheitEmail } = await import('@/lib/email')
    const ergebnis = await sendAdminSicherheitEmail(konto.email, anlass, { geraet: geraetName(userAgent), zeitpunkt })
    if (ergebnis.error && process.env.RESEND_API_KEY) {
      Sentry.captureMessage('Mail „Admin-Sicherheit" nicht verschickt', { level: 'error', tags: { aufgabe: 'admin-sicherheit', anlass, grund: 'resend_fehler' } })
    }
  } catch (err) {
    const meldung = new Error('Mail „Admin-Sicherheit" nicht verschickt')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { tags: { aufgabe: 'admin-sicherheit', anlass, grund: 'nachlauf_fehler' } })
  }
}

/**
 * Die Sitzung, die vor einer Anmeldung mit Passkey bestand (frische
 * Bestätigung): hooks.before merkt sie sich, hooks.after löscht sie nach
 * Erfolg — nur, wenn sie demselben Konto gehört. Schlüssel `ctx.context` wie
 * bei den Fehlversuchen oben.
 */
const sitzungVorPasskey = new WeakMap<object, { userId: string; sitzungId: string }>()

/** Die Sitzung, die gerade einen Passkey anlegt — hooks.after setzt danach `passkeyAm` (und schickt Admins die Mail). */
const sitzungBeimEinrichten = new WeakMap<object, { userId: string; sitzungId: string; fall: RegistrierungsFall }>()

type HookKontext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]

// ── Höchstdauer der Sitzung (Register S18; Nr. 178) ─────────────────────────

/** Was Better Auth beim Lesen einer Sitzung liefert — nur die Felder, die die Höchstdauer braucht. */
type GeleseneSitzung = { session: { id: string; userId: string; createdAt: Date | string }; user: { role?: unknown } }

function istGeleseneSitzung(wert: unknown): wert is GeleseneSitzung {
  if (typeof wert !== 'object' || wert === null || !('session' in wert) || !('user' in wert)) return false
  const sitzung = (wert as { session: unknown }).session
  return typeof sitzung === 'object' && sitzung !== null && 'createdAt' in sitzung && 'id' in sitzung && 'userId' in sitzung
}

/** Älter als erlaubt (30 Tage ab der Anmeldung, Konten mit der Rolle ADMIN 12 Stunden)? */
function sitzungZuAlt(gelesen: GeleseneSitzung, jetzt: Date): boolean {
  return sitzungAbgelaufen(new Date(gelesen.session.createdAt), jetzt, sitzungRolle(gelesen.user.role))
}

/** Löscht die Sitzung (Besitz in der WHERE) und das Sitzungs-Cookie der Antwort. */
async function beendeSitzung(ctx: HookKontext, gelesen: GeleseneSitzung): Promise<void> {
  await prisma.session.deleteMany({ where: { id: gelesen.session.id, userId: gelesen.session.userId } })
  deleteSessionCookie(ctx)
}

/**
 * Jeder Better-Auth-Weg außer `/get-session` (den prüft hooks.after, ohne
 * zweite Abfrage): Trägt die Anfrage ein Sitzungs-Cookie und ist die Sitzung
 * zu alt, fällt sie weg, bevor der Endpunkt sie liest — Passwort ändern,
 * Passkeys, Abmelden anderer Geräte sehen dann keine Sitzung (401), eine
 * Anmeldung läuft normal weiter. Ohne Cookie keine Abfrage.
 */
async function beendeZuAlteSitzung(ctx: HookKontext): Promise<void> {
  if (!ctx.getCookie(ctx.context.authCookies.sessionToken.name)) return
  const angemeldet = await getSessionFromCtx(ctx, { disableRefresh: true })
  if (!istGeleseneSitzung(angemeldet) || !sitzungZuAlt(angemeldet, new Date())) return
  await beendeSitzung(ctx, angemeldet)
  ctx.context.session = null
}

/**
 * Passwortregeln auf dem Server (Nr. 178): Zurücksetzen und Ändern prüfen
 * das neue Passwort mit derselben Regel wie die Registrierung
 * (`passwordSchema`, src/schemas/register.ts) — vorher prüfte der Server nur
 * die Länge, die übrigen Regeln standen nur im Browser. Meldung wie in der
 * Registrierung (die erste des Schemas). Vor dem Endpunkt: Ein schwaches
 * Passwort ändert nichts und verbraucht keinen Link.
 */
function pruefePasswortRegeln(ctx: HookKontext): void {
  const neu = (ctx.body as { newPassword?: unknown } | undefined)?.newPassword
  // Fehlt das Feld, lehnt Better Auth die Anfrage selbst ab (Body-Schema).
  if (typeof neu !== 'string') return
  const ergebnis = passwordSchema.safeParse(neu)
  if (!ergebnis.success) throw APIError.from('BAD_REQUEST', { code: 'PASSWORT_ZU_SCHWACH', message: ergebnis.error.issues[0].message })
}

/**
 * Darf diese Sitzung einen Passkey anlegen (Fälle a–c für Admins, `hof` für
 * Höfe ohne Admin-Recht; registrierungsFall)? Auf BEIDEN Registrierungs-
 * Pfaden, alles frisch aus der Datenbank: Recht, Rolle und `adminSeit`, Zahl
 * der Passkeys (bei Admins nur die aus der Admin-Einrichtung), Alter,
 * Anmeldeart und `passkeyAm` der Sitzung, der E-Mail-Code der Einrichtung in
 * dieser Sitzung. Sonst 403 mit neutralem Text. Das Plugin prüft danach seine
 * eigene Frische (1 Tag).
 */
async function pruefeRegistrierung(ctx: HookKontext): Promise<void> {
  const angemeldet = await getSessionFromCtx(ctx, { disableRefresh: true })
  if (!angemeldet) throw APIError.from('UNAUTHORIZED', { code: 'UNAUTHORIZED', message: 'Unauthorized' })
  const userId = angemeldet.user.id
  const sitzungId = angemeldet.session.id
  const [konto, sitzung, codes] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, role: true, adminSeit: true } }),
    prisma.session.findFirst({ where: { id: sitzungId, userId }, select: { createdAt: true, anmeldeart: true, passkeyAm: true } }),
    prisma.einmalLink.count({ where: { userId, zweck: einmalLinkZweck(EINRICHTUNGSCODE_ART, sitzungId), benutztAm: { not: null } } }),
  ])
  const passkeys = konto ? await prisma.passkey.count({ where: { userId, ...(konto.isAdmin ? adminPasskeyWo(konto.adminSeit) : {}) } }) : 0
  const fall =
    konto && sitzung
      ? registrierungsFall(
          {
            isAdmin: konto.isAdmin,
            rolle: konto.role,
            adminSeit: konto.adminSeit,
            passkeys,
            sitzung: { angemeldetAm: sitzung.createdAt, anmeldeart: sitzung.anmeldeart, passkeyAm: sitzung.passkeyAm },
            codeBestaetigt: codes > 0,
          },
          new Date()
        )
      : null
  if (fall === null) throw APIError.from('FORBIDDEN', { code: 'PASSKEY_NICHT_ERLAUBT', message: REGISTRIERUNG_GESPERRT })
  sitzungBeimEinrichten.set(ctx.context, { userId, sitzungId, fall })
}

/**
 * Frische Bestätigung = erneute Anmeldung mit Passkey (N20, Ergänzung Lauf
 * 18). Das Plugin legt bei jeder Anmeldung eine NEUE Sitzung an und fragt
 * nicht, wer vorher angemeldet war; `allowCredentials` beschränkt nur, was der
 * Browser anbietet. Darum hier: Gibt es eine Sitzung, muss der Passkey aus dem
 * Body (`response.id` = Passkey.credentialID) diesem Konto gehören — sonst
 * 401, bevor der Endpunkt läuft: keine neue Sitzung, kein neues Cookie, die
 * alte bleibt.
 */
async function pruefeBestaetigungMitPasskey(ctx: HookKontext): Promise<void> {
  const angemeldet = await getSessionFromCtx(ctx, { disableRefresh: true })
  if (!angemeldet) return
  const antwort = (ctx.body as { response?: { id?: unknown } } | undefined)?.response
  const credentialID = typeof antwort?.id === 'string' ? antwort.id : null
  const eigener = credentialID === null ? 0 : await prisma.passkey.count({ where: { credentialID, userId: angemeldet.user.id } })
  if (eigener === 0) throw APIError.from('UNAUTHORIZED', { code: 'PASSKEY_FREMDES_KONTO', message: ADMIN_ANMELDEN_FEHLER.fremdesKonto })
  sitzungVorPasskey.set(ctx.context, { userId: angemeldet.user.id, sitzungId: angemeldet.session.id })
}

/**
 * Anmeldung mit Ersatzcode (N20): ein eigener Endpunkt, damit Hooks,
 * Anmeldeart und Geräte-Kennung greifen wie beim Passkey-Plugin — die Sitzung
 * entsteht über internalAdapter.createSession + setSessionCookie. Gebremst je
 * Adresse (5 je Stunde, fail-closed, jeder Versuch zählt); der Code wird per
 * bedingtem Schreiben verbraucht (einmal gültig, auch bei zwei Tabs). Falscher
 * Code und unbekannte Adresse antworten gleich, und beide schreiben einmal.
 */
function adminErsatzcode() {
  return {
    id: 'admin-ersatzcode',
    endpoints: {
      anmeldenMitErsatzcode: createAuthEndpoint(
        ERSATZCODE_ANMELDEN_PFAD,
        { method: 'POST', body: ersatzcodeAnmeldenSchema },
        async (ctx) => {
          const { email, code } = ctx.body
          if (await adminBremseVoll(DB_BREMSEN.adminErsatzcode, adressMerkmal(email))) {
            throw APIError.from('TOO_MANY_REQUESTS', { code: 'ZU_VIELE_VERSUCHE', message: ADMIN_ANMELDEN_FEHLER.zuViele })
          }
          const konten = await prisma.user.findMany({
            where: { email: { equals: genauesIlikeMuster(email), mode: 'insensitive' }, isAdmin: true },
            select: { id: true },
          })
          // Zwei Konten zu einer Adresse gäbe es nur von Hand — dann keines.
          const userId = konten.length === 1 ? konten[0].id : null
          const jetzt = new Date()
          const hash = await ersatzcodeHash(env.BETTER_AUTH_SECRET, userId ?? '-', normalisiereErsatzcode(code) ?? code)
          const { count } = await prisma.adminErsatzcode.updateMany({
            where: { userId: userId ?? '-', codeHash: hash, benutztAm: null },
            data: { benutztAm: jetzt },
          })
          if (userId === null || count !== 1) {
            throw APIError.from('UNAUTHORIZED', { code: 'ERSATZCODE_FALSCH', message: ADMIN_ANMELDEN_FEHLER.ersatzcodeFalsch })
          }
          const sitzung = await ctx.context.internalAdapter.createSession(userId)
          const konto = await ctx.context.internalAdapter.findUserById(userId)
          if (!sitzung || !konto) throw APIError.from('INTERNAL_SERVER_ERROR', { code: 'SITZUNG_FEHLT', message: ADMIN_ANMELDEN_FEHLER.allgemein })
          await setSessionCookie(ctx, { session: sitzung, user: konto })
          const userAgent = ctx.headers?.get('user-agent') ?? null
          nachDerAntwort(() => meldeAdminSicherheit(userId, 'ersatzcode-benutzt', userAgent, jetzt))
          return ctx.json({ ok: true })
        }
      ),
    },
  } satisfies BetterAuthPlugin
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  rateLimit: {
    // nur in Produktion — lokales pnpm dev bleibt ungebremst
    enabled: process.env.NODE_ENV === 'production',
    window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
    // Zählt über alle Instanzen in RateLimitZaehler (Register R1, Ergänzung
    // Nr. 125). Antwortet die Datenbank nicht, zählt die Instanz für sich wie
    // vorher — nie offen (src/server/auth-bremse.ts).
    customStorage: AUTH_BREMSE_SPEICHER,
    customRules: {
      // KEIN Limit fürs Session-Lesen: Der Browser fragt get-session bei
      // vielen Seitenwechseln ab (useSession in Shells und Formularen); die
      // Routen-Wache (src/proxy.ts) prüft heute nur, ob das Cookie da ist,
      // ohne HTTP-Aufruf. Mit dem 10/min-Limit wäre ein Hof nach
      // wenigen Seitenwechseln ausgesperrt. Session-Lesen ist kein
      // Brute-Force-Ziel; Login/Registrierung behalten die 10/min.
      '/get-session': false,
    },
  },

  emailAndPassword: {
    enabled: true,
    // Bleibt false (S3): true sperrte das Anmelden unbestätigter Höfe. Was
    // bis zur Bestätigung gesperrt ist, steht bei emailVerification unten.
    requireEmailVerification: false,
    // Better-Auth-Default, jetzt sichtbar konfiguriert — muss zur Zod-Regel
    // min(8) in src/schemas/register.ts und zur Checkliste (password-rules) passen
    minPasswordLength: 8,
    // Dieselbe Zahl wie in der Reset-Mail, im Formular „Passwort vergessen“ und
    // bei „Das war ich nicht“ (PASSWORT_LINK_STUNDEN in src/lib/anmeldecode.ts)
    resetPasswordTokenExpiresIn: PASSWORT_LINK_SEKUNDEN,
    // Nach erfolgreichem Reset fliegen alle alten Sessions
    revokeSessionsOnPasswordReset: true,
    // Registrieren meldet nicht an (Register F6 „19b", Nachtlauf Nr. 27):
    // Damit antwortet Better Auth auf eine VERGEBENE Adresse wie bei Erfolg —
    // mit einem Scheinkonto ohne Datenbankzeile, nachdem es das Passwort
    // trotzdem gehasht hat (gleiche Rechenzeit). Ohne das warf signUpEmail
    // „schon vorhanden", und die Antwort verriet, wer ein Konto hat. Angemeldet
    // wird erst nach der Bestätigung per Link (/verify → Anmelden).
    autoSignIn: false,
    // Das bestehende Konto erfährt davon per Mail — nach der Antwort, damit
    // die Antwortzeit gleich bleibt; höchstens einmal je Fenster, Fehler ohne
    // Adresse nach Sentry (src/server/registrierung-hinweis.ts). Erreichbar
    // nur über registerFarmer: /sign-up/email ist über HTTP zu.
    onExistingUserSignUp: async ({ user }) => {
      nachDerAntwort(() => sendeRegistrierungsHinweis(user.id))
    },
    sendResetPassword: async ({ user, url }) => {
      // Erst NACH der Antwort (E7, Ergänzung; Nr. 112), wie der Anmeldecode:
      // Better Auth antwortet auf eine unbekannte Adresse ohne Mail — wartete
      // eine bekannte auf Rendern und Resend, verriete die Antwortzeit, wer ein
      // Konto hat. Antwort und Status sind für beide schon gleich.
      nachDerAntwort(async () => {
        try {
          const { sendPasswordResetEmail } = await import('@/lib/email')
          await sendPasswordResetEmail(user.email, url)
        } catch (err) {
          // Nur die Art des Fehlers — sein Text könnte die Adresse tragen.
          console.error('[Passwort-Reset] E-Mail-Fehler:', err instanceof Error ? err.name : 'unbekannt')
          // Der Fallback-Log enthält einen GÜLTIGEN Zugangs-Link samt Adresse —
          // er darf niemals in die Produktions-Logs (Vercel) gelangen.
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEV] Passwort-Reset für ${user.email}: ${url}`)
          }
        }
      })
    },
  },

  // E-Mail-Bestätigung für neue Höfe (S3, Nr. 17b). Anmelden bleibt ohne
  // Bestätigung möglich (requireEmailVerification oben bleibt false) — was bis
  // dahin gesperrt ist (Foto-Uploads, Freischaltung), entscheidet
  // src/lib/email-bestaetigung.ts nach dem frischen Stand in der Datenbank.
  // Der Token ist ein von Better Auth signierter JWT (keine ratbare ID). Die
  // Mail verlinkt /verify, nicht Better Auths GET /verify-email: Bestätigt
  // wird per Knopf (ARCHITECTURE §5), beide HTTP-Wege sind unten gesperrt.
  emailVerification: {
    // NICHT beim Sign-up: Da hat das Konto noch die Rolle CUSTOMER.
    // registerFarmer setzt erst FARMER und stößt dann den Versand an
    // (Nachbesserung Runde 1).
    sendOnSignUp: false,
    // Der Token beweist das Postfach, er meldet niemanden an.
    autoSignInAfterVerification: false,
    expiresIn: BESTAETIGUNG_GUELTIG_SEKUNDEN,
    // Der Link beweist nur die Adresse eines HOFS. Ein Kundinnen- oder
    // Betreiber-Konto bestätigt so nie — für Kundinnen zählt allein die
    // Code-Anmeldung (Pre-Hijacking, src/lib/email-bestaetigung.ts). Die
    // Rolle frisch aus der Datenbank; Werfen bricht das Bestätigen ab, bevor
    // Better Auth `emailVerified` schreibt.
    beforeEmailVerification: async (user) => {
      const konto = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } })
      if (!bestaetigungPerLinkErlaubt(konto?.role)) {
        throw APIError.from('FORBIDDEN', { code: 'NUR_HOEFE', message: 'Bestätigung per Link nur für Höfe' })
      }
    },
    sendVerificationEmail: async ({ user, token }) => {
      // Wie beim Anmeldecode erst NACH der Antwort: Registrieren soll nicht
      // auf Rendern und Resend warten, und ein Mailfehler darf die
      // Registrierung nicht scheitern lassen.
      nachDerAntwort(async () => {
        try {
          // Nur an Höfe — frisch aus der Datenbank. Kundinnen bekommen nie
          // eine Bestätigungs-Mail (sie könnten damit ein fremdes Konto
          // bestätigen), und jede Mail an eine beliebige Adresse schadet dem
          // Ruf der Absenderadresse.
          const konto = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } })
          if (!bestaetigungPerLinkErlaubt(konto?.role)) return
          const link = `${APP_URL}${bestaetigungsPfad(token)}`
          const { sendEmailBestaetigung } = await import('@/lib/email')
          const ergebnis = await sendEmailBestaetigung(user.email, link)
          if (ergebnis.error) meldeBestaetigungsFehler('resend_fehler')
          // Lokal ohne RESEND_API_KEY steht der Link im Terminal — sonst käme
          // niemand an ihn heran. Link und Adresse NIE in Produktions-Logs.
          if (!ergebnis.id && process.env.NODE_ENV !== 'production') {
            console.log(`[DEV] E-Mail-Bestätigung für ${user.email}: ${link}`)
          }
        } catch (err) {
          console.error('[E-Mail-Bestätigung] E-Mail-Fehler:', err instanceof Error ? err.name : 'unbekannt')
          meldeBestaetigungsFehler('nachlauf_fehler', err)
        }
      })
    },
  },

  // Was die App nicht anbietet, ist über HTTP gar nicht erreichbar: das
  // Anfordern neuer Magic Links (E7), die ungenutzten Code-Wege des
  // emailOTP-Plugins (Begründung je Pfad in src/lib/anmeldecode.ts) und
  // Better Auths eigene Wege der E-Mail-Bestätigung (src/lib/email-
  // bestaetigung.ts) — die ruft nur der Server über auth.api.
  // Registrieren mit Passwort nur über registerFarmer (auth.api).
  // Passkeys entfernen und umbenennen nur über src/server/actions/admin-
  // anmeldung.ts (frisch bestätigt, nie der letzte; N20, Nr. 115) bzw. für
  // Höfe über src/server/actions/hof-passkey.ts (Nr. 179) — die beiden Wege
  // des Plugins prüften nur den Besitz.
  disabledPaths: [
    ...GESPERRTE_AUTH_PFADE,
    ...BESTAETIGUNG_GESPERRTE_AUTH_PFADE,
    ...REGISTRIERUNG_GESPERRTE_AUTH_PFADE,
    '/passkey/delete-passkey',
    '/passkey/update-passkey',
  ],

  // ROLLEN-TRENNUNG (E7): Höfe und Admins melden sich NIE mit Code an. Das
  // muss vor dem Plugin passieren: Es legt den Code an, BEVOR es
  // sendVerificationOTP ruft, und /sign-in/email-otp fragt nach keiner Rolle.
  // Ein unterdrückter Mailversand allein hieße: Der Code liegt gültig in der
  // Datenbank, wer rät, ist als Hof angemeldet — und einem unbestätigten Hof
  // nähme Better Auth dabei das Passwort (revokeUnprovenAccountAccess).
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Höchstdauer der Sitzung (S18) vor allem anderen: Ein Endpunkt, der die
      // Sitzung liest, sieht eine zu alte nie.
      if (ctx.path !== '/get-session') await beendeZuAlteSitzung(ctx)
      // Admin nur mit Passkey (N20; Nr. 115): ohne lesbare App-Adresse keine
      // Passkeys und keine Ersatzcodes (503), alle anderen Anmeldungen laufen.
      if ((ctx.path.startsWith('/passkey/') || ctx.path === ERSATZCODE_ANMELDEN_PFAD) && PASSKEY_ADRESSE === null) {
        throw APIError.from('SERVICE_UNAVAILABLE', { code: 'PASSKEY_NICHT_VERFUEGBAR', message: ADMIN_ANMELDEN_FEHLER.nichtVerfuegbar })
      }
      if (ctx.path === '/passkey/generate-register-options' || ctx.path === '/passkey/verify-registration') {
        await pruefeRegistrierung(ctx)
        return
      }
      if (ctx.path === '/passkey/verify-authentication') {
        await pruefeBestaetigungMitPasskey(ctx)
        return
      }

      if (ctx.path === '/sign-in/email-otp') {
        // Zweite Stufe der IP-Bremse über alle Instanzen (Register R1); die
        // erste (Better Auth, 3 je Minute) ist schon gelaufen. Nur Produktion.
        if (await anmeldecodeGebremst('pruefen', ctx.headers, null)) {
          throw new APIError('TOO_MANY_REQUESTS', { message: 'Zu viele Anfragen.' })
        }
        const body = ctx.body as { email?: unknown } | undefined
        if (typeof body?.email !== 'string') return
        // Falsche Codes je Adresse (E7, Ergänzung; Nr. 112): Der Versuch
        // zählt VORAB, atomar; ist die Adresse pausiert, wird der Code gar
        // nicht erst geprüft. VOR der Rollenprüfung — ein Hof pausiert wie
        // eine Kundin oder eine Adresse, die es nicht gibt. Fail-closed
        // (src/server/bremse-datenbank.ts).
        const vorab = await zaehleVersuchVorab('code', body.email)
        if (vorab.gesperrt) throw zuVieleFehlversucheFehler('code', vorab.bis)
        // Antwort wie bei falschem Code — und gezählt wie einer: Sonst ließe
        // sich an der Zählung erkennen, welche Adresse ein Hof ist. Der Code
        // (falls einer liegt) bleibt unberührt und läuft nach 10 Minuten ab.
        if (!codeVersandErlaubt(await rolleZurAdresse(adresseWieDasPlugin(body.email)))) {
          zaehleAlsFehlversuch(vorab.versuch)
          throw falscherCodeFehler()
        }
        vorabGezaehlt.set(ctx.context, vorab.versuch)
        return
      }

      if (ctx.path === '/sign-in/email') {
        // Falsche Passwörter je Adresse (E7, Ergänzung; Nr. 112): Der Versuch
        // zählt VORAB, atomar; ist die Adresse pausiert, wird das Passwort
        // gar nicht erst geprüft — für jedes Konto und jede unbekannte Adresse
        // gleich. Stimmt es, gibt hooks.after den Versuch zurück. „Passwort
        // vergessen" bleibt offen.
        const body = ctx.body as { email?: unknown } | undefined
        if (typeof body?.email !== 'string') return
        const vorab = await zaehleVersuchVorab('passwort', body.email)
        if (vorab.gesperrt) throw zuVieleFehlversucheFehler('passwort', vorab.bis)
        // Admin mit Passkey (N20): antwortet wie ein falsches Passwort — und
        // zählt wie eines; das Hashen gleicht die Rechenzeit an. Der Hof
        // dieses Kontos ist nur noch mit Passkey erreichbar.
        if (await adminMitPasskey(body.email)) {
          const passwort = (ctx.body as { password?: unknown }).password
          await ctx.context.password.hash(typeof passwort === 'string' ? passwort : '')
          zaehleAlsFehlversuch(vorab.versuch)
          throw falschesPasswortFehler()
        }
        vorabGezaehlt.set(ctx.context, vorab.versuch)
        return
      }

      if (ctx.path === '/request-password-reset') {
        const email = (ctx.body as { email?: unknown } | undefined)?.email
        if (typeof email !== 'string') return
        // Je Adresse über alle Instanzen, fail-closed (Nr. 178) — vor der
        // Frage nach dem Konto, gleich für jede Adresse.
        if (await adminBremseVoll(PASSWORT_VERGESSEN_JE_ADRESSE, adressMerkmal(email))) {
          throw new APIError('TOO_MANY_REQUESTS', { message: 'Zu viele Anfragen.' })
        }
        // „Passwort vergessen" für einen Admin mit Passkey (N20): dieselbe
        // Antwort wie immer, aber kein Link — wie bei einer unbekannten
        // Adresse (Better Auth liest dort einmal ins Leere, hier auch).
        if (!(await adminMitPasskey(email))) return
        await ctx.context.internalAdapter.findVerificationValue('dummy-verification-token')
        return ctx.json({ status: true, message: 'If this email exists in our system, check your email for the reset link' })
      }

      if (ctx.path === '/change-password') {
        pruefePasswortRegeln(ctx)
        return
      }

      if (ctx.path === '/reset-password') {
        pruefePasswortRegeln(ctx)
        // Nur lesen, wessen Passwort es ist (adresseBeimZuruecksetzen); ob
        // der Token gilt, entscheidet Better Auth im Endpunkt.
        const token = (ctx.body as { token?: unknown } | undefined)?.token ?? ctx.query?.token
        if (typeof token !== 'string') return
        const eintrag = await ctx.context.internalAdapter.findVerificationValue(`reset-password:${token}`)
        const konto = eintrag ? await ctx.context.internalAdapter.findUserById(eintrag.value) : null
        if (konto) adresseBeimZuruecksetzen.set(ctx.context, konto.email)
        return
      }

      if (ctx.path !== '/email-otp/send-verification-otp') return
      // Nur die Anmeldung. Der Typ „forget-password" schickte sonst einem Hof
      // einen Code fürs Passwort, „email-verification" eine Bestätigung als
      // Code — bestätigt wird in dieser App nur über den Link (Nr. 17b).
      const body = ctx.body as { type?: unknown; email?: unknown } | undefined
      if (body?.type !== 'sign-in') {
        throw new APIError('BAD_REQUEST', { message: 'Unbekannte Anfrage.' })
      }
      if (typeof body.email !== 'string') return
      // Wie alle Speicher-Grenzen nur in Produktion (src/lib/rate-limit.ts).
      // Vor der Rollenprüfung: Ein Hof wird genauso gebremst wie eine Kundin.
      if (process.env.NODE_ENV === 'production' && !codeAnforderungen.erlaubt(body.email)) {
        throw new APIError('TOO_MANY_REQUESTS', { message: 'Zu viele Anfragen.' })
      }
      // Zweite Stufe über alle Instanzen (Register R1): je IP und je Adresse,
      // dieselben Grenzen; erst wenn der Speicher durchlässt. Fail-open.
      if (await anmeldecodeGebremst('anfordern', ctx.headers, body.email)) {
        throw new APIError('TOO_MANY_REQUESTS', { message: 'Zu viele Anfragen.' })
      }
      // Hof oder Admin: KEIN Code wird angelegt — der Hook antwortet selbst,
      // genau wie das Plugin bei einer Kundin ({ success: true }), und der
      // Endpunkt läuft gar nicht erst. Die Adresse geht so in die Abfrage,
      // wie das Plugin sie prüft (klein geschrieben, nicht getrimmt): Eine
      // Adresse, die das Plugin als ungültig ablehnte, soll auch hier nicht
      // anders antworten.
      const email = adresseWieDasPlugin(body.email)
      if (!codeVersandErlaubt(await rolleZurAdresse(email))) {
        // Ein Code aus der Zeit vor dieser Sperre verschwindet dabei — und
        // die Datenbank schreibt einmal, wie bei einer Kundin (Antwortzeit).
        await prisma.verification.deleteMany({ where: { identifier: `sign-in-otp-${email}` } })
        return ctx.json({ success: true })
      }
    }),
    // Nach dem Endpunkt, eine Weiche nach Pfad (weitere Fälle kommen dazu):
    // Fehlversuche (E7, Ergänzung; Nr. 112) — erst hier weiß Better Auth, ob
    // Code oder Passwort stimmte; ein Fehler steht als APIError in
    // `ctx.context.returned`. Der vorab gezählte Versuch bleibt nur bei einem
    // Fehlversuch stehen. Nach einem erfolgreichen Zurücksetzen fällt der
    // Passwort-Zähler der Adresse weg.
    after: createAuthMiddleware(async (ctx) => {
      // Angemeldet: Kennt das Konto dieses Gerät? (E7, Ergänzung; Nr. 114) —
      // gleich für Passwort, Code, Passkey und Ersatzcode.
      const merkeGeraet = async (neu: { user: { id: string }; session: { userAgent?: string | null } }): Promise<void> => {
        const kennung = await geraeteKennungNachAnmeldung(neu.user.id, ctx.getCookie(GERAETE_COOKIE), neu.session.userAgent ?? null)
        // Secure wie das Sitzungs-Cookie (https → ja, lokal über http nicht).
        const secure = ctx.context.authCookies.sessionToken.attributes.secure
        if (kennung !== null) ctx.setCookie(GERAETE_COOKIE, kennung, { ...GERAETE_COOKIE_OPTIONEN, secure })
      }
      switch (ctx.path) {
        // Höchstdauer (S18): Die Sitzung, die Better Auth eben gelesen hat,
        // ist zu alt → gelöscht samt Cookie, die Antwort ist „nicht
        // angemeldet". Seiten und Actions leiten wie bei jeder fehlenden
        // Sitzung zur passenden Anmeldung (Hof mit Rücksprung, Nr. 156).
        case '/get-session': {
          const gelesen = ctx.context.returned
          if (!istGeleseneSitzung(gelesen) || !sitzungZuAlt(gelesen, new Date())) return
          await beendeSitzung(ctx, gelesen)
          return ctx.json(null)
        }
        case '/sign-in/email-otp':
        case '/sign-in/email': {
          const versuch = vorabGezaehlt.get(ctx.context)
          if (versuch === undefined) return
          const antwort = ctx.context.returned
          // Angemeldet, oder gescheitert an etwas anderem (etwa einer
          // ungültigen Adresse): Der Versuch zählt nicht.
          if (!isAPIError(antwort) || !istFehlversuch(versuch.art, antwort.body?.code)) {
            await gibVersuchZurueck(versuch)
            const neu = ctx.context.newSession
            if (!isAPIError(antwort) && neu) await merkeGeraet(neu)
            return
          }
          zaehleAlsFehlversuch(versuch)
          // Von außen jeder gescheiterte Code wie ein falscher — wie beim Hof.
          if (versuch.art === 'code' && antwort.body?.code !== 'INVALID_OTP') return alsFalscherCode(ctx.request)
          return
        }
        case '/reset-password': {
          const email = adresseBeimZuruecksetzen.get(ctx.context)
          if (email !== undefined && !isAPIError(ctx.context.returned)) await loeschePasswortFehlversuche(email)
          return
        }
        // Anmeldung mit Passkey (N20; Nr. 115). War vorher jemand angemeldet
        // (frische Bestätigung), gehörte der Passkey diesem Konto (hooks.before)
        // — dessen alte Sitzung aus dem Cookie der Anfrage fällt weg: eine
        // Sitzung, frisch bestätigt, nie die eines anderen Kontos.
        case '/passkey/verify-authentication': {
          const neu = ctx.context.newSession
          if (isAPIError(ctx.context.returned) || !neu) return
          const vorher = sitzungVorPasskey.get(ctx.context)
          if (vorher && vorher.userId === neu.user.id && vorher.sitzungId !== neu.session.id) {
            await prisma.session.deleteMany({ where: { id: vorher.sitzungId, userId: neu.user.id } })
          }
          await merkeGeraet(neu)
          return
        }
        case ERSATZCODE_ANMELDEN_PFAD: {
          const neu = ctx.context.newSession
          if (!isAPIError(ctx.context.returned) && neu) await merkeGeraet(neu)
          return
        }
        // Passkey angelegt: Die Sitzung gilt als frisch bestätigt (so gehen
        // Ersatzcodes und zweiter Passkey direkt nach der Einrichtung), und ein
        // Admin-Konto bekommt eine Mail. Höfe bekommen keine: Die Mail spricht
        // vom Admin-Konto (Vorschlag im Bericht Nr. 179).
        case '/passkey/verify-registration': {
          const einrichtend = sitzungBeimEinrichten.get(ctx.context)
          if (isAPIError(ctx.context.returned) || !einrichtend) return
          const jetzt = new Date()
          await prisma.session.updateMany({ where: { id: einrichtend.sitzungId, userId: einrichtend.userId }, data: { passkeyAm: jetzt } })
          if (einrichtend.fall === 'hof') return
          const userAgent = ctx.headers?.get('user-agent') ?? null
          nachDerAntwort(() => meldeAdminSicherheit(einrichtend.userId, 'passkey-hinzugefuegt', userAgent, jetzt))
          return
        }
      }
    }),
  },

  // Name und Telefon aus FREMDEN Alt-Registrierungen (Register B3, Nr. 27):
  // Beim ersten Code eines unbestätigten Kontos löscht das emailOTP-Plugin
  // dessen Passwort-Konto (revokeUnprovenAccountAccess → deleteAccount →
  // dieser Hook, mit der Anfrage als Kontext), BEVOR es `emailVerified`
  // setzt. Ein solches Passwort stammt von jemandem, der die Adresse ohne
  // Postfach registriert hat — dann leeren wir auch Name und Telefon, die er
  // hinterlassen hat (src/server/kontaktdaten-fremd.ts). Ruhende Konten aus
  // dem alten Checkout haben kein Passwort und bleiben unberührt. Der Hook
  // gibt nie false zurück und wirft nie: Das Löschen des Passworts und die
  // Anmeldung laufen in jedem Fall weiter.
  databaseHooks: {
    // Wie die Sitzung entstand (N20; Nr. 115) — atomar mit ihr: Better Auth
    // reicht den Endpunkt-Kontext samt Pfad an den Hook (createWithHooks →
    // getCurrentAuthContext, wie bei account.delete unten). Passwort, Passkey
    // (dazu passkeyAm = jetzt) oder Ersatzcode; alle anderen Wege lassen beide
    // Felder leer.
    session: {
      create: {
        before: async (sitzung, kontext) => {
          const anmeldeart = anmeldeartFuerPfad(kontext?.path)
          if (anmeldeart === null) return
          return { data: { ...sitzung, anmeldeart, ...(anmeldeart === ANMELDEART.passkey ? { passkeyAm: new Date() } : {}) } }
        },
      },
    },
    account: {
      delete: {
        before: async (konto, kontext) => {
          await leereKontaktdatenNachFremdemPasswort(konto, kontext?.path)
        },
      },
    },
  },

  plugins: [
    // Kunden-Anmeldung mit Code aus der E-Mail (E7). Länge, Laufzeit,
    // Versuche und Bremsen stehen in src/lib/anmeldecode.ts; die Versuche
    // zählt das Plugin in der Verification-Tabelle — über alle Instanzen.
    emailOTP({
      ...ANMELDECODE_PLUGIN_OPTIONEN,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== 'sign-in') return
        // Die Mail erst NACH der Antwort (CODING_STANDARDS „nachDerAntwort"):
        // Sonst antwortete eine Kunden-Adresse um die Dauer von Rendern und
        // Resend langsamer als eine Hof-Adresse (die der Hook oben ohne Mail
        // beantwortet) — die Antwortzeit verriete, wer ein Hof ist. Better
        // Auth läuft im Routen-Handler (app/api/auth/[...all]), dort greift
        // after(); `advanced.backgroundTasks` hätte dasselbe geleistet, gälte
        // aber für alle Hintergrundaufgaben von Better Auth.
        nachDerAntwort(async () => {
          // Alles im try, auch die Rollenabfrage: Ein Fehler darf nicht als
          // unbehandelte Ablehnung in after() enden, sondern muss gemeldet
          // werden — sonst wartet eine Kundin auf einen Code, und niemand
          // erfährt davon.
          try {
            // Zweite Sicherung, falls der Hook je umgangen würde: kein Code
            // an einen Hof. (Der Hook legt für Höfe gar keinen an.)
            if (!codeVersandErlaubt(await rolleZurAdresse(email))) return
            const { sendAnmeldeCodeEmail } = await import('@/lib/email')
            const ergebnis = await sendAnmeldeCodeEmail(email, otp)
            // sendRaw wirft nie, ein Resend-Fehler kommt als { error } zurück.
            if (ergebnis.error) meldeCodeVersandFehler('resend_fehler')
            // Ohne Versand (lokal ohne RESEND_API_KEY) steht der Code im
            // Terminal, sonst käme niemand an ihn heran. Code und Adresse
            // dürfen NIE in die Produktions-Logs (Vercel) — auch nicht bei
            // einem Resend-Fehler.
            if (!ergebnis.id && process.env.NODE_ENV !== 'production') {
              console.log(`[DEV] Anmeldecode für ${email}: ${otp}`)
            }
          } catch (err) {
            // Nur die Art des Fehlers — sein Text könnte die Adresse tragen.
            console.error('[Anmeldecode] E-Mail-Fehler:', err instanceof Error ? err.name : 'unbekannt')
            meldeCodeVersandFehler('nachlauf_fehler', err)
          }
        })
      },
    }),
    // Kein Magic-Link-Plugin mehr (Nr. 178): Anfordern und Prüfen waren
    // seit Nr. 19b gesperrt, kein Weg erzeugte Links. Die beiden Pfade bleiben
    // zusätzlich in GESPERRTE_AUTH_PFADE (404, tests/integration/anmeldecode).
    // Admin nur mit Passkey (N20; Nr. 115), Höfe freiwillig zusätzlich zum
    // Passwort (E7-Ergänzung, Nr. 179). Nutzerprüfung (Fingerabdruck,
    // Gesicht oder PIN) beim Einrichten und bei jeder Anmeldung: Das Plugin
    // prüft beides mit requireUserVerification: false und fragt beim Anmelden
    // fest „preferred" — die beiden afterVerification sind die Sperre. Wirft
    // einer, entsteht kein Passkey bzw. keine Sitzung.
    passkey({
      rpID: PASSKEY_ADRESSE?.rpID,
      rpName: MARKE,
      origin: PASSKEY_ADRESSE?.origin ?? null,
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      registration: {
        afterVerification: async ({ ctx, verification }) => {
          if (verification.registrationInfo?.userVerified !== true) {
            throw APIError.from('FORBIDDEN', { code: 'NUTZERPRUEFUNG_FEHLT', message: ADMIN_ANMELDEN_FEHLER.nutzerpruefung })
          }
          // Nach einem Ersatzcode genau EIN neuer Passkey: Den Anspruch
          // verbraucht ein bedingtes Schreiben auf der Sitzung — zwei Tabs
          // legen so nie zwei an (der zweite findet keine Zeile mehr).
          const sitzung = ctx.context.session?.session
          if (!sitzung) throw APIError.from('UNAUTHORIZED', { code: 'UNAUTHORIZED', message: 'Unauthorized' })
          const art = await prisma.session.findUnique({ where: { id: sitzung.id }, select: { anmeldeart: true } })
          if (art?.anmeldeart === ANMELDEART.ersatzcode || art?.anmeldeart === ANMELDEART.ersatzcodeEingeloest) {
            const { count } = await prisma.session.updateMany({
              where: { id: sitzung.id, userId: sitzung.userId, anmeldeart: ANMELDEART.ersatzcode },
              data: { anmeldeart: ANMELDEART.ersatzcodeEingeloest },
            })
            if (count !== 1) throw APIError.from('FORBIDDEN', { code: 'PASSKEY_NICHT_ERLAUBT', message: REGISTRIERUNG_GESPERRT })
          }
          // Der Name in der Liste: Gerät und Browser in festen Wörtern, nie die volle Browserangabe.
          return { name: geraetName(ctx.headers?.get('user-agent') ?? null) }
        },
      },
      authentication: {
        afterVerification: async ({ verification, clientData }) => {
          if (verification.authenticationInfo.userVerified !== true) {
            throw APIError.from('UNAUTHORIZED', { code: 'NUTZERPRUEFUNG_FEHLT', message: ADMIN_ANMELDEN_FEHLER.nutzerpruefung })
          }
          // N20 bleibt bei einem Hof mit Admin-Recht (Nr. 179): Ein Hof-Passkey
          // von vor dem Recht ergibt keine Sitzung — sonst trüge sie passkeyAm
          // und öffnete den Admin-Bereich ohne die Admin-Bedingungen. Erst
          // hier, nach der Signatur: Der Satz geht nur an den Besitzer des Geräts.
          const passkey = await prisma.passkey.findUnique({
            where: { credentialID: clientData.id },
            select: { createdAt: true, user: { select: { isAdmin: true, adminSeit: true } } },
          })
          if (passkey?.user.isAdmin && !istAdminPasskey(passkey.createdAt, passkey.user.adminSeit)) {
            throw APIError.from('UNAUTHORIZED', { code: 'PASSKEY_NICHT_FUER_ADMIN', message: ADMIN_ANMELDEN_FEHLER.nichtFuerAdmin })
          }
        },
      },
    }),
    adminErsatzcode(),
  ],

  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'CUSTOMER',
        input: false,
      },
      phone: {
        type: 'string',
        required: false,
        input: true,
      },
    },
  },

  session: {
    // Admin-Anmeldung (N20; Nr. 115), gesetzt nur beim Anlegen der Sitzung
    // (databaseHooks oben) bzw. vom Server. input: false — /update-session
    // nimmt sie nie an, sonst hielte sich jeder selbst frisch bestätigt.
    additionalFields: {
      passkeyAm: { type: 'date', required: false, input: false },
      anmeldeart: { type: 'string', required: false, input: false },
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 Tage
    updateAge: 60 * 60 * 24,      // täglich auffrischen
    // … aber höchstens 30 Tage ab der Anmeldung (S18, Nr. 178): geprüft in
    // hooks.before/after über sitzungAbgelaufen (src/lib/sitzung-dauer.ts).
    // Kein Zwischenspeicher im Cookie (E7, Ergänzung; Nr. 114): Jede Prüfung
    // (auth.api.getSession, /get-session) liest Sitzung und Rolle frisch aus
    // der Datenbank — eine abgemeldete Sitzung gilt ab dem nächsten Klick
    // nicht mehr, auch in Actions, die die Sitzung direkt lesen. Vorher galt
    // sie bis zu 5 Minuten weiter. Kosten: zwei kurze Abfragen je Prüfung
    // (Sitzung über den Token, dann das Konto; ARCHITECTURE §5 „Sitzung frisch").
    cookieCache: {
      enabled: false,
    },
  },

  // Adresse und vertraute Herkünfte kommen aus der Umgebung (src/lib/umgebung.ts):
  // Produktion nur NEXT_PUBLIC_APP_URL, Previews ihre Vercel-Adressen, lokal
  // localhost. Vorher stand hier NEXT_PUBLIC_APP_URL mit localhost-Ersatz —
  // in Previews war das die Adresse eines fremden Rechners, der Login unmöglich.
  // Fehlt in Produktion die Adresse, bleibt baseURL leer und Better Auth
  // greift auf BETTER_AUTH_URL zurück; eine geratene Herkunft gibt es nicht.
  baseURL: UMGEBUNG.appUrl ?? undefined,
  // Lokal zusätzlich der eigene Port aus NEXT_PUBLIC_APP_URL (LOKALE_HERKUNFT,
  // nur http://localhost:<Port>) — sonst lehnte Better Auth jede Anmeldung im
  // Browser auf einem anderen Port als 3000 ab (Bild-Test mit Passkey).
  trustedOrigins: [...UMGEBUNG.trustedOrigins, ...(LOKALE_HERKUNFT ? [LOKALE_HERKUNFT] : [])],
})

export type Session = typeof auth.$Infer.Session
export type AuthUser = typeof auth.$Infer.Session.user
