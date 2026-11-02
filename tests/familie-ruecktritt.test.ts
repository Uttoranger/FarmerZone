/**
 * Rücktritts-Angaben im Familien-Formular (Nr. 218, Nacharbeit zu Nr. 214):
 * neues Futter und neues Brennmaterial mit Verkaufsgrößen tragen dieselben
 * zwei Felder wie das Produktformular — derselbe Baustein, dieselben Texte
 * (src/lib/ruecktritt-angaben.ts), kein zweiter Text.
 *
 * Beweist:
 *  - der Abschnitt zeigt Haken und Euro-Feld mit den Texten der einen Quelle,
 *    44 px Klickfläche; der Fehlersatz hängt mit aria am Feld (Gegenprobe ohne
 *    Fehler: die Hilfe);
 *  - beide Formulare setzen den Abschnitt ein und schicken beide Werte mit,
 *    keines schreibt die Texte selbst (Gegenprobe: die Quelle hat sie);
 *  - die Vorbelegung beim Anlegen: bei keiner Kategorie dieser Formulare
 *    startet der Haken gesetzt — dieselbe Regel wie im Produktdialog.
 * Das Schreiben prüfen tests/produktfamilie-aktion.test.ts und
 * tests/integration/futter-familie.int.test.ts, das Schema
 * tests/produktfamilie-schema.test.ts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RuecktrittAbschnitt } from '@/components/produkte/familien-teile'
import { RUECKTRITT_TEXT, keinRuecktrittNachKategoriewechsel, keinRuecktrittVorbelegung } from '@/lib/ruecktritt-angaben'
import { FUTTER_KATEGORIEN } from '@/schemas/produktfamilie'
import { FREIWILLIG } from '@/lib/profil-meldungen'

const lies = (datei: string): string => fs.readFileSync(path.resolve(__dirname, '..', datei), 'utf8')

/** Wie React die Texte ins HTML schreibt (Anführungszeichen, Ampersand). */
const alsHtml = (text: string): string => renderToStaticMarkup(createElement('span', null, text)).slice(6, -7)

const abschnitt = (wert: { keinRuecktritt: boolean; ruecksendekostenCents: number | null }, fehler?: string): string =>
  renderToStaticMarkup(createElement(RuecktrittAbschnitt, { id: 'test-ruecktritt', wert, onWert: () => undefined, fehler }))

/** Das Euro-Feld als Tag — die Reihenfolge der Attribute legt der Baustein fest, nicht der Test. */
const euroFeld = (html: string): string => html.match(/<input[^>]*id="feld-ruecksendekostenCents"[^>]*>/)?.[0] ?? ''

const FORMULARE = ['src/components/produkte/futter-formular.tsx', 'src/components/produkte/brennmaterial-formular.tsx'] as const

describe('Der Abschnitt „Rücktritt“ im Familien-Formular', () => {
  it('Haken und Euro-Feld mit den Texten aus ruecktritt-angaben.ts, 44 px, Betrag deutsch geschrieben', () => {
    const html = abschnitt({ keinRuecktritt: true, ruecksendekostenCents: 2550 })

    expect(html).toContain(`>${RUECKTRITT_TEXT.abschnitt}</h3>`)
    for (const text of [RUECKTRITT_TEXT.keinRuecktritt, RUECKTRITT_TEXT.keinRuecktrittErklaerung, RUECKTRITT_TEXT.ruecksendekostenErklaerung]) {
      expect(html).toContain(alsHtml(text))
    }
    expect(html).toContain(alsHtml(`${RUECKTRITT_TEXT.ruecksendekosten} ${FREIWILLIG}`))
    expect(html).toMatch(/<input type="checkbox"[^>]*name="keinRuecktritt" checked=""/)
    expect(euroFeld(html)).toContain('value="25,50"')
    expect(euroFeld(html)).toContain('text-base')
    expect(html).toMatch(/<label[^>]*for="feld-ruecksendekostenCents"/)
    expect(html).toContain('min-h-11')
  })

  it('mit Fehler: der Satz unter dem Feld, das Feld ist ungültig und zeigt auf ihn', () => {
    const html = abschnitt({ keinRuecktritt: false, ruecksendekostenCents: Number.NaN }, RUECKTRITT_TEXT.betragUngueltig)

    expect(euroFeld(html)).toContain('aria-invalid="true"')
    expect(euroFeld(html)).toContain('aria-describedby="feld-ruecksendekostenCents-fehler"')
    expect(html).toContain(`id="feld-ruecksendekostenCents-fehler" role="alert"`)
    expect(html).toContain(alsHtml(RUECKTRITT_TEXT.betragUngueltig))
  })

  it('Gegenprobe: ohne Fehler und ohne Angabe — kein Haken, Feld leer, Hilfe statt Fehler', () => {
    const html = abschnitt({ keinRuecktritt: false, ruecksendekostenCents: null })

    expect(html).not.toContain('checked=""')
    expect(euroFeld(html)).toContain('value=""')
    expect(html).not.toContain('aria-invalid="true"')
    expect(html).not.toContain('role="alert"')
    expect(euroFeld(html)).toContain('aria-describedby="feld-ruecksendekostenCents-hilfe"')
  })
})

describe('Beide Formulare tragen die zwei Felder (anlegen)', () => {
  it.each(FORMULARE)('%s: setzt den Abschnitt ein und schickt Haken und Schätzung mit', (datei) => {
    const formular = lies(datei)

    expect(formular).toMatch(/<RuecktrittAbschnitt\s[\s\S]{0,300}?fehler=\{fehler\.ruecksendekostenCents\}/)
    expect(formular).toContain('keinRuecktritt: ruecktritt.keinRuecktritt,')
    expect(formular).toContain('ruecksendekostenCents: ruecktritt.ruecksendekostenCents,')
    expect(formular).toContain('keinRuecktrittVorbelegung(')
  })

  it.each(FORMULARE)('%s: schreibt keinen Text des Abschnitts selbst', (datei) => {
    const formular = lies(datei)
    for (const text of ['Verdirbt schnell', 'zurückschickt', 'Rücksendekosten']) expect(formular).not.toContain(text)
  })

  it('Gegenprobe: die Wörter stehen in der einen Quelle', () => {
    const quelle = lies('src/lib/ruecktritt-angaben.ts')
    for (const text of ['Verdirbt schnell', 'zurückschickt']) expect(quelle).toContain(text)
  })

  it('Futter: ein Kategoriewechsel geht über dieselbe Regel wie im Produktdialog (nur beim Anlegen)', () => {
    expect(lies('src/components/produkte/futter-formular.tsx')).toMatch(/keinRuecktrittNachKategoriewechsel\(\{ anlegen: true,/)
  })
})

describe('Vorbelegung beim Anlegen (Nr. 214, für Familien seit Nr. 218)', () => {
  it('keine Futter-Kategorie und kein Brennmaterial startet mit gesetztem Haken', () => {
    expect(FUTTER_KATEGORIEN.map(keinRuecktrittVorbelegung)).toEqual(FUTTER_KATEGORIEN.map(() => false))
    expect(keinRuecktrittVorbelegung('BRENNHOLZ')).toBe(false)
  })

  it('Gegenprobe: ein selbst gesetzter Haken bleibt beim Wechsel zwischen Futter-Kategorien stehen', () => {
    expect(keinRuecktrittNachKategoriewechsel({ anlegen: true, aktuell: true, alt: 'HEU_STROH', neu: 'GETREIDE_KOERNER' })).toBe(true)
    expect(keinRuecktrittVorbelegung('FLEISCH')).toBe(true)
  })
})
