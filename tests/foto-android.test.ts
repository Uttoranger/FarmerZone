/**
 * JAVASCRIPT-NEXTJS-6 und das Pilot-Handy: Über den Galerie-Weg
 * (accept="image/*") gibt Android dieses Foto nicht verlässlich heraus — mal
 * scheitert schon das Lesen (NotReadableError, -5), mal gelingt die
 * 64-KB-Probe und erst das stückweise Lesen während der Übertragung bricht ab
 * („network error", -6). Über die Dateien-App (breites accept) lädt dasselbe
 * Foto im selben Chrome ohne Fehler.
 *
 * Beweist:
 *  - Auf Android ist die Dateien-App der erste Weg, sonst die Galerie; ein
 *    gemerkter Weg sticht beide.
 *  - Der Ausweg der Karte ist jeweils der andere Weg.
 *  - Der Merker wird nur gesetzt, wenn ein Ausweg klappte, der nicht ohnehin
 *    der Standard ist — und gelöscht, wenn der gemerkte Weg scheitert (auch
 *    mit HEIC, das das iPhone nur über die Galerie wandelt).
 *  - Der Speicher liest mit Zod und übersteht einen Browser, der wirft.
 *  - Die Übertragung bekommt eine Kopie im Speicher, nie die Datei vom Gerät.
 *  - Hook und Produktdialog pflegen den Merker und melden Weg und Wahl.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@vercel/blob/client', () => ({ upload }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { ladeFotoHoch, pruefeLesbarkeit } from '@/components/shared/image-upload'
import { auswegFuer, ersterWeg, leseAusgangVon, merkerNachErgebnis, serienAusgang } from '@/lib/foto-wege'
import { FOTO_WEG_SCHLUESSEL, leseFotoWeg, loescheFotoWeg, schreibeFotoWeg } from '@/lib/foto-weg-speicher'
import { bildFehlerArtVon } from '@/lib/upload-fehler'
import { LESE_ZWEITVERSUCH_PAUSE_MS } from '@/lib/upload-zeitwaechter'
import { baueUploadMeldung } from '@/lib/upload-meldung'

describe('ersterWeg — welcher Weg zuerst, auf welchem Gerät', () => {
  it('Android öffnet die Dateien-App', () => {
    expect(ersterWeg({ android: true, gemerkt: null })).toEqual({ weg: 'dateien', wahl: 'standard' })
  })

  it('iPhone und Desktop bleiben bei der Galerie', () => {
    expect(ersterWeg({ android: false, gemerkt: null })).toEqual({ weg: 'galerie', wahl: 'standard' })
  })

  it('ein gemerkter Weg sticht den Standard — in beide Richtungen', () => {
    expect(ersterWeg({ android: true, gemerkt: 'galerie' })).toEqual({ weg: 'galerie', wahl: 'gemerkt' })
    expect(ersterWeg({ android: false, gemerkt: 'dateien' })).toEqual({ weg: 'dateien', wahl: 'gemerkt' })
  })
})

describe('auswegFuer — der Ausweg der Karte', () => {
  it('ist der jeweils andere Weg', () => {
    expect(auswegFuer('dateien', 'dateien')).toBe('galerie')
    expect(auswegFuer('galerie', 'galerie')).toBe('dateien')
  })

  it('nach der Kamera oder dem Teilen: der gewohnte Weg des Geräts', () => {
    expect(auswegFuer('kamera', 'dateien')).toBe('dateien')
    expect(auswegFuer('teilen', 'galerie')).toBe('galerie')
  })
})

describe('merkerNachErgebnis — merken, benutzen, löschen', () => {
  it('ein Ausweg, der klappte und nicht der Standard ist, wird gemerkt', () => {
    expect(merkerNachErgebnis({ weg: 'galerie', wahl: 'ausweg', ausgang: 'gelesen', standard: 'dateien' })).toEqual({
      art: 'setzen',
      weg: 'galerie',
    })
    expect(merkerNachErgebnis({ weg: 'dateien', wahl: 'ausweg', ausgang: 'gelesen', standard: 'galerie' })).toEqual({
      art: 'setzen',
      weg: 'dateien',
    })
  })

  it('führt der Ausweg zurück zum Standard, braucht es keinen Merker', () => {
    expect(merkerNachErgebnis({ weg: 'dateien', wahl: 'ausweg', ausgang: 'gelesen', standard: 'dateien' })).toEqual({
      art: 'loeschen',
    })
  })

  it('scheitert der gemerkte Weg, wird der Merker gelöscht', () => {
    expect(merkerNachErgebnis({ weg: 'galerie', wahl: 'gemerkt', ausgang: 'unlesbar', standard: 'dateien' })).toEqual({
      art: 'loeschen',
    })
  })

  it('HEIC über den gemerkten Weg löscht ihn auch — sonst hinge ein iPhone an der Dateien-App', () => {
    expect(merkerNachErgebnis({ weg: 'dateien', wahl: 'gemerkt', ausgang: 'heic', standard: 'galerie' })).toEqual({
      art: 'loeschen',
    })
  })

  it('ein Ausweg, der HEIC oder „kein Foto" brachte, hat nicht geklappt — kein Merker', () => {
    expect(merkerNachErgebnis({ weg: 'galerie', wahl: 'ausweg', ausgang: 'heic', standard: 'dateien' })).toBeNull()
    expect(merkerNachErgebnis({ weg: 'dateien', wahl: 'ausweg', ausgang: 'kein-foto', standard: 'galerie' })).toBeNull()
  })

  it('sonst bleibt alles, wie es ist', () => {
    expect(merkerNachErgebnis({ weg: 'galerie', wahl: 'gemerkt', ausgang: 'gelesen', standard: 'dateien' })).toBeNull()
    expect(merkerNachErgebnis({ weg: 'dateien', wahl: 'gemerkt', ausgang: 'kein-foto', standard: 'galerie' })).toBeNull()
    expect(merkerNachErgebnis({ weg: 'dateien', wahl: 'standard', ausgang: 'unlesbar', standard: 'dateien' })).toBeNull()
    expect(merkerNachErgebnis({ weg: 'galerie', wahl: 'ausweg', ausgang: 'unlesbar', standard: 'dateien' })).toBeNull()
    // Die Kamera ist kein Auswahlweg — sie wird nie gemerkt.
    expect(merkerNachErgebnis({ weg: 'kamera', wahl: 'ausweg', ausgang: 'gelesen', standard: 'dateien' })).toBeNull()
  })

  it('der Ausgang kommt aus der Fehlerart — Netz und Server sagen nichts gegen den Weg', () => {
    expect(leseAusgangVon('lesen')).toBe('unlesbar')
    expect(leseAusgangVon('heic')).toBe('heic')
    expect(leseAusgangVon('kein-foto')).toBe('kein-foto')
    expect(leseAusgangVon('server')).toBe('gelesen')
    expect(leseAusgangVon(null)).toBe('gelesen')
  })

  it('eine Serie gilt als geglückt, sobald ein Foto gelesen wurde', () => {
    expect(serienAusgang(['unlesbar', 'gelesen', 'heic'])).toBe('gelesen')
    expect(serienAusgang(['heic', 'unlesbar'])).toBe('unlesbar')
    expect(serienAusgang(['kein-foto', 'heic'])).toBe('heic')
    expect(serienAusgang([])).toBeNull()
  })
})

describe('foto-weg-speicher — localStorage mit Zod', () => {
  function speicher(start: Record<string, string> = {}) {
    const daten = new Map(Object.entries(start))
    return {
      getItem: (k: string) => daten.get(k) ?? null,
      setItem: (k: string, v: string) => void daten.set(k, v),
      removeItem: (k: string) => void daten.delete(k),
      daten,
    }
  }

  it('schreibt, liest und löscht den gemerkten Weg', () => {
    const s = speicher()
    expect(leseFotoWeg(s)).toBeNull()
    schreibeFotoWeg(s, 'galerie')
    expect(s.daten.get(FOTO_WEG_SCHLUESSEL)).toBe('galerie')
    expect(leseFotoWeg(s)).toBe('galerie')
    loescheFotoWeg(s)
    expect(leseFotoWeg(s)).toBeNull()
  })

  it('verwirft, was nicht passt', () => {
    expect(leseFotoWeg(speicher({ [FOTO_WEG_SCHLUESSEL]: 'kamera' }))).toBeNull()
    expect(leseFotoWeg(speicher({ [FOTO_WEG_SCHLUESSEL]: '{"weg":"galerie"}' }))).toBeNull()
  })

  it('übersteht einen Speicher, der wirft, und einen, den es nicht gibt', () => {
    const kaputt = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(leseFotoWeg(kaputt)).toBeNull()
    expect(() => schreibeFotoWeg(kaputt, 'dateien')).not.toThrow()
    expect(() => loescheFotoWeg(kaputt)).not.toThrow()
    expect(leseFotoWeg(null)).toBeNull()
  })
})

describe('die Kopie bei der Auswahl', () => {
  const HOF = 'cltesthofkennung000000001'
  const ZIEL = `https://beispiel.public.blob.vercel-storage.com/farms/${HOF}/gallery/1.webp`
  const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 1, 2, 3, 4, 5, 6, 7, 8])

  /** Eine Datei vom Gerät: Probe und Volllesen liefern, aber jedes Lesen wird gezählt. */
  function geraetedatei() {
    const lesen = { probe: 0, voll: 0, stream: 0 }
    const datei = {
      name: 'Hof Test Stall.jpg',
      type: 'image/jpeg',
      size: JPEG.byteLength,
      lastModified: 0,
      slice: () => ({
        arrayBuffer: () => {
          lesen.probe++
          return Promise.resolve(JPEG.slice(0, 8).buffer)
        },
      }),
      arrayBuffer: () => {
        lesen.voll++
        return Promise.resolve(JPEG.slice().buffer)
      },
      stream: () => {
        lesen.stream++
        throw new TypeError('network error')
      },
    } as unknown as File
    return { datei, lesen }
  }

  beforeEach(() => {
    upload.mockReset()
    // Wie das Blob-SDK: Es liest den Inhalt während der Übertragung über
    // stream(). Bekäme es die Datei vom Gerät, risse genau hier der Upload.
    upload.mockImplementation(async (_pfad: string, inhalt: Blob) => {
      await new Response(inhalt.stream()).arrayBuffer()
      return { url: `https://beispiel.public.blob.vercel-storage.com/originals/${HOF}/x.jpg` }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (adresse: string) =>
        adresse === '/api/upload/token'
          ? new Response(JSON.stringify({ farmId: HOF }), { status: 200 })
          : new Response(JSON.stringify({ url: ZIEL }), { status: 200 })
      )
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('pruefeLesbarkeit gibt eine Kopie mit denselben Bytes zurück — nicht die Datei vom Gerät', async () => {
    const { datei, lesen } = geraetedatei()
    const kopie = await pruefeLesbarkeit(datei)

    expect(kopie).not.toBe(datei)
    expect(kopie).toBeInstanceOf(Blob)
    expect(kopie.type).toBe('image/jpeg')
    expect(kopie.name).toBe(datei.name)
    expect(new Uint8Array(await kopie.arrayBuffer())).toEqual(JPEG)
    // Einmal ganz gelesen — für die Kopie.
    expect(lesen.voll).toBe(1)
  })

  it('die Übertragung bekommt die Kopie; die Datei vom Gerät wird dabei nie gestreamt', async () => {
    const { datei, lesen } = geraetedatei()

    // Gelingt nur, weil die Attrappe des SDK die Kopie streamt — die Datei
    // vom Gerät wirft beim stream() „network error" wie in JAVASCRIPT-NEXTJS-6.
    await expect(ladeFotoHoch(datei, 'gallery')).resolves.toBe(ZIEL)

    expect(upload).toHaveBeenCalledTimes(1)
    const uebertragen = upload.mock.calls[0][1] as File
    expect(uebertragen).not.toBe(datei)
    expect(new Uint8Array(await uebertragen.arrayBuffer())).toEqual(JPEG)
    expect(lesen.stream).toBe(0)
  })

  it('schon kopiert (Produktdialog): keine zweite Kopie, die Übertragung nimmt genau diese', async () => {
    const { datei } = geraetedatei()
    const kopie = await pruefeLesbarkeit(datei)

    await ladeFotoHoch(kopie, 'product', { bereitsKopiert: true })

    expect(upload.mock.calls[0][1]).toBe(kopie)
  })

  it('scheitert das Kopieren, ist es ein Lesefehler — auch nach dem zweiten Versuch', async () => {
    vi.useFakeTimers()
    const { datei } = geraetedatei()
    let ganz = 0
    ;(datei as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = () => {
      ganz++
      return Promise.reject(new DOMException('weg', 'NotReadableError'))
    }

    const ausgang = ladeFotoHoch(datei, 'gallery').then(
      () => null,
      (e: unknown) => e
    )
    await vi.advanceTimersByTimeAsync(LESE_ZWEITVERSUCH_PAUSE_MS + 100)

    expect(bildFehlerArtVon(await ausgang)).toBe('lesen')
    // Sofort abgelehnt → Netz 1: nach der Pause noch einmal das Ganze.
    expect(ganz).toBe(2)
    expect(upload).not.toHaveBeenCalled()
  })

  it('entsteht die Kopie trotz gelesener Bytes nicht, ist auch das ein Lesefehler', async () => {
    const { datei } = geraetedatei()
    vi.stubGlobal(
      'File',
      class {
        constructor() {
          throw new RangeError('Array buffer allocation failed')
        }
      }
    )

    const fehler = await pruefeLesbarkeit(datei).then(
      () => null,
      (e: unknown) => e
    )

    expect(bildFehlerArtVon(fehler)).toBe('lesen')
  })
})

describe('Verdrahtung am Quelltext', () => {
  const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

  it('„Foto wählen" liest den Merker und das Gerät; das Ergebnis pflegt den Merker', () => {
    const quellen = quelle('src/components/shared/foto-quellen.tsx')
    expect(quellen).toContain('ersterWeg({ android: istAndroid(), gemerkt: leseFotoWeg(browserSpeicher()) })')
    expect(quellen).toContain('merkerNachErgebnis({ ...gewaehlt, ausgang, standard: standardWeg(istAndroid()) })')
    // Ein durchgekommenes Foto beendet auch den Fehlschlag-Merker für „dieselbe Datei".
    expect(quellen).toContain("if (ausgang === 'gelesen') merker.current = null")
    expect(quellen).toContain('schreibeFotoWeg(browserSpeicher(), aenderung.weg)')
    expect(quellen).toContain('loescheFotoWeg(browserSpeicher())')
  })

  it('Upload-Hook und Produktdialog melden jedes Ergebnis — und Weg und Wahl an Sentry', () => {
    const hook = quelle('src/components/shared/image-upload.tsx')
    expect(hook.match(/quellen\.meldeErgebnis\(auswahl,/g)).toHaveLength(2)
    expect(hook).toContain('weg: auswahl.weg, wahl: auswahl.wahl')

    const dialog = quelle('src/components/products/product-dialog.tsx')
    expect(dialog.match(/fotoQuellen\.meldeErgebnis\(auswahl,/g)).toHaveLength(2)
    expect(dialog).toContain('weg: auswahl.weg, wahl: auswahl.wahl')
    expect(dialog).toContain('wahl: gewaehlteAuswahl.current.wahl')
    // Beim Absenden wird nicht mehr gelesen — Sentry bekommt die Lese-Diagnose der Auswahl.
    expect(dialog).toContain('lesen: gewaehlteLesung.current')
    expect(dialog).not.toContain('onLesen: (l) => {\n              lesen = l')
  })
})

describe('Sentry — Weg und Wahl', () => {
  it('meldet, über welchen Weg und warum er genommen wurde', () => {
    const meldung = baueUploadMeldung({
      ursache: 'lesen',
      datei: { size: 8_247_048, type: 'image/jpeg' },
      weg: 'dateien',
      wahl: 'standard',
      versuche: 0,
    })
    expect(meldung.contexts.upload).toMatchObject({ weg: 'dateien', wahl: 'standard' })

    const gemerkt = baueUploadMeldung({
      ursache: 'lesen',
      datei: { size: 1, type: 'image/jpeg' },
      weg: 'galerie',
      wahl: 'gemerkt',
      versuche: 0,
    })
    expect(gemerkt.contexts.upload).toMatchObject({ weg: 'galerie', wahl: 'gemerkt' })
  })
})
