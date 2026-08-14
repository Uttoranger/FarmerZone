import type { NextConfig } from "next";

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
          // Wir nutzen weder Kamera noch Mikro noch Standort
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
};

export default nextConfig;
