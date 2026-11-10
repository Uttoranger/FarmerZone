/**
 * Anmelden, Konto und Systemseiten nach den Boards November 2026 (Nr. 239,
 * Abnahme Lauf 31; Boards s2-/w2-anmelden, -kundenkonto, -passwort,
 * s3-/w3-fehlerseiten, -widerruf).
 *
 * Beweist:
 *  - Hof-Karte auf /login: „Mit Passkey anmelden“ ohne Trennzeile „oder“ und
 *    ohne Schlüssel-Symbol, die Links „Passwort vergessen?“ und „Noch kein Hof?
 *    Registrieren“ unterstrichen; der Fehler bei falschem Passwort hat Titel
 *    und zweite Zeile wie das Board.
 *  - „Konto löschen?“ startet den Fokus auf „Abbrechen“ — am Handy (Blatt) wie
 *    im Browser (Dialog); „Konto löschen“ bekommt ihn nie.
 *  - Die 500 der Kundschaft steht in der KundeShell, global-error nie.
 *  - Der Eingang eines Rücktritts zeichnet die Beschriftungen der
 *    Zusammenfassung im Paar „läuft“ (axe color-contrast aus der Abnahme).
 *
 * Gegenproben: jede gesuchte Abwesenheit neben einem Fund desselben Merkmals
 * (KNOPF_UMRISS ist da, das „oder“ steht noch in HOF_PASSKEY_ANMELDEN; die
 * Fokus-Suche schlägt an einer Fassung auf „Konto löschen“ an).
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('next/navigation', () => ({
  usePathname: () => '/login',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signIn: { email: vi.fn() }, signOut: vi.fn(), useSession: () => ({ data: null, isPending: false }) }))
vi.mock('@/lib/auth-client-passkey', () => ({ passkeySignIn: { passkey: vi.fn() } }))

import { HOF_PASSKEY_ANMELDEN } from '@/lib/hof-passkey'
import { FALSCHES_PASSWORT, HofAnmeldung } from '@/components/anmelden/hof-anmeldung'

const quelle = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('/login, Hof-Karte nach Board s2-/w2-anmelden', () => {
  const html = renderToStaticMarkup(createElement(HofAnmeldung))

  it('„Mit Passkey anmelden“ ohne Trennzeile und ohne Schlüssel-Symbol', () => {
    expect(html).toContain(HOF_PASSKEY_ANMELDEN.knopf)
    expect(html).not.toContain('lucide-key-round')
    // Die Trennzeile „oder“ ist entfallen (ihr Text seit Nr. 242 auch aus HOF_PASSKEY_ANMELDEN).
    const TRENNZEILE = />\s*oder\s*</
    expect(html).not.toMatch(TRENNZEILE)
    // Gegenprobe: die Suche hätte die Trennzeile gefunden.
    expect('<span>oder</span>').toMatch(TRENNZEILE)
  })

  it('„Passwort vergessen?“ und „Noch kein Hof? Registrieren“ sind unterstrichene Links', () => {
    for (const [ziel, text] of [
      ['/forgot-password', 'Passwort vergessen?'],
      ['/register', 'Noch kein Hof? Registrieren'],
    ]) {
      const link = html.match(new RegExp(`<a[^>]*href="${ziel}"[^>]*>${text.replace('?', '\\?')}</a>`))?.[0] ?? ''
      expect(link, ziel).toMatch(/\bunderline\b/)
    }
  })

  it('falsches Passwort: Titel und zweite Zeile wie im Board', () => {
    expect(FALSCHES_PASSWORT).toEqual({ titel: 'E-Mail oder Passwort falsch.', satz: 'Bitte nochmals versuchen.' })
  })
})

describe('„Konto wirklich löschen?“: Startfokus auf „Abbrechen“ (Maßstab Punkt 5)', () => {
  const text = quelle('src/app/account/profile/profile-client.tsx')
  /** Je Rückfrage (Blatt, Dialog) das Ziel des Startfokus und welcher Knopf die Marke trägt. */
  const startfokus = (code: string): { ziele: string[]; knoepfe: string[] } => ({
    ziele: [...code.matchAll(/initialFocus=\{(\w+)\}/g)].map((m) => m[1]),
    // Der Knopf steht in einer Zeile, sein Text in der nächsten (Format der Datei).
    knoepfe: [...code.matchAll(/ref=\{abbrechenRef\}[^\n]*>\s*\n\s*([^<\n{]+?)\s*\n/g)].map((m) => m[1]),
  })

  it('Blatt und Dialog setzen den Startfokus auf dieselbe Marke, und die hängt an „Abbrechen“', () => {
    const { ziele, knoepfe } = startfokus(text)
    expect(ziele).toEqual(['abbrechenRef', 'abbrechenRef'])
    expect(knoepfe).toEqual(['Abbrechen', 'Abbrechen'])
  })

  it('Gegenprobe: hinge die Marke an „Konto löschen“, fände die Suche es', () => {
    const falsch = '<button type="button" ref={abbrechenRef} onClick={handleDeleteAccount}>\n  Konto löschen\n</button>'
    expect(startfokus(falsch).knoepfe).toEqual(['Konto löschen'])
  })
})

describe('Fehlerseiten nach Board s3-/w3-fehlerseiten', () => {
  it('die 500 der Kundschaft steht in der KundeShell, nur bei Bedarf geladen', () => {
    const fehler = quelle('src/app/error.tsx')
    expect(fehler).toMatch(/dynamic\(\(\) => import\('@\/components\/shells\/kunde-shell-mit-sitzung'\)/)
    expect(fehler).toMatch(/<KundeShellMitSitzung>\s*<FehlerAnsicht/)
  })

  it('Gegenprobe: global-error bleibt ohne Shell — sie ist der Boden, wenn die Shell selbst reißt', () => {
    expect(quelle('src/app/global-error.tsx')).not.toContain('KundeShell')
  })
})

describe('Rücktritt: Eingang auf grüner Fläche', () => {
  it('die Beschriftungen der Zusammenfassung nehmen dort das Paar „läuft“, sonst die leise Schrift', () => {
    const text = quelle('src/app/(public)/widerruf/widerruf-formular.tsx')
    expect(text).toMatch(/aufGruen \? 'font-semibold text-zustand-laeuft' : 'text-muted-foreground'/)
    expect(text).toMatch(/bg-zustand-laeuft-grund/)
    expect(text).toMatch(/umfangZeilen=\{umfangZeilen\} aufGruen \/>/)
  })
})
