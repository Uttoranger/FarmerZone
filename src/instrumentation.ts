import * as Sentry from '@sentry/nextjs'

// Sentry minimal (Härtung 2b): SENTRY_DSN ist OPTIONAL — fehlt die Variable,
// wird nie initialisiert und alles läuft unverändert (Muster wie RESEND_API_KEY).
// Bewusst ohne withSentryConfig/Source-Map-Upload: das bräuchte Auth-Token
// und Sentry-Projekt-Konfiguration (keine neuen Pflicht-Dienste).
export async function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    // Nur Fehler, kein Performance-Tracing — minimaler Fußabdruck
    tracesSampleRate: 0,
  })
}

// Fängt Fehler aus Server Components / Route Handlern; ohne init() ein No-op
export const onRequestError = Sentry.captureRequestError
