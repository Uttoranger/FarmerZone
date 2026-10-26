/**
 * Passkey für Höfe (Register E7, Ergänzung 25.10.2026; Nr. 179) — Texte und
 * Oberfläche ohne Datenbank: der Name „Gerät · Datum, Uhrzeit", der Fehlersatz
 * für Höfe, die Karte auf Konto und Sicherheit (vor dem Einrichten, mit
 * Passkeys, Admin mit Hof) und der Knopf auf /login. Wer einrichten darf,
 * prüft tests/admin-anmeldung.test.ts (registrierungsFall, Fall `hof`); die
 * Wege gegen echtes Postgres samt Gerät tests/integration/admin-passkey.int.test.ts.
 *
 * Gegenproben: Jede gesuchte Abwesenheit steht neben einem Fund desselben
 * Merkmals in einem anderen Zustand.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/account',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signIn: { email: vi.fn() }, signOut: vi.fn(), useSession: () => ({ data: null, isPending: false }) }))
vi.mock('@/lib/auth-client-passkey', () => ({ passkeySignIn: { passkey: vi.fn() }, passkeyEinrichten: { addPasskey: vi.fn() } }))
vi.mock('@/server/actions/hof-passkey', () => ({ pruefeFrischFuerHofPasskey: vi.fn(), entferneHofPasskey: vi.fn(), benenneHofPasskeyUm: vi.fn() }))

import { ADMIN_ANMELDEN_FEHLER, ADMIN_PFAD } from '@/lib/admin-anmeldung'
import { HOF_PASSKEY_ANMELDEN, HOF_PASSKEY_TEXT, hofPasskeyFehlerText, passkeyAnzeigeName } from '@/lib/hof-passkey'
import { PasskeyKarte } from '@/app/(hof)/settings/account/passkey-karte'
import { HofAnmeldung } from '@/components/anmelden/hof-anmeldung'

/** Der sichtbare Text ohne Tags — Attribute zählen nicht mit. */
const textVon = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('Name in der Liste: „Gerät · Datum, Uhrzeit"', () => {
  it('Wiener Zeit, zwei Passkeys vom selben Gerätetyp sind unterscheidbar', () => {
    const a = passkeyAnzeigeName('iPhone · Safari', new Date('2026-10-25T13:03:00Z'))
    const b = passkeyAnzeigeName('iPhone · Safari', new Date('2026-10-25T13:04:00Z'))
    expect(a).toBe('iPhone · Safari · 25.10., 14:03')
    expect(b).not.toBe(a)
  })

  it('ohne Namen „Passkey", ohne Zeitpunkt nur der Name', () => {
    expect(passkeyAnzeigeName(null, new Date('2026-03-01T08:00:00Z'))).toBe('Passkey · 1.3., 09:00')
    expect(passkeyAnzeigeName('  ', null)).toBe('Passkey')
    expect(passkeyAnzeigeName('Schlüssel am Bund', null)).toBe('Schlüssel am Bund')
  })
})

describe('Fehlersatz für Höfe', () => {
  it('ein unbekannter Passkey verweist auf Passwort und Konto und Sicherheit, nicht auf ein Admin-Konto', () => {
    expect(hofPasskeyFehlerText({ code: 'PASSKEY_NOT_FOUND' })).toBe(HOF_PASSKEY_ANMELDEN.unbekannt)
    expect(HOF_PASSKEY_ANMELDEN.unbekannt).not.toContain('Admin')
  })

  it('alle anderen Fälle wie bei Admins (abgebrochen, Nutzerprüfung, Admin-Konto)', () => {
    expect(hofPasskeyFehlerText({ code: 'AUTH_CANCELLED' })).toBe(ADMIN_ANMELDEN_FEHLER.abgebrochen)
    expect(hofPasskeyFehlerText({ code: 'NUTZERPRUEFUNG_FEHLT' })).toBe(ADMIN_ANMELDEN_FEHLER.nutzerpruefung)
    expect(hofPasskeyFehlerText({ code: 'PASSKEY_NICHT_FUER_ADMIN' })).toBe(ADMIN_ANMELDEN_FEHLER.nichtFuerAdmin)
    expect(hofPasskeyFehlerText(null)).toBe(ADMIN_ANMELDEN_FEHLER.allgemein)
  })
})

describe('Karte auf Konto und Sicherheit', () => {
  const zeilen = [
    { id: 'pk-1', name: 'iPhone · Safari', anzeige: 'iPhone · Safari · 25.10., 14:03' },
    { id: 'pk-2', name: 'Windows · Chrome', anzeige: 'Windows · Chrome · 25.10., 14:20' },
  ]

  it('vor dem Einrichten: Titel, Satz und EIN oranger Knopf — am Handy „Auf diesem Handy", ab 768 px „Auf diesem Gerät"', () => {
    const html = renderToStaticMarkup(createElement(PasskeyKarte, { passkeys: [] }))
    const text = textVon(html)
    expect(text).toContain(HOF_PASSKEY_TEXT.titel)
    expect(text).toContain(HOF_PASSKEY_TEXT.satz)
    expect(html).toMatch(new RegExp(`<span class="md:hidden">${HOF_PASSKEY_TEXT.einrichtenHandy}</span>`))
    expect(html).toMatch(new RegExp(`<span class="hidden md:inline">${HOF_PASSKEY_TEXT.einrichtenGeraet}</span>`))
    expect(html.match(/bg-primary text-primary-foreground/g)).toHaveLength(1)
    // Gegenprobe zur Liste unten: ohne Passkey weder Liste noch „Weiteren hinzufügen".
    expect(text).not.toContain(HOF_PASSKEY_TEXT.weiterer)
    expect(text).not.toContain(HOF_PASSKEY_TEXT.entfernen)
  })

  it('mit Passkeys: Liste „Gerät · Datum, Uhrzeit", je Zeile Umbenennen und Entfernen mit Namen, „Weiteren Passkey hinzufügen" statt des orangen Knopfs', () => {
    const html = renderToStaticMarkup(createElement(PasskeyKarte, { passkeys: zeilen }))
    const text = textVon(html)
    for (const z of zeilen) {
      expect(text).toContain(z.anzeige)
      expect(html).toContain(`aria-label="${HOF_PASSKEY_TEXT.entfernen}: ${z.anzeige}"`)
      expect(html).toContain(`aria-label="${HOF_PASSKEY_TEXT.umbenennen}: ${z.anzeige}"`)
    }
    expect(text).toContain(HOF_PASSKEY_TEXT.weiterer)
    expect(text).not.toContain(HOF_PASSKEY_TEXT.einrichtenHandy)
    expect(html).not.toMatch(/bg-primary text-primary-foreground/)
    // Touch-Ziele 44 px an jedem Knopf der Zeilen.
    expect(html.match(/min-h-11/g)?.length ?? 0).toBeGreaterThanOrEqual(5)
  })

  it('Admin mit Hof (N20): nur der Weg zur Anmeldung im Admin-Bereich — keine Liste, kein Einrichten', () => {
    const html = renderToStaticMarkup(createElement(PasskeyKarte, { passkeys: zeilen, fuerAdmin: true }))
    const text = textVon(html)
    expect(text).toContain(HOF_PASSKEY_TEXT.adminSatz)
    expect(html).toContain(`href="${ADMIN_PFAD.anmeldung}"`)
    expect(text).not.toContain(zeilen[0].anzeige)
    expect(text).not.toContain(HOF_PASSKEY_TEXT.einrichtenHandy)
    expect(text).not.toContain(HOF_PASSKEY_TEXT.satz)
  })
})

describe('/login: Hof-Karte mit Passkey', () => {
  it('„Mit Passkey anmelden" zusätzlich zum Passwort — als eigener Knopf, nicht als Absenden; „Anmelden" bleibt die orange Hauptaktion', () => {
    const html = renderToStaticMarkup(createElement(HofAnmeldung))
    expect(html).toMatch(new RegExp(`<button type="button"[^>]*>(?:(?!</button>).)*${HOF_PASSKEY_ANMELDEN.knopf}</button>`))
    expect(html).toMatch(/<button type="submit"[^>]*bg-primary[^>]*>/)
    // Der kleine Link zur Admin-Anmeldung heißt anders als der Knopf — sonst stünde „Mit Passkey anmelden" zweimal da.
    expect(textVon(html).split(HOF_PASSKEY_ANMELDEN.knopf)).toHaveLength(2)
    expect(html).toContain(`href="${ADMIN_PFAD.anmelden}"`)
  })

  it('das Passwortfeld bekommt die Feldform über `feld` (46 px, 16 px Schrift) wie das E-Mail-Feld', () => {
    const html = renderToStaticMarkup(createElement(HofAnmeldung))
    const passwort = html.match(/<input[^>]*type="password"[^>]*>/)?.[0] ?? ''
    const email = html.match(/<input[^>]*type="email"[^>]*>/)?.[0] ?? ''
    expect(passwort).toContain('h-[46px]')
    expect(passwort).toContain('text-base')
    expect(email).toContain('h-[46px]')
  })
})
