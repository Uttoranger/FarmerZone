/**
 * Die Kunden-Anmeldung mit Code aus der E-Mail (E7, Nr. 08) — Fachregeln,
 * rein und ohne Browser prüfbar (tests/anmeldecode.test.ts).
 *
 * Der Ablauf selbst gehört Better Auth (emailOTP-Plugin, src/lib/auth.ts):
 * Code erzeugen, gehasht in der Verification-Tabelle ablegen, prüfen, Sitzung
 * anlegen. Hier steht, was FarmerZone dabei festlegt — Länge, Laufzeit,
 * Versuche, Bremsen, wer einen Code bekommt, was die Kundin bei einem Fehler
 * liest und wohin es danach geht. Das Formular (components/anmelden/
 * kunde-code-formular.tsx) und „Bestellungen finden" (Nr. 14) lesen dieselben
 * Regeln.
 *
 * WARUM DIE VERSUCHE IN DER DATENBANK ZÄHLEN (S4): Die Rate-Limits von Better
 * Auth und src/lib/rate-limit.ts halten ihre Zähler im Speicher einer
 * Instanz; auf Vercel hätte jede warme Instanz ihr eigenes Fenster. Das
 * Plugin schreibt die Fehlversuche dagegen an den Code selbst
 * (Verification.value = "<hash>:<versuche>", atomicVerifyOTP in
 * better-auth/dist/plugins/email-otp/routes.mjs) — jede Instanz liest
 * dieselbe Zeile. Belegt in tests/integration/anmeldecode.int.test.ts.
 */
export const ANMELDECODE_LAENGE = 6
export const ANMELDECODE_GUELTIG_SEKUNDEN = 10 * 60
export const ANMELDECODE_MAX_VERSUCHE = 5

/**
 * Better Auth bremst Anfordern und Prüfen je IP und Pfad. 3 je Minute: Wer
 * sich einmal vertippt, kommt durch; eine Schleife nicht. Im Speicher der
 * Instanz — die harte Grenze sind die 5 Versuche je Code in der Datenbank.
 */
export const ANMELDECODE_RATE_LIMIT = { window: 60, max: 3 } as const

/** So lange wartet „Code erneut senden" — das Fenster der IP-Grenze. */
export const CODE_ERNEUT_WARTEZEIT_SEKUNDEN = ANMELDECODE_RATE_LIMIT.window

/**
 * Höchstens so viele Codes je Adresse — gegen ein Postfach, das von vielen
 * IPs aus mit Codes zugeschüttet wird. Je Instanz, wie alle Speicher-Grenzen.
 */
export const CODE_ANFORDERUNGEN_JE_ADRESSE = { max: 5, fensterMs: 15 * 60_000 } as const

/**
 * Die Einstellung des emailOTP-Plugins (auth.ts ergänzt nur den Versand).
 * - `storeOTP: 'hashed'`: In der Datenbank steht nie der Code selbst.
 * - `resendStrategy: 'rotate'`: Jede Anforderung macht einen neuen Code mit
 *   neuen 5 Versuchen; der alte gilt nicht mehr.
 * - `disableSignUp: false`: wie der Magic Link bisher — eine neue Adresse
 *   bekommt beim ersten Anmelden ein Kundenkonto ohne Passwort. Das ist die
 *   bestehende freiwillige Kunden-Anmeldung (E8: sie bleibt erhalten), kein
 *   Konto beim Bestellen.
 */
export const ANMELDECODE_PLUGIN_OPTIONEN = {
  otpLength: ANMELDECODE_LAENGE,
  expiresIn: ANMELDECODE_GUELTIG_SEKUNDEN,
  allowedAttempts: ANMELDECODE_MAX_VERSUCHE,
  storeOTP: 'hashed',
  resendStrategy: 'rotate',
  disableSignUp: false,
  rateLimit: { ...ANMELDECODE_RATE_LIMIT },
} as const

/**
 * Pfade, die die App nicht anbietet und die deshalb über HTTP gar nicht erst
 * erreichbar sind (Better Auth `disabledPaths`, gilt nur für HTTP).
 *
 * - `/sign-in/magic-link`: Neue Magic Links gibt es nicht mehr (E7). Das
 *   Prüfen alter Links (`/magic-link/verify`) bleibt offen, solange das
 *   Plugin in auth.ts steht — Links, die vor dem Deployment verschickt
 *   wurden, gelten noch 15 Minuten.
 * - Die Code-Wege für Passwort-Zurücksetzen, E-Mail-Bestätigung und
 *   E-Mail-Wechsel: Das Plugin bringt sie mit, die App nutzt sie nicht. Offen
 *   gelassen wären sie ein zweiter Weg, das Passwort eines Hofs zu ändern.
 */
export const GESPERRTE_AUTH_PFADE = [
  '/sign-in/magic-link',
  '/email-otp/request-password-reset',
  '/email-otp/reset-password',
  '/forget-password/email-otp',
  '/email-otp/verify-email',
  '/email-otp/check-verification-otp',
  '/email-otp/request-email-change',
  '/email-otp/change-email',
] as const

/** Nach der Anmeldung mit Code, wenn kein Ziel mitkommt: wie bisher nach dem Magic Link. */
export const STANDARD_ZIEL_NACH_CODE = '/account/profile'

/** Längstes Ziel, das als Parameter angenommen wird. */
export const ZIEL_MAX = 512

/**
 * Bekommt diese Adresse einen Code? Kundinnen ja, neue Adressen ja (sie
 * werden Kundinnen). Ein Hof nie: Höfe melden sich mit Passwort an (E7), und
 * ein Code würde einem noch unbestätigten Hof-Konto über Better Auth das
 * Passwort entziehen (revokeUnprovenAccountAccess). Die Antwort an den
 * Browser ist in beiden Fällen dieselbe — wer eine Adresse eintippt, erfährt
 * nicht, ob dahinter ein Hof steht.
 */
export function codeVersandErlaubt(rolle: string | null | undefined): boolean {
  return rolle === null || rolle === undefined || rolle === 'CUSTOMER'
}

/** Nur Ziffern, höchstens so viele, wie der Code hat — „481 234" aus der Mail wird „481234". */
export function normalisiereCode(eingabe: string): string {
  return eingabe.replace(/\D/g, '').slice(0, ANMELDECODE_LAENGE)
}

export function codeVollstaendig(code: string): boolean {
  return new RegExp(`^\\d{${ANMELDECODE_LAENGE}}$`).test(code)
}

/** Was Better Auth im Fehlerfall zurückgibt — nur die Felder, die hier zählen. */
export type AnmeldeFehler = { code?: string; status?: number }

/**
 * Der Satz für die Kundin. Geduzt, ohne Fachbegriff, immer mit Ausweg.
 * `senden` = Code anfordern, `pruefen` = mit Code anmelden.
 */
export function anmeldeFehlerText(fehler: AnmeldeFehler, schritt: 'senden' | 'pruefen'): string {
  if (fehler.status === 429) {
    return 'Das waren gerade zu viele Versuche. Warte eine Minute und probier es dann noch einmal.'
  }
  switch (fehler.code) {
    case 'INVALID_OTP':
      return 'Der Code stimmt nicht. Schau noch einmal in die E-Mail oder lass dir einen neuen schicken.'
    case 'OTP_EXPIRED':
      return 'Der Code ist abgelaufen – er gilt 10 Minuten. Lass dir einen neuen schicken.'
    case 'TOO_MANY_ATTEMPTS':
      return 'Du hast den Code zu oft falsch eingegeben. Lass dir einen neuen Code schicken.'
    case 'INVALID_EMAIL':
      return 'Bitte gib eine gültige E-Mail-Adresse ein.'
  }
  return schritt === 'senden'
    ? 'Wir konnten dir gerade keinen Code schicken. Probier es gleich noch einmal.'
    : 'Wir konnten dich gerade nicht anmelden. Probier es gleich noch einmal.'
}

/** Ganze Sekunden, bis „Code erneut senden" wieder geht; 0 = sofort. */
export function restWartezeitSekunden(gesendetUmMs: number | null, jetztMs: number): number {
  if (gesendetUmMs === null) return 0
  const rest = gesendetUmMs + CODE_ERNEUT_WARTEZEIT_SEKUNDEN * 1000 - jetztMs
  return rest > 0 ? Math.ceil(rest / 1000) : 0
}

// Ein Ursprung, den es nicht gibt: Löst ein Ziel gegen ihn auf einen anderen
// Ursprung auf, zeigte es aus der App hinaus.
const PRUEF_URSPRUNG = 'https://farmerzone.invalid'

/**
 * Wohin es nach der Anmeldung mit Code geht. Nur ein eigener, relativer Pfad
 * — sonst wäre die Anmeldeseite ein Sprungbrett auf fremde Seiten (offene
 * Weiterleitung, beliebt für Phishing: „melde dich auf farmerzone.at an" und
 * landet woanders). Abgelehnt wird alles, was nicht mit genau einem „/"
 * beginnt, Rückstriche und Steuerzeichen trägt, kodiert mit „//" beginnt oder
 * in die Schnittstellen (/api) führt. Im Zweifel das Standardziel.
 */
export function zielNachAnmeldung(roh: unknown, standard: string = STANDARD_ZIEL_NACH_CODE): string {
  if (typeof roh !== 'string' || roh.length === 0 || roh.length > ZIEL_MAX) return standard
  if (!roh.startsWith('/') || roh.startsWith('//')) return standard
  if (/[\\\u0000-\u001f\u007f\s]/.test(roh)) return standard

  let entschluesselt: string
  try {
    entschluesselt = decodeURIComponent(roh)
  } catch {
    return standard
  }
  if (entschluesselt.startsWith('//') || entschluesselt.includes('\\')) return standard

  const url = new URL(roh, PRUEF_URSPRUNG)
  if (url.origin !== PRUEF_URSPRUNG) return standard
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return standard
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Wohin es nach der Hof-Anmeldung geht: ins Dashboard. Einzige Ausnahme ist
 * /teilen — es schickt Abgemeldete mit ?von=/teilen her, damit geteilte Fotos
 * nach dem Anmelden nicht in der Ablage stranden. Streng auf genau diesen
 * Pfad geprüft (unverändert aus dem bisherigen Formular übernommen).
 */
export function zielNachHofAnmeldung(von: string | null): string {
  return von === '/teilen' ? '/teilen' : '/dashboard'
}
