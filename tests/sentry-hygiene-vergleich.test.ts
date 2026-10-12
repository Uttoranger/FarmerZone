/**
 * Nr. 64: Der Filter fängt mindestens, was main fängt — ein Zufallsvergleich
 * mit den Mustern von main (087a5a0), hier wörtlich eingefroren wie REF_EMAIL in
 * tests/sentry-hygiene-felder.test.ts. Anlass: Die Telefon-Regel erkennt cuid
 * und UUID jetzt an ihrer Form statt an den Rändern, und eine Abfrage liest ihre
 * Lesarten auf demselben Text — beides darf keinen Fall verlieren, den main fing.
 *
 * Getrennte Bausteine (Telefon, E-Mail, Adresse, Kennung, Füllwörter, Trenner),
 * zufällig zusammengesetzt, fester Startwert. Gezählt wird, was von Rufnummer und
 * E-Mail-Adresse sichtbar bleibt: Nur die Rufnummer trägt Ziffern von 3 bis 9,
 * nur die Adresse „xq" oder „example". Bleibt bei main nichts davon, bleibt auch
 * jetzt nichts; ließ main etwas stehen, bleibt jetzt höchstens ebenso viel.
 *
 * Die Referenz ist main dort, wo die Bausteine keine weitere Regel auslösen: im
 * Fehlertext bereinigeText (E-Mail, kodierte E-Mail, Telefon, Code), in einem
 * Abfragewert erst die rohe Lesart (E-Mail, dann Nummer mit „+"), dann zerlegt
 * und dekodiert bereinigeText — kein Schlüssel, kein „/" am Anfang, kein „=".
 */
import { describe, it, expect } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { bereinigeEreignis } from '@/lib/sentry-hygiene'

const REF_EMAIL =
  /[\p{L}\p{N}\p{M}._%+-]+@(?:[\p{L}\p{N}\p{M}.-]|%(?:25)*[89A-Fa-f][0-9A-Fa-f])+\.(?:[\p{L}\p{M}]|%(?:25)*[89A-Fa-f][0-9A-Fa-f]){2,}/gu
const REF_KODIERT =
  /(?<![\p{L}\p{N}\p{M}._%+-])[\p{L}\p{N}\p{M}._%+-]+%(?:25)*40(?:[\p{L}\p{N}\p{M}.-]|%(?:25)*[89A-Fa-f][0-9A-Fa-f])+\.(?:[\p{L}\p{M}]|%(?:25)*[89A-Fa-f][0-9A-Fa-f]){2,}/giu
const REF_TELEFON =
  /(?=(?:\+|\(?0)\d)(?:(?<=%(?:25)*[0-9A-Fa-f]{2})|(?<!\d)(?:(?<![A-Za-z_-])|(?=(?:\+|\(?0)\d(?:[\s/\-.()]{0,3}\d){7,}(?!\w))))(?:\+|\(?0)\d(?:[\s/\-.()]{0,3}\d){7,}/g
const REF_CODE = /\b(code|otp|anmeldecode)(\W{1,3})\d{6}\b/gi
const REF_PLUS_ROH = /(?:(?<=%[0-9A-Fa-f]{2})|(?<![\p{L}\p{N}\p{M}_+]))\+\d(?:[\s/\-.()+]{0,3}\d){7,}/gu

/** bereinigeText von main. */
function mainText(text: string): string {
  return text
    .replace(REF_EMAIL, '[e-mail entfernt]')
    .replace(REF_KODIERT, '[e-mail entfernt]')
    .replace(REF_TELEFON, '[telefon entfernt]')
    .replace(REF_CODE, '$1$2[code entfernt]')
}

/** Ein Abfragewert, wie main ihn las: roh, dann zerlegt und dekodiert. */
function mainWert(roh: string): string {
  const rohGelesen = roh.replace(REF_EMAIL, '[e-mail entfernt]').replace(REF_PLUS_ROH, '[telefon entfernt]')
  return mainText(new URLSearchParams(`q=${rohGelesen}`).get('q') ?? '')
}

function ereignis(teil: object): ErrorEvent {
  return teil as ErrorEvent
}

const neuFehlertext = (text: string) => bereinigeEreignis(ereignis({ exception: { values: [{ value: text }] } })).exception?.values?.[0].value ?? ''

function neuWert(roh: string): string {
  const url = bereinigeEreignis(ereignis({ request: { url: `https://farmerzone.at/hoefe?q=${roh}&seite=2` } })).request?.url ?? ''
  const abfrage = new URL(url).searchParams
  // Die übrigen Parameter bleiben — sonst wäre der Vergleich leer gelaufen.
  if (abfrage.get('seite') !== '2') return `kaputt: ${url}`
  return abfrage.get('q') ?? ''
}

/** Ein 32-Bit-Zufall (mulberry32) mit festem Startwert — Math.imul läuft nicht über. */
function zufall(startwert: number): (bis: number) => number {
  let zustand = startwert
  return (bis) => {
    zustand = (zustand + 0x6d2b79f5) | 0
    let t = Math.imul(zustand ^ (zustand >>> 15), 1 | zustand)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) % bis
  }
}

const nummernRest = (text: string) => (text.match(/[3-9]/g) ?? []).length
const adressRest = (text: string) => (text.match(/xq|example/gi) ?? []).length

type Bausteine = { telefon: string[]; email: string[]; anfang: string[]; rest: string[] }

/** Ein Fall: Füllwerk, dann Rufnummer und/oder E-Mail-Adresse in zufälliger Reihenfolge, je mit Füllwerk dazwischen. */
function baueFall(z: (bis: number) => number, b: Bausteine): { text: string; telefon: boolean; email: boolean } {
  const teile = [b.anfang[z(b.anfang.length)]]
  const fuelle = () => {
    for (let n = z(4); n > 0; n--) teile.push(b.rest[z(b.rest.length)])
  }
  const art = z(3)
  const geheimnisse = [art !== 1 ? b.telefon[z(b.telefon.length)] : '', art !== 0 ? b.email[z(b.email.length)] : '']
  if (z(2) === 1) geheimnisse.reverse()
  for (const geheimnis of geheimnisse) {
    fuelle()
    if (geheimnis) teile.push(geheimnis)
  }
  fuelle()
  return { text: teile.join(''), telefon: art !== 1, email: art !== 0 }
}

const KENNUNGEN = ['cka0120120120abcdefghijkl', '01201201-abcd-ef01-2012-012012012012', 'V1StGXR2_Z0jdHi1BmyT2pqLnv0wYc1k', 'pi_2Nk0120120120aBcDeF']

const FEHLERTEXT: Bausteine = {
  telefon: [
    '0664 9876543', '0664/9876543', '06649876543', '+43 664 9876543', '+436649876543', '(0664) 9876543', '0664-987 65 43',
    '+43 (664) 987-6543', '0664.987.65.43', '0043 664 9876543', '+43-664-9876543', '(+43) 664 9876543', '0664 98 76 543',
  ],
  email: [
    'xq@example.com', 'xq.kundin@example.com', 'xq+shop@example.com', 'kundin.xq@example.org', 'xq%40example.com',
    'xq%2540example.com', 'jürgen.xq@bäckerei.example', 'XQ@EXAMPLE.COM', 'xq@m%C3%BCller.example',
  ],
  anfang: ['Fehler ', 'Hof', 'Telefon', 'Ruf', ''],
  rest: [
    ...KENNUNGEN, 'Hof', 'Telefon', 'Adresse', 'Abholung', 'foto.jpg', 'Tel', 'x', 'ä', '2021-10-12', '10:20', '12.10.2021', '012', '1', '20',
    ' ', ' ', '_', '-', '.', ',', ':', '(', ')', '+', '%20', '%22', '%2520', '"', "'",
  ],
}

const ABFRAGEWERT: Bausteine = {
  telefon: [
    '%2B43%20664%209876543', '+43+664+9876543', '%2B43+664+9876543', '0664+9876543', '0664%2F9876543', '(0664)+987+65+43',
    '%280664%29%209876543', '+436649876543', '0664%209876543', '+43%20664%209876543', '06649876543', '+43%2F664%2F9876543',
    '0043+664+9876543', '0664-987-65-43', '%2B43-664-9876543',
  ],
  email: [
    'xq@example.com', 'xq%40example.com', 'xq+shop@example.com', 'xq%2Bshop%40example.com', 'kundin.xq@example.org',
    'j%C3%BCrgen.xq@example.com', 'xq@b%C3%A4ckerei.example', 'xq@b%C3.cc', 'xq@ex%FFample.com',
  ],
  anfang: ['Abholung', 'Hof', 'Telefon', 'Artikel', 'Bio', 'x'],
  rest: [
    ...KENNUNGEN, 'Abholung', 'Hof', 'Telefon', 'x', '%C3%A4', '2021-10-12', '10%3A20', '12',
    '+', '+', '%20', '%2C', '-', '.', '_', ':', '%3A', '(', ')', '%28', '%29', '%2B', '%2F',
  ],
}

describe('Nr. 64 — neu fängt mindestens, was main fängt (Zufallsvergleich, fester Startwert)', () => {
  it('im Fehlertext: 4000 Fälle aus Rufnummern, E-Mail-Adressen, Kennungen, Füllwörtern und Trennern', () => {
    const z = zufall(64)
    const abweichungen: string[] = []
    let mainFing = 0
    let neuFingMehr = 0
    for (let i = 0; i < 4000; i++) {
      const { text, telefon, email } = baueFall(z, FEHLERTEXT)
      const main = mainText(text)
      const neu = neuFehlertext(text)
      if (nummernRest(neu) > nummernRest(main) || adressRest(neu) > adressRest(main)) abweichungen.push(`${text} → main: ${main} | neu: ${neu}`)
      if ((!telefon || nummernRest(main) === 0) && (!email || adressRest(main) === 0)) mainFing++
      if (nummernRest(neu) + adressRest(neu) < nummernRest(main) + adressRest(main)) neuFingMehr++
    }
    expect(abweichungen.slice(0, 5)).toEqual([])
    // Der Vergleich trägt: main fing viele Fälle ganz, und die neue Regel fängt Fälle, die main stehen ließ.
    expect(mainFing).toBeGreaterThan(1500)
    expect(neuFingMehr).toBeGreaterThan(200)
  })

  it('in einem Abfragewert einer Adresse: 3000 Fälle aus kodierten Rufnummern, E-Mail-Adressen, Kennungen, Füllwörtern und Trennern', () => {
    const z = zufall(87)
    const abweichungen: string[] = []
    let mainFing = 0
    let neuFingMehr = 0
    for (let i = 0; i < 3000; i++) {
      const { text, telefon, email } = baueFall(z, ABFRAGEWERT)
      const main = mainWert(text)
      const neu = neuWert(text)
      if (nummernRest(neu) > nummernRest(main) || adressRest(neu) > adressRest(main)) abweichungen.push(`${text} → main: ${main} | neu: ${neu}`)
      if ((!telefon || nummernRest(main) === 0) && (!email || adressRest(main) === 0)) mainFing++
      if (nummernRest(neu) + adressRest(neu) < nummernRest(main) + adressRest(main)) neuFingMehr++
    }
    expect(abweichungen.slice(0, 5)).toEqual([])
    expect(mainFing).toBeGreaterThan(1000)
    expect(neuFingMehr).toBeGreaterThan(100)
  })
})
