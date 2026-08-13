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
  hofKennung ??= fetch('/api/upload/token')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Kein Zugriff'))))
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

async function pruefeLesbarkeit(file: File): Promise<void> {
  try {
    await file.slice(0, LESE_PROBE_BYTES).arrayBuffer()
    return
  } catch {
    // Noch kein Urteil — erst der Zusatzversuch unten entscheidet.
  }
  try {
    // Manche Speicherdienste verweigern das Teil-Lesen, geben die Datei aber
    // am Stück heraus — EIN Zusatzversuch mit der ganzen Datei, bevor
    // 'lesen' feststeht.
    await file.arrayBuffer()
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
 */
export async function ladeFotoHoch(
  file: File,
  zweck: UploadZweck,
  optionen: { altUrl?: string; onFortschritt?: (prozent: number) => void } = {}
): Promise<string> {
  await pruefeLesbarkeit(file)

  const farmId = await holeHofKennung()

  let hochgeladen: { url: string }
  try {
    hochgeladen = await upload(originalPfad(farmId, zweck, file.name), file, {
      access: 'public',
      handleUploadUrl: '/api/upload/token',
      onUploadProgress: ({ percentage }) => optionen.onFortschritt?.(percentage),
    })
  } catch {
    // Lesbar war die Datei (Stufe 0) — hier scheitert das SENDEN: Verbindung
    // weg, Übertragung abgerissen, oder der Server hat den Token verweigert.
    // Für den Bauern ist das ein Fall mit einer Handlung: nochmal versuchen.
    throw new Error(IMAGE_NETWORK_ERROR)
  }

  const antwort = await fetch('/api/upload/verarbeiten', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: hochgeladen.url, zweck, altUrl: optionen.altUrl }),
  }).catch(() => null)

  if (!antwort) {
    // Die Verbindung ist zwischen Upload und Verarbeitung abgerissen.
    throw new Error(IMAGE_NETWORK_ERROR)
  }

  const daten = (await antwort.json().catch(() => ({}))) as { url?: string; art?: unknown }

  if (!antwort.ok || typeof daten.url !== 'string') {
    const art: BildFehlerArt = daten.art === 'format' ? 'format' : 'server'
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
  // `prozent` ist neu und für Mobilfunk gedacht: Ein 8-MB-Original braucht dort
  // spürbar Zeit, und ein Balken ohne Bewegung sieht aus wie ein Absturz.
  const [progress, setProgress] = useState<{
    current: number
    total: number
    prozent: number
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
        onFortschritt: (prozent) =>
          setProgress((v) => (v ? { ...v, prozent } : { current: 1, total: 1, prozent })),
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
    setProgress({ current: 1, total: 1, prozent: 0 })
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
        setProgress({ current: i + 1, total: liste.length, prozent: 0 })
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
