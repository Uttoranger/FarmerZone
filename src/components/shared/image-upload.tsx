'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { upload } from '@vercel/blob/client'
import { summarizeUploadBatch, type BatchSkip } from '@/lib/upload-batch'
import {
  BildFehler,
  bildFehlerMeldung,
  protokolliereBildFehler,
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
  UPLOAD_LIMIT_MS,
  UPLOAD_STILLE_MS,
  VERARBEITEN_LIMIT_MS,
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

/** Die drei Stufen eines Uploads — in dieser Reihenfolge. */
export type UploadStufe = 'lesen' | 'hochladen' | 'verarbeiten'

/**
 * Text der laufenden Stufe — EINE Quelle für alle Anzeige-Stellen.
 *
 * Seit dem Zeitwächter-Umbau nennt jeder Hänger seinen Ort: Wer „Verarbeite …"
 * sieht, hängt nicht beim Lesen. Nur das Hochladen trägt eine Zahl — es ist
 * die einzige Stufe, deren Fortschritt wir messen können.
 */
export function stufenText(fortschritt: { stufe: UploadStufe; prozent: number }): string {
  if (fortschritt.stufe === 'lesen') return 'Lese Datei …'
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
    .catch(() => {
      // Netz weg oder Zeit abgelaufen — es kam gar keine Antwort. Das ist der
      // Netzfehler, nicht „kein Zugriff".
      throw new Error(IMAGE_NETWORK_ERROR)
    })
    .then((r) =>
      r.ok
        ? // Auch das Körper-Lesen kann noch abreißen (das Zeitlimit gilt bis
          // zum letzten Byte) — dann darf keine rohe DOMException durchsickern.
          r.json().catch(() => Promise.reject(new Error(IMAGE_NETWORK_ERROR)))
        : Promise.reject(new Error('Kein Zugriff'))
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
 * auch kein Server sie bekommen. Ihre Meldung samt „Eigene Dateien"-Ausweg
 * bleibt zentral. Diese Stufe sorgt dafür, dass der Fall auch als 'lesen'
 * GEMELDET wird, statt später als diffuser Sendefehler zu erscheinen.
 */
const LESE_PROBE_BYTES = 64 * 1024

/**
 * Beide Lesewege stehen unter Zeitwächtern: Ein defekter Speicherdienst kann
 * beim arrayBuffer() auch STUMM stehenbleiben — weder Bytes noch Fehler. Für
 * den Bauern ist die stumme Quelle dasselbe wie die laute: Die Datei kommt
 * nicht heraus, der „Eigene Dateien"-Ausweg gilt genauso. Schlimmster Fall
 * jetzt: 8 + 20 = 28 Sekunden bis zur klaren Meldung — statt nie.
 *
 * Exportiert für den Verhaltens-Test (tests/upload-zeitwaechter.test.ts).
 */
export async function pruefeLesbarkeit(file: File): Promise<void> {
  try {
    await mitZeitlimit(
      file.slice(0, LESE_PROBE_BYTES).arrayBuffer(),
      LESE_PROBE_LIMIT_MS,
      () => new BildFehler('lesen')
    )
    return
  } catch {
    // Noch kein Urteil — erst der Zusatzversuch unten entscheidet.
  }
  try {
    // Manche Speicherdienste verweigern das Teil-Lesen, geben die Datei aber
    // am Stück heraus — EIN Zusatzversuch mit der ganzen Datei, bevor
    // 'lesen' feststeht.
    await mitZeitlimit(file.arrayBuffer(), LESE_VOLL_LIMIT_MS, () => new BildFehler('lesen'))
  } catch {
    protokolliereBildFehler('lesen', file)
    throw new BildFehler('lesen')
  }
}

/**
 * Ein Foto hochladen und verarbeiten lassen. Liefert die fertige URL.
 *
 * Drei Stufen, absichtlich getrennt:
 *   0. LESE-STUFE — gibt der Speicherdienst die Datei überhaupt heraus?
 *      Scheitert sie: Ursache 'lesen', samt „Eigene Dateien"-Ausweg.
 *   1. Original in den Blob-Speicher (signierter Client-Upload).
 *   2. Verarbeitung anstoßen — der Server dreht, verkleinert, kodiert und
 *      löscht das Original.
 *
 * Netz- und Sendefehler aus Stufe 1 und 2 sind BEWUSST nicht Ursache 'lesen':
 * Die Datei war lesbar (Stufe 0), gescheitert ist die Verbindung. Sie werfen
 * den schlichten Netzfehler-Text — ohne neue Ursachen-Kategorie. Was der
 * Server selbst als Ursache mitbringt ('format' oder 'server'), behält seine
 * Zuordnung.
 *
 * Seit dem Zeitwächter-Umbau steht jede Stufe unter einem Zeitlimit und
 * meldet sich über `onStufe` — kein Hänger bleibt mehr stumm, und die Anzeige
 * kann sagen, WO es gerade steht.
 */
export async function ladeFotoHoch(
  file: File,
  zweck: UploadZweck,
  optionen: {
    altUrl?: string
    onFortschritt?: (prozent: number) => void
    onStufe?: (stufe: UploadStufe) => void
  } = {}
): Promise<string> {
  optionen.onStufe?.('lesen')
  await pruefeLesbarkeit(file)

  // Die Kennung gehört schon zum Hochladen: Hängt ihr Abruf, zeigt die
  // Anzeige den richtigen Ort, und ihr Zeitwächter meldet den Netzfehler.
  optionen.onStufe?.('hochladen')
  const farmId = await holeHofKennung()

  // Zwei Wächter für den Transfer: Die Stillstands-Erkennung schlägt zu, wenn
  // die Fortschritts-Ereignisse verstummen (Flugmodus, tote Funkzelle) — der
  // harte Deckel ist nur der Rückhalt für den Fall, dass ein Transfer zwar
  // kriecht, aber nie fertig wird.
  const abbruch = new AbortController()
  const deckel = setTimeout(() => abbruch.abort(), UPLOAD_LIMIT_MS)
  const stille = stillstandsWaechter(UPLOAD_STILLE_MS, () => abbruch.abort())

  let hochgeladen: { url: string }
  try {
    // Das Rennen ist die eigentliche Befreiung des Wartenden: @vercel/blob
    // 2.4.0 reicht das Signal zwar an den Transfer durch, NICHT aber an seine
    // interne Token-Beschaffung (getToken ruft retrieveClientToken ohne
    // abortSignal auf) — ein stummer Hänger dort würde das abort() beider
    // Wächter nie hören. Das Rennen macht den Abbruch in jeder Phase wirksam;
    // das Signal sorgt zusätzlich dafür, dass der Transfer dort wirklich
    // endet, wo das SDK es hört.
    hochgeladen = await Promise.race([
      upload(originalPfad(farmId, zweck, file.name), file, {
        access: 'public',
        handleUploadUrl: '/api/upload/token',
        abortSignal: abbruch.signal,
        onUploadProgress: ({ percentage }) => {
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
  } catch {
    // Lesbar war die Datei (Stufe 0) — hier scheitert das SENDEN: Verbindung
    // weg, Übertragung abgerissen oder abgebrochen, oder der Server hat den
    // Token verweigert. Für den Bauern ist das ein Fall mit einer Handlung:
    // nochmal versuchen.
    throw new Error(IMAGE_NETWORK_ERROR)
  } finally {
    clearTimeout(deckel)
    stille.stopp()
  }

  optionen.onStufe?.('verarbeiten')
  const antwort = await fetch('/api/upload/verarbeiten', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: hochgeladen.url, zweck, altUrl: optionen.altUrl }),
    signal: AbortSignal.timeout(VERARBEITEN_LIMIT_MS),
  }).catch(() => null)

  if (!antwort) {
    // Die Verbindung ist zwischen Upload und Verarbeitung abgerissen.
    throw new Error(IMAGE_NETWORK_ERROR)
  }

  const daten = (await antwort.json().catch(() => null)) as {
    url?: string
    art?: unknown
  } | null

  if (antwort.ok && daten === null) {
    // Die Antwort kam an, aber ihr Körper riss beim Lesen ab — das Zeitlimit
    // gilt bis zum letzten Byte. Das ist die Verbindung, nicht der Server;
    // eine falsche Ursache wäre schlimmer als gar keine.
    throw new Error(IMAGE_NETWORK_ERROR)
  }

  if (!antwort.ok || !daten || typeof daten.url !== 'string') {
    const art: BildFehlerArt = daten?.art === 'format' ? 'format' : 'server'
    protokolliereBildFehler(art, file)
    throw new BildFehler(art)
  }

  return daten.url
}

/** Ergebnis eines einzelnen Durchlaufs: volle Meldung für Einzelauswahl,
 *  Kurzgrund für die Sammelmeldung einer Serie. */
type UploadResult = { ok: true } | { ok: false; message: string; short: string }

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function resetInput() {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadOne(file: File, batch: boolean): Promise<UploadResult> {
    if (file.size > MAX_ORIGINAL_BYTES) {
      return { ok: false, message: 'Datei zu groß (max. 25 MB)', short: 'zu groß (max. 25 MB)' }
    }

    try {
      const url = await ladeFotoHoch(file, variant, {
        altUrl: oldUrl,
        onStufe: (stufe) =>
          setProgress((v) => (v ? { ...v, stufe } : { current: 1, total: 1, prozent: 0, stufe })),
        onFortschritt: (prozent) =>
          setProgress((v) =>
            v ? { ...v, prozent } : { current: 1, total: 1, prozent, stufe: 'hochladen' }
          ),
      })
      await onUploaded(url, { batch })
      return { ok: true }
    } catch (e) {
      // Ein BildFehler bringt seine Ursache mit und bekommt den passenden
      // Text; alles andere behält seine eigene Meldung.
      const { text, kurz } = bildFehlerMeldung(e)
      return { ok: false, message: text, short: kurz }
    }
  }

  async function handleSingle(file: File) {
    setIsUploading(true)
    setProgress({ current: 1, total: 1, prozent: 0, stufe: 'lesen' })
    try {
      const result = await uploadOne(file, false)
      if (!result.ok) toast.error(result.message)
    } finally {
      setProgress(null)
      setIsUploading(false)
      resetInput()
    }
  }

  async function handleSeries(files: File[]) {
    const skipped: BatchSkip[] = []
    let liste = files

    // Überzählige vorab aussortieren, statt sie am Server abprallen zu lassen
    if (typeof maxFiles === 'number' && liste.length > maxFiles) {
      if (maxFiles <= 0) {
        toast.error('Kein Platz mehr — bitte zuerst Fotos entfernen.')
        resetInput()
        return
      }
      for (const f of liste.slice(maxFiles)) {
        skipped.push({ name: f.name, reason: 'kein Platz mehr' })
      }
      liste = liste.slice(0, maxFiles)
    }

    setIsUploading(true)
    let uploaded = 0
    try {
      // Sequenziell: schont die Verbindung, und ein Fehler bricht die Serie
      // nicht ab. Bei Originalen wiegt das schwerer als vorher — parallel
      // liefen sonst mehrere 8-MB-Übertragungen gegeneinander.
      for (let i = 0; i < liste.length; i++) {
        setProgress({ current: i + 1, total: liste.length, prozent: 0, stufe: 'lesen' })
        const result = await uploadOne(liste[i], true)
        if (result.ok) uploaded++
        else skipped.push({ name: liste[i].name, reason: result.short })
      }
    } finally {
      setProgress(null)
      setIsUploading(false)
      resetInput()
    }

    const text = summarizeUploadBatch(uploaded, skipped)
    if (uploaded === 0) toast.error(text)
    else if (skipped.length > 0) toast.warning(text)
    else toast.success(text)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    // Einzelauswahl behält ihren bisherigen Weg samt Einzelmeldungen
    if (!multiple || files.length === 1) void handleSingle(files[0])
    else void handleSeries(files)
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      multiple={multiple}
      className="hidden"
      onChange={handleInputChange}
    />
  )

  return { isUploading, progress, openFilePicker, fileInput }
}
