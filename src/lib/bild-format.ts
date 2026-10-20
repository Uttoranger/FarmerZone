// Welche Bilder sharp in der Upload-Verarbeitung sehen darf (Sicherheitsupdate 20.10.2026).
//
// Nur JPEG, PNG, WebP und HEIF/HEIC. Entschieden wird an den Bytes, bevor
// sharp die Datei anfasst: Schon `metadata()` liest den Kopf mit dem Lader von
// libvips — bei SVG wäre das librsvg, also genau die Stelle, die geschützt
// werden soll. Eine Prüfung über `metadata().format` käme zu spät. Der Name
// der Datei und der gemeldete MIME-Typ zählen nicht; beides kann der Browser
// beliebig behaupten.
//
// Das Format erkennt `bildFormat` (foto-wege.ts) — dieselbe Erkennung wie im
// Browser. Hier kommt nur dazu, was der Server zusätzlich braucht. Ohne
// natives Modul (nur Node-Buffer): Die Route ruft es vor JEDEM sharp(), die
// Tests laufen ohne sharp.

import { bildFormat, type BildFormat } from '@/lib/foto-wege'

/**
 * Höchstens so viele Pixel liest sharp ein (`limitInputPixels`). 50 Millionen
 * reichen für jedes Handyfoto (ein 48-MP-Sensor liefert rund 48 Millionen) und
 * halten Speicher und Rechenzeit der Verarbeitungs-Route begrenzt.
 */
export const BILD_PIXEL_GRENZE = 50_000_000

/**
 * So meldet sharp ein Bild über `limitInputPixels` — schon beim Lesen des
 * Kopfs (`metadata()`), bevor eine eigene Prüfung der Kanten laufen könnte.
 * Am Text erkennt die Route, dass das Foto zu groß ist und nicht unlesbar.
 */
export const PIXEL_GRENZE_FEHLER = 'Input image exceeds pixel limit'

/** Hat sharp das Bild wegen der Pixelgrenze abgelehnt? Jeder andere Fehler bleibt ein Formatfehler. */
export function istPixelGrenzeFehler(fehler: unknown): boolean {
  return fehler instanceof Error && fehler.message === PIXEL_GRENZE_FEHLER
}

/** „av1C": der Kasten mit der AV1-Konfiguration. Ohne ihn dekodiert libheif kein AV1. */
const AV1_KONFIGURATION = 'av1C'

/**
 * Steht die Folge irgendwo in den Bytes? Über Buffer.indexOf (nativ, linear):
 * Eine Schleife in JavaScript hielte bei 25 MB voller „a" den Event-Loop gut
 * eine Sekunde auf.
 */
function enthaelt(b: Uint8Array, folge: string): boolean {
  return Buffer.from(b.buffer, b.byteOffset, b.byteLength).indexOf(folge, 0, 'latin1') >= 0
}

/**
 * Das Format, wenn sharp die Bytes sehen darf — sonst null (SVG, GIF, TIFF,
 * AVIF, Video, Text, alles Unbekannte).
 *
 * AVIF steckt im selben Container wie HEIC, und der HEIF-Lader von libvips
 * liest es mit. Die Marken vorne kann man umschreiben; dann sähe ein AVIF aus
 * wie ein Handyfoto. Den Kasten `av1C` braucht libheif aber zum Dekodieren —
 * steht er irgendwo in einer HEIF-Datei, bleibt sie draußen.
 */
export function formatFuerSharp(bytes: ArrayBuffer | Uint8Array): BildFormat | null {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const format = bildFormat(b)
  if (format === 'heic' && enthaelt(b, AV1_KONFIGURATION)) return null
  return format
}

/**
 * Die Lader von libvips, die sharp nach der Sperre noch benutzen darf — je die
 * Elternklasse, damit Datei-, Puffer- und Quell-Lader mitgehen. Namen nach der
 * sharp-Doku (`sharp.block`/`sharp.unblock`) und den Klassen in libvips;
 * tests/sharp-lader-sperre.test.ts liest je ein Bild über jeden.
 *
 * VipsForeignLoadHeif liest auch AVIF — das hält formatFuerSharp ab. HEIC
 * selbst kann das vorgebaute sharp nicht dekodieren (kein HEVC); ein echtes
 * HEIC-Foto endet weiter mit „Format nicht lesbar" (der Browser lädt HEIC
 * ohnehin nicht hoch, image-upload.tsx).
 */
export const SHARP_LADER_ERLAUBT = ['VipsForeignLoadJpeg', 'VipsForeignLoadPng', 'VipsForeignLoadWebp', 'VipsForeignLoadHeif'] as const

type LaderSperre = {
  block(optionen: { operation: string[] }): void
  unblock(optionen: { operation: string[] }): void
}

/**
 * Sperrt alle Lader von libvips und gibt nur die vier erlaubten frei — die
 * dritte Schicht hinter Token und formatFuerSharp: Rutscht doch einmal etwas
 * anderes durch, lehnt libvips es ab, statt es zu lesen. Gilt für den ganzen
 * Prozess — deshalb nur dort aufrufen, wo ausschließlich Fotos dieser Formate
 * gelesen werden (Verarbeitungs-Route der Uploads; tests/sharp-wache.test.ts).
 */
export function sperreFremdeLader(sharp: LaderSperre): void {
  sharp.block({ operation: ['VipsForeignLoad'] })
  sharp.unblock({ operation: [...SHARP_LADER_ERLAUBT] })
}
