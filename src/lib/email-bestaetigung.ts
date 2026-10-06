/**
 * E-Mail-Bestätigung für neue Höfe (S3, Nachtlauf Nr. 17b) — Fachregeln, rein
 * und ohne Datenbank prüfbar (tests/email-bestaetigung.test.ts).
 *
 * Der Ablauf selbst gehört Better Auth (`emailVerification` in
 * src/lib/auth.ts): Token signieren (JWT mit BETTER_AUTH_SECRET, keine
 * ratbare ID), prüfen, `emailVerified` setzen. Hier steht, was FarmerZone
 * dabei festlegt — wer bestätigen muss (Stichtag), wohin der Link führt,
 * wie oft „Erneut senden" geht und was der Bauer liest.
 *
 * Bis zur Bestätigung gesperrt sind Foto-Uploads (src/app/api/upload/*) und
 * „Hof online stellen" — die Freischaltung durch den Betreiber
 * (approveFarmAction), denn einen anderen Weg in die Öffentlichkeit gibt es
 * nicht. Anmelden und Einrichten (Texte, Abholzeiten) bleiben erlaubt.
 * Entschieden wird immer nach dem FRISCHEN Stand in der Datenbank
 * (src/server/email-bestaetigung.ts), nie nach `session.user.emailVerified`
 * (Cookie-Cache, ARCHITECTURE §5).
 */

/**
 * Ab hier angelegte Konten müssen ihre Adresse bestätigen; ältere bleiben
 * unberührt, auch wenn sie unbestätigt sind (keine Datenänderung in
 * Produktion). Wiener Mitternacht.
 *
 * VOR DEM MERGE AUF DEN DEPLOY-TAG SETZEN (Bericht 17b, „Bitte entscheiden").
 * Der Nachtlauf hat ein Datum gewählt, das sicher nach dem 06.10.2026 liegt:
 * Liegt der Stichtag vor dem Deploy, müssten Konten aus der Zeit dazwischen
 * bestätigen, ohne je eine Mail bekommen zu haben (sie könnten sie nur neu
 * anfordern); liegt er danach, entkommen Konten aus der Zeit dazwischen der
 * Pflicht.
 */
export const EMAIL_BESTAETIGUNG_STICHTAG = new Date('2026-10-15T00:00:00+02:00')

/** So lange gilt der Link aus der Mail. Better Auth übernimmt den Wert (`expiresIn`). */
export const BESTAETIGUNG_GUELTIG_SEKUNDEN = 24 * 60 * 60

/**
 * Better Auths eigene Wege über HTTP — beide zu, nur der Server ruft sie auf
 * (`auth.api`, `disabledPaths` gilt nur für HTTP):
 * - `/verify-email` ist ein GET, der bestätigt. Ein Link aus einer Mail ändert
 *   nie einen Zustand (ARCHITECTURE §5): Link-Scanner rufen ihn ungefragt auf
 *   — wer fremde Adressen registriert, bekäme sie so vom Postfach des Opfers
 *   bestätigt. Die Mail führt auf /verify, dort bestätigt ein Knopf (POST).
 * - `/send-verification-email` schickt ohne Sitzung an jede unbestätigte
 *   Adresse, ohne Bremse über alle Instanzen. „Erneut senden" läuft über die
 *   Server Action mit Sitzung und Bremse in der Datenbank.
 */
export const BESTAETIGUNG_GESPERRTE_AUTH_PFADE = ['/verify-email', '/send-verification-email'] as const

/**
 * Wessen Adresse der Bestätigungs-Link beweisen darf: nur die eines Hofs
 * (Nachbesserung Runde 1). Für Kundinnen zählt als Beweis NUR die
 * Code-Anmeldung (E7, `adresseBestaetigt` in anmeldecode.ts) — sonst legte
 * jemand ein Passwort-Konto auf die Adresse einer Kundin an, die Kundin
 * klickte die Bestätigung, und das Konto des Fremden wäre bestätigt
 * (Pre-Hijacking: Abos auf /account, sein Passwort bliebe). Durchgesetzt beim
 * Versand (auth.ts, sendVerificationEmail) und beim Bestätigen
 * (beforeEmailVerification), beides nach der Rolle frisch aus der Datenbank.
 */
export function bestaetigungPerLinkErlaubt(rolle: string | null | undefined): boolean {
  return rolle === 'FARMER'
}

/**
 * Registrieren mit Passwort nur über den Server (Nachbesserung Runde 1): Der
 * einzige Weg ist `registerFarmer` (Honigtopf, Zeitschranke, Rolle FARMER)
 * über `auth.api.signUpEmail`. Offen hätte `/sign-up/email` jedem erlaubt,
 * ein Passwort-Konto (Rolle CUSTOMER) auf eine fremde Adresse anzulegen.
 * Eine Registrierung für Kundinnen mit Passwort gibt es nicht (E7).
 */
export const REGISTRIERUNG_GESPERRTE_AUTH_PFADE = ['/sign-up/email'] as const

export type BestaetigungsKonto = { createdAt: Date }

/** Muss dieses Konto bestätigen? Nur ab dem Stichtag angelegte. */
export function bestaetigungPflichtig(
  konto: BestaetigungsKonto,
  stichtag: Date = EMAIL_BESTAETIGUNG_STICHTAG
): boolean {
  return konto.createdAt.getTime() >= stichtag.getTime()
}

/**
 * Steht die Bestätigung noch aus? Pflichtig und nicht bestätigt — dann sind
 * Foto-Uploads und die Freischaltung gesperrt. Nur `true` gilt als bestätigt.
 */
export function bestaetigungOffen(
  konto: BestaetigungsKonto & { emailVerified: boolean | null | undefined },
  stichtag: Date = EMAIL_BESTAETIGUNG_STICHTAG
): boolean {
  return bestaetigungPflichtig(konto, stichtag) && konto.emailVerified !== true
}

/** Der Link aus der Mail: unsere Seite mit dem signierten Token, nie Better Auths GET-Pfad. */
export function bestaetigungsPfad(token: string): string {
  return `/verify?token=${encodeURIComponent(token)}`
}

/**
 * Die Bremse für „Erneut senden", je Konto und über alle Instanzen (die
 * Zeitpunkte stehen in der Verification-Tabelle, src/server/email-
 * bestaetigung.ts): 60 Sekunden Abstand — so lange wartet auch der Knopf
 * sichtbar — und höchstens 5 Mails in der Stunde. Mehr braucht niemand, der
 * auf eine Mail wartet; wer eine fremde Adresse registriert hat, kann ihr
 * Postfach damit nicht zuschütten.
 */
export const ERNEUT_SENDEN = { abstandSekunden: 60, hoechstensJeFenster: 5, fensterSekunden: 60 * 60 } as const

export type ErneutEntscheidung = { erlaubt: true; zeiten: number[] } | { erlaubt: false; warteSekunden: number }

/**
 * Darf jetzt noch eine Mail raus? `bisher` sind die Versandzeitpunkte (ms).
 * Erlaubt → `zeiten` ist der neue Stand zum Speichern (nur das laufende
 * Fenster plus jetzt). Ein Zeitpunkt in der Zukunft (Uhren zweier Instanzen)
 * zählt wie ein frischer.
 */
export function erneutSendenEntscheidung(bisher: readonly number[], jetztMs: number): ErneutEntscheidung {
  const fensterMs = ERNEUT_SENDEN.fensterSekunden * 1000
  const abstandMs = ERNEUT_SENDEN.abstandSekunden * 1000
  const imFenster = bisher.filter((t) => t > jetztMs - fensterMs).sort((a, b) => a - b)

  const letzter = imFenster.at(-1)
  if (letzter !== undefined && jetztMs - letzter < abstandMs) {
    return { erlaubt: false, warteSekunden: Math.ceil((letzter + abstandMs - jetztMs) / 1000) }
  }
  const erster = imFenster[0]
  if (erster !== undefined && imFenster.length >= ERNEUT_SENDEN.hoechstensJeFenster) {
    return { erlaubt: false, warteSekunden: Math.ceil((erster + fensterMs - jetztMs) / 1000) }
  }
  return { erlaubt: true, zeiten: [...imFenster, jetztMs] }
}

/** Ganze Sekunden bis zum nächsten erlaubten Versand; 0 = sofort. */
export function restWartezeitErneut(bisher: readonly number[], jetztMs: number): number {
  const e = erneutSendenEntscheidung(bisher, jetztMs)
  return e.erlaubt ? 0 : e.warteSekunden
}

/** Der gespeicherte Stand („1712…,1712…"). Fremddaten: Unlesbares fällt weg, nichts wirft. */
export function leseVersandZeiten(wert: string): number[] {
  return wert
    .split(',')
    .filter((teil) => /^\d{1,16}$/.test(teil))
    .map(Number)
}

export function schreibeVersandZeiten(zeiten: readonly number[]): string {
  return zeiten.map((t) => String(Math.trunc(t))).join(',')
}

/** Kennung der Zeile in der Verification-Tabelle — je Konto, nicht je Adresse. */
export function versandKennung(userId: string): string {
  return `email-bestaetigung-versand-${userId}`
}

function dauerInWorten(sekunden: number): string {
  if (sekunden < 120) return sekunden === 1 ? '1 Sekunde' : `${sekunden} Sekunden`
  const minuten = Math.ceil(sekunden / 60)
  return `${minuten} Minuten`
}

export function erneutWarteText(warteSekunden: number): string {
  return `Wir haben dir gerade eine E-Mail geschickt. Probier es in ${dauerInWorten(warteSekunden)} noch einmal.`
}

/** Fehlercode einer Better-Auth-Ablehnung (`APIError.body.code`), ohne die Klasse zu kennen. */
export function fehlerCodeVon(fehler: unknown): string | undefined {
  if (typeof fehler !== 'object' || fehler === null || !('body' in fehler)) return undefined
  const body = (fehler as { body?: unknown }).body
  if (typeof body !== 'object' || body === null || !('code' in body)) return undefined
  const code = (body as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

// ─── Texte (geduzt, ohne Fachwort, mit Ausweg) ──────────────────────────────

export const UPLOAD_GESPERRT_TEXT =
  'Fotos kannst du hochladen, sobald du deine E-Mail-Adresse bestätigt hast. Den Link dazu haben wir dir geschickt – unter „Hof einrichten“ kannst du ihn neu anfordern.'

/** Für den Betreiber im Admin — die Freischaltung wartet auf den Hof. */
export const FREISCHALTUNG_EMAIL_OFFEN_TEXT =
  'Dieser Hof hat seine E-Mail-Adresse noch nicht bestätigt. Freischalten geht erst danach.'

export const ERNEUT_KEINE_PFLICHT_TEXT = 'Für dein Konto ist keine Bestätigung nötig.'

export const ERNEUT_VERSAND_FEHLER_TEXT = 'Wir konnten dir gerade keine E-Mail schicken. Probier es gleich noch einmal.'

export const BESTAETIGEN_ABGELAUFEN_TEXT = `Der Link ist abgelaufen – er gilt ${BESTAETIGUNG_GUELTIG_SEKUNDEN / 3600} Stunden. Melde dich an und lass dir einen neuen schicken.`

export const BESTAETIGEN_UNGUELTIG_TEXT =
  'Mit diesem Link können wir deine E-Mail-Adresse nicht bestätigen. Nimm den Link aus der neuesten E-Mail oder lass dir einen neuen schicken.'
