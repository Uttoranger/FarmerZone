// @vitest-environment jsdom
/**
 * System-Boards nach der Abnahme Lauf 32 (Nr. 279): abmelden, neuigkeiten, widerruf, fehlerseiten, rechtstexte.
 *
 * Beweist, je mit Gegenprobe:
 *  - abmelden Bild 2: „Erfolgreich abgemeldet“ steht im grün getönten Erfolgskasten mit Häkchen-Kreis, als h1;
 *    der ungültige Link bleibt die Karte mit Warnüberschrift.
 *  - neuigkeiten Bild 2: Nach „Anmeldung bestätigen“ steht der Erfolgskasten, „Zu <Hof>“ ist ein Textlink (kein
 *    Knopf) und der Fokus liegt auf dem Kasten, der wie seine Überschrift heißt.
 *  - widerruf Bild 1: Unter „Die ganze Bestellung“ die Positionen als Liste mit Häkchen — nur gezeigt, kein Feld
 *    (kein `input`); ohne Link keine Liste.
 *  - fehlerseiten Bild 5: Die Fehlergrenze des Hofbereichs zeigt am Handy den Kopf des Bereichs („Heute“) — ohne
 *    zweite h1; auf einem Pfad außerhalb der Ordnung keinen.
 *  - rechtstexte: „Drucken/Speichern“ ohne Symbol, „Inhalt“ mit Dreieck statt Chevron, die Verzeichnis-Karte rollt
 *    nie innen, Fließtext in Textfarbe.
 */
import { createElement, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pfad = vi.hoisted(() => ({ jetzt: '/dashboard' }))
vi.mock('next/navigation', () => ({ usePathname: () => pfad.jetzt, useParams: () => ({}) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
const abo = vi.hoisted(() => ({ bestaetige: vi.fn() }))
vi.mock('@/server/actions/subscriptions', () => ({ bestaetigeNeuigkeiten: abo.bestaetige, unsubscribeWithToken: vi.fn() }))
vi.mock('@/server/actions/widerruf', () => ({ reicheWiderrufMitLinkEin: vi.fn(), reicheWiderrufOhneLinkEin: vi.fn() }))

import { AbmeldenKarte } from '@/app/account/unsubscribe/abmelden-karte'
import { AboBestaetigenKarte } from '@/components/abo-bestaetigung/bestaetigen-karte'
import { ZU_HOF_LINK } from '@/components/abo-bestaetigung/stil'
import { ABO_TEXT } from '@/lib/abo-bestaetigung'
import { WiderrufFormular } from '@/app/(public)/widerruf/widerruf-formular'
import { WIDERRUF_TEXT } from '@/lib/widerruf'
import HofFehler from '@/app/(hof)/error'
import { SeiteDrucken } from '@/components/rechtstexte/seite-drucken'
import { RechtstextVorlage } from '@/components/shared/rechtstext-vorlage'
import { INFOSEITE_TEXT } from '@/components/shared/infoseite-stil'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let wurzel: Root | null = null
afterEach(async () => {
  await act(async () => wurzel?.unmount())
  wurzel = null
  document.body.innerHTML = ''
})

/** Die Angaben der Abmelde-Karte samt Inhalt (als Wert, wie in tests/system-rechtsrahmen-254.test.ts). */
function karte(ton: 'gruen' | 'orange', titel: string): ComponentProps<typeof AbmeldenKarte> {
  return { ton, titel, children: 'Satz' }
}

describe('abmelden: Erfolgskasten (Bild 2)', () => {
  it('„Erfolgreich abgemeldet“ im grünen Kasten mit Häkchen-Kreis, als h1', () => {
    const html = renderToStaticMarkup(createElement(AbmeldenKarte, karte('gruen', 'Erfolgreich abgemeldet')))
    expect(html).toContain('data-slot="erfolg-kasten"')
    expect(html).toContain('lucide-check')
    expect(html).toMatch(/<h1[^>]*>Erfolgreich abgemeldet<\/h1>/)
  })
  it('Gegenprobe: der ungültige Link bleibt die Karte ohne Kasten, Überschrift in der Warnfarbe', () => {
    const html = renderToStaticMarkup(createElement(AbmeldenKarte, karte('orange', 'Link ungültig')))
    expect(html).not.toContain('data-slot="erfolg-kasten"')
    expect(html).toMatch(/<h1 class="[^"]*text-status-offen[^"]*">Link ungültig<\/h1>/)
  })
})

describe('neuigkeiten: Erfolgskasten und „Zu <Hof>“ als Textlink (Bild 2)', () => {
  const bilder: (() => void)[] = []
  beforeEach(() => {
    abo.bestaetige.mockReset()
    bilder.length = 0
    // Wie im Browser: Das nächste Bild kommt nach dem Rendern — der Test löst es selbst aus.
    vi.stubGlobal('requestAnimationFrame', (f: () => void) => bilder.push(f))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('nach dem Bestätigen: Kasten mit Häkchen, Textlink zum Hof, Fokus auf dem Kasten', async () => {
    abo.bestaetige.mockResolvedValue({ ok: true })
    const ziel = document.createElement('div')
    document.body.appendChild(ziel)
    wurzel = createRoot(ziel)
    await act(async () => wurzel!.render(createElement(AboBestaetigenKarte, { token: 't', hofName: 'Hof Müller', hofSlug: 'hof-mueller' })))
    // Gegenprobe vorher: kein Kasten, der grüne Knopf zum Bestätigen.
    expect(ziel.querySelector('[data-slot="erfolg-kasten"]')).toBeNull()
    await act(async () => ziel.querySelector('button')!.click())
    await act(async () => bilder.splice(0).forEach((f) => f()))

    const kasten = ziel.querySelector('[data-slot="erfolg-kasten"]')
    expect(kasten).not.toBeNull()
    expect(kasten!.textContent).toContain(ABO_TEXT.danke)
    const link = kasten!.querySelector('a[href="/hof-mueller"]')
    expect(link?.textContent).toBe('Zu Hof Müller')
    expect(link?.className).toBe(ZU_HOF_LINK)
    expect(link?.className).toContain('underline')
    expect(link?.className).not.toContain('bg-accent')
    const bereich = ziel.querySelector('section[aria-labelledby="abo-titel"]') as HTMLElement
    expect(document.getElementById('abo-titel')?.textContent).toBe(ABO_TEXT.danke)
    expect(document.activeElement).toBe(bereich)
  })
})

describe('widerruf: Positionsliste mit Häkchen unter „Die ganze Bestellung“ (Bild 1)', () => {
  const bestellung = {
    bestellung: 'b',
    sig: 's',
    bestellnummer: 'HM-0001',
    name: 'Franz Müller',
    hof: 'Hof Müller',
    positionen: [
      { id: 'p1', text: '2× Bergkäse (250 g)', hinweis: 'H1' },
      { id: 'p2', text: '4× Heumilch frisch (1 L)', hinweis: 'H2' },
    ],
  }
  it('mit Link: die Positionen als Liste mit Häkchen, ohne Eingabefeld', () => {
    const ziel = document.createElement('div')
    ziel.innerHTML = renderToStaticMarkup(createElement(WiderrufFormular, { bestellung }))
    const liste = ziel.querySelector(`ul[aria-label="${WIDERRUF_TEXT.ganz}"]`)
    expect(liste).not.toBeNull()
    expect([...liste!.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['2× Bergkäse (250 g)H1', '4× Heumilch frisch (1 L)H2'])
    expect(liste!.querySelectorAll('.lucide-check')).toHaveLength(2)
    expect(liste!.querySelector('input')).toBeNull()
    // Kein Kästchen, solange die ganze Bestellung gewählt ist.
    expect(ziel.querySelector('input[type="checkbox"]')).toBeNull()
  })
  it('Gegenprobe: ohne Link keine Liste', () => {
    const html = renderToStaticMarkup(createElement(WiderrufFormular, { bestellung: null }))
    expect(html).not.toContain(`aria-label="${WIDERRUF_TEXT.ganz}"`)
  })
})

describe('fehlerseiten: Kopf des Bereichs auf der Hof-Fehlerseite (Bild 5)', () => {
  const fehler = Object.assign(new Error('Kaputt'), { digest: 'ab12' })
  it('auf /dashboard: „Heute“ über der Fehlerkarte, nur eine h1', () => {
    pfad.jetzt = '/dashboard'
    const html = renderToStaticMarkup(createElement(HofFehler, { error: fehler, reset: () => {} }))
    expect(html).toMatch(/<p class="[^"]*font-heading[^"]*">Heute<\/p>/)
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html.indexOf('>Heute</p>')).toBeLessThan(html.indexOf('<h1'))
  })
  it('Gegenprobe: auf einem Pfad außerhalb der Ordnung kein Kopf', () => {
    pfad.jetzt = '/gibt-es-nicht'
    const html = renderToStaticMarkup(createElement(HofFehler, { error: fehler, reset: () => {} }))
    expect(html).not.toContain('font-heading text-[20px]')
  })
})

describe('rechtstexte: Knopf, Dreieck, geschlossene Karte, Textfarbe', () => {
  it('„Drucken/Speichern“ ohne Symbol', () => {
    const html = renderToStaticMarkup(createElement(SeiteDrucken, null, 'Drucken/Speichern'))
    expect(html).not.toContain('<svg')
    expect(html).toContain('>Drucken/Speichern</button>')
  })
  it('„Inhalt“ mit Dreieck statt Chevron; die Verzeichnis-Karte klebt und rollt nicht', () => {
    const vorlage: ComponentProps<typeof RechtstextVorlage> = {
      titel: 'AGB',
      stand: 'Fassung 1.0',
      drucken: true,
      verzeichnis: { kennung: 'inhalt', zusammenfassung: '1 Abschnitt', gruppen: [{ eintraege: [{ anker: 'a', text: 'Eins', nummer: 1 }] }] },
      children: createElement('p', null, 'Text'),
    }
    const html = renderToStaticMarkup(
      createElement(RechtstextVorlage, vorlage)
    )
    expect(html).toContain('▾')
    expect(html).not.toContain('lucide-chevron-down')
    expect(html).not.toContain('overflow-y-auto')
    expect(html).not.toMatch(/<nav[^>]*sticky/)
    // Gegenprobe: das Verzeichnis ist da (Spalte und Handy).
    expect(html.match(/href="#a"/g)).toHaveLength(2)
  })
  it('Fließtext in Textfarbe, nicht leise', () => {
    expect(INFOSEITE_TEXT).toContain('text-foreground')
    expect(INFOSEITE_TEXT).not.toContain('text-muted-foreground')
  })
})
