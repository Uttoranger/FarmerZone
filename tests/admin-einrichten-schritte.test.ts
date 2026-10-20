/**
 * Schritte der Pflichtseite /admin/einrichten (Register N20; Nr. 115,
 * Nachbesserung Runde 1, src/app/admin/einrichten/einrichten-schritte.tsx).
 *
 * Ursache: Kommende Schritte waren mit Deckkraft gedämpft — ihre Nebenzeilen
 * fielen im hellen Theme unter 4,5:1 (Axe color-contrast). Regel (DESIGN_SYSTEM,
 * WCAG AA): Gedämpft wirkt ein Schritt nur über Tokens (Fläche, gestrichelter
 * Kreis, Schloss), nie über Deckkraft auf Text.
 *
 * Beweist (statisches Rendern, Aktionen und Passkey gemockt):
 *  - Kein Schritt trägt eine Deckkraft-Klasse, in keinem Zustand; kommende
 *    Schritte bleiben am Schloss erkennbar.
 *  - Nach dem Sichern der Ersatzcodes steht beim erledigten Schritt nicht mehr
 *    „… kommt nach dem Passkey".
 *  - Nach einer Anmeldung mit Ersatzcode heißt der erste Schritt auch im
 *    Zustand „eingerichtet" „Angemeldet mit Ersatzcode" (sichter Runde 2, K1).
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/lib/auth-client-passkey', () => ({ passkeyEinrichten: { addPasskey: vi.fn() } }))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))
vi.mock('@/server/actions/admin-anmeldung', () => ({
  erstelleErsatzcodes: vi.fn(),
  pruefeEinrichtungscode: vi.fn(),
  pruefeFrischFuerPasskey: vi.fn(),
  schickeEinrichtungscode: vi.fn(),
}))
vi.mock('@/components/admin/frisch-bestaetigen', () => ({ useFrischBestaetigt: () => ({ ausfuehren: vi.fn(), dialog: null }) }))

import { EINRICHTEN_TEXT, type EinrichtenZustand } from '@/lib/admin-anmeldung'
import { EinrichtenSchritte, type EinrichtenAnsicht } from '@/app/admin/einrichten/einrichten-schritte'

function rendere(zustand: EinrichtenZustand, mehr: Partial<EinrichtenAnsicht> = {}): string {
  const ansicht: EinrichtenAnsicht = {
    zustand,
    bestaetigtText: 'heute, 10:00',
    fensterText: null,
    codeOffen: false,
    ersatzcodes: 0,
    jetztText: '20.10. um 10:00',
    mitErsatzcode: false,
    ...mehr,
  }
  return renderToStaticMarkup(createElement(EinrichtenSchritte, { ansicht }))
}

/** Das <li> eines Schritts, gefunden über seinen Titel. */
function schritt(html: string, titel: string): string {
  const treffer = html.split('<li').find((teil) => teil.includes(`>${titel}<`))
  if (!treffer) throw new Error(`Schritt fehlt: ${titel}`)
  return treffer
}

describe('Pflichtseite: Schritte', () => {
  const zustaende: Array<[EinrichtenZustand, Partial<EinrichtenAnsicht>]> = [
    ['bestaetigen', {}],
    ['bestaetigen', { codeOffen: true }],
    ['passkey', {}],
    ['ersatzcode', {}],
    ['neu-anmelden', {}],
    ['eingerichtet', {}],
    ['eingerichtet', { ersatzcodes: 10 }],
  ]

  it.each(zustaende)('%s %o: keine Deckkraft an einem Schritt', (zustand, mehr) => {
    // Nur Deckkraft im Ruhezustand — `disabled:opacity-…` der Knöpfe gilt nur beim Laufen.
    expect(rendere(zustand, mehr)).not.toMatch(/[\s"]opacity-/)
  })

  it('kommende Schritte bleiben erkennbar: Schloss statt Deckkraft', () => {
    const html = rendere('bestaetigen')
    for (const titel of [EINRICHTEN_TEXT.schrittPasskey, EINRICHTEN_TEXT.schrittErsatzcodes, EINRICHTEN_TEXT.schrittZweiter]) {
      const li = schritt(html, titel)
      expect(li).toContain('lucide-lock')
      expect(li).toContain('border-dashed')
    }
  })

  it('Ersatzcodes gesichert: ohne den Satz „kommt nach dem Passkey"', () => {
    const li = schritt(rendere('eingerichtet', { ersatzcodes: 10 }), EINRICHTEN_TEXT.ersatzcodesGesichert)
    expect(li).not.toContain(EINRICHTEN_TEXT.schrittErsatzcodesSatz)
    expect(schritt(rendere('eingerichtet'), EINRICHTEN_TEXT.schrittErsatzcodes)).toContain(EINRICHTEN_TEXT.schrittErsatzcodesSatz)
  })

  it('nach Ersatzcode: „eingerichtet" zeigt „Angemeldet mit Ersatzcode", nicht „Bestätigt mit Passwort …"; der Passwort-Weg weiter den alten Satz', () => {
    const nachErsatzcode = rendere('eingerichtet', { mitErsatzcode: true, bestaetigtText: null, ersatzcodes: 9 })
    expect(schritt(nachErsatzcode, EINRICHTEN_TEXT.schrittErsatzcode)).toContain('lucide-check')
    expect(nachErsatzcode).not.toContain(EINRICHTEN_TEXT.schrittBestaetigt)
    // Die Aufforderung „Richte jetzt einen neuen Passkey ein" gehört nur vor den neuen Passkey.
    expect(nachErsatzcode).not.toContain(EINRICHTEN_TEXT.ersatzcodeSatz)

    const mitPasswort = rendere('eingerichtet', { ersatzcodes: 10 })
    expect(schritt(mitPasswort, EINRICHTEN_TEXT.schrittBestaetigt)).toContain('heute, 10:00')
    expect(mitPasswort).not.toContain(EINRICHTEN_TEXT.schrittErsatzcode)
  })
})
