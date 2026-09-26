/**
 * Zeitwächter für den Foto-Upload — kein Schritt darf ewig „laden" zeigen.
 *
 * Seit der Server-Umstellung (#64/#65) besteht ein Upload aus drei awaits,
 * die alle ohne eigenes Ende dastehen konnten: das Lesen aus dem
 * Speicherdienst, der Transfer in den Blob-Speicher, der Verarbeiten-Aufruf.
 * Defekte Android-Speicherdienste bleiben beim Lesen stumm stehen — weder
 * Bytes noch Fehler —, und dann feuert auch das finally nie, das den
 * Ladezustand beendet: Der Bauer sieht für immer „Lädt…".
 *
 * Reine Logik ohne DOM und ohne Netz, damit sie mit fake timers prüfbar ist.
 */

import { blobFehlerKlasse } from './upload-diagnose'
import { bildFehlerArtVon } from './upload-fehler'

/**
 * 64-KB-Probe der Lese-Stufe. Aus einer gesunden Quelle sind 64 KB in
 * Millisekunden da — wer nach 8 Sekunden nichts geliefert hat, ist nicht
 * langsam, sondern steckt fest. Bewusst knapp, weil danach ohnehin der
 * Komplettversuch folgt.
 */
export const LESE_PROBE_LIMIT_MS = 8_000

/**
 * Komplettversuch der Lese-Stufe. Eine 25-MB-Datei (unsere Obergrenze) von
 * einer trägen SD-Karte braucht bei wenigen MB/s einige Sekunden; 20 s decken
 * das mit Luft. Schlimmster Fall der Lese-Stufe insgesamt: 8 + 20 = 28 s bis
 * zur klaren Meldung — statt nie.
 */
export const LESE_VOLL_LIMIT_MS = 20_000

/**
 * Abruf der Hof-Kennung: ein winziges JSON. 15 s reichen auch dem zähesten
 * Mobilfunk-Handschlag; danach ist es ein Verbindungsproblem.
 */
export const KENNUNG_LIMIT_MS = 15_000

/**
 * Harter Deckel für den Blob-Transfer. 25 MB über eine schwache Leitung mit
 * 0,2 MB/s brauchen ~125 s; 180 s decken den langsamsten ehrlichen Transfer.
 * Greift praktisch nur als Rückhalt — einen echten Hänger erkennt die
 * Stillstands-Erkennung lange vorher.
 */
export const UPLOAD_LIMIT_MS = 180_000

/**
 * Stillstands-Erkennung („Stall"): Während eines lebendigen Transfers kommen
 * Fortschritts-Ereignisse im Sekundentakt oder schneller. Völlige Stille über
 * dieses Fenster übersteht auch ein Funkzellen-Wechsel — wer länger schweigt,
 * sendet nicht mehr. Von 30 s auf 45 s angehoben, seit der Transfer gestückelt
 * läuft: Der Start eines Teilstücks auf einer langsamen Leitung braucht Luft,
 * bevor sein erstes Fortschritts-Ereignis kommt.
 */
export const UPLOAD_STILLE_MS = 45_000

/**
 * Verarbeiten-Aufruf: Die Route selbst darf höchstens 60 s rechnen
 * (maxDuration in src/app/api/upload/verarbeiten/route.ts). 90 s = dieses
 * Server-Limit plus Luft für Übertragung und Warteschlange. Wer dann nicht
 * geantwortet hat, antwortet nicht mehr.
 */
export const VERARBEITEN_LIMIT_MS = 90_000

/**
 * Höchstzahl der Transfer-Anläufe: der erste plus genau EIN automatischer
 * Zweitversuch. Kein dritter — wer zweimal hintereinander abreißt, hat gerade
 * keine Verbindung, und weitere stumme Versuche würden nur den Netzfehler
 * hinauszögern, den der Bauer ohnehin bekommt.
 */
export const TRANSFER_VERSUCHE = 2

/** Atempause vor dem Zweitversuch — kurz genug, um nicht wie ein Hänger zu
 *  wirken, lang genug, dass ein Funkloch-Moment vorbeiziehen kann. */
export const TRANSFER_PAUSE_MS = 2_000

/**
 * Die zwei SDK-Fehler, die KEINE Urteile sind: der Abbruch (den lösen unsere
 * eigenen Wächter aus) und der gerade nicht erreichbare Dienst (5xx; im
 * gestückelten Weg meldet das SDK so auch gescheiterte fetches). Beide kann
 * ein zweiter Anlauf beheben.
 *
 * Bis #129 stand hier „Text enthält not available". Das traf auch
 * client_token_not_allowed („This operation is not available when using a
 * client token") — eine 4xx-Ablehnung, die beim zweiten Anlauf genauso fällt.
 */
const WIEDERHOLBARE_BLOB_KLASSEN = new Set(['BlobRequestAbortedError', 'BlobServiceNotAvailable'])

/**
 * Deterministisches Urteil des Blob-SDK — im Gegensatz zum Transfer-Unfall.
 *
 * Alle SDK-Fehler tragen das Präfix „Vercel Blob: " (BlobError setzt es im
 * Konstruktor); echte Netzfehler kommen dagegen als TypeError. Urteile sind
 * endgültig: abgelehnter Token (etwa nach abgelaufener Sitzung), verweigerter
 * Zugriff, falscher Pfad — sie fielen beim Wiederholen genauso.
 *
 * Bewusst am Meldungstext erkannt statt per instanceof (blobFehlerKlasse):
 * Die Klasse hielte über eine Bundle-Grenze nicht (dieselbe Lehre wie bei
 * BildFehler), und der Text entsteht im Konstruktor selbst.
 */
function istSdkUrteil(fehler: unknown): boolean {
  const klasse = blobFehlerKlasse(fehler)
  return klasse !== null && !WIEDERHOLBARE_BLOB_KLASSEN.has(klasse)
}

/**
 * Darf dieser Fehler einen Zweitversuch auslösen — und ist noch einer übrig?
 *
 * Wiederholbar sind nur TRANSFER-Unfälle: Stillstand, abgelaufener Deckel,
 * Netzwurf aus dem Upload selbst. Sie sagen nichts über das Foto — beim
 * nächsten Anlauf kann dieselbe Datei durchlaufen. NICHT wiederholt werden
 * Urteile, denn ein Urteil fiele beim Wiederholen genauso: weder die eines
 * BildFehlers ('format'/'server' aus der Verarbeitungs-Route, 'lesen' aus
 * der Lese-Stufe) noch die des Blob-SDK (istSdkUrteil) — der Zweitversuch
 * würde nur Zeit und Datenvolumen verbrennen.
 */
export function darfZweitversuch(fehler: unknown, bisherigeVersuche: number): boolean {
  if (bisherigeVersuche >= TRANSFER_VERSUCHE) return false
  if (bildFehlerArtVon(fehler) !== null) return false
  if (istSdkUrteil(fehler)) return false
  return true
}

/**
 * Ein Versprechen mit Verfallszeit.
 *
 * Läuft die Zeit ab, gewinnt der Fehler aus `beiAblauf` das Rennen. Der Timer
 * wird in JEDEM Ausgang aufgeräumt — sonst hielte er in Tests und langlebigen
 * Seiten Ressourcen fest.
 *
 * Was hier bewusst NICHT passiert: Die eigentliche Arbeit wird nicht
 * abgebrochen — ein arrayBuffer() kennt keinen Abbruch. Wo es ein
 * Abbruchsignal gibt (fetch, Blob-Upload), gehört zusätzlich das Signal
 * gesetzt; dieses Rennen hier sorgt nur dafür, dass der WARTENDE frei kommt.
 */
export function mitZeitlimit<T>(
  promise: Promise<T>,
  ms: number,
  beiAblauf: () => Error
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const ablauf = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(beiAblauf()), ms)
  })
  return Promise.race([promise, ablauf]).finally(() => clearTimeout(timer))
}

/**
 * Stillstands-Erkennung: schlägt Alarm, wenn zwischen zwei Lebenszeichen zu
 * lange Stille ist.
 *
 * Die Uhr läuft ab dem Anlegen — auch ein Transfer, der nie ein erstes
 * Ereignis liefert, ist ein Stillstand. Jedes `lebenszeichen()` zieht sie neu
 * auf. `stopp()` beendet die Wache endgültig: Ein Lebenszeichen, das danach
 * noch eintrudelt (Ereignisse und Abschluss können sich überholen), zieht sie
 * NICHT wieder auf.
 */
export function stillstandsWaechter(
  stilleMs: number,
  beiStille: () => void
): { lebenszeichen: () => void; stopp: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(beiStille, stilleMs)
  return {
    lebenszeichen() {
      if (timer === undefined) return
      clearTimeout(timer)
      timer = setTimeout(beiStille, stilleMs)
    },
    stopp() {
      clearTimeout(timer)
      timer = undefined
    },
  }
}
