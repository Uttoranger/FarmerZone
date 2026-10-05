/**
 * Die Mail „Bitte bestätige" (src/emails/onsite-confirmation.tsx) nennt die
 * Frist, die wirklich gilt.
 *
 * Ursache des Fehlers: Die Vorlage schrieb „Der Link ist 48 Stunden gültig".
 * Die Frist aus src/lib/fristen.ts ist aber höchstens zwei Stunden
 * (BESTAETIGUNGSFRIST_BAR_MINUTEN), früher, wenn der Bestellschluss davor
 * liegt. Wer sich auf die 48 Stunden verließ, fand eine freigegebene
 * Bestellung vor.
 *
 * Beweist:
 *  - Die Mail verspricht keine 48 Stunden mehr.
 *  - Sie sagt „spätestens zwei Stunden" — passend zur Konstante.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OnsiteConfirmationEmail } from '@/emails/onsite-confirmation'
import { BESTAETIGUNGSFRIST_BAR_MINUTEN } from '@/lib/fristen'

function mailText(): string {
  const html = renderToStaticMarkup(
    createElement(OnsiteConfirmationEmail, {
      customerName: 'Erika Beispiel',
      orderNumber: 'FZ-TEST-1',
      farmName: 'Hof Beispiel',
      farmAddress: 'Feldweg 1',
      farmCity: 'Beispieldorf',
      pickupDate: 'Samstag, 10.10.2026',
      pickupTime: '09:00–12:00',
      items: [{ name: 'Eier', quantity: 1, unitPrice: 4.5 }],
      total: 4.5,
      confirmationUrl: 'http://localhost:3000/hof-beispiel/bestaetigen/token',
    })
  )
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

describe('Mail „Bitte bestätige" — Frist', () => {
  it('Gegenprobe: die Frist aus fristen.ts ist zwei Stunden', () => {
    expect(BESTAETIGUNGSFRIST_BAR_MINUTEN).toBe(120)
  })

  it('verspricht keine 48 Stunden', () => {
    expect(mailText()).not.toContain('48 Stunden')
  })

  it('nennt die Freigabe nach spätestens zwei Stunden', () => {
    expect(mailText()).toContain(
      'Bitte bestätige bald: Unbestätigte Bestellungen geben wir nach spätestens zwei Stunden wieder frei.'
    )
  })
})
