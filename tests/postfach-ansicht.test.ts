/**
 * Das Postfach in der Oberfläche (Register N12, Nr. 87) — serverseitig
 * gerendert, nur Aussagen über Merkmale (TESTING_GUIDELINES §1).
 *
 * Beweist:
 *  - Nachrichtentexte stehen nur als Text da: Markup im Text kommt maskiert an
 *    (Karte auf Heute und Faden) — Gegenprobe: ein harmloser Text steht wörtlich.
 *  - Ein Link, den die Regel nicht erlaubt, wird nie zum Knopf (der Faden
 *    nimmt den Weg aus appPfadAusLink).
 *  - „Gelesen" auf Heute ist ein Formular mit beiden Kennungen; „n weitere im
 *    Postfach" nur, wenn es weitere gibt.
 *  - Im Faden des Hofs trägt die eigene Antwort „gelesen", sobald das Team
 *    sie gelesen hat; das Team steht mit MARKE_TEAM da.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/actions/postfach', () => ({ markiereGelesenFormular: vi.fn() }))

import { PostfachKarte } from '@/components/heute/heute-teile'
import { FadenVerlauf } from '@/app/(hof)/postfach/teile'
import { fadenEintraege, type FadenNachricht, type HeuteNachricht } from '@/lib/postfach'
import { MARKE_TEAM } from '@/lib/marke'

const JETZT = new Date('2026-10-13T10:00:00Z')
const BOESE = '<img src=x onerror=alert(1)>'

function nachricht(abweichend: Partial<HeuteNachricht> = {}): HeuteNachricht {
  return {
    unterhaltungId: 'cuntaaaaaaaaaaaaaaaaaaaa1',
    nachrichtId: 'cnachaaaaaaaaaaaaaaaaaaa1',
    href: '/postfach/cuntaaaaaaaaaaaaaaaaaaaa1',
    titel: 'Erfundener Titel',
    text: 'Erfundener Text.',
    link: '/products',
    wichtig: true,
    wann: 'vor 30 Min.',
    ...abweichend,
  }
}

describe('Karte auf Heute', () => {
  it('Text nur als Text; „Gelesen" als Formular mit beiden Kennungen; „weitere" nur mit weiteren', () => {
    const html = renderToStaticMarkup(createElement(PostfachKarte, { nachricht: nachricht({ text: BOESE, titel: BOESE }), weitere: 2 }))
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('name="unterhaltungId" value="cuntaaaaaaaaaaaaaaaaaaaa1"')
    expect(html).toContain('name="nachrichtId" value="cnachaaaaaaaaaaaaaaaaaaa1"')
    expect(html).toContain('2 weitere im Postfach')
    expect(html).toContain('href="/products"')
    expect(html).toContain(MARKE_TEAM)

    const allein = renderToStaticMarkup(createElement(PostfachKarte, { nachricht: nachricht({ link: null }), weitere: 0 }))
    expect(allein).toContain('Erfundener Text.')
    expect(allein).not.toContain('weitere im Postfach')
    expect(allein).not.toContain('href="/products"')
  })
})

describe('Faden', () => {
  const nachrichten: FadenNachricht[] = [
    { id: 'cn1', vonFarmId: null, text: BOESE, linkUrl: 'javascript:alert(1)', art: 'WICHTIG', createdAt: new Date('2026-10-10T07:00:00Z') },
    { id: 'cn2', vonFarmId: 'cfarm00000000000000000001', text: 'Antwort des Hofs.', linkUrl: null, art: 'NORMAL', createdAt: new Date('2026-10-13T08:12:00Z') },
  ]

  it('Text nur als Text, ein unerlaubter Link wird kein Knopf, die gelesene eigene Antwort sagt „gelesen"', () => {
    const eintraege = fadenEintraege(nachrichten, 'HOF', new Date('2026-10-13T08:20:00Z'), JETZT)
    const html = renderToStaticMarkup(createElement(FadenVerlauf, { eintraege, seite: 'HOF', fussErste: 'Wichtig · auch per E-Mail', nameAndereSeite: MARKE_TEAM }))
    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('10:12 · gelesen')
    expect(html).toContain('Wichtig · auch per E-Mail')
    expect(html).toContain(MARKE_TEAM)
    // Gegenprobe: ohne Lesestand des Teams kein „gelesen".
    const ungelesen = renderToStaticMarkup(
      createElement(FadenVerlauf, { eintraege: fadenEintraege(nachrichten, 'HOF', null, JETZT), seite: 'HOF', fussErste: null, nameAndereSeite: MARKE_TEAM })
    )
    expect(ungelesen).toContain('Antwort des Hofs.')
    expect(ungelesen).not.toContain('· gelesen')
  })
})
