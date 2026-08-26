import * as Sentry from '@sentry/nextjs'
import { bereinigeEreignis, ermittleUmgebung } from '@/lib/sentry-hygiene'

// Sentry, Browser-Seite — die Datei, die der Foto-Upload-Suche gefehlt hat:
// Erst sie macht Fehler auf den Geräten der Bauern sichtbar.
//
// NEXT_PUBLIC_SENTRY_DSN ist OPTIONAL (in src/lib/env.ts genauso validiert):
// ohne Variable keine Initialisierung, kein Verhalten geändert — ein fehlender
// DSN darf niemals einen Deploy verhindern.
//
// NEXT_PUBLIC_VERCEL_ENV stellt Vercel selbst bereit (System-Variablen);
// lokal fehlt es und ermittleUmgebung fällt auf 'development' zurück.
//
// DATENSPARSAMKEIT wie auf dem Server: sendDefaultPii aus, jedes Ereignis
// durch bereinigeEreignis (src/lib/sentry-hygiene.ts — Sentry sieht, WAS
// kaputt ging, nicht WER es war). KEIN Session Replay, KEIN Profiling.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  const umgebung = ermittleUmgebung(process.env.NEXT_PUBLIC_VERCEL_ENV)
  Sentry.init({
    dsn,
    environment: umgebung,
    // Leichtes Tracing nur in Produktion (jede zehnte Sitzung), sonst keins.
    tracesSampleRate: umgebung === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    // BEIDE Haken, ein Filter: beforeSend läuft nur für Fehler; ohne
    // beforeSendTransaction gingen Pageload-Transaktionen samt roher URL
    // (…?token=…) ungefiltert raus (siehe sentry-hygiene.ts).
    beforeSend: bereinigeEreignis,
    beforeSendTransaction: bereinigeEreignis,
  })
}

// Pflicht-Export für Next-Router-Instrumentierung; ohne init() ein No-op
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
