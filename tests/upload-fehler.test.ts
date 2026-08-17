/**
 * Tests für die Zuordnung Fehlerart → Meldungstext (src/lib/upload-fehler.ts).
 *
 * Seit der Umstellung auf den serverseitigen Upload trennen sich die Ursachen
 * danach, WER gescheitert ist:
 *  lesen   Die Datei kommt gar nicht erst beim Server an — Speicherdienst
 *          oder Verbindung.
 *  format  Der Server hat die Bytes und kann sie nicht als Bild lesen. Das
 *          ist jetzt BEWIESEN (sharp hat es versucht), nicht mehr geraten.
 *  server  Alles Übrige auf unserer Seite — kein Rat, ein Eingeständnis.
 *
 * Jede dieser Ursachen bekam über die Sprints hinweg irgendwann denselben Rat
 * „bitte JPEG oder PNG wählen", der nur bei genau einer davon hilft. Diese
 * Tests halten die Trennung fest — und dass die beiden Meldungen, bei denen ein
 * Formatwechsel NICHT hilft, auch keinen empfehlen.
 *
 * Was hier bewusst NICHT geprüft wird: sharp selbst. Der native Pfad läuft in
 * vitest nicht sinnvoll; ein Mock bestätigte nur die eigene Verdrahtung. Für
 * den echten Nachweis gibt es die Prüfanleitung in der PR-Beschreibung.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  BildFehler,
  bildFehlerText,
  bildFehlerKurz,
  bildFehlerArtVon,
  bildFehlerMeldung,
  protokolliereBildFehler,
  IMAGE_READ_ERROR,
  IMAGE_FORMAT_ERROR,
  IMAGE_SERVER_ERROR,
  IMAGE_NETWORK_ERROR,
  IMAGE_UNKNOWN_ERROR,
  UPLOAD_DIAG,
} from '@/lib/upload-fehler'

const ALLE_ARTEN = ['lesen', 'format', 'server'] as const

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Zuordnung Fehlerart → Text', () => {
  it('weist bei nicht lesbarer Datei die Wege am Cloud-Album vorbei', () => {
    // Seit dem Quellen-Sprint ist die Meldung ein Wegweiser: Sie nennt die
    // Ursache (Cloud-Alben) und alle drei Auswege — Dateien, Kamera, Teilen.
    expect(bildFehlerText('lesen')).toBe(IMAGE_READ_ERROR)
    expect(bildFehlerText('lesen')).toContain('Cloud-Alben')
    expect(bildFehlerText('lesen')).toContain('Aus Dateien')
    expect(bildFehlerText('lesen')).toContain('nimm es neu auf')
    expect(bildFehlerText('lesen')).toContain('teile es')
    expect(bildFehlerKurz('lesen')).toBe('Datei nicht lesbar')
  })

  it('meldet bei unbekanntem Format weiterhin das Format', () => {
    expect(bildFehlerText('format')).toBe(IMAGE_FORMAT_ERROR)
    expect(bildFehlerText('format')).toContain('HEIC')
    expect(bildFehlerKurz('format')).toBe('Format nicht unterstützt')
  })

  it('meldet bei einem Serverfehler kein Nutzerproblem, sondern unseres', () => {
    expect(bildFehlerText('server')).toBe(IMAGE_SERVER_ERROR)
    expect(bildFehlerText('server')).toContain('nochmal versuchen')
    expect(bildFehlerKurz('server')).toBe('Verarbeitung fehlgeschlagen')
  })

  it('rät nur dort zu einem anderen Dateiformat, wo das auch hilft', () => {
    // Der wiederkehrende Fehler: Der Bauer hatte bereits ein JPEG gewählt und
    // wurde aufgefordert, ein JPEG zu wählen. Das darf nur noch bei
    // 'format' dastehen — nur dort ist das Format wirklich das Problem.
    expect(bildFehlerText('lesen')).not.toMatch(/JPEG|PNG|HEIC/)
    expect(bildFehlerText('server')).not.toMatch(/JPEG|PNG|HEIC/)
    expect(bildFehlerText('format')).toMatch(/JPEG/)
  })

  it('gibt jeder der drei Ursachen einen eigenen Text und Kurzgrund', () => {
    const texte = ALLE_ARTEN.map(bildFehlerText)
    const kurz = ALLE_ARTEN.map(bildFehlerKurz)

    expect(new Set(texte).size).toBe(3)
    expect(new Set(kurz).size).toBe(3)
  })

  it('fällt bei einer unbekannten Ursache auf einen definierten Standard zurück', () => {
    // Der Typ lässt das nicht zu — zur Laufzeit kann es trotzdem passieren
    // (alter Bundle-Stand nach einem Deployment, Wert über eine Modulgrenze).
    const unbekannt = 'gibt-es-nicht' as unknown as (typeof ALLE_ARTEN)[number]

    expect(bildFehlerText(unbekannt)).toBe(IMAGE_UNKNOWN_ERROR)
    expect(bildFehlerKurz(unbekannt)).toBe('Upload fehlgeschlagen')
  })

  it('nennt im Standard KEINE der drei echten Ursachen', () => {
    // Eine falsche Ursache ist schlimmer als gar keine — das ist die Lehre
    // dieser Reihe. Der Rückfall darf weder aufs Format noch auf den
    // Speicherort zeigen.
    expect(IMAGE_UNKNOWN_ERROR).not.toMatch(/JPEG|PNG|HEIC|Cloud-Alben|Aus Dateien/)
    for (const art of ALLE_ARTEN) {
      expect(IMAGE_UNKNOWN_ERROR).not.toBe(bildFehlerText(art))
    }
  })
})

describe('Netzfehler — bewusst keine vierte Ursache', () => {
  it('nennt den Abbruch beim Namen und trägt die S-Kennung mit dem Code-Stand', () => {
    expect(IMAGE_NETWORK_ERROR).toContain('Verbindung unterbrochen')
    expect(IMAGE_NETWORK_ERROR).toMatch(new RegExp(`\\[S${UPLOAD_DIAG}\\]$`))
  })

  it('ist keiner der drei Ursachen-Texte', () => {
    // Insbesondere nicht der Servertext, mit dem er sich die Kennung teilt —
    // ein Bildschirmfoto muss die beiden Fälle am Wortlaut unterscheiden.
    for (const art of ALLE_ARTEN) {
      expect(IMAGE_NETWORK_ERROR).not.toBe(bildFehlerText(art))
    }
  })

  it('rät weder zum Format noch zum Speicherort', () => {
    // Ein Abbruch sagt nichts über das Foto — jeder Rat dazu wäre erfunden.
    expect(IMAGE_NETWORK_ERROR).not.toMatch(/JPEG|PNG|HEIC|Cloud-Alben|Aus Dateien/)
  })

  it('läuft als gewöhnlicher Error unverändert durch die Meldungs-Zuordnung', () => {
    // Genau so wird er geworfen: als Error, nicht als BildFehler. Er darf
    // keiner Foto-Ursache zugeordnet werden.
    expect(bildFehlerMeldung(new Error(IMAGE_NETWORK_ERROR))).toEqual({
      text: IMAGE_NETWORK_ERROR,
      kurz: IMAGE_NETWORK_ERROR,
      art: null,
    })
  })
})

describe('Diagnose-Kennung', () => {
  it('hängt an jede der drei Meldungen ein eigenes Kürzel mit dem Code-Stand', () => {
    expect(bildFehlerText('lesen')).toMatch(new RegExp(`\\[L${UPLOAD_DIAG}\\]$`))
    expect(bildFehlerText('format')).toMatch(new RegExp(`\\[F${UPLOAD_DIAG}\\]$`))
    expect(bildFehlerText('server')).toMatch(new RegExp(`\\[S${UPLOAD_DIAG}\\]$`))
  })

  it('unterscheidet die drei Kürzel voneinander', () => {
    const kennungen = ALLE_ARTEN.map((art) => bildFehlerText(art).match(/\[[A-Z]\d+\]$/)?.[0])

    expect(kennungen).toEqual([`[L${UPLOAD_DIAG}]`, `[F${UPLOAD_DIAG}]`, `[S${UPLOAD_DIAG}]`])
  })

  it('führt den Code-Stand an genau einer Stelle', () => {
    // Steht die Zahl mehrfach im Quelltext, zeigt ein Bildschirmfoto irgendwann
    // einen Stand, den es nie gab. Der Test hält fest, dass alle drei Meldungen
    // dieselbe Zahl tragen — sie kommen aus derselben Konstante.
    const zahlen = ALLE_ARTEN.map((art) => bildFehlerText(art).match(/\[[A-Z](\d+)\]$/)?.[1])

    expect(new Set(zahlen)).toEqual(new Set([UPLOAD_DIAG]))
  })

  it('lässt die Kennung nicht in die Kurzgründe der Sammelmeldung rutschen', () => {
    // Bewusst nur an den drei Volltexten: Eine Serie listet mehrere Gründe in
    // einer Zeile, dreimal dieselbe Kennung darin wäre nur Lärm.
    for (const art of ALLE_ARTEN) {
      expect(bildFehlerKurz(art)).not.toMatch(/\[[A-Z]\d+\]/)
    }
  })
})

describe('BildFehler', () => {
  it('trägt seine Ursache und schon die passende Meldung', () => {
    const fehler = new BildFehler('server')

    expect(fehler).toBeInstanceOf(Error)
    expect(fehler.bildFehlerArt).toBe('server')
    // Wichtig für Aufrufer, die nur error.message kennen
    expect(fehler.message).toBe(IMAGE_SERVER_ERROR)
  })

  it('wird auch ohne instanceof erkannt — für alle drei Ursachen', () => {
    // Falls die Klasse je in zwei Bundles landet, greift instanceof nicht mehr
    for (const art of ALLE_ARTEN) {
      expect(bildFehlerArtVon({ bildFehlerArt: art })).toBe(art)
      expect(bildFehlerArtVon(new BildFehler(art))).toBe(art)
    }
  })

  it('erkennt fremde Fehler nicht als Bildfehler', () => {
    expect(bildFehlerArtVon(new Error('Netzwerk weg'))).toBeNull()
    expect(bildFehlerArtVon({ bildFehlerArt: 'irgendwas' })).toBeNull()
    expect(bildFehlerArtVon(null)).toBeNull()
    expect(bildFehlerArtVon('server')).toBeNull()
  })
})

describe('bildFehlerMeldung — was ein gefangener Fehler zeigt', () => {
  it('nimmt bei einem BildFehler die Ursache und beide Textformen', () => {
    expect(bildFehlerMeldung(new BildFehler('lesen'))).toEqual({
      text: IMAGE_READ_ERROR,
      kurz: 'Datei nicht lesbar',
      art: 'lesen',
    })
    expect(bildFehlerMeldung(new BildFehler('server'))).toEqual({
      text: IMAGE_SERVER_ERROR,
      kurz: 'Verarbeitung fehlgeschlagen',
      art: 'server',
    })
    expect(bildFehlerMeldung(new BildFehler('format'))).toEqual({
      text: IMAGE_FORMAT_ERROR,
      kurz: 'Format nicht unterstützt',
      art: 'format',
    })
  })

  it('lässt einem fremden Fehler seine eigene Meldung', () => {
    // Server- und Netzfehler dürfen nicht plötzlich nach Bildformat klingen
    expect(bildFehlerMeldung(new Error('Upload nicht konfiguriert'))).toEqual({
      text: 'Upload nicht konfiguriert',
      kurz: 'Upload nicht konfiguriert',
      art: null,
    })
  })

  it('fängt auch etwas ab, das gar kein Error ist', () => {
    expect(bildFehlerMeldung('kaputt')).toEqual({
      text: 'Upload fehlgeschlagen',
      kurz: 'Upload fehlgeschlagen',
      art: null,
    })
  })
})

describe('Protokollierung', () => {
  it('schweigt in der Produktion', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    protokolliereBildFehler('server', { type: 'image/jpeg', size: 2_000_000 })

    expect(log).not.toHaveBeenCalled()
  })

  it('notiert außerhalb der Produktion die Ursache — ohne Dateinamen', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    protokolliereBildFehler('server', { type: 'image/jpeg', size: 2_048_000 })

    expect(log).toHaveBeenCalledTimes(1)
    const zeile = log.mock.calls[0][0] as string
    expect(zeile).toContain('server')
    expect(zeile).toContain('image/jpeg')
    expect(zeile).toContain('2000 kB')
  })

  it('nimmt eine File-artige Angabe ohne Typ klaglos an', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    protokolliereBildFehler('format', { type: '', size: 0 })

    expect(log.mock.calls[0][0]).toContain('Typ unbekannt')
  })
})
