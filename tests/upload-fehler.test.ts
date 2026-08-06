/**
 * Tests für die Zuordnung Fehlerart → Meldungstext (src/lib/upload-fehler.ts).
 *
 * Der Kern des Sprints in einem Satz: Ein einwandfreies JPEG, das der Browser
 * lesen, aber nicht wieder herausgeben darf, bekam bisher die Auskunft „bitte
 * JPEG oder PNG wählen". Diese Tests halten fest, dass die beiden Ursachen
 * getrennt bleiben und die blockierte Verarbeitung NICHT mehr zu einem
 * Format-Rat führt.
 *
 * Was hier bewusst NICHT geprüft wird: Canvas und createImageBitmap. Beide
 * lassen sich in jsdom nicht sinnvoll nachstellen — ein Mock, der toBlob null
 * liefern lässt, würde nur die eigene Mock-Verdrahtung bestätigen. Für den
 * echten Nachweis gibt es die Prüfanleitung in der PR-Beschreibung.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  BildFehler,
  bildFehlerText,
  bildFehlerKurz,
  bildFehlerArtVon,
  bildFehlerMeldung,
  protokolliereBildFehler,
  IMAGE_FORMAT_ERROR,
  IMAGE_ENCODE_BLOCKED_ERROR,
} from '@/lib/upload-fehler'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Zuordnung Fehlerart → Text', () => {
  it('meldet bei nicht lesbarer Datei weiterhin das Format', () => {
    expect(bildFehlerText('dekodierung')).toBe(IMAGE_FORMAT_ERROR)
    expect(bildFehlerText('dekodierung')).toContain('HEIC')
    expect(bildFehlerKurz('dekodierung')).toBe('Format nicht unterstützt')
  })

  it('meldet bei blockierter Verarbeitung die Datenschutz-Einstellung', () => {
    expect(bildFehlerText('kodierung')).toBe(IMAGE_ENCODE_BLOCKED_ERROR)
    expect(bildFehlerText('kodierung')).toContain('Datenschutz-Einstellung')
    expect(bildFehlerText('kodierung')).toContain('Fingerprint-Schutz')
    expect(bildFehlerKurz('kodierung')).toBe('Bildverarbeitung blockiert')
  })

  it('rät bei blockierter Verarbeitung NICHT zu einem anderen Dateiformat', () => {
    // Der eigentliche Fehler des alten Standes: Der Bauer hatte bereits ein
    // JPEG gewählt und wurde aufgefordert, ein JPEG zu wählen.
    const text = bildFehlerText('kodierung')

    expect(text).not.toMatch(/JPEG|PNG|HEIC/)
  })

  it('gibt den beiden Ursachen unterschiedliche Texte', () => {
    expect(bildFehlerText('dekodierung')).not.toBe(bildFehlerText('kodierung'))
    expect(bildFehlerKurz('dekodierung')).not.toBe(bildFehlerKurz('kodierung'))
  })
})

describe('BildFehler', () => {
  it('trägt seine Ursache und schon die passende Meldung', () => {
    const fehler = new BildFehler('kodierung')

    expect(fehler).toBeInstanceOf(Error)
    expect(fehler.bildFehlerArt).toBe('kodierung')
    // Wichtig für Aufrufer, die nur error.message kennen
    expect(fehler.message).toBe(IMAGE_ENCODE_BLOCKED_ERROR)
  })

  it('wird auch ohne instanceof erkannt', () => {
    // Falls die Klasse je in zwei Bundles landet, greift instanceof nicht mehr
    expect(bildFehlerArtVon({ bildFehlerArt: 'dekodierung' })).toBe('dekodierung')
    expect(bildFehlerArtVon(new BildFehler('kodierung'))).toBe('kodierung')
  })

  it('erkennt fremde Fehler nicht als Bildfehler', () => {
    expect(bildFehlerArtVon(new Error('Netzwerk weg'))).toBeNull()
    expect(bildFehlerArtVon({ bildFehlerArt: 'irgendwas' })).toBeNull()
    expect(bildFehlerArtVon(null)).toBeNull()
    expect(bildFehlerArtVon('kodierung')).toBeNull()
  })
})

describe('bildFehlerMeldung — was ein gefangener Fehler zeigt', () => {
  it('nimmt bei einem BildFehler die Ursache und beide Textformen', () => {
    expect(bildFehlerMeldung(new BildFehler('kodierung'))).toEqual({
      text: IMAGE_ENCODE_BLOCKED_ERROR,
      kurz: 'Bildverarbeitung blockiert',
      art: 'kodierung',
    })
    expect(bildFehlerMeldung(new BildFehler('dekodierung'))).toEqual({
      text: IMAGE_FORMAT_ERROR,
      kurz: 'Format nicht unterstützt',
      art: 'dekodierung',
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

    protokolliereBildFehler('kodierung', { type: 'image/jpeg', size: 2_000_000 })

    expect(log).not.toHaveBeenCalled()
  })

  it('notiert außerhalb der Produktion die Ursache — ohne Dateinamen', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    protokolliereBildFehler('kodierung', { type: 'image/jpeg', size: 2_048_000 })

    expect(log).toHaveBeenCalledTimes(1)
    const zeile = log.mock.calls[0][0] as string
    expect(zeile).toContain('kodierung')
    expect(zeile).toContain('image/jpeg')
    expect(zeile).toContain('2000 kB')
  })

  it('nimmt eine File-artige Angabe ohne Typ klaglos an', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    protokolliereBildFehler('dekodierung', { type: '', size: 0 })

    expect(log.mock.calls[0][0]).toContain('Typ unbekannt')
  })
})
