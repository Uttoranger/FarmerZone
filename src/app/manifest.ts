import type { MetadataRoute } from 'next'
import { MARKE } from '@/lib/marke'

/**
 * Web-App-Manifest — macht die App am Handy installierbar und, das ist
 * der eigentliche Zweck, zum TEILEN-ZIEL: Androids Galerie stellt beim
 * Teilen die Bytes selbst bereit (inklusive Cloud-Abruf) — genau der Weg,
 * auf dem cloud-ausgelagerte Fotos zuverlässig ankommen, während der
 * Datei-Picker für sie tote Referenzen liefert.
 *
 * Die Icons kommen aus `pnpm marke` (scripts/marke.ts; Register M1, Nr. 92)
 * aus den zwei Marken-SVG unter public/marke — nichts wird von Hand erzeugt:
 * 192 und 512 für Startbildschirm und Splash-Screen (purpose any, Kachel mit
 * 22 % Rundung), dazu die maskierbare Fassung mit der Zeichnung in der
 * inneren 80-%-Zone, die Android in Kreis oder Tropfen beschneiden darf.
 * Das Favicon (src/app/favicon.ico) und das Apple-Icon (src/app/apple-icon.png)
 * gehören NICHT hierher: Sie wirken über Nexts Dateikonvention als <link> im
 * Kopf jeder Seite. tests/manifest.test.ts prüft, dass jedes Icon hier in
 * public/ liegt und die angegebene Größe hat.
 *
 * Farben aus den Haus-Tokens (globals.css), in Hex umgerechnet:
 * --primary oklch(0.30 0.082 155) → #00391A (theme_color). background_color
 * ist --fz-bg des dunklen Themes (#0B100C): Ein Manifest kennt nur eine Farbe,
 * und der Start-Bildschirm der installierten App darf bei Nacht nicht weiß
 * aufblitzen; hell auf dunkel zu starten ist der mildere Fehler als umgekehrt.
 * tests/manifest.test.ts hält den Wert gegen globals.css.
 *
 * start_url ist /app (Register N31, src/app/app/route.ts): Die Route leitet
 * nach der Sitzung weiter (Hof, Admin, sonst Startseite) — ein Manifest für
 * beide Welten. id und scope halten die Installation stabil, wenn sich die
 * Start-Adresse einmal ändert.
 *
 * TYP-VERANKERUNG: share_target ist Teil des OFFIZIELLEN Next-Typs
 * MetadataRoute.Manifest (next/dist/lib/metadata/types/manifest-types.d.ts,
 * `share_target?` mit `params.files` als `{ name, accept }` — Stand Next
 * 16.4.2) — kein Cast, keine strukturelle Lücke. Sollte ein Next-Update das
 * Feld je entfernen, schlägt `pnpm typecheck` GENAU HIER an, statt das
 * Teilen-Ziel lautlos wegzutypisieren.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARKE,
    short_name: MARKE,
    description: 'Regionale Lebensmittel direkt vom Bauern.',
    display: 'standalone',
    id: '/',
    scope: '/',
    lang: 'de-AT',
    start_url: '/app',
    theme_color: '#00391A',
    background_color: '#0B100C',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Die drei Wege, die ein Hof am Handy am häufigsten nimmt (lange auf das
    // App-Symbol drücken); alle hinter der Anmeldung des Hofbereichs.
    shortcuts: [
      { name: 'Heute', url: '/dashboard', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Neuer Beitrag', url: '/status/new', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Bestellungen', url: '/orders', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
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
