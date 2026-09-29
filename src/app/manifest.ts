import type { MetadataRoute } from 'next'

/**
 * Web-App-Manifest — macht FarmerZone am Handy installierbar und, das ist
 * der eigentliche Zweck, zum TEILEN-ZIEL: Androids Galerie stellt beim
 * Teilen die Bytes selbst bereit (inklusive Cloud-Abruf) — genau der Weg,
 * auf dem cloud-ausgelagerte Fotos zuverlässig ankommen, während der
 * Datei-Picker für sie tote Referenzen liefert.
 *
 * Die Icons (Sprint „Marke und Startseite aus einem Guss"): 192 und 512 für
 * Startbildschirm und Splash-Screen (purpose any), dazu eine maskierbare
 * Fassung mit Schutzrand, die Android in Kreis oder Tropfen beschneiden darf.
 * Das Favicon (src/app/favicon.ico) und das Apple-Icon (src/app/apple-icon.png)
 * gehören NICHT hierher: Sie wirken über Nexts Dateikonvention als <link> im
 * Kopf jeder Seite. tests/manifest.test.ts prüft, dass jedes Icon hier in
 * public/ liegt und die angegebene Größe hat.
 *
 * Farben aus den Haus-Tokens (globals.css), in Hex umgerechnet:
 * --primary oklch(0.30 0.082 155) → #00391A, --background → #F8F2E5.
 *
 * TYP-VERANKERUNG: share_target ist Teil des OFFIZIELLEN Next-Typs
 * MetadataRoute.Manifest (next/dist/lib/metadata/types/manifest-types.d.ts,
 * `share_target?` mit `params.files` als `{ name, accept }` — Stand Next
 * 16.2.6) — kein Cast, keine strukturelle Lücke. Sollte ein Next-Update das
 * Feld je entfernen, schlägt `pnpm typecheck` GENAU HIER an, statt das
 * Teilen-Ziel lautlos wegzutypisieren.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FarmerZone',
    short_name: 'FarmerZone',
    description: 'Regionale Lebensmittel direkt vom Bauern.',
    display: 'standalone',
    start_url: '/dashboard',
    theme_color: '#00391A',
    background_color: '#F8F2E5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    share_target: {
      action: '/teilen',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        files: [{ name: 'foto', accept: ['image/*'] }],
      },
    },
  }
}
