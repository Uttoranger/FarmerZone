/**
 * /register: der Satz der Gründungsaktion wörtlich wie das Board (Nr. 282, Antwort 4 im
 * Zwischen-Morgenbericht 33 B: „Board gilt (‚12 Monate keine Grundgebühr‘)“).
 *
 * Der Board-Satz (docs/mockups/redesign-2026-11/s2-registrieren.dc.html und w2-registrieren.dc.html, Bild 1):
 *   „Gründungshöfe zahlen 12 Monate keine Grundgebühr – auch im Hofladen. Noch 8 von 12 Plätzen, Zusage mit
 *   der Freischaltung.“
 * Er steht schon im Code (GRUENDUNG_TEXT.preiszeile, Art „aktion“) und erscheint von selbst, sobald die
 * Zusagen festgeschrieben sind (`festAm` gesetzt). Vorher (Art „bisher“) wäre „12 Monate“ eine falsche
 * Zusage — dann bleibt der feste Stichtag „bis 31. Dezember 2027“. Geändert wird hier nichts, nur festgehalten.
 *
 * Beweist:
 *  - Art „aktion“ mit 12 Monaten aus der Einstellung: der Satz für /register ist der Board-Satz (nur die
 *    Zahlen der Plätze aus der Einstellung), auch gerendert über GruendungZeile.
 *  - Gegenprobe Art „bisher“ (festAm null): „bis 31. Dezember 2027 keine Grundgebühr“, kein „12 Monate“.
 *  - Festgehalten, wie es heute ist: Unter 10 vergebenen Plätzen (GRUENDUNG_ZAEHLER_AB) steht „Die ersten
 *    12 Höfe“ statt des Zählers — das Board zeigt „Noch 8 von 12“ (Bericht 282, Offen).
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  GRUENDUNG_EINSTELLUNG_STANDARD,
  GRUENDUNG_TEXT,
  seitenZahlen,
  type GruendungEinstellung,
  type GruendungSeiten,
} from '@/lib/gruendungshof'
import { GruendungZeile } from '@/app/(auth)/register/gruendung-zeile'

const JETZT = new Date('2026-11-09T10:00:00+01:00')
const FEST: GruendungEinstellung = {
  ...GRUENDUNG_EINSTELLUNG_STANDARD,
  plaetze: 12,
  monate: 12,
  festAm: new Date('2026-11-01T08:00:00Z'),
}

const ohneGeschuetzt = (text: string): string => text.replace(/ /g, ' ')
const satz = (t: { vor: string; betont: string; nach: string }): string => ohneGeschuetzt(`${t.vor}${t.betont}${t.nach}`)
const seiten = (einstellung: GruendungEinstellung, vergeben: number): GruendungSeiten => ({
  ...seitenZahlen(einstellung, vergeben, JETZT),
  voraussichtlicherPlatz: null,
})
const text = (html: string): string =>
  ohneGeschuetzt(html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&'))

describe('/register: Satz der Gründungsaktion wie das Board (Art „aktion“, 12 Monate)', () => {
  it('der Board-Satz wörtlich, mit dem Zähler aus der Einstellung', () => {
    const g = seiten(FEST, 10)
    expect(g).toMatchObject({ art: 'aktion', monate: 12, zeigen: true, zaehler: true })
    expect(satz(GRUENDUNG_TEXT.preiszeile(g))).toBe(
      'Gründungshöfe zahlen 12 Monate keine Grundgebühr – auch im Hofladen. Noch 2 von 12 Plätzen, Zusage mit der Freischaltung.'
    )
    expect(GRUENDUNG_TEXT.preiszeile(g).betont).toBe('Gründungshöfe zahlen 12 Monate keine Grundgebühr')
  })

  it('gerendert über GruendungZeile (die Zeile über dem Formular)', () => {
    const html = renderToStaticMarkup(createElement(GruendungZeile, { gruendung: seiten(FEST, 10) }))
    expect(text(html)).toBe(
      'Gründungshöfe zahlen 12 Monate keine Grundgebühr – auch im Hofladen. Noch 2 von 12 Plätzen, Zusage mit der Freischaltung.'
    )
  })

  it('festgehalten, wie es heute ist: unter 10 vergebenen Plätzen „Die ersten 12 Höfe“ statt „Noch 8 von 12“', () => {
    const g = seiten(FEST, 4)
    expect(g.zaehler).toBe(false)
    expect(satz(GRUENDUNG_TEXT.preiszeile(g))).toBe(
      'Gründungshöfe zahlen 12 Monate keine Grundgebühr – auch im Hofladen. Die ersten 12 Höfe, Zusage mit der Freischaltung.'
    )
  })
})

describe('Gegenprobe: vor dem Festschreiben (Art „bisher“) der feste Stichtag', () => {
  it('„bis 31. Dezember 2027 keine Grundgebühr“, kein „12 Monate“', () => {
    const g = seiten({ ...FEST, festAm: null }, 4)
    expect(g).toMatchObject({ art: 'bisher', zeigen: true })
    const s = satz(GRUENDUNG_TEXT.preiszeile(g))
    expect(s).toBe(
      'Gründungshöfe zahlen bis 31. Dezember 2027 keine Grundgebühr – auch im Hofladen. Noch 8 von 12 Plätzen, Zusage mit der Freischaltung.'
    )
    expect(s).not.toContain('12 Monate')
    const html = renderToStaticMarkup(createElement(GruendungZeile, { gruendung: g }))
    expect(text(html)).toContain('bis 31. Dezember 2027 keine Grundgebühr')
  })
})
