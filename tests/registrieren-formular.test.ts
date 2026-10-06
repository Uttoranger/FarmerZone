/**
 * Registrieren im neuen Design (Nr. 15): Passwortstärke, Pflichtfelder,
 * EIN Namensfeld, Hofname bis Einrichten — und das Formular selbst
 * (gerendert, mit Gegenprobe).
 */
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/register' }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/actions/register', () => ({ registerFarmer: vi.fn() }))
vi.mock('@/server/actions/onboarding', () => ({ checkSlugAvailability: vi.fn(), createFarm: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ signIn: { email: vi.fn() } }))

import { passwortStaerke, validatePassword } from '@/lib/password-rules'
import { registrierenFehler, registrationSchema, vollerName, type RegistrierenFormular } from '@/schemas/register'
import {
  HOFNAME_ENTWURF_SCHLUESSEL,
  leseHofnameEntwurf,
  loescheHofnameEntwurf,
  schreibeHofnameEntwurf,
} from '@/lib/hofname-entwurf'
import { RegisterForm } from '@/app/(auth)/register/register-form'

describe('passwortStaerke', () => {
  it('leer: keine Balken, sagt die Regeln', () => {
    expect(passwortStaerke('')).toEqual({
      balken: 0,
      gueltig: false,
      text: 'Mindestens 8 Zeichen, mit Groß- und Kleinbuchstaben und einer Zahl.',
    })
  })

  it('zu schwach: sagt, was fehlt', () => {
    expect(passwortStaerke('abc')).toMatchObject({ balken: 1, gueltig: false })
    expect(passwortStaerke('abc').text).toBe('Zu schwach – es fehlen: mindestens 8 Zeichen, ein Großbuchstabe, eine Zahl')
    expect(passwortStaerke('Abcdefgh')).toMatchObject({ balken: 2, text: 'Zu schwach – es fehlt: eine Zahl' })
  })

  it('gut ab den Regeln des Servers, sehr gut ab 12 Zeichen', () => {
    expect(passwortStaerke('Abcdefg1')).toEqual({ balken: 3, gueltig: true, text: 'Gut – mindestens 8 Zeichen' })
    expect(passwortStaerke('Abcdefghijk1')).toMatchObject({ balken: 4, gueltig: true })
  })

  it('verspricht nie mehr als validatePassword', () => {
    for (const pw of ['', 'a', 'abcdefgh', 'ABCDEFG1', 'Abcdefg1', 'Abcdefghijkl', 'Abcdefghijk1']) {
      expect(passwortStaerke(pw).gueltig, pw).toBe(validatePassword(pw).valid)
    }
  })
})

const GUELTIG: RegistrierenFormular = {
  hofname: 'Hof Test',
  name: 'Max Mustermann',
  email: 'max@example.com',
  password: 'Abcdefg1',
  konditionen: true,
}

describe('registrierenFehler — Pflichtfelder', () => {
  it('ein vollständiges Formular hat keine Fehler', () => {
    expect(registrierenFehler(GUELTIG)).toEqual({})
  })

  it('leer: jedes Feld meldet sich, mit Ausweg im Satz', () => {
    const fehler = registrierenFehler({ hofname: '', name: '', email: '', password: '', konditionen: false })
    expect(Object.keys(fehler).sort()).toEqual(['email', 'hofname', 'konditionen', 'name', 'password'])
    expect(fehler.hofname).toBe('Bitte gib den Namen deines Hofs an.')
    expect(fehler.konditionen).toBe('Bitte bestätige die Konditionen für Höfe.')
  })

  it('ohne Haken bei den Konditionen geht es nicht', () => {
    expect(registrierenFehler({ ...GUELTIG, konditionen: false })).toEqual({ konditionen: 'Bitte bestätige die Konditionen für Höfe.' })
  })

  it('Leerzeichen allein sind kein Hofname, 81 Zeichen sind zu lang', () => {
    expect(registrierenFehler({ ...GUELTIG, hofname: '   ' }).hofname).toBeDefined()
    expect(registrierenFehler({ ...GUELTIG, hofname: 'a'.repeat(81) }).hofname).toContain('höchstens 80 Zeichen')
  })

  it('ein zu schwaches Passwort lehnt das Formular ab wie der Server', () => {
    expect(registrierenFehler({ ...GUELTIG, password: 'abcdefgh' }).password).toBeDefined()
    expect(registrationSchema.safeParse({ email: GUELTIG.email, password: 'abcdefgh', name: GUELTIG.name }).success).toBe(false)
  })
})

describe('vollerName — EIN Namensfeld', () => {
  it('ein leerer Nachname hängt kein Leerzeichen an', () => {
    expect(vollerName('Max Mustermann', '')).toBe('Max Mustermann')
    expect(vollerName(' Max ', ' Mustermann ')).toBe('Max Mustermann')
  })
})

function speicher(start: Record<string, string> = {}) {
  const daten = new Map(Object.entries(start))
  return {
    daten,
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => void daten.set(k, v),
    removeItem: (k: string) => void daten.delete(k),
  }
}

const kaputt = {
  getItem: () => {
    throw new Error('gesperrt')
  },
  setItem: () => {
    throw new Error('gesperrt')
  },
  removeItem: () => {
    throw new Error('gesperrt')
  },
}

describe('Hofname vom Registrieren bis Einrichten', () => {
  it('schreibt, liest und löscht den Namen ohne Ränder', () => {
    const s = speicher()
    schreibeHofnameEntwurf(s, '  Hof Test ')
    expect(s.daten.get(HOFNAME_ENTWURF_SCHLUESSEL)).toBe('Hof Test')
    expect(leseHofnameEntwurf(s)).toBe('Hof Test')
    loescheHofnameEntwurf(s)
    expect(leseHofnameEntwurf(s)).toBeNull()
  })

  it('verwirft, was kein brauchbarer Name ist', () => {
    expect(leseHofnameEntwurf(speicher({ [HOFNAME_ENTWURF_SCHLUESSEL]: 'x'.repeat(81) }))).toBeNull()
    expect(leseHofnameEntwurf(speicher({ [HOFNAME_ENTWURF_SCHLUESSEL]: '   ' }))).toBeNull()
    const s = speicher()
    schreibeHofnameEntwurf(s, '')
    expect(s.daten.size).toBe(0)
  })

  it('wirft nie — auch nicht ohne Speicher oder mit gesperrtem', () => {
    expect(leseHofnameEntwurf(null)).toBeNull()
    expect(leseHofnameEntwurf(kaputt)).toBeNull()
    expect(() => schreibeHofnameEntwurf(kaputt, 'Hof Test')).not.toThrow()
    expect(() => loescheHofnameEntwurf(kaputt)).not.toThrow()
  })
})

describe('RegisterForm — gerendert', () => {
  const html = renderToStaticMarkup(createElement(RegisterForm, { formToken: 'token' }))

  it('Felder nach Mockup: Hofname mit Adresse, ein Name, E-Mail, Passwort mit Stärke, Haken', () => {
    for (const text of ['Name deines Hofs', 'Wird zu deiner Adresse: farmerzone.at/dein-hof', 'Dein Name', 'E-Mail', 'Passwort', 'Konto erstellen']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('Mindestens 8 Zeichen, mit Groß- und Kleinbuchstaben und einer Zahl.')
  })

  it('der Haken verweist auf die Konditionen — eine AGB-Seite gibt es nicht', () => {
    expect(html).toContain('href="/konditionen"')
    expect(html).not.toMatch(/AGB/)
  })

  it('Honigtopf und Zeitschranke bleiben', () => {
    expect(html).toContain('name="website"')
    expect(html).toContain('tabindex="-1"')
  })

  it('kein maxLength an den Feldern (CODING_STANDARDS §8)', () => {
    expect(html).not.toMatch(/maxlength/i)
  })
})
