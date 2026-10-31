import * as Sentry from '@sentry/nextjs'
import { config as zodEinstellung } from 'zod/v4/core'
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

// Zod 4 im Browser ohne eval-Probe (Register G8, Ergänzung 31.10.2026; Nr. 208): Beim Anlegen jedes
// Objekt-Schemas prüft Zod mit `new Function('')`, ob es seine Prüfer kompilieren darf. Die CSP
// erlaubt kein eval, der Browser meldet den abgefangenen Wurf trotzdem als Verstoß und füllt den
// Bericht mit Treffern ohne Wirkung. `jitless` schaltet Probe und Kompilieren ab — kein
// Sicherheitsgewinn, nur Signalqualität; die Policy bleibt unverändert. Zod liest die Einstellung
// beim ANLEGEN des Schemas, sie muss also vor dem ersten Schema-Modul laufen: Next führt diese
// Datei vor dem übrigen Code des Browsers aus, darum steht sie hier und nur hier (eine Quelle,
// Wache in tests/zod-jitless.test.ts). Der Server bleibt unberührt: kein CSP, JIT ist dort schneller.
zodEinstellung({ jitless: true })

if (dsn) {
  const umgebung = ermittleUmgebung(process.env.NEXT_PUBLIC_VERCEL_ENV)
  Sentry.init({
    dsn,
    environment: umgebung,
    // Leichtes Tracing nur in Produktion (jede zehnte Sitzung), sonst keins.
    tracesSampleRate: umgebung === 'production' ? 0.1 : 0,
    // Keine IP (Nr. 37): Ohne sendDefaultPii meldet das SDK dem Ingest
    // infer_ip „never" — Sentry leitet die Adresse nicht aus der Verbindung
    // ab. Nie `dataCollection` setzen: das schaltet alle Vorgaben auf „an".
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
