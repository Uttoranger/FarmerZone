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
import type { LeseUrteil, TransferUrteil } from './upload-fehler'

/** Der Schritt, an dem ein Upload endgültig scheiterte. */
export type UploadSchritt = 'kennung' | 'uebertragung' | 'abschluss'

/** Was sich über einen gescheiterten Anlauf sagen lässt — schon bereinigt. */
export type AnlaufBefund = { klasse: string; meldung: string; status?: number }

export type UploadAnlauf = AnlaufBefund & { dauerMs: number }

export type UploadDiagnose = { schritt: UploadSchritt; anlaeufe: UploadAnlauf[] }

/**
 * Ein Leseversuch der Lese-Stufe (JAVASCRIPT-NEXTJS-3).
 * 'zeitlimit': Die Datei blieb stumm, bis unser Wächter aufgab — typisch für
 * ein hängendes Cloud-Album. 'fehler': Der Browser hat abgelehnt, meist sofort
 * (NotReadableError, NotFoundError) — typisch für eine entzogene Berechtigung.
 * Klasse und Meldung gibt es nur bei 'fehler', schon bereinigt.
 */
export type LeseVersuch =
  | { ergebnis: 'ok' | 'zeitlimit'; dauerMs: number }
  | { ergebnis: 'fehler'; klasse: string; meldung: string; dauerMs: number }

export type LeseErgebnis = LeseVersuch['ergebnis']

/**
 * Was die Lese-Stufe über die Datei herausfand: die 64-KB-Probe, nur wenn sie
 * scheiterte das Volllesen, und nur nach einer sofortigen Ablehnung der
 * zweite Versuch nach der Pause (Netz 1, foto-wege.ts).
 *
 * `kopie` ist das ganze Lesen für die Kopie im Speicher (JAVASCRIPT-NEXTJS-6)
 * — nur, wenn es ein eigener Versuch war: Brachte schon das Volllesen die
 * Datei, ist das die Kopie.
 *
 * Kein Dateialter mehr: Android setzt lastModified bei Galerie-Fotos auf den
 * Auswahlzeitpunkt — die Zahl sagte nichts.
 */
export type LeseDiagnose = {
  probe: LeseVersuch
  voll?: LeseVersuch
  zweiterVersuch?: LeseVersuch
  kopie?: LeseVersuch
}

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
 * Der Name, den ein Fehler trägt — auch von einer DOMException, die kein Error
 * ist (ältere Safari-Stände). Wirft nie; ein Getter, der selbst scheitert, ist
 * dasselbe wie kein Name.
 */
function fehlerName(fehler: unknown): string | null {
  try {
    if (typeof fehler !== 'object' || fehler === null) return null
    const name = (fehler as { name?: unknown }).name
    return typeof name === 'string' && name ? name : null
  } catch {
    // Absichtlich leer: Ein Fehler, der sich nicht lesen lässt, hat keinen Namen.
    return null
  }
}

/**
 * Die Datei gibt ihre Bytes nicht mehr her, weil die FREIGABE weg ist — nicht,
 * weil eine Leitung abriss.
 *
 * So meldet es der Browser: `NotReadableError` mit dem Satz „The requested file
 * could not be read, typically due to permission problems that have occurred
 * after a reference to a file was acquired." (JAVASCRIPT-NEXTJS-4). Der
 * Textvergleich steht daneben für den Fall, dass der Fehler durch eine fremde
 * Schicht gereist ist und nur seine Nachricht behalten hat — etwa aus dem
 * Blob-SDK, das die Datei in Teilstücken selbst liest.
 *
 * BEKANNTE UNSCHÄRFE: Chrome meldet einen Leseverlust während eines `fetch`
 * auch als „Failed to fetch". Dieser Fall bleibt ein Netzfehler; ihn zusätzlich
 * zu beanspruchen hieße, jeden echten Abbruch zur entzogenen Freigabe zu
 * erklären — genau die falsche Auskunft, die #129 und #135 beseitigen.
 */
export function istLeseVerlust(fehler: unknown): boolean {
  if (fehlerName(fehler) === 'NotReadableError') return true
  const text = fehler instanceof Error ? fehler.message : ''
  return /NotReadableError|file could not be read/i.test(text)
}

/**
 * Wie lange eine Ablehnung höchstens gebraucht haben darf, um noch als
 * „sofort" zu gelten.
 *
 * Eine verweigerte Freigabe fällt beim ersten Zugriff auf die Referenz — in
 * Millisekunden (belegt: 84 und 14 ms). Wer dagegen erst nach Sekunden
 * ablehnt, hat unterwegs etwas versucht, und dann ist die Freigabe nicht die
 * nächstliegende Erklärung.
 *
 * Steht hier und nicht bei den übrigen Zeitwerten in upload-zeitwaechter.ts:
 * Die Datei importiert diese hier (`blobFehlerKlasse`), der umgekehrte Weg wäre
 * ein Ringschluss.
 */
export const LESE_SOFORT_MS = 1_000

/**
 * Woran die Lese-Stufe gescheitert ist — Grundlage der Meldung an den Bauern.
 *
 * Bis #133 bekam jeder Lesefehler den Cloud-Album-Text. JAVASCRIPT-NEXTJS-4
 * zeigte, dass das falsch sein kann: Probe und Volllesen scheiterten nach 84
 * und 14 ms mit NotReadableError, an einem Foto, das 0 Tage alt war. Kein
 * Cloud-Abruf wartet 84 ms — dort war die FREIGABE weg, nicht die Datei
 * ausgelagert.
 *
 * Die Reihenfolge ist die Beweiskraft: Ein Ablauf am Zeitwächter ist die
 * eindeutigste Aussage (etwas hat gewartet), deshalb steht er vorn — auch wenn
 * der andere Versuch daneben sofort abgelehnt hat.
 *
 * Für die Dauer gilt „alle", für die Klasse „mindestens einer": Ein entzogener
 * Zugriff sieht auf den zwei Lesewegen verschieden aus (NotReadableError hier,
 * NotFoundError dort), aber wer sekundenlang gewartet hat, hat unterwegs etwas
 * versucht — und dann ist die Freigabe nicht die nächstliegende Erklärung.
 *
 * Das ALTER der Datei geht bewusst NICHT ein, obwohl es im Issue der
 * auffälligste Wert war: Manche Speicherdienste liefern kein `lastModified`
 * (dann ist es null), und auch ein altes Foto kann sofort abgelehnt werden. Es
 * bleibt Diagnose für Sentry, keine Bedingung für den Text.
 *
 * Die Kopie zählt wie das Volllesen: Scheitert sie, nachdem die Probe
 * gelang, ist die Datei genauso wenig herausgekommen.
 */
export function ordneLeseFehler(lesen: LeseDiagnose): LeseUrteil {
  const versuche = [lesen.probe, lesen.voll, lesen.kopie].filter((v): v is LeseVersuch => v !== undefined)
  if (versuche.some((v) => v.ergebnis === 'zeitlimit')) return 'cloud'

  const gescheitert = versuche.filter((v) => v.ergebnis === 'fehler')
  if (gescheitert.length === 0) return 'unbestimmt'
  const sofort = gescheitert.every((v) => v.dauerMs < LESE_SOFORT_MS)
  const freigabe = gescheitert.some((v) => v.ergebnis === 'fehler' && v.klasse === 'NotReadableError')
  return sofort && freigabe ? 'erlaubnis' : 'unbestimmt'
}

/**
 * Woran der Transfer gescheitert ist — Grundlage der Meldung an den Bauern.
 *
 * `abgebrochen`: Unsere Wächter (Stillstand, Zeitdeckel) haben abgebrochen.
 * Das ist ein Verbindungsproblem, egal in welcher Gestalt der Fehler danach
 * aus dem SDK kommt.
 */
export function ordneTransferFehler(fehler: unknown, abgebrochen: boolean): TransferUrteil {
  if (abgebrochen) return 'netz'
  // Die Datei war in Stufe 0 lesbar und ist es jetzt nicht mehr: Dazwischen hat
  // das Gerät die Freigabe zurückgezogen (#135). Vor der Netzfehler-Prüfung,
  // weil das SDK dieselbe Ablehnung auch beim Lesen eines Teilstücks bekommt.
  if (istLeseVerlust(fehler)) return 'lesen'
  if (istNetzfehler(fehler)) return 'netz'
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

/** Ein Fehlername, wie Browser ihn setzen — alles andere könnte etwas tragen. */
const BEZEICHNER = /^[A-Za-z][A-Za-z0-9_]{0,59}$/

/**
 * Klasse und bereinigte Nachricht eines Lesefehlers. Anders als befundVon
 * nimmt es Name und Nachricht auch von einer DOMException, die kein Error ist
 * — in älteren Safari-Ständen erbt sie nicht von Error, und gerade ihr Name
 * (NotReadableError, NotFoundError) ist hier die Auskunft.
 *
 * Wirft nie: Es läuft im catch der Lese-Stufe, und ein Fehler hier ersetzte
 * dem Bauern den Wegweiser. Die Klasse geht nur durch, wenn sie wie ein Name
 * aussieht — sie wird sonst nicht bereinigt.
 */
export function leseFehlerBefund(fehler: unknown, verborgen: readonly string[] = []): AnlaufBefund {
  try {
    let befund: AnlaufBefund
    if (fehler instanceof Error || typeof fehler !== 'object' || fehler === null) {
      befund = befundVon(fehler, verborgen)
    } else {
      const { name, message } = fehler as { name?: unknown; message?: unknown }
      befund = {
        klasse: typeof name === 'string' && name ? name : fehlerKlasse(fehler),
        meldung: bereinigeFehlerText(typeof message === 'string' ? message : '', verborgen),
      }
    }
    return { ...befund, klasse: BEZEICHNER.test(befund.klasse) ? befund.klasse : 'unbekannt' }
  } catch {
    // Absichtlich leer im Ergebnis: Ein Fehler, der sich nicht einmal lesen
    // lässt, hat keine Auskunft — aber die Lese-Stufe muss weiterlaufen.
    return { klasse: 'unbekannt', meldung: '' }
  }
}
