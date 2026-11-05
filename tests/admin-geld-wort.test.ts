/**
 * Das Wort der Gebühr in Admin › Geld und Einstellungen (V62, V63; Lauf 30,
 * Nr. 230). Beweist ohne Datenbank:
 *  - `jahrGebuehrTexte`: ganz vor oder ganz nach dem Stichtag ein Wort ohne
 *    Wort je Zeile; über den Stichtag „Gebühren“ mit „bis … / ab …“ und je
 *    Zeile das Wort des Monats, die alte Gebühr mit „(altes Modell)“; ein
 *    Monat, in den der Stichtag fällt, heißt „Gebühren“ und steht in keinem Teil.
 *  - Die Sätze von Geld nehmen das Wort als Argument (Abgleich, Regel mit Artikel).
 *  - Die Karte „Hofpreis-Modell ab“: nach dem Stichtag „Seit diesem Tag gilt …“
 *    ohne „Vorher bleibt alles wie heute.“, davor der Satz von heute — gerendert.
 *  - Die Abweichung „gebuehr“ in Heute sagt „Gebühr“ (stimmt in beiden Modellen).
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/server/actions/plattform-einstellung', () => ({ speichereHofpreisStichtag: vi.fn() }))
vi.mock('@/components/admin/frisch-bestaetigen', () => ({ useFrischBestaetigt: () => ({ ausfuehren: vi.fn(), dialog: null }) }))

import { GELD_JAHR_TEXT, GELD_TEXT, jahrGebuehrTexte } from '@/app/admin/geld/texte'
import { HofpreisStichtag } from '@/app/admin/einstellungen/hofpreis-stichtag'
import { gebuehrWortFuerJahr, gebuehrWortFuerMonat } from '@/lib/finanzen'
import { monatsschluessel, type Monatsschluessel } from '@/lib/servicegebuehr'
import { MARKE } from '@/lib/marke'

const MONATE_2027: Monatsschluessel[] = Array.from({ length: 12 }, (_, i) => monatsschluessel(2027, i + 1))
/** 1. Februar 2027, Wiener Mitternacht — der Stichtag der Vorgabe. */
const STICHTAG = new Date('2027-01-31T23:00:00Z')

function texte(stichtag: Date) {
  const worte = MONATE_2027.map((m) => gebuehrWortFuerMonat(m, stichtag))
  return jahrGebuehrTexte(gebuehrWortFuerJahr(2027, stichtag), null, MONATE_2027, worte)
}

describe('jahrGebuehrTexte', () => {
  it('über den Stichtag (1. Februar): „Gebühren (bis Jänner Servicegebühr, ab Februar Plattformgebühr)“, je Zeile das Wort', () => {
    const t = texte(STICHTAG)
    expect(t.wort).toBe('Gebühren')
    expect(t.legende).toBe('Gebühren (bis Jänner Servicegebühr, ab Februar Plattformgebühr)')
    expect(t.jeMonat['2027-01']).toBe('Servicegebühr (altes Modell)')
    expect(t.jeMonat['2027-02']).toBe('Plattformgebühr')
    expect(t.titelJeMonat['2027-01']).toBe('Servicegebühren')
    expect(t.titelJeMonat['2027-12']).toBe('Plattformgebühren')
  })

  it('fällt der Stichtag mitten in einen Monat, heißt dieser „Gebühren“ und steht in keinem Teil der Legende', () => {
    const t = texte(new Date('2027-02-14T23:00:00Z')) // 15. Februar
    expect(t.legende).toBe('Gebühren (bis Jänner Servicegebühr, ab März Plattformgebühr)')
    expect(t.jeMonat['2027-02']).toBe('Gebühren')
  })

  it('ganz nach dem Stichtag: ein Wort, keine Wörter je Zeile, nirgends „Servicegebühr“', () => {
    const t = texte(new Date('2026-12-31T23:00:00Z'))
    expect(t.wort).toBe('Plattformgebühr')
    expect(t.legende).toBe('Plattformgebühren')
    expect(t.jeMonat).toEqual({})
    expect(JSON.stringify(t)).not.toContain('Servicegebühr')
  })

  it('Gegenprobe: ganz vor dem Stichtag „Servicegebühren“, ebenfalls ohne Wort je Zeile', () => {
    const t = texte(new Date('2028-01-31T23:00:00Z'))
    expect(t.legende).toBe('Servicegebühren')
    expect(t.jeMonat).toEqual({})
  })

  it('die Legende ohne einen der Teile: nur das Wort bzw. ein Teil', () => {
    expect(GELD_JAHR_TEXT.legendeUeberStichtag(null, null)).toBe('Gebühren')
    expect(GELD_JAHR_TEXT.legendeUeberStichtag(null, { monat: 'März', wort: 'Plattformgebühr' })).toBe('Gebühren (ab März Plattformgebühr)')
  })
})

describe('Sätze von Geld mit dem Wort', () => {
  it('Abgleich und Regel tragen das Wort; die kurze Regel-Zeile des Boards', () => {
    expect(GELD_TEXT.abgleichGleich('Plattformgebühr')).toBe('Betrag, Plattformgebühr und Erstattung gleich')
    expect(GELD_TEXT.regel('Plattformgebühr')).toBe(
      `Umsatz geht direkt an die Höfe. ${MARKE} behält nur die Plattformgebühr; Stripe-Gebühren trägt ${MARKE}. Ein Monat lässt sich erst nach seinem Ende abschließen.`
    )
    expect(GELD_TEXT.regel('Gebühren')).toContain('behält nur die Gebühren;')
    expect(GELD_TEXT.regel('Plattformgebühr')).not.toContain('Servicegebühr')
  })

  it('Erstattungen-Kachel: „keine offen“ (Board), mit Erstattungen davor die Anzahl; offene als Zahl', () => {
    expect(GELD_TEXT.erstattungenSatz(null, 0)).toBe('keine offen')
    expect(GELD_TEXT.erstattungenSatz('5 Bestellungen', 0)).toBe('5 Bestellungen · keine offen')
    expect(GELD_TEXT.erstattungenSatz('5 Bestellungen', 1)).toBe('5 Bestellungen · 1 offen')
  })
})

describe('Karte „Hofpreis-Modell ab“ (V62, Board s3/w3-admin-einstellungen Bild 4 und 5)', () => {
  const karte = (erreicht: boolean): string =>
    renderToStaticMarkup(
      createElement(HofpreisStichtag, {
        daten: { tag: '2027-02-01', stichtagIso: '2027-02-01T00:00:00.000+01:00', erreicht, jetzt: '2027-03-03T07:42:00.000Z' },
      })
    )

  it('erreicht: „Seit diesem Tag gilt …“, ohne „Vorher bleibt alles wie heute.“, Feld gesperrt, kein Knopf', () => {
    const html = karte(true)
    expect(html).toContain('Seit diesem Tag gilt für neue Bestellungen die Plattformgebühr im Hofpreis')
    expect(html).not.toContain('Vorher bleibt alles wie heute.')
    expect(html).not.toContain('Ab diesem Tag')
    expect(html).toContain('Der Stichtag ist erreicht – er lässt sich nicht mehr ändern.')
    expect(html).not.toContain('Stichtag speichern')
  })

  it('Gegenprobe: vor dem Stichtag der Satz von heute mit „Vorher bleibt alles wie heute.“ und dem Knopf', () => {
    const html = karte(false)
    expect(html).toContain('Ab diesem Tag gilt für neue Bestellungen die Plattformgebühr im Hofpreis')
    expect(html).toContain('Vorher bleibt alles wie heute.')
    expect(html).toContain('Stichtag speichern')
  })
})
