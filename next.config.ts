import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Jede eigene Route auf oberster Ebene unter src/app — damit die Regel für
// die Vorschau unten wirklich nur eine HOFSEITE (/<slug>) trifft und nie
// /login?vorschau=1 oder /dashboard?vorschau=1. tests/sicherheits-header.test.ts
// gleicht die Liste mit den Ordnern ab; ein neuer Ordner fällt dort auf.
const KEINE_HOFSEITE = [
  'account', 'admin', 'analytics', 'api', 'customers', 'dashboard', 'datenschutz',
  'farm-page', 'fehler-melden', 'forgot-password', 'hoefe', 'impressum', 'konditionen',
  'login', 'meldungen', 'onboarding', 'orders', 'problem-melden', 'products', 'register',
  'reset-password', 'sales', 'settings', 'status', 'teilen', 'verify',
];
// Genau EIN Pfadstück aus Slug-Zeichen (src/lib/slug.ts), das keine Route ist.
const HOFSEITEN_QUELLE = `/:farmSlug((?!(?:${KEINE_HOFSEITE.join('|')})$)[a-z0-9-]+)`;

const nextConfig: NextConfig = {
  // sharp bleibt ein externes Server-Modul (native Binärdateien lassen sich
  // nicht bundeln). Steht hier ausdrücklich, auch wenn es dem Next-Standard
  // entspricht — die Absicht soll im Repo dokumentiert sein.
  serverExternalPackages: ['sharp'],

  // Produktionsfehler „ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3": Das
  // Datei-Tracing nimmt sharps JS und sogar das .node-Addon mit, aber NICHT
  // die libvips-Laufzeitbibliothek (.so), an der das Addon beim Laden hängt.
  // Deshalb werden die Binärpakete hier ausdrücklich in die
  // Verarbeitungs-Funktion gepackt.
  //
  // PNPM-SYMLINK-FALLE: Muster wie './node_modules/@img/**/*' treffen unter
  // pnpm nur Symlinks — die echten Dateien liegen unter node_modules/.pnpm/.
  // Vercels Paketierung lehnt das ab: „The framework produced an invalid
  // deployment package for a Serverless Function. Typically this means that
  // the framework produces files in symlinked directories." Das Muster zeigt
  // deshalb BEWUSST auf die .pnpm-Realverzeichnisse und müsste bei einem
  // Wechsel des Paketmanagers angepasst werden. Minimal gehalten: nur die
  // Binärpakete — sharps eigenes JS kam schon immer korrekt mit.
  //
  // Die Realordner stehen mit NAMEN da, nicht als './node_modules/.pnpm/
  // @img+*/node_modules/@img/**/*': pnpm legt in @img+sharp-linux-x64@*/
  // node_modules/@img/ einen Dependency-SYMLINK auf sharp-libvips-linux-x64,
  // und ein breites **-Muster läuft dort hinein — gemessen am Manifest: 12
  // Datei-Einträge unter Symlink-Vorfahren, dieselbe Klasse, die das
  // Deployment ablehnt. Zur Laufzeit findet das Addon libvips über seinen
  // RPATH ($ORIGIN/../../sharp-libvips-linux-x64/lib) durch genau diesen
  // Symlink — der steht als bloßer Eintrag schon im Manifest des Tracers,
  // hier müssen nur die echten DATEIEN beider Pakete dazu.
  outputFileTracingIncludes: {
    '/api/upload/verarbeiten': [
      './node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/**/*',
      './node_modules/.pnpm/@img+sharp-linux-x64@*/node_modules/@img/sharp-linux-x64/**/*',
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
    ],
  },

  // Security-Header (Härtung 2b). Bewusst OHNE Content-Security-Policy:
  // Stripe Elements bettet Frames/Skripte ein — eine CSP braucht eine eigene,
  // getestete Allowlist (js.stripe.com, hooks etc.) und ist Parklisten-Punkt.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // HTTPS erzwingen (2 Jahre, inkl. Subdomains) — Vercel liefert eh nur TLS
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // MIME-Sniffing unterbinden
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Unsere Seiten dürfen nirgends eingebettet werden (Clickjacking);
          // Stripe-Frames sind Frames IN unserer Seite und davon unberührt
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Überall gesperrt — auch der Standort. Nur die Hofübersicht
          // bekommt darunter eine eigene, engere Regel.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // NUR /hoefe darf nach dem Standort FRAGEN („In meiner Nähe").
        //
        // Warum überhaupt: Die leere Liste `geolocation=()` sperrt auch das
        // EIGENE Dokument aus — die Abfrage scheiterte damit immer mit
        // PERMISSION_DENIED (in echtem Chromium nachgemessen). `self` erlaubt
        // ausschließlich unserer eigenen Herkunft zu fragen; die Entscheidung
        // trifft weiter die Nutzerin im Browser-Dialog, und die Position
        // verlässt das Gerät nie (src/components/hoefe/hoefe-umkreis.tsx).
        //
        // Warum nur hier: Der Bauern-Bereich, /account und /admin brauchen
        // niemals einen Standort — sie behalten die harte Sperre oben. Diese
        // Regel steht NACH der allgemeinen, damit sie für /hoefe gewinnt.
        source: '/hoefe',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
      {
        // Die Bestätigungsseite trägt die signierte Adresse (?sig=) und zeigt
        // Name und E-Mail der Kundin: Beim Klick auf einen Link (Hofseite,
        // Stripe) geht sie NICHT als Referrer mit, und in keinen Suchindex.
        // Steht nach der allgemeinen Regel, damit sie dort gewinnt.
        source: '/:farmSlug/confirm/:orderId',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // NUR die Hofseite MIT ?vorschau=1 darf eingebettet werden — und nur
        // von uns selbst: Der Editor unter /farm-page zeigt sie im Browser als
        // Handy-Vorschau im iframe (src/lib/hofseite-vorschau.ts). Ohne den
        // Parameter, für jede andere Seite und für Unterseiten der Hofseite
        // bleibt die Sperre oben (DENY) — auch das steht im Test. Beide
        // Header, weil ältere Browser nur X-Frame-Options lesen; „self" und
        // SAMEORIGIN sagen dasselbe.
        source: HOFSEITEN_QUELLE,
        has: [{ type: 'query', key: 'vorschau', value: '1' }],
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
    ]
  },
};

// withSentryConfig verdrahtet die Build-Seite von Sentry (Quelltext-Karten,
// Turbopack-Regeln). Es UMSCHLIESST die Konfiguration nur — serverExternal-
// Packages, das sharp-Tracing und die Security-Header oben bleiben unberührt.
// Organisation und Projekt stehen fest hier — sie sind kein Geheimnis, und als
// Umgebungsvariable gab es sie nie. Geheim ist nur SENTRY_AUTH_TOKEN (in Vercel
// für Production und Preview). Ohne Token (lokal, CI) überspringt der Build
// den Upload mit einer Notiz und bleibt GRÜN — fehlende Sentry-Werte dürfen
// niemals einen Deploy verhindern (gleicher Grundsatz wie beim DSN in
// src/lib/env.ts).
//
// Keine SENTRY_URL für die EU-Region: Der Organisations-Token (sntrys_…)
// trägt die Adresse seiner Region in sich, und sentry-cli zieht sie der
// voreingestellten sentry.io vor.
export default withSentryConfig(nextConfig, {
  org: 'farmerzone',
  project: 'javascript-nextjs',
  // Build-Werkzeug, keine App-Laufzeit: @/lib/env gilt hier nicht.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    // Nach dem Upload löschen — sonst lägen die Karten unter /_next/static
    // öffentlich, und jeder könnte den ungepressten Quelltext lesen. Steht
    // ausdrücklich da, auch wenn es heute der Standard ist.
    deleteSourcemapsAfterUpload: true,
  },
  // Keine Nutzungsstatistik des Sentry-Build-Werkzeugs an Sentry senden.
  telemetry: false,
});
