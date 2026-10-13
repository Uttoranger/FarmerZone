/**
 * In welcher Umgebung läuft die App — und passt alles zusammen?
 *
 * Warum es das braucht: In Vercel-Previews waren NEXT_PUBLIC_APP_URL und
 * BETTER_AUTH_URL nicht gesetzt, Auth fiel auf localhost zurück, der Login war
 * dort unmöglich. Und niemand sah einer Preview an, dass sie eine ist. Hier
 * steht deshalb an EINER Stelle, was die Umgebung ist, welche Adressen ihr
 * gehören und ob Datenbank und Stripe zur Umgebung passen.
 *
 * Testumgebung (Register Z3, Nr. 43): test.agrilo.at ist eine Vorschau
 * des Branches staging mit eigener Adresse in NEXT_PUBLIC_APP_URL. In der
 * Vorschau gilt diese Adresse nur als reine https-Adresse und nie als die
 * der echten Seite. Die Produktion nimmt sie seit Nr. 56 als bereinigte
 * Herkunft (produktionsAdresse); lokal bleibt, wie es war.
 *
 * Rein: Die Werte kommen als Parameter, nie aus process.env — damit jede
 * Kombination ohne Vercel prüfbar ist. Der Serverzweig liegt in
 * umgebung-server.ts.
 *
 * Fail-closed in Richtung Produktion: Nur was EINDEUTIG Preview oder lokal
 * ist, zählt als Test. Alles Unbekannte ist Produktion — ein Testbanner vor
 * Kundinnen wäre der teurere Fehler als ein fehlendes Banner im Test.
 * (Der Sentry-Zweig in sentry-hygiene.ts entscheidet bewusst andersherum:
 * Unbekanntes landet dort als „development", weil dort Rauschen in der
 * Produktions-Ansicht der teurere Fehler ist. Zwei Fragen, zwei Antworten.)
 *
 * SICHERHEIT: Das Ergebnis trägt nur Etiketten. Nie eine Datenbank-Adresse,
 * nie einen Datenbank-Host, nie einen Schlüssel oder ein Stück davon — es
 * landet in einem Banner und in Sentry.
 */

export type UmgebungsArt = 'produktion' | 'preview' | 'lokal'
export type DatenbankArt = 'dev' | 'fremd'
export type StripeArt = 'test' | 'live' | 'fehlt'

/** Die Rohwerte, die die Entscheidung braucht — Namen wie in Vercel. */
export type UmgebungsWerte = {
  NODE_ENV?: string
  VERCEL_ENV?: string
  VERCEL_URL?: string
  VERCEL_BRANCH_URL?: string
  VERCEL_GIT_COMMIT_REF?: string
  NEXT_PUBLIC_APP_URL?: string
  /** Adresse der Testumgebung für „Zur Testumgebung" im Admin (Register Z3) — gesetzt nur in Production. */
  NEXT_PUBLIC_TESTUMGEBUNG_URL?: string
  DATABASE_URL?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_CONNECT_WEBHOOK_SECRET?: string
  /** Stichtag der Live-Schaltung (Register Z4): Online-Bestellungen davor sind Testzahlungen — gesetzt nur in Production. */
  STRIPE_LIVE_AB?: string
}

export type Umgebung = {
  art: UmgebungsArt
  /** Die Adresse, unter der die App erreichbar ist — null, wenn unbekannt. */
  appUrl: string | null
  /**
   * Herkünfte, denen Better Auth vertraut. Erzeugt wird nie ein Platzhalter
   * wie *.vercel.app. In der Produktion steht ein ungültiger Wert von
   * NEXT_PUBLIC_APP_URL aber roh hier (nie leer, siehe produktionsAdresse) —
   * trägt er „*" oder „?", liest Better Auth ihn als Muster. Er meldet sich
   * als Warnung (WARNUNG_APP_URL_UNGUELTIG, mit „*" oder „?"
   * WARNUNG_APP_URL_MUSTER; Register S16).
   */
  trustedOrigins: readonly string[]
  /**
   * Ziel von „Zur Testumgebung" im Admin (Register Z3) — null ohne gültige
   * Variable, bei der Adresse der echten Seite und in der Testumgebung selbst.
   */
  testumgebungUrl: string | null
  datenbank: DatenbankArt
  stripe: StripeArt
  /**
   * Läuft die App als Produktions-Deployment bei Vercel (`VERCEL_ENV=production`)?
   * Nur dort darf ein Live-Schlüssel den Stripe-Client starten (Modus-Wache,
   * src/lib/stripe-modus.ts) — `art` allein reicht dafür nicht, denn auch ein
   * lokaler Produktions-Build, Vitest und die CI zählen als „produktion".
   */
  vercelProduktion: boolean
  branch: string | null
  /**
   * Stichtag der Live-Schaltung (Register Z4, Nr. 55) — null ohne gültige
   * Variable. Online-Bestellungen davor sind Testzahlungen und zählen in den
   * Auswertungen nicht mit (src/lib/testzahlung.ts).
   */
  stripeLiveAb: Date | null
  /** Deutsche Sätze, wenn Umgebung und Anschlüsse sich widersprechen. */
  warnungen: readonly string[]
}

/** Die Supabase-Projektreferenz der Dev-Datenbank. Kein Geheimnis: Sie steht in
 *  jedem Hostnamen des Projekts. Alles andere gilt als fremd — auch Produktion. */
const DEV_DATENBANK_REFERENZ = 'pmshaubwpxzdupwhyvjj'

/** Die Supabase-Projektreferenz der PRODUKTIONS-Datenbank. Ebenso kein Geheimnis
 *  — nur hier notiert, damit die Testsperre sie NAMENTLICH ablehnen kann und die
 *  Fehlermeldung sagen darf, wohin gezeigt wurde. */
const PRODUKTION_DATENBANK_REFERENZ = 'zxwkhizjvpyporjteylr'

/** Hosts, die nur auf dem eigenen Rechner oder im CI-Container erreichbar sind.
 *  `postgres` ist der Dienstname einer Datenbank im selben Container-Netz
 *  (docker compose); die CI nutzt localhost, weil der Dienst dort auf den
 *  Runner gemappt ist. */
const TEST_DATENBANK_HOSTS = ['localhost', '127.0.0.1', 'postgres'] as const

const LOKALE_ADRESSE = 'http://localhost:3000'

function bereinigt(wert: string | undefined): string | undefined {
  const t = wert?.trim()
  return t ? t : undefined
}

/** Der Host der echten Seite (Register M1) — die EINE Stelle der
 *  Produktionsdomain. Kein Geheimnis: Er steht auf jedem Plakat, in jeder
 *  Hofadresse (agrilo.at/<hof>) und in den Kontaktadressen, die
 *  src/lib/support.ts daraus baut. Rein und ohne Einbindungen, darum auch im
 *  Browser verwendbar. */
export const PRODUKTION_HOST = 'agrilo.at'

/**
 * Die Adresse der echten Seite (Register Z3) — Ziel von „Zur echten Seite"
 * im Banner der Testumgebung.
 *
 * Eine Konstante und keine Variable, weil die Testumgebung keine Variable mit
 * dieser Adresse hat: Dort ist NEXT_PUBLIC_APP_URL die Testadresse, und eine
 * eigene Variable müsste der Mensch in jeder Vorschau pflegen.
 */
export const PRODUKTION_ADRESSE = `https://${PRODUKTION_HOST}`

/** Ist dieser (fertig normalisierte) Host die echte Seite — mit oder ohne www? */
function istEchterHost(host: string | null): boolean {
  return host === PRODUKTION_HOST || host === `www.${PRODUKTION_HOST}`
}

/**
 * Ist diese (fertig normalisierte) Herkunft die echte Seite — mit oder ohne
 * www, aber ohne Port? Better Auth vergleicht Herkünfte genau: Der Browser auf
 * der echten Seite sendet `https://agrilo.at`, eine Herkunft mit Port träfe
 * er nie, und die Anmeldung bräche still (Register S16, Nr. 70). Der
 * Standard-Port 443 fällt schon im URL-Parser weg.
 */
function istEchteHerkunft(herkunft: string): boolean {
  const url = new URL(herkunft)
  return url.port === '' && istEchterHost(url.hostname)
}

/** Ein Text als Adresse — oder null, wenn der URL-Parser ihn nicht nimmt. */
function alsUrl(roh: string): URL | null {
  try {
    return new URL(roh)
  } catch {
    return null
  }
}

/**
 * Schema, Host und Port einer https-Adresse als Herkunft — oder null: kein
 * https oder kein gültiger Host. Normalisiert über URL (Host klein, ohne
 * Schrägstrich am Ende), weil Better Auth Herkünfte genau vergleicht. Der
 * gemeinsame Kern von httpsHerkunft (Vorschau) und produktionsAdresse.
 */
function herkunftAus(url: URL): string | null {
  if (url.protocol !== 'https:') return null
  // Ein Punkt am Ende meint denselben Host — eine Schreibweise für Links.
  const host = url.hostname.endsWith('.') ? url.hostname.slice(0, -1) : url.hostname
  // Nur nichtleere Labels aus a–z, 0–9 und „-": Bleibt nach dem Normalisieren
  // ein Punkt am Ende („agrilo.at.."), ist es keine Herkunft (Nr. 43,
  // Runde 2). Ebenso fällt „*" heraus — WHATWG-URL ließe den Platzhalter stehen.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host)) return null
  return `https://${host}${url.port ? `:${url.port}` : ''}`
}

/**
 * Eine reine https-Herkunft wie „https://test.agrilo.at" — oder null.
 *
 * Nur Schema, Host und Port: kein Pfad, keine Abfrage, kein Anker, keine
 * Zugangsdaten — sonst null (die Vorschau nimmt dann ihre Vercel-Adresse).
 * Nur für Werte, die ein Mensch einträgt — die Vercel-Systemvariablen
 * bleiben, wie sie sind.
 */
export function httpsHerkunft(wert: string | undefined): string | null {
  const roh = bereinigt(wert)
  if (!roh) return null
  const url = alsUrl(roh)
  if (!url) return null
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null
  return herkunftAus(url)
}

/** „*" oder „?" im Wert: Better Auth läse ihn in trustedOrigins als Muster (Register S16). */
const MUSTER_ZEICHEN = /[*?]/

/**
 * NEXT_PUBLIC_APP_URL in der Produktion (Nr. 56) — anders als in der Vorschau
 * wird hier bereinigt statt abgelehnt, denn einen Ersatz gibt es nicht:
 * - eine https-Adresse mit gültigem Host wird zur reinen Herkunft — Pfad,
 *   Anker, Zugangsdaten und der Schrägstrich am Ende fallen weg (Better Auth
 *   vergleicht Herkünfte genau, Links in Mails hängen ihren Pfad an, und
 *   Zugangsdaten gehören in keinen Link); ein fremder Host gilt auch, meldet
 *   sich aber (bestimmeUmgebung, Register S16) — fremd ist auch die echte
 *   Seite mit Port;
 * - ein Wert mit „*" oder „?" ist ungültig, auch wenn sich eine Herkunft lesen
 *   ließe (Register S16, Nr. 64): Wer ein Muster einträgt, meint keine Adresse —
 *   bereinigt zu „https://agrilo.at" sähe der Fehler aus wie keiner;
 * - jeder ungültige Wert bleibt roh, NIE leer: Ein leerer Wert ließe APP_URL
 *   auf localhost fallen und mit ihr jeden Link in Mails. Er meldet sich als
 *   Warnung (bestimmeUmgebung);
 * - nichts eingetragen: null.
 */
export function produktionsAdresse(wert: string | undefined): { herkunft: string } | { roh: string } | null {
  const roh = bereinigt(wert)
  if (!roh) return null
  if (MUSTER_ZEICHEN.test(roh)) return { roh }
  const url = alsUrl(roh)
  const herkunft = url ? herkunftAus(url) : null
  return herkunft ? { herkunft } : { roh }
}

type AdressPruefung = { herkunft: string } | { problem: 'keine-https-adresse' | 'echte-seite' } | null

/**
 * Eine eingetragene Adresse prüfen: fehlt (null), taugt, oder warum nicht.
 *
 * Erst normalisieren, dann prüfen (Nr. 43, Runde 2): Geprüft wird die Herkunft,
 * die tatsächlich benutzt würde. Vorher lief die Prüfung auf dem Rohwert, und
 * „https://agrilo.at.." kam als „https://agrilo.at." durch — die echte
 * Seite mit Punkt am Ende.
 */
function pruefeAdresse(wert: string | undefined): AdressPruefung {
  const roh = bereinigt(wert)
  if (!roh) return null
  const herkunft = httpsHerkunft(roh)
  if (herkunft) return istEchterHost(new URL(herkunft).hostname) ? { problem: 'echte-seite' } : { herkunft }
  // Abgelehnt ist der Wert ohnehin. Meint er die echte Seite (http, Pfad,
  // Punkte am Ende, groß geschrieben), nennt die Warnung diesen schwereren Grund.
  return istEchterHost(hostOhnePunkteAmEnde(roh)) ? { problem: 'echte-seite' } : { problem: 'keine-https-adresse' }
}

/** Nur für die Wahl der Warnung bei einem abgelehnten Wert: Host klein, ohne alle Punkte am Ende. */
function hostOhnePunkteAmEnde(roh: string): string | null {
  try {
    return new URL(roh).hostname.toLowerCase().replace(/\.+$/, '')
  } catch {
    return null
  }
}

type StichtagPruefung = { ab: Date } | { problem: 'ohne-zeitzone' | 'ungueltig' } | null

// Ein ISO-Zeitpunkt MIT Zeitzone: Datum, „T", Uhrzeit (Sekunden und bis zu drei
// Stellen Bruchteil freiwillig), dann „Z" oder ±hh:mm. Die Teile werden selbst
// geprüft und gerechnet — Date.parse rechnet „30. Februar" still in den März um.
const ZEITPUNKT_MIT_ZONE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/
// Derselbe Zeitpunkt ohne Zeitzone (auch nur der Tag oder mit Leerzeichen) —
// nur, um der Warnung den häufigsten Fehler beim Namen zu geben.
const ZEITPUNKT_OHNE_ZONE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/

/**
 * Der Stichtag der Live-Schaltung aus STRIPE_LIVE_AB (Register Z4, Nr. 55):
 * fehlt (null), gilt, oder warum nicht.
 *
 * Nur ein ISO-Zeitpunkt MIT Zeitzone gilt, etwa „2026-11-02T21:00:00+01:00".
 * Ohne Zone wäre der Zeitpunkt auf Vercel UTC, in Wien also ein bis zwei
 * Stunden daneben — Online-Bestellungen dazwischen fielen auf die falsche
 * Seite. Was nicht gilt, wird ignoriert (Testzahlungen zählen mit wie vor
 * Nr. 55) und meldet sich als Warnung; den Start verhindert es nie.
 */
export function leseStripeLiveAb(wert: string | undefined): StichtagPruefung {
  const roh = bereinigt(wert)
  if (!roh) return null
  const teile = ZEITPUNKT_MIT_ZONE.exec(roh)
  if (!teile) return ZEITPUNKT_OHNE_ZONE.test(roh) ? { problem: 'ohne-zeitzone' } : { problem: 'ungueltig' }
  const [, j, mo, t, h, mi, s = '0', bruch = '0', zone, vorzeichen, zoneH = '0', zoneMin = '0'] = teile
  const [jahr, monat, tag, stunde, minute, sekunde] = [j, mo, t, h, mi, s].map(Number)
  const tageImMonat = new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
  const versatzMin = Number(zoneH) * 60 + Number(zoneMin)
  if (monat < 1 || monat > 12 || tag < 1 || tag > tageImMonat || stunde > 23 || minute > 59 || sekunde > 59) {
    return { problem: 'ungueltig' }
  }
  // Zeitzonen der Erde liegen zwischen −12:00 und +14:00 — alles darüber ist ein Tippfehler.
  const hoechstensMin = (vorzeichen === '-' ? 12 : 14) * 60
  if (Number(zoneMin) > 59 || versatzMin > hoechstensMin) return { problem: 'ungueltig' }
  const millis = Number(bruch.padEnd(3, '0'))
  const ortszeit = Date.UTC(jahr, monat - 1, tag, stunde, minute, sekunde, millis)
  const versatz = zone === 'Z' ? 0 : (vorzeichen === '-' ? -1 : 1) * versatzMin
  return { ab: new Date(ortszeit - versatz * 60_000) }
}

/**
 * Wie weit der Stichtag in der Zukunft liegen darf, bevor er sich meldet. Der
 * Mensch trägt den Beginn des Redeploys ein (docs/betrieb/stripe-live.md,
 * Schritt 4) — wenige Stunden voraus sind kein Fehler. Mehr als ein Tag riecht
 * nach falschem Jahr oder Monat.
 */
export const STICHTAG_ZUKUNFT_GRENZE_MS = 24 * 60 * 60 * 1000

/**
 * Liegt der Stichtag mehr als 24 Stunden nach `jetzt`? Dann nähme er still alle
 * Online-Umsätze bis dahin heraus — Heute, Kunden und die Admin-Hofliste
 * zeigen weniger, ohne Hinweiszeile. Der Stichtag gilt trotzdem; die Frage
 * entscheidet nur, ob gewarnt wird (`meldeUmgebungsWarnungen`,
 * src/lib/umgebung-server.ts). Gemessen zur Laufzeit, deshalb `jetzt` als
 * Parameter.
 */
export function stichtagWeitInDerZukunft(stripeLiveAb: Date | null, jetzt: Date): boolean {
  return stripeLiveAb !== null && stripeLiveAb.getTime() - jetzt.getTime() > STICHTAG_ZUKUNFT_GRENZE_MS
}

/** Die Warnung dazu — ohne den Wert, wie alle Warnungen hier. */
export const STICHTAG_ZUKUNFT_WARNUNG =
  'STRIPE_LIVE_AB liegt mehr als 24 Stunden in der Zukunft — bis dahin zählen alle Online-Bestellungen als Testzahlungen. Stimmen Jahr und Monat?'

const STICHTAG_WARNUNG = {
  'ohne-zeitzone':
    'STRIPE_LIVE_AB hat keine Zeitzone (etwa +01:00 am Ende) — die Variable gilt nicht, Testzahlungen zählen mit.',
  ungueltig:
    'STRIPE_LIVE_AB ist kein gültiger Zeitpunkt (Form 2026-11-02T21:00:00+01:00) — die Variable gilt nicht, Testzahlungen zählen mit.',
} as const

type DatenbankZiel = { host: string; benutzer: string }

/**
 * Host und Benutzername einer Datenbankadresse — die EINE Stelle, die eine
 * Verbindungsadresse zerlegt. Beide Allowlists darunter bauen darauf auf, damit
 * sie nicht getrennt voneinander driften.
 *
 * Der Benutzername zählt mit, weil beim Supabase-Pooler die Projektreferenz
 * NUR dort steht (postgres.<ref>@aws-…) und der Host sie nicht trägt.
 */
function zerlegeDatenbankUrl(databaseUrl: string | undefined): DatenbankZiel | null {
  const url = bereinigt(databaseUrl)
  if (!url) return null
  try {
    const geparst = new URL(url)
    return {
      host: geparst.hostname.toLowerCase(),
      benutzer: decodeURIComponent(geparst.username).toLowerCase(),
    }
  } catch {
    // Unlesbare Adresse: im Zweifel fremd.
    return null
  }
}

/**
 * Nur der Host einer Datenbankadresse, für Fehlermeldungen.
 *
 * SICHERHEIT: gibt NIEMALS Benutzer, Passwort, Port oder Datenbanknamen heraus.
 * Eine Abbruchmeldung soll sagen, WOHIN gezeigt wurde, ohne die Zugangsdaten in
 * ein Terminal oder ein CI-Protokoll zu schreiben.
 */
export function datenbankHost(databaseUrl: string | undefined): string {
  return zerlegeDatenbankUrl(databaseUrl)?.host ?? '(keine lesbare Adresse)'
}

/**
 * Sieht der Benutzername wie der eines GEHOSTETEN Supabase-Projekts aus?
 *
 * Beim Pooler lautet er `postgres.<projektreferenz>` — ein Punkt im
 * Benutzernamen ist das verlässliche Merkmal, unabhängig davon, welches Projekt
 * dahintersteht. Lokale Rollen heißen `postgres` oder `<name>`, ohne Punkt.
 *
 * Dadurch greift die Testsperre auch bei einem Projekt, dessen Referenz hier
 * nicht notiert ist — die namentliche Prüfung darunter ist nur die Zugabe, die
 * eine klare Meldung erlaubt.
 */
export function zeigtAufGehostetesProjekt(databaseUrl: string | undefined): boolean {
  const ziel = zerlegeDatenbankUrl(databaseUrl)
  return ziel ? ziel.benutzer.includes('.') : false
}

/** Welche bekannte Fern-Datenbank eine Adresse anspricht — null, wenn keine. */
export function erkannteFernDatenbank(
  databaseUrl: string | undefined
): 'produktion' | 'dev' | null {
  const ziel = zerlegeDatenbankUrl(databaseUrl)
  if (!ziel) return null
  const zeigtAuf = (referenz: string) =>
    ziel.host.includes(referenz) || ziel.benutzer.includes(referenz)
  if (zeigtAuf(PRODUKTION_DATENBANK_REFERENZ)) return 'produktion'
  if (zeigtAuf(DEV_DATENBANK_REFERENZ)) return 'dev'
  return null
}

/**
 * Zeigt DATABASE_URL auf die Dev-Datenbank?
 *
 * Allowlist, keine Blocklist: „dev" nur bei localhost oder der bekannten
 * Projektreferenz. Alles andere gilt als fremd — auch Produktion.
 *
 * Eigener Export, damit der Seed sich damit sperren kann: Er darf nie gegen
 * eine fremde Datenbank laufen (prisma/seed.ts).
 */
export function istDevDatenbank(databaseUrl: string | undefined): boolean {
  const ziel = zerlegeDatenbankUrl(databaseUrl)
  if (!ziel) return false
  if (ziel.host.includes('localhost') || ziel.host === '127.0.0.1') return true
  return erkannteFernDatenbank(databaseUrl) === 'dev'
}

/**
 * Zeigt eine Adresse auf eine Datenbank, die ein Test LEEREN und BESCHREIBEN darf?
 *
 * Die zweite Allowlist, strenger als die erste: Die Integrationstests legen an,
 * ändern und löschen. Sie dürfen deshalb nicht einmal die Dev-Datenbank treffen.
 *
 * Drei Bedingungen, alle nötig:
 *  1. Der Host ist EXAKT einer der lokalen Hosts. Exakt, nicht `includes` —
 *     „db.localhost.example.com" ist ein fremder Rechner.
 *  2. Der Benutzername sieht nicht nach einem gehosteten Projekt aus. Ein Tunnel
 *     auf localhost mit `postgres.<ref>` als Benutzer zeigt auf eine echte
 *     Datenbank; Bedingung 1 allein ließe ihn durch. Diese Regel ist generisch
 *     und hält auch bei einem Projekt, dessen Referenz hier nicht steht.
 *  3. Keine bekannte Projektreferenz in Host oder Benutzernamen.
 */
export function istTestDatenbank(databaseUrl: string | undefined): boolean {
  const ziel = zerlegeDatenbankUrl(databaseUrl)
  if (!ziel) return false
  if (!TEST_DATENBANK_HOSTS.some((h) => h === ziel.host)) return false
  if (zeigtAufGehostetesProjekt(databaseUrl)) return false
  return erkannteFernDatenbank(databaseUrl) === null
}

/**
 * Nur das Präfix zählt — der Schlüssel selbst verlässt diese Funktion nicht.
 * Eingeschränkte Schlüssel (`rk_…`) zählen wie ihre vollen Geschwister: Auch
 * ein `rk_live_` kann echtes Geld bewegen (Nr. 42, Runde 1).
 */
function stripeArt(schluessel: string | undefined): StripeArt {
  const s = bereinigt(schluessel)
  if (!s) return 'fehlt'
  if (s.startsWith('sk_test_') || s.startsWith('rk_test_')) return 'test'
  if (s.startsWith('sk_live_') || s.startsWith('rk_live_')) return 'live'
  return 'fehlt'
}

function umgebungsArt(werte: UmgebungsWerte): UmgebungsArt {
  // VERCEL_ENV ist das genauere Signal und geht vor: Auf Vercel ist NODE_ENV
  // in Previews ohnehin „production".
  if (werte.VERCEL_ENV === 'preview') return 'preview'
  if (werte.NODE_ENV === 'development') return 'lokal'
  return 'produktion'
}

/**
 * Die Warnung bei einem Live-Schlüssel in der Vorschau — aus einer Quelle,
 * damit Banner und Test dasselbe sagen. Sie beschreibt, was die Modus-Wache
 * tut (src/lib/stripe-modus.ts, Nr. 42): Außerhalb des Produktions-Deployments
 * startet Stripe mit Live-Schlüssel nicht. Bis Nr. 43 stand hier „echte
 * Zahlungen möglich" — seit der Wache nicht mehr wahr.
 */
export const WARNUNG_LIVE_IN_VORSCHAU =
  'Live-Schlüssel in der Vorschau — Stripe startet nicht, Online-Zahlungen sind gesperrt. Bitte einen Test-Schlüssel eintragen.'

/**
 * Die Warnungen zur Adresse der Produktion (Nr. 56). Feste Sätze, nie der
 * Wert: Sie gehen an Sentry (meldeUmgebungsWarnungen, einmal je Instanz).
 */
export const WARNUNG_APP_URL_UNGUELTIG =
  'NEXT_PUBLIC_APP_URL ist keine reine https-Adresse — Anmeldung und Links in Mails nehmen den Wert, wie er ist.'
export const WARNUNG_APP_URL_FEHLT = 'NEXT_PUBLIC_APP_URL fehlt — Links in Mails führen auf localhost.'
/** Register S16: ein Wert mit „*" oder „?" (roh, für Better Auth ein Muster). */
export const WARNUNG_APP_URL_MUSTER =
  'NEXT_PUBLIC_APP_URL enthält „*" oder „?" — Better Auth liest den Wert als Muster, Anmeldung und Links in Mails nehmen ihn, wie er ist.'
/** Register S16: eine https-Herkunft, die nicht die echte Seite ist — angenommen, aber gemeldet. */
export const WARNUNG_APP_URL_FREMDER_HOST = `NEXT_PUBLIC_APP_URL zeigt nicht auf ${PRODUKTION_HOST} — Anmeldung und Links in Mails führen auf eine andere Adresse.`

export function bestimmeUmgebung(werte: UmgebungsWerte): Umgebung {
  const art = umgebungsArt(werte)
  // NEXT_PUBLIC_APP_URL: In der Vorschau zählt sie nur als geprüfte reine
  // https-Adresse, die Produktion nimmt sie bereinigt (seit Nr. 56), lokal
  // gar nicht.
  const vorschauAdresse = art === 'preview' ? pruefeAdresse(werte.NEXT_PUBLIC_APP_URL) : null
  const produktion = art === 'produktion' ? produktionsAdresse(werte.NEXT_PUBLIC_APP_URL) : null

  let trustedOrigins: string[]
  switch (art) {
    case 'preview': {
      // Die eigene Adresse der Testumgebung zuerst (Register Z3): Beim Branch
      // staging steht dort https://test.agrilo.at, und Links in Mails,
      // Stripe-Rücksprünge und Better Auth sollen dorthin führen. Nur eine
      // reine https-Adresse und nie die echte Seite — wäre die Variable für
      // alle Vorschauen angelegt, schickte sonst jede Vorschau ihre Links in
      // die Produktion (dann Warnung im Banner, siehe unten).
      const eigene = vorschauAdresse && 'herkunft' in vorschauAdresse ? [vorschauAdresse.herkunft] : []
      // Danach die Branch-Adresse: Sie bleibt über Deploys hinweg gleich und
      // taugt deshalb als appUrl in Links. Die Deploy-Adresse zusätzlich, weil
      // der Browser auch unter ihr aufruft.
      const branchUrl = bereinigt(werte.VERCEL_BRANCH_URL)
      const deployUrl = bereinigt(werte.VERCEL_URL)
      const vercel = [branchUrl, deployUrl]
        .filter((h): h is string => Boolean(h))
        .map((h) => `https://${h}`)
      trustedOrigins = [...new Set([...eigene, ...vercel])]
      break
    }
    case 'lokal':
      trustedOrigins = [LOKALE_ADRESSE]
      break
    case 'produktion': {
      // Nur die eingetragene Adresse, seit Nr. 56 als bereinigte Herkunft
      // (ein ungültiger Wert roh, siehe produktionsAdresse — mit „*" oder „?"
      // darin ist er für Better Auth ein Muster; ein fremder Host gilt, meldet
      // sich aber, Register S16). Fehlt sie, gibt
      // es KEINEN Ersatz — eine geratene Herkunft wäre ein Sicherheitsloch,
      // kein Komfort. Eine Vercel-Adresse kommt auch hier nie dazu.
      trustedOrigins = produktion ? ['herkunft' in produktion ? produktion.herkunft : produktion.roh] : []
      break
    }
  }
  const appUrl = trustedOrigins[0] ?? null

  const datenbank: DatenbankArt = istDevDatenbank(werte.DATABASE_URL) ? 'dev' : 'fremd'
  const stripe = stripeArt(werte.STRIPE_SECRET_KEY)
  // Wörtlich, ohne Trimmen: Vercel setzt den Wert selbst, und fail-closed
  // heißt hier, dass nur genau „production" zählt (Modus-Wache).
  const vercelProduktion = werte.VERCEL_ENV === 'production'
  const branch = bereinigt(werte.VERCEL_GIT_COMMIT_REF) ?? null

  // Der Link zur Testumgebung (Register Z3): nie auf die echte Seite und nie
  // auf sich selbst — in der Testumgebung führt er nirgendwohin.
  const testumgebung = pruefeAdresse(werte.NEXT_PUBLIC_TESTUMGEBUNG_URL)
  const testumgebungUrl =
    testumgebung && 'herkunft' in testumgebung && testumgebung.herkunft !== appUrl ? testumgebung.herkunft : null

  // Der Stichtag der Live-Schaltung (Register Z4): nur mit Zeitzone, sonst keiner.
  const stichtag = leseStripeLiveAb(werte.STRIPE_LIVE_AB)
  const stripeLiveAb = stichtag && 'ab' in stichtag ? stichtag.ab : null

  const warnungen: string[] = []
  if (art === 'preview') {
    if (vorschauAdresse && 'problem' in vorschauAdresse) {
      warnungen.push(
        vorschauAdresse.problem === 'echte-seite'
          ? 'NEXT_PUBLIC_APP_URL zeigt auf die echte Seite — die Vorschau nimmt ihre Vercel-Adresse.'
          : 'NEXT_PUBLIC_APP_URL ist keine reine https-Adresse — die Vorschau nimmt ihre Vercel-Adresse.'
      )
    }
    if (datenbank === 'fremd') warnungen.push('Fremde Datenbank — das ist nicht die Dev-Datenbank.')
    if (stripe === 'live') warnungen.push(WARNUNG_LIVE_IN_VORSCHAU)
    if (!appUrl) {
      warnungen.push('Keine Vercel-Adresse bekannt — der Login kann so nicht funktionieren.')
    }
  }
  if (art === 'produktion') {
    if (!produktion) warnungen.push(WARNUNG_APP_URL_FEHLT)
    else if ('roh' in produktion) warnungen.push(MUSTER_ZEICHEN.test(produktion.roh) ? WARNUNG_APP_URL_MUSTER : WARNUNG_APP_URL_UNGUELTIG)
    else if (!istEchteHerkunft(produktion.herkunft)) warnungen.push(WARNUNG_APP_URL_FREMDER_HOST)
    if (datenbank === 'dev') warnungen.push('Produktion läuft gegen die Dev-Datenbank.')
    if (stripe === 'test') warnungen.push('Stripe TEST in Produktion — keine echten Zahlungen möglich.')
    // Ohne Connect-Endpunkt kommt account.updated nie an: Sperrt Stripe ein
    // Hof-Konto, bietet der Checkout Online weiter an — und ein frisch
    // angebundener Hof wird nie „bereit" (src/lib/stripe-konto.ts).
    if (!bereinigt(werte.STRIPE_CONNECT_WEBHOOK_SECRET)) {
      warnungen.push('Kein STRIPE_CONNECT_WEBHOOK_SECRET — gesperrte oder frisch freigegebene Hof-Konten bleiben unbemerkt.')
    }
  }
  // In jeder Umgebung: Produktion meldet es an Sentry, Vorschau und lokal im Banner.
  // Ein Tippfehler kostet nur den Link, nie den Start (src/lib/env.ts).
  if (testumgebung && 'problem' in testumgebung) {
    warnungen.push(
      testumgebung.problem === 'echte-seite'
        ? 'NEXT_PUBLIC_TESTUMGEBUNG_URL zeigt auf die echte Seite — der Link zur Testumgebung fehlt.'
        : 'NEXT_PUBLIC_TESTUMGEBUNG_URL ist keine reine https-Adresse — der Link zur Testumgebung fehlt.'
    )
  }
  // Ebenso in jeder Umgebung: Ein ungültiger Stichtag zählt Testzahlungen mit
  // wie vor Nr. 55, nie verhindert er den Start (src/lib/env.ts).
  if (stichtag && 'problem' in stichtag) warnungen.push(STICHTAG_WARNUNG[stichtag.problem])

  return { art, appUrl, trustedOrigins, testumgebungUrl, datenbank, stripe, vercelProduktion, branch, stripeLiveAb, warnungen }
}

const DATENBANK_LABEL: Record<DatenbankArt, { lang: string; kurz: string }> = {
  dev: { lang: 'Dev-Datenbank', kurz: 'Dev-DB' },
  fremd: { lang: 'Fremde Datenbank', kurz: 'fremde DB' },
}

/**
 * Wie der Stripe-Modus heißt — die eine Quelle auch für die Marke im Admin
 * (STRIPE_MARKE_TEXT in src/lib/testumgebung.ts, Nr. 43). „LIVE" schreit das
 * Banner bewusst: In einer Vorschau ist ein Live-Schlüssel ein Fehler.
 */
export const STRIPE_LABEL = {
  test: 'Stripe Test',
  live: 'Stripe LIVE',
  fehlt: 'Stripe fehlt',
} as const satisfies Record<StripeArt, string>

/**
 * Die Zeilen des Umgebungsbanners — lang für breite, kurz für schmale Bildschirme.
 * Nur für preview und lokal gedacht; in Produktion gibt es kein Banner, die
 * Funktion liefert dann trotzdem etwas Sinnvolles, damit sie nie wirft.
 */
export function bannerZeilen(u: Umgebung): { lang: string; kurz: string } {
  const ort = u.art === 'lokal' ? 'lokal' : (u.branch ?? 'unbekannter Branch')
  const db = DATENBANK_LABEL[u.datenbank]
  const stripe = STRIPE_LABEL[u.stripe]
  return {
    lang: ['TESTUMGEBUNG', db.lang, stripe, ort].join(' · '),
    kurz: ['TEST', db.kurz, stripe].join(' · '),
  }
}
