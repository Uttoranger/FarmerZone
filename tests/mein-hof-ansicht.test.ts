/**
 * Tests für die Ansicht von „Mein Hof" unter lg (src/lib/mein-hof-ansicht.ts,
 * Nachtlauf Nr. 49, Register N3/N4).
 *
 * Beweist:
 *  - Der Umschalter heißt „Bearbeiten · So sieht’s die Kundin"; seine Wahl
 *    steht in der Adresse (?ansicht=kundin), Unsinn fällt still auf
 *    „Bearbeiten", die übrigen Parameter bleiben.
 *  - „So sieht’s die Kundin" ist der passende Reiter der echten Hofseite in
 *    der Vorschau (vorschauLink) — Produkte zeigt den Reiter Produkte.
 *  - „Ansehen" von außen führt auf den Reiter von Mein Hof mit der
 *    Kundenansicht, aus derselben Liste wie die Reiter.
 *  - Der Umschalter gilt für Produkte unter md, für Hofseite und Beiträge
 *    unter lg.
 */
import { describe, it, expect } from 'vitest'
import {
  MEIN_HOF_ANSICHT_OPTIONEN,
  MEIN_HOF_ANSICHT_TEXT,
  ansichtAdresse,
  kundenAnsichtAdresse,
  kundinAdresse,
  meinHofAnsichtAus,
  umschalterBis,
} from '@/lib/mein-hof-ansicht'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import { GESPEICHERT_TEXT, MEIN_HOF_REITER_HOFBEREICH } from '@/lib/bauern-navigation'

describe('Texte', () => {
  it('die Wahl heißt „Bearbeiten · So sieht’s die Kundin", in dieser Reihenfolge', () => {
    expect(MEIN_HOF_ANSICHT_OPTIONEN.map((o) => [o.wert, o.label])).toEqual([
      ['bearbeiten', 'Bearbeiten'],
      ['kundin', 'So sieht’s die Kundin'],
    ])
  })

  it('„In neuem Tab öffnen" und „Gespeichert · Ansehen" aus einer Quelle', () => {
    expect(MEIN_HOF_ANSICHT_TEXT.neuerTab).toBe('In neuem Tab öffnen')
    expect(MEIN_HOF_ANSICHT_TEXT.ansehen).toBe('Ansehen')
    // „Gespeichert" ist derselbe Text wie der Toast der Einstellungen.
    expect(MEIN_HOF_ANSICHT_TEXT.gespeichert).toBe(GESPEICHERT_TEXT)
  })
})

describe('meinHofAnsichtAus — die Ansicht aus der Adresse', () => {
  it('nur „kundin" zählt, alles andere ist Bearbeiten', () => {
    expect(meinHofAnsichtAus('kundin')).toBe('kundin')
    expect(meinHofAnsichtAus('bearbeiten')).toBe('bearbeiten')
    for (const wert of [null, '', 'KUNDIN', 'vorschau', '<script>']) expect(meinHofAnsichtAus(wert), String(wert)).toBe('bearbeiten')
  })
})

describe('ansichtAdresse — die Ansicht in die Adresse schreiben', () => {
  it('die übrigen Parameter bleiben, Bearbeiten trägt keinen', () => {
    expect(ansichtAdresse('/farm-page', '', 'kundin')).toBe('/farm-page?ansicht=kundin')
    expect(ansichtAdresse('/farm-page', '?reiter=beitraege', 'kundin')).toBe('/farm-page?reiter=beitraege&ansicht=kundin')
    expect(ansichtAdresse('/farm-page', 'reiter=beitraege&ansicht=kundin', 'bearbeiten')).toBe('/farm-page?reiter=beitraege')
    expect(ansichtAdresse('/products', 'filter=futter&ansicht=kundin', 'bearbeiten')).toBe('/products?filter=futter')
    expect(ansichtAdresse('/products', 'ansicht=kundin', 'bearbeiten')).toBe('/products')
  })
})

describe('kundinAdresse — „Ansehen" von einer anderen Seite aus', () => {
  it('der Reiter von Mein Hof mit der Kundenansicht', () => {
    expect(kundinAdresse('beitraege')).toBe('/farm-page?reiter=beitraege&ansicht=kundin')
    expect(kundinAdresse('hofseite')).toBe('/farm-page?ansicht=kundin')
    expect(kundinAdresse('produkte')).toBe('/products?ansicht=kundin')
  })

  it('aus derselben Liste wie die Reiter — keine zweite Adresse', () => {
    for (const reiter of MEIN_HOF_REITER_HOFBEREICH) {
      const [pfad, suche] = kundinAdresse(reiter.id).split('?')
      const [reiterPfad, reiterSuche = ''] = reiter.href.split('?')
      expect(pfad, reiter.id).toBe(reiterPfad)
      expect(suche, reiter.id).toContain(reiterSuche)
    }
  })
})

describe('kundenAnsichtAdresse — was der Rahmen zeigt', () => {
  it('der passende Reiter der echten Hofseite: Übersicht, Produkte, Beiträge', () => {
    expect(kundenAnsichtAdresse('hof-test', 'hofseite')).toBe('/hof-test?vorschau=1')
    expect(kundenAnsichtAdresse('hof-test', 'produkte')).toBe('/hof-test?vorschau=1&reiter=produkte')
    expect(kundenAnsichtAdresse('hof-test', 'beitraege')).toBe('/hof-test?vorschau=1&reiter=beitraege')
  })

  it('immer die Vorschau der Hofseite (vorschauLink) — kein Nachbau, keine zweite Adresse', () => {
    for (const reiter of MEIN_HOF_REITER_HOFBEREICH) {
      expect(kundenAnsichtAdresse('hof-test', reiter.id).startsWith(vorschauLink('hof-test'))).toBe(true)
    }
  })
})

describe('umschalterBis — wo der Umschalter gilt', () => {
  it('Produkte unter md (dort gehört es zu Mein Hof, N3), Hofseite und Beiträge unter lg (N4)', () => {
    expect(umschalterBis('produkte')).toBe('md')
    expect(umschalterBis('hofseite')).toBe('lg')
    expect(umschalterBis('beitraege')).toBe('lg')
  })
})
