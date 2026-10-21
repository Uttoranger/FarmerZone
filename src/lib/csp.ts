import { z } from 'zod'

/*
 * Content-Security-Policy ZUM BEOBACHTEN (Register G8, Nr. 125) — rein, ohne
 * Next und ohne Datenbank; next.config.ts baut daraus die Header,
 * /api/csp-bericht nimmt die Meldungen damit entgegen.
 *
 * Der Browser blockiert mit `Content-Security-Policy-Report-Only` nichts, er
 * meldet nur, was eine scharfe Policy blockieren würde. Scharf geschaltet wird
 * erst nach Auswertung der Meldungen (eigener Auftrag); dann wird aus dem
 * Header-Namen `Content-Security-Policy`, und Nonces bzw. Hashes ersetzen
 * `'unsafe-inline'`.
 *
 * JEDER HOST HAT EINE QUELLE (nicht geraten):
 *  - https://js.stripe.com — ORIGIN in @stripe/stripe-js (dist/index.mjs):
 *    Stripe.js und seine Elemente laden von dort. Die Stripe-Doku „Content
 *    Security Policy" war beim Bau nicht erreichbar; weitere Stripe-Hosts
 *    kommen erst, wenn die Meldungen sie zeigen.
 *  - die Kartenkacheln — die Herkunft von KARTEN_KACHELN.url
 *    (src/lib/hoefe-anzeige.ts); tests/csp.test.ts hält beide gleich.
 *  - https://*.public.blob.vercel-storage.com — Fotos aus dem Bildspeicher
 *    (images.remotePatterns in next.config.ts, constructBlobUrl in @vercel/blob).
 *  - https://vercel.com — der Upload aus dem Browser (`upload()` aus
 *    @vercel/blob/client schickt an defaultVercelBlobApiUrl).
 *  - der Sentry-Host — nur aus NEXT_PUBLIC_SENTRY_DSN beim Build, nur der Host.
 *  - Vercel Analytics läuft über dieselbe Adresse (/_vercel/insights): 'self'.
 *  - https://vercel.live — die Vercel-Toolbar, nur auf Vorschauen.
 */

export const CSP_HEADER = 'Content-Security-Policy-Report-Only'
export const CSP_BERICHT_PFAD = '/api/csp-bericht'
/** Name der Gruppe in `Reporting-Endpoints` und in `report-to`. */
export const CSP_BERICHT_GRUPPE = 'csp'

const STRIPE_JS = 'https://js.stripe.com'
const BLOB_BILDER = 'https://*.public.blob.vercel-storage.com'
const BLOB_UPLOAD = 'https://vercel.com'
const VERCEL_TOOLBAR = 'https://vercel.live'
/**
 * Herkunft der Kartenkacheln. Steht hier als Wert und nicht als Import von
 * KARTEN_KACHELN: next.config.ts lädt diese Datei beim Build, und dort lösen
 * @/-Importe in weiteren Dateien nicht auf. Der Test vergleicht beide.
 */
const KARTEN_HOST = 'https://tile.openstreetmap.org'

/** Nur der Host aus der DSN (https), nie Schlüssel oder Projekt; ohne gültige DSN null. */
export function sentryHost(dsn: string | undefined): string | null {
  if (!dsn) return null
  try {
    const adresse = new URL(dsn)
    return adresse.protocol === 'https:' ? `https://${adresse.host}` : null
  } catch {
    return null
  }
}

/**
 * Die Adresse für `Reporting-Endpoints` — absolut, aus NEXT_PUBLIC_APP_URL
 * (nur https, nur die Herkunft). Relativ wäre sie laut W3C Reporting API
 * erlaubt; belegen ließ sich das beim Bau nicht (Doku offline, der lokale
 * Chromium stellt Meldungen der Reporting API gar nicht zu), darum der
 * sichere Weg. Ohne gültige Adresse null: dann kein report-to.
 */
export function cspBerichtAdresse(appUrl: string | undefined): string | null {
  if (!appUrl) return null
  try {
    const adresse = new URL(appUrl)
    return adresse.protocol === 'https:' ? `${adresse.origin}${CSP_BERICHT_PFAD}` : null
  } catch {
    return null
  }
}

export type CspOptionen = {
  /** Meldungen an /api/csp-bericht — nur in der Produktion (VERCEL_ENV=production). */
  melden: boolean
  /**
   * Absolute Adresse für report-to (cspBerichtAdresse). Fehlt sie, meldet die
   * Policy nur über report-uri: Chromium nimmt report-uri nicht mehr, sobald
   * report-to dasteht — auch wenn die Gruppe fehlt (lokal gemessen).
   */
  berichtAdresse?: string | null
  /** Vercel-Toolbar — nur auf Vorschauen (VERCEL_ENV=preview). */
  toolbar?: boolean
  /** NEXT_PUBLIC_SENTRY_DSN beim Build. */
  sentryDsn?: string
}

/** Der Wert für `Content-Security-Policy-Report-Only`. */
export function baueCsp({ melden, berichtAdresse = null, toolbar: mitToolbar = false, sentryDsn }: CspOptionen): string {
  const toolbar = mitToolbar ? [VERCEL_TOOLBAR] : []
  const sentry = sentryHost(sentryDsn)
  const anweisungen: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", "'unsafe-inline'", STRIPE_JS, ...toolbar]],
    ['style-src', ["'self'", "'unsafe-inline'", ...toolbar]],
    ['img-src', ["'self'", 'data:', 'blob:', KARTEN_HOST, BLOB_BILDER, ...toolbar]],
    ['font-src', ["'self'", ...toolbar]],
    ['connect-src', ["'self'", ...(sentry ? [sentry] : []), BLOB_UPLOAD, ...toolbar]],
    ['frame-src', [STRIPE_JS, ...toolbar]],
    ['worker-src', ["'self'", 'blob:']],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ]
  if (melden) anweisungen.push(['report-uri', [CSP_BERICHT_PFAD]])
  if (melden && berichtAdresse) anweisungen.push(['report-to', [CSP_BERICHT_GRUPPE]])
  return anweisungen.map(([name, quellen]) => `${name} ${quellen.join(' ')}`).join('; ')
}

/**
 * Seiten, die NIE melden (neben den Seiten mit `Referrer-Policy: no-referrer`,
 * die next.config.ts selbst einsammelt): Ihre Adresse trägt eine Kennung, eine
 * Signatur oder einen Token, und eine Meldung schickt die ganze Adresse mit.
 */
export const NIE_MELDEN_PFADE = [
  '/:farmSlug/bestellung/:orderId',
  '/:farmSlug/bestellung/:orderId/kalender',
  '/admin/postfach/zustellung/bestaetigen',
  '/api/:pfad*',
] as const

/** Jede Adresse mit einem dieser Query-Werte meldet nie. `?beitrag=` ist eine öffentliche Kennung (Nr. 128) und fehlt bewusst. */
export const NIE_MELDEN_PARAMETER = ['s', 'sig', 'token', 't', 'code', 'vorschau', 'reorder'] as const

// ─── Die Meldungen (/api/csp-bericht) ─────────────────────────────────────────

/** Größer nimmt die Route nichts an — beim Lesen begrenzt. */
export const CSP_BERICHT_MAX_BYTES = 8 * 1024

export type CspBerichtArt = 'csp-report' | 'reports+json'

/** report-uri schickt `application/csp-report`, die Reporting API `application/reports+json`; sonst null. */
export function cspBerichtArt(inhaltsTyp: string | null): CspBerichtArt | null {
  const art = (inhaltsTyp ?? '').split(';')[0].trim().toLowerCase()
  if (art === 'application/csp-report') return 'csp-report'
  if (art === 'application/reports+json') return 'reports+json'
  return null
}

/** Was von einer Meldung bleibt. Alles andere (Query, Fragment, Ausschnitt, Referrer, Policy) liest das Schema gar nicht erst. */
export type CspMeldung = { anweisung: string; host: string; pfad: string }

const cspReportSchema = z.object({
  'csp-report': z.object({
    'document-uri': z.string().optional(),
    'effective-directive': z.string().optional(),
    'violated-directive': z.string().optional(),
    'blocked-uri': z.string().optional(),
  }),
})

const reportsSchema = z.array(
  z.object({
    type: z.string(),
    url: z.string().optional(),
    body: z
      .object({
        documentURL: z.string().optional(),
        effectiveDirective: z.string().optional(),
        blockedURL: z.string().optional(),
      })
      .optional(),
  })
)

const UNBEKANNT = 'unbekannt'
const STICHWOERTER = new Set(['inline', 'eval', 'data', 'blob'])
/** Teile nach diesen Pfadstücken sind Kennungen oder Token. */
const KENNUNG_NACH = /\/(bestaetigen|confirm|bestellung)\/[^/]+/g

/** Nur der Name der Anweisung (ältere Browser schicken die ganze Anweisung samt Quellen). */
function anweisungAus(roh: string | undefined): string {
  const name = (roh ?? '').trim().split(/\s+/)[0]
  return /^[a-z-]{1,40}$/.test(name) ? name : UNBEKANNT
}

/** Von der gesperrten Adresse nur Schema und Host — oder das Stichwort. */
function hostAus(roh: string | undefined): string {
  const wert = (roh ?? '').trim()
  if (STICHWOERTER.has(wert)) return wert
  try {
    const adresse = new URL(wert)
    if (adresse.protocol === 'data:') return 'data'
    if (adresse.protocol === 'blob:') return 'blob'
    return adresse.host ? `${adresse.protocol}//${adresse.host}`.slice(0, 200) : UNBEKANNT
  } catch {
    return UNBEKANNT
  }
}

/** Von der Seite nur der Pfad, Kennungen als :id. */
function pfadAus(roh: string | undefined): string {
  try {
    return new URL(roh ?? '').pathname.replace(KENNUNG_NACH, '/$1/:id').slice(0, 200)
  } catch {
    return UNBEKANNT
  }
}

/** Liest die Meldungen eines Aufrufs; was nicht passt, fällt weg (Fremddaten). */
export function leseCspMeldungen(art: CspBerichtArt, roh: unknown): CspMeldung[] {
  if (art === 'csp-report') {
    const geprueft = cspReportSchema.safeParse(roh)
    if (!geprueft.success) return []
    const r = geprueft.data['csp-report']
    return [{ anweisung: anweisungAus(r['effective-directive'] ?? r['violated-directive']), host: hostAus(r['blocked-uri']), pfad: pfadAus(r['document-uri']) }]
  }
  const geprueft = reportsSchema.safeParse(roh)
  if (!geprueft.success) return []
  return geprueft.data
    .filter((eintrag) => eintrag.type === 'csp-violation')
    .map((eintrag) => ({
      anweisung: anweisungAus(eintrag.body?.effectiveDirective),
      host: hostAus(eintrag.body?.blockedURL),
      pfad: pfadAus(eintrag.body?.documentURL ?? eintrag.url),
    }))
}

/** Dieselbe Meldung (Anweisung, Host, Pfad) geht höchstens einmal in dieser Spanne an Sentry — je Instanz. */
export const CSP_ENTDOPPELN_MS = 60 * 60_000
/** Höchstens so viele Meldungen merkt sich eine Instanz. */
export const CSP_ENTDOPPELN_MAX = 500
/**
 * Höchstens so viele neue Meldungen gibt eine Anfrage weiter (Runde 1). Eine
 * Anfrage im Format reports+json trägt viele Einträge; jede weitergegebene
 * zählt in beiden Bremsen einzeln, und mehr als ein paar Datenbankabfragen je
 * Anfrage soll ein Absender nicht auslösen. Was liegen bleibt, ist nicht
 * gemerkt und kommt mit der nächsten Meldung des Browsers wieder.
 */
export const CSP_MELDUNGEN_JE_ANFRAGE = 5

const entdoppelSchluessel = (meldung: CspMeldung): string => `${meldung.anweisung}|${meldung.host}|${meldung.pfad}`

/** true = neu, false = in der letzten Stunde schon weitergegeben bzw. gerade vorgemerkt. Merkt nichts (das macht `merkeCspMeldung`). */
export function istNeueCspMeldung(gesehen: ReadonlyMap<string, number>, meldung: CspMeldung, jetztMs: number): boolean {
  const zuletzt = gesehen.get(entdoppelSchluessel(meldung))
  return zuletzt === undefined || jetztMs - zuletzt >= CSP_ENTDOPPELN_MS
}

/**
 * Merkt eine Meldung vor — die Route tut das vor dem ersten `await` auf die
 * Bremsen, damit eine gleichzeitige Anfrage derselben Instanz sie schon als
 * gesehen zählt. Lässt eine Bremse sie nicht durch, nimmt `vergissCspMeldung`
 * die Vormerkung zurück; sonst bliebe eine gebremste Meldung eine Stunde
 * stumm. Ist der Speicher voll, geht erst Abgelaufenes, dann das Älteste.
 */
export function merkeCspMeldung(gesehen: Map<string, number>, meldung: CspMeldung, jetztMs: number): void {
  const schluessel = entdoppelSchluessel(meldung)
  gesehen.delete(schluessel)
  if (gesehen.size >= CSP_ENTDOPPELN_MAX) {
    for (const [k, t] of gesehen) if (jetztMs - t >= CSP_ENTDOPPELN_MS) gesehen.delete(k)
    for (const k of gesehen.keys()) {
      if (gesehen.size < CSP_ENTDOPPELN_MAX) break
      gesehen.delete(k)
    }
  }
  gesehen.set(schluessel, jetztMs)
}

/** Nimmt eine Vormerkung zurück, wenn eine Bremse die Meldung nicht durchließ. */
export function vergissCspMeldung(gesehen: Map<string, number>, meldung: CspMeldung): void {
  gesehen.delete(entdoppelSchluessel(meldung))
}
