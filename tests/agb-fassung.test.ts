/**
 * Die Fassung der AGB einer Bestellung (Register N45, A005; Freigabe §36 „Entschieden · AGB 1.0 mit dem Stichtag“).
 *
 * Beweist:
 *  - agbFassungFuerBestellung, alle vier Fälle: null → 0.9, „bisher“ → 0.9, „hofpreis“ → 1.0, ein unbekannter
 *    Wert → 0.9 mit `unbekannt: true`; nie ein Wurf (auch nicht bei undefined oder leerem Text).
 *  - agbFassungMitMeldung (Server): dieselbe Fassung; nur beim unbekannten Wert genau eine Meldung an Sentry,
 *    mit nichts als dem Wert und der Bestell-ID. Gegenprobe: die drei bekannten Fälle melden nichts.
 *  - „Erneut bezahlen“: Die Kassen-Seite ermittelt die Fassung auf dem Server aus dem Snapshot der Bestellung
 *    (agbFassungMitMeldung(order)) und reicht sie an ZahlungFortsetzen; die Komponente leitet sie nicht selbst ab.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)

import { AGB_BISHER, AGB_NEUESTE, agbFassungFuerBestellung } from '@/lib/rechtstexte/agb-fassung'
import { agbFassungMitMeldung } from '@/lib/rechtstexte/agb-fassung-melden'
import { GEBUEHR_MODELL_HOFPREIS } from '@/lib/plattformgebuehr'

const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

beforeEach(() => {
  sentry.captureMessage.mockReset()
  sentry.captureException.mockReset()
})

describe('agbFassungFuerBestellung — die vier Fälle', () => {
  it('null → 0.9', () => {
    expect(agbFassungFuerBestellung({ gebuehrModell: null })).toEqual({ fassung: '0.9', unbekannt: false })
  })

  it('„bisher“ → 0.9', () => {
    expect(agbFassungFuerBestellung({ gebuehrModell: 'bisher' })).toEqual({ fassung: '0.9', unbekannt: false })
  })

  it('„hofpreis“ → 1.0', () => {
    expect(GEBUEHR_MODELL_HOFPREIS).toBe('hofpreis')
    expect(agbFassungFuerBestellung({ gebuehrModell: 'hofpreis' })).toEqual({ fassung: '1.0', unbekannt: false })
  })

  it('unbekannter Wert → 0.9 mit unbekannt: true, nie ein Wurf', () => {
    for (const wert of ['zukunft', 'Hofpreis', '', ' hofpreis']) {
      expect(() => agbFassungFuerBestellung({ gebuehrModell: wert })).not.toThrow()
      expect(agbFassungFuerBestellung({ gebuehrModell: wert })).toEqual({ fassung: '0.9', unbekannt: true })
    }
    // undefined (Feld nicht geladen) gilt wie null: 0.9, nicht unbekannt.
    expect(agbFassungFuerBestellung({ gebuehrModell: undefined })).toEqual({ fassung: '0.9', unbekannt: false })
  })

  it('die Konstanten passen: AGB_BISHER = 0.9, AGB_NEUESTE = 1.0', () => {
    expect([AGB_BISHER, AGB_NEUESTE]).toEqual(['0.9', '1.0'])
  })
})

describe('agbFassungMitMeldung — die Meldung an Sentry nur auf dem Server', () => {
  it.each([
    [null, '0.9'],
    ['bisher', '0.9'],
    ['hofpreis', '1.0'],
  ] as const)('%s → %s, keine Meldung', (gebuehrModell, fassung) => {
    expect(agbFassungMitMeldung({ id: 'order-1', gebuehrModell })).toBe(fassung)
    expect(sentry.captureMessage).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('unbekannter Wert → 0.9 und genau eine Meldung, nur mit Wert und Bestell-ID', () => {
    expect(agbFassungMitMeldung({ id: 'order-2', gebuehrModell: 'zukunft' })).toBe('0.9')
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sentry.captureMessage).toHaveBeenCalledWith(expect.any(String), {
      tags: { bereich: 'agb-fassung' },
      extra: { gebuehrModell: 'zukunft', orderId: 'order-2' },
    })
  })

  it('wirft nie, auch beim unbekannten Wert', () => {
    expect(() => agbFassungMitMeldung({ id: 'order-3', gebuehrModell: 'x' })).not.toThrow()
  })
})

describe('„Erneut bezahlen“: die Fassung kommt vom Server', () => {
  it('die Kassen-Seite ermittelt sie aus dem Snapshot der Bestellung und reicht sie an ZahlungFortsetzen', () => {
    const seite = lies('src/app/(public)/[farmSlug]/checkout/page.tsx')
    expect(seite).toMatch(/gebuehrModell: true,/)
    expect(seite).toMatch(/agbFassung: agbFassungMitMeldung\(order\),/)
    expect(seite).toMatch(/<ZahlungFortsetzen[\s\S]*?agbFassung=\{fortsetzung\.agbFassung\}[\s\S]*?\/>/)
  })

  it('die Komponente leitet die Fassung nicht selbst ab (Gegenprobe zur Fassung von Runde 0)', () => {
    const form = lies('src/components/checkout/checkout-form.tsx')
    expect(form).not.toMatch(/agbFassungFuerBestellung/)
    expect(form).toMatch(/const agbPfad = agbFassungPfad\(agbFassung\)/)
  })

  it('Mail-Bau und Kassen-Seite melden über dieselbe Funktion', () => {
    expect(lies('src/lib/email.ts').match(/agbFassungMitMeldung\(order\)/g)).toHaveLength(2)
    expect(lies('src/lib/email.ts')).not.toMatch(/agbFassungFuerBestellung/)
  })
})
