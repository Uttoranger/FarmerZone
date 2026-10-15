/**
 * Die Aufgabe „Erstattung offen" im Eingang (Register N14, Nr. 95, Runde 1) —
 * gerendert ohne Browser (renderToStaticMarkup).
 *
 * Beweist: Der Eingang zeigt nur, was die Bestellung hergibt („online
 * bezahlt"), und sagt dazu in einem Satz, dass der offene Betrag (er kann
 * kleiner sein, etwa wenn nur ein Teil der Erstattung scheiterte) und die
 * Anweisung in der Mail stehen — mit genau dem Betreff, den die Mail trägt
 * (EINGANG_TEXT.erstattungKopf, eine Quelle für Mail und Eingang). Keine neue
 * Rechnung. Der Knopf führt zur Zahlung bei Stripe, ohne Kennung steht der
 * Ausweg da.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PostfachErstattungSpalte } from '@/components/admin/postfach-aufgabe-erstattung'
import { EINGANG_TEXT, type ErstattungAufgabeRoh } from '@/lib/postfach'

const JETZT = new Date('2026-10-15T12:00:00Z')

const ERSTATTUNG: ErstattungAufgabeRoh = {
  id: 'bestellung1',
  bestellnummer: 'HM-2610-TEST',
  hofName: 'Hof Test',
  seit: new Date('2026-10-15T09:00:00Z'),
  bezahltCents: 2340,
  schonErstattetCents: 0,
  zahlungKennung: 'pi_test123',
}

function html(e: ErstattungAufgabeRoh, zahlungAdresse: string | null): string {
  // Die deutschen Anführungszeichen „“ escaped React nicht — der Satz steht 1:1 im HTML.
  return renderToStaticMarkup(createElement(PostfachErstattungSpalte, { e, zahlungAdresse, jetzt: JETZT }))
}

describe('Aufgabe Erstattung offen', () => {
  it('nennt die Mail mit ihrem Betreff als Quelle für den offenen Betrag und die Anweisung', () => {
    const seite = html(ERSTATTUNG, 'https://dashboard.stripe.com/test/payments/pi_test123')
    const satz = EINGANG_TEXT.erstattungMail(EINGANG_TEXT.erstattungKopf('HM-2610-TEST'))
    expect(seite).toContain(satz)
    expect(satz).toContain('„Erstattung offen – Bestellung HM-2610-TEST“')
    expect(satz).toMatch(/offen/)
    expect(seite).toContain(EINGANG_TEXT.bezahlt)
    expect(seite).toContain('23,40')
    expect(seite).toContain(EINGANG_TEXT.zurBestellung)
  })

  it('ohne Zahlungskennung kein Knopf, aber der Ausweg und weiter der Hinweis auf die Mail', () => {
    const seite = html({ ...ERSTATTUNG, zahlungKennung: null, bezahltCents: null }, null)
    expect(seite).not.toContain(EINGANG_TEXT.zurBestellung)
    expect(seite).toContain(EINGANG_TEXT.ohneZahlung)
    expect(seite).toContain(EINGANG_TEXT.erstattungMail(EINGANG_TEXT.erstattungKopf('HM-2610-TEST')))
  })
})
