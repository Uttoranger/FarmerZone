/**
 * Hof-Bausteine nach der Abnahme Lauf 32 (Nr. 269) und das Kästchen (A-8) — gerendert wie auf dem Server.
 *
 * Beweist:
 *  - Rückweg (G1-Rest, Register N1 mit den Ergänzungen vom 7.11.2026): Auswertung, Kunden, Verkäufe und Postfach
 *    haben am Handy „Mehr“ (Ziel Heute), Meine Meldungen „Problem melden“ (das Formular) — je Pfad `nurHandy`;
 *    zielNachSpeichern bleibt, wie es war.
 *  - Werkzeug-Kopf: Die Leiste steht am Handy fest (`fixed`), ein Platz im Fluss hält ihre Höhe — sie hängt an
 *    keinem Elternelement mehr (Seiten setzen den Kopf in ein eigenes `<header>`); ohne Netz klebt sie wie früher.
 *  - Hinweiskasten (G3): der Satz im Warnton wie der Titel; Kontrast aus den Token-Werten in globals.css ≥ 4,5:1
 *    in beiden Themes.
 *  - Umriss-Knopf, Feld, Beschriftung nach Board; Spalte der Einstellungs-Unterseiten 672 px Inhalt.
 *  - LadeFehlerKasten liegt in ui/, der alte Ort reicht denselben Baustein weiter; kanal-symbol.tsx ist weg.
 *  - Kästchen (A-8): natives `<input type="checkbox">`, Angaben unverändert durchgereicht, kein eigener
 *    Ausgangswert, kein `role="checkbox"`; Token-Kontrast (Rand ≥ 3:1, Haken ≥ 4,5:1) in beiden Themes.
 *  - Vorschau: Nr. 269 zeigt ihre Bausteine im eigenen Einhängepunkt.
 * Gegenproben je Fall: die alten Werte bzw. Klassen fielen durch.
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/customers', useParams: () => ({}) }))

import { RUECKWEG_PRAEFIX, elternseite, zielNachSpeichern } from '@/lib/bauern-navigation'
import { WerkzeugKopf, WerkzeugKopfLaden } from '@/components/ui/werkzeug-kopf'
import { WERKZEUG_KOPF_LEISTE, WERKZEUG_KOPF_PLATZ } from '@/components/ui/werkzeug-kopf-stil'
import { HINWEISKASTEN_SATZ, Hinweiskasten } from '@/components/ui/hinweiskasten'
import { FELD, FELD_LABEL, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { RUNDUNG } from '@/components/ui/rundung'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import * as ladeFehlerUi from '@/components/ui/lade-fehler-kasten'
import * as ladeFehlerAlt from '@/components/hof-hilfe/lade-fehler-kasten'
import { KAESTCHEN_FELD, KAESTCHEN_HAKEN, Kaestchen } from '@/components/ui/kaestchen'
import { Vorschau269 } from '@/app/intern/bausteine/vorschau-269'
import { kontrast, leseOklch, oklchZuHex } from '@/lib/farbraum'

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)
const anzahl = (text: string, teil: string) => text.split(teil).length - 1
const WURZEL = process.cwd()

// ─── Token-Werte aus globals.css ─────────────────────────────────────────────

const css = readFileSync(join(WURZEL, 'src/app/globals.css'), 'utf8')
const MODUS = { hell: ':root', dunkel: '[data-theme="dark"]' } as const
type Modus = keyof typeof MODUS

function block(selektor: string): string {
  const start = css.indexOf(`\n${selektor} {`)
  expect(start, `Block „${selektor}" fehlt`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start + 1))
}

/** Der Hexwert eines --fz-Tokens im Modus, aus dem oklch-Wert in globals.css zurückgerechnet. */
function token(name: string, modus: Modus): string {
  const m = block(MODUS[modus]).match(new RegExp(`--fz-${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`--fz-${name} fehlt in ${modus}`)
  const oklch = leseOklch(m[1].trim())
  if (!oklch) throw new Error(`--fz-${name} ist kein oklch`)
  return oklchZuHex(oklch)
}

const MODI: Modus[] = ['hell', 'dunkel']

// ─── Rückweg (G1-Rest) ────────────────────────────────────────────────────────

describe('elternseite — Seiten des Mehr-Blatts haben am Handy einen Rückweg (N1-Ergänzungen 7.11.2026)', () => {
  it.each(['/analytics', '/customers', '/sales', '/postfach'])('%s: „Mehr“, Ziel Heute, nur am Handy', (pfad) => {
    expect(elternseite(pfad)).toEqual({ href: '/dashboard', name: 'Mehr', nurHandy: true })
  })

  it('/meldungen (Meine Meldungen): „Problem melden“, Ziel das Formular, nur am Handy (Board s2-meldungen Bild 4–6)', () => {
    expect(elternseite('/meldungen')).toEqual({ href: '/fehler-melden', name: 'Problem melden', nurHandy: true })
  })

  it('mit Suche und Schrägstrich derselbe Rückweg; Unterseiten der Werkzeuge behalten ihre Elternseite', () => {
    expect(elternseite('/customers/?filter=stamm')).toEqual({ href: '/dashboard', name: 'Mehr', nurHandy: true })
    expect(elternseite('/customers/abc')).toEqual({ href: '/customers', name: 'Kunden' })
    expect(elternseite('/postfach/abc')).toEqual({ href: '/postfach', name: 'Postfach' })
    expect(elternseite('/analytics/umfeld')).toEqual({ href: '/analytics', name: 'Auswertung' })
  })

  it('Gegenprobe: Seiten der Leiste haben weiter keinen Rückweg', () => {
    for (const pfad of ['/dashboard', '/orders', '/products', '/farm-page', '/region']) expect(elternseite(pfad), pfad).toBeNull()
  })
})

describe('zielNachSpeichern bleibt unverändert', () => {
  it('nur Einstellungs-Unterseiten führen zur Übersicht; die neuen Rückwege ändern daran nichts', () => {
    expect(zielNachSpeichern('/settings/profile')).toBe('/settings')
    expect(zielNachSpeichern('/settings/pickup-slots')).toBeNull()
    expect(zielNachSpeichern('/settings')).toBeNull()
    for (const pfad of ['/analytics', '/customers', '/sales', '/postfach', '/meldungen']) expect(zielNachSpeichern(pfad), pfad).toBeNull()
  })
})

describe('WerkzeugKopf steht am Handy fest', () => {
  it('auf /customers: „‹“ am Handy mit „Zurück zu Mehr“, im Web kein Textlink', () => {
    const markup = html(createElement(WerkzeugKopf, { titel: 'Kunden', unterzeile: 'Hof Test · Stand Mittwoch' }))
    expect(anzahl(markup, '<a')).toBe(1)
    expect(markup).toContain('href="/dashboard"')
    expect(markup).toContain(`${RUECKWEG_PRAEFIX} Mehr`)
    expect(markup).toContain('>Kunden</h1>')
  })

  it('die Leiste ist fest oben (fixed), ab 768 px im Fluss; der Platz davor hält ihre Höhe nur am Handy', () => {
    const klassen = WERKZEUG_KOPF_LEISTE.split(' ')
    expect(klassen).toEqual(expect.arrayContaining(['fixed', 'inset-x-0', 'top-0', 'z-40', 'h-14', 'md:static']))
    // Gegenprobe: Der alte Kopf klebte nur im Elternelement (sticky) — in einem eigenen <header> scrollte er weg.
    expect(klassen).not.toContain('sticky')
    expect(WERKZEUG_KOPF_PLATZ.split(' ')).toEqual(expect.arrayContaining(['h-14', '-mt-5', 'mb-3', 'md:hidden']))
    for (const el of [createElement(WerkzeugKopf, { titel: 'Kunden' }), createElement(WerkzeugKopfLaden)]) {
      const markup = html(el)
      expect(markup).toContain('data-werkzeug-kopf-platz=""')
      expect(markup.indexOf('data-werkzeug-kopf-platz')).toBeLessThan(markup.indexOf('data-werkzeug-kopf=""'))
    }
  })

  it('ohne Netz (Zeile in <main>) klebt die Leiste wie früher und der Platz entfällt (N29: die Zeile bleibt sichtbar)', () => {
    const ohneNetz = 'max-md:[main:has([data-netz-hinweis]_p)_&]:'
    expect(WERKZEUG_KOPF_LEISTE).toContain(`${ohneNetz}sticky`)
    expect(WERKZEUG_KOPF_LEISTE).toContain(`${ohneNetz}-mt-5`)
    expect(WERKZEUG_KOPF_PLATZ).toContain(`${ohneNetz}hidden`)
    // Das Merkmal, auf das sich die Klassen beziehen, setzt die Zeile selbst.
    expect(readFileSync(join(WURZEL, 'src/components/ui/netz-hinweis.tsx'), 'utf8')).toContain('data-netz-hinweis=""')
  })
})

// ─── Hinweiskasten (G3) ───────────────────────────────────────────────────────

describe('Hinweiskasten (G3): Satz im Warnton', () => {
  it('Titel und Satz im Warnton status-offen auf der braun getönten Fläche', () => {
    const markup = html(createElement(Hinweiskasten, { titel: 'Dein Hof wird noch geprüft' }, createElement('p', null, 'Bis dahin …')))
    expect(markup).toContain(HINWEISKASTEN_SATZ)
    expect(HINWEISKASTEN_SATZ).toContain('text-status-offen')
    expect(markup).toContain('bg-zustand-tun-grund')
    // Gegenprobe: Der Kasten trägt keine neutrale Textfarbe mehr.
    expect(markup).not.toContain('text-foreground')
  })

  it.each(MODI)('Kontrast status-offen auf zustand-tun-grund ≥ 4,5:1 (%s, Werte aus globals.css)', (modus) => {
    expect(kontrast(token('status-offen', modus), token('zustand-tun-grund', modus))).toBeGreaterThanOrEqual(4.5)
  })

  it('Gegenprobe: das Hof-Orange als Schrift fiele hell durch', () => {
    expect(kontrast(token('primary', 'hell'), token('zustand-tun-grund', 'hell'))).toBeLessThan(4.5)
  })
})

// ─── Knopf, Feld, Beschriftung, Spalte ────────────────────────────────────────

describe('Umriss-Knopf, Feld und Beschriftung nach Board', () => {
  it('KNOPF_RAHMEN: 52 px, 15 px fett, Rand 1,5 px in Textfarbe (wie „So geht’s“)', () => {
    const k = KNOPF_RAHMEN.split(' ')
    expect(k).toEqual(expect.arrayContaining(['min-h-[52px]', 'text-[15px]', 'font-bold', 'border-[1.5px]', 'border-foreground']))
    // Gegenprobe: die alten Werte „niedrig, dünn, blass“ sind fort (cn löst die Pillen-Vorgaben auf).
    for (const alt of ['min-h-11', 'text-sm', 'font-medium', 'font-semibold', 'border-border']) expect(k, alt).not.toContain(alt)
  })

  it('FELD: 48 px, Feldrand, Fläche der Karte, 10 px Rundung, 16 px; FELD_LABEL: 15 px halbfett in Textfarbe', () => {
    const f = FELD.split(' ')
    expect(f).toEqual(expect.arrayContaining(['min-h-12', 'border-input', 'bg-card', 'text-base', RUNDUNG.feld]))
    for (const alt of ['rounded-[11px]', 'border-border', 'md:text-[14.5px]']) expect(f, alt).not.toContain(alt)
    expect(FELD_LABEL.split(' ')).toEqual(expect.arrayContaining(['text-[15px]', 'font-semibold', 'text-foreground']))
    expect(FELD_LABEL).not.toContain('text-muted-foreground')
  })

  it('die Spalte der Einstellungs-Unterseiten ist 672 px Inhalt (Board w2-konto-hof, -hofdaten-zahlung), Polster dazu', () => {
    const breite = (vorsatz: string) => Number(UNTERSEITE_RAHMEN.match(new RegExp(`(?:^| )${vorsatz}max-w-\\[(\\d+)px\\]`))?.[1])
    expect(breite('') - 2 * 32).toBe(672)
    expect(breite('xl:') - 2 * 40).toBe(672)
    expect(UNTERSEITE_RAHMEN).toContain('md:px-8')
    expect(UNTERSEITE_RAHMEN).toContain('xl:px-10')
    // Gegenprobe: max-w-2xl (672 px samt Polster) ließ nur 608 px Inhalt.
    expect(UNTERSEITE_RAHMEN).not.toContain('max-w-2xl')
  })
})

// ─── LadeFehlerKasten, kanal-symbol ───────────────────────────────────────────

describe('LadeFehlerKasten in ui/', () => {
  it('der alte Ort reicht denselben Baustein weiter — keine zweite Kopie', () => {
    expect(ladeFehlerAlt.LadeFehlerKasten).toBe(ladeFehlerUi.LadeFehlerKasten)
    expect(ladeFehlerAlt.LADE_FEHLER_SATZ).toBe(ladeFehlerUi.LADE_FEHLER_SATZ)
    expect(readFileSync(join(WURZEL, 'src/components/hof-hilfe/lade-fehler-kasten.tsx'), 'utf8')).toContain('@altbestand')
  })

  it('zeichnet Titel, Satz und den Ausweg als Link auf dieselbe Adresse', () => {
    const markup = html(createElement(ladeFehlerUi.LadeFehlerKasten, { titel: 'Kunden konnten nicht geladen werden', nochmal: '/customers' }))
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('href="/customers"')
    expect(markup).toContain(ladeFehlerUi.LADE_FEHLER_SATZ)
  })

  it('kanal-symbol.tsx ist gelöscht (ohne Import)', () => {
    expect(existsSync(join(WURZEL, 'src/components/sales/kanal-symbol.tsx'))).toBe(false)
  })
})

// ─── Kästchen (A-8) ───────────────────────────────────────────────────────────

describe('Kästchen (A-8)', () => {
  it('zeichnet ein natives Kästchen und reicht die Angaben unverändert durch', () => {
    const markup = html(
      createElement(Kaestchen, { id: 'k1', name: 'kaeuferArt', value: 'betrieb', required: true, disabled: true, 'aria-describedby': 'hilfe', defaultChecked: true })
    )
    expect(anzahl(markup, '<input')).toBe(1)
    expect(markup).toContain('type="checkbox"')
    for (const teil of ['id="k1"', 'name="kaeuferArt"', 'value="betrieb"', 'required=""', 'disabled=""', 'aria-describedby="hilfe"', 'checked=""']) expect(markup, teil).toContain(teil)
    expect(markup).not.toContain('role="checkbox"')
    expect(markup).toContain('aria-hidden="true"')
  })

  it('setzt nie einen eigenen Ausgangswert', () => {
    const markup = html(createElement(Kaestchen, { name: 'einwilligung' }))
    expect(markup).not.toMatch(/ checked=/)
    // Gegenprobe: mit Angabe des Aufrufers ist es angehakt.
    expect(html(createElement(Kaestchen, { name: 'einwilligung', defaultChecked: true }))).toContain('checked=""')
  })

  it('eigene Tokens, 44 px über ::before, Fokusrahmen, Feldfehler orange', () => {
    const k = KAESTCHEN_FELD.split(' ')
    expect(k).toEqual(
      expect.arrayContaining(['appearance-none', 'border-kaestchen-rand', 'checked:bg-kaestchen-flaeche', 'checked:border-kaestchen-flaeche', 'before:min-h-11', 'before:min-w-11', 'focus-visible:outline-solid', 'aria-[invalid=true]:border-status-offen'])
    )
    expect(KAESTCHEN_HAKEN).toContain('text-kaestchen-haken')
    expect(KAESTCHEN_HAKEN).toContain('peer-checked:opacity-100')
    // Gegenprobe: nicht mehr die Farbe des Browsers über primary.
    expect(KAESTCHEN_FELD).not.toContain('accent-primary')
  })

  it.each(MODI)('Kontrast der Tokens (%s): Rand ≥ 3:1 auf Grund und Fläche, Fläche ≥ 3:1 auf beiden, Haken ≥ 4,5:1 auf der Fläche', (modus) => {
    for (const grund of ['bg', 'surface']) {
      expect(kontrast(token('kaestchen-rand', modus), token(grund, modus)), `Rand auf ${grund}`).toBeGreaterThanOrEqual(3)
      expect(kontrast(token('kaestchen-flaeche', modus), token(grund, modus)), `Fläche auf ${grund}`).toBeGreaterThanOrEqual(3)
    }
    expect(kontrast(token('kaestchen-haken', modus), token('kaestchen-flaeche', modus))).toBeGreaterThanOrEqual(4.5)
  })

  it('Gegenprobe: der Kartenrand als Kästchenrand fiele unter 3:1', () => {
    expect(kontrast(token('border', 'hell'), token('surface', 'hell'))).toBeLessThan(3)
  })
})

// ─── Vorschau ─────────────────────────────────────────────────────────────────

describe('Vorschau (eigener Einhängepunkt)', () => {
  it('zeigt Rückweg, Hinweiskasten, Knopf und Feld, Ladefehler und Kästchen', () => {
    const markup = html(createElement(Vorschau269))
    for (const titel of ['Rückweg der Mehr-Blatt-Seiten (G1)', 'Hinweiskasten im Warnton (G3)', 'Umriss-Knopf, Feld und Beschriftung', 'LadeFehlerKasten (ui/)', 'Kästchen (A-8)']) {
      expect(markup, titel).toContain(titel)
    }
    expect(anzahl(markup, 'type="checkbox"')).toBe(4)
    expect(markup).toContain(`${RUECKWEG_PRAEFIX} Mehr`)
  })
})
