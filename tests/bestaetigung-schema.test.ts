/**
 * Die URL-Parameter der Bestätigungsseite (src/schemas/bestaetigung.ts):
 * Was nicht passt, gilt als fehlend — nie als Fehler, nie als Zugang.
 */
import { describe, it, expect } from 'vitest'
import { bestaetigungsParameterSchema } from '@/schemas/bestaetigung'

const parse = (roh: Record<string, unknown>) => bestaetigungsParameterSchema.parse(roh)
const SIG = 'a'.repeat(64)

describe('bestaetigungsParameterSchema', () => {
  it('übernimmt eine Signatur im richtigen Format und Stripes Rückmeldung', () => {
    expect(parse({ sig: SIG, redirect_status: 'succeeded', payment_intent: 'pi_1' })).toEqual({
      sig: SIG,
      redirect_status: 'succeeded',
    })
  })

  it.each([
    ['zu kurz', 'a'.repeat(63)],
    ['kein Hex', 'z'.repeat(64)],
    ['doppelt angegeben', [SIG, SIG]],
  ])('Signatur %s: gilt als fehlend', (_fall, sig) => {
    expect(parse({ sig }).sig).toBeUndefined()
  })

  it('unbekannte oder doppelte redirect_status gelten als fehlend', () => {
    expect(parse({ redirect_status: 'paid' }).redirect_status).toBeUndefined()
    expect(parse({ redirect_status: ['succeeded', 'failed'] }).redirect_status).toBeUndefined()
  })

  it('ohne Parameter: beides fehlt', () => {
    expect(parse({})).toEqual({})
  })
})
