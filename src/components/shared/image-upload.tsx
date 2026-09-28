'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { upload } from '@vercel/blob/client'
import { useFotoQuellen, type FotoAuswahl } from '@/components/shared/foto-quellen'
import {
  FORMAT_PROBE_BYTES,
  bildFormat,
  formatUrteil,
  naechsterSchritt,
  serienAbschluss,
  zweiterLeseversuch,
  type FotoWeg,
  type KartenGrund,
} from '@/lib/foto-wege'
import { summarizeUploadBatch, type BatchSkip } from '@/lib/upload-batch'
import { meldeUploadFehler } from '@/lib/upload-meldung'
import {
  befundVon,
  leseFehlerBefund,
  ordneLeseFehler,
  ordneTransferFehler,
  UploadSchrittFehler,
  type AnlaufBefund,
  type LeseDiagnose,
  type LeseVersuch,
  type UploadAnlauf,
  type UploadDiagnose,
} from '@/lib/upload-diagnose'
import {
  BildFehler,
  bildFehlerMeldung,
  karteText,
  leseFehlerText,
  type LeseUrteil,
  protokolliereBildFehler,
  transferFehlerText,
  IMAGE_NETWORK_ERROR,
  type BildFehlerArt,
} from '@/lib/upload-fehler'
import {
  MAX_ORIGINAL_BYTES,
  originalPfad,
  type UploadZweck,
} from '@/lib/upload-pfade'
import {
  KENNUNG_LIMIT_MS,
  LESE_PROBE_LIMIT_MS,
  LESE_VOLL_LIMIT_MS,
  LESE_ZWEITVERSUCH_PAUSE_MS,
  TRANSFER_PAUSE_MS,
  UPLOAD_LIMIT_MS,
  UPLOAD_STILLE_MS,
  VERARBEITEN_LIMIT_MS,
  darfZweitversuch,
  mitZeitlimit,
  stillstandsWaechter,
} from '@/lib/upload-zeitwaechter'

/**
 * Foto-Upload — der Browser sendet nur noch.
 *
 * Bis zu diesem Umbau hat der Browser jedes Foto zuerst selbst verkleinert:
 * in ein <img> laden, auf einen Canvas zeichnen, als WebP wieder auslesen. Das
 * musste er, weil eine Vercel-Serverfunktion höchstens ~4,5 MB Anfragekörper
 * annimmt und ein Handyfoto 6–8 MB hat. Genau diese Kette ist auf realen
 * Geräten reihenweise gerissen — an Fingerprint-Schutz, an Speicherdiensten,
 * an Browser-Eigenheiten. Vier Sprints lang haben wir die Fehlermeldungen
 * darüber verbessert; behoben war es nie.
 *
 * Jetzt geht das ORIGINAL direkt in den Blob-Speicher, am Limit der
 * Serverfunktion vorbei, und der Server verkleinert. Der Browser kann nichts
 * mehr falsch machen, weil er nichts mehr tut außer senden.
 *
 * Der Preis, bewusst bezahlt: Ein Upload überträgt jetzt 6–8 MB statt ~300 kB.
 * Verlässlichkeit schlägt Datenvolumen — ein Foto hochladen muss funktionieren
 * wie in jeder Messenger-App.
 */

export type ImageUploadVariant = UploadZweck

/** Die Stufen eines Uploads in ihrer Reihenfolge — 'wiederholen' ist die
 *  Ausnahme: die kurze Atempause vor dem automatischen Zweitversuch. */
export type UploadStufe = 'lesen' | 'hochladen' | 'wiederholen' | 'verarbeiten'

/**
 * Text der laufenden Stufe — EINE Quelle für alle Anzeige-Stellen.
 *
 * Seit dem Zeitwächter-Umbau nennt jeder Hänger seinen Ort: Wer „Verarbeite …"
 * sieht, hängt nicht beim Lesen. Nur das Hochladen trägt eine Zahl — es ist
 * die einzige Stufe, deren Fortschritt wir messen können.
 */
export function stufenText(fortschritt: { stufe: UploadStufe; prozent: number }): string {
  if (fortschritt.stufe === 'lesen') return 'Lese Datei …'
  if (fortschritt.stufe === 'wiederholen') return 'Verbindung unterbrochen — versuche es noch einmal …'
  if (fortschritt.stufe === 'verarbeiten') return 'Verarbeite …'
  return `Lade hoch … ${Math.round(fortschritt.prozent)} %`
}

/**
 * Die Hof-Kennung, einmal geholt und gemerkt.
 *
 * Sie steckt im Ablagepfad des Originals, und der Pfad kommt beim
 * Client-Upload zwingend vom Client — der Server darf ihn nur annehmen oder
 * ablehnen. Ein Abruf je Seitenaufruf genügt; das Versprechen wird gemerkt,
 * nicht das Ergebnis, damit auch mehrere gleichzeitige Uploads nur einmal
 * fragen.
 */
let hofKennung: Promise<string> | null = null

function holeHofKennung(): Promise<string> {
  hofKennung ??= fetch('/api/upload/token', { signal: AbortSignal.timeout(KENNUNG_LIMIT_MS) })
    .catch((e: unknown) => {
      // Netz weg oder Zeit abgelaufen — es kam gar keine Antwort. Das ist der
      // Netzfehler, nicht „kein Zugriff". Der Befund behält, was fetch sagte.
      throw new UploadSchrittFehler(IMAGE_NETWORK_ERROR, befundVon(e))
    })
    .then((r) =>
      r.ok
        ? // Auch das Körper-Lesen kann noch abreißen (das Zeitlimit gilt bis
          // zum letzten Byte) — dann darf keine rohe DOMException durchsickern.
          r.json().catch((e: unknown) =>
            Promise.reject(
              new UploadSchrittFehler(IMAGE_NETWORK_ERROR, { ...befundVon(e), status: r.status })
            )
          )
        : Promise.reject(
            new UploadSchrittFehler('Kein Zugriff', {
              klasse: 'HttpAntwort',
              meldung: 'Kennung abgelehnt',
              status: r.status,
            })
          )
    )
    .then((d: { farmId: string }) => d.farmId)
    .catch((e) => {
      // Nicht dauerhaft merken, wenn es schiefging — der nächste Versuch soll
      // es neu probieren dürfen.
      hofKennung = null
      throw e
    })
  return hofKennung
}

/**
 * LESE-STUFE — bewusst die erste Stufe geblieben, obwohl der Browser sonst
 * nichts mehr selbst macht.
 *
 * WICHTIG: Die Fehlerklasse „Datei nicht lesbar" ([L]) liegt VOR der App und
 * wird durch den serverseitigen Umbau nicht geheilt — wenn der Speicherdienst
 * des Geräts (Android-App-Alben, SD-Backup) die Datei nicht herausgibt, kann
 * auch kein Server sie bekommen. Ihre Meldung ist deshalb der Wegweiser auf
 * die Wege daran vorbei (Dateien, Kamera, Teilen an die App). Diese Stufe
 * sorgt dafür, dass der Fall auch als 'lesen' GEMELDET wird, statt später
 * als diffuser Sendefehler zu erscheinen.
 */
const LESE_PROBE_BYTES = 64 * 1024

/**
 * Beide Lesewege stehen unter Zeitwächtern: Ein defekter Speicherdienst kann
 * beim arrayBuffer() auch STUMM stehenbleiben — weder Bytes noch Fehler. Für
 * den Bauern ist die stumme Quelle dasselbe wie die laute: Die Datei kommt
 * nicht heraus. Schlimmster Fall jetzt: 8 + 20 = 28 Sekunden bis zur klaren
 * Meldung — statt nie.
 *
 * Wie jeder Versuch ausging, bekommt `onLesen` — für Sentry, nie für den
 * Bauern (JAVASCRIPT-NEXTJS-3): Bis dahin fingen zwei leere catch den Fehler
 * ab, und die Meldung sagte nur „lesen", nicht ob die Datei stumm blieb oder
 * sofort abgelehnt wurde. Auch bei Erfolg, denn ein späterer Sendefehler nach
 * einer gescheiterten Probe ist dieselbe Spur.
 *
 * Seit JAVASCRIPT-NEXTJS-5 zwei Dinge mehr (foto-wege.ts):
 *  - Netz 1: Nach einer sofortigen Ablehnung (Urteil 'erlaubnis') EIN zweiter
 *    Leseversuch derselben Datei nach einer Pause — nur dort kann die Freigabe
 *    zurückkommen. Gelingt er, geht es weiter, als wäre nichts gewesen.
 *  - Die ersten Bytes entscheiden über das Format: HEIC wird nie hochgeladen,
 *    über die Dateien-App muss es ein Bild sein. Beides wirft einen BildFehler
 *    mit eigener Art, bevor der Transfer beginnt.
 *
 * Seit JAVASCRIPT-NEXTJS-6 die KOPIE: Nach bestandener Probe wird das ganze
 * Foto einmal gelesen und als Kopie im Speicher zurückgegeben. Vorher las das
 * Blob-SDK die Datei vom Gerät erst während der Übertragung, Stück für Stück
 * — und genau dort riss sie auf dem Pilot-Handy mit „network error", obwohl
 * die Probe gelungen war. Die Kopie hängt an keiner Freigabe des Geräts mehr;
 * Formatprüfung und Übertragung nehmen nur noch sie. Scheitert das Kopieren,
 * ist das ein Lesefehler wie jeder andere. Brachte schon das Volllesen die
 * Datei, ist das die Kopie — sie wird nicht zweimal gelesen.
 *
 * Exportiert für die Verhaltens-Tests (tests/upload-zeitwaechter.test.ts,
 * tests/upload-lesen.test.ts, tests/foto-android.test.ts) und für den
 * Produktdialog, der schon bei der Auswahl prüft und die Kopie behält.
 */
export async function pruefeLesbarkeit(
  file: File,
  optionen: { weg?: FotoWeg; onLesen?: (lesen: LeseDiagnose) => void } = {}
): Promise<File> {
  const weg = optionen.weg ?? 'galerie'
  // Was eine Browser-Meldung über die Datei verraten könnte — der Name vom Gerät.
  const verborgen = file.name ? [file.name] : []
  const probeLesen = () => file.slice(0, LESE_PROBE_BYTES).arrayBuffer()
  // Die Kopie steht unter demselben Zeitwächter wie das Volllesen: Es ist
  // dasselbe Lesen am Stück. Schlimmster Fall bleibt 8 + 20 = 28 Sekunden.
  const kopieLesen = () => leseVersuch(() => file.arrayBuffer(), LESE_VOLL_LIMIT_MS, verborgen)

  let lesen: LeseDiagnose
  let bytes: ArrayBuffer | null

  const probe = await leseVersuch(probeLesen, LESE_PROBE_LIMIT_MS, verborgen)
  if (probe.bytes) {
    const kopie = await kopieLesen()
    lesen = { probe: probe.versuch, kopie: kopie.versuch }
    bytes = kopie.bytes
  } else {
    // Noch kein Urteil: Manche Speicherdienste verweigern das Teil-Lesen, geben
    // die Datei aber am Stück heraus — EIN Zusatzversuch mit der ganzen Datei,
    // bevor 'lesen' feststeht. Gelingt er, sind seine Bytes die Kopie.
    const voll = await kopieLesen()
    lesen = { probe: probe.versuch, voll: voll.versuch }
    bytes = voll.bytes

    if (!bytes && zweiterLeseversuch(ordneLeseFehler(lesen))) {
      await new Promise<void>((weiter) => setTimeout(weiter, LESE_ZWEITVERSUCH_PAUSE_MS))
      const zweiter = await leseVersuch(probeLesen, LESE_PROBE_LIMIT_MS, verborgen)
      lesen = { ...lesen, zweiterVersuch: zweiter.versuch }
      if (zweiter.bytes) {
        const kopie = await kopieLesen()
        lesen = { ...lesen, kopie: kopie.versuch }
        bytes = kopie.bytes
      }
    }
  }
  optionen.onLesen?.(lesen)

  if (!bytes) {
    protokolliereBildFehler('lesen', file)
    // Die Ursache bleibt 'lesen'; der TEXT folgt seit #135 dem, was wirklich war
    // — entzogene Freigabe, stumme Quelle oder ehrlich unbestimmt.
    throw new BildFehler('lesen', leseFehlerText(ordneLeseFehler(lesen)))
  }

  // Ein File statt eines nackten Blob: Name und Typ bleiben für den Ablagepfad
  // und die Übertragung erhalten; die Bytes liegen im Speicher, nicht am Gerät.
  const kopie = new File([bytes], file.name, { type: file.type, lastModified: file.lastModified })
  pruefeFormat(bytes, kopie, weg)
  return kopie
}

/** Die ersten Bytes als Bild erkennen (foto-wege.ts) — an der Kopie, vor jedem Transfer. */
function pruefeFormat(bytes: ArrayBuffer, file: File, weg: FotoWeg): void {
  const kopf = new Uint8Array(bytes, 0, Math.min(FORMAT_PROBE_BYTES, bytes.byteLength))
  const urteil = formatUrteil(bildFormat(kopf), weg)
  if (urteil === 'ok') return
  protokolliereBildFehler(urteil, file)
  throw new BildFehler(urteil)
}

/** Ein Leseversuch unter Zeitwächter — wirft nie, sondern sagt, wie er ausging, und gibt die Bytes heraus. */
async function leseVersuch(
  lesen: () => Promise<ArrayBuffer>,
  limitMs: number,
  verborgen: readonly string[]
): Promise<{ versuch: LeseVersuch; bytes: ArrayBuffer | null }> {
  const beginn = Date.now()
  // Nur unser Wächter wirft genau dieses Objekt — so ist der Ablauf vom
  // Fehler des Browsers unterscheidbar, auch wenn der ebenfalls ein Error ist.
  const ablauf = new Error('Zeitlimit')
  try {
    const bytes = await mitZeitlimit(lesen(), limitMs, () => ablauf)
    return {
      versuch: { ergebnis: 'ok', dauerMs: Date.now() - beginn },
      // Eine Attrappe ohne echte Bytes zählt als leer, nicht als Fehler.
      bytes: bytes instanceof ArrayBuffer ? bytes : new ArrayBuffer(0),
    }
  } catch (e) {
    const dauerMs = Date.now() - beginn
    if (e === ablauf) return { versuch: { ergebnis: 'zeitlimit', dauerMs }, bytes: null }
    return { versuch: { ergebnis: 'fehler', ...leseFehlerBefund(e, verborgen), dauerMs }, bytes: null }
  }
}

/**
 * Der Transfer des Originals — gestückelt, bewacht, mit genau EINEM
 * automatischen Zweitversuch.
 *
 * `multipart: true` lässt das SDK die Datei in Teilstücke zerlegen, parallel
 * senden und GESCHEITERTE TEILSTÜCKE selbst wiederholen — ein 6–8-MB-Original
 * als eine einzige Übertragung war auf schwachen Uplinks der Punkt, an dem
 * die meisten Uploads rissen. Die Fortschritts-Ereignisse kommen auch im
 * Stückel-Modus (das SDK summiert über die Teile), die Wächter bleiben also
 * unverändert verdrahtet.
 *
 * Reißt der GESAMTE Transfer (Stillstand, Deckel, Netzwurf), folgt nach einer
 * Atempause genau ein kompletter Neustart: erneuter upload()-Aufruf, also
 * frisches Token, Fortschritt zurück auf null, sichtbar über die Stufe
 * 'wiederholen'. Ob ein Fehler das darf, entscheidet darfZweitversuch —
 * Urteile der Verarbeitungs-Route ('format'/'server') fallen hier nie an,
 * bleiben aber ausdrücklich unwiederholbar.
 *
 * Das Rennen ist die eigentliche Befreiung des Wartenden: @vercel/blob
 * 2.4.0 reicht das Signal zwar an den Transfer durch, NICHT aber an seine
 * interne Token-Beschaffung (getToken ruft retrieveClientToken ohne
 * abortSignal auf) — ein stummer Hänger dort würde das abort() beider
 * Wächter nie hören. Das Rennen macht den Abbruch in jeder Phase wirksam;
 * das Signal sorgt zusätzlich dafür, dass der Transfer dort wirklich
 * endet, wo das SDK es hört.
 */
async function uebertrageOriginal(
  file: File,
  farmId: string,
  zweck: UploadZweck,
  optionen: {
    onFortschritt?: (prozent: number) => void
    onStufe?: (stufe: UploadStufe) => void
    /** Reine Zusatz-Meldung für die Sentry-Diagnose: welcher Anlauf gerade
     *  läuft. Ändert am Ablauf nichts. */
    onVersuch?: (versuch: number) => void
    /** Reine Zusatz-Meldung für die Sentry-Diagnose: der Befund je Anlauf,
     *  sobald der Transfer endgültig gescheitert ist. */
    onDiagnose?: (diagnose: UploadDiagnose) => void
  }
): Promise<{ url: string }> {
  const anlaeufe: UploadAnlauf[] = []
  // Was ein SDK-Fehlertext über Hof und Datei verraten kann: der Pfad, der
  // Name vom Gerät, der daraus bereinigte Name im Pfad, die Kennung.
  const pfad = originalPfad(farmId, zweck, file.name)
  const verborgen = [pfad, file.name, pfad.slice(pfad.lastIndexOf('/') + 1), farmId]
  for (let versuch = 1; ; versuch++) {
    optionen.onVersuch?.(versuch)
    const beginn = Date.now()
    // Beide Wächter je Anlauf frisch — ein Zweitversuch bekommt die volle Zeit.
    // Welcher Wächter abbrach, merken wir uns hier und geben es bewusst NICHT
    // als Grund an abort(): fetch lehnte dann mit diesem Wert statt mit einem
    // AbortError ab, und das SDK wiederholte den Request im Hintergrund.
    const abbruch = new AbortController()
    const waechter: { grund?: 'stillstand' | 'deckel' } = {}
    const deckel = setTimeout(() => {
      waechter.grund = 'deckel'
      abbruch.abort()
    }, UPLOAD_LIMIT_MS)
    const stille = stillstandsWaechter(UPLOAD_STILLE_MS, () => {
      waechter.grund = 'stillstand'
      abbruch.abort()
    })
    // Fortschritts-Ereignisse sind Makrotasks: Ein Nachzügler des gescheiterten
    // Anlaufs könnte den auf null zurückgesetzten Fortschritt sonst wieder mit
    // dem alten Prozentwert überschreiben.
    let lebendig = true

    try {
      return await Promise.race([
        upload(originalPfad(farmId, zweck, file.name), file, {
          access: 'public',
          handleUploadUrl: '/api/upload/token',
          multipart: true,
          abortSignal: abbruch.signal,
          onUploadProgress: ({ percentage }) => {
            if (!lebendig) return
            stille.lebenszeichen()
            optionen.onFortschritt?.(percentage)
          },
        }),
        new Promise<never>((_, ablehnen) =>
          abbruch.signal.addEventListener(
            'abort',
            () => ablehnen(new Error(IMAGE_NETWORK_ERROR)),
            { once: true }
          )
        ),
      ])
    } catch (e) {
      lebendig = false
      const abgebrochen = abbruch.signal.aborted
      anlaeufe.push({
        ...(waechter.grund ? waechterBefund(waechter.grund) : befundVon(e, verborgen)),
        dauerMs: Date.now() - beginn,
      })
      // Haben UNSERE Wächter abgebrochen, ist es ein Transfer-Unfall — egal,
      // in welcher Gestalt der Fehler aus dem SDK zurückkommt.
      const massgeblich = abgebrochen ? new Error(IMAGE_NETWORK_ERROR) : e
      if (!darfZweitversuch(massgeblich, versuch)) {
        optionen.onDiagnose?.({ schritt: 'uebertragung', anlaeufe })
        // Der Text folgt der Ursache des letzten Anlaufs: „Verbindung
        // unterbrochen" nur, wenn sie es wirklich war (#129). Vorher stand
        // hier für jeden Fehler der Netzfehler-Text.
        const urteil = ordneTransferFehler(e, abgebrochen)
        // Lesbar war die Datei in Stufe 0 — ist sie es beim Senden nicht mehr,
        // ist das ein LESEFEHLER und kein Sendefehler (#135). Als BildFehler,
        // damit Sentry ihn unter 'lesen' zählt und eine Serie ihn unter dem
        // Kurzgrund „Datei nicht lesbar" listet.
        throw urteil === 'lesen'
          ? new BildFehler('lesen', transferFehlerText(urteil))
          : new Error(transferFehlerText(urteil))
      }
      optionen.onStufe?.('wiederholen')
      optionen.onFortschritt?.(0)
      await new Promise((weiter) => setTimeout(weiter, TRANSFER_PAUSE_MS))
      optionen.onStufe?.('hochladen')
    } finally {
      clearTimeout(deckel)
      stille.stopp()
    }
  }
}

/** Befund für einen Abbruch durch unsere Wächter — es gibt keinen Originalfehler. */
function waechterBefund(grund: 'stillstand' | 'deckel'): AnlaufBefund {
  return grund === 'stillstand'
    ? { klasse: 'WaechterAbbruch', meldung: `Stillstand: ${UPLOAD_STILLE_MS / 1000} s ohne Fortschritt` }
    : { klasse: 'WaechterAbbruch', meldung: `Zeitdeckel: ${UPLOAD_LIMIT_MS / 1000} s überschritten` }
}

/**
 * Ein Foto hochladen und verarbeiten lassen. Liefert die fertige URL.
 *
 * Drei Stufen, absichtlich getrennt:
 *   0. LESE-STUFE — gibt der Speicherdienst die Datei überhaupt heraus?
 *      Scheitert sie: Ursache 'lesen', samt Wegweiser-Auswegen. Sonst liefert
 *      sie die Kopie im Speicher, und nur die geht weiter (JAVASCRIPT-NEXTJS-6).
 *   1. Original in den Blob-Speicher (signierter Client-Upload) — aus der Kopie.
 *   2. Verarbeitung anstoßen — der Server dreht, verkleinert, kodiert und
 *      löscht das Original.
 *
 * Netz- und Sendefehler aus Stufe 1 und 2 sind BEWUSST nicht Ursache 'lesen':
 * Die Datei war lesbar (Stufe 0), gescheitert ist das Senden. Sie werfen einen
 * Text nach dem, was wirklich war — Verbindung, Ablehnung des Bildspeichers
 * oder ehrlich unbestimmt —, ohne neue Foto-Ursache. Was der Server selbst
 * als Ursache mitbringt ('format' oder 'server'), behält seine Zuordnung.
 *
 * Seit dem Zeitwächter-Umbau steht jede Stufe unter einem Zeitlimit und
 * meldet sich über `onStufe` — kein Hänger bleibt mehr stumm, und die Anzeige
 * kann sagen, WO es gerade steht. Scheitert Kennung, Übertragung oder
 * Abschluss, bekommt `onDiagnose` den Originalfehler bereinigt mit — für
 * Sentry, denn der Text für den Bauern verrät ihn nicht (#129).
 */
export async function ladeFotoHoch(
  file: File,
  zweck: UploadZweck,
  optionen: {
    altUrl?: string
    onFortschritt?: (prozent: number) => void
    onStufe?: (stufe: UploadStufe) => void
    /** Reine Zusatz-Meldung (Sentry-Diagnose): welcher Transfer-Anlauf läuft. */
    onVersuch?: (versuch: number) => void
    /** Reine Zusatz-Meldung (Sentry-Diagnose): woran der Upload scheiterte. */
    onDiagnose?: (diagnose: UploadDiagnose) => void
    /** Reine Zusatz-Meldung (Sentry-Diagnose): wie die Lese-Stufe ausging. */
    onLesen?: (lesen: LeseDiagnose) => void
    /** Über welchen Weg die Datei kam — entscheidet bei der Dateien-App, ob Unbekanntes ein Foto sein muss. */
    weg?: FotoWeg
    /**
     * `file` ist schon die Kopie aus pruefeLesbarkeit (Produktdialog: geprüft
     * bei der Auswahl, hochgeladen beim Absenden) — dann wird nicht noch
     * einmal gelesen und kopiert. Nie für eine Datei direkt vom Gerät setzen.
     */
    bereitsKopiert?: boolean
  } = {}
): Promise<string> {
  let kopie = file
  if (!optionen.bereitsKopiert) {
    optionen.onStufe?.('lesen')
    kopie = await pruefeLesbarkeit(file, { weg: optionen.weg, onLesen: optionen.onLesen })
  }

  // Die Kennung gehört schon zum Hochladen: Hängt ihr Abruf, zeigt die
  // Anzeige den richtigen Ort, und ihr Zeitwächter meldet den Netzfehler.
  optionen.onStufe?.('hochladen')
  const kennungBeginn = Date.now()
  const farmId = await holeHofKennung().catch((e: unknown) => {
    optionen.onDiagnose?.({
      schritt: 'kennung',
      anlaeufe: [{ ...befundVon(e), dauerMs: Date.now() - kennungBeginn }],
    })
    throw e
  })

  // Nur die Kopie — die Datei vom Gerät wird ab hier nicht mehr angefasst.
  const hochgeladen = await uebertrageOriginal(kopie, farmId, zweck, optionen)

  optionen.onStufe?.('verarbeiten')
  const abschlussBeginn = Date.now()
  const meldeAbschluss = (befund: AnlaufBefund): void =>
    optionen.onDiagnose?.({
      schritt: 'abschluss',
      anlaeufe: [{ ...befund, dauerMs: Date.now() - abschlussBeginn }],
    })

  let antwort: Response
  try {
    antwort = await fetch('/api/upload/verarbeiten', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: hochgeladen.url, zweck, altUrl: optionen.altUrl }),
      signal: AbortSignal.timeout(VERARBEITEN_LIMIT_MS),
    })
  } catch (e) {
    // Die Verbindung ist zwischen Upload und Verarbeitung abgerissen.
    meldeAbschluss(befundVon(e))
    throw new Error(IMAGE_NETWORK_ERROR)
  }

  let leseFehler: unknown = null
  const daten = (await antwort.json().catch((e: unknown) => {
    leseFehler = e
    return null
  })) as {
    url?: string
    art?: unknown
  } | null

  if (antwort.ok && daten === null) {
    // Die Antwort kam an, aber ihr Körper riss beim Lesen ab — das Zeitlimit
    // gilt bis zum letzten Byte. Das ist die Verbindung, nicht der Server;
    // eine falsche Ursache wäre schlimmer als gar keine.
    meldeAbschluss({ ...befundVon(leseFehler), status: antwort.status })
    throw new Error(IMAGE_NETWORK_ERROR)
  }

  if (!antwort.ok || !daten || typeof daten.url !== 'string') {
    const art: BildFehlerArt = daten?.art === 'format' ? 'format' : 'server'
    meldeAbschluss({
      klasse: 'HttpAntwort',
      meldung: `Verarbeitung abgelehnt (${art})`,
      status: antwort.status,
    })
    protokolliereBildFehler(art, kopie)
    throw new BildFehler(art)
  }

  return daten.url
}

/** Ergebnis eines einzelnen Durchlaufs: volle Meldung für Einzelauswahl,
 *  Kurzgrund für die Sammelmeldung einer Serie — und, wo das Foto oder der
 *  Weg das Problem war, die Karte statt der Meldung (foto-wege.ts). */
type UploadResult =
  | { ok: true }
  | {
      ok: false
      message: string
      short: string
      karte?: { grund: KartenGrund; urteil: LeseUrteil }
      /** Hat die Lese-Stufe die Datei bekommen? null = nie versucht (zu groß). Für den gemerkten Weg. */
      lesbar: boolean | null
    }

interface UseImageUploadOptions {
  variant: ImageUploadVariant
  /** Bisheriges Bild — wird nach dem erfolgreichen Ersetzen aufgeräumt. */
  oldUrl?: string
  /** Mehrfachauswahl — bewusst standardmäßig AUS. Nur die Galerie schaltet sie
   *  ein; Logo, Cover, Status und Produktbild sind Einzelbild-Felder. */
  multiple?: boolean
  /** Höchstzahl der Dateien einer Serie (z. B. freie Galerie-Plätze).
   *  Überzählige werden vor Beginn abgelehnt statt vom Server abgewiesen. */
  maxFiles?: number
  /** Wird nach jedem erfolgreichen Upload aufgerufen. Darf ein Promise
   *  zurückgeben — bei einer Serie wird darauf gewartet, und ein Werfen zählt
   *  das Foto als übersprungen. `meta.batch` sagt, ob gerade eine Serie läuft
   *  (dann keine Einzelmeldung zeigen, es gibt eine Sammelmeldung). */
  onUploaded: (url: string, meta: { batch: boolean }) => void | Promise<void>
}

export function useImageUpload({
  variant,
  oldUrl,
  multiple = false,
  maxFiles,
  onUploaded,
}: UseImageUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  // `prozent` ist für Mobilfunk gedacht: Ein 8-MB-Original braucht dort
  // spürbar Zeit, und ein Balken ohne Bewegung sieht aus wie ein Absturz.
  // `stufe` sagt zusätzlich, WO der Upload gerade steht — seit dem
  // Zeitwächter-Umbau nennt jeder Hänger seinen Ort.
  const [progress, setProgress] = useState<{
    current: number
    total: number
    prozent: number
    stufe: UploadStufe
  } | null>(null)
  // Die Auswahl (Weg und Wahl) reist als Argument mit — für die Sentry-Meldung,
  // für das Format-Urteil bei der Dateien-App und für den gemerkten Weg.
  async function uploadOne(file: File, batch: boolean, auswahl: FotoAuswahl): Promise<UploadResult> {
    if (file.size > MAX_ORIGINAL_BYTES) {
      return { ok: false, message: 'Datei zu groß (max. 25 MB)', short: 'zu groß (max. 25 MB)', lesbar: null }
    }

    // 0 = der Transfer hat nie begonnen (z. B. Lese-Stufe gescheitert).
    let versuche = 0
    let diagnose: UploadDiagnose | undefined
    let lesen: LeseDiagnose | undefined
    let url: string
    try {
      // Die Kopie entsteht in ladeFotoHoch und lebt nur dort — nach dem
      // Upload ist sie frei, bevor das nächste Foto einer Serie gelesen wird.
      url = await ladeFotoHoch(file, variant, {
        altUrl: oldUrl,
        weg: auswahl.weg,
        onStufe: (stufe) =>
          setProgress((v) => (v ? { ...v, stufe } : { current: 1, total: 1, prozent: 0, stufe })),
        onFortschritt: (prozent) =>
          setProgress((v) =>
            v ? { ...v, prozent } : { current: 1, total: 1, prozent, stufe: 'hochladen' }
          ),
        onVersuch: (versuch) => {
          versuche = versuch
        },
        onDiagnose: (d) => {
          diagnose = d
        },
        onLesen: (l) => {
          lesen = l
        },
      })
    } catch (e) {
      // Zusätzlich zur Anzeige nach Sentry — Ursache, Kennung, Größe, Typ,
      // Weg, Versuche, Originalfehler je Anlauf, Ausgang der Lese-Stufe; kein
      // Dateiname (siehe upload-meldung.ts). So ist ohne Bildschirmfoto
      // nachvollziehbar, woran es scheiterte.
      meldeUploadFehler(e, { datei: file, weg: auswahl.weg, wahl: auswahl.wahl, versuche, diagnose, lesen })
      // Ein BildFehler bringt seine Ursache mit und bekommt den passenden
      // Text; alles andere behält seine eigene Meldung. Liegt es am Foto
      // oder am Weg, kommt statt der Meldung die Karte.
      const { text, kurz, art } = bildFehlerMeldung(e)
      // Nur ein Lesefehler sagt etwas über den Weg; Format, Netz und Server nicht.
      const lesbar = art !== 'lesen'
      const schritt = naechsterSchritt(art)
      if (schritt.art === 'karte') {
        return {
          ok: false,
          message: text,
          short: kurz,
          karte: { grund: schritt.grund, urteil: lesen ? ordneLeseFehler(lesen) : 'unbestimmt' },
          lesbar,
        }
      }
      return { ok: false, message: text, short: kurz, lesbar }
    }
    try {
      await onUploaded(url, { batch })
      return { ok: true }
    } catch (e) {
      // KEIN Upload-Fehler: Der Transfer gelang, gescheitert ist die
      // Weiterverarbeitung im Aufrufer — darum keine Foto-Upload-Meldung
      // nach Sentry, die Diagnose bliebe sonst mit Fremdfällen verwässert.
      const { text, kurz } = bildFehlerMeldung(e)
      return { ok: false, message: text, short: kurz, lesbar: true }
    }
  }

  async function handleSingle(file: File, auswahl: FotoAuswahl) {
    setIsUploading(true)
    setProgress({ current: 1, total: 1, prozent: 0, stufe: 'lesen' })
    try {
      const result = await uploadOne(file, false, auswahl)
      const lesbar = result.ok ? true : result.lesbar
      if (lesbar !== null) quellen.meldeErgebnis(auswahl, lesbar)
      if (result.ok) return
      if (result.karte) {
        quellen.zeigeKarte(
          { grund: result.karte.grund, text: karteText(result.karte.grund, result.karte.urteil) },
          auswahl,
          [file]
        )
      } else {
        toast.error(result.message)
      }
    } finally {
      setProgress(null)
      setIsUploading(false)
    }
  }

  async function handleSeries(files: File[], auswahl: FotoAuswahl) {
    const skipped: BatchSkip[] = []
    let liste = files

    // Überzählige vorab aussortieren, statt sie am Server abprallen zu lassen
    if (typeof maxFiles === 'number' && liste.length > maxFiles) {
      if (maxFiles <= 0) {
        toast.error('Kein Platz mehr — bitte zuerst Fotos entfernen.')
        return
      }
      for (const f of liste.slice(maxFiles)) {
        skipped.push({ name: f.name, reason: 'kein Platz mehr' })
      }
      liste = liste.slice(0, maxFiles)
    }

    setIsUploading(true)
    let uploaded = 0
    // Die lesbaren laufen durch; für die anderen kommt am Ende die Karte.
    const fuerKarte: { grund: KartenGrund; urteil: LeseUrteil; datei: File }[] = []
    // Je Foto: kam es heraus? Ein einziges lesbares genügt, damit der Weg als geglückt gilt.
    const gelesen: boolean[] = []
    try {
      // Sequenziell: schont die Verbindung, und ein Fehler bricht die Serie
      // nicht ab. Bei Originalen wiegt das schwerer als vorher — parallel
      // liefen sonst mehrere 8-MB-Übertragungen gegeneinander. Und seit der
      // Kopie (JAVASCRIPT-NEXTJS-6) liegt so immer nur EIN Foto im Speicher.
      for (let i = 0; i < liste.length; i++) {
        setProgress({ current: i + 1, total: liste.length, prozent: 0, stufe: 'lesen' })
        const result = await uploadOne(liste[i], true, auswahl)
        if (result.ok) {
          uploaded++
          gelesen.push(true)
        } else {
          skipped.push({ name: liste[i].name, reason: result.short })
          if (result.karte) fuerKarte.push({ ...result.karte, datei: liste[i] })
          if (result.lesbar !== null) gelesen.push(result.lesbar)
        }
      }
    } finally {
      setProgress(null)
      setIsUploading(false)
    }
    if (gelesen.length > 0) quellen.meldeErgebnis(auswahl, gelesen.some(Boolean))

    // Sammelmeldung und Karte entscheidet serienAbschluss (foto-wege.ts).
    const abschluss = serienAbschluss({ hochgeladen: uploaded, uebersprungen: skipped.length, faelle: fuerKarte })
    if (abschluss.sammelmeldung) {
      const text = summarizeUploadBatch(uploaded, skipped)
      if (uploaded === 0) toast.error(text)
      else if (skipped.length > 0) toast.warning(text)
      else toast.success(text)
    }
    if (abschluss.karte) {
      const { grund, urteil, anzahl } = abschluss.karte
      quellen.zeigeKarte(
        { grund, text: karteText(grund, urteil, anzahl) },
        auswahl,
        fuerKarte.filter((k) => k.grund === grund).map((k) => k.datei)
      )
    }
  }

  // Zwei Knöpfe (Foto wählen, Foto aufnehmen) und die Karte hinter dem
  // bisherigen Auslöser — die Aufrufer merken davon nichts: openFilePicker
  // öffnet am Touch-Gerät das Menü, fileInput trägt Eingaben, Menü und Karte.
  // handleSingle/handleSeries greifen erst nach einer Auswahl auf `quellen`
  // zu, deshalb darf es hier erst danach entstehen.
  const quellen = useFotoQuellen({
    multiple,
    zweck: variant,
    onFiles: (dateien, auswahl) => {
      // Einzelauswahl behält ihren bisherigen Weg samt Einzelmeldungen
      if (!multiple || dateien.length === 1) void handleSingle(dateien[0], auswahl)
      else void handleSeries(dateien, auswahl)
    },
  })

  return {
    isUploading,
    progress,
    openFilePicker: quellen.oeffnen,
    fileInput: quellen.elemente,
  }
}
