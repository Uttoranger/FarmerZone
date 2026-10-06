/**
 * Die Seite „Meine Bestellungen" (/bestellungen, Nr. 14) — echte Seite und
 * echte Bausteine, gerendert mit renderToStaticMarkup; Datenbankschicht,
 * Cookies und Shell gemockt.
 *
 * Beweist:
 *  - Ohne Cookie, mit manipuliertem Cookie: das Formular, keine Abfrage, keine
 *    Daten. Mit abgelaufenem Cookie: das Formular und der Hinweis
 *    „abgelaufen", keine Abfrage.
 *  - Mit gültigem Cookie: genau die Adresse aus dem Cookie wird abgefragt;
 *    laufende oben, frühere darunter; jede Bestellung nur über ihren
 *    signierten Link; Beträge über formatEuro.
 *  - Leer: Satz und Ausweg (Höfe entdecken, andere Adresse). Fehler beim
 *    Laden: inline, mit Ausweg, Sentry ohne Adresse.
 *  - Lange Hofnamen (80 Zeichen) kürzen und stehen voll im title.
 *  - Nicht gebaut (E8/S11): „Nochmal bestellen", „Meine Höfe", „Konto löschen",
 *    „Neuigkeiten", „Merken".
 *  - noindex, kein Referrer, dynamisch.
 *  - Sentry-Hygiene: Cookie und POST-Körper (E-Mail, Code) einer Anfrage an
 *    die Seite gehen nie mit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('server-only', () => ({}))

const kontext = vi.hoisted(() => ({ keks: undefined as string | undefined }))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => (name === 'fz-bestellungen' && kontext.keks ? { value: kontext.keks } : undefined) })),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/bestellungen-finden', () => ({ ladeBestellungenZurAdresse: vi.fn(async () => []) }))
vi.mock('@/server/actions/bestellungen-finden', () => ({
  beendeBestellAnsicht: vi.fn(),
  fordereBestellCodeAn: vi.fn(),
  zeigeBestellungen: vi.fn(),
}))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: (p: { unterleiste?: boolean; children?: ReactNode }) =>
    createElement('div', { 'data-shell': 'kunde', 'data-unterleiste': String(p.unterleiste ?? true) }, p.children),
}))

import * as Sentry from '@sentry/nextjs'
import BestellungenSeite, { metadata, dynamic } from '@/app/(public)/bestellungen/page'
import { ladeBestellungenZurAdresse } from '@/server/bestellungen-finden'
import { bestellZugangsToken } from '@/lib/bestellungen-zugang'
import { BESTELLUNGEN_ANSICHT_SEKUNDEN, type ListenBestellung } from '@/lib/bestellungen-finden'
import { bereinigeEreignis } from '@/lib/sentry-hygiene'

const laden = vi.mocked(ladeBestellungenZurAdresse)

async function render(): Promise<string> {
  return renderToStaticMarkup(await BestellungenSeite())
}

function bestellung(teil: Partial<ListenBestellung> = {}): ListenBestellung {
  return {
    id: 'b1',
    link: '/hof-test/confirm/b1?sig=abc123',
    hofName: 'Hof Test',
    bestellnummer: 'HT-0001',
    status: 'READY',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    gesamtCents: 1082,
    artikel: 2,
    ...teil,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  kontext.keks = undefined
})

describe('ohne bewiesene Adresse', () => {
  it('zeigt das Formular und fragt nichts ab', async () => {
    const html = await render()
    expect(html).toContain('Meine Bestellungen')
    expect(html).toContain('Code schicken')
    expect(html).toContain('ein Konto brauchst du dafür nicht')
    expect(html).not.toContain('Kein Passwort nötig')
    expect(html).not.toContain('abgelaufen')
    expect(laden).not.toHaveBeenCalled()
  })

  it('manipulierter Cookie: wie ohne — keine Daten, kein Hinweis', async () => {
    const echt = bestellZugangsToken('kundin@example.com', new Date())
    const [, ablauf, signatur] = echt.split('.')
    kontext.keks = `${Buffer.from('andere@example.com').toString('base64url')}.${ablauf}.${signatur}`
    const html = await render()
    expect(html).toContain('Code schicken')
    expect(html).not.toContain('andere@example.com')
    expect(laden).not.toHaveBeenCalled()
  })

  it('abgelaufener Cookie: Formular mit Hinweis, keine Daten', async () => {
    kontext.keks = bestellZugangsToken('kundin@example.com', new Date(Date.now() - BESTELLUNGEN_ANSICHT_SEKUNDEN * 1000 - 1000))
    const html = await render()
    expect(html).toContain('Deine Ansicht ist abgelaufen')
    expect(html).toContain('Code schicken')
    expect(html).not.toContain('kundin@example.com')
    expect(laden).not.toHaveBeenCalled()
  })
})

describe('mit bewiesener Adresse', () => {
  beforeEach(() => {
    kontext.keks = bestellZugangsToken('kundin@example.com', new Date())
  })

  it('fragt genau die Adresse aus dem Cookie ab; laufend oben, früher darunter, je mit signiertem Link', async () => {
    laden.mockResolvedValueOnce([
      bestellung({ id: 'alt', status: 'PICKED_UP', link: '/hof-test/confirm/alt?sig=def456', pickupDate: new Date(Date.now() - 9 * 24 * 3600_000), hofName: 'Bergbauernhof' }),
      bestellung(),
    ])
    const html = await render()
    expect(laden).toHaveBeenCalledWith('kundin@example.com', expect.any(Date))
    expect(html.indexOf('Aktuell')).toBeLessThan(html.indexOf('Früher'))
    expect(html.indexOf('Abholbereit')).toBeLessThan(html.indexOf('Bergbauernhof'))
    expect(html).toContain('href="/hof-test/confirm/b1?sig=abc123"')
    expect(html).toContain('href="/hof-test/confirm/alt?sig=def456"')
    // Kein Link ohne Signatur zu einer Bestellung.
    expect(html).not.toMatch(/href="\/[^"]*\/confirm\/[^"?]*"/)
    expect(html).toContain('€ 10,82')
    expect(html).toContain('kundin@example.com')
    expect(html).toContain('Abmelden')
  })

  it('leer: Satz und Ausweg — Höfe entdecken, andere E-Mail-Adresse', async () => {
    const html = await render()
    expect(html).toContain('Keine Bestellungen gefunden')
    expect(html).toContain('href="/hoefe"')
    expect(html).toContain('Andere E-Mail-Adresse')
  })

  it('lange Hofnamen kürzen und stehen voll im title', async () => {
    const lang = 'Hof '.padEnd(80, 'x')
    laden.mockResolvedValueOnce([bestellung({ hofName: lang }), bestellung({ id: 'f', status: 'PICKED_UP', hofName: lang, pickupDate: new Date(Date.now() - 9 * 24 * 3600_000) })])
    const html = await render()
    expect(html).toContain(`title="HT-0001 · ${lang}"`)
    expect(html).toContain(`title="${lang}"`)
    expect(html).toMatch(/truncate[^"]*" title="HT-0001/)
  })

  it('Fehler beim Laden: inline mit Ausweg, Sentry ohne Adresse', async () => {
    laden.mockRejectedValueOnce(new Error('Verbindung für kundin@example.com abgelehnt'))
    const html = await render()
    expect(html).toContain('Wir konnten deine Bestellungen gerade nicht laden')
    expect(html).toContain('href="/bestellungen"')
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)).not.toContain('kundin@example.com')
  })

  it('E8/S11: nichts davon, was nicht gebaut wird', async () => {
    laden.mockResolvedValueOnce([bestellung(), bestellung({ id: 'f', status: 'PICKED_UP', pickupDate: new Date(Date.now() - 9 * 24 * 3600_000) })])
    const html = await render()
    for (const verboten of ['Nochmal', 'Meine Höfe', 'Konto löschen', 'Neuigkeiten', 'Merken', 'Abholerinnerung']) {
      expect(html, verboten).not.toContain(verboten)
    }
  })

  it('steht in der KundeShell mit Unterleiste (Bestellungen ist ein Ziel der Leiste)', async () => {
    const html = await render()
    expect(html).toContain('data-shell="kunde"')
    expect(html).toContain('data-unterleiste="true"')
  })
})

describe('Seite', () => {
  it('noindex, kein Referrer, dynamisch', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.referrer).toBe('no-referrer')
    expect(dynamic).toBe('force-dynamic')
  })

  it('Sentry: Cookie und POST-Körper (E-Mail, Code) einer Anfrage an die Seite gehen nie mit', () => {
    const keks = bestellZugangsToken('kundin@example.com', new Date())
    const ereignis = bereinigeEreignis({
      message: 'Fehler beim Code 481234 für kundin@example.com',
      request: {
        url: 'https://farmerzone.example/bestellungen',
        cookies: { 'fz-bestellungen': keks },
        headers: { cookie: `fz-bestellungen=${keks}` },
        data: { email: 'kundin@example.com', code: '481234' },
      },
    })
    const text = JSON.stringify(ereignis)
    expect(text).not.toContain(keks)
    expect(text).not.toContain('kundin@example.com')
    expect(text).not.toContain('481234')
  })
})
