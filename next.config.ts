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
  // Verarbeitungs-Funktion gepackt. Die Muster greifen auch im pnpm-Layout
  // (node_modules/sharp und die @img-Pakete sind dort Symlinks in den
  // .pnpm-Store) — nachgeprüft am Tracing-Manifest der Route: Die .so-Dateien
  // stehen erst mit diesen Einträgen darin.
  outputFileTracingIncludes: {
    '/api/upload/verarbeiten': [
      './node_modules/@img/**/*',
      './node_modules/sharp/**/*',
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
