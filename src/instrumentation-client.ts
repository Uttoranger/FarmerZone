import * as Sentry from '@sentry/nextjs'

// Client-Seite: NEXT_PUBLIC_SENTRY_DSN ist OPTIONAL — ohne Variable
// keine Initialisierung, kein Verhalten geändert.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
  })
}

// Pflicht-Export für Next-Router-Instrumentierung; ohne init() ein No-op
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
