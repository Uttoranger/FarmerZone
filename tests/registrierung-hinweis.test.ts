/**
 * Registrierung mit vergebener Adresse (Register F6 „19b", Nachtlauf Nr. 27):
 * dieselbe Antwort wie bei Erfolg, dazu eine Mail an das bestehende Konto.
 *
 * Beweist ohne Datenbank:
 *  - Die reinen Regeln (src/lib/registrierung-hinweis.ts): Kennung der
 *    Bremse je Konto, Fenster, welcher Weg zum Konto passt (Kundin: Code,
 *    Hof/Betreiber: Passwort) und welche Links die Mail trägt.
 *  - Die Mail: deutsch, geduzt, mit beiden Auswegen für Höfe; einer Kundin
 *    nie „Passwort zurücksetzen" (sie meldet sich mit Code an). Gegenprobe
 *    je Merkmal.
 *  - Die Auth-Einstellung: Better Auth antwortet auf eine vergebene Adresse
 *    neutral (`autoSignIn: false`) und meldet sie über `onExistingUserSignUp`,
 *    die Mail geht dort über `nachDerAntwort` raus.
 *  - Das Formular meldet nach dem Registrieren nicht mehr selbst an (sonst
 *    verriete das Scheitern der Anmeldung die vergebene Adresse) und zeigt
 *    „Schau in dein Postfach".
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import {
  REGISTRIERUNG_HINWEIS_FENSTER_SEKUNDEN,
  registrierungsHinweisKennung,
  registrierungsHinweisWeg,
  registrierungsHinweisZiele,
} from '@/lib/registrierung-hinweis'
import { RegistrierungHinweisEmail } from '@/emails/registrierung-hinweis'
import { PostfachHinweis } from '@/app/(auth)/register/postfach-hinweis'

const quelle = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('Regeln', () => {
  it('höchstens eine Mail je Konto in 24 Stunden', () => {
    expect(REGISTRIERUNG_HINWEIS_FENSTER_SEKUNDEN).toBe(24 * 60 * 60)
  })

  it('die Bremse hängt am Konto, nicht an der Adresse (keine Adresse in der Datenbankzeile)', () => {
    expect(registrierungsHinweisKennung('user_1')).toBe('registrierung-hinweis-user_1')
    expect(registrierungsHinweisKennung('user_1')).not.toContain('@')
  })

  it('Kundin: Anmelden mit Code — Hof und Betreiber: Passwort', () => {
    expect(registrierungsHinweisWeg({ role: 'CUSTOMER', isAdmin: false })).toBe('code')
    expect(registrierungsHinweisWeg({ role: 'FARMER', isAdmin: false })).toBe('passwort')
    expect(registrierungsHinweisWeg({ role: 'ADMIN', isAdmin: false })).toBe('passwort')
    expect(registrierungsHinweisWeg({ role: 'CUSTOMER', isAdmin: true })).toBe('passwort')
  })

  it('die Links passen zum Weg: Hof /login und /forgot-password, Kundin nur /account/login', () => {
    expect(registrierungsHinweisZiele('passwort', 'https://farmerzone.example')).toEqual({
      anmelden: 'https://farmerzone.example/login',
      passwortZuruecksetzen: 'https://farmerzone.example/forgot-password',
    })
    expect(registrierungsHinweisZiele('code', 'https://farmerzone.example')).toEqual({
      anmelden: 'https://farmerzone.example/account/login',
      passwortZuruecksetzen: null,
    })
  })
})

describe('Mail an das bestehende Konto', () => {
  function html(weg: 'passwort' | 'code'): string {
    return renderToStaticMarkup(
      createElement(RegistrierungHinweisEmail, { weg, ...registrierungsHinweisZiele(weg, 'https://farmerzone.example') })
    )
  }

  it('Hof: sagt, was passiert ist, mit beiden Auswegen (anmelden, Passwort zurücksetzen)', () => {
    const text = html('passwort')
    expect(text).toContain('jemand wollte sich mit deiner E-Mail-Adresse bei FarmerZone registrieren')
    expect(text).toContain('href="https://farmerzone.example/login"')
    expect(text).toContain('href="https://farmerzone.example/forgot-password"')
    expect(text).toContain('Passwort zurücksetzen')
    expect(text).toContain('kannst du diese E-Mail ignorieren')
  })

  it('Kundin: Anmelden mit Code, kein Passwort-Link', () => {
    const text = html('code')
    expect(text).toContain('href="https://farmerzone.example/account/login"')
    expect(text).toContain('Code')
    expect(text).not.toContain('forgot-password')
    expect(text).not.toContain('Passwort zurücksetzen')
  })

  it('der Versand nennt die Adresse nicht im Betreff', () => {
    const email = quelle('src/lib/email.ts')
    const zeile = email.split('\n').find((z) => z.includes("'Jemand wollte sich mit deiner Adresse registrieren · FarmerZone'"))
    expect(zeile).toBeDefined()
    expect(zeile).not.toMatch(/\$\{/)
  })
})

describe('Better Auth: neutrale Antwort und Mail nach der Antwort', () => {
  const auth = quelle('src/lib/auth.ts')

  it('autoSignIn: false — Better Auth antwortet auf eine vergebene Adresse wie bei Erfolg (Scheinkonto, gehashtes Passwort)', () => {
    expect(auth).toMatch(/autoSignIn:\s*false/)
  })

  it('onExistingUserSignUp schickt den Hinweis über nachDerAntwort', () => {
    const block = auth.slice(auth.indexOf('onExistingUserSignUp'), auth.indexOf('onExistingUserSignUp') + 600)
    expect(block).toContain('nachDerAntwort')
    expect(block).toContain('sendeRegistrierungsHinweis')
  })
})

describe('Formular: nach dem Registrieren „Schau in dein Postfach", keine Anmeldung', () => {
  it('meldet nicht selbst an — das Scheitern verriete eine vergebene Adresse', () => {
    const formular = quelle('src/app/(auth)/register/register-form.tsx')
    expect(formular).not.toMatch(/signIn\.email/)
    expect(formular).toContain('PostfachHinweis')
  })

  it('der Hinweis nennt die Adresse, den Weg über die Mail und führt zur Anmeldung', () => {
    const text = renderToStaticMarkup(createElement(PostfachHinweis, { email: 'franz@example.com' }))
    expect(text).toContain('Schau in dein Postfach')
    expect(text).toContain('franz@example.com')
    expect(text).toContain('Wir haben dir eine E-Mail geschickt')
    expect(text).toContain('href="/login"')
  })

  it('Gegenprobe: eine andere Adresse steht da, wo sie hingehört', () => {
    const text = renderToStaticMarkup(createElement(PostfachHinweis, { email: 'erika@example.org' }))
    expect(text).toContain('erika@example.org')
    expect(text).not.toContain('franz@example.com')
  })
})
