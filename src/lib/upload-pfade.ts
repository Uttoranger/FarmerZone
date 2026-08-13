// Zwecke, Speicherpfade und der URL-Guard des Foto-Uploads.
//
// Bewusst ein eigenes, reines Modul: Client (Hook), Token-Route und
// Verarbeitungs-Route brauchen dieselben Werte, und keiner von ihnen darf sie
// eigenmächtig anders auslegen. Ohne DOM und ohne Datenbank — damit prüfbar.

/** Wofür ein Foto hochgeladen wird. Bestimmt Zielpfad und Auflösung. */
export type UploadZweck = 'product' | 'banner' | 'logo' | 'gallery' | 'status'

export const UPLOAD_ZWECKE: readonly UploadZweck[] = [
  'product',
  'banner',
  'logo',
  'gallery',
  'status',
] as const

export function istUploadZweck(wert: unknown): wert is UploadZweck {
  return typeof wert === 'string' && (UPLOAD_ZWECKE as readonly string[]).includes(wert)
}

/**
 * Längste Kante nach dem Verkleinern, je Zweck.
 *
 * WERTE UNVERÄNDERT aus der bisherigen clientseitigen MAX_LONG_SIDE-Tabelle
 * übernommen — dieser Sprint verlagert die Verkleinerung auf den Server, er
 * ändert nicht, wie groß die Bilder werden.
 *
 * `banner` liegt seit dem Cover-Sprint höher als der Rest: Das Titelbild ist
 * das einzige Bild, das über die VOLLE Bildschirmbreite läuft (sizes="100vw").
 * Auf einem 1920er-Monitor mit doppelter Pixeldichte fragt der Browser 3840px
 * an — bei 2400px Quelle bekäme er hochskalierte Pixel.
 */
export const MAX_LONG_SIDE: Record<UploadZweck, number> = {
  logo: 800,
  product: 2400,
  banner: 3200,
  gallery: 2400,
  status: 2400,
}

/** WebP-Qualität der Verkleinerung. Wert wie in der bisherigen Canvas-Fassung. */
export const WEBP_QUALITAET = 82

/** Obergrenze für das hochgeladene ORIGINAL. Kein Verkleinern mehr davor. */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024

/**
 * Wo das unverarbeitete Original landet.
 *
 * Der Hof im Pfad ist kein Ordnungsschema, sondern die Grundlage des Guards
 * weiter unten: Nur wer den Pfad seines eigenen Hofes anfragt, bekommt einen
 * Token — und nur was in diesem Pfad liegt, wird später verarbeitet.
 */
export function originalPrefix(farmId: string): string {
  return `originals/${farmId}/`
}

/** Vollständiger Ablagepfad für ein Original. */
export function originalPfad(farmId: string, zweck: UploadZweck, dateiname: string): string {
  // Der Dateiname stammt vom Gerät des Bauern und wird auf Unbedenkliches
  // reduziert. Zwei Schritte, beide nötig:
  //   1. Alles außer Buchstaben, Ziffern, Punkt, Strich und Unterstrich wird
  //      ersetzt — damit fallen Schrägstriche weg, der Name kann seinen Ordner
  //      also nicht verlassen.
  //   2. Mehrere Punkte hintereinander werden zu einem. Ein „..“ käme sonst
  //      unversehrt durch (Punkte sind ja erlaubt) und stünde als „..“ im
  //      Pfad — harmlos, weil ohne Schrägstrich, aber es sieht nach einem
  //      Ausbruchsversuch aus und verwirrt jedes Werkzeug, das später
  //      draufschaut.
  const sauber =
    dateiname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .slice(-80) || 'foto'
  return `${originalPrefix(farmId)}${zweck}/${sauber}`
}

/** Wo die fertigen Bilder liegen — Schema unverändert wie bisher. */
export function zielPrefix(farmId: string): string {
  return `farms/${farmId}/`
}

/** Zielpfad des fertigen Bildes — Schema unverändert wie bisher. */
export function zielPfad(farmId: string, zweck: UploadZweck): string {
  return `${zielPrefix(farmId)}${zweck}/${Date.now()}.webp`
}

/** Host-Muster des eigenen Blob-Speichers. */
const BLOB_HOST = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i

/**
 * Darf diese URL für diesen Hof verarbeitet werden?
 *
 * Zwei Bedingungen, beide notwendig:
 *   1. Die URL zeigt auf unseren eigenen Blob-Speicher. Sonst ließe sich die
 *      Verarbeitungs-Route als Werkzeug missbrauchen, beliebige fremde Adressen
 *      abzurufen — der Server würde für einen Angreifer Netzwerkzugriffe tun.
 *   2. Der Pfad liegt unter `originals/{farmId}/` GENAU DIESES Hofes. Sonst
 *      könnte ein angemeldeter Bauer die Originale eines anderen Hofes
 *      verarbeiten und sich als eigenes Bild ablegen lassen.
 *
 * Reine Funktion, kein Netzzugriff — deshalb ohne Browser und ohne Datenbank
 * prüfbar. Sie entscheidet, bevor irgendetwas geladen wird.
 */
export function darfVerarbeitetWerden(url: string, farmId: string): boolean {
  return liegtImEigenenPfad(url, originalPrefix(farmId))
}

/**
 * Darf dieses alte Bild beim Ersetzen gelöscht werden?
 *
 * Dieselbe Logik, nur auf den Zielordner statt den Originale-Ordner. Ohne die
 * Hof-Prüfung ließe sich die Verarbeitungs-Route zum Löschen fremder Bilder
 * missbrauchen — die alte Route prüfte hier nur den Host.
 */
export function darfGeloeschtWerden(url: string, farmId: string): boolean {
  return liegtImEigenenPfad(url, zielPrefix(farmId))
}

function liegtImEigenenPfad(url: string, prefix: string): boolean {
  let zerlegt: URL
  try {
    zerlegt = new URL(url)
  } catch {
    return false
  }

  if (zerlegt.protocol !== 'https:') return false
  if (!BLOB_HOST.test(zerlegt.hostname)) return false

  // `pathname` beginnt mit „/", der Blob-Pfad nicht.
  const pfad = decodeURIComponent(zerlegt.pathname).replace(/^\/+/, '')

  // Kein `includes`: Der Präfix muss am ANFANG stehen. Sonst genügte ein Pfad
  // wie `originals/fremd/originals/meineId/…`, um die Prüfung zu bestehen.
  return pfad.startsWith(prefix)
}
