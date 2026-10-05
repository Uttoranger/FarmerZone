/**
 * Die Anmeldeseiten im neuen Design (Gate 4, Nr. 08): /account/login (Kunde,
 * Code) und /login (Hof, Passwort) — gerendert wie auf dem Server.
 * Mockups: web-k0-anmelden-kunde-code-hof-passwort, mobil-k0-anmelden-mit-code.
 *
 * Beweist:
 *  - Beide Routen zeigen dieselbe Seite mit zwei getrennten Karten (Kunde
 *    Code, Hof Passwort); am Handy schaltet ein Umschalter aus echten Links
 *    zwischen den beiden Routen, die aktive trägt aria-current.
 *  - Kein Konto-Angebot für Kundinnen (E8): kein „Konto anlegen", kein
 *    „Registrieren" in der Kundenkarte — nur der Hof wird registriert.
 *  - Zustände der Kundenkarte: E-Mail-Schritt, laden, Fehler inline am Feld
 *    (role="alert", aria-invalid), Code-Schritt mit der Adresse, Hinweis
 *    „10 Minuten", Code-Feld für das automatische Einfügen
 *    (autocomplete="one-time-code"), „Code erneut senden" mit Wartezeit und
 *    „Andere E-Mail".
 *  - Hofkarte: E-Mail, Passwort, Passwort vergessen, Hof registrieren.
 *  - Die Routen: Kundenseite gibt nur ein sicheres Ziel weiter (keine offene
 *    Weiterleitung), Hofseite behält die Sitzungsprüfung; beide in der
 *    KundeShell (Liste UMGESTELLT in tests/shells.test.ts).
 *  - Keine Farbwerte im HTML, keine Emojis (Tokens tragen beide Themes).
 *
 * Gegenproben: Jede gesuchte Abwesenheit wird dort gesucht, wo dasselbe
 * Merkmal nachweislich vorkommt.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  usePathname: () => '/account/login',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({
  authClient: { emailOtp: { sendVerificationOtp: vi.fn() }, signIn: { emailOtp: vi.fn() } },
  signIn: { email: vi.fn() },
  useSession: () => ({ data: null, isPending: false }),
}))

import { AnmeldenSeite } from '@/components/anmelden/anmelden-seite'
import { CodeEmailSchritt, CodeEingabeSchritt } from '@/components/anmelden/kunde-code-formular'
import { HofAnmeldung } from '@/components/anmelden/hof-anmeldung'
import KundenLoginSeite from '@/app/account/login/page'

const nichts = () => {}

function seite(aktiv: 'kunde' | 'hof'): string {
  return renderToStaticMarkup(createElement(AnmeldenSeite, { aktiv, ziel: '/account/profile' }))
}

function emailSchritt(teil: Partial<Parameters<typeof CodeEmailSchritt>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(CodeEmailSchritt, {
      email: '',
      onEmail: nichts,
      onAbsenden: nichts,
      laedt: false,
      fehler: null,
      ...teil,
    })
  )
}

function codeSchritt(teil: Partial<Parameters<typeof CodeEingabeSchritt>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(CodeEingabeSchritt, {
      email: 'kundin@example.com',
      code: '',
      onCode: nichts,
      onAbsenden: nichts,
      onErneut: nichts,
      onAndereEmail: nichts,
      laedt: false,
      fehler: null,
      hinweis: null,
      wartezeit: 0,
      ...teil,
    })
  )
}

/** Sucht im Elementbaum das erste Element eines Typs und gibt seine Props zurück. */
function propsVon(knoten: ReactNode, typ: unknown): Record<string, unknown> | null {
  if (!isValidElement(knoten)) return null
  const element = knoten as ReactElement<Record<string, unknown>>
  if (element.type === typ) return element.props
  const kinder = element.props.children as ReactNode
  for (const kind of Array.isArray(kinder) ? kinder : [kinder]) {
    const fund = propsVon(kind, typ)
    if (fund) return fund
  }
  return null
}

describe('AnmeldenSeite — beide Karten, getrennt', () => {
  it('zeigt Überschrift, Unterzeile und beide Karten nach Mockup', () => {
    const html = seite('kunde')
    expect(html).toContain('Willkommen zurück')
    expect(html).toContain('Kunden melden sich mit einem Code an, Höfe mit Passwort.')
    expect(html).toContain('Ich kaufe ein')
    expect(html).toContain('Mit E-Mail-Code anmelden')
    expect(html).toContain('Ich habe einen Hof')
    expect(html).toContain('Hof-Anmeldung')
  })

  it('Umschalter am Handy: echte Links auf beide Routen, die aktive ist markiert', () => {
    const kunde = seite('kunde')
    expect(kunde).toMatch(/<a[^>]*href="\/account\/login"[^>]*aria-current="page"/)
    expect(kunde).toMatch(/<a[^>]*href="\/login"/)
    expect(kunde).not.toMatch(/<a[^>]*href="\/login"[^>]*aria-current="page"/)

    const hof = seite('hof')
    expect(hof).toMatch(/<a[^>]*href="\/login"[^>]*aria-current="page"/)
    expect(hof).not.toMatch(/<a[^>]*href="\/account\/login"[^>]*aria-current="page"/)
  })

  it('kein Konto-Angebot für Kundinnen (E8) — Registrieren gibt es nur für Höfe', () => {
    const html = seite('kunde')
    expect(html).not.toMatch(/Konto (anlegen|erstellen|eröffnen)/i)
    const kundenkarte = html.slice(html.indexOf('Mit E-Mail-Code anmelden'), html.indexOf('Hof-Anmeldung'))
    expect(kundenkarte).toContain('Code schicken')
    expect(kundenkarte).not.toContain('Registrieren')
    // Gegenprobe: In der Hofkarte steht Registrieren.
    expect(html.slice(html.indexOf('Hof-Anmeldung'))).toContain('Registrieren')
  })

  it('genau eine Überschrift erster Ordnung', () => {
    expect(seite('kunde').match(/<h1/g)).toHaveLength(1)
  })

  it('keine Farbwerte und keine Emojis im HTML', () => {
    for (const html of [seite('kunde'), seite('hof'), codeSchritt({ fehler: 'x' })]) {
      expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i)
      expect(html).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })
})

describe('Kundenkarte — E-Mail-Schritt', () => {
  it('E-Mail-Feld mit Beschriftung und Knopf „Code schicken"', () => {
    const html = emailSchritt()
    expect(html).toMatch(/<label[^>]*for="[^"]+"[^>]*>E-Mail<\/label>/)
    expect(html).toMatch(/<input[^>]*type="email"/)
    expect(html).toMatch(/autocomplete="email"/i)
    expect(html).toContain('Code schicken')
    expect(html).not.toContain('role="alert"')
  })

  it('laden: Knopf gesperrt mit „Einen Moment"', () => {
    const html = emailSchritt({ laedt: true, email: 'kundin@example.com' })
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*Einen Moment/)
    // Gegenprobe: ohne Laden kein „Einen Moment".
    expect(emailSchritt({ email: 'kundin@example.com' })).not.toContain('Einen Moment')
  })

  it('Fehler inline am Feld', () => {
    const html = emailSchritt({ fehler: 'Bitte gib eine gültige E-Mail-Adresse ein.' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Bitte gib eine gültige E-Mail-Adresse ein.')
    expect(html).toContain('aria-invalid="true"')
  })
})

describe('Kundenkarte — Code-Schritt', () => {
  it('nennt die Adresse, den 6-stelligen Code und „10 Minuten"', () => {
    const html = codeSchritt()
    expect(html).toContain('kundin@example.com')
    expect(html).toContain('6-stelligen Code')
    expect(html).toContain('10 Minuten')
  })

  it('Code-Feld fürs automatische Einfügen, nur Ziffern, beschriftet', () => {
    const html = codeSchritt()
    expect(html).toMatch(/autocomplete="one-time-code"/i)
    expect(html).toMatch(/inputmode="numeric"/i)
    expect(html).toMatch(/<label[^>]*>[^<]*Code[^<]*<\/label>/)
  })

  it('zeigt die eingegebenen Ziffern in sechs Kästchen', () => {
    const html = codeSchritt({ code: '481' })
    expect(html.match(/data-kaestchen=""/g)).toHaveLength(6)
    expect(html).toContain('>4<')
    expect(html).toContain('>8<')
    expect(html).toContain('>1<')
  })

  it('„Code erneut senden" wartet und nennt die Sekunden, danach frei', () => {
    const wartet = codeSchritt({ wartezeit: 45 })
    expect(wartet).toMatch(/<button[^>]*disabled=""[^>]*>Code erneut senden \(45 s\)<\/button>/)
    const frei = codeSchritt({ wartezeit: 0 })
    expect(frei).toMatch(/<button[^>]*>Code erneut senden<\/button>/)
    expect(frei).not.toMatch(/disabled=""[^>]*>Code erneut senden/)
  })

  it('„Andere E-Mail" führt zurück zum ersten Schritt', () => {
    expect(codeSchritt()).toContain('Andere E-Mail')
  })

  it('Fehler inline am Code-Feld, Hinweis (neuer Code geschickt) als Status', () => {
    const fehler = codeSchritt({ fehler: 'Der Code stimmt nicht.' })
    expect(fehler).toContain('role="alert"')
    expect(fehler).toContain('aria-invalid="true"')
    const hinweis = codeSchritt({ hinweis: 'Wir haben dir einen neuen Code geschickt.' })
    expect(hinweis).toContain('role="status"')
    expect(hinweis).not.toContain('role="alert"')
  })

  it('laden: Anmelden-Knopf gesperrt', () => {
    expect(codeSchritt({ laedt: true, code: '481234' })).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/)
  })

  it('hält eine 80 Zeichen lange Adresse aus (bricht um statt zu überlaufen)', () => {
    const lang = `${'k'.repeat(68)}@example.com`
    const html = codeSchritt({ email: lang })
    expect(html).toContain(lang)
    expect(html).toMatch(/break-all|break-words/)
  })
})

describe('Hofkarte', () => {
  it('E-Mail und Passwort, Passwort vergessen, Hof registrieren', () => {
    const html = renderToStaticMarkup(createElement(HofAnmeldung))
    expect(html).toMatch(/<input[^>]*type="email"/)
    expect(html).toMatch(/<input[^>]*type="password"/)
    expect(html).toMatch(/autocomplete="current-password"/i)
    expect(html).toContain('href="/forgot-password"')
    expect(html).toContain('href="/register"')
    expect(html).toContain('Anmelden')
  })
})

describe('Routen', () => {
  it('/account/login gibt nur ein sicheres Ziel an die Seite weiter', async () => {
    const boese = await KundenLoginSeite({ searchParams: Promise.resolve({ ziel: '//boese.example.com' }) })
    expect(propsVon(boese, AnmeldenSeite)).toMatchObject({ aktiv: 'kunde', ziel: '/account/profile' })

    const eigen = await KundenLoginSeite({ searchParams: Promise.resolve({ ziel: '/account/profile?tab=abos' }) })
    expect(propsVon(eigen, AnmeldenSeite)).toMatchObject({ ziel: '/account/profile?tab=abos' })
  })

  it('/login behält die Sitzungsprüfung und zeigt die Hofkarte aktiv', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/app/(auth)/login/page.tsx'), 'utf8')
    expect(quelle).toContain("redirect('/dashboard')")
    expect(quelle).toContain('aktiv="hof"')
    expect(quelle).toContain('KundeShellMitSitzung')
  })

  it('/account/login steckt in der KundeShell', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/app/account/login/page.tsx'), 'utf8')
    expect(quelle).toContain('KundeShellMitSitzung')
    expect(quelle).toContain('aktiv="kunde"')
  })

  it('kein Magic Link mehr im Formular — Gegenprobe: der Code-Weg ist da', () => {
    const quellen = ['src/components/anmelden/kunde-code-formular.tsx', 'src/app/account/login/page.tsx']
      .map((p) => readFileSync(join(process.cwd(), p), 'utf8'))
      .join('\n')
    expect(quellen).not.toMatch(/magicLink|magic-link/i)
    expect(quellen).toContain('sendVerificationOtp')
    expect(quellen).toContain('signIn.emailOtp')
  })
})
