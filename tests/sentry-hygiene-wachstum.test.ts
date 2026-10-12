/**
 * Nr. 64: Die Laufzeit des Sentry-Filters wächst linear — gemessen als
 * Verhältnis t(4N)/t(N) bei 50 000 und 200 000 Zeichen statt nur gegen eine feste
 * Grenze (die Laufzeit-Fälle in tests/sentry-hygiene-felder.test.ts prüfen
 * höchstens 500 ms bei 50 000 Zeichen). Linear ergibt etwa 4, quadratisch 16; die
 * Grenze 8 lässt Luft für die Speicherbereinigung. Je Größe der Median aus drei
 * Läufen, beide Größen abwechselnd gemessen: Last durch parallele Tests trifft so
 * beide Zeiten und lässt das Verhältnis stehen. Ein leichter Fall wiederholt die
 * Bereinigung je Lauf, damit seine Zeit nicht im Rauschen liegt. Liegt ein
 * Verhältnis über der Grenze, wird bis zu dreimal neu gemessen: Last verlängert
 * nur einzelne Läufe, ein quadratischer Teil liegt in jedem Versuch bei etwa 16
 * (unter Last im vollen Lauf fiel ein linearer Fall einmal auf 8,4). Gemessen
 * wird die Dauer, nie ein Datum.
 *
 * Je Teil zwei Eingaben, an denen er an vielen Stellen ansetzt: ersetzeVorab
 * (Werte hinter Leerraum), ADRESSE_IM_FREITEXT (relative Adressen mit
 * eingebetteten absoluten), TELEFON_MUSTER (samt Kennungsform und Nachlese) und
 * bereinigeQuery (die Lesarten, ihr Rückweg beim Dekodieren, die Nummern, die
 * eine Plus-Lesart anschneidet); dazu je eine für die Zuweisungen (ein Schlüssel
 * am Ende jedes Werts) und die Span-Beschreibung (Nummern über Adressenden).
 */
import { describe, it, expect } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { bereinigeEreignis } from '@/lib/sentry-hygiene'

const N = 50_000
const GRENZE = 8
const VERSUCHE = 3

/** Ein Stück so oft hintereinander, bis der Text mindestens `laenge` Zeichen hat. */
function wiederhole(stueck: string, laenge: number): string {
  return stueck.repeat(Math.ceil(laenge / stueck.length))
}

type Fall = { text: (laenge: number) => string; ereignis: (text: string) => object; wiederholungen?: number }

const fehlertext = (text: (laenge: number) => string, wiederholungen = 1): Fall => ({
  text,
  ereignis: (t) => ({ exception: { values: [{ value: t }] } }),
  wiederholungen,
})
const nachricht = (text: (laenge: number) => string, wiederholungen = 1): Fall => ({ text, ereignis: (t) => ({ message: t }), wiederholungen })
const adresse = (text: (laenge: number) => string, wiederholungen = 1): Fall => ({
  text,
  ereignis: (t) => ({ request: { url: `https://farmerzone.at/hoefe?q=${t}` } }),
  wiederholungen,
})
const span = (daten: (t: string) => object) => (text: (laenge: number) => string, wiederholungen = 1): Fall => ({
  text,
  ereignis: (t) => ({ type: 'transaction', spans: [daten(t)] }),
  wiederholungen,
})

/** Ein Lauf: die Bereinigung, je mit frischem Ereignis um denselben Text (der
 *  Filter ändert das Ereignis, nie den Text — so bleibt das Bauen der großen
 *  Texte und ihre Speicherbereinigung aus der Messung). */
function lauf(fall: Fall, text: string): number {
  const start = performance.now()
  for (let i = 0; i < (fall.wiederholungen ?? 1); i++) bereinigeEreignis(fall.ereignis(text) as ErrorEvent)
  return performance.now() - start
}

const median = (zeiten: number[]) => [...zeiten].sort((a, b) => a - b)[1]

/** Ein Versuch: je Größe drei Läufe, abwechselnd; das Verhältnis der Mediane. */
function miss(fall: Fall, textKlein: string, textGross: string): { verhaeltnis: number; text: string } {
  const klein: number[] = []
  const gross: number[] = []
  for (let runde = 0; runde < 3; runde++) {
    klein.push(lauf(fall, textKlein))
    gross.push(lauf(fall, textGross))
  }
  return {
    verhaeltnis: median(gross) / median(klein),
    text: `${median(klein).toFixed(1)} ms bei ${N}, ${median(gross).toFixed(1)} ms bei ${4 * N}`,
  }
}

const FAELLE: [string, Fall][] = [
  ['ersetzeVorab: Werte mit Nummern und Adressen hinter Leerraum', fehlertext((n) => wiederhole('token: x1 0664 1234567/x ', n))],
  ['ersetzeVorab: Bearer mit Adresse in extra', { text: (n) => wiederhole('Bearer /x?s=1 ', n), ereignis: (t) => ({ extra: { text: t } }) }],
  ['ADRESSE_IM_FREITEXT: relative Adressen vor absoluten', nachricht((n) => wiederhole(' /a?u=https://x.example/b?f[a]=1', n))],
  ['ADRESSE_IM_FREITEXT: Schrägstriche und http', nachricht((n) => `x /${wiederhole('http/', n)}`, 3)],
  ['TELEFON_MUSTER: Ziffern an Wörtern, fast cuid, fast UUID, Plus hinter Ziffern',
    fehlertext((n) => wiederhole('x0123456789a c01c01c01c01 01234567-89ab-cdef-0123-45678901234x 1+0664123456789 ', n), 3)],
  // Eine einzige lange Kette: Ohne die Vorschau vorn läse der Rückblick sie an jeder Stelle (Verhältnis 15).
  ['TELEFON_MUSTER: eine lange %25-Kette vor einer Nummer', fehlertext((n) => `a%${'25'.repeat(n / 2)}4 0664 1234567`, 5)],
  ['bereinigeQuery: Plus-Lesart schneidet Nummern an', adresse((n) => wiederhole('x%3A+2026-10-10+0664%2F9876543+', n))],
  ['bereinigeQuery: Nummern erst voll dekodiert', adresse((n) => wiederhole('x,+0664%25209876543', n))],
  // Dicht an dicht: Verglichen jede Nummer jeden Bereich der Plus-Lesart, wüchse es quadratisch (Verhältnis 15).
  ['bereinigeQuery: dichte Plus-Nummern', adresse((n) => wiederhole(',+06649876543', n), 2)],
  // Jeder Schlüssel steht am Ende des Werts davor und zählt: Jeder Wert wird trotzdem nur einmal gelesen.
  ['ersetzeZuweisungen: ein Schlüssel am Ende jedes Werts', span((t) => ({ data: { 'url.full': `https://farmerzone.at/x/${t}` } }))((n) => wiederhole('token: x]secret: 0664 98765 ', n))],
  ['Span-Beschreibung: Nummern über das Ende vieler Adressen', span((t) => ({ description: t }))((n) => wiederhole('GET https://x.example/a?q=token=1+43 664 9876543 ', n))],
]

describe('Nr. 64 — Laufzeit wächst linear: t(4N)/t(N) unter 8 (Median aus 3 Läufen, bis zu 3 Versuche)', () => {
  for (const [name, fall] of FAELLE) {
    it(name, () => {
      const textKlein = fall.text(N)
      const textGross = fall.text(4 * N)
      // Der erste Lauf übersetzt erst — ohne Aufwärmen wäre t(N) zu groß und das Verhältnis zu klein.
      lauf(fall, fall.text(N / 10))
      let messung = miss(fall, textKlein, textGross)
      for (let versuch = 1; versuch < VERSUCHE && messung.verhaeltnis >= GRENZE; versuch++) messung = miss(fall, textKlein, textGross)
      expect(messung.verhaeltnis, messung.text).toBeLessThan(GRENZE)
    }, 30_000)
  }
})
