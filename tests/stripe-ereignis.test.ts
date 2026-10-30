/**
 * Schemas der verarbeiteten Stripe-Ereignisse (Nachtlauf Nr. 203,
 * src/schemas/stripe-ereignis.ts).
 *
 * Beweist: Je verarbeitetem Typ geht ein gültiges Objekt durch (mit
 * zusätzlichen Feldern, wie Stripe sie schickt) und ein ungültiges nicht —
 * das Ergebnis nennt dann nur Feldpfade, nie Werte. Dazu: Die Liste der Typen
 * ist genau die der Route (Lauf 26 plus account.updated), ein fremder Typ ist
 * keiner.
 */
import { describe, expect, it } from 'vitest'
import { STRIPE_EREIGNIS_SCHEMAS, istVerarbeiteterStripeTyp, pruefeStripeObjekt, type VerarbeiteterStripeTyp } from '@/schemas/stripe-ereignis'
import { BEISPIELE } from './stripe-ereignis-beispiele'

const TYPEN = Object.keys(BEISPIELE) as VerarbeiteterStripeTyp[]

describe('Schemas der verarbeiteten Stripe-Ereignisse', () => {
  it('die Liste ist die der Route: Lauf 26 plus account.updated', () => {
    expect(Object.keys(STRIPE_EREIGNIS_SCHEMAS).sort()).toEqual([...TYPEN].sort())
    expect(TYPEN).toHaveLength(11)
  })

  it.each(TYPEN)('%s: gültig geht durch, ungültig nennt nur das Feld', (typ) => {
    const { gueltig, ungueltig, feld } = BEISPIELE[typ]
    expect(pruefeStripeObjekt(typ, gueltig)).toEqual({ ok: true })
    expect(pruefeStripeObjekt(typ, ungueltig)).toEqual({ ok: false, felder: [feld] })
  })

  it('kein Objekt: ein Eintrag ohne Pfad, keine Werte', () => {
    expect(pruefeStripeObjekt('invoice.paid', null)).toEqual({ ok: false, felder: ['(Objekt)'] })
  })

  it('das Ergebnis trägt nie einen Wert aus dem Ereignis', () => {
    const ergebnis = pruefeStripeObjekt('refund.failed', { id: 're_geheim_123', amount: 'kunde@example.com', status: 7, metadata: { orderId: 5 } })
    expect(ergebnis.ok).toBe(false)
    expect(JSON.stringify(ergebnis)).not.toMatch(/re_geheim|example\.com|"7"|"5"/)
  })

  it('fremde und geerbte Namen sind kein verarbeiteter Typ', () => {
    expect(istVerarbeiteterStripeTyp('payment_intent.succeeded')).toBe(true)
    expect(istVerarbeiteterStripeTyp('customer.created')).toBe(false)
    expect(istVerarbeiteterStripeTyp('toString')).toBe(false)
  })
})
