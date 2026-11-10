/**
 * Die Seite „Hof einrichten" (Nr. 15), gerendert: ohne Hof das Formular,
 * mit Hof Links in die bestehenden Seiten — nie ein Eingabefeld für SEPA,
 * nie ein Stripe-Aufruf. Dazu das strengere Formular-Schema „Hof anlegen".
 */
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/onboarding' }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/actions/onboarding', () => ({ checkSlugAvailability: vi.fn(), createFarm: vi.fn() }))
vi.mock('@/server/actions/email-bestaetigung', () => ({ sendeBestaetigungErneut: vi.fn() }))

import { EinrichtenSeite } from '@/components/einrichten/einrichten-seite'
import { einrichtenStand, type EinrichtenDaten } from '@/lib/einrichten'
import { hofAnlegenFormularSchema, hofAnlegenSchema } from '@/schemas/hofprofil'
import { HOF_EMAIL_TEXT } from '@/lib/hof-kontakt'

const person = { name: 'Max Mustermann', email: 'max@example.com' }

function seite(hof: EinrichtenDaten['hof']): string {
  return renderToStaticMarkup(
    createElement(EinrichtenSeite, {
      stand: einrichtenStand({ personName: person.name, email: person.email, hof }),
      vorname: 'Max',
      person,
      tarif: null,
      freigeschaltet: hof?.freigeschaltet ?? false,
      gebuehrModell: 'bisher',
    })
  )
}

const HOF = {
  name: 'Hof Test',
  hofseite: { erledigt: 7, gesamt: 11, fehlend: ['Logo'] },
  produkte: 0,
  stripeBereit: false,
  abholzeitAktiv: true,
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

  it('Lastschrift nur als Hinweis mit Link zu Deine Konditionen — kein Eingabefeld (Nr. 198)', () => {
    const html = seite(HOF)
    expect(html).toContain('Lastschrift für die Monatsabrechnung')
    expect(html).toContain('href="/settings/konditionen#barzahlung"')
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
    email: 'hof@example.com',
  }

  it('nimmt ein vollständiges Formular mit Hof-E-Mail', () => {
    expect(hofAnlegenFormularSchema.safeParse(gueltig).success).toBe(true)
  })

  it('Nr. 212: ohne Hof-E-Mail (auch nur Leerzeichen) ein Formularfehler am Feld mit dem Satz; ungültig ebenso', () => {
    for (const email of ['', '   ']) {
      const e = hofAnlegenFormularSchema.safeParse({ ...gueltig, email })
      expect(e.success).toBe(false)
      expect(e.success ? [] : e.error.issues.map((i) => [i.path[0], i.message])).toEqual([['email', HOF_EMAIL_TEXT.pflicht]])
    }
    expect(hofAnlegenFormularSchema.safeParse({ ...gueltig, email: 'hof at example' }).success).toBe(false)
  })

  it('Pflichtfelder und PLZ mit vier Ziffern', () => {
    const ergebnis = hofAnlegenFormularSchema.safeParse({ ...gueltig, name: ' ', address: '', postalCode: '10100', phone: '123' })
    expect(ergebnis.success).toBe(false)
    const felder = ergebnis.success ? [] : ergebnis.error.issues.map((i) => i.path[0])
    expect(felder.sort()).toEqual(['address', 'name', 'phone', 'postalCode'])
  })

  it('hofAnlegenSchema bleibt nachsichtig wie bisher (die Pflicht der Hof-E-Mail prüft createFarm zusätzlich, Nr. 212)', () => {
    expect(hofAnlegenSchema.safeParse({ ...gueltig, postalCode: '10100', email: '' }).success).toBe(true)
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
        gebuehrModell: 'bisher',
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

describe('EinrichtenSeite — Lauf 30 (Nr. 228, Boards s2/w2-registrieren)', () => {
  const FERTIG = { ...HOF, hofseite: { erledigt: 11, gesamt: 11, fehlend: [] }, produkte: 3, stripeBereit: true }
  const WARTEN = { farmId: 'farm_test', farmName: 'Hof Test', country: 'AT' }

  function mit(optionen: { hof?: EinrichtenDaten['hof']; kopf?: boolean; modell?: 'bisher' | 'hofpreis' }): string {
    const hof = optionen.hof ?? HOF
    return renderToStaticMarkup(
      createElement(EinrichtenSeite, {
        stand: einrichtenStand({ personName: person.name, email: person.email, hof }),
        vorname: 'Max',
        person,
        tarif: null,
        freigeschaltet: false,
        gebuehrModell: optionen.modell ?? 'bisher',
        kopf: optionen.kopf === false ? null : { hofName: 'Hof Test', warten: WARTEN },
      })
    )
  }
  const anzahl = (html: string, muster: RegExp): number => html.match(muster)?.length ?? 0

  it('in der HofShell genau eine h1 „Hof einrichten“, der Gruß „Willkommen“ ist h2', () => {
    const html = mit({})
    expect(anzahl(html, /<h1[ >]/g)).toBe(1)
    expect(html).toMatch(/<h1[^>]*>Hof einrichten<\/h1>/)
    expect(html).toMatch(/<h2[^>]*>Willkommen, Max<\/h2>/)
  })

  it('ohne Kopf (Fokus-Shell trägt die h1): keine h1 in der Seite, „Willkommen“ bleibt h2', () => {
    const html = mit({ hof: null, kopf: false })
    expect(anzahl(html, /<h1[ >]/g)).toBe(0)
    expect(html).toMatch(/<h2[^>]*>Willkommen, Max<\/h2>/)
  })

  it('Balken je Stand: Schritte offen → „Richte deinen Hof fertig ein“, alles erledigt → „wird noch geprüft“', () => {
    expect(mit({})).toContain('Richte deinen Hof fertig ein – Kundinnen sehen ihn noch nicht')
    expect(mit({})).not.toContain('wird noch geprüft')
    const fertig = mit({ hof: FERTIG })
    expect(fertig).toContain('Dein Hof wird noch geprüft – Kundinnen sehen ihn noch nicht')
    expect(fertig).not.toContain('Richte deinen Hof fertig ein')
  })

  it('freigeschaltet bzw. ohne Warten kein Balken', () => {
    const html = renderToStaticMarkup(
      createElement(EinrichtenSeite, {
        stand: einrichtenStand({ personName: person.name, email: person.email, hof: { ...FERTIG, freigeschaltet: true } }),
        vorname: 'Max',
        person,
        tarif: null,
        freigeschaltet: true,
        gebuehrModell: 'bisher',
        kopf: { hofName: 'Hof Test', warten: null },
      })
    )
    expect(html).not.toContain('Kundinnen sehen ihn noch nicht')
  })

  it('der Stand jedes Schritts steht in Worten sichtbar daneben', () => {
    const html = mit({})
    for (const wort of ['erledigt', 'offen', 'kommt später', 'für Barbestellungen']) expect(html).toContain(`>${wort}</span>`)
  })

  it('kein „Servicegebühr“ nach dem Stichtag: die Tarif-Karte nennt die Plattformgebühr (N38)', () => {
    const html = mit({ modell: 'hofpreis' })
    expect(html).not.toContain('Servicegebühr')
    expect(html).toContain('Die Plattformgebühr (6 %) steckt im Preis, den die Kundin zahlt – online wie bar.')
  })

  it('Gegenprobe: vor dem Stichtag sagt die Tarif-Karte „Servicegebühr“ wie bisher', () => {
    expect(mit({ modell: 'bisher' })).toContain('Servicegebühr')
  })
})
