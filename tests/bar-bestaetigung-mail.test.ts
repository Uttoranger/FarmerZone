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
 *  - Seit V87 (Lauf 30, Nr. 232) nennt sie auch keine Dauer mehr: Die Frist
 *    steht mit Tag und Uhrzeit aus fristVon da; der Satz „… nach spätestens
 *    zwei Stunden wieder frei“ nannte sie doppelt und unvollständig (der
 *    Bestellschluss kann früher liegen). Ohne Frist bleibt ein Satz ohne Dauer.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OnsiteConfirmationEmail } from '@/emails/onsite-confirmation'
import { BESTAETIGUNGSFRIST_BAR_MINUTEN } from '@/lib/fristen'

function mailText(bestaetigenBis?: string): string {
  const html = renderToStaticMarkup(
    createElement(OnsiteConfirmationEmail, {
      orderNumber: 'FZ-TEST-1',
      farmName: 'Hof Beispiel',
      farmAddress: 'Feldweg 1',
      farmCity: 'Beispieldorf',
      pickupDate: 'Samstag, 10.10.2026',
      pickupTime: '09:00–12:00',
      items: [{ name: 'Eier', betrag: 4.5 }],
      total: 4.5,
      confirmationUrl: 'http://localhost:3000/hof-beispiel/bestaetigen/token',
      bestaetigenBis,
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

  it('nennt keine Dauer (V87) — mit Frist steht sie mit Tag und Uhrzeit da, nur einmal', () => {
    const text = mailText('Samstag, 10. Oktober, 11:12 Uhr')
    expect(text).toContain('Bitte bestätige bis Samstag, 10. Oktober, 11:12 Uhr.')
    expect(text).not.toMatch(/zwei Stunden|Bitte bestätige bald/)
  })

  it('ohne Frist ein Satz ohne Dauer — nie eine erfundene', () => {
    const text = mailText()
    expect(text).toContain('Bitte bestätige bald – sonst geben wir die Ware wieder frei.')
    expect(text).not.toMatch(/zwei Stunden|Stunde/)
  })
})
