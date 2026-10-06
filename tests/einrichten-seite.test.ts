/**
 * Die Seite „Hof einrichten" (Nr. 15), gerendert: ohne Hof das Formular,
 * mit Hof Links in die bestehenden Seiten — nie ein Eingabefeld für SEPA,
 * nie ein Stripe-Aufruf. Dazu das strengere Formular-Schema „Hof anlegen".
 */
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/actions/onboarding', () => ({ checkSlugAvailability: vi.fn(), createFarm: vi.fn() }))
vi.mock('@/server/actions/email-bestaetigung', () => ({ sendeBestaetigungErneut: vi.fn() }))

import { EinrichtenSeite } from '@/components/einrichten/einrichten-seite'
import { einrichtenStand, type EinrichtenDaten } from '@/lib/einrichten'
import { hofAnlegenFormularSchema, hofAnlegenSchema } from '@/schemas/hofprofil'

const person = { name: 'Max Mustermann', email: 'max@example.com' }

function seite(hof: EinrichtenDaten['hof']): string {
  return renderToStaticMarkup(
    createElement(EinrichtenSeite, {
      stand: einrichtenStand({ personName: person.name, email: person.email, hof }),
      vorname: 'Max',
      person,
      tarif: null,
      freigeschaltet: hof?.freigeschaltet ?? false,
    })
  )
}

const HOF = {
  name: 'Hof Test',
  hofseite: { erledigt: 7, gesamt: 11, fehlend: ['Logo'] },
  produkte: 0,
  stripeBereit: false,
  freigeschaltet: false,
}

describe('EinrichtenSeite', () => {
  // Die Vorbelegung (Name, E-Mail, Hofname) setzt react-hook-form erst im
  // Browser — geprüft in der Browser-Abnahme, nicht hier.
  it('ohne Hof: Willkommen und das Formular „Hof anlegen" mit allen Feldern', () => {
    const html = seite(null)
    expect(html).toContain('Willkommen, Max')
    expect(html).toContain('Hof anlegen')
    for (const label of ['Name deines Hofs', 'Vor- und Nachname', 'Straße und Hausnummer', 'PLZ', 'Ort', 'Telefon']) {
      expect(html).toContain(label)
    }
    expect(html).not.toContain('href="/settings/payments"')
  })

  it('mit Hof: kein Formular, Links zu Mein Hof, Produkte und Stripe-Einrichtung', () => {
    const html = seite(HOF)
    expect(html).not.toContain('<form')
    for (const ziel of ['/farm-page', '/products?neu=1', '/settings/payments']) expect(html).toContain(`href="${ziel}"`)
  })

  it('Gegenprobe: ohne Hof steht ein Formular im Dokument', () => {
    expect(seite(null)).toContain('<form')
  })

  it('SEPA nur als Hinweis — kein Eingabefeld, kein Link', () => {
    const html = seite(HOF)
    expect(html).toContain('SEPA-Mandat für die Monatsabrechnung')
    expect(html).not.toMatch(/IBAN<\/label>|name="iban"/i)
  })

  it('Tarif-Karte ohne gewählten Tarif: beide Tarife, Link zu den Konditionen', () => {
    const html = seite(HOF)
    expect(html).toContain('Hoftor')
    expect(html).toContain('Hofladen')
    expect(html).toContain('href="/konditionen"')
  })

  it('Hilfe per E-Mail statt Rückruf (RueckrufAnfrage nicht freigegeben)', () => {
    const html = seite(HOF)
    expect(html).toContain('mailto:')
    expect(html).not.toContain('Rückruf')
  })
})

describe('hofAnlegenFormularSchema — strenger als createFarm', () => {
  const gueltig = {
    name: 'Hof Test',
    ownerName: 'Max Mustermann',
    description: '',
    address: 'Teststraße 1',
    postalCode: '1010',
    city: 'Wien',
    phone: '+43 660 0000000',
    email: '',
  }

  it('nimmt ein vollständiges Formular, die Hof-E-Mail darf leer bleiben', () => {
    expect(hofAnlegenFormularSchema.safeParse(gueltig).success).toBe(true)
  })

  it('Pflichtfelder und PLZ mit vier Ziffern', () => {
    const ergebnis = hofAnlegenFormularSchema.safeParse({ ...gueltig, name: ' ', address: '', postalCode: '10100', phone: '123' })
    expect(ergebnis.success).toBe(false)
    const felder = ergebnis.success ? [] : ergebnis.error.issues.map((i) => i.path[0])
    expect(felder.sort()).toEqual(['address', 'name', 'phone', 'postalCode'])
  })

  it('der Server bleibt nachsichtig wie bisher (hofAnlegenSchema unverändert)', () => {
    expect(hofAnlegenSchema.safeParse({ ...gueltig, postalCode: '10100' }).success).toBe(true)
  })
})

describe('EinrichtenSeite — E-Mail noch nicht bestätigt (S3, Nr. 17b)', () => {
  function mitHinweis(emailBestaetigung: { email: string; warteSekunden: number } | null): string {
    return renderToStaticMarkup(
      createElement(EinrichtenSeite, {
        stand: einrichtenStand({ personName: person.name, email: person.email, hof: HOF, emailOffen: emailBestaetigung !== null }),
        vorname: 'Max',
        person,
        tarif: null,
        freigeschaltet: false,
        emailBestaetigung,
      })
    )
  }

  it('zeigt „Bestätige deine E-Mail" mit Adresse und „E-Mail erneut senden" — Einrichten bleibt offen', () => {
    const html = mitHinweis({ email: 'max@example.com', warteSekunden: 0 })
    expect(html).toContain('Bestätige deine E-Mail')
    expect(html).toContain('max@example.com')
    expect(html).toContain('E-Mail erneut senden')
    expect(html).toContain('href="/verify"')
    for (const ziel of ['/farm-page', '/products?neu=1']) expect(html).toContain(`href="${ziel}"`)
  })

  it('der Knopf wartet sichtbar, solange die Bremse greift', () => {
    expect(mitHinweis({ email: 'max@example.com', warteSekunden: 42 })).toContain('E-Mail erneut senden (42 s)')
  })

  it('Gegenprobe: ohne offene Bestätigung kein Hinweis', () => {
    const html = mitHinweis(null)
    expect(html).not.toContain('Bestätige deine E-Mail')
    expect(html).not.toContain('E-Mail erneut senden')
  })
})
