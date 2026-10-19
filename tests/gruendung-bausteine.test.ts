/**
 * Die Bausteine der Gründungshöfe (Register K2-Ergänzung, Nr. 93) und wo sie
 * stehen — serverseitig gerendert (TESTING_GUIDELINES §1), Merkmale sind
 * Texte, die Kennung des Sterns und die Ziele der Links.
 *
 * Beweist:
 *  - GruendungSatz, GruendungPill, GruendungPreiszeile und RegistrierenSatz
 *    rendern ohne `zeigen` nichts (kein „0 von 12") — Gegenprobe: mit `zeigen`
 *    steht der Text da; der Stern ist Schmuck (aria-hidden), der Satz trägt
 *    alles; Farben nur über Tokens (kein Farbwert im HTML, der fette Teil in
 *    `text-foreground`).
 *  - Startseite: Das Band holt die Zahlen selbst (page.tsx bleibt), der Satz
 *    steht nach der Beschreibung, es bleibt EIN oranger Knopf.
 *  - /fuer-hoefe: Pill über der Überschrift, der eine orange Knopf heißt
 *    „Gründungshof werden", Fußnote statt Übergang; in den Preisen die
 *    Angebotszeile und „€ 0 · bis 31.12.2027 · dann € 19" nur in der
 *    Hofladen-Karte. Ohne `zeigen` alles wie vorher („Kostenlos starten").
 *  - /register: der Satz über dem Formular, ohne Platz nichts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Star } from 'lucide-react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/fuer-hoefe',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => createElement('img', { alt }) }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null, isPending: false }), signIn: { email: vi.fn() } }))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))
vi.mock('@/server/actions/register', () => ({ registerFarmer: vi.fn() }))
vi.mock('@/server/queries/plattform-einstellung', () => ({ gruendungFuerSeiten: vi.fn() }))

import { gruendungFuerSeiten } from '@/server/queries/plattform-einstellung'
import { KEINE_GRUENDUNG_SEITEN, type GruendungSeiten } from '@/lib/gruendungshof'
import { KONDITIONEN_UEBERGANG } from '@/lib/konditionen'
import { GruendungSatz } from '@/components/gruendung/satz'
import { GruendungPill } from '@/components/gruendung/pill'
import { GruendungPreiszeile } from '@/components/gruendung/preiszeile'
import { RegistrierenSatz } from '@/components/gruendung/registrieren-satz'
import { FuerHoefeBand, FuerHoefeBandInhalt } from '@/components/startseite/startseite-abschnitte'
import { FuerHoefeEinstieg, FuerHoefePreise } from '@/components/fuer-hoefe/fuer-hoefe-abschnitte'
import FuerHoefePage, { revalidate as fuerHoefeRevalidate } from '@/app/(public)/fuer-hoefe/page'
import RegisterPage from '@/app/(auth)/register/page'

const JETZT = new Date('2026-10-15T10:00:00+02:00')
const ZEIGEN: GruendungSeiten = { ...KEINE_GRUENDUNG_SEITEN, zeigen: true, zaehler: true, frei: 5, gesamt: 12, bisTag: '2027-12-31', voraussichtlicherPlatz: 8 }
const AUS: GruendungSeiten = { ...ZEIGEN, zeigen: false, voraussichtlicherPlatz: null }

/** HTML ohne das geschützte Leerzeichen, das formatDatumLang nach dem Tag setzt. */
const html = (element: React.ReactElement | null): string => (element ? renderToStaticMarkup(element).replace(/ |&nbsp;/g, ' ') : '')
const UEBERGANG = KONDITIONEN_UEBERGANG.replace(/\u00a0/g, ' ')
const anzahl = (text: string, muster: RegExp): number => text.match(muster)?.length ?? 0
/** Der Stern ist verborgen, wenn er selbst oder sein Kasten aria-hidden trägt (Preiszeile: der Kasten). */
const sternVerborgen = (text: string): boolean =>
  /<svg[^>]*lucide-star[^>]*aria-hidden="true"/.test(text) || /aria-hidden="true"[^>]*><svg[^>]*lucide-star/.test(text)
/** Links mit oranger Fläche — der Handlungsknopf der Hofwelt. */
const ORANGE_KNOPF = /<a [^>]*class="[^"]*\bbg-primary\b[^"]*"/g

const BAUSTEINE = [
  ['GruendungSatz', GruendungSatz, 'Noch 5 von 12 Gründungsplätzen frei'],
  ['GruendungPill', GruendungPill, 'Gründungsphase · noch 5 von 12 Plätzen'],
  ['GruendungPreiszeile', GruendungPreiszeile, 'Gründungshöfe zahlen bis 31. Dezember 2027 keine Grundgebühr'],
  ['RegistrierenSatz', RegistrierenSatz, 'Gründungshof Nr. 8'],
] as const

beforeEach(() => {
  vi.mocked(gruendungFuerSeiten).mockReset()
})

describe('die vier Bausteine', () => {
  it.each(BAUSTEINE)('%s: ohne `zeigen` und ohne Daten nichts — mit `zeigen` der Text (Gegenprobe)', (_, Baustein, text) => {
    expect(html(createElement(Baustein, { gruendung: AUS }))).toBe('')
    expect(html(createElement(Baustein, { gruendung: null }))).toBe('')
    expect(html(createElement(Baustein, { gruendung: ZEIGEN }))).toContain(text)
  })

  it.each(BAUSTEINE)('%s: der Stern ist Schmuck — aria-hidden, nie ohne', (_, Baustein) => {
    const text = html(createElement(Baustein, { gruendung: ZEIGEN }))
    expect(text.match(/<svg[^>]*lucide-star[^>]*>/g)).toHaveLength(1)
    expect(sternVerborgen(text)).toBe(true)
  })

  it('Gegenprobe: ein Stern mit Namen wäre für die Vorlesehilfe da — die Prüfung schlägt an', () => {
    expect(sternVerborgen(html(createElement(Star, { 'aria-label': 'Stern' })))).toBe(false)
  })

  it.each(BAUSTEINE)('%s: Farben nur über Tokens — kein Farbwert, keine Stilangabe', (_, Baustein) => {
    const text = html(createElement(Baustein, { gruendung: ZEIGEN }))
    expect(text).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|oklch\(|style=/i)
  })

  it('der Satz im Band ganz in der Vordergrundfarbe (Kontrast auf dem Verlauf), hervorgehoben durch Gewicht', () => {
    const satz = html(createElement(GruendungSatz, { gruendung: ZEIGEN }))
    expect(satz).toMatch(/<b class="[^"]*text-foreground[^"]*">Noch 5 von 12 Gründungsplätzen frei<\/b>/)
    expect(satz).toMatch(/<p class="[^"]*\btext-foreground\b/)
    expect(satz).not.toContain('text-muted-foreground')
  })

  it('RegistrierenSatz: ohne voraussichtlichen Platz nichts, obwohl die übrigen Bausteine stehen', () => {
    expect(html(createElement(RegistrierenSatz, { gruendung: { ...ZEIGEN, voraussichtlicherPlatz: null } }))).toBe('')
    expect(html(createElement(RegistrierenSatz, { gruendung: ZEIGEN }))).toContain('Du wärst voraussichtlich')
  })

  it('der letzte Platz: „Letzter Gründungsplatz frei"', () => {
    expect(html(createElement(GruendungSatz, { gruendung: { ...ZEIGEN, frei: 1 } }))).toContain('Letzter Gründungsplatz frei')
  })
})

describe('Startseite: Für-Höfe-Band', () => {
  it('mit Zahlen: der Satz nach der Beschreibung — weiter genau ein oranger Knopf', () => {
    const band = html(createElement(FuerHoefeBandInhalt, { gruendung: ZEIGEN }))
    expect(band).toContain('Noch 5 von 12 Gründungsplätzen frei')
    expect(band.indexOf('Schnell eingerichtet')).toBeLessThan(band.indexOf('Gründungsplätzen'))
    expect(anzahl(band, ORANGE_KNOPF)).toBe(1)
  })

  it('ohne Zahlen bzw. ohne `zeigen`: das Band wie vorher', () => {
    for (const gruendung of [null, AUS]) {
      const band = html(createElement(FuerHoefeBandInhalt, { gruendung }))
      expect(band).not.toContain('Gründungsplätze')
      expect(anzahl(band, ORANGE_KNOPF)).toBe(1)
    }
  })

  it('das Band holt die Zahlen selbst (page.tsx bleibt unverändert)', async () => {
    vi.mocked(gruendungFuerSeiten).mockResolvedValue(ZEIGEN)
    expect(html(await FuerHoefeBand())).toContain('Noch 5 von 12 Gründungsplätzen frei')
    expect(gruendungFuerSeiten).toHaveBeenCalledTimes(1)
  })
})

describe('/fuer-hoefe', () => {
  it('Einstieg mit Zahlen: Pill über der Überschrift, „Gründungshof werden", Fußnote statt Übergang', () => {
    const kopf = html(createElement(FuerHoefeEinstieg, { gruendung: ZEIGEN }))
    expect(kopf.indexOf('Gründungsphase · noch 5 von 12 Plätzen')).toBeLessThan(kopf.indexOf('<h1'))
    expect(kopf).toMatch(/<a href="\/register"[^>]*bg-primary[^>]*>Gründungshof werden<\/a>/)
    expect(kopf).not.toContain('Kostenlos starten')
    expect(kopf).toContain('Kostenlos bis 31. Dezember 2027')
    // Korrektur 15.10.2026 (Register K2): ohne „keine Bankdaten nötig“, und die ganze Fußnote auch am Handy
    // (Mockup mobil-k2-fuer-hoefe-gruendung zeigt alle drei Teile) – kein Teil nur ab 768 px.
    expect(kopf).not.toContain('Bankdaten')
    const fussnote = kopf.match(/<p[^>]*>(?:(?!<\/p>)[\s\S])*Kostenlos bis(?:(?!<\/p>)[\s\S])*<\/p>/)?.[0] ?? ''
    expect(fussnote.replace(/<[^>]+>/g, '')).toMatch(/^Kostenlos bis 31\.[\s\u00a0]Dezember 2027 · danach Tarif nach Wahl · monatlich kündbar$/)
    expect(fussnote).not.toContain('hidden')
    expect(kopf).not.toContain(UEBERGANG)
    expect(anzahl(kopf, ORANGE_KNOPF)).toBe(1)
  })

  it('Einstieg ohne `zeigen`: der Knopf trägt wieder „Kostenlos starten", der Übergang steht da, keine Pill', () => {
    for (const gruendung of [null, AUS]) {
      const kopf = html(createElement(FuerHoefeEinstieg, { gruendung }))
      expect(kopf).toMatch(/<a href="\/register"[^>]*bg-primary[^>]*>Kostenlos starten<\/a>/)
      expect(kopf).toContain(UEBERGANG)
      expect(kopf).not.toContain('Gründungsphase')
      expect(anzahl(kopf, ORANGE_KNOPF)).toBe(1)
    }
  })

  it('Preise mit Zahlen: die Angebotszeile vor den Karten, der Gründungspreis nur in der Hofladen-Karte', () => {
    const preise = html(createElement(FuerHoefePreise, { jetzt: JETZT, gruendung: ZEIGEN }))
    expect(preise.indexOf('Gründungshöfe zahlen bis')).toBeLessThan(preise.indexOf('Hoftor'))
    const hofladen = preise.slice(preise.indexOf('>Hofladen<'))
    expect(hofladen).toContain('€ 0')
    expect(hofladen).toContain('bis 31.12.2027 · dann € 19')
    expect(preise.slice(preise.indexOf('>Hoftor<'), preise.indexOf('>Hofladen<'))).not.toContain('dann €')
  })

  it('Preise ohne `zeigen`: keine Angebotszeile, der Hofladen mit seinem Preis', () => {
    const preise = html(createElement(FuerHoefePreise, { jetzt: JETZT, gruendung: AUS }))
    expect(preise).not.toContain('Gründungshöfe zahlen')
    expect(preise).not.toContain('dann €')
    expect(preise.slice(preise.indexOf('>Hofladen<'))).toContain('€ 19')
  })

  it('die Seite lädt die Zahlen und reicht sie an Kopf und Preise; alle fünf Minuten neu gebaut', async () => {
    vi.mocked(gruendungFuerSeiten).mockResolvedValue(ZEIGEN)
    const seite = html(await FuerHoefePage())
    expect(seite).toContain('Gründungsphase · noch 5 von 12 Plätzen')
    expect(seite).toContain('Gründungshöfe zahlen bis 31. Dezember 2027 keine Grundgebühr')
    expect(fuerHoefeRevalidate).toBe(300)
  })
})

describe('/register', () => {
  it('der Satz über dem Formular — aus der Seite in das Formular gereicht', async () => {
    vi.mocked(gruendungFuerSeiten).mockResolvedValue(ZEIGEN)
    const seite = html(await RegisterPage())
    expect(seite).toContain('Du wärst voraussichtlich <b class="font-semibold text-foreground">Gründungshof Nr. 8</b>')
    expect(seite.indexOf('Gründungshof Nr. 8')).toBeLessThan(seite.indexOf('<form'))
  })

  it('ohne Platz: kein Satz, das Formular wie vorher', async () => {
    vi.mocked(gruendungFuerSeiten).mockResolvedValue(AUS)
    const seite = html(await RegisterPage())
    expect(seite).not.toContain('voraussichtlich')
    expect(seite).toContain('<form')
  })
})
