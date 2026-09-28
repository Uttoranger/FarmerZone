/**
 * Tests für die Entscheidungen hinter dem Foto-Weg (src/lib/foto-wege.ts) —
 * JAVASCRIPT-NEXTJS-5: dasselbe Foto 16-mal nicht lesbar, und die Meldung
 * schickte den Bauern in eine Schleife.
 *
 * Beweist:
 *  - Netz 1: Ein zweiter Leseversuch nur nach der sofortigen Ablehnung.
 *  - Ein Bild wird an den ersten Bytes erkannt (JPEG, PNG, WebP, HEIC), nie am
 *    MIME-Typ; HEIC führt nie zum Upload, Unbekanntes ist nur auf dem
 *    Rettungsweg „kein Foto".
 *  - Karte oder Meldung: Foto und Weg bekommen die Karte, Übertragung und
 *    Server die Meldung.
 *  - Dieselbe Datei (Größe und Typ) wird erkannt.
 *  - Teilen nur bei Titelbild und Hofgalerie, nur auf Android, in der App
 *    als Anleitung, sonst als Installationshinweis.
 *  - Die Android-Version kommt aus den Client Hints; „Android 10; K" im
 *    User-Agent gilt als unbekannt.
 *  - Am Quelltext: zwei Knöpfe, die Rettung verborgen, keine dritte Wahl.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  FORMAT_PROBE_BYTES,
  androidAuskunft,
  bildFormat,
  formatUrteil,
  gleicheDatei,
  naechsterSchritt,
  serienAbschluss,
  sofortKarte,
  teilenHinweis,
  zuMerken,
  zweiterLeseversuch,
} from '@/lib/foto-wege'

/** Bytes aus Zahlen und Zeichenketten — 'ftyp' wird zu vier ASCII-Bytes. */
function bytes(...teile: (number | string)[]): Uint8Array {
  const werte: number[] = []
  for (const t of teile) {
    if (typeof t === 'number') werte.push(t)
    else for (const zeichen of t) werte.push(zeichen.charCodeAt(0))
  }
  return Uint8Array.from(werte)
}

describe('zweiterLeseversuch — Netz 1', () => {
  it('nur nach der sofortigen Ablehnung, wo eine Freigabe zurückkommen kann', () => {
    expect(zweiterLeseversuch('erlaubnis')).toBe(true)
    expect(zweiterLeseversuch('cloud')).toBe(false)
    expect(zweiterLeseversuch('unbestimmt')).toBe(false)
  })
})

describe('bildFormat — an den ersten Bytes', () => {
  it('erkennt JPEG, PNG und WebP', () => {
    expect(bildFormat(bytes(0xff, 0xd8, 0xff, 0xe1, 0x12))).toBe('jpeg')
    expect(bildFormat(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe('png')
    expect(bildFormat(bytes('RIFF', 0x24, 0x10, 0, 0, 'WEBP', 'VP8 '))).toBe('webp')
  })

  it('erkennt die HEIC/HEIF-Familie an der ftyp-Marke — AVIF bewusst nicht', () => {
    for (const marke of ['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heif']) {
      expect(bildFormat(bytes(0, 0, 0, 0x18, 'ftyp', marke)), marke).toBe('heic')
    }
    expect(bildFormat(bytes(0, 0, 0, 0x18, 'ftyp', 'avif'))).toBeNull()
    expect(bildFormat(bytes(0, 0, 0, 0x18, 'ftyp', 'isom'))).toBeNull()
  })

  it('liest die Zusatzmarken: ein AVIF mit allgemeiner HEIF-Hauptmarke ist kein HEIC', () => {
    // Kasten 24 Bytes: Länge, ftyp, Hauptmarke mif1, Version, Zusatzmarken mif1 + avif.
    expect(bildFormat(bytes(0, 0, 0, 0x18, 'ftyp', 'mif1', 0, 0, 0, 0, 'mif1', 'avif'))).toBeNull()
    expect(bildFormat(bytes(0, 0, 0, 0x18, 'ftyp', 'msf1', 0, 0, 0, 0, 'msf1', 'avis'))).toBeNull()
    // Umgekehrt: mif1 mit heic als Zusatzmarke bleibt HEIC.
    expect(bildFormat(bytes(0, 0, 0, 0x18, 'ftyp', 'mif1', 0, 0, 0, 0, 'mif1', 'heic'))).toBe('heic')
    // Zusatzmarken hinter dem Kastenende zählen nicht.
    expect(bildFormat(bytes(0, 0, 0, 0x14, 'ftyp', 'mif1', 0, 0, 0, 0, 'mif1', 'avif'))).toBe('heic')
  })

  it('kennt Text, Leeres und Kurzes nicht', () => {
    expect(bildFormat(bytes('hello world!'))).toBeNull()
    expect(bildFormat(bytes())).toBeNull()
    expect(bildFormat(bytes(0xff, 0xd8))).toBeNull()
    expect(bildFormat(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeNull()
  })

  it('braucht dafür nie mehr als 64 Bytes — weit unter der Probe', () => {
    expect(FORMAT_PROBE_BYTES).toBe(64)
    expect(bildFormat(bytes('RIFF', 0, 0, 0, 0, 'WEBP').slice(0, FORMAT_PROBE_BYTES))).toBe('webp')
  })
})

describe('formatUrteil — was das Format je Weg bedeutet', () => {
  it('HEIC wird auf keinem Weg hochgeladen', () => {
    for (const weg of ['standard', 'kamera', 'rettung', 'teilen'] as const) {
      expect(formatUrteil('heic', weg), weg).toBe('heic')
    }
  })

  it('Unbekanntes ist nur auf dem Rettungsweg „kein Foto" — sonst entscheidet der Server', () => {
    expect(formatUrteil(null, 'rettung')).toBe('kein-foto')
    expect(formatUrteil(null, 'standard')).toBe('ok')
    expect(formatUrteil(null, 'kamera')).toBe('ok')
    expect(formatUrteil(null, 'teilen')).toBe('ok')
  })

  it('die drei Bildformate gehen überall durch', () => {
    expect(formatUrteil('jpeg', 'rettung')).toBe('ok')
    expect(formatUrteil('png', 'standard')).toBe('ok')
    expect(formatUrteil('webp', 'kamera')).toBe('ok')
  })
})

describe('naechsterSchritt — Karte oder Meldung', () => {
  it('Foto und Weg bekommen die Karte', () => {
    expect(naechsterSchritt('lesen')).toEqual({ art: 'karte', grund: 'lesen' })
    expect(naechsterSchritt('heic')).toEqual({ art: 'karte', grund: 'heic' })
    expect(naechsterSchritt('kein-foto')).toEqual({ art: 'karte', grund: 'kein-foto' })
  })

  it('Übertragung, Server, Format vom Server und Fremdes bleiben Meldungen', () => {
    expect(naechsterSchritt('server')).toEqual({ art: 'meldung' })
    expect(naechsterSchritt('format')).toEqual({ art: 'meldung' })
    expect(naechsterSchritt(null)).toEqual({ art: 'meldung' })
  })
})

describe('gleicheDatei — Größe und Typ', () => {
  it('erkennt dieselbe Datei auch mit anderem Namen', () => {
    expect(gleicheDatei({ size: 8_247_048, type: 'image/jpeg' }, { size: 8_247_048, type: 'image/jpeg' })).toBe(true)
  })

  it('unterscheidet Größe und Typ', () => {
    expect(gleicheDatei({ size: 8_247_048, type: 'image/jpeg' }, { size: 8_247_049, type: 'image/jpeg' })).toBe(false)
    expect(gleicheDatei({ size: 8_247_048, type: 'image/jpeg' }, { size: 8_247_048, type: 'image/png' })).toBe(false)
  })
})

describe('sofortKarte und zuMerken — dieselbe Datei nach einem Fehler', () => {
  const A = { size: 8_247_048, type: 'image/jpeg' }
  const B = { size: 1_000, type: 'image/png' }

  it('gemerkt werden nur unlesbare Dateien', () => {
    expect(zuMerken('lesen', [A, B])).toEqual([A, B])
    expect(zuMerken('heic', [A])).toEqual([])
    expect(zuMerken('kein-foto', [A])).toEqual([])
  })

  it('sofort die Karte nur über „Foto wählen", genau eine Datei, und nur eine gemerkte', () => {
    expect(sofortKarte('standard', [A], [A])).toBe(true)
    expect(sofortKarte('standard', [A], [B, A])).toBe(true)
    expect(sofortKarte('standard', [B], [A])).toBe(false)
    expect(sofortKarte('standard', [A, B], [A])).toBe(false)
    expect(sofortKarte('standard', [A], [])).toBe(false)
  })

  it('Rettung und Kamera versuchen es immer — das ist der Ausweg', () => {
    expect(sofortKarte('rettung', [A], [A])).toBe(false)
    expect(sofortKarte('kamera', [A], [A])).toBe(false)
  })
})

describe('serienAbschluss — mehrere Fotos', () => {
  const lesen = { grund: 'lesen' as const, urteil: 'erlaubnis' as const }
  const heic = { grund: 'heic' as const, urteil: 'unbestimmt' as const }

  it('ohne Karten-Fälle nur die Sammelmeldung', () => {
    expect(serienAbschluss({ hochgeladen: 2, uebersprungen: 0, faelle: [] })).toEqual({ sammelmeldung: true, karte: null })
  })

  it('alle gescheitert, alle unlesbar: nur die Karte, mit Anzahl', () => {
    expect(serienAbschluss({ hochgeladen: 0, uebersprungen: 2, faelle: [lesen, lesen] })).toEqual({
      sammelmeldung: false,
      karte: { grund: 'lesen', urteil: 'erlaubnis', anzahl: 2 },
    })
  })

  it('gemischte Gründe: die Karte für die unlesbaren, die Sammelmeldung für den Rest', () => {
    expect(serienAbschluss({ hochgeladen: 0, uebersprungen: 3, faelle: [heic, lesen, lesen] })).toEqual({
      sammelmeldung: true,
      karte: { grund: 'lesen', urteil: 'erlaubnis', anzahl: 2 },
    })
  })

  it('etwas hochgeladen oder aus anderem Grund übersprungen: Sammelmeldung bleibt', () => {
    expect(serienAbschluss({ hochgeladen: 1, uebersprungen: 1, faelle: [lesen] }).sammelmeldung).toBe(true)
    expect(serienAbschluss({ hochgeladen: 0, uebersprungen: 2, faelle: [lesen] }).sammelmeldung).toBe(true)
  })

  it('nur HEIC: die HEIC-Karte mit Anzahl', () => {
    expect(serienAbschluss({ hochgeladen: 0, uebersprungen: 3, faelle: [heic, heic, heic] })).toEqual({
      sammelmeldung: false,
      karte: { grund: 'heic', urteil: 'unbestimmt', anzahl: 3 },
    })
  })
})

describe('teilenHinweis — Netz 3', () => {
  it('in der installierten App auf Android die Anleitung, sonst der Installationshinweis', () => {
    expect(teilenHinweis({ zweck: 'banner', android: true, installiert: true })).toBe('teilen')
    expect(teilenHinweis({ zweck: 'gallery', android: true, installiert: false })).toBe('installieren')
  })

  it('nur, wo /teilen das Foto hinbringen kann', () => {
    for (const zweck of ['product', 'logo', 'status', 'meldung'] as const) {
      expect(teilenHinweis({ zweck, android: true, installiert: true }), zweck).toBeNull()
    }
  })

  it('nie auf dem iPhone — es kennt kein Teilen-Ziel', () => {
    expect(teilenHinweis({ zweck: 'banner', android: false, installiert: true })).toBeNull()
    expect(teilenHinweis({ zweck: 'gallery', android: false, installiert: false })).toBeNull()
  })
})

describe('androidAuskunft — welches Android wirklich', () => {
  const EINHEITS_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36'

  it('nimmt die Version aus den Client Hints', () => {
    expect(androidAuskunft({ userAgent: EINHEITS_UA, platform: 'Android', platformVersion: '13.0.0' })).toEqual({
      android: true,
      version: 13,
    })
  })

  it('„Android 10; K" ohne Client Hints ist die Einheitsangabe — unbekannt, nicht 10', () => {
    expect(androidAuskunft({ userAgent: EINHEITS_UA })).toEqual({ android: true, version: null })
    expect(androidAuskunft({ userAgent: EINHEITS_UA, platform: 'Android', platformVersion: '' })).toEqual({
      android: true,
      version: null,
    })
  })

  it('ein alter Chrome nennt die Version noch echt, mit Gerätenamen', () => {
    const alt = 'Mozilla/5.0 (Linux; Android 9; SM-G960F) AppleWebKit/537.36 Chrome/108.0.0.0 Mobile Safari/537.36'
    expect(androidAuskunft({ userAgent: alt })).toEqual({ android: true, version: 9 })
    const zehn = 'Mozilla/5.0 (Linux; Android 10; SM-G970F) AppleWebKit/537.36 Chrome/108.0.0.0 Mobile Safari/537.36'
    expect(androidAuskunft({ userAgent: zehn })).toEqual({ android: true, version: 10 })
  })

  it('iPhone und Desktop sind kein Android', () => {
    expect(
      androidAuskunft({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15' })
    ).toEqual({ android: false, version: null })
    expect(androidAuskunft({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Windows', platformVersion: '15.0.0' })).toEqual({
      android: false,
      version: null,
    })
  })
})

describe('am Quelltext: zwei Knöpfe, die Rettung verborgen', () => {
  const quelle = readFileSync(join(process.cwd(), 'src/components/shared/foto-quellen.tsx'), 'utf8')

  it('„Foto wählen" nimmt image/* ohne capture, „Foto aufnehmen" die Kamera', () => {
    expect(quelle).toContain('Foto wählen')
    expect(quelle).toContain('Foto aufnehmen')
    expect(quelle).toMatch(/accept="image\/\*"\s+multiple=\{multiple\}/)
    expect(quelle).toMatch(/accept="image\/\*"\s+capture="environment"/)
  })

  it('die Rettung hat das breite accept und kein sichtbares Menü mehr', () => {
    expect(quelle).toContain('accept="image/*,application/octet-stream"')
    expect(quelle).not.toContain('Aus Dateien')
    expect(quelle).not.toContain('Aus der Galerie')
    expect(quelle).toContain('Anders auswählen')
  })

  it('die Karte kennt das Teilen und den Installationshinweis', () => {
    expect(quelle).toContain('Oder in der Galerie: Teilen → FarmerZone')
    expect(quelle).toContain('display-mode: standalone')
    expect(quelle).toContain('Zum Startbildschirm hinzufügen')
  })

  it('der Produktdialog prüft bei der Auswahl, sperrt das Speichern derweil und setzt den Weg erst danach', () => {
    const dialog = readFileSync(join(process.cwd(), 'src/components/products/product-dialog.tsx'), 'utf8')
    expect(dialog).toContain('await pruefeLesbarkeit(file, {')
    expect(dialog).toMatch(/type="submit" disabled=\{isSubmitting \|\| pruefeFoto\}/)
    // Der Weg wird der angenommenen Datei zugeordnet — nach der Prüfung, nicht in onFiles.
    expect(dialog.indexOf('gewaehlterWeg.current = weg')).toBeGreaterThan(dialog.indexOf('await pruefeLesbarkeit(file, {'))
    expect(dialog.match(/gewaehlterWeg\.current = weg/g)).toHaveLength(1)
  })
})
