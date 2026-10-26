import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { CSP_BERICHT_GRUPPE, CSP_HEADER, NIE_MELDEN_PARAMETER, NIE_MELDEN_PFADE, baueCsp, cspBerichtAdresse } from "./src/lib/csp";

// Jede eigene Route auf oberster Ebene unter src/app — damit die Regel für
// die Vorschau unten wirklich nur eine HOFSEITE (/<slug>) trifft und nie
// /login?vorschau=1 oder /dashboard?vorschau=1. tests/sicherheits-header.test.ts
// gleicht die Liste mit den Ordnern ab; ein neuer Ordner fällt dort auf.
// Dieselbe Menge steht als RESERVED_SLUGS in src/lib/slug.ts, damit kein Hof
// einen dieser Slugs bekommt (tests/reservierte-slugs.test.ts).
const KEINE_HOFSEITE = [
  'account', 'admin', 'agb', 'analytics', 'api', 'bestellungen', 'customers', 'dashboard', 'datenschutz',
  'farm-page', 'fehler-melden', 'forgot-password', 'fuer-hoefe', 'hoefe', 'impressum', 'intern', 'konditionen',
  'login', 'meldungen', 'onboarding', 'orders', 'postfach', 'problem-melden', 'products', 'region', 'register',
  'reset-password', 'sales', 'settings', 'sicherheit', 'startseite-vorschau', 'status', 'teilen', 'verify',
];
// Genau EIN Pfadstück aus Slug-Zeichen (src/lib/slug.ts), das keine Route ist.
const HOFSEITEN_QUELLE = `/:farmSlug((?!(?:${KEINE_HOFSEITE.join('|')})$)[a-z0-9-]+)`;

type Regel = Awaited<ReturnType<NonNullable<NextConfig['headers']>>>[number];

/**
 * Content-Security-Policy ZUM BEOBACHTEN (Register G8, Nr. 125) — der Wert
 * kommt aus src/lib/csp.ts. Nur im Produktions-Build (`next build`; in
 * `next dev` störten die Meldungen nur). Gelesen wird die Umgebung beim
 * Aufruf, also beim Build: VERCEL_ENV und NEXT_PUBLIC_SENTRY_DSN stehen dort.
 *
 * Gemeldet wird nur aus der Produktion; Vorschauen zeigen Verstöße nur in der
 * Konsole. Seiten mit Token, Signatur oder Kennung in der Adresse melden NIE:
 * dieselbe Policy ohne report-uri/report-to als SPÄTERE Regel mit demselben
 * Schlüssel (spätere Regeln überschreiben frühere) — die Seiten mit
 * `no-referrer` oben, die Liste NIE_MELDEN_PFADE und je heiklem Query-Wert
 * eine eigene Regel (`has` verknüpft seine Einträge mit UND). Die Vorschau-
 * Rahmen mit `frame-ancestors` haben einen anderen Schlüssel und bleiben.
 */
function cspRegeln(bisherige: Regel[]): Regel[] {
  if (process.env.NODE_ENV !== 'production') return [];
  const melden = process.env.VERCEL_ENV === 'production';
  const berichtAdresse = melden ? cspBerichtAdresse(process.env.NEXT_PUBLIC_APP_URL) : null;
  const optionen = { toolbar: process.env.VERCEL_ENV === 'preview', sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN };
  const ohneMelden = [{ key: CSP_HEADER, value: baueCsp({ ...optionen, melden: false }) }];
  const ohneReferrer = bisherige
    .filter((regel) => regel.headers.some((h) => h.key === 'Referrer-Policy' && h.value === 'no-referrer'))
    .map((regel) => regel.source);
  return [
    {
      source: '/(.*)',
      headers: [
        { key: CSP_HEADER, value: baueCsp({ ...optionen, melden, berichtAdresse }) },
        // Absolute Adresse aus NEXT_PUBLIC_APP_URL (Begründung bei cspBerichtAdresse).
        ...(berichtAdresse ? [{ key: 'Reporting-Endpoints', value: `${CSP_BERICHT_GRUPPE}="${berichtAdresse}"` }] : []),
      ],
    },
    ...[...ohneReferrer, ...NIE_MELDEN_PFADE].map((source) => ({ source, headers: ohneMelden })),
    ...NIE_MELDEN_PARAMETER.map((key) => ({ source: '/(.*)', has: [{ type: 'query' as const, key }], headers: ohneMelden })),
  ];
}

const nextConfig: NextConfig = {
  // Kein „X-Powered-By: Next.js" in jeder Antwort (Sicherheitsupdate
  // 20.10.2026): Die Auskunft über die Technik braucht niemand, und sie macht
  // eine bekannte Lücke einer Version leichter auffindbar.
  poweredByHeader: false,

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
    // Teilen-Bild (Nr. 69): Die Route liest Schriften und Kategorie-
    // Illustrationen vom Dateisystem (process.cwd()) — der Tracer sieht
    // diese Lesezugriffe nicht. Die Illustrationen liegen seit Nr. 74 auch in
    // einem Unterordner je Kategorie (categories/<kategorie>/<unterkategorie>.webp):
    // `**` trägt sie mit ein, ein einfaches `*.webp` träfe nur die Kategorien.
    // sharp wandelt Fotos und Illustrationen in JPEG, weil Satori kein WebP
    // zeichnet: dieselben Binärpakete wie oben.
    // Der Schlüssel ist ein Glob auf den Routenpfad ohne Gruppe „(public)";
    // die eckigen Klammern sind maskiert, sonst wären sie eine Zeichenklasse.
    // Status-Bild: Die Bildmarke kommt als Datei aus public/marke (Nr. 92), gelesen wie die Schriften unten.
    '/api/status-image/\\[id\\]': ['./public/marke/*.svg'],
    '/\\[farmSlug\\]/opengraph-image': [
      './src/assets/fonts/**/*.ttf',
      './public/categories/**/*.webp',
      './public/marke/*.svg',
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

  // Security-Header (Härtung 2b). Die Content-Security-Policy steht zunächst
  // nur zum Beobachten (Report-Only, Register G8, Nr. 125) — scharf erst nach
  // Auswertung der Meldungen; die Regeln dafür hängt cspRegeln() hinten an.
  async headers() {
    const regeln: Regel[] = [
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
        // Die Bar-Bestätigung (H3) trägt den Einmal-Token im Pfad und zeigt
        // Hof, Positionen und Betrag ohne Anmeldung (S1) — gleiche Regel. Der
        // Mail-Link älterer Mails, der dorthin weiterleitet, ebenso.
        source: '/:farmSlug/bestaetigen/:token',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // „Bestellungen finden" (Nr. 14, S1): Nach dem Code zeigt die Seite
        // Höfe, Beträge und signierte Links zu den Bestellungen der Adresse.
        // Kein Referrer beim Klick hinaus, in keinen Suchindex. Zwischen-
        // speichern verhindert die Seite selbst: Sie liest den Cookie und ist
        // damit dynamisch (Next schickt „private, no-cache, no-store").
        source: '/bestellungen',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // „E-Mail bestätigen" (S3, Nr. 17b): Der Link aus der Mail trägt einen
        // gültigen Token (?token=). Beim Klick hinaus geht er nicht als
        // Referrer mit, und die Seite kommt in keinen Suchindex.
        source: '/verify',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // „Das war ich nicht" (E7, Ergänzung; Nr. 114): Der Link aus der Mail
        // „Neue Anmeldung" trägt einen Einmal-Token (?t=) — gleiche Regel wie
        // /verify: kein Referrer beim Klick hinaus, kein Suchindex.
        source: '/sicherheit/:pfad*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // „Neues Passwort wählen" (Nr. 54): Better Auth leitet den Link aus der
        // Mail mit einem gültigen Token (?token=) hierher — gleiche Regel wie
        // /verify: kein Referrer beim Klick hinaus, kein Suchindex.
        source: '/reset-password',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // „Anmeldung bestätigen" (Double-Opt-in, S11, Nr. 38): Der Link aus der
        // Mail trägt einen gültigen Token (?token=) — gleiche Regel wie /verify.
        source: '/account/neuigkeiten-bestaetigen',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // Der Abmeldelink (?token=) gilt ohne Ablauf — er geht ebenso nicht
        // als Referrer mit und kommt in keinen Suchindex (Nr. 38).
        source: '/account/unsubscribe',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // Die Ein-Klick-Abmeldung (RFC 8058, Nr. 47) trägt denselben Token wie
        // der Abmeldelink — kein Referrer, kein Suchindex.
        source: '/api/abmelden',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/api/orders/confirm/:token',
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
      {
        // Die Vorschau der Startseite (Register N16, Ergänzung 25.10.2026;
        // Nr. 182) hat ihre eigene dynamische Route — die Startseite `/` ist
        // damit überall DENY. Die Adresse trägt den signierten Link (?sig=):
        // kein Referrer beim Klick hinaus, nie zwischengespeichert (die Seite
        // zeigt einen Entwurf nur mit Admin-Sitzung). Was sie zeigt,
        // entscheidet leseStartseitenVorschau (Signatur, Ablauf, Sitzung).
        source: '/startseite-vorschau',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        // Einbetten von uns selbst NUR mit Link (vorschau UND sig — der Wert
        // ist der signierte Inhalt, keine feste Zahl): Admin › Startseite
        // zeigt sie im Rahmen „So sieht’s die Kundin". Ohne Link bleibt DENY.
        source: '/startseite-vorschau',
        has: [
          { type: 'query', key: 'vorschau' },
          { type: 'query', key: 'sig' },
        ],
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
    ];
    return [...regeln, ...cspRegeln(regeln)];
  },

  // Nacharbeit 115: Next schreibt in `next dev` jeden Aufruf einer
  // Server-Funktion samt Argumenten ins Terminal — darunter Anmeldecodes und
  // Adressen. Lokale Logs werden geteilt (Fehlersuche), also aus.
  logging: {
    serverFunctions: false,
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
