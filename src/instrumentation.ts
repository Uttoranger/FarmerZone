import * as Sentry from '@sentry/nextjs'
import { bereinigeEreignis, ermittleUmgebung } from '@/lib/sentry-hygiene'

// Sentry, Server- und Edge-Seite. Next ruft register() je Laufzeit (Node und
// Edge) einmal auf — dieselben Optionen tragen beide.
//
// NEXT_PUBLIC_SENTRY_DSN ist OPTIONAL (in src/lib/env.ts genauso validiert):
// Fehlt der Wert, wird nie initialisiert und alles läuft unverändert — ein
// fehlender DSN darf niemals einen Deploy verhindern. Bewusst DERSELBE
// öffentliche DSN wie im Browser (der DSN ist kein Geheimnis, er ist eine
// Einwurf-Adresse): EINE Variable in Vercel statt zwei, die auseinanderlaufen.
//
// DATENSPARSAMKEIT: sendDefaultPii aus, jedes Ereignis durch bereinigeEreignis
// (Begründung und Regeln in src/lib/sentry-hygiene.ts — Sentry sieht, WAS
// kaputt ging, nicht WER es war). KEIN Session Replay, KEIN Profiling.
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  const umgebung = ermittleUmgebung(process.env.VERCEL_ENV)
  Sentry.init({
    dsn,
    environment: umgebung,
    // Leichtes Tracing nur in Produktion (jede zehnte Anfrage), sonst keins.
    tracesSampleRate: umgebung === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    // BEIDE Haken, ein Filter: beforeSend läuft nur für Fehler; ohne
    // beforeSendTransaction gingen die getasteten Transaktionen samt roher
    // URL (…?token=…) ungefiltert raus (siehe sentry-hygiene.ts).
    beforeSend: bereinigeEreignis,
    beforeSendTransaction: bereinigeEreignis,
  })
}

// Fängt Fehler aus Server Components / Route Handlern; ohne init() ein No-op
export const onRequestError = Sentry.captureRequestError
