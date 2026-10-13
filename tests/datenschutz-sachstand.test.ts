/**
 * Die Datenschutzerklärung sagt, was der Code tut (Nachtlauf Nr. 33).
 *
 * Jede Aussage hier ist an die Stelle im Code gebunden, die sie wahr macht —
 * ändert sich der Code, schlägt der Test an und erinnert daran, die Erklärung
 * nachzuziehen:
 *  - Anmeldung: Code aus der E-Mail (E7); der Magic Link ist zu (19b).
 *  - Kein Konto beim Bestellen (E8, 17a); „Bestellungen finden" per Code mit
 *    kurzlebigem Cookie, die Minuten aus derselben Konstante wie die Seite.
 *  - Vercel Web Analytics ist eingebunden — Abschnitt 8 darf nicht sagen, es
 *    gebe keine Analyse-Werkzeuge.
 *  - Sentry ohne Bildschirmaufzeichnung (kein Session Replay).
 *
 * Gerendert mit renderToStaticMarkup (TESTING_GUIDELINES §1), mit Gegenprobe
 * je Suche.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
// Die Kopfzeile liest Sitzung und Pfad im Browser — hier zählt nur der Inhalt.
vi.mock('@/components/shared/kunden-kopf', () => ({ KundenKopf: () => null }))

import DatenschutzPage from '@/app/(public)/datenschutz/page'
import { BESTELLUNGEN_ANSICHT_SEKUNDEN } from '@/lib/bestellungen-finden'
import { GESPERRTE_AUTH_PFADE } from '@/lib/anmeldecode'

const lies = (datei: string): string => readFileSync(join(process.cwd(), datei), 'utf8')

/** Der sichtbare Text der Seite, ohne Tags, Leerraum zusammengezogen. */
function seitenText(): string {
  return renderToStaticMarkup(createElement(DatenschutzPage))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

/** Nennt ein Text einen Link als Anmeldeweg? */
const LINK_ALS_ANMELDEWEG = /magic[\s-]?link|login-link|link zur anmeldung|anmelde-?link/i

describe('Datenschutzerklärung — Anmeldung', () => {
  it('nennt keinen Link mehr als Anmeldeweg, weil der Magic Link zu ist', () => {
    // Gegenprobe Code: Der Magic Link ist wirklich gesperrt (E7, 19b).
    expect(GESPERRTE_AUTH_PFADE).toContain('/sign-in/magic-link')
    expect(GESPERRTE_AUTH_PFADE).toContain('/magic-link/verify')
    // Gegenprobe Suche: Der alte Wortlaut hätte angeschlagen.
    expect('per einmaligem Login-Link (Magic Link)').toMatch(LINK_ALS_ANMELDEWEG)

    expect(seitenText()).not.toMatch(LINK_ALS_ANMELDEWEG)
  })

  it('beschreibt die Anmeldung mit Code aus der E-Mail', () => {
    expect(seitenText()).toMatch(/Kunden-Konto \(Anmeldung mit Code\)/)
    expect(seitenText()).toMatch(/mit einem Code, den wir dir per E-Mail schicken/)
  })
})

describe('Datenschutzerklärung — kein Konto beim Bestellen (E8)', () => {
  it('sagt, dass beim Bestellen kein Konto entsteht — und der Checkout legt keins an', () => {
    // Gegenprobe Code: Die Bestellung entsteht ohne Konto (customerId bleibt leer).
    const checkout = lies('src/app/api/checkout/route.ts')
    expect(checkout).toMatch(/KEIN KUNDENKONTO \(E8/)
    expect(checkout).not.toMatch(/prisma\.user\.(create|upsert)/)
    expect(checkout).not.toMatch(/customerId:/)

    expect(seitenText()).toMatch(/Beim Bestellen wird kein Konto angelegt\./)
  })

  it('nennt „Bestellungen finden" mit Code und die Dauer des Cookies aus derselben Konstante', () => {
    const minuten = BESTELLUNGEN_ANSICHT_SEKUNDEN / 60
    // Gegenprobe: die Konstante ist eine ganze Minutenzahl.
    expect(Number.isInteger(minuten)).toBe(true)
    expect(seitenText()).toMatch(new RegExp(`„Bestellungen finden“ läuft ebenfalls über einen Code per E-Mail`))
    expect(seitenText()).toContain(`für ${minuten} Minuten ein Cookie`)
  })
})

describe('Datenschutzerklärung — Reichweitenmessung', () => {
  it('bestreitet keine Analyse-Werkzeuge, solange Vercel Web Analytics eingebunden ist', () => {
    // Gegenprobe Code: Das Root-Layout bindet Vercel Web Analytics ein.
    expect(lies('src/app/layout.tsx')).toMatch(/from '@vercel\/analytics\/next'/)
    // Gegenprobe Suche: Der alte Satz aus Abschnitt 8 hätte angeschlagen.
    const alterSatz = 'Es werden keine Tracking-Cookies, Werbe-Cookies oder Analyse-Tools eingesetzt.'
    expect(alterSatz).toMatch(/Analyse-Tools eingesetzt/)

    const text = seitenText()
    expect(text).not.toMatch(/Analyse-Tools eingesetzt/)
    expect(text).toMatch(/Vercel Web Analytics/)
  })
})

describe('Datenschutzerklärung — Sentry', () => {
  it('sagt „keine Aufzeichnung der Bildschirmsitzung" nur, solange kein Session Replay eingebunden ist', () => {
    for (const datei of ['src/instrumentation.ts', 'src/instrumentation-client.ts']) {
      const quelle = lies(datei)
      // Gegenprobe: Die Datei ist die Sentry-Initialisierung.
      expect(quelle, datei).toMatch(/Sentry\.init\(/)
      expect(quelle, datei).toMatch(/sendDefaultPii: false/)
      expect(quelle, datei).not.toMatch(/replayIntegration|replaysSessionSampleRate|replaysOnErrorSampleRate/)
    }
    expect(seitenText()).toMatch(/keine Aufzeichnung deiner Bildschirmsitzung/)
  })
})

describe('Datenschutzerklärung — Zahlung', () => {
  it('nennt als gespeicherten Zahlungsbezug die Kennung des Zahlungsvorgangs, nicht eine „anonymisierte" ID', () => {
    // Gegenprobe Code: Die Bestellung speichert die PaymentIntent-Kennung von Stripe.
    expect(lies('prisma/schema.prisma')).toMatch(/stripePaymentIntentId\s+String\?/)

    const text = seitenText()
    expect(text).not.toMatch(/anonymisierte Bestätigungs-ID/)
    expect(text).toMatch(/die Kennung des Zahlungsvorgangs bei Stripe/)
  })
})
