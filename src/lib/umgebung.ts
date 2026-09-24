/**
 * In welcher Umgebung läuft die App — und passt alles zusammen?
 *
 * Warum es das braucht: In Vercel-Previews waren NEXT_PUBLIC_APP_URL und
 * BETTER_AUTH_URL nicht gesetzt, Auth fiel auf localhost zurück, der Login war
 * dort unmöglich. Und niemand sah einer Preview an, dass sie eine ist. Hier
 * steht deshalb an EINER Stelle, was die Umgebung ist, welche Adressen ihr
 * gehören und ob Datenbank und Stripe zur Umgebung passen.
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
  DATABASE_URL?: string
  STRIPE_SECRET_KEY?: string
}

export type Umgebung = {
  art: UmgebungsArt
  /** Die Adresse, unter der die App erreichbar ist — null, wenn unbekannt. */
  appUrl: string | null
  /** Herkünfte, denen Better Auth vertraut. Nie ein Platzhalter wie *.vercel.app. */
  trustedOrigins: readonly string[]
  datenbank: DatenbankArt
  stripe: StripeArt
  branch: string | null
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

/** Nur das Präfix zählt — der Schlüssel selbst verlässt diese Funktion nicht. */
function stripeArt(schluessel: string | undefined): StripeArt {
  const s = bereinigt(schluessel)
  if (!s) return 'fehlt'
  if (s.startsWith('sk_test_')) return 'test'
  if (s.startsWith('sk_live_')) return 'live'
  return 'fehlt'
}

function umgebungsArt(werte: UmgebungsWerte): UmgebungsArt {
  // VERCEL_ENV ist das genauere Signal und geht vor: Auf Vercel ist NODE_ENV
  // in Previews ohnehin „production".
  if (werte.VERCEL_ENV === 'preview') return 'preview'
  if (werte.NODE_ENV === 'development') return 'lokal'
  return 'produktion'
}

export function bestimmeUmgebung(werte: UmgebungsWerte): Umgebung {
  const art = umgebungsArt(werte)

  let trustedOrigins: string[]
  switch (art) {
    case 'preview': {
      // Die Branch-Adresse zuerst: Sie bleibt über Deploys hinweg gleich und
      // taugt deshalb als appUrl in Links. Die Deploy-Adresse zusätzlich, weil
      // der Browser auch unter ihr aufruft.
      const branchUrl = bereinigt(werte.VERCEL_BRANCH_URL)
      const deployUrl = bereinigt(werte.VERCEL_URL)
      trustedOrigins = [branchUrl, deployUrl]
        .filter((h): h is string => Boolean(h))
        .map((h) => `https://${h}`)
      break
    }
    case 'lokal':
      trustedOrigins = [LOKALE_ADRESSE]
      break
    case 'produktion': {
      // Nur die konfigurierte Adresse. Fehlt sie, gibt es KEINEN Ersatz — eine
      // geratene Herkunft wäre ein Sicherheitsloch, kein Komfort.
      const konfiguriert = bereinigt(werte.NEXT_PUBLIC_APP_URL)
      trustedOrigins = konfiguriert ? [konfiguriert] : []
      break
    }
  }
  const appUrl = trustedOrigins[0] ?? null

  const datenbank: DatenbankArt = istDevDatenbank(werte.DATABASE_URL) ? 'dev' : 'fremd'
  const stripe = stripeArt(werte.STRIPE_SECRET_KEY)
  const branch = bereinigt(werte.VERCEL_GIT_COMMIT_REF) ?? null

  const warnungen: string[] = []
  if (art === 'preview') {
    if (datenbank === 'fremd') warnungen.push('Fremde Datenbank — das ist nicht die Dev-Datenbank.')
    if (stripe === 'live') warnungen.push('Stripe LIVE — echte Zahlungen möglich.')
    if (!appUrl) {
      warnungen.push('Keine Vercel-Adresse bekannt — der Login kann so nicht funktionieren.')
    }
  }
  if (art === 'produktion') {
    if (datenbank === 'dev') warnungen.push('Produktion läuft gegen die Dev-Datenbank.')
    if (stripe === 'test') warnungen.push('Stripe TEST in Produktion — keine echten Zahlungen möglich.')
  }

  return { art, appUrl, trustedOrigins, datenbank, stripe, branch, warnungen }
}

const DATENBANK_LABEL: Record<DatenbankArt, { lang: string; kurz: string }> = {
  dev: { lang: 'Dev-Datenbank', kurz: 'Dev-DB' },
  fremd: { lang: 'Fremde Datenbank', kurz: 'fremde DB' },
}

const STRIPE_LABEL: Record<StripeArt, string> = {
  test: 'Stripe Test',
  live: 'Stripe LIVE',
  fehlt: 'Stripe fehlt',
}

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
