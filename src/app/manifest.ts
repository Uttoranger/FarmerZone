import type { MetadataRoute } from 'next'

/**
 * Web-App-Manifest — macht FarmerZone am Handy installierbar und, das ist
 * der eigentliche Zweck, zum TEILEN-ZIEL: Androids Galerie stellt beim
 * Teilen die Bytes selbst bereit (inklusive Cloud-Abruf) — genau der Weg,
 * auf dem cloud-ausgelagerte Fotos zuverlässig ankommen, während der
 * Datei-Picker für sie tote Referenzen liefert.
 *
 * Die Icons sind das VORHANDENE Favicon: die 256er-Ebene daraus 1:1 als PNG
 * extrahiert (public/app-icon-256.png), nichts neu gestaltet. Ein eigenes
 * 512er-Icon existiert im Repo nicht — fürs Installieren genügt 256,
 * lediglich der Splash-Screen bliebe damit einfacher.
 *
 * Farben aus den Haus-Tokens (globals.css), in Hex umgerechnet:
 * --primary oklch(0.30 0.082 155) → #00391A, --background → #F8F2E5.
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
      { src: '/app-icon-256.png', sizes: '256x256', type: 'image/png' },
      { src: '/favicon.ico', sizes: '48x48 32x32 16x16', type: 'image/x-icon' },
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
