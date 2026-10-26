/**
 * Hof-Anmeldung am Handy und „Mein Hof" (Nachtlauf Nr. 41, Register N1) —
 * und die Wege „Schon dabei? Anmelden". Die KundeShell (Kopf mit „Anmelden",
 * „Mein Hof", „Mein Konto") prüft tests/shells.test.ts, die Sitzung im
 * Browser tests/kunde-shell-mit-sitzung.test.ts, die Quellen
 * tests/kunden-navigation.test.ts; /login mit vorgewählter Hofkarte
 * tests/anmelden-seite.test.ts. Der alte Kopf (KundenKopf) ist seit Nr. 181
 * entfernt.
 *
 * Beweist:
 *  - Der Name im Kopf der KundeShell tritt nie bei 390 px oder breiter zurück.
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
// Seit Nr. 93 lädt die Seite die Zahlen der Gründungshöfe — ohne Zahlen rendert sie wie vorher.
vi.mock('@/server/queries/plattform-einstellung', () => ({ gruendungFuerSeiten: async () => null }))

import { FuerHoefeBandInhalt } from '@/components/startseite/startseite-abschnitte'
import { FuerHoefeEinstieg, FuerHoefeSchluss } from '@/components/fuer-hoefe/fuer-hoefe-abschnitte'
import FuerHoefePage from '@/app/(public)/fuer-hoefe/page'
import RegisterPage from '@/app/(auth)/register/page'
import { RegisterForm } from '@/app/(auth)/register/register-form'
import { SCHON_DABEI } from '@/lib/kunden-navigation'

const quelle = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')
/** Nur der Code zählt — Kommentare dürfen erklären, was hier gesucht wird. */
const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('Kopf der KundeShell — Platz für „Anmelden"', () => {
  // Nachbesserung 1: Bei 390 px steht der Name in jedem Kopf; zurück tritt er nur auf schmaleren Handys.
  it('der Name tritt nie bei 390 px oder breiter zurück', () => {
    const schwellen = [...ohneKommentare(quelle('src/components/shells/kunde-shell.tsx')).matchAll(/max-\[(\d+)px\]:hidden/g)].map((t) => Number(t[1]))
    // KundeShell mit Warenkorb im Kopf (der alte KundenKopf ist seit Nr. 181 entfernt).
    expect(schwellen.length).toBeGreaterThan(0)
    for (const schwelle of schwellen) expect(schwelle).toBeLessThanOrEqual(390)
  })

  it('der alte Kopf ist weg: keine Seite und keine Datei nennt KundenKopf als Bauteil', () => {
    expect(ohneKommentare(quelle('src/components/shared/kunden-kopf.tsx'))).not.toMatch(/export function KundenKopf\b/)
  })
})

describe('„Schon dabei? Anmelden" (→ /login)', () => {
  const MUSTER = new RegExp(`${SCHON_DABEI.frage.replace('?', '\\?')}[\\s\\S]{0,400}?<a [^>]*href="\\/login"[^>]*>${SCHON_DABEI.link}<\\/a>`)

  it('im Band „Für Höfe" der Startseite — neben „Hof registrieren"', () => {
    const html = renderToStaticMarkup(createElement(FuerHoefeBandInhalt))
    expect(html).toMatch(MUSTER)
    expect(html).toContain('href="/register"')
  })

  it('auf /fuer-hoefe oben (Einstieg) und unten (Abschluss) — je einmal', async () => {
    expect(renderToStaticMarkup(createElement(FuerHoefeEinstieg))).toMatch(MUSTER)
    expect(renderToStaticMarkup(createElement(FuerHoefeSchluss))).toMatch(MUSTER)
    const seite = renderToStaticMarkup(await FuerHoefePage())
    expect(seite.split(SCHON_DABEI.frage).length - 1).toBe(2)
  })

  it('auf /register: unter „Konto erstellen" und als Frage vor „Anmelden" im Kopf', async () => {
    const formular = renderToStaticMarkup(createElement(RegisterForm, { formToken: 'token' }))
    expect(formular).toMatch(MUSTER)
    expect(formular.indexOf(SCHON_DABEI.frage)).toBeGreaterThan(formular.indexOf('Konto erstellen'))
    const seite = renderToStaticMarkup(await RegisterPage())
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
    'src/app/(public)/agb/page.tsx',
    'src/app/(public)/datenschutz/page.tsx',
    'src/components/shells/kunde-shell-mit-sitzung.tsx',
    'src/lib/use-kunden-sitzung.ts',
  ])('%s liest weder Kopfzeilen noch Cookies noch die Sitzung auf dem Server', (datei) => {
    expect(ohneKommentare(quelle(datei))).not.toMatch(LIEST_ANFRAGE)
  })

  it('der Knopf kommt aus der Sitzung im Browser (useSession)', () => {
    expect(quelle('src/lib/use-kunden-sitzung.ts')).toMatch(/useSession\(\)/)
    expect(quelle('src/components/shells/kunde-shell-mit-sitzung.tsx')).toMatch(/useKundenSitzung\(\)/)
  })

  it('Gegenprobe: dieselbe Suche schlägt bei einer Seite an, die die Sitzung auf dem Server liest', () => {
    expect(ohneKommentare(quelle('src/app/account/profile/page.tsx'))).toMatch(LIEST_ANFRAGE)
  })
})
