/**
 * Tests für den URL-Guard und die Zweck-Tabelle (src/lib/upload-pfade.ts).
 *
 * Der Guard ist die Sperre der Verarbeitungs-Route. Sie bekommt vom Client eine
 * Adresse und lädt sie herunter — ohne Guard wäre das ein Werkzeug, mit dem
 * sich beliebige fremde Adressen von unserem Server abrufen ließen, und ein
 * angemeldeter Bauer könnte die Originale eines anderen Hofes verarbeiten und
 * sich als eigenes Bild ablegen lassen.
 *
 * Reine Funktion, kein Netzzugriff — deshalb hier vollständig prüfbar. Sie
 * entscheidet, BEVOR irgendetwas geladen wird.
 */
import { describe, it, expect } from 'vitest'
import {
  MAX_LONG_SIDE,
  MAX_ORIGINAL_BYTES,
  UPLOAD_ZWECKE,
  WEBP_QUALITAET,
  darfGeloeschtWerden,
  darfVerarbeitetWerden,
  istUploadZweck,
  originalPfad,
  originalPrefix,
  zielPfad,
} from '@/lib/upload-pfade'

const HOF = 'farm_meiner'
const FREMD = 'farm_fremder'
const BLOB = 'https://abc123.public.blob.vercel-storage.com'

describe('darfVerarbeitetWerden — fremde Hosts', () => {
  it('lehnt einen fremden Host ab', () => {
    expect(darfVerarbeitetWerden(`https://beispiel.at/originals/${HOF}/foto.jpg`, HOF)).toBe(false)
    expect(darfVerarbeitetWerden(`https://localhost/originals/${HOF}/foto.jpg`, HOF)).toBe(false)
  })

  it('lehnt einen Host ab, der unseren nur als Anhängsel trägt', () => {
    // Der klassische Trick: eigener Server, der wie unserer aussieht.
    expect(
      darfVerarbeitetWerden(`https://public.blob.vercel-storage.com.boese.at/originals/${HOF}/x.jpg`, HOF)
    ).toBe(false)
    expect(
      darfVerarbeitetWerden(`https://boese.at/abc.public.blob.vercel-storage.com/originals/${HOF}/x.jpg`, HOF)
    ).toBe(false)
  })

  it('lehnt alles ab, was nicht https ist', () => {
    expect(darfVerarbeitetWerden(`http://abc.public.blob.vercel-storage.com/originals/${HOF}/x.jpg`, HOF)).toBe(false)
    // Kein Abruf lokaler Dateien über den Server
    expect(darfVerarbeitetWerden(`file:///etc/passwd`, HOF)).toBe(false)
  })

  it('lehnt Müll und Leeres ab, statt zu werfen', () => {
    expect(darfVerarbeitetWerden('', HOF)).toBe(false)
    expect(darfVerarbeitetWerden('kein-url', HOF)).toBe(false)
    expect(darfVerarbeitetWerden('///', HOF)).toBe(false)
  })
})

describe('darfVerarbeitetWerden — fremde Höfe', () => {
  it('lehnt den Originale-Ordner eines anderen Hofes ab', () => {
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${FREMD}/product/foto.jpg`, HOF)).toBe(false)
  })

  it('lässt sich nicht durch einen untergeschobenen Pfad täuschen', () => {
    // Der eigene Präfix steht drin — aber nicht am Anfang. Ein `includes`
    // würde hier durchwinken und fremde Originale verarbeiten lassen.
    expect(
      darfVerarbeitetWerden(`${BLOB}/originals/${FREMD}/originals/${HOF}/foto.jpg`, HOF)
    ).toBe(false)
  })

  it('lehnt einen Hof ab, dessen Kennung mit der eigenen beginnt', () => {
    // `farm_meiner` ist ein Präfix von `farm_meiner2` — ohne den Schrägstrich
    // im Präfix ginge der fremde Hof durch.
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}2/product/foto.jpg`, HOF)).toBe(false)
  })

  it('lehnt den ZIEL-Ordner ab — verarbeitet wird nur, was im Originale-Ordner liegt', () => {
    expect(darfVerarbeitetWerden(`${BLOB}/farms/${HOF}/product/fertig.webp`, HOF)).toBe(false)
  })
})

describe('darfVerarbeitetWerden — der eigene Pfad', () => {
  it('erlaubt den eigenen Originale-Ordner', () => {
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/product/foto.jpg`, HOF)).toBe(true)
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/banner/foto-Ab12.jpg`, HOF)).toBe(true)
  })

  it('erlaubt genau den Pfad, den originalPfad baut', () => {
    // Die beiden müssen zusammenpassen — sonst kann der Client hochladen, was
    // die Verarbeitung anschließend ablehnt.
    const pfad = originalPfad(HOF, 'banner', 'Bewegungsaufnahme 4.jpg')
    expect(darfVerarbeitetWerden(`${BLOB}/${pfad}`, HOF)).toBe(true)
  })

  it('erlaubt auch einen prozentkodierten Pfad', () => {
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/product/foto%20neu.jpg`, HOF)).toBe(true)
  })
})

describe('darfGeloeschtWerden — das ersetzte Bild', () => {
  it('erlaubt nur den Zielordner des eigenen Hofes', () => {
    expect(darfGeloeschtWerden(`${BLOB}/farms/${HOF}/logo/1.webp`, HOF)).toBe(true)
    expect(darfGeloeschtWerden(`${BLOB}/farms/${FREMD}/logo/1.webp`, HOF)).toBe(false)
  })

  it('lehnt fremde Hosts ab — strenger als die alte Route, die nur den Host prüfte', () => {
    expect(darfGeloeschtWerden(`https://beispiel.at/farms/${HOF}/logo/1.webp`, HOF)).toBe(false)
  })
})

describe('Pfad-Schema', () => {
  it('legt Originale unter originals/{farmId}/{zweck}/ ab', () => {
    expect(originalPrefix(HOF)).toBe(`originals/${HOF}/`)
    expect(originalPfad(HOF, 'logo', 'bild.jpg')).toBe(`originals/${HOF}/logo/bild.jpg`)
  })

  it('entschärft den Dateinamen vom Gerät', () => {
    // Er stammt vom Telefon des Bauern und darf den Pfad nicht verlassen.
    const pfad = originalPfad(HOF, 'product', '../../../etc/passwd')
    expect(pfad.startsWith(originalPrefix(HOF))).toBe(true)
    expect(pfad).not.toContain('..')
    expect(darfVerarbeitetWerden(`${BLOB}/${pfad}`, HOF)).toBe(true)
  })

  it('kommt mit einem leeren Dateinamen zurecht', () => {
    expect(originalPfad(HOF, 'status', '')).toBe(`originals/${HOF}/status/foto`)
  })

  it('behält das bisherige Zielschema farms/{farmId}/{zweck}/', () => {
    const ziel = zielPfad(HOF, 'gallery')
    expect(ziel.startsWith(`farms/${HOF}/gallery/`)).toBe(true)
    expect(ziel.endsWith('.webp')).toBe(true)
  })
})

describe('Zweck-Tabelle', () => {
  it('übernimmt die bisherigen Werte unverändert', () => {
    // Dieser Umbau verlagert die Verkleinerung auf den Server — er ändert
    // NICHT, wie groß die Bilder werden. Die Zahlen sind dieselben wie in der
    // bisherigen clientseitigen MAX_LONG_SIDE-Tabelle.
    expect(MAX_LONG_SIDE).toEqual({
      logo: 800,
      product: 2400,
      banner: 3200,
      gallery: 2400,
      status: 2400,
    })
    expect(WEBP_QUALITAET).toBe(82)
  })

  it('hält das Titelbild über allen anderen Zwecken', () => {
    const andere = UPLOAD_ZWECKE.filter((z) => z !== 'banner').map((z) => MAX_LONG_SIDE[z])

    expect(Math.max(...andere)).toBeLessThan(MAX_LONG_SIDE.banner)
  })

  it('kennt für jeden Zweck eine Auflösung', () => {
    for (const zweck of UPLOAD_ZWECKE) {
      expect(typeof MAX_LONG_SIDE[zweck]).toBe('number')
    }
  })

  it('lässt das Original 25 MB groß sein — kein Verkleinern mehr davor', () => {
    expect(MAX_ORIGINAL_BYTES).toBe(25 * 1024 * 1024)
  })

  it('erkennt nur echte Zwecke', () => {
    expect(istUploadZweck('banner')).toBe(true)
    expect(istUploadZweck('gibts-nicht')).toBe(false)
    expect(istUploadZweck(null)).toBe(false)
    expect(istUploadZweck(42)).toBe(false)
  })
})
