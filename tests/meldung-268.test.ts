/**
 * Nr. 268 (Nachtlauf 33): Meldungs-Bausteine nach den Boards — EIN Baustein mit Variante je Welt
 * (Auftrag a010 Z. 159, 177, 380–383): /problem-melden folgt dem Kunden-Board s3-/w3-problem-melden,
 * /fehler-melden und /meldungen dem Hof-Board s2-/w2-meldungen. Die Zeilen stehen in der Liste
 * Lauf 32 (docs/nachtlauf/berichte/lauf32-board-oder-code.md, „problem-melden“ und „meldungen“) und
 * in der Abnahme Lauf 32 (problem-melden ab Z. 1805, meldungen ab Z. 1035).
 *
 * Die Bot-Bremse (Honigtopf, Zeitschranke, stiller Scheinerfolg; Register N46) und die Felder bleiben;
 * hier geht es nur um Aussehen, Reihenfolge und den Feldfehler-Satz.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/actions/meldung', () => ({ meldungAbsenden: vi.fn() }))
vi.mock('@/components/shared/image-upload', () => ({
  useImageUpload: () => ({ fileInput: null, openFilePicker: () => {}, isUploading: false, progress: null }),
  stufenText: () => '',
}))

import { MELDUNG_ANSICHT_TEXT, MeldungFormularAnsicht } from '@/components/ui/meldung-formular-ansicht'
import { kennungZumSenden, type MeldungFormular } from '@/components/shared/use-meldung-formular'
import { MeineMeldungen } from '@/components/hof-hilfe/meine-meldungen'
import { meldungEingabeSchema } from '@/schemas/meldung'
import { RUNDUNG } from '@/components/ui/rundung'
import type { MeldungZeile } from '@/lib/hof-hilfe'

function formular(teil: Partial<MeldungFormular> = {}): MeldungFormular {
  return {
    art: 'FEHLER',
    setArt: () => {},
    text: '',
    setText: () => {},
    kennung: '',
    setKennung: () => {},
    email: '',
    setEmail: () => {},
    screenshotUrl: null,
    setScreenshotUrl: () => {},
    website: '',
    setWebsite: () => {},
    fehler: '',
    kurznummer: null,
    isPending: false,
    kontext: { seiteUrl: '', userAgent: '', viewport: '' },
    upload: { fileInput: null, openFilePicker: () => {}, isUploading: false, progress: null } as unknown as MeldungFormular['upload'],
    absenden: () => {},
    nochEtwas: () => {},
    ...teil,
  }
}

const ansicht = (welt: 'hof' | 'kunde', alsHof: boolean, teil: Partial<MeldungFormular> = {}) =>
  renderToStaticMarkup(
    createElement(MeldungFormularAnsicht, {
      formular: formular(teil),
      welt,
      alsHof,
      abbrechenHref: welt === 'hof' ? '/meldungen' : '/',
      titel: welt === 'kunde' ? 'Problem melden' : undefined,
      hofName: alsHof ? 'Hof Müller' : undefined,
    })
  )

/** Die Klassen des Elements mit dieser id. */
function klassenVon(html: string, id: string): string {
  const treffer = html.match(new RegExp(`<[a-z]+[^>]*id="${id}"[^>]*>`))
  expect(treffer, id).not.toBeNull()
  return treffer![0].match(/class="([^"]*)"/)?.[1] ?? ''
}

describe('Meldeformular nach den Boards (Nr. 268)', () => {
  it('„Worum geht es?“: drei Karten je 64 px in beiden Welten (Liste problem-melden „Auswahlkarten 46 statt 64 px“, meldungen „Auswahlzeilen niedriger“)', () => {
    for (const welt of ['kunde', 'hof'] as const) {
      const html = ansicht(welt, welt === 'hof')
      expect(html.match(/min-h-16/g), welt).toHaveLength(3)
      expect(html, welt).not.toContain('min-h-12 gap-2 px-3')
    }
  })

  it('Auswahlpunkt als eigener Kreis: gewählt gefüllt im Ton der Welt, auch im Dunkeln (Liste „Auswahlpunkt im Dunkeln Ring statt gefüllt“)', () => {
    const kunde = ansicht('kunde', false)
    const hof = ansicht('hof', true)
    for (const html of [kunde, hof]) {
      expect(html.match(/<input type="radio"[^>]*class="[^"]*appearance-none[^"]*rounded-full/g)).toHaveLength(3)
      expect(html).not.toMatch(/accent-(accent|primary)/)
    }
    expect(kunde).toContain('checked:bg-zustand-laeuft')
    expect(hof).toContain('checked:bg-status-offen')
  })

  it('Zeichenzähler: Kundschaft rechtsbündig (Board s3/w3), Hof links wie das Board s2/w2', () => {
    expect(klassenVon(ansicht('kunde', false), 'meldung-text-zaehler')).toContain('text-right')
    expect(klassenVon(ansicht('hof', true), 'meldung-text-zaehler')).not.toContain('text-right')
  })

  it('Beschriftungen ganz fett — kein dünner Zusatz in „Fehlernummer (optional)“, „Deine E-Mail · …“ und am Bildschirmfoto', () => {
    for (const [welt, alsHof] of [
      ['kunde', false],
      ['kunde', true],
      ['hof', true],
    ] as const) {
      expect(ansicht(welt, alsHof), `${welt} ${alsHof}`).not.toContain('font-normal')
    }
    expect(ansicht('kunde', false)).toMatch(/<label for="meldung-kennung" class="[^"]*font-semibold[^"]*">Fehlernummer \(optional\)<\/label>/)
  })

  it('Hilfetext zu eckigen Klammern nur im Hofbereich (Liste problem-melden „Hilfetext zu eckigen Klammern“)', () => {
    expect(ansicht('kunde', false)).not.toContain(MELDUNG_ANSICHT_TEXT.fehlernummerHinweis)
    expect(ansicht('kunde', true)).not.toContain(MELDUNG_ANSICHT_TEXT.fehlernummerHinweis)
    expect(ansicht('hof', true)).toContain(MELDUNG_ANSICHT_TEXT.fehlernummerHinweis)
  })

  it('Fehlernummer nur bei „Etwas funktioniert nicht“ — das Feld fehlt bei Wunsch und Frage, und mit ihm die Nummer im Satz', () => {
    for (const welt of ['kunde', 'hof'] as const) {
      expect(ansicht(welt, welt === 'hof'), welt).toContain('id="meldung-kennung"')
      for (const art of ['WUNSCH', 'FRAGE'] as const) {
        const html = ansicht(welt, welt === 'hof', { art, kennung: '3141592653' })
        expect(html, `${welt} ${art}`).not.toContain('id="meldung-kennung"')
        expect(html, `${welt} ${art}`).not.toContain('3141592653')
      }
    }
  })

  it('… und sie geht dann auch nicht mit: kennungZumSenden schickt die Nummer nur bei FEHLER', () => {
    expect(kennungZumSenden('FEHLER', 'A7F3')).toBe('A7F3')
    expect(kennungZumSenden('WUNSCH', 'A7F3')).toBe('')
    expect(kennungZumSenden('FRAGE', 'A7F3')).toBe('')
    const hook = readFileSync('src/components/shared/use-meldung-formular.ts', 'utf8')
    expect(hook).toMatch(/diagKennung: kennungZumSenden\(art, kennung\)/)
  })

  it('angemeldeter Hof auf /problem-melden: Satz statt Karte, Bildschirmfoto nach der Fehlernummer, gestrichelt, links, ohne „(optional)“ (Board s3/w3 Bild 4)', () => {
    const html = ansicht('kunde', true)
    expect(html).not.toContain(MELDUNG_ANSICHT_TEXT.mitgeschicktTitel)
    expect(html).toContain('Mitgeschickt: Seite, Gerät und dein Hof')
    const knopf = html.match(/<button type="button"[^>]*>[^<]*<span>\+ Bildschirmfoto hinzufügen<\/span><\/button>/)
    expect(knopf).not.toBeNull()
    expect(knopf![0]).toContain('border-dashed')
    expect(knopf![0]).toContain('justify-start')
    expect(html.indexOf('id="meldung-kennung"')).toBeLessThan(html.indexOf('Bildschirmfoto hinzufügen'))
    expect(html).not.toContain('(optional)</span>')
  })

  it('Hofbereich: Bildschirmfoto vor der Fehlernummer mit „(optional)“, die Karte „Das schicken wir automatisch mit“ (Board s2/w2)', () => {
    const html = ansicht('hof', true)
    expect(html).toContain(`${MELDUNG_ANSICHT_TEXT.bildschirmfoto} ${MELDUNG_ANSICHT_TEXT.optional}`)
    expect(html.indexOf('Bildschirmfoto hinzufügen')).toBeLessThan(html.indexOf('id="meldung-kennung"'))
    expect(html).toContain(MELDUNG_ANSICHT_TEXT.mitgeschicktTitel)
  })

  it('Hofbereich: das Formular liegt auch im Web frei auf dem Grund (Abnahme Lauf 32 meldungen Punkt 8, Board w2)', () => {
    const form = ansicht('hof', true).match(/<form[^>]*class="([^"]*)"/)![1]
    expect(form).not.toMatch(/bg-card|border/)
    const kunde = ansicht('kunde', false).match(/<form[^>]*class="([^"]*)"/)![1]
    expect(kunde).toContain('bg-card')
  })

  it('zwei Knopf-Rundungen der Kundschaft über RUNDUNG: „Abbrechen“ und „Absenden“ 52 px mit 12 px, keine Pille (Nacharbeit 251)', () => {
    const html = ansicht('kunde', false)
    expect(html).not.toContain('rounded-full"')
    expect(html).not.toMatch(/md:rounded-full|rounded-full [^"]*min-h-11|min-h-11[^"]*rounded-full/)
    const abbrechen = html.match(/<a href="\/"[^>]*>Abbrechen<\/a>/)![0]
    const absenden = html.match(/<button type="submit"[^>]*>Absenden<\/button>/)![0]
    for (const knopf of [abbrechen, absenden]) {
      expect(knopf).toContain(RUNDUNG.karte)
      expect(knopf).toContain('min-h-[52px]')
      expect(knopf).not.toContain('rounded-full')
    }
    const danke = ansicht('kunde', false, { kurznummer: '4F8M2Q' })
    const noch = danke.match(/<button type="button"[^>]*>Noch etwas melden<\/button>/)![0]
    expect(noch).toContain(RUNDUNG.karte)
    expect(noch).toContain('min-h-[52px]')
    expect(noch).not.toContain('rounded-full')
  })

  it('Danke-Seite: Kurznummer in Mono, sechs Zeichen groß (G14, seit Nr. 263)', () => {
    const danke = ansicht('kunde', false, { kurznummer: '4F8M2Q' })
    expect(danke).toContain('<strong class="font-mono">4F8M2Q</strong>')
  })

  it('Feldfehler wörtlich nach Board s2-/w2-meldungen Bild 2 (Abnahme Lauf 32 meldungen Punkt 6)', () => {
    const ergebnis = meldungEingabeSchema.shape.text.safeParse('Drucken')
    expect(ergebnis.success).toBe(false)
    expect(ergebnis.error!.issues[0].message).toBe('Schreib bitte etwas mehr – mindestens 10 Zeichen, damit wir die Stelle finden.')
  })

  it('Bot-Bremse bleibt (Register N46): Honigtopf im Formular beider Welten', () => {
    for (const welt of ['kunde', 'hof'] as const) expect(ansicht(welt, welt === 'hof'), welt).toContain('name="website"')
  })
})

describe('Meine Meldungen nach Board s2-/w2-meldungen Bild 4 (Nr. 268)', () => {
  const zeilen: MeldungZeile[] = [
    { id: 'm1', kurznummer: '4F8M2Q', art: 'Fehler', artTon: 'offen', titel: 'Die Packliste druckt doppelt.', datum: 'Heute', status: 'Eingegangen', statusTon: 'neutral', antwort: null },
    { id: 'm2', kurznummer: '7K2QAB', art: 'Frage', artTon: 'neutral', titel: 'Wann kommt die Abrechnung?', datum: 'Gestern', status: 'Beantwortet', statusTon: 'fertig', antwort: 'Am Monatsersten.' },
  ]
  const html = renderToStaticMarkup(createElement(MeineMeldungen, { zeilen }))

  it('die Art steht als Marke vor dem Tag (Abnahme Lauf 32 meldungen Punkt 4)', () => {
    expect(html).toMatch(/data-slot="status-badge" data-status="offen"[^>]*>(?:(?!<\/span><\/span>).)*Fehler/)
    expect(html.match(/data-slot="status-badge"/g)).toHaveLength(4)
  })

  it('„Neue Meldung“ im Web oben rechts im Kopf, am Handy über der Liste (Abnahme Lauf 32 meldungen Punkt 5; Liste C „+ Neue Meldung“)', () => {
    const links = html.match(/<a href="\/fehler-melden"[^>]*>/g) ?? []
    expect(links).toHaveLength(2)
    expect(links.some((l) => l.includes('hidden') && l.includes('md:inline-flex'))).toBe(true)
    expect(links.some((l) => l.includes('md:hidden'))).toBe(true)
  })
})
