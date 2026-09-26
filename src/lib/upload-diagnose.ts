/**
 * Was beim Foto-Upload wirklich schiefging — für Sentry, nie für den Bauern.
 *
 * Anlass JAVASCRIPT-NEXTJS-2: Beide Transfer-Anläufe scheiterten rund zwei
 * Sekunden nach gültiger Kennung, und Sentry sah nur „Verbindung
 * unterbrochen" — der Originalfehler war im letzten catch durch den
 * Netzfehler-Text ersetzt worden. Hier wird er festgehalten: Klasse,
 * bereinigte Nachricht, HTTP-Status wo vorhanden, Dauer — je Anlauf und mit
 * dem Schritt, der scheiterte.
 *
 * DATENSPARSAMKEIT wie in upload-meldung.ts: Fehlertexte können Dateinamen,
 * Ablagepfade und Adressen mit der Hof-Kennung tragen (BlobPathnameMismatchError
 * zitiert den angefragten Pfad). bereinigeFehlerText nimmt sie heraus, bevor
 * etwas das Gerät verlässt. Deshalb auch nie `cause` mit dem Rohfehler setzen:
 * Sentry schickt verkettete Fehler mit, und der Filter in sentry-hygiene.ts
 * erkennt dort E-Mail-Adressen und Blob-Adressen — einen nackten Ablagepfad
 * mit Dateinamen nicht.
 *
 * Rein, ohne DOM und ohne Netz.
 */
import type { TransferUrteil } from './upload-fehler'

/** Der Schritt, an dem ein Upload endgültig scheiterte. */
export type UploadSchritt = 'kennung' | 'uebertragung' | 'abschluss'

/** Was sich über einen gescheiterten Anlauf sagen lässt — schon bereinigt. */
export type AnlaufBefund = { klasse: string; meldung: string; status?: number }

export type UploadAnlauf = AnlaufBefund & { dauerMs: number }

export type UploadDiagnose = { schritt: UploadSchritt; anlaeufe: UploadAnlauf[] }

const BLOB_PRAEFIX = 'Vercel Blob: '

/**
 * Die BlobError-Unterklassen aus @vercel/blob 2.4.0, am Anfang ihrer Meldung
 * erkannt.
 *
 * Der Name hilft nicht: BlobError setzt keinen `name`, die Unterklassen sind
 * namenlose Klassen-Ausdrücke, und der Produktions-Build kürzt die Variablen,
 * an denen sie hängen. Stabil ist nur der Text, den jeder Konstruktor selbst
 * setzt. Ändert ein SDK-Update ihn, wird aus der Klasse 'BlobError' — nie
 * eine falsche.
 */
const BLOB_KLASSEN: ReadonlyArray<readonly [anfang: string, klasse: string]> = [
  ['Access denied', 'BlobAccessError'],
  ['Client token has expired', 'BlobClientTokenExpiredError'],
  ['Content type mismatch', 'BlobContentTypeNotAllowedError'],
  ['Pathname mismatch', 'BlobPathnameMismatchError'],
  ['File is too large', 'BlobFileTooLargeError'],
  ['This store does not exist', 'BlobStoreNotFoundError'],
  ['This store has been suspended', 'BlobStoreSuspendedError'],
  ['Unknown error', 'BlobUnknownError'],
  ['The requested blob does not exist', 'BlobNotFoundError'],
  ['The blob service is currently not available', 'BlobServiceNotAvailable'],
  ['Too many requests', 'BlobServiceRateLimited'],
  ['The request was aborted', 'BlobRequestAbortedError'],
  ['Precondition failed', 'BlobPreconditionFailedError'],
  ['OIDC is enabled', 'BlobOidcEnvironmentNotAllowedError'],
]

/** Die BlobError-Unterklasse eines Fehlers — oder null, wenn er nicht vom SDK kommt. */
export function blobFehlerKlasse(fehler: unknown): string | null {
  if (!(fehler instanceof Error) || !fehler.message.startsWith(BLOB_PRAEFIX)) return null
  const rest = fehler.message.slice(BLOB_PRAEFIX.length)
  return BLOB_KLASSEN.find(([anfang]) => rest.startsWith(anfang))?.[1] ?? 'BlobError'
}

/**
 * Wortlaute, mit denen ein abgerissener Request scheitert — immer als
 * TypeError, je Browser anders. Grundlage ist die Liste in @vercel/blob
 * (is-network-error), ergänzt um den Zeitablauf seines XHR-Wegs und Safaris
 * ältere Texte.
 *
 * Bewusst eine Liste statt „jeder TypeError": Auch ein Programmierfehler ist
 * ein TypeError („Cannot read properties of undefined"). Den als
 * Verbindungsabbruch zu melden, wäre genau die falsche Auskunft, die dieser
 * Fix beseitigt.
 */
const NETZFEHLER_TEXTE = new Set([
  'Failed to fetch', // Chrome
  'NetworkError when attempting to fetch resource.', // Firefox
  'Load failed', // Safari 17+
  'The Internet connection appears to be offline.', // Safari
  'The network connection was lost.', // Safari
  'The request timed out.', // Safari
  'network error',
  'Network request failed', // XHR-Weg des SDK
  'Network request timed out', // XHR-Weg des SDK
  'fetch failed', // Node (undici)
  'terminated', // Node (undici)
])

function istNetzfehler(fehler: unknown): boolean {
  return fehler instanceof Error && fehler.name === 'TypeError' && NETZFEHLER_TEXTE.has(fehler.message)
}

/**
 * Woran der Transfer gescheitert ist — Grundlage der Meldung an den Bauern.
 *
 * `abgebrochen`: Unsere Wächter (Stillstand, Zeitdeckel) haben abgebrochen.
 * Das ist ein Verbindungsproblem, egal in welcher Gestalt der Fehler danach
 * aus dem SDK kommt.
 */
export function ordneTransferFehler(fehler: unknown, abgebrochen: boolean): TransferUrteil {
  if (abgebrochen || istNetzfehler(fehler)) return 'netz'
  const klasse = blobFehlerKlasse(fehler)
  // Den Abbruch meldet das SDK nur, wenn das Signal am Request feuert — und
  // das einzige Signal dort ist das unserer Wächter.
  if (klasse === 'BlobRequestAbortedError') return 'netz'
  // Die Upload-Erlaubnis verweigert hat UNSERE Token-Route (abgelaufene
  // Sitzung, Pfad nicht erlaubt, Serverfehler), nicht der Bildspeicher —
  // „bitte später nochmal" wäre dafür eine falsche Auskunft.
  if (istTokenAbruf(fehler)) return 'unbekannt'
  if (klasse !== null) return 'bildspeicher'
  return 'unbekannt'
}

/**
 * Das SDK hat den Upload-Token bei unserer Route nicht bekommen. Wortlaut aus
 * @vercel/blob 2.4.0 (retrieveClientToken): mit doppeltem Leerzeichen bei
 * einer Ablehnung, mit einfachem, wenn die Antwort kein JSON war.
 */
function istTokenAbruf(fehler: unknown): boolean {
  return fehler instanceof Error && /^Vercel Blob: Failed to {1,2}retrieve the client token/.test(fehler.message)
}

/** Die Klasse eines Fehlers, bei @vercel/blob die Unterklasse. */
export function fehlerKlasse(fehler: unknown): string {
  const blob = blobFehlerKlasse(fehler)
  if (blob) return blob
  if (fehler instanceof Error) return fehler.name.slice(0, 60) || 'Error'
  return typeof fehler
}

const MELDUNG_MAX = 200

/** Ein MIME-Typ wie „image/jpeg" — hat einen Schrägstrich, ist aber kein Pfad. */
const MIME_TYP = /^["'(]?(?:image|application|text|video|audio)\/[a-z0-9.+-]+["')]?[.,;:]?$/i

/**
 * Nimmt aus einem Fehlertext alles heraus, was über den Hof oder die Datei
 * etwas verrät: die übergebenen Werte wörtlich (Dateiname, Hof-Kennung),
 * Adressen, Pfade, E-Mail-Adressen, Bilddateinamen und Kennungen im
 * cuid-Format. Danach gekürzt.
 *
 * Die bekannten Werte kommen zuerst: Ein Dateiname mit Leerzeichen entginge
 * den Mustern darunter zur Hälfte. MIME-Typen bleiben stehen — sie sagen
 * über niemanden etwas und sind bei BlobContentTypeNotAllowedError genau die
 * Auskunft, die gebraucht wird.
 */
export function bereinigeFehlerText(text: string, verborgen: readonly string[] = []): string {
  let sauber = text
  for (const wert of verborgen) {
    if (wert.length >= 3) sauber = sauber.split(wert).join('[entfernt]')
  }
  sauber = sauber
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S*/gi, '[adresse]')
    .replace(/\S*\/\S*/g, (treffer) => (MIME_TYP.test(treffer) ? treffer : '[pfad]'))
    .replace(/[^\s@]+@[^\s@]+/g, '[e-mail]')
    .replace(/\S+\.(?:jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?|dng)\b/gi, '[datei]')
    .replace(/[a-z0-9]{20,}/gi, '[kennung]')
  return sauber.length > MELDUNG_MAX ? `${sauber.slice(0, MELDUNG_MAX)} …` : sauber
}

/**
 * Ein Fehler für den Bauern, der den Befund des Originals mitträgt.
 *
 * Für Stellen, an denen der Text für den Bauern ein anderer ist als der des
 * Originals — die Kennung wirft „Verbindung unterbrochen", wo fetch einen
 * TypeError hatte. Der Befund ist schon bereinigt; das Original selbst reist
 * nicht mit.
 */
export class UploadSchrittFehler extends Error {
  readonly befund: AnlaufBefund

  constructor(text: string, befund: AnlaufBefund) {
    super(text)
    this.befund = befund
  }
}

/** Klasse und bereinigte Nachricht eines gefangenen Fehlers. */
export function befundVon(fehler: unknown, verborgen: readonly string[] = []): AnlaufBefund {
  if (fehler instanceof UploadSchrittFehler) return fehler.befund
  const text = fehler instanceof Error ? fehler.message : typeof fehler === 'string' ? fehler : ''
  return { klasse: fehlerKlasse(fehler), meldung: bereinigeFehlerText(text, verborgen) }
}
