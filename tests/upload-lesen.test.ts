/**
 * Der Fehler aus JAVASCRIPT-NEXTJS-3: Die Lese-Stufe (pruefeLesbarkeit) fing
 * Probe und Volllesen mit leerem catch ab. Sentry sah nur die Ursache
 * „lesen" — nicht, ob die Datei stumm blieb (Zeitwächter) oder sofort
 * abgelehnt wurde (NotReadableError, NotFoundError), und nicht, wie lange es
 * dauerte. Genau das unterscheidet ein hängendes Cloud-Album von einer
 * entzogenen Berechtigung.
 *
 * Geprüft wird der echte Ablauf in pruefeLesbarkeit und ladeFotoHoch. Die
 * Datei ist eine Attrappe, deren zwei Lesewege nach einer festen Zeit liefern,
 * scheitern oder nie antworten. Die Zeit läuft über fake timers — Zeitlimits
 * und Dauer sind damit exakt.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { ladeFotoHoch, pruefeLesbarkeit } from '@/components/shared/image-upload'
import {
  dateiAlterTage,
  LESE_SOFORT_MS,
  ordneLeseFehler,
  type LeseDiagnose,
  type LeseVersuch,
} from '@/lib/upload-diagnose'
import {
  BildFehler,
  bildFehlerArtVon,
  bildFehlerMeldung,
  IMAGE_READ_ERROR,
  IMAGE_READ_PERMISSION_ERROR,
  IMAGE_READ_UNCLEAR_ERROR,
  leseFehlerText,
} from '@/lib/upload-fehler'
import { baueUploadMeldung, meldeUploadFehler } from '@/lib/upload-meldung'
import { LESE_PROBE_LIMIT_MS, LESE_VOLL_LIMIT_MS } from '@/lib/upload-zeitwaechter'

const TAG_MS = 24 * 60 * 60 * 1000
const JETZT = Date.UTC(2026, 8, 26, 12, 0, 0)
const DATEINAME = 'Hof Test Stall.jpg'

/** Ein Versprechen, das nie fertig wird — die stumme Quelle. */
const nie = () => new Promise<ArrayBuffer>(() => {})
/** Liefert nach `ms` Bytes. */
const liefertNach = (ms: number) => () =>
  new Promise<ArrayBuffer>((erfuellen) => setTimeout(() => erfuellen(new ArrayBuffer(8)), ms))
/** Scheitert nach `ms` mit `fehler`. */
const scheitertNach = (ms: number, fehler: unknown) => () =>
  new Promise<ArrayBuffer>((_, ablehnen) => setTimeout(() => ablehnen(fehler), ms))

const nichtLesbar = () =>
  new DOMException(
    'The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.',
    'NotReadableError'
  )
const nichtGefunden = () => new DOMException('A requested file or directory could not be found at the time an operation was processed.', 'NotFoundError')

/** Datei-Attrappe: `probe` ist das Teil-Lesen (64 KB), `voll` das Lesen am Stück. */
function datei(probe: () => Promise<ArrayBuffer>, voll: () => Promise<ArrayBuffer>, alterMs = 400.5 * TAG_MS): File {
  return {
    name: DATEINAME,
    type: 'image/jpeg',
    size: 6_000_000,
    lastModified: JETZT - alterMs,
    slice: () => ({ arrayBuffer: probe }),
    arrayBuffer: voll,
  } as unknown as File
}

/** Lässt die Lese-Stufe laufen und sammelt Ausgang und Diagnose. */
async function lies(f: File, zeitMs = LESE_PROBE_LIMIT_MS + LESE_VOLL_LIMIT_MS) {
  let lesen: LeseDiagnose | undefined
  const ausgang = pruefeLesbarkeit(f, (d) => {
    lesen = d
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
    // Nur hier darf der Cloud-Text stehen: Etwas hat gewartet (#134).
    expect((fehler as Error).message).toBe(IMAGE_READ_ERROR)
    expect(lesen).toEqual({
      probe: { ergebnis: 'zeitlimit', dauerMs: LESE_PROBE_LIMIT_MS },
      voll: { ergebnis: 'zeitlimit', dauerMs: LESE_VOLL_LIMIT_MS },
      dateiAlterTage: 400,
    })
  })

  it('Zeitlimit bei der Probe, das Volllesen liefert: kein Fehler, aber festgehalten', async () => {
    const { fehler, lesen } = await lies(datei(nie, liefertNach(1_200)))

    expect(fehler).toBeUndefined()
    expect(lesen).toEqual({
      probe: { ergebnis: 'zeitlimit', dauerMs: LESE_PROBE_LIMIT_MS },
      voll: { ergebnis: 'ok', dauerMs: 1_200 },
      dateiAlterTage: 400,
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
      dateiAlterTage: 400,
    })
  })

  it('beides scheitert sofort mit NotReadableError: das Handy hat die Datei nicht freigegeben', async () => {
    // Der Fall aus JAVASCRIPT-NEXTJS-4 — 84 und 14 ms, Foto 0 Tage alt. Bis
    // #133 stand hier der Cloud-Album-Text; der Bauer suchte einen Fehler in
    // seinen Album-Einstellungen, den es nicht gab.
    const { fehler, lesen } = await lies(datei(scheitertNach(84, nichtLesbar()), scheitertNach(14, nichtLesbar()), 0))

    expect(fehler).toBeInstanceOf(BildFehler)
    expect((fehler as Error).message).toBe(IMAGE_READ_PERMISSION_ERROR)
    // Die URSACHE bleibt 'lesen' — für Sentry und für den Kurzgrund einer Serie.
    expect(bildFehlerMeldung(fehler)).toEqual({
      text: IMAGE_READ_PERMISSION_ERROR,
      kurz: 'Datei nicht lesbar',
      art: 'lesen',
    })
    expect(lesen?.dateiAlterTage).toBe(0)
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
    expect(lesen).toEqual({
      probe: { ergebnis: 'fehler', klasse: 'NotReadableError', meldung: nichtLesbar().message, dauerMs: 5 },
      voll: { ergebnis: 'fehler', klasse: 'NotFoundError', meldung: nichtGefunden().message, dauerMs: 3 },
      dateiAlterTage: 400,
    })
  })

  it('gelingt die Probe, gibt es kein Volllesen — und keinen Eintrag dafür', async () => {
    const volllesen = vi.fn(liefertNach(1))
    const { fehler, lesen } = await lies(datei(liefertNach(4), volllesen))

    expect(fehler).toBeUndefined()
    expect(volllesen).not.toHaveBeenCalled()
    expect(lesen).toEqual({ probe: { ergebnis: 'ok', dauerMs: 4 }, dateiAlterTage: 400 })
    expect(lesen && 'voll' in lesen).toBe(false)
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

describe('ordneLeseFehler — welcher Lesefehler welche Meldung verdient', () => {
  const fehlgeschlagen = (klasse: string, dauerMs: number): LeseVersuch => ({
    ergebnis: 'fehler',
    klasse,
    meldung: 'x',
    dauerMs,
  })
  const abgelaufen = (dauerMs: number): LeseVersuch => ({ ergebnis: 'zeitlimit', dauerMs })
  const urteil = (probe: LeseVersuch, voll?: LeseVersuch) =>
    ordneLeseFehler({ probe, voll, dateiAlterTage: 0 })

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

describe('dateiAlterTage — ganze Tage, nie ein Datum', () => {
  it('rundet auf ganze Tage ab', () => {
    expect(dateiAlterTage(JETZT - 400.9 * TAG_MS, JETZT)).toBe(400)
    expect(dateiAlterTage(JETZT - 60 * 60 * 1000, JETZT)).toBe(0)
  })

  it('sagt nichts, wo es nichts zu sagen gibt: fehlend, 0 (1970) oder in der Zukunft', () => {
    expect(dateiAlterTage(undefined, JETZT)).toBeNull()
    expect(dateiAlterTage(Number.NaN, JETZT)).toBeNull()
    expect(dateiAlterTage(0, JETZT)).toBeNull()
    expect(dateiAlterTage(JETZT + TAG_MS, JETZT)).toBeNull()
  })
})

describe('Meldung an Sentry — Kontext uploadLesen', () => {
  const lesen: LeseDiagnose = {
    probe: { ergebnis: 'fehler', klasse: 'NotReadableError', meldung: 'nicht lesbar', dauerMs: 12 },
    voll: { ergebnis: 'zeitlimit', dauerMs: LESE_VOLL_LIMIT_MS },
    dateiAlterTage: 400,
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
      dateiAlterTage: 400,
    })
    for (const wert of Object.values(meldung.contexts.uploadLesen ?? {})) {
      expect(wert === null || typeof wert !== 'object').toBe(true)
    }
    // Wie für die ganze Meldung: kein Feld, das einen Dateinamen tragen könnte.
    expect(JSON.stringify(meldung)).not.toMatch(/name/i)
  })

  it('ohne Volllesen nur die Probe — und ohne Lese-Diagnose kein Kontext', () => {
    const nurProbe = baueUploadMeldung({ ...eingabe, lesen: { probe: { ergebnis: 'ok', dauerMs: 4 }, dateiAlterTage: null } })
    expect(nurProbe.contexts.uploadLesen).toEqual({ probeErgebnis: 'ok', probeDauerMs: 4, dateiAlterTage: null })
    expect(baueUploadMeldung(eingabe).contexts.uploadLesen).toBeUndefined()
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
})

describe('ladeFotoHoch — gibt die Lese-Diagnose heraus', () => {
  it('meldet sie über onLesen, bevor der Lesefehler geworfen wird', async () => {
    let lesen: LeseDiagnose | undefined
    const ausgang = ladeFotoHoch(datei(scheitertNach(5, nichtLesbar()), nie), 'product', {
      onLesen: (d) => {
        lesen = d
      },
    }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(LESE_PROBE_LIMIT_MS + LESE_VOLL_LIMIT_MS)

    expect(bildFehlerArtVon(await ausgang)).toBe('lesen')
    expect(lesen?.probe).toMatchObject({ ergebnis: 'fehler', klasse: 'NotReadableError' })
    expect(lesen?.voll).toEqual({ ergebnis: 'zeitlimit', dauerMs: LESE_VOLL_LIMIT_MS })
  })

  it('jede Stelle, die einen Upload-Fehler meldet, reicht die Lese-Diagnose mit', () => {
    // Die drei Aufrufer von ladeFotoHoch — ohne onLesen und `lesen` bei
    // meldeUploadFehler bliebe Sentry dort so blind wie vorher.
    for (const datei of [
      'src/components/shared/image-upload.tsx',
      'src/app/teilen/teilen-client.tsx',
      'src/components/products/product-dialog.tsx',
    ]) {
      const text = fs.readFileSync(path.resolve(__dirname, '..', datei), 'utf8')
      expect(text, datei).toMatch(/onLesen: \(/)
      expect(text, datei).toMatch(/meldeUploadFehler\(e, \{[^}]*\blesen\b[^}]*\}\)/)
    }
  })
})
