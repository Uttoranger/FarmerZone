/**
 * Tests für die Zeitwächter des Foto-Uploads (src/lib/upload-zeitwaechter.ts)
 * und ihre Verdrahtung in der Lese-Stufe (pruefeLesbarkeit).
 *
 * Der Anlass: Auf realen Geräten blieb der Upload endlos im Ladezustand —
 * defekte Android-Speicherdienste liefern beim Lesen weder Bytes noch Fehler,
 * und ein await ohne Zeitlimit wartet darauf für immer. Diese Tests stellen
 * das Verhalten mit fake timers nach: Die „stumme Quelle" ist ein Promise,
 * das nie fertig wird — genau das, was so ein Speicherdienst liefert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  darfZweitversuch,
  mitZeitlimit,
  stillstandsWaechter,
  LESE_PROBE_LIMIT_MS,
  LESE_VOLL_LIMIT_MS,
  TRANSFER_VERSUCHE,
} from '@/lib/upload-zeitwaechter'
import { pruefeLesbarkeit, stufenText } from '@/components/shared/image-upload'
import {
  BildFehler,
  bildFehlerArtVon,
  IMAGE_READ_ERROR,
  UPLOAD_DIAG,
} from '@/lib/upload-fehler'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Ein Promise, das nie fertig wird — die stumme Quelle. */
function nie<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

describe('mitZeitlimit', () => {
  it('liefert das Ergebnis, wenn das Versprechen vor Ablauf fertig ist', async () => {
    await expect(mitZeitlimit(Promise.resolve('da'), 1000, () => new Error('zu spät'))).resolves.toBe(
      'da'
    )
    // Der Wächter-Timer ist aufgeräumt — nichts läuft nach.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reicht einen echten Fehler vor Ablauf unverändert durch', async () => {
    // Eine Quelle, die LAUT scheitert, braucht keinen Wächter — ihr Fehler
    // darf nicht durch den Ablauf-Fehler ersetzt werden.
    await expect(
      mitZeitlimit(Promise.reject(new Error('kaputt')), 1000, () => new Error('zu spät'))
    ).rejects.toThrow('kaputt')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('wirft nach Ablauf den Fehler aus beiAblauf — und keinen Tick früher', async () => {
    let abgelaufen = false
    const ergebnis = mitZeitlimit(nie(), 1000, () => new Error('Zeit um')).catch((e: Error) => {
      abgelaufen = true
      throw e
    })
    const erwartung = expect(ergebnis).rejects.toThrow('Zeit um')

    // Eine Millisekunde vor Ablauf ist noch nichts passiert — ein Wächter,
    // der zu früh feuert, wäre genauso falsch wie einer, der nie feuert.
    await vi.advanceTimersByTimeAsync(999)
    expect(abgelaufen).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await erwartung
    expect(abgelaufen).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('stillstandsWaechter (Stall-Erkennung)', () => {
  it('löst nach Stille aus — auch ganz ohne erstes Lebenszeichen', () => {
    // Ein Transfer, der nie ein Ereignis liefert, ist genauso tot wie einer,
    // der mittendrin verstummt.
    const alarm = vi.fn()
    stillstandsWaechter(30_000, alarm)

    vi.advanceTimersByTime(29_999)
    expect(alarm).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(alarm).toHaveBeenCalledTimes(1)
  })

  it('zieht die Uhr bei jedem Lebenszeichen neu auf', () => {
    const alarm = vi.fn()
    const wache = stillstandsWaechter(30_000, alarm)

    // 5 × 29 s vergehen — insgesamt weit über dem Limit, aber nie 30 s STILLE
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(29_000)
      wache.lebenszeichen()
    }
    expect(alarm).not.toHaveBeenCalled()

    // Jetzt verstummt der Transfer wirklich
    vi.advanceTimersByTime(30_000)
    expect(alarm).toHaveBeenCalledTimes(1)
  })

  it('schweigt nach stopp — auch wenn danach noch ein Lebenszeichen eintrudelt', () => {
    // Abschluss und Fortschritts-Ereignis können sich überholen. Ein spätes
    // Lebenszeichen darf die Wache nicht wieder aufziehen — sonst feuert der
    // Abbruch in einen längst fertigen Upload hinein.
    const alarm = vi.fn()
    const wache = stillstandsWaechter(30_000, alarm)

    wache.stopp()
    wache.lebenszeichen()
    vi.advanceTimersByTime(120_000)
    expect(alarm).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('darfZweitversuch — die Retry-Entscheidung', () => {
  it('erlaubt bei einem Transferfehler den Zweitversuch, solange einer übrig ist', () => {
    // Transfer-Unfälle sind gewöhnliche Errors ohne Bild-Ursache: der
    // Netzwurf aus upload(), der Abbruch durch Stillstand oder Deckel.
    expect(darfZweitversuch(new Error('Verbindung unterbrochen'), 1)).toBe(true)
    expect(darfZweitversuch(new Error('abgebrochen'), TRANSFER_VERSUCHE - 1)).toBe(true)
  })

  it('verweigert den dritten Anlauf — der Zweitversuch ist verbraucht', () => {
    // Mit dem LITERAL 2 festgenagelt: Formulierte der Test die Obergrenze nur
    // über die Konstante selbst, bestünde ein stilles Hochzählen von
    // TRANSFER_VERSUCHE jede dieser Prüfungen — und erlaubte unbemerkt einen
    // dritten Komplett-Upload eines 8-MB-Originals.
    expect(darfZweitversuch(new Error('Verbindung unterbrochen'), 2)).toBe(false)
    expect(darfZweitversuch(new Error('Verbindung unterbrochen'), TRANSFER_VERSUCHE)).toBe(false)
    expect(darfZweitversuch(new Error('Verbindung unterbrochen'), TRANSFER_VERSUCHE + 5)).toBe(false)
  })

  it('wiederholt kein Urteil des Blob-SDK — ein abgelehnter Token ist keine Verbindungsstörung', () => {
    // Meldungstexte 1:1 aus @vercel/blob 2.4.0 (BlobError präfixiert im
    // Konstruktor mit „Vercel Blob: "). Abgelaufene Sitzung → Token-Route
    // verweigert → dieselbe Ablehnung fiele auch beim zweiten Anlauf.
    expect(darfZweitversuch(new Error('Vercel Blob: Failed to retrieve the client token'), 1)).toBe(
      false
    )
    expect(darfZweitversuch(new Error('Vercel Blob: Access denied, please provide a valid token for this resource.'), 1)).toBe(
      false
    )
  })

  it('lässt die zwei SDK-Meldungen durch, die keine Urteile sind', () => {
    // Der Abbruch kommt von unseren eigenen Wächtern; „not available" meldet
    // das SDK auch für gescheiterte fetches nach internen Wiederholungen —
    // beides sind Transfer-Unfälle, genau dafür gibt es den Zweitversuch.
    expect(darfZweitversuch(new Error('Vercel Blob: The request was aborted.'), 1)).toBe(true)
    expect(
      darfZweitversuch(
        new Error('Vercel Blob: The blob service is currently not available. Please try again.'),
        1
      )
    ).toBe(true)
  })

  it("wiederholt NIEMALS ein Urteil — 'format', 'server' und 'lesen' bleiben endgültig", () => {
    // Ein BildFehler fiele beim Wiederholen genauso — der Zweitversuch würde
    // nur Zeit und Datenvolumen verbrennen.
    for (const art of ['format', 'server', 'lesen'] as const) {
      expect(darfZweitversuch(new BildFehler(art), 1)).toBe(false)
    }
  })

  it('erkennt das Urteil auch ohne instanceof — über die Modulgrenze hinweg', () => {
    // Dasselbe Loch, das bildFehlerArtVon stopft: Klasse in zwei Bundles.
    expect(darfZweitversuch({ bildFehlerArt: 'server' }, 1)).toBe(false)
  })
})

describe('stufenText — die eine Quelle aller Stufen-Anzeigen', () => {
  it('benennt jede Stufe mit ihrem eigenen Text', () => {
    expect(stufenText({ stufe: 'lesen', prozent: 0 })).toBe('Lese Datei …')
    expect(stufenText({ stufe: 'hochladen', prozent: 47 })).toBe('Lade hoch … 47 %')
    expect(stufenText({ stufe: 'wiederholen', prozent: 0 })).toBe(
      'Verbindung unterbrochen — versuche es noch einmal …'
    )
    expect(stufenText({ stufe: 'verarbeiten', prozent: 0 })).toBe('Verarbeite …')
  })

  it('rundet den Prozentwert für die Anzeige', () => {
    // onUploadProgress liefert Bruchwerte — „46.7 %" im Label wäre nur Lärm
    expect(stufenText({ stufe: 'hochladen', prozent: 46.7 })).toBe('Lade hoch … 47 %')
    expect(stufenText({ stufe: 'hochladen', prozent: 0 })).toBe('Lade hoch … 0 %')
    expect(stufenText({ stufe: 'hochladen', prozent: 100 })).toBe('Lade hoch … 100 %')
  })

  it('zeigt die Zahl nur beim Hochladen — die anderen Stufen sind nicht messbar', () => {
    expect(stufenText({ stufe: 'lesen', prozent: 99 })).not.toContain('99')
    expect(stufenText({ stufe: 'wiederholen', prozent: 99 })).not.toContain('99')
    expect(stufenText({ stufe: 'verarbeiten', prozent: 99 })).not.toContain('99')
  })
})

describe('Lese-Stufe unter Zeitwächtern (pruefeLesbarkeit)', () => {
  /** Datei-Attrappe: beide Lesewege bleiben stumm stehen. */
  function stummeDatei(): File {
    return {
      slice: () => ({ arrayBuffer: () => nie<ArrayBuffer>() }),
      arrayBuffer: () => nie<ArrayBuffer>(),
      type: 'image/jpeg',
      size: 8_000_000,
      name: 'stumm.jpg',
    } as unknown as File
  }

  it("meldet die stumme Quelle nach Probe- und Komplett-Ablauf als 'lesen' — mit Kennung", async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const lauf = pruefeLesbarkeit(stummeDatei())
    const gefangen = lauf.catch((e: unknown) => e)

    // Erst läuft die 64-KB-Probe ab, dann der Komplettversuch
    await vi.advanceTimersByTimeAsync(LESE_PROBE_LIMIT_MS)
    await vi.advanceTimersByTimeAsync(LESE_VOLL_LIMIT_MS)

    const fehler = await gefangen
    expect(fehler).toBeInstanceOf(BildFehler)
    expect(bildFehlerArtVon(fehler)).toBe('lesen')
    // Der Wegweiser-Text — für die stumme Quelle genauso richtig wie für
    // die laute: Beide brauchen einen Weg am Cloud-Album vorbei.
    expect((fehler as Error).message).toBe(IMAGE_READ_ERROR)
    expect((fehler as Error).message).toContain(`[L${UPLOAD_DIAG}]`)
    expect((fehler as Error).message).toContain('Aus Dateien')
  })

  it('lässt eine Datei durch, deren Teil-Lesen hängt, deren Komplett-Lesen aber liefert', async () => {
    // Der Zusatzversuch aus #65 bleibt unter dem Wächter erhalten: Ein
    // Speicherdienst, der nur ganze Dateien herausgibt, ist kein Fehlerfall.
    const zaehe = {
      slice: () => ({ arrayBuffer: () => nie<ArrayBuffer>() }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      type: 'image/jpeg',
      size: 1_000,
      name: 'zaeh.jpg',
    } as unknown as File

    const lauf = pruefeLesbarkeit(zaehe)
    await vi.advanceTimersByTimeAsync(LESE_PROBE_LIMIT_MS)
    await expect(lauf).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })
})
