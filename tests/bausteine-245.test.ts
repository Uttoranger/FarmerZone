/**
 * Bausteine aus Lauf 32, Teil 1 (Nr. 245: G1, G2, G3, G8) — gerendert wie auf dem Server.
 *
 * Beweist:
 *  - WerkzeugKopf (G1): Titel immer als h1, Unterzeile darunter, höchstens eine Aktion; auf einer Unterseite
 *    der Rückweg zweimal (Handy „‹“ mit „Zurück zu <Elternseite>“, Web als Textlink) mit Ziel und Name allein
 *    aus `elternseite`, samt Filter der Elternseite; ohne Elternseite kein Rückweg. Die h1 bleibt sichtbar,
 *    auch wenn sie wie die Elternseite heißt (Regel Nr. 56 entfällt). Was das Layout unter den Kopf gibt
 *    (Hof-Balken), steht direkt danach.
 *  - Hinweiskasten / Hof-Balken (G3): ohne Uhr, ohne Zeile „Deine Hof-ID“, ohne Nachsatz; die Hof-ID steckt
 *    nur im vorausgefüllten Mail-Link. Oben blendet sich der Balken aus, sobald die Seite einen
 *    Werkzeug-Kopf trägt; unter dem Kopf nicht.
 *  - FesteAktionsleiste (G2): Hauptknopf, optional „Zurück“ darunter, Platzhalter im Fluss, Merkmale für
 *    Cookie-Hinweis und Scroll-Rand.
 *  - Vorschau: Einhängepunkte 246–248 sind eigene Dateien und rendern zunächst nichts.
 * Gegenproben je Fall: die Merkmale erscheinen in der Variante, die sie trägt.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/settings/profile', useParams: () => ({}) }))

import { UnterDemWerkzeugKopf, WerkzeugKopf, WerkzeugKopfLaden } from '@/components/ui/werkzeug-kopf'
import { Hinweiskasten } from '@/components/ui/hinweiskasten'
import { AKTIONSLEISTE_KNOPF, AKTIONSLEISTE_ZURUECK, FesteAktionsleiste } from '@/components/ui/feste-aktionsleiste'
import { HofBalken, WarteBalken } from '@/components/hofbereich/hof-balken'
import { RUECKWEG_PRAEFIX } from '@/lib/bauern-navigation'
import { warteBalkenText } from '@/lib/farm-approval'
import { Vorschau246 } from '@/app/intern/bausteine/vorschau-246'
import { Vorschau247 } from '@/app/intern/bausteine/vorschau-247'
import { Vorschau248 } from '@/app/intern/bausteine/vorschau-248'

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)
const anzahl = (text: string, teil: string) => text.split(teil).length - 1

describe('WerkzeugKopf (G1)', () => {
  it('auf einer Unterseite: h1, Unterzeile, Rückweg am Handy und im Web aus elternseite', () => {
    const markup = html(createElement(WerkzeugKopf, { titel: 'Hofdaten', unterzeile: 'Hof Test · Stand Mittwoch' }))
    expect(anzahl(markup, '<h1')).toBe(1)
    expect(markup).toContain('>Hofdaten</h1>')
    expect(markup).toContain('Hof Test · Stand Mittwoch')
    // Zwei Wege zur Elternseite (Handy „‹“, Web Textlink), beide mit Ziel und Name aus elternseite.
    expect(anzahl(markup, 'href="/settings"')).toBe(2)
    expect(markup).toContain(`${RUECKWEG_PRAEFIX} Einstellungen`)
    expect(markup).toContain('lucide-chevron-left')
    expect(markup).toContain('data-werkzeug-kopf=""')
  })

  it('behält den Filter der Elternseite im Rückweg', () => {
    const markup = html(createElement(WerkzeugKopf, { titel: 'Bestellung', pfad: '/orders/abc', suche: '?filter=heute' }))
    expect(anzahl(markup, 'href="/orders?filter=heute"')).toBe(2)
  })

  it('ohne Elternseite (Seite der Leiste): kein Rückweg, nur Titel', () => {
    const markup = html(createElement(WerkzeugKopf, { titel: 'Einstellungen', pfad: '/settings' }))
    expect(markup).toContain('>Einstellungen</h1>')
    expect(markup).not.toContain('<a')
    expect(markup).not.toContain(RUECKWEG_PRAEFIX)
  })

  it('die h1 bleibt sichtbar, auch wenn sie wie die Elternseite heißt (Nr. 56 entfällt)', () => {
    const markup = html(createElement(WerkzeugKopf, { titel: 'Problem melden', pfad: '/fehler-melden' }))
    const h1 = markup.slice(markup.indexOf('<h1'), markup.indexOf('</h1>'))
    expect(h1).not.toContain('sr-only')
    // Gegenprobe: der Rückweg selbst trägt den Screenreader-Vorsatz.
    expect(markup).toContain('sr-only')
  })

  it('höchstens eine Aktion rechts — sie steht im Kopf', () => {
    const markup = html(createElement(WerkzeugKopf, { titel: 'Kunde', pfad: '/customers/k1', aktion: createElement('a', { href: 'tel:+436600000000' }, 'Anrufen') }))
    expect(markup).toContain('href="tel:+436600000000"')
  })

  it('was das Layout unter den Kopf gibt (Hof-Balken), steht direkt nach dem Kopf; ohne Anbieter nichts', () => {
    const balken = createElement('p', { 'data-probe': '' }, 'Balken')
    const mit = html(createElement(UnterDemWerkzeugKopf, { inhalt: balken }, createElement(WerkzeugKopf, { titel: 'Hofdaten' })))
    expect(mit.indexOf('data-probe')).toBeGreaterThan(mit.indexOf('</h1>'))
    const laden = html(createElement(UnterDemWerkzeugKopf, { inhalt: balken }, createElement(WerkzeugKopfLaden)))
    expect(laden).toContain('data-probe')
    expect(laden).toContain('data-werkzeug-kopf=""')
    // Gegenprobe: ohne Anbieter kein Balken.
    expect(html(createElement(WerkzeugKopf, { titel: 'Hofdaten' }))).not.toContain('data-probe')
  })
})

describe('Hinweiskasten und Hof-Balken (G3)', () => {
  const wartet = { art: 'wartet' as const, farmId: 'farm_test', farmName: 'Hof Test', country: 'AT', stand: 'einrichten' as const }

  it('wartet: Titel und Satz aus warteBalkenText, Link mit Hof-ID — ohne Uhr, ohne Hof-ID-Zeile, ohne Nachsatz', () => {
    const markup = html(createElement(HofBalken, { balken: wartet }))
    const text = warteBalkenText('einrichten')
    expect(markup).toContain(text.titel)
    expect(markup).toContain('Frage zur Freischaltung stellen')
    expect(markup).toMatch(/href="mailto:[^"]*farm_test/)
    expect(markup).not.toContain('lucide-clock')
    expect(markup).not.toContain('Deine Hof-ID')
    expect(markup).not.toContain('schon eingetragen')
    // Die Hof-ID steht nur im Link, nie als sichtbarer Text.
    expect(markup.replace(/href="[^"]*"/g, '')).not.toContain('farm_test')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('data-hinweiskasten=""')
  })

  it('oben blendet sich der Balken bei einem Werkzeug-Kopf aus, unter dem Kopf nicht', () => {
    const oben = html(createElement(HofBalken, { balken: wartet }))
    const unten = html(createElement(HofBalken, { balken: wartet, lage: 'unter-kopf' }))
    expect(oben).toContain('[main:has([data-werkzeug-kopf])_&amp;]:hidden')
    expect(unten).not.toContain('data-werkzeug-kopf')
  })

  it('stillgelegt: Satz und „Hof reaktivieren“ im Hinweiskasten; ohne Balken nichts', () => {
    const still = html(createElement(HofBalken, { balken: { art: 'stillgelegt' } }))
    expect(still).toContain('href="/settings/account"')
    expect(still).toContain('Hof reaktivieren')
    expect(still).toContain('data-hinweiskasten=""')
    expect(html(createElement(HofBalken, { balken: null }))).toBe('')
  })

  it('der Hinweis für Deutschland bleibt — nur dort', () => {
    const de = html(createElement(WarteBalken, { ...wartet, country: 'DE' }))
    const at = html(createElement(WarteBalken, wartet))
    expect(de.length).toBeGreaterThan(at.length)
  })

  it('Hinweiskasten: Titel, Satz und Aktion in dieser Reihenfolge, ohne Symbol', () => {
    const markup = html(createElement(Hinweiskasten, { titel: 'Titel', aktion: createElement('a', { href: '/x' }, 'Weiter') }, 'Ein Satz.'))
    expect(markup.indexOf('Titel')).toBeLessThan(markup.indexOf('Ein Satz.'))
    expect(markup.indexOf('Ein Satz.')).toBeLessThan(markup.indexOf('Weiter'))
    expect(markup).not.toContain('<svg')
  })
})

describe('FesteAktionsleiste (G2)', () => {
  it('Hauptknopf, „Zurück“ darunter, Platzhalter im Fluss und Merkmale für Cookie-Hinweis und Scroll-Rand', () => {
    const markup = html(
      createElement(
        FesteAktionsleiste,
        { zurueck: createElement('a', { href: '/settings', className: AKTIONSLEISTE_ZURUECK }, '← Zurück') },
        createElement('button', { type: 'submit', className: AKTIONSLEISTE_KNOPF }, 'Speichern')
      )
    )
    expect(markup.indexOf('Speichern')).toBeLessThan(markup.indexOf('← Zurück'))
    expect(markup).toContain('data-unten-fest=""')
    expect(markup).toContain('data-feste-leiste=""')
    expect(markup).toContain('aria-hidden="true"')
    // Gegenprobe: ohne „Zurück“ kein zweiter Knopf.
    const ohne = html(createElement(FesteAktionsleiste, null, createElement('button', { type: 'submit' }, 'Speichern')))
    expect(ohne).not.toContain('Zurück')
  })
})

describe('Vorschau /intern/bausteine', () => {
  it('Einhängepunkte 246–248 sind eigene Dateien, eingebunden in bausteine-vorschau.tsx, zunächst leer (248 gefüllt)', () => {
    const vorschau = readFileSync(join(process.cwd(), 'src/app/intern/bausteine/bausteine-vorschau.tsx'), 'utf8')
    for (const nr of [246, 247, 248]) {
      expect(vorschau).toContain(`from '@/app/intern/bausteine/vorschau-${nr}'`)
      expect(vorschau).toContain(`<Vorschau${nr} />`)
    }
    // Nr. 246, 247 und 248 füllen ihre Einhängepunkte (geprüft in tests/bausteine-246.test.ts, -247.test.ts und -248.test.ts).
    expect(html(createElement(Vorschau246))).toContain('<section')
    expect(html(createElement(Vorschau247))).toContain('id="chip-gruppe-titel"')
    expect(html(createElement(Vorschau248))).not.toBe('')
  })
})
