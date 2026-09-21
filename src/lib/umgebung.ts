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

const LOKALE_ADRESSE = 'http://localhost:3000'

function bereinigt(wert: string | undefined): string | undefined {
  const t = wert?.trim()
  return t ? t : undefined
}

/**
 * Zeigt DATABASE_URL auf die Dev-Datenbank?
 *
 * Allowlist, keine Blocklist: „dev" nur bei localhost oder der bekannten
 * Projektreferenz. Die Referenz wird im Host UND im Benutzernamen gesucht —
 * beim Supabase-Pooler steht sie nur im Benutzernamen (postgres.<ref>@aws-…),
 * der Host trägt sie dort nicht. Ohne diese zweite Prüfung zählte die Dev-DB
 * über den Pooler als fremd.
 *
 * Eigener Export, damit der Seed sich damit sperren kann: Er darf nie gegen
 * eine fremde Datenbank laufen.
 */
export function istDevDatenbank(databaseUrl: string | undefined): boolean {
  const url = bereinigt(databaseUrl)
  if (!url) return false
  let host: string
  let benutzer: string
  try {
    const geparst = new URL(url)
    host = geparst.hostname.toLowerCase()
    benutzer = decodeURIComponent(geparst.username).toLowerCase()
  } catch {
    // Unlesbare Adresse: im Zweifel fremd.
    return false
  }
  if (host.includes('localhost') || host === '127.0.0.1') return true
  return host.includes(DEV_DATENBANK_REFERENZ) || benutzer.includes(DEV_DATENBANK_REFERENZ)
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
