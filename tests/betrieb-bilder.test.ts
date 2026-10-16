/**
 * Bilder ohne Verwendung und die Grenzen des Aufräumens — die reinen Regeln
 * aus src/lib/betrieb.ts (Register N18, Nr. 104), ohne jeden Mock.
 *
 * Beweist:
 *  - Ohne Verwendung = keine gespeicherte Adresse, älter als 7 Tage, Pfad
 *    eines Hofs DIESER Datenbank. Eine `bildUrl` tief in der Fassung, ein
 *    Foto in `bannerValue` und ein Block der Startseite zählen als benutzt;
 *    ein 6 Tage altes Bild kommt nicht in die Liste, ein 8 Tage altes schon.
 *  - Unbekannter Hof und Startseiten-Ordner werden getrennt geführt und
 *    zählen nicht in die Summe; ein fremder Pfad wird gar nicht geführt.
 *  - Die Summen je Art (auch 0) und die älteste gezählte Datei; die Karte
 *    daraus: nach Größe, ohne leere Arten, getrennt, Stand-Hinweis.
 *  - „Was hilft“ nennt beim Bilder-Speicher die Bilder ohne Verwendung.
 *  - Aufräumen: Sitzung vor 6 Tagen abgelaufen bleibt, vor 8 Tagen nicht;
 *    Codes 1 Tag, Webhook-Ereignisse 30 Tage, Messungen 400 Tage.
 */
import { describe, it, expect } from 'vitest'
import { formatTagKurz } from '@/lib/format'
import {
  BETRIEB_TEXT,
  aufraeumGrenzen,
  betriebKacheln,
  bildUrlsAusInhalt,
  bilderOhneVerwendung,
  ohneVerwendungArt,
  ohneVerwendungKarte,
  ohneVerwendungWerte,
  ordneBildEin,
  pfadAusAdresse,
  warnEintraege,
  type BildOhneVerwendung,
  type Messung,
} from '@/lib/betrieb'

const JETZT = new Date('2026-10-16T04:05:00.000Z')
const TAG = 24 * 60 * 60 * 1000
const SPEICHER = 'https://speicher.public.blob.vercel-storage.com'
const HOEFE = new Set(['hofa', 'hofb'])

function datei(pathname: string, tageAlt: number, size = 100_000) {
  return { pathname, url: `${SPEICHER}/${pathname}`, size, uploadedAt: new Date(JETZT.getTime() - tageAlt * TAG) }
}

describe('ordneBildEin', () => {
  it('ordnet die Ordner der Höfe ihren Arten zu', () => {
    expect(['product', 'gallery', 'banner', 'logo', 'status', 'meldung'].map((z) => ordneBildEin(`farms/hofa/${z}/1.webp`, HOEFE))).toEqual([
      'produktfotos',
      'galerie',
      'titelbilder',
      'logos',
      'beitragsfotos',
      'meldungen',
    ])
    expect(ordneBildEin('originals/hofa/product/IMG_1.jpg', HOEFE)).toBe('originale')
  })

  it('führt unbekannte Höfe und den Startseiten-Ordner getrennt, fremde Pfade gar nicht', () => {
    expect(ordneBildEin('farms/geloescht/product/1.webp', HOEFE)).toBe('unbekannterHof')
    expect(ordneBildEin('originals/geloescht/logo/a.jpg', HOEFE)).toBe('unbekannterHof')
    expect(ordneBildEin('startseite/bilder/1.webp', HOEFE)).toBe('startseite')
    expect(ordneBildEin('startseite/originale/a.jpg', HOEFE)).toBe('startseite')
    expect(ordneBildEin('farms/hofa/unbekannt/1.webp', HOEFE)).toBeNull()
    expect(ordneBildEin('farms/hofa/constructor/1.webp', HOEFE)).toBeNull()
    expect(ordneBildEin('irgendwas/1.webp', HOEFE)).toBeNull()
  })
})

describe('pfadAusAdresse und bildUrlsAusInhalt', () => {
  it('nimmt nur den Pfad einer Web-Adresse — ohne Domain und Abfrage; ein Verlauf ist keine Adresse', () => {
    expect(pfadAusAdresse(`${SPEICHER}/farms/hofa/banner/1.webp?v=3`)).toBe('farms/hofa/banner/1.webp')
    expect(pfadAusAdresse(`${SPEICHER}/farms/hofa/logo/mit%20leer.webp`)).toBe('farms/hofa/logo/mit leer.webp')
    expect(pfadAusAdresse('wiese')).toBeNull()
    expect(pfadAusAdresse('javascript:alert(1)')).toBeNull()
  })

  it('findet jede bildUrl einer Fassung, auch verschachtelt', () => {
    const inhalt = { v: 1, abschnitte: [{ art: 'BLOCK', block: { titel: 'Erfunden', bildUrl: 'a' } }, { art: 'HOEFE' }], extra: { tief: [{ bildUrl: 'b' }], bildUrl: null } }
    expect(bildUrlsAusInhalt(inhalt)).toEqual(['a', 'b'])
    expect(bildUrlsAusInhalt(null)).toEqual([])
  })
})

describe('bilderOhneVerwendung', () => {
  const fassung = { v: 1, abschnitte: [{ block: { bildUrl: `${SPEICHER}/farms/hofa/product/fassung.webp` } }] }
  const benutzt = new Set(
    [
      ...bildUrlsAusInhalt(fassung),
      `${SPEICHER}/farms/hofa/banner/titel.webp?v=2`, // bannerValue mit Foto-Adresse
      'verlauf-wiese', // bannerValue mit Verlauf
      `${SPEICHER}/startseite/bilder/block.webp`, // StartseiteBlock.bildUrl
    ].flatMap((a) => pfadAusAdresse(a) ?? [])
  )

  it('lässt benutzte Bilder weg: Fassung, bannerValue, Startseiten-Block', () => {
    const liste = bilderOhneVerwendung(
      [datei('farms/hofa/product/fassung.webp', 30), datei('farms/hofa/banner/titel.webp', 30), datei('startseite/bilder/block.webp', 30)],
      { benutzt, hoefe: HOEFE },
      JETZT
    )
    expect(liste).toEqual([])
  })

  it('listet nur, was älter als 7 Tage ist: 6 Tage alt bleibt draußen, 8 Tage alt kommt hinein', () => {
    const liste = bilderOhneVerwendung([datei('farms/hofa/product/sechs.webp', 6), datei('farms/hofa/product/acht.webp', 8)], { benutzt, hoefe: HOEFE }, JETZT)
    expect(liste.map((b) => b.pathname)).toEqual(['farms/hofa/product/acht.webp'])
  })

  it('führt unbekannten Hof und Startseite getrennt und fremde Pfade gar nicht — älteste zuerst', () => {
    const liste = bilderOhneVerwendung(
      [datei('farms/geloescht/product/x.webp', 10), datei('startseite/bilder/alt.webp', 20), datei('farms/hofb/gallery/g.webp', 40), datei('anderes/y.webp', 50)],
      { benutzt, hoefe: HOEFE },
      JETZT
    )
    expect(liste.map((b) => [b.gruppe, b.pathname])).toEqual([
      ['galerie', 'farms/hofb/gallery/g.webp'],
      ['startseite', 'startseite/bilder/alt.webp'],
      ['unbekannterHof', 'farms/geloescht/product/x.webp'],
    ])
  })
})

describe('ohneVerwendungWerte', () => {
  it('schreibt je Gruppe Bytes und Dateien (auch 0); die älteste zählt nur gezählte Arten', () => {
    const liste: BildOhneVerwendung[] = [
      { gruppe: 'unbekannterHof', pathname: 'farms/x/product/1.webp', size: 5, uploadedAt: new Date('2026-01-01T00:00:00Z') },
      { gruppe: 'produktfotos', pathname: 'farms/hofa/product/2.webp', size: 300, uploadedAt: new Date('2026-08-03T10:00:00Z') },
      { gruppe: 'produktfotos', pathname: 'farms/hofa/product/3.webp', size: 200, uploadedAt: new Date('2026-09-01T10:00:00Z') },
    ]
    const werte = new Map(ohneVerwendungWerte(liste))
    expect(werte.get(ohneVerwendungArt('produktfotos', 'bytes'))).toBe(500)
    expect(werte.get(ohneVerwendungArt('produktfotos', 'dateien'))).toBe(2)
    expect(werte.get(ohneVerwendungArt('logos', 'dateien'))).toBe(0)
    expect(werte.get(ohneVerwendungArt('unbekannterHof', 'bytes'))).toBe(5)
    expect(werte.get('ohneVerwendung:aelteste')).toBe(new Date('2026-08-03T10:00:00Z').getTime())
    expect(werte.size).toBe(19)
    expect(new Map(ohneVerwendungWerte([])).get('ohneVerwendung:aelteste')).toBe(0)
  })
})

describe('ohneVerwendungKarte', () => {
  const gemessen = new Date('2026-10-16T04:06:00Z')
  const m = (tag: string, art: Messung['art'], wert: number): Messung => ({ tag, art, wert, gemessenAm: gemessen })
  const messung = (tag: string): Messung[] => [
    m(tag, 'bilderBytes', 838_000_000),
    m(tag, ohneVerwendungArt('produktfotos', 'bytes'), 112_000_000),
    m(tag, ohneVerwendungArt('produktfotos', 'dateien'), 201),
    m(tag, ohneVerwendungArt('galerie', 'bytes'), 41_000_000),
    m(tag, ohneVerwendungArt('galerie', 'dateien'), 58),
    m(tag, ohneVerwendungArt('originale', 'bytes'), 190_000_000),
    m(tag, ohneVerwendungArt('originale', 'dateien'), 83),
    m(tag, ohneVerwendungArt('logos', 'dateien'), 0),
    m(tag, ohneVerwendungArt('startseite', 'bytes'), 3_000_000),
    m(tag, ohneVerwendungArt('startseite', 'dateien'), 4),
    m(tag, 'ohneVerwendung:aelteste', new Date('2026-08-03T10:00:00Z').getTime()),
  ]

  it('ohne gezählte Messung: keine Karte', () => {
    expect(ohneVerwendungKarte([m('2026-10-16', 'bilderBytes', 1)], JETZT)).toBeNull()
  })

  it('Summe nur über die Arten, nach Größe, leere Arten weg, Startseite getrennt', () => {
    const karte = ohneVerwendungKarte(messung('2026-10-16'), JETZT)
    expect(karte).toMatchObject({ bytes: 343_000_000, summe: '343 MB', zeile: 'in 342 Dateien · älteste vom 3. Aug', hinweis: null })
    expect(karte?.arten.map((z) => [z.text, z.dateien, z.groesse])).toEqual([
      ['Reste von Originalen', '83', '190 MB'],
      ['Produktfotos', '201', '112 MB'],
      ['Galerie', '58', '41 MB'],
    ])
    expect(karte?.getrennt.map((z) => z.text)).toEqual(['Startseite – auch Bilder aus der Vorschau'])
  })

  it('stammt sie nicht vom letzten Messtag, sagt die Karte von wann', () => {
    const karte = ohneVerwendungKarte([...messung('2026-10-14'), m('2026-10-16', 'bilderBytes', 1)], JETZT)
    expect(karte?.hinweis).toBe(BETRIEB_TEXT.standVom(formatTagKurz('2026-10-14')))
  })
})

describe('„Was hilft“ in der Warnkarte', () => {
  const warnung = [{ art: 'bilder', stufe: 1, gemeldetAm: JETZT }]
  const kacheln = betriebKacheln([{ tag: '2026-10-16', art: 'bilderBytes', wert: 820_000_000, gemessenAm: JETZT }], JETZT)

  it('nennt beim Bilder-Speicher die Bilder ohne Verwendung, sobald sie gezählt sind', () => {
    const [eintrag] = warnEintraege(warnung, kacheln, [], [], JETZT, true, 214_000_000)
    expect(eintrag.saetze.join(' ')).toContain('Was hilft: 214 MB hängen an nichts mehr, oder Vercel Pro (ohne harte Sperre).')
  })

  it('ohne gezählte Bilder bleibt Vercel Pro', () => {
    const [eintrag] = warnEintraege(warnung, kacheln, [], [], JETZT, true)
    expect(eintrag.saetze.join(' ')).toContain('Was hilft: Vercel Pro, dort gibt es keine harte Sperre.')
  })
})

describe('aufraeumGrenzen', () => {
  const grenze = aufraeumGrenzen(JETZT)
  const weg = (zeitpunkt: Date, bis: Date): boolean => zeitpunkt.getTime() < bis.getTime()

  it('Sitzung: vor 6 Tagen abgelaufen bleibt, vor 8 Tagen ist sie weg, eine gültige bleibt', () => {
    expect(weg(new Date(JETZT.getTime() - 6 * TAG), grenze.sitzungen)).toBe(false)
    expect(weg(new Date(JETZT.getTime() - 8 * TAG), grenze.sitzungen)).toBe(true)
    expect(weg(new Date(JETZT.getTime() + TAG), grenze.sitzungen)).toBe(false)
    expect(weg(grenze.sitzungen, grenze.sitzungen)).toBe(false)
  })

  it('Codes nach 1 Tag, Webhook-Ereignisse nach 30 Tagen, Messungen nach 400 Tagen (UTC-Tag)', () => {
    expect(grenze.codes).toEqual(new Date(JETZT.getTime() - TAG))
    expect(grenze.webhookEreignisse).toEqual(new Date(JETZT.getTime() - 30 * TAG))
    expect(grenze.messungen).toEqual(new Date('2025-09-11T00:00:00.000Z'))
  })
})
