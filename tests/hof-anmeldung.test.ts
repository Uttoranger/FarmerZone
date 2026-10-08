/**
 * Hof-Anmeldung am Handy und „Mein Hof" (Nachtlauf Nr. 41, Register N1) —
 * die Seiten, die noch KundenKopf tragen, und die Wege „Schon dabei?
 * Anmelden". Die KundeShell prüft tests/shells.test.ts, die Sitzung im
 * Browser tests/kunde-shell-mit-sitzung.test.ts, die Quellen
 * tests/kunden-navigation.test.ts und tests/kunden-menue.test.ts; /login mit
 * vorgewählter Hofkarte tests/anmelden-seite.test.ts.
 *
 * Beweist:
 *  - KundenKopf: ohne Sitzung oben rechts „Anmelden" auf /login — am Handy
 *    (44 px) und im Browser, nirgends mehr „Hofbetreiber-Login"; mit
 *    Hof-Sitzung „Mein Hof" auf /dashboard an beiden Stellen; mit
 *    Kundensitzung wie bisher die Anmeldung.
 *  - Hell/Dunkel steht im Menü-Blatt von KundenKopf, nicht im Kopf.
 *  - „Schon dabei? Anmelden" (→ /login) im Band „Für Höfe" der Startseite,
 *    auf /fuer-hoefe oben und unten und auf /register.
 *  - Die Sitzung liest weiter der Browser: Die statischen Seiten mit dem
 *    neuen Knopf lesen keine Anfrage (die Startseite bewacht zusätzlich
 *    tests/startseite.test.ts, „statisch vom CDN").
 *
 * Gegenproben: Jede gesuchte Abwesenheit steht neben einem Fund desselben
 * Merkmals.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  usePathname: () => '/impressum',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => createElement('img', { alt }),
}))

type Sitzung = { data: { user: Record<string, unknown> } | null; isPending: boolean }
const sitzung: { aktuell: Sitzung } = { aktuell: { data: null, isPending: false } }
vi.mock('@/lib/auth-client', () => ({ useSession: () => sitzung.aktuell, signIn: { email: vi.fn() } }))
// Die Seiten selbst stehen hier nur mit ihrem Inhalt — ihre Kopfzeile prüft tests/shells.test.ts.
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))
vi.mock('@/server/actions/register', () => ({ registerFarmer: vi.fn() }))

import { KundenKopf } from '@/components/shared/kunden-kopf'
import { FuerHoefeBand } from '@/components/startseite/startseite-abschnitte'
import { FuerHoefeEinstieg, FuerHoefeSchluss } from '@/components/fuer-hoefe/fuer-hoefe-abschnitte'
import FuerHoefePage from '@/app/(public)/fuer-hoefe/page'
import RegisterPage from '@/app/(auth)/register/page'
import { RegisterForm } from '@/app/(auth)/register/register-form'
import { SCHON_DABEI } from '@/lib/kunden-navigation'

const quelle = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')
/** Nur der Code zählt — Kommentare dürfen erklären, was hier gesucht wird. */
const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function kopf(stand: Sitzung): { handy: string; browser: string } {
  sitzung.aktuell = stand
  const html = renderToStaticMarkup(createElement(KundenKopf, { seite: { art: 'info' } }))
  // Zwei Kopfzeilen, je eine für Handy und Browser; die des Browsers steht als zweite im HTML.
  expect(html.match(/<header\b/g)).toHaveLength(2)
  const browserAb = html.lastIndexOf('<header')
  return { handy: html.slice(0, browserAb), browser: html.slice(browserAb) }
}

/** Das öffnende Tag des ersten Links auf `href`. */
function linkTag(html: string, href: string): string {
  return html.match(new RegExp(`<a [^>]*href="${href.replace(/\//g, '\\/')}"[^>]*>`))?.[0] ?? ''
}

const OHNE: Sitzung = { data: null, isPending: false }
const HOF: Sitzung = { data: { user: { id: 'h1', role: 'FARMER' } }, isPending: false }
const KUNDIN: Sitzung = { data: { user: { id: 'k1', role: 'CUSTOMER' } }, isPending: false }

describe('KundenKopf — Seiten, die noch nicht in der KundeShell stehen', () => {
  it('ohne Sitzung: am Handy oben rechts „Anmelden" auf /login, 44 px, nicht ausgeblendet', () => {
    const { handy } = kopf(OHNE)
    expect(handy).toMatch(/<a [^>]*href="\/login"[^>]*>Anmelden<\/a>/)
    const tag = linkTag(handy, '/login')
    expect(tag).toMatch(/\b(min-)?h-11\b/)
    expect(tag).not.toMatch(/\bhidden\b/)
    // Rechts vom Logo, vor dem Menü.
    expect(handy.indexOf('href="/login"')).toBeGreaterThan(handy.indexOf('FarmerZone'))
    expect(handy.indexOf('href="/login"')).toBeLessThan(handy.indexOf('Menü öffnen'))
  })

  it('ohne Sitzung: im Browser heißt der Knopf ebenfalls „Anmelden" — nirgends mehr „Hofbetreiber-Login"', () => {
    const { handy, browser } = kopf(OHNE)
    expect(browser).toMatch(/<a [^>]*href="\/login"[^>]*>Anmelden<\/a>/)
    expect(linkTag(browser, '/login')).toMatch(/\b(min-)?h-11\b/)
    expect(handy + browser).not.toContain('Hofbetreiber-Login')
    expect(quelle('src/components/shared/kunden-kopf.tsx')).not.toContain('Hofbetreiber-Login')
  })

  it('Hof-Sitzung: „Mein Hof" auf /dashboard am Handy und im Browser, kein „Anmelden"', () => {
    const { handy, browser } = kopf(HOF)
    expect(handy).toMatch(/<a [^>]*href="\/dashboard"[^>]*>Mein Hof<\/a>/)
    expect(browser).toMatch(/<a [^>]*href="\/dashboard"[^>]*>Mein Hof<\/a>/)
    expect(handy + browser).not.toContain('>Anmelden<')
    expect(handy + browser).not.toContain('href="/login"')
  })

  it('Kundensitzung: wie bisher der Weg zur Anmeldung (KundenKopf kennt kein „Mein Konto")', () => {
    const { handy, browser } = kopf(KUNDIN)
    expect(handy).toContain('>Anmelden<')
    expect(browser).toContain('>Anmelden<')
    expect(handy + browser).not.toContain('Mein Hof')
  })

  it('solange die Sitzung lädt: „Anmelden" — dasselbe HTML wie vom Server', () => {
    expect(kopf({ data: null, isPending: true }).handy).toContain('>Anmelden<')
  })

  // Am Handy braucht „Anmelden" den Platz oben rechts — Hell/Dunkel wandert ins Menü-Blatt.
  it('Hell/Dunkel steht im Menü-Blatt, nicht in der Kopfzeile', () => {
    const text = quelle('src/components/shared/kunden-kopf.tsx')
    const menue = text.slice(text.indexOf('function MenueBlatt('), text.indexOf('\n}\n', text.indexOf('function MenueBlatt(')))
    expect(menue).toContain('<ThemeUmschalterZeile')
    const kopfFunktion = text.slice(text.indexOf('export function KundenKopf('), text.indexOf('\n}\n', text.indexOf('export function KundenKopf(')))
    expect(kopfFunktion).not.toMatch(/<ThemeUmschalter\b/)
    // Gegenprobe: Die Suche findet den Schalter, wo er steht.
    expect(text).toMatch(/import \{[^}]*\bThemeUmschalterZeile\b[^}]*\} from '@\/components\/shared\/theme-umschalter'/)
  })
})

describe('„Schon dabei? Anmelden" (→ /login)', () => {
  const MUSTER = new RegExp(`${SCHON_DABEI.frage.replace('?', '\\?')}[\\s\\S]{0,400}?<a [^>]*href="\\/login"[^>]*>${SCHON_DABEI.link}<\\/a>`)

  it('im Band „Für Höfe" der Startseite — neben „Hof registrieren"', () => {
    const html = renderToStaticMarkup(createElement(FuerHoefeBand))
    expect(html).toMatch(MUSTER)
    expect(html).toContain('href="/register"')
  })

  it('auf /fuer-hoefe oben (Einstieg) und unten (Abschluss) — je einmal', () => {
    expect(renderToStaticMarkup(createElement(FuerHoefeEinstieg))).toMatch(MUSTER)
    expect(renderToStaticMarkup(createElement(FuerHoefeSchluss))).toMatch(MUSTER)
    const seite = renderToStaticMarkup(createElement(FuerHoefePage))
    expect(seite.split(SCHON_DABEI.frage).length - 1).toBe(2)
  })

  it('auf /register: unter „Konto erstellen" und als Frage vor „Anmelden" im Kopf', () => {
    const formular = renderToStaticMarkup(createElement(RegisterForm, { formToken: 'token' }))
    expect(formular).toMatch(MUSTER)
    expect(formular.indexOf(SCHON_DABEI.frage)).toBeGreaterThan(formular.indexOf('Konto erstellen'))
    const seite = renderToStaticMarkup(RegisterPage())
    const kopfzeile = seite.slice(seite.indexOf('<header'), seite.indexOf('</header>'))
    expect(kopfzeile).toContain(SCHON_DABEI.frage)
    expect(kopfzeile).toMatch(/<a [^>]*href="\/login"[^>]*>Anmelden<\/a>/)
    expect(kopfzeile).not.toContain('Schon registriert?')
  })

  it('Text und Ziel kommen aus der Quelle — keine Seite schreibt sie selbst', () => {
    for (const datei of [
      'src/components/startseite/startseite-abschnitte.tsx',
      'src/components/fuer-hoefe/fuer-hoefe-abschnitte.tsx',
      'src/app/(auth)/register/register-form.tsx',
      'src/app/(auth)/register/page.tsx',
    ]) {
      expect(ohneKommentare(quelle(datei)), datei).not.toContain(SCHON_DABEI.frage)
    }
    // Gegenprobe: Ohne das Entfernen der Kommentare fände die Suche den Text in der Erklärung.
    expect(quelle('src/components/startseite/startseite-abschnitte.tsx')).toContain(SCHON_DABEI.frage)
    // Gegenprobe: Die Quelle trägt den Text.
    expect(quelle('src/lib/kunden-navigation.ts')).toContain(`'${SCHON_DABEI.frage}'`)
  })
})

describe('die Sitzung liest der Browser — statische Seiten bleiben statisch', () => {
  const LIEST_ANFRAGE = /\bheaders\(\)|\bcookies\(\)|auth\.api\b|next\/headers|from '@\/lib\/auth'/

  it.each([
    'src/app/page.tsx',
    'src/app/(public)/fuer-hoefe/page.tsx',
    'src/app/(public)/impressum/page.tsx',
    'src/app/(public)/datenschutz/page.tsx',
    'src/components/shells/kunde-shell-mit-sitzung.tsx',
    'src/components/shared/kunden-kopf.tsx',
    'src/lib/use-kunden-sitzung.ts',
  ])('%s liest weder Kopfzeilen noch Cookies noch die Sitzung auf dem Server', (datei) => {
    expect(ohneKommentare(quelle(datei))).not.toMatch(LIEST_ANFRAGE)
  })

  it('der Knopf kommt aus der Sitzung im Browser (useSession)', () => {
    expect(quelle('src/lib/use-kunden-sitzung.ts')).toMatch(/useSession\(\)/)
    expect(quelle('src/components/shared/kunden-kopf.tsx')).toMatch(/useKundenSitzung\(\)/)
    expect(quelle('src/components/shells/kunde-shell-mit-sitzung.tsx')).toMatch(/useKundenSitzung\(\)/)
  })

  it('Gegenprobe: dieselbe Suche schlägt bei einer Seite an, die die Sitzung auf dem Server liest', () => {
    expect(ohneKommentare(quelle('src/app/account/profile/page.tsx'))).toMatch(LIEST_ANFRAGE)
  })
})
