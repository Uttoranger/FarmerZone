/**
 * Ein Knopf für alle Fotos — die Entscheidungen hinter dem Foto-Weg, rein
 * und ohne Browser prüfbar (tests/foto-wege.test.ts).
 *
 * Anlass JAVASCRIPT-NEXTJS-5: dasselbe Foto 16-mal nicht lesbar, sofort mit
 * NotReadableError, Weg „Galerie". Der Bauer musste zwischen Galerie, Dateien
 * und Kamera wählen, ohne den Unterschied zu kennen, und die Meldung „bitte
 * nochmal auswählen" schickte ihn in eine Schleife. Jetzt gibt es zwei
 * Knöpfe (Foto wählen, Foto aufnehmen), und nach einem Lesefehler drei Netze:
 *
 *   Netz 1  Ein zweiter Leseversuch derselben Datei nach einer Pause — nur
 *           bei der sofortigen Ablehnung (Urteil 'erlaubnis'), denn nur dort
 *           kann eine Freigabe zurückkommen. Wer 8 Sekunden stumm blieb,
 *           bleibt es auch nach 1,5 weiteren.
 *   Netz 2  Eine Karte statt einer Meldung: „Anders auswählen" öffnet eine
 *           Eingabe mit breitem accept, damit Android die Dateien-App zeigt
 *           (dort holt Google Fotos ein Cloud-Bild beim Öffnen herunter).
 *   Netz 3  Teilen aus der Galerie an die installierte App.
 *
 * Alles, was hier entscheidet, bekommt seine Eingaben hereingereicht — der
 * User-Agent, die Bytes, das Urteil der Lese-Stufe. Die Komponenten
 * (foto-quellen.tsx, image-upload.tsx) führen nur aus.
 */
import type { UploadZweck } from '@/lib/upload-pfade'
import type { BildFehlerArt, LeseUrteil } from '@/lib/upload-fehler'

/**
 * Über welchen Weg eine Datei kam.
 *   standard  „Foto wählen": accept="image/*", ohne capture — Android zeigt
 *             die Systemfotoauswahl, ab Android 12 mit Cloud-Fotos, die sie
 *             selbst lädt.
 *   kamera    „Foto aufnehmen": capture="environment".
 *   rettung   „Anders auswählen" auf der Karte: breites accept, Dateien-App.
 *   teilen    Teilen aus der Galerie an die installierte App (/teilen).
 */
export type FotoWeg = 'standard' | 'kamera' | 'rettung' | 'teilen'

// ─── Netz 1: der zweite Leseversuch ─────────────────────────────────────────

/**
 * Lohnt nach diesem Urteil ein zweiter Leseversuch derselben Datei? Nur bei
 * der sofortigen Ablehnung: Dort war die Datei da, nur die Freigabe fehlte —
 * und die kann nach einer Pause wieder da sein. Die stumme Quelle ('cloud')
 * hat schon 28 Sekunden gewartet; Unbestimmtes verdient kein Raten.
 */
export function zweiterLeseversuch(urteil: LeseUrteil): boolean {
  return urteil === 'erlaubnis'
}

// ─── Bild an den ersten Bytes ───────────────────────────────────────────────

export type BildFormat = 'jpeg' | 'png' | 'webp' | 'heic'

/**
 * So viele Bytes vom Anfang genügen: JPEG, PNG und WebP entscheiden sich in
 * den ersten zwölf, der ftyp-Kasten von HEIC und AVIF trägt seine Marken
 * dahinter — 64 decken jeden üblichen Kasten.
 */
export const FORMAT_PROBE_BYTES = 64

/**
 * ISO-BMFF-Marken der HEIC/HEIF-Familie (hinter „ftyp"). mif1 und msf1 sind
 * die allgemeinen HEIF-Marken — auch ein AVIF darf sie als Hauptmarke tragen
 * und nennt „avif" dann erst in den Zusatzmarken. Deshalb zählen alle Marken
 * des Kastens, und AVIF sticht: derselbe Behälter, aber ein Bild, das der
 * Server verarbeiten kann.
 */
const HEIC_MARKEN = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif'])
const AVIF_MARKEN = new Set(['avif', 'avis'])

function ascii(bytes: ArrayLike<number>, von: number, bis: number): string {
  let text = ''
  for (let i = von; i < bis; i++) text += String.fromCharCode(bytes[i])
  return text
}

/**
 * Welches Bild in den ersten Bytes steckt — oder null, wenn keines der vier
 * bekannten. Entschieden wird an den Bytes, nie am MIME-Typ: Der kommt vom
 * Auswähler, und die Dateien-App liefert für Unbekanntes
 * „application/octet-stream" oder gar nichts.
 */
export function bildFormat(bytes: ArrayLike<number>): BildFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 4) === 'PNG' &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png'
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp'
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    // Hauptmarke, dann die Zusatzmarken ab Byte 16 bis zum Ende des Kastens
    // (seine Länge steht in den ersten vier Bytes; 0 = bis zum Dateiende).
    const laenge = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
    const ende = Math.min(bytes.length, laenge > 0 ? laenge : bytes.length)
    const marken = [ascii(bytes, 8, 12)]
    for (let i = 16; i + 4 <= ende; i += 4) marken.push(ascii(bytes, i, i + 4))
    if (marken.some((m) => AVIF_MARKEN.has(m))) return null
    if (marken.some((m) => HEIC_MARKEN.has(m))) return 'heic'
  }
  return null
}

/**
 * Was das erkannte Format bedeutet, je nach Weg.
 *   heic       Nie hochladen — der Server kann es nicht (sharp ohne HEIF), und
 *              8 MB für eine sichere Ablehnung wären Verschwendung.
 *   kein-foto  Nur auf dem Rettungsweg: Dort sind auch Nicht-Bilder wählbar.
 *              Auf den anderen Wegen bleibt Unbekanntes wie bisher dem Server
 *              überlassen — er kennt mehr Formate als diese vier.
 *   ok         Weiter zum Upload.
 */
export function formatUrteil(format: BildFormat | null, weg: FotoWeg): 'ok' | 'heic' | 'kein-foto' {
  if (format === 'heic') return 'heic'
  if (format === null && weg === 'rettung') return 'kein-foto'
  return 'ok'
}

// ─── Netz 2: Karte statt Meldung ────────────────────────────────────────────

/** Wofür die Karte steht — sie hat je Grund einen Text und ihre Knöpfe. */
export type KartenGrund = 'lesen' | 'heic' | 'kein-foto'

/**
 * Was nach einem gescheiterten Foto als Nächstes kommt: die Karte für alles,
 * was am Foto oder am Weg liegt, die gewohnte Meldung für Übertragung und
 * Server — die sagen nichts über das Foto, und beim nächsten Versuch im WLAN
 * läuft dieselbe Datei durch.
 */
export function naechsterSchritt(art: BildFehlerArt | null): { art: 'karte'; grund: KartenGrund } | { art: 'meldung' } {
  if (art === 'lesen' || art === 'heic' || art === 'kein-foto') return { art: 'karte', grund: art }
  return { art: 'meldung' }
}

/**
 * Dieselbe Datei noch einmal über „Foto wählen" nach einem Fehler: sofort die
 * Karte, kein neuer Versuch. Größe und Typ genügen — der Name ist auf Android
 * oft nur eine Nummer, und lastModified setzt die Galerie auf den
 * Auswahlzeitpunkt.
 */
export function gleicheDatei(a: { size: number; type: string }, b: { size: number; type: string }): boolean {
  return a.size === b.size && a.type === b.type
}

export type Fehlschlag = { size: number; type: string }

/**
 * Nach einer Auswahl: sofort die Karte, ohne Versuch — wenn genau eine
 * Datei über „Foto wählen" kam und einem gemerkten Fehlschlag gleicht. Über
 * die Rettung oder die Kamera wird immer versucht: Das ist ja der Ausweg.
 */
export function sofortKarte(weg: FotoWeg, dateien: readonly Fehlschlag[], gemerkt: readonly Fehlschlag[]): boolean {
  return weg === 'standard' && dateien.length === 1 && gemerkt.some((g) => gleicheDatei(dateien[0], g))
}

/**
 * Was nach einer Karte gemerkt wird: nur die unlesbaren Dateien. HEIC und
 * „kein Foto" brauchen keinen Merker — ihre Karte kommt ohnehin sofort, an
 * den ersten Bytes, ohne Pause.
 */
export function zuMerken(grund: KartenGrund, dateien: readonly Fehlschlag[]): Fehlschlag[] {
  return grund === 'lesen' ? dateien.map(({ size, type }) => ({ size, type })) : []
}

export type SerienFall = { grund: KartenGrund; urteil: LeseUrteil }

/**
 * Das Ende einer Serie (mehrere Fotos): Die lesbaren sind durch, für die
 * anderen kommt die Karte — unlesbare zuerst, weil dort „Anders auswählen"
 * hilft; sonst der erste Grund. Die Sammelmeldung entfällt nur, wenn die
 * Karte wirklich alles sagt: nichts hochgeladen, nichts aus anderem Grund
 * übersprungen, alle Fälle mit demselben Grund.
 */
export function serienAbschluss(eingabe: {
  hochgeladen: number
  uebersprungen: number
  faelle: readonly SerienFall[]
}): { sammelmeldung: boolean; karte: { grund: KartenGrund; urteil: LeseUrteil; anzahl: number } | null } {
  const { hochgeladen, uebersprungen, faelle } = eingabe
  if (faelle.length === 0) return { sammelmeldung: true, karte: null }
  const lesen = faelle.filter((f) => f.grund === 'lesen')
  const erster = lesen[0] ?? faelle[0]
  const gleiche = faelle.filter((f) => f.grund === erster.grund)
  const karteSagtAlles = hochgeladen === 0 && uebersprungen === faelle.length && gleiche.length === faelle.length
  return {
    sammelmeldung: !karteSagtAlles,
    karte: { grund: erster.grund, urteil: erster.urteil, anzahl: gleiche.length },
  }
}

// ─── Netz 3: Teilen an die App ──────────────────────────────────────────────

/**
 * Der Satz auf der Karte: Teilen geht nur, wo /teilen das Foto hinbringen
 * kann (Titelbild, Hofgalerie), nur auf Android (das iPhone kennt kein
 * Teilen-Ziel) — als Anleitung in der installierten App, sonst als Hinweis,
 * wie man sie installiert.
 */
export function teilenHinweis(eingabe: {
  zweck: UploadZweck
  android: boolean
  installiert: boolean
}): 'teilen' | 'installieren' | null {
  if (!eingabe.android) return null
  if (eingabe.zweck !== 'banner' && eingabe.zweck !== 'gallery') return null
  return eingabe.installiert ? 'teilen' : 'installieren'
}

// ─── Diagnose: welches Android ──────────────────────────────────────────────

export type AndroidAuskunft = { android: boolean; version: number | null }

/**
 * Die Android-Hauptversion für Sentry.
 *
 * Chrome nennt im User-Agent seit Version 110 für JEDES Android „Android 10;
 * K" — das „Android 10" in JAVASCRIPT-NEXTJS-5 ist diese Einheitsangabe und
 * sagt nichts. Die echte Version steht nur in den Client Hints
 * (platformVersion, etwa „13.0.0"); ohne sie gilt die Einheitsangabe als
 * unbekannt. Ein alter Chrome vor 110 nennt die Version noch echt, mit dem
 * Gerätenamen statt „K".
 */
export function androidAuskunft(eingabe: {
  userAgent: string
  platform?: string
  platformVersion?: string
}): AndroidAuskunft {
  const android = eingabe.platform === 'Android' || /\bAndroid\b/.test(eingabe.userAgent)
  if (!android) return { android: false, version: null }

  const hint = /^(\d+)/.exec(eingabe.platformVersion ?? '')
  if (hint) return { android: true, version: Number(hint[1]) }

  const ua = /\bAndroid (\d+)(?:\.\d+)*; ([^;)]+)/.exec(eingabe.userAgent)
  if (!ua) return { android: true, version: null }
  const einheitsangabe = ua[1] === '10' && ua[2].trim() === 'K'
  return { android: true, version: einheitsangabe ? null : Number(ua[1]) }
}
