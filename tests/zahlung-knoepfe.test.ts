/**
 * Die Knöpfe der Karte „Online-Zahlung (Stripe)“ auf /settings/payments
 * (PaymentsActions) nach dem Stripe-Kontostand (Register N49, A012).
 *
 * Beweist (gerendert mit renderToStaticMarkup, Actions und Router gemockt):
 *  - Der Weg ins Stripe-Formular (handleSetup: „Mit Stripe einrichten“,
 *    „Einrichtung fortsetzen“, „Online-Zahlung neu einrichten“) steht NUR bei
 *    kein_konto, angaben_fehlen und beim Neu-Einrichten.
 *  - Gegenprobe: Prüft Stripe, gibt noch nicht frei oder hat gesperrt, fehlt
 *    er — „Status prüfen“ steht, sobald ein Konto da ist und nicht neu
 *    eingerichtet wird.
 *  - Die Seite leitet `formularOffen` aus der Stufe ab und reicht es weiter.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock('@/server/actions/stripe-connect', () => ({
  createConnectAccount: vi.fn(),
  createOnboardingLink: vi.fn(),
  checkConnectStatus: vi.fn(),
  schalteOnlineZahlungEin: vi.fn(),
}))

import { PaymentsActions } from '@/app/(hof)/settings/payments/payments-actions'
import { NEU_EINRICHTEN_TITEL } from '@/lib/stripe-konto'

type Stufe = 'kein_konto' | 'angaben_fehlen' | 'pruefung' | 'noch_nicht' | 'gesperrt'

/** Wie die Seite es ableitet (page.tsx): Formular nur bei kein_konto, angaben_fehlen, neu einrichten. */
function knoepfe(stufe: Stufe, neuEinrichten = false): string {
  const formularOffen = neuEinrichten || stufe === 'kein_konto' || stufe === 'angaben_fehlen'
  return renderToStaticMarkup(
    createElement(PaymentsActions, {
      hasAccount: stufe !== 'kein_konto',
      isReady: false,
      onlineAn: true,
      neuEinrichten,
      formularOffen,
    })
  )
}

const FORMULAR = /Mit Stripe einrichten|Einrichtung fortsetzen|Online-Zahlung neu einrichten/

describe('Formular-Knopf nur, wo der Hof bei Stripe etwas tun kann (Register N49)', () => {
  it('kein Konto: „Mit Stripe einrichten“, kein „Status prüfen“', () => {
    const h = knoepfe('kein_konto')
    expect(h).toContain('Mit Stripe einrichten')
    expect(h).not.toContain('Status prüfen')
  })

  it('Angaben fehlen: „Einrichtung fortsetzen“ und „Status prüfen“', () => {
    const h = knoepfe('angaben_fehlen')
    expect(h).toContain('Einrichtung fortsetzen')
    expect(h).toContain('Status prüfen')
  })

  it('neu einrichten: der Formular-Knopf heißt so, „Status prüfen“ entfällt', () => {
    for (const stufe of ['angaben_fehlen', 'pruefung', 'gesperrt'] as const) {
      const h = knoepfe(stufe, true)
      expect(h).toContain(NEU_EINRICHTEN_TITEL)
      expect(h).not.toContain('Status prüfen')
    }
  })

  it.each(['pruefung', 'noch_nicht', 'gesperrt'] as const)('Gegenprobe %s: kein Formular-Knopf, „Status prüfen“ steht', (stufe) => {
    const h = knoepfe(stufe)
    expect(h).not.toMatch(FORMULAR)
    expect(h).toContain('Status prüfen')
    expect([...h.matchAll(/<button/g)]).toHaveLength(1)
  })

  it('ohne formularOffen bleibt es wie bisher (Formular-Knopf steht)', () => {
    const h = renderToStaticMarkup(createElement(PaymentsActions, { hasAccount: true, isReady: false, onlineAn: true }))
    expect(h).toContain('Einrichtung fortsetzen')
  })
})

describe('Die Seite leitet formularOffen aus der Stufe ab', () => {
  const seite = readFileSync(join(process.cwd(), 'src/app/(hof)/settings/payments/page.tsx'), 'utf8')

  it('kein_konto, angaben_fehlen, neu einrichten — und reicht es an die Knöpfe', () => {
    expect(seite).toContain("const formularOffen = neuEinrichten || stufe === 'kein_konto' || stufe === 'angaben_fehlen'")
    expect(seite).toContain('formularOffen={formularOffen}')
  })

  it('der Toast nach „Status prüfen“ bei nicht bereit nur, wenn Angaben fehlen', () => {
    const knopf = readFileSync(join(process.cwd(), 'src/app/(hof)/settings/payments/payments-actions.tsx'), 'utf8')
    expect(knopf).toMatch(/else if \(res\.stufe === undefined \|\| res\.stufe === 'angaben_fehlen'\) \{\s*\/\/[^\n]*\n\s*toast\.info\('Die Einrichtung bei Stripe ist noch nicht fertig\.'\)/)
  })
})
