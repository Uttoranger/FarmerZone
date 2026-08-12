'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { summarizeUploadBatch, type BatchSkip } from '@/lib/upload-batch'
import {
  BildFehler,
  bildFehlerText,
  bildFehlerKurz,
  bildFehlerMeldung,
  protokolliereBildFehler,
  type BildFehlerArt,
} from '@/lib/upload-fehler'

export type ImageUploadVariant = 'product' | 'banner' | 'logo' | 'gallery' | 'status'

/**
 * Längste Kante nach dem Verkleinern, je Verwendung.
 *
 * `banner` liegt seit dem Cover-Sprint höher als der Rest: Das Titelbild ist
 * das einzige Bild, das über die VOLLE Bildschirmbreite läuft (sizes="100vw").
 * Auf einem 1920er-Monitor mit doppelter Pixeldichte fragt der Browser 3840px
 * an — bei 2400px Quelle bekam er hochskalierte Pixel. Zusätzlich schneidet
 * object-cover aus dem Foto einen Querstreifen heraus, sodass von der Quelle
 * ohnehin nur ein Teil übrig bleibt; die Reserve dafür fehlte.
 *
 * Gemessen (Chromium, 12-MP-Vorlage, unveränderte Qualität 0.82): ein
 * detailreiches Wiesenfoto — der ungünstigste und für ein Hof-Titelbild
 * typischste Fall — ergibt bei 3200px rund 1,9 MB. Die Schranken liegen bei
 * 3,5 MB (uploadOne weiter unten) und 4 MB (src/app/api/upload/route.ts:48).
 * Die Qualität musste deshalb NICHT gesenkt werden.
 *
 * Exportiert, damit der Wert prüfbar ist statt nur behauptet.
 */
export const MAX_LONG_SIDE: Record<ImageUploadVariant, number> = {
  logo:    800,
  product: 2400,
  banner:  3200,
  gallery: 2400,
  status:  2400,
}

/** Wie viel vom Anfang der Datei die Lese-Probe anfordert. */
export const LESE_PROBE_BYTES = 64 * 1024

/**
 * Wie die Lese-Probe an die Bytes kommt.
 *
 * `null` heißt ausdrücklich „kann nicht prüfen" und ist etwas anderes als ein
 * leerer Puffer: Fehlt die Schnittstelle, ist das kein Beweis für eine unlesbare
 * Datei. Ein leerer Puffer dagegen ist einer.
 *
 * Herausgezogen, damit `canReadFile` eine reine Funktion bleibt und ohne Browser
 * prüfbar ist — Lesezugriffe lassen sich in jsdom nicht nachstellen, ein
 * eingesetzter Leser dagegen schon.
 */
export type DateiLeser = (file: File, bytes: number) => Promise<ArrayBuffer | null>

/** Der echte Weg im Browser. */
const browserLeser: DateiLeser = async (file, bytes) => {
  const anfang = file.slice(0, bytes)
  // Safari vor 14 kennt Blob.arrayBuffer nicht.
  if (typeof anfang.arrayBuffer !== 'function') return null
  return anfang.arrayBuffer()
}

/**
 * Kommen die Bytes überhaupt beim Browser an?
 *
 * Die Frage klingt trivial und war die Lücke: Bis hierher hat NIEMAND die Datei
 * angefasst, bevor über sie geurteilt wurde. `file.size` ist Metadatum, kein
 * Zugriff. Auf Android liefern manche Speicherdienste (SD-Backup, App- und
 * Cloud-Alben) eine Datei-Referenz aus, hinter der beim Zugriff nichts mehr
 * steht — das Foto ist einwandfrei, der Weg dorthin nicht. Ohne diese Probe
 * feuerte nur img.onerror, und das sah aus wie ein unbekanntes Format.
 *
 * 64 kB genügen: Es geht nicht um den Inhalt, sondern darum, ob der Speicher
 * überhaupt etwas herausgibt. Ein ganzes 12-MP-Foto dafür in den Speicher zu
 * ziehen wäre Verschwendung.
 *
 * Fehlt `arrayBuffer` (Safari vor 14), wird NICHT geurteilt: Eine fehlende
 * Schnittstelle ist kein Beweis für eine unlesbare Datei. Dann übernimmt wie
 * bisher die Dekodier-Probe.
 *
 * `lies` ist einsetzbar, damit die drei Ausgänge — gelesen, geworfen, leer —
 * ohne Browser prüfbar sind. In der Anwendung bleibt es beim Standard.
 */
export async function canReadFile(file: File, lies: DateiLeser = browserLeser): Promise<boolean> {
  try {
    const puffer = await lies(file, LESE_PROBE_BYTES)
    // Kein Urteil möglich — die Datei gilt als lesbar, die Dekodier-Probe
    // entscheidet weiter.
    if (puffer === null) return true
    // Null Bytes zurück heißt: da war nichts zu holen. Eine leere Datei ist
    // ebenso wenig hochladbar wie eine, deren Speicherort ins Leere zeigt.
    return puffer.byteLength > 0
  } catch {
    return false
  }
}

/**
 * Die Probe über ein <img>-Element.
 *
 * Sie ist die MASSGEBLICHE Auskunft, weil resizeToWebP weiter unten die
 * eigentliche Arbeit ebenfalls über ein <img> erledigt (siehe dort): Was hier
 * lädt, lädt dort auch. Genau deshalb dürfen beide Zweige von canDecodeImage
 * hier landen — sie prüfen damit das, worauf es später ankommt.
 */
function canDecodeViaImageElement(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(true)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(false)
    }
    img.src = objectUrl
  })
}

/**
 * Probiert VOR Vorschau und Upload, ob der Browser die Datei überhaupt
 * dekodieren kann. Chrome/Android scheitert hier an HEIC, Safari nicht —
 * genau das ist gewollt, denn Safari kann HEIC anschließend zu JPEG umwandeln.
 *
 * createImageBitmap ist der schnelle Weg; die Verkleinerung auf 16px hält den
 * Speicherbedarf klein, denn ein 48-MP-Foto würde sonst unnötig groß im
 * Speicher landen.
 *
 * ABER: Ein Fehlschlag von createImageBitmap beweist NICHT, dass die Datei
 * unlesbar ist. Schutzmechanismen des Browsers können den Aufruf stören,
 * während dieselbe Datei über ein <img> anstandslos dekodiert — am Gerät mit
 * Braves strengem Fingerprint-Schutz und einem einwandfreien Baseline-JPEG
 * (4032×3024) reproduziert. Deshalb ist der Fehlschlag hier kein Urteil,
 * sondern nur der Anlass, die maßgebliche <img>-Probe zu befragen. Erst wenn
 * AUCH die scheitert, ist die Datei wirklich nicht lesbar.
 *
 * Vorher gab der catch direkt `false` zurück. Das war doppelt falsch: Der Bauer
 * bekam für ein tadelloses JPEG die Format-Meldung („z. B. HEIC"), und weil die
 * Absage schon vor resizeToWebP fiel, konnte die eigens dafür gebaute
 * Blockier-Meldung in diesem Pfad überhaupt nie erscheinen.
 *
 * Der Preis: Bei einer tatsächlich unlesbaren Datei (echtes HEIC auf Android)
 * werden jetzt zwei Wege statt einem probiert. Das kostet einen Wimpernschlag
 * auf einem Pfad, der ohnehin in einer Absage endet — gemessen am falschen
 * Rat, den der Bauer vorher bekam, ist das nichts.
 *
 * Was hier NICHT geprüft wird: ob der Browser das gelesene Bild anschließend
 * wieder herausgeben darf. Dekodieren ist erlaubt, das Auslesen des Canvas
 * kann trotzdem blockiert sein — diese zweite Hürde fällt erst in
 * resizeToWebP und trägt dort einen eigenen Fehler.
 */
export async function canDecodeImage(file: File): Promise<boolean> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { resizeWidth: 16, resizeQuality: 'low' })
      bitmap.close?.()
      return true
    } catch {
      // Bewusst KEIN `return false` — Rückfall auf die <img>-Probe unten.
    }
  }

  return canDecodeViaImageElement(file)
}

/**
 * Die Vorprüfung einer ausgewählten Datei — liefert die Ursache, nicht nur ein
 * Ja/Nein, und legt die Reihenfolge an EINEM Ort fest: lesen → dekodieren.
 * (Die dritte Stufe, kodieren, kann erst in resizeToWebP scheitern.)
 *
 * Die Reihenfolge ist keine Geschmacksfrage: Jede Stufe setzt die vorige
 * voraus. Ohne Bytes kein Dekodieren, ohne Dekodieren kein Kodieren. Stünde
 * die Lese-Probe hinten, käme man nie an ihr an — die Dekodier-Probe hätte
 * längst „Format" gemeldet, so wie bisher.
 *
 * `null` heißt: nichts gefunden, weitermachen.
 */
export async function pruefeDateiVorUpload(file: File): Promise<BildFehlerArt | null> {
  if (!(await canReadFile(file))) return 'lesen'
  if (!(await canDecodeImage(file))) return 'dekodierung'
  return null
}

/**
 * Verkleinert und kodiert neu. Scheitert das, gibt es genau zwei Ursachen —
 * und die Funktion sagt jetzt, welche es war (src/lib/upload-fehler.ts):
 *
 *   'dekodierung'  Das <img> lädt die Datei gar nicht erst (img.onerror).
 *   'kodierung'    Gelesen wurde sie, aber der Canvas gibt nichts zurück:
 *                  kein 2D-Kontext, toBlob liefert null oder wirft. Braves
 *                  Fingerprint-Schutz landet hier. Vorher lief dieser Fall in
 *                  eine Meldung, die ein anderes Dateiformat empfahl — ein
 *                  Rat, der bei blockiertem Canvas nie funktioniert.
 */
export async function resizeToWebP(file: File, maxLongSide: number, quality = 0.82): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      // Alles ab hier ist Canvas-Arbeit. Was davon schiefgeht — ein
      // verweigerter Kontext, ein werfendes drawImage, ein leeres toBlob —
      // ist dieselbe Ursache: der Browser gibt das Bild nicht wieder heraus.
      try {
        const { naturalWidth: w, naturalHeight: h } = img
        const scale = Math.min(1, maxLongSide / Math.max(w, h))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new BildFehler('kodierung'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const finish = (blob: Blob) => {
          // Typ und Endung ehrlich aus dem tatsächlichen Encode-Ergebnis ableiten
          const ext = blob.type === 'image/webp' ? '.webp' : '.jpg'
          const outName = file.name.replace(/\.[^.]+$/, '') + ext
          resolve(new File([blob], outName, { type: blob.type }))
        }

        // Safari kann kein WebP und fällt spezifikationsgemäß still auf PNG
        // zurück — dann denselben Canvas als JPEG kodieren. Erst wenn AUCH das
        // nichts liefert, ist die Kodierung wirklich blockiert.
        const alsJpeg = () => {
          try {
            canvas.toBlob(
              (jpegBlob) => {
                if (!jpegBlob || jpegBlob.type !== 'image/jpeg') {
                  return reject(new BildFehler('kodierung'))
                }
                finish(jpegBlob)
              },
              'image/jpeg',
              0.85,
            )
          } catch {
            // Der zweite toBlob-Aufruf sitzt im Callback des ersten und läuft
            // damit außerhalb des äußeren try — er braucht sein eigenes Netz.
            reject(new BildFehler('kodierung'))
          }
        }

        canvas.toBlob(
          (blob) => {
            if (blob && blob.type === 'image/webp') return finish(blob)
            alsJpeg()
          },
          'image/webp',
          quality,
        )
      } catch {
        reject(new BildFehler('kodierung'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // Zweites Netz hinter der Auswahl-Probe: hier ist wirklich das Format
      // schuld, nicht die Verarbeitung.
      reject(new BildFehler('dekodierung'))
    }
    img.src = objectUrl
  })
}

/** Ergebnis eines einzelnen Durchlaufs: volle Meldung für Einzelauswahl,
 *  Kurzgrund für die Sammelmeldung einer Serie. */
type UploadResult = { ok: true } | { ok: false; message: string; short: string }

interface UseImageUploadOptions {
  variant: ImageUploadVariant
  targetId?: string
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
  targetId,
  oldUrl,
  multiple = false,
  maxFiles,
  onUploaded,
}: UseImageUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function resetInput() {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadOne(file: File, batch: boolean): Promise<UploadResult> {
    if (file.size > 25 * 1024 * 1024) {
      return { ok: false, message: 'Datei zu groß (max. 25 MB)', short: 'zu groß (max. 25 MB)' }
    }

    // Lese- und Format-Probe VOR allem anderen: so kommt die Absage sofort und
    // nicht erst nach Verkleinern und Hochladen — und sie nennt die richtige
    // der drei Ursachen statt pauschal „Format".
    const vorbefund = await pruefeDateiVorUpload(file)
    if (vorbefund) {
      protokolliereBildFehler(vorbefund, file)
      return {
        ok: false,
        message: bildFehlerText(vorbefund),
        short: bildFehlerKurz(vorbefund),
      }
    }

    try {
      const resized = await resizeToWebP(file, MAX_LONG_SIDE[variant])
      if (resized.size > 3.5 * 1024 * 1024) {
        return {
          ok: false,
          message: 'Bild konnte nicht ausreichend verkleinert werden — bitte kleineres Foto wählen',
          short: 'zu groß nach dem Verkleinern',
        }
      }

      const fd = new FormData()
      fd.append('file', resized)
      fd.append('target', variant)
      if (targetId) fd.append('id', targetId)
      if (oldUrl) fd.append('oldUrl', oldUrl)

      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload fehlgeschlagen' }))
        const text = (err.error as string) ?? 'Upload fehlgeschlagen'
        return { ok: false, message: text, short: text }
      }

      const { url } = await res.json()
      await onUploaded(url as string, { batch })
      return { ok: true }
    } catch (e) {
      // Ein BildFehler bringt seine Ursache mit und bekommt den passenden
      // Text; alles andere (Netz, Server-Antwort) behält seine eigene Meldung.
      const { text, kurz, art } = bildFehlerMeldung(e)
      if (art) protokolliereBildFehler(art, file)
      return { ok: false, message: text, short: kurz }
    }
  }

  async function handleSingle(file: File) {
    setIsUploading(true)
    try {
      const result = await uploadOne(file, false)
      if (!result.ok) toast.error(result.message)
    } finally {
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
      // Sequenziell: schont das Rate-Limit, und ein Fehler bricht die Serie nicht ab
      for (let i = 0; i < liste.length; i++) {
        setProgress({ current: i + 1, total: liste.length })
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
