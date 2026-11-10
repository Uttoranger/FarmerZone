/**
 * Nr. 254 (Lauf 32, Liste „Board oder Code“, B-Zeilen): Rahmen der Rechtsseiten,
 * Rücktrittsrecht, Fehlerseiten, Systemseiten und Problem melden.
 *
 * Beweist:
 *  - Das Verzeichnis der Rechtsseiten hebt den Abschnitt an der Leselinie
 *    hervor (rein: `abschnittAnDerLeselinie`), Teile in Eintragsgröße, Punkte
 *    eingerückt (rechtstexte Z. 847/854).
 *  - Die Vorlage steht in der 1000-px-Spalte der Shell, ohne Verzeichnis mit
 *    dem Text links (höchstens 672 px), h1 28 px (Z. 850/855); Impressum-Spalte
 *    ebenso links.
 *  - Ab dem Stichtag ist „Frühere Fassung 0.9 …“ als Ziel 44 px hoch
 *    (Nacharbeit aus Nr. 259), der Wortlaut bleibt.
 *  - Rücktrittsrecht: Zeitpunkt mit Wochentag ohne „Uhr“; nach dem Absenden
 *    blendet die Seite Titel und Einleitung aus; Karten 600 px.
 *  - Fehlerseiten: h1 26 px, zweiter Weg mit Rand in Textfarbe.
 *  - Problem melden: die Karte links in der Spalte der Shell, nicht mittig.
 * Gegenproben je Fall (vor dem Stichtag kein „Frühere Fassung“; ohne
 * Überschrift über der Leselinie kein Treffer).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('main', null, children),
}))
const lade = vi.hoisted(() => vi.fn())
vi.mock('@/server/queries/plattform-einstellung', () => ({ ladePlattformEinstellung: (...args: unknown[]) => lade(...args) }))

import AgbPage from '@/app/(public)/agb/page'
import { RechtstextVorlage } from '@/components/shared/rechtstext-vorlage'
import { RechtstextVerzeichnis, abschnittAnDerLeselinie, VERZEICHNIS_LESELINIE_PX } from '@/components/shared/rechtstext-verzeichnis'
import { INFOSEITE_SPALTE, INFOSEITE_TITEL } from '@/components/shared/infoseite-stil'
import { FEHLER_UMRISS, FehlerseiteAufbau } from '@/components/shared/fehler-ansicht'
import { eingangZeitpunkt } from '@/lib/widerruf'
import { AGB_SEITE_TEXT } from '@/lib/rechtstexte/agb-einbindung'
import { PLATTFORM_EINSTELLUNG_STANDARD } from '@/lib/plattform-einstellung'
import { formatDatumLang, formatZeitpunktMitWochentag } from '@/lib/format'

const quelle = (pfad: string): string => readFileSync(pfad, 'utf8')

afterEach(() => {
  vi.useRealTimers()
})

describe('Verzeichnis der Rechtsseiten', () => {
  const oben: Record<string, number | null> = { a: -400, b: 40, c: 300, d: null }
  it('der letzte Abschnitt über der Leselinie ist der gelesene', () => {
    expect(abschnittAnDerLeselinie(['a', 'b', 'c', 'd'], (k) => oben[k] ?? null)).toBe('b')
  })
  it('genau auf der Leselinie zählt schon', () => {
    expect(abschnittAnDerLeselinie(['a', 'c'], (k) => (k === 'c' ? VERZEICHNIS_LESELINIE_PX : -10))).toBe('c')
  })
  it('Gegenprobe: alle Überschriften unter der Linie oder ohne Element → keiner', () => {
    expect(abschnittAnDerLeselinie(['c', 'd'], (k) => oben[k] ?? null)).toBeNull()
  })
  it('Teil-Überschrift in Eintragsgröße und Textfarbe, Punkte eingerückt mit Nummer im Text', () => {
    const html = renderToStaticMarkup(
      createElement(RechtstextVerzeichnis, {
        gruppen: [
          { eintraege: [{ anker: 'kurz', text: 'Kurz erklärt' }] },
          { titel: 'Teil A – Für alle', eintraege: [{ anker: 'punkt-1', text: 'Wer wir sind', nummer: 1 }] },
        ],
      })
    )
    expect(html).toMatch(/<p class="[^"]*text-\[14px\][^"]*text-foreground[^"]*">Teil A – Für alle<\/p>/)
    expect(html).not.toContain('text-[12.5px]')
    expect(html).toMatch(/<a href="#punkt-1" class="[^"]*pl-5[^"]*"><span><span class="tabular-nums">1\. <\/span>Wer wir sind<\/span><\/a>/)
    // Gegenprobe: der Eintrag ohne Teil ist nicht eingerückt.
    expect(html).not.toMatch(/<a href="#kurz" class="[^"]*pl-5/)
  })
})

describe('Spalte und Titel der Rechtsseiten', () => {
  it('ohne Verzeichnis: 1000-px-Spalte der Shell, Text links höchstens 672 px — nicht mittig', () => {
    const props = { titel: 'Konditionen', stand: 'Stand X', children: createElement('p', null, 'Text') }
    const html = renderToStaticMarkup(createElement(RechtstextVorlage, props))
    expect(html).toMatch(/^<div class="mx-auto w-full max-w-\[1032px\] px-4/)
    expect(html).toContain('max-w-2xl')
    expect(html).not.toContain('lg:grid')
  })
  it('mit Verzeichnis: Spalte 260 px und 24 px Abstand ab 1024 px, keine Karte mit rounded-2xl', () => {
    const props = {
      titel: 'AGB',
      stand: 'Fassung',
      verzeichnis: { kennung: 'v', zusammenfassung: '1 Abschnitt', gruppen: [{ eintraege: [{ anker: 'a', text: 'A' }] }] },
      children: createElement('p', null, 'Text'),
    }
    const html = renderToStaticMarkup(createElement(RechtstextVorlage, props))
    expect(html).toContain('lg:grid-cols-[260px_minmax(0,1fr)]')
    expect(html).toContain('lg:gap-x-6')
    expect(html).not.toContain('rounded-2xl')
  })
  it('h1 28 px in beiden Breiten; Impressum-Spalte links in der Shell-Spalte', () => {
    expect(INFOSEITE_TITEL).toContain('text-[28px]')
    expect(INFOSEITE_TITEL).not.toMatch(/md:text-/)
    expect(INFOSEITE_SPALTE).toContain('max-w-[1032px]')
    expect(INFOSEITE_SPALTE).not.toContain('max-w-2xl')
  })
})

describe('/agb: „Frühere Fassung 0.9“ als Ziel 44 px', () => {
  const STICHTAG = new Date('2027-02-01T00:00:00+01:00')
  async function agbUm(jetzt: Date): Promise<string> {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(jetzt)
    lade.mockResolvedValue({ ...PLATTFORM_EINSTELLUNG_STANDARD, hofpreisModellAb: STICHTAG.toISOString() })
    return renderToStaticMarkup(await AgbPage())
  }
  it('ab dem Stichtag: der Link hat min-h-11, der Wortlaut bleibt', async () => {
    const html = await agbUm(new Date('2027-02-02T10:00:00+01:00'))
    const text = AGB_SEITE_TEXT.frueher(formatDatumLang(new Date(STICHTAG.getTime() - 1)))
    const link = html.match(new RegExp(`<a href="/agb/0\\.9"[^>]*>${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a>`))
    expect(link?.[0]).toBeDefined()
    expect(link?.[0]).toContain('min-h-11')
  })
  it('Gegenprobe: vor dem Stichtag kein Link auf 0.9', async () => {
    const html = await agbUm(new Date('2027-01-20T10:00:00+01:00'))
    expect(html).not.toContain('href="/agb/0.9"')
  })
})

describe('Rücktrittsrecht', () => {
  it('Zeitpunkt der Seite mit Wochentag und ohne „Uhr“ (Wiener Zeit)', () => {
    expect(formatZeitpunktMitWochentag(new Date('2027-03-03T18:40:00Z'))).toBe('Mi, 3. März 2027, 19:40')
  })
  it('Gegenprobe: Mails und Admin behalten eingangZeitpunkt mit „Uhr“', () => {
    expect(eingangZeitpunkt(new Date('2027-03-03T18:40:00Z'))).toMatch(/ Uhr$/)
  })
  it('nach dem Absenden blendet die Seite Titel und Einleitung aus; Karten 600 px', () => {
    const seite = quelle('src/app/(public)/widerruf/page.tsx')
    const formular = quelle('src/app/(public)/widerruf/widerruf-formular.tsx')
    expect(formular).toMatch(/<section data-widerruf-eingegangen /)
    expect(seite).toContain('group/widerruf')
    expect(seite).toContain('group-has-[[data-widerruf-eingegangen]]/widerruf:hidden')
    expect(seite).toContain('*:max-w-[600px]')
  })
})

describe('Fehlerseiten', () => {
  // Seit Nr. 279 gierig umbrochen wie das Board („Diesen Hof gibt es hier / nicht (mehr)“), nicht mehr ausgewogen.
  it('h1 26 px, gierig umbrochen (ohne text-balance); zweiter Weg mit Rand in Textfarbe', () => {
    const props = { zeichen: 'weg' as const, kicker: 'Fehler 404', titel: 'Titel', text: 'Satz', children: null }
    const html = renderToStaticMarkup(createElement(FehlerseiteAufbau, props))
    expect(html).toMatch(/<h1 class="[^"]*text-\[26px\]/)
    expect(html).not.toContain('text-balance')
    expect(html).toContain('max-w-[544px]')
    expect(FEHLER_UMRISS).toContain('border-foreground/60')
    expect(FEHLER_UMRISS).not.toContain('border-border')
  })
})

describe('Problem melden (Kundschaft)', () => {
  it('die Karte steht links in der Spalte der Shell, nicht mittig', () => {
    const seite = quelle('src/app/(public)/problem-melden/page.tsx')
    expect(seite).toContain('max-w-[1032px] px-4 pt-4')
    expect(seite).not.toContain('justify-center')
  })
})
