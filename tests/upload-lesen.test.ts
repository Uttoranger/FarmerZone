/**
 * Der Fehler aus JAVASCRIPT-NEXTJS-3: Die Lese-Stufe (pruefeLesbarkeit) fing
 * Probe und Volllesen mit leerem catch ab. Sentry sah nur die Ursache
 * „lesen" — nicht, ob die Datei stumm blieb (Zeitwächter) oder sofort
 * abgelehnt wurde (NotReadableError, NotFoundError), und nicht, wie lange es
 * dauerte. Genau das unterscheidet ein hängendes Cloud-Album von einer
 * entzogenen Berechtigung.
 *
 * Seit JAVASCRIPT-NEXTJS-5 dazu: der zweite Leseversuch nach einer Pause
 * (nur nach sofortiger Ablehnung), das Format an den ersten Bytes (HEIC nie
 * hochladen, über die Dateien-App muss es ein Bild sein) und die Meldung
 * ohne Dateialter.
 *
 * Seit JAVASCRIPT-NEXTJS-6: Nach der Probe wird die ganze Datei einmal als
 * Kopie gelesen; das Format entscheidet sich an der Kopie. Brachte schon das
 * Volllesen die Datei, ist das die Kopie.
 *
 * Geprüft wird der echte Ablauf in pruefeLesbarkeit. Die Datei ist eine
 * Attrappe, deren zwei Lesewege nach einer festen Zeit liefern, scheitern
 * oder nie antworten. Die Zeit läuft über fake timers — Zeitlimits und Dauer
 * sind damit exakt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { pruefeLesbarkeit } from '@/components/shared/image-upload'
import type { FotoWeg } from '@/lib/foto-wege'
import { LESE_SOFORT_MS, ordneLeseFehler, type LeseDiagnose, type LeseVersuch } from '@/lib/upload-diagnose'
import {
  BildFehler,
  bildFehlerArtVon,
  bildFehlerMeldung,
  IMAGE_HEIC_ERROR,
  IMAGE_NOT_PHOTO_ERROR,
  IMAGE_READ_ERROR,
  IMAGE_READ_PERMISSION_ERROR,
  IMAGE_READ_UNCLEAR_ERROR,
  leseFehlerText,
} from '@/lib/upload-fehler'
import { baueUploadMeldung, meldeUploadFehler } from '@/lib/upload-meldung'
import { LESE_PROBE_LIMIT_MS, LESE_VOLL_LIMIT_MS, LESE_ZWEITVERSUCH_PAUSE_MS } from '@/lib/upload-zeitwaechter'

const JETZT = Date.UTC(2026, 8, 26, 12, 0, 0)
const DATEINAME = 'Hof Test Stall.jpg'

/** Die ersten Bytes eines JPEG — genug für die Format-Probe. */
function jpegBytes(): ArrayBuffer {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0]).buffer
}
function heicBytes(): ArrayBuffer {
  return Uint8Array.from([0, 0, 0, 0x18, ...'ftypheic'.split('').map((z) => z.charCodeAt(0))]).buffer
}
function textBytes(): ArrayBuffer {
  return Uint8Array.from('hello world!'.split('').map((z) => z.charCodeAt(0))).buffer
}

/** Ein Versprechen, das nie fertig wird — die stumme Quelle. */
const nie = () => new Promise<ArrayBuffer>(() => {})
/** Liefert nach `ms` Bytes (ein JPEG-Kopf, damit das Format durchgeht). */
const liefertNach = (ms: number, bytes: () => ArrayBuffer = jpegBytes) => () =>
  new Promise<ArrayBuffer>((erfuellen) => setTimeout(() => erfuellen(bytes()), ms))
/** Scheitert nach `ms` mit `fehler`. */
const scheitertNach = (ms: number, fehler: unknown) => () =>
  new Promise<ArrayBuffer>((_, ablehnen) => setTimeout(() => ablehnen(fehler), ms))

const nichtLesbar = () =>
  new DOMException(
    'The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.',
    'NotReadableError'
  )
const nichtGefunden = () =>
  new DOMException('A requested file or directory could not be found at the time an operation was processed.', 'NotFoundError')

/** Datei-Attrappe: `probe` ist das Teil-Lesen (64 KB), `voll` das Lesen am Stück. */
function datei(probe: () => Promise<ArrayBuffer>, voll: () => Promise<ArrayBuffer>): File {
  return {
    name: DATEINAME,
    type: 'image/jpeg',
    size: 6_000_000,
    lastModified: JETZT,
    slice: () => ({ arrayBuffer: probe }),
    arrayBuffer: voll,
  } as unknown as File
}

/** Lässt die Lese-Stufe laufen und sammelt Ausgang und Diagnose. */
async function lies(f: File, weg: FotoWeg = 'galerie', zeitMs = LESE_PROBE_LIMIT_MS + LESE_VOLL_LIMIT_MS) {
  let lesen: LeseDiagnose | undefined
  const ausgang = pruefeLesbarkeit(f, {
    weg,
    onLesen: (d) => {
      lesen = d
    },
  }).then(
    () => ({ fehler: undefined }),
    (fehler: unknown) => ({ fehler })
  )
  await vi.advanceTimersByTimeAsync(zeitMs)
  return { ...(await ausgang), lesen }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Lese-Stufe — was Sentry erfährt (pruefeLesbarkeit)', () => {
  it('Zeitlimit bei der Probe und beim Volllesen: die stumme Quelle, mit beiden Wartezeiten', async () => {
    const { fehler, lesen } = await lies(datei(nie, nie))

    expect(bildFehlerArtVon(fehler)).toBe('lesen')
    // Nur hier darf der Cloud-Text stehen: Etwas hat gewartet (#135).
    expect((fehler as Error).message).toBe(IMAGE_READ_ERROR)
    expect(lesen).toEqual({
      probe: { ergebnis: 'zeitlimit', dauerMs: LESE_PROBE_LIMIT_MS },
      voll: { ergebnis: 'zeitlimit', dauerMs: LESE_VOLL_LIMIT_MS },
    })
  })

  it('Zeitlimit bei der Probe, das Volllesen liefert: kein Fehler, aber festgehalten', async () => {
    const { fehler, lesen } = await lies(datei(nie, liefertNach(1_200)))

    expect(fehler).toBeUndefined()
    expect(lesen).toEqual({
      probe: { ergebnis: 'zeitlimit', dauerMs: LESE_PROBE_LIMIT_MS },
      voll: { ergebnis: 'ok', dauerMs: 1_200 },
    })
  })

  it('Fehler bei der Probe, Erfolg beim Volllesen: Name, Nachricht und Dauer der Probe', async () => {
    const { fehler, lesen } = await lies(datei(scheitertNach(12, nichtLesbar()), liefertNach(900)))

    expect(fehler).toBeUndefined()
    expect(lesen).toEqual({
      probe: {
        ergebnis: 'fehler',
        klasse: 'NotReadableError',
        meldung: nichtLesbar().message,
        dauerMs: 12,
      },
      voll: { ergebnis: 'ok', dauerMs: 900 },
    })
  })

  it('beides scheitert sofort mit NotReadableError: das Handy hat die Datei nicht freigegeben', async () => {
    // Der Fall aus JAVASCRIPT-NEXTJS-4 und -5 — 80 und 25 ms. Bis #133 stand
    // hier der Cloud-Album-Text; der Bauer suchte einen Fehler in seinen
    // Album-Einstellungen, den es nicht gab.
    const { fehler, lesen } = await lies(datei(scheitertNach(84, nichtLesbar()), scheitertNach(14, nichtLesbar())))

    expect(fehler).toBeInstanceOf(BildFehler)
    expect((fehler as Error).message).toBe(IMAGE_READ_PERMISSION_ERROR)
    // Die URSACHE bleibt 'lesen' — für Sentry und für den Kurzgrund einer Serie.
    expect(bildFehlerMeldung(fehler)).toEqual({
      text: IMAGE_READ_PERMISSION_ERROR,
      kurz: 'Datei nicht lesbar',
      art: 'lesen',
    })
    // Kein Dateialter mehr — Android setzt lastModified auf den Auswahlzeitpunkt.
    expect(lesen && 'dateiAlterTage' in lesen).toBe(false)
  })

  it('scheitert die Probe sofort und das Volllesen mit einem anderen Fehler: keine Ursache behauptet', async () => {
    const { fehler, lesen } = await lies(datei(scheitertNach(5, nichtGefunden()), scheitertNach(3, nichtGefunden())))

    expect(fehler).toBeInstanceOf(BildFehler)
    expect((fehler as Error).message).toBe(IMAGE_READ_UNCLEAR_ERROR)
    expect(lesen?.voll).toMatchObject({ klasse: 'NotFoundError' })
  })

  it('beides scheitert sofort: je Versuch sein eigener Fehler in der Diagnose', async () => {
    const { fehler, lesen } = await lies(datei(scheitertNach(5, nichtLesbar()), scheitertNach(3, nichtGefunden())))

    expect(fehler).toBeInstanceOf(BildFehler)
    // Gemischtes Paar: Ein entzogener Zugriff sieht auf den zwei Lesewegen
    // verschieden aus, und „nochmal auswählen" stimmt in beiden Fällen.
    expect((fehler as Error).message).toBe(IMAGE_READ_PERMISSION_ERROR)
    expect(lesen).toMatchObject({
      probe: { ergebnis: 'fehler', klasse: 'NotReadableError', meldung: nichtLesbar().message, dauerMs: 5 },
      voll: { ergebnis: 'fehler', klasse: 'NotFoundError', meldung: nichtGefunden().message, dauerMs: 3 },
    })
  })

  it('gelingt die Probe, wird die Datei einmal ganz gelesen — als Kopie, nicht als Volllesen', async () => {
    const volllesen = vi.fn(liefertNach(1))
    const { fehler, lesen } = await lies(datei(liefertNach(4), volllesen))

    expect(fehler).toBeUndefined()
    expect(volllesen).toHaveBeenCalledTimes(1)
    expect(lesen).toEqual({ probe: { ergebnis: 'ok', dauerMs: 4 }, kopie: { ergebnis: 'ok', dauerMs: 1 } })
    expect(lesen && 'voll' in lesen).toBe(false)
  })

  it('brachte schon das Volllesen die Datei, ist das die Kopie — kein zweites Lesen', async () => {
    const volllesen = vi.fn(liefertNach(900))
    const { fehler, lesen } = await lies(datei(scheitertNach(12, nichtLesbar()), volllesen))

    expect(fehler).toBeUndefined()
    expect(volllesen).toHaveBeenCalledTimes(1)
    expect(lesen && 'kopie' in lesen).toBe(false)
  })

  it('scheitert die Kopie nach gelungener Probe, ist es ein Lesefehler — mit ihrem Befund und Urteil', async () => {
    // JAVASCRIPT-NEXTJS-6: Die Probe gelang, das Ganze kam nicht heraus.
    const { fehler, lesen } = await lies(datei(liefertNach(4), scheitertNach(30, nichtLesbar())))

    expect(bildFehlerArtVon(fehler)).toBe('lesen')
    expect((fehler as Error).message).toBe(IMAGE_READ_PERMISSION_ERROR)
    expect(lesen).toEqual({
      probe: { ergebnis: 'ok', dauerMs: 4 },
      kopie: { ergebnis: 'fehler', klasse: 'NotReadableError', meldung: nichtLesbar().message, dauerMs: 30 },
      // Sofort abgelehnt → Netz 1: nach der Pause noch einmal das Ganze (die Probe war ja durch).
      zweiterVersuch: { ergebnis: 'fehler', klasse: 'NotReadableError', meldung: nichtLesbar().message, dauerMs: 30 },
    })
  })

  it('kommt nach der gescheiterten Kopie die Freigabe zurück, bringt der zweite Versuch die Kopie', async () => {
    const probe = vi.fn(liefertNach(4))
    let ganz = 0
    const volllesen = vi.fn(() => (ganz++ === 0 ? scheitertNach(30, nichtLesbar())() : liefertNach(5)()))

    const { fehler, lesen } = await lies(datei(probe, volllesen))

    expect(fehler).toBeUndefined()
    // Die Probe war schon durch — sie wird nicht wiederholt.
    expect(probe).toHaveBeenCalledTimes(1)
    expect(volllesen).toHaveBeenCalledTimes(2)
    expect(lesen?.zweiterVersuch).toEqual({ ergebnis: 'ok', dauerMs: 5 })
  })

  it('bleibt die Kopie stumm, greift der Zeitwächter des Volllesens — die stumme Quelle', async () => {
    const { fehler, lesen } = await lies(datei(liefertNach(4), nie))

    expect((fehler as Error).message).toBe(IMAGE_READ_ERROR)
    expect(lesen?.kopie).toEqual({ ergebnis: 'zeitlimit', dauerMs: LESE_VOLL_LIMIT_MS })
  })

  it('nennt den Namen auch, wenn der Browser eine DOMException liefert, die kein Error ist', async () => {
    // Ältere Safari-Stände: DOMException erbt dort nicht von Error.
    const fremd = { name: 'NotReadableError', message: 'nicht lesbar' }
    const { lesen } = await lies(datei(scheitertNach(7, fremd), liefertNach(1)))

    expect(lesen?.probe).toEqual({ ergebnis: 'fehler', klasse: 'NotReadableError', meldung: 'nicht lesbar', dauerMs: 7 })
  })

  it('lässt als Klasse nur einen Namen durch — ein Pfad wird „unbekannt"', async () => {
    const pfadAlsName = { name: '/storage/emulated/0/DCIM/Hof_Test.jpg', message: 'x' }
    const { lesen } = await lies(datei(scheitertNach(5, pfadAlsName), liefertNach(1)))

    expect(lesen?.probe).toEqual({ ergebnis: 'fehler', klasse: 'unbekannt', meldung: 'x', dauerMs: 5 })
  })

  it('bleibt beim Wegweiser, auch wenn sich der Fehler des Browsers nicht einmal lesen lässt', async () => {
    const unlesbar = {
      get name(): string {
        throw new Error('Getter kaputt')
      },
    }
    const { fehler, lesen } = await lies(datei(scheitertNach(5, unlesbar), scheitertNach(5, unlesbar)))

    expect(bildFehlerArtVon(fehler)).toBe('lesen')
    // Ohne erkennbaren Grund der unbestimmte Text — er nennt die Auswege, aber
    // keine Ursache.
    expect((fehler as Error).message).toBe(IMAGE_READ_UNCLEAR_ERROR)
    expect(lesen?.voll).toEqual({ ergebnis: 'fehler', klasse: 'unbekannt', meldung: '', dauerMs: 5 })
  })

  it('lässt weder Dateinamen noch Adresse in die Diagnose', async () => {
    const verraeterisch = new DOMException(
      `Could not read ${DATEINAME} from content://media/external/images/media/4711`,
      'NotReadableError'
    )
    const { lesen } = await lies(datei(scheitertNach(5, verraeterisch), scheitertNach(5, verraeterisch)))

    const text = JSON.stringify(lesen)
    expect(text).not.toContain(DATEINAME)
    expect(text).not.toContain('content://')
    expect(text).not.toContain('4711')
    expect(lesen?.probe).toMatchObject({ meldung: expect.stringContaining('[entfernt]') })
  })
})

describe('Netz 1 — der zweite Leseversuch (JAVASCRIPT-NEXTJS-5)', () => {
  it('nach sofortiger Ablehnung EIN weiterer Versuch nach der Pause — gelingt er, geht es weiter', async () => {
    let aufrufe = 0
    // Die Probe scheitert beim ersten Mal sofort, beim zweiten liefert sie —
    // und mit der Freigabe kommt auch das Ganze für die Kopie heraus.
    const probe = () => (aufrufe++ === 0 ? scheitertNach(84, nichtLesbar())() : liefertNach(3)())
    let ganz = 0
    const volllesen = vi.fn(() => (ganz++ === 0 ? scheitertNach(14, nichtLesbar())() : liefertNach(2)()))

    const { fehler, lesen } = await lies(datei(probe, volllesen))

    expect(fehler).toBeUndefined()
    expect(aufrufe).toBe(2)
    expect(volllesen).toHaveBeenCalledTimes(2)
    expect(lesen).toEqual({
      probe: { ergebnis: 'fehler', klasse: 'NotReadableError', meldung: nichtLesbar().message, dauerMs: 84 },
      voll: { ergebnis: 'fehler', klasse: 'NotReadableError', meldung: nichtLesbar().message, dauerMs: 14 },
      zweiterVersuch: { ergebnis: 'ok', dauerMs: 3 },
      kopie: { ergebnis: 'ok', dauerMs: 2 },
    })
  })

  it('wartet die Pause wirklich ab, bevor er es noch einmal versucht', async () => {
    let aufrufe = 0
    const probe = () => {
      aufrufe++
      return scheitertNach(10, nichtLesbar())()
    }
    const ausgang = pruefeLesbarkeit(datei(probe, scheitertNach(10, nichtLesbar()))).catch(() => undefined)

    // Probe (10 ms) und Volllesen (10 ms) sind durch, die Pause läuft.
    await vi.advanceTimersByTimeAsync(20 + LESE_ZWEITVERSUCH_PAUSE_MS - 1)
    expect(aufrufe).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(aufrufe).toBe(2)
    await vi.advanceTimersByTimeAsync(100)
    await ausgang
  })

  it('scheitert auch der zweite Versuch, bleibt es der Freigabe-Fall — mit dem zweiten Versuch in der Diagnose', async () => {
    const { fehler, lesen } = await lies(datei(scheitertNach(80, nichtLesbar()), scheitertNach(25, nichtLesbar())))

    expect((fehler as Error).message).toBe(IMAGE_READ_PERMISSION_ERROR)
    expect(lesen?.zweiterVersuch).toEqual({
      ergebnis: 'fehler',
      klasse: 'NotReadableError',
      meldung: nichtLesbar().message,
      dauerMs: 80,
    })
    expect(ordneLeseFehler(lesen!)).toBe('erlaubnis')
  })

  it('keinen zweiten Versuch für die stumme Quelle — sie hat schon 28 Sekunden gewartet', async () => {
    const probe = vi.fn(nie)
    const { fehler, lesen } = await lies(datei(probe, nie))

    expect(bildFehlerArtVon(fehler)).toBe('lesen')
    expect(probe).toHaveBeenCalledTimes(1)
    expect(lesen && 'zweiterVersuch' in lesen).toBe(false)
  })

  it('keinen zweiten Versuch für Unbestimmtes — dort ist nichts, was zurückkommen könnte', async () => {
    const probe = vi.fn(scheitertNach(5, nichtGefunden()))
    const { fehler, lesen } = await lies(datei(probe, scheitertNach(3, nichtGefunden())))

    expect((fehler as Error).message).toBe(IMAGE_READ_UNCLEAR_ERROR)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(lesen && 'zweiterVersuch' in lesen).toBe(false)
  })

  it('zählt eine Ablehnung nach Sekunden nicht als sofort — also auch kein zweiter Versuch', async () => {
    const probe = vi.fn(scheitertNach(LESE_SOFORT_MS, nichtLesbar()))
    const { lesen } = await lies(datei(probe, scheitertNach(5, nichtLesbar())))

    expect(probe).toHaveBeenCalledTimes(1)
    expect(lesen && 'zweiterVersuch' in lesen).toBe(false)
  })
})

describe('Das Format an den ersten Bytes der Kopie — vor jedem Transfer', () => {
  it('HEIC wird auf keinem Weg hochgeladen: eigener Fehler, ohne Fachwort', async () => {
    for (const weg of ['galerie', 'kamera', 'dateien'] as const) {
      const { fehler } = await lies(datei(liefertNach(2, heicBytes), liefertNach(1, heicBytes)), weg)

      expect(bildFehlerArtVon(fehler), weg).toBe('heic')
      expect((fehler as Error).message).toBe(IMAGE_HEIC_ERROR)
    }
  })

  it('erkennt HEIC auch, wenn erst das Volllesen die Bytes bringt', async () => {
    const { fehler } = await lies(datei(scheitertNach(5, nichtGefunden()), liefertNach(900, heicBytes)))

    expect(bildFehlerArtVon(fehler)).toBe('heic')
  })

  it('erkennt HEIC auch nach dem zweiten Leseversuch', async () => {
    let aufrufe = 0
    const probe = () => (aufrufe++ === 0 ? scheitertNach(5, nichtLesbar())() : liefertNach(3, heicBytes)())
    let ganz = 0
    const volllesen = () => (ganz++ === 0 ? scheitertNach(5, nichtLesbar())() : liefertNach(3, heicBytes)())
    const { fehler } = await lies(datei(probe, volllesen))

    expect(bildFehlerArtVon(fehler)).toBe('heic')
  })

  it('entscheidet an der Kopie, nicht an der Probe — geprüft wird, was übertragen wird', async () => {
    const { fehler } = await lies(datei(liefertNach(2, jpegBytes), liefertNach(1, heicBytes)))

    expect(bildFehlerArtVon(fehler)).toBe('heic')
  })

  it('über die Dateien-App muss es ein Bild sein — sonst „kein Foto"', async () => {
    const { fehler } = await lies(datei(liefertNach(2, textBytes), liefertNach(1, textBytes)), 'dateien')

    expect(bildFehlerArtVon(fehler)).toBe('kein-foto')
    expect((fehler as Error).message).toBe(IMAGE_NOT_PHOTO_ERROR)
  })

  it('auf den anderen Wegen bleibt Unbekanntes dem Server überlassen — wie bisher', async () => {
    const { fehler } = await lies(datei(liefertNach(2, textBytes), liefertNach(1, textBytes)), 'galerie')
    expect(fehler).toBeUndefined()

    const leer = await lies(datei(liefertNach(2, () => new ArrayBuffer(0)), liefertNach(1)), 'kamera')
    expect(leer.fehler).toBeUndefined()
  })
})

describe('ordneLeseFehler — welcher Lesefehler welche Meldung verdient', () => {
  const fehlgeschlagen = (klasse: string, dauerMs: number): LeseVersuch => ({
    ergebnis: 'fehler',
    klasse,
    meldung: 'x',
    dauerMs,
  })
  const abgelaufen = (dauerMs: number): LeseVersuch => ({ ergebnis: 'zeitlimit', dauerMs })
  const urteil = (probe: LeseVersuch, voll?: LeseVersuch) => ordneLeseFehler({ probe, voll })

  it("nennt den sofortigen NotReadableError 'erlaubnis' — der Fall aus dem Issue", () => {
    expect(urteil(fehlgeschlagen('NotReadableError', 84), fehlgeschlagen('NotReadableError', 14))).toBe('erlaubnis')
  })

  it("nennt jeden Ablauf am Zeitwächter 'cloud' — auch neben einer sofortigen Ablehnung", () => {
    // Ein Ablauf ist die eindeutigste Aussage: Irgendetwas hat gewartet.
    expect(urteil(abgelaufen(LESE_PROBE_LIMIT_MS), abgelaufen(LESE_VOLL_LIMIT_MS))).toBe('cloud')
    expect(urteil(fehlgeschlagen('NotReadableError', 12), abgelaufen(LESE_VOLL_LIMIT_MS))).toBe('cloud')
    expect(urteil(abgelaufen(LESE_PROBE_LIMIT_MS), fehlgeschlagen('NotReadableError', 12))).toBe('cloud')
  })

  it("nennt alles andere 'unbestimmt' statt eine Ursache zu erfinden", () => {
    expect(urteil(fehlgeschlagen('NotFoundError', 5), fehlgeschlagen('NotFoundError', 5))).toBe('unbestimmt')
    expect(urteil(fehlgeschlagen('unbekannt', 5), fehlgeschlagen('unbekannt', 5))).toBe('unbestimmt')
    // Kein gescheiterter Versuch = nichts zu beurteilen (kommt auf dem
    // werfenden Weg nicht vor, der Typ lässt es aber zu).
    expect(urteil({ ergebnis: 'ok', dauerMs: 4 })).toBe('unbestimmt')
  })

  it('zählt eine Ablehnung nach Sekunden nicht mehr als sofort', () => {
    // An der Grenze: knapp darunter noch die Freigabe, ab der Grenze nicht mehr.
    expect(urteil(fehlgeschlagen('NotReadableError', LESE_SOFORT_MS - 1))).toBe('erlaubnis')
    expect(urteil(fehlgeschlagen('NotReadableError', LESE_SOFORT_MS))).toBe('unbestimmt')
  })

  it('genügt EIN NotReadableError, solange beide Versuche sofort abgelehnt haben', () => {
    // Der entzogene Zugriff sieht auf den zwei Lesewegen verschieden aus.
    expect(urteil(fehlgeschlagen('NotReadableError', 5), fehlgeschlagen('NotFoundError', 3))).toBe('erlaubnis')
    expect(urteil(fehlgeschlagen('NotFoundError', 5), fehlgeschlagen('NotReadableError', 3))).toBe('erlaubnis')
  })

  it('verlangt, dass JEDER gescheiterte Versuch sofort abgelehnt hat', () => {
    // Hat einer der beiden es sekundenlang versucht, ist die entzogene
    // Freigabe nicht mehr die nächstliegende Erklärung.
    expect(urteil(fehlgeschlagen('NotReadableError', 5), fehlgeschlagen('NotReadableError', 9_000))).toBe('unbestimmt')
  })

  it('führt zu genau drei Texten, und der Cloud-Text steht nur beim Zeitlimit', () => {
    expect(leseFehlerText('erlaubnis')).toBe(IMAGE_READ_PERMISSION_ERROR)
    expect(leseFehlerText('cloud')).toBe(IMAGE_READ_ERROR)
    expect(leseFehlerText('unbestimmt')).toBe(IMAGE_READ_UNCLEAR_ERROR)
    expect(new Set([IMAGE_READ_PERMISSION_ERROR, IMAGE_READ_ERROR, IMAGE_READ_UNCLEAR_ERROR]).size).toBe(3)
    expect(IMAGE_READ_PERMISSION_ERROR).not.toContain('Cloud')
    expect(IMAGE_READ_UNCLEAR_ERROR).not.toContain('Cloud')
  })
})

describe('Meldung an Sentry — Kontext uploadLesen', () => {
  const lesen: LeseDiagnose = {
    probe: { ergebnis: 'fehler', klasse: 'NotReadableError', meldung: 'nicht lesbar', dauerMs: 12 },
    voll: { ergebnis: 'zeitlimit', dauerMs: LESE_VOLL_LIMIT_MS },
  }
  const eingabe = { ursache: 'lesen' as const, datei: { size: 6_000_000, type: 'image/jpeg' }, weg: 'galerie' as const, versuche: 0 }

  it('legt Probe und Volllesen flach in einen Kontext — Sentry kürzt ab der dritten Ebene', () => {
    const meldung = baueUploadMeldung({ ...eingabe, lesen })

    expect(meldung.contexts.uploadLesen).toEqual({
      probeErgebnis: 'fehler',
      probeKlasse: 'NotReadableError',
      probeMeldung: 'nicht lesbar',
      probeDauerMs: 12,
      vollErgebnis: 'zeitlimit',
      vollDauerMs: LESE_VOLL_LIMIT_MS,
      zweiterVersuchGeholfen: null,
    })
    for (const wert of Object.values(meldung.contexts.uploadLesen ?? {})) {
      expect(wert === null || typeof wert !== 'object').toBe(true)
    }
    // Wie für die ganze Meldung: kein Feld, das einen Dateinamen tragen könnte.
    expect(JSON.stringify(meldung)).not.toMatch(/name/i)
  })

  it('sagt, ob der zweite Leseversuch geholfen hat — mit seinen Feldern', () => {
    const geholfen = baueUploadMeldung({
      ...eingabe,
      lesen: { ...lesen, zweiterVersuch: { ergebnis: 'ok', dauerMs: 3 } },
    })
    expect(geholfen.contexts.uploadLesen).toMatchObject({
      zweiterVersuchErgebnis: 'ok',
      zweiterVersuchDauerMs: 3,
      zweiterVersuchGeholfen: true,
    })

    const vergeblich = baueUploadMeldung({
      ...eingabe,
      lesen: { ...lesen, zweiterVersuch: { ergebnis: 'fehler', klasse: 'NotReadableError', meldung: 'x', dauerMs: 80 } },
    })
    expect(vergeblich.contexts.uploadLesen).toMatchObject({
      zweiterVersuchErgebnis: 'fehler',
      zweiterVersuchKlasse: 'NotReadableError',
      zweiterVersuchMeldung: 'x',
      zweiterVersuchDauerMs: 80,
      zweiterVersuchGeholfen: false,
    })
  })

  it('legt auch die Kopie flach in den Kontext — mit ihrem Fehler, wenn sie scheiterte', () => {
    const meldung = baueUploadMeldung({
      ...eingabe,
      lesen: {
        probe: { ergebnis: 'ok', dauerMs: 88 },
        kopie: { ergebnis: 'fehler', klasse: 'NotReadableError', meldung: 'x', dauerMs: 1_219 },
      },
    })
    expect(meldung.contexts.uploadLesen).toEqual({
      probeErgebnis: 'ok',
      probeDauerMs: 88,
      kopieErgebnis: 'fehler',
      kopieKlasse: 'NotReadableError',
      kopieMeldung: 'x',
      kopieDauerMs: 1_219,
      zweiterVersuchGeholfen: null,
    })
  })

  it('ohne Volllesen nur die Probe — und ohne Lese-Diagnose kein Kontext; kein Dateialter mehr', () => {
    const nurProbe = baueUploadMeldung({ ...eingabe, lesen: { probe: { ergebnis: 'ok', dauerMs: 4 } } })
    expect(nurProbe.contexts.uploadLesen).toEqual({ probeErgebnis: 'ok', probeDauerMs: 4, zweiterVersuchGeholfen: null })
    expect(JSON.stringify(nurProbe)).not.toContain('dateiAlter')
    expect(baueUploadMeldung(eingabe).contexts.uploadLesen).toBeUndefined()
  })

  it('trägt den Weg und die Android-Version — null, wo keine bekannt ist', () => {
    const meldung = baueUploadMeldung({ ...eingabe, weg: 'dateien', androidVersion: 13 })
    expect(meldung.contexts.upload).toMatchObject({ weg: 'dateien', androidVersion: 13 })
    expect(baueUploadMeldung(eingabe).contexts.upload.androidVersion).toBeNull()
  })

  it('reicht die Lese-Diagnose an Sentry weiter', () => {
    vi.mocked(Sentry.captureException).mockClear()
    const fehler = new BildFehler('lesen')

    meldeUploadFehler(fehler, { datei: eingabe.datei, weg: 'galerie', versuche: 0, lesen })

    expect(Sentry.captureException).toHaveBeenCalledWith(
      fehler,
      expect.objectContaining({
        tags: expect.objectContaining({ ursache: 'lesen' }),
        contexts: expect.objectContaining({
          uploadLesen: expect.objectContaining({ probeKlasse: 'NotReadableError', vollErgebnis: 'zeitlimit' }),
        }),
      })
    )
  })

  it('meldet ein HEIC-Foto mit Weg und Größe — damit wir zählen können, wie oft es vorkommt', () => {
    vi.mocked(Sentry.captureException).mockClear()
    const fehler = new BildFehler('heic')

    meldeUploadFehler(fehler, { datei: { size: 3_400_000, type: 'image/heic' }, weg: 'dateien', versuche: 0 })

    expect(Sentry.captureException).toHaveBeenCalledWith(
      fehler,
      expect.objectContaining({
        tags: expect.objectContaining({ ursache: 'heic' }),
        contexts: expect.objectContaining({
          upload: expect.objectContaining({ weg: 'dateien', dateiGroesseBytes: 3_400_000, dateiTyp: 'image/heic' }),
        }),
      })
    )
  })
})
