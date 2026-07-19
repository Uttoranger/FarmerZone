import { describe, it, expect } from 'vitest'
import { validateEnv } from '@/lib/env'

const complete = {
  DATABASE_URL: 'postgresql://user:geheimes-passwort@host:5432/db',
  BETTER_AUTH_SECRET: 'super-geheimer-wert',
  STRIPE_SECRET_KEY: 'sk_test_geheim',
  STRIPE_WEBHOOK_SECRET: 'whsec_geheim',
}

describe('validateEnv', () => {
  it('akzeptiert einen vollständigen Satz Pflicht-Variablen', () => {
    const env = validateEnv(complete)
    expect(env.DATABASE_URL).toBe(complete.DATABASE_URL)
    expect(env.STRIPE_WEBHOOK_SECRET).toBe(complete.STRIPE_WEBHOOK_SECRET)
  })

  it('wirft bei fehlender Pflicht-Variable einen sprechenden Fehler mit dem Namen', () => {
    const { BETTER_AUTH_SECRET: _weg, ...ohne } = complete
    expect(() => validateEnv(ohne)).toThrowError(/BETTER_AUTH_SECRET/)
    expect(() => validateEnv(ohne)).toThrowError(/Umgebungsvariablen/)
  })

  it('nennt mehrere fehlende Variablen gemeinsam', () => {
    expect(() => validateEnv({ DATABASE_URL: 'postgresql://x' })).toThrowError(
      /BETTER_AUTH_SECRET.*STRIPE_SECRET_KEY.*STRIPE_WEBHOOK_SECRET/
    )
  })

  it('behandelt leere Strings wie fehlende Variablen', () => {
    expect(() => validateEnv({ ...complete, STRIPE_SECRET_KEY: '' })).toThrowError(
      /STRIPE_SECRET_KEY/
    )
  })

  it('gibt in der Fehlermeldung niemals Werte aus', () => {
    // Vorhandene (gültige) Werte dürfen nicht in der Meldung anderer Fehler landen
    const { STRIPE_WEBHOOK_SECRET: _weg, ...ohne } = complete
    let message = ''
    try {
      validateEnv(ohne)
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    }
    expect(message).not.toBe('')
    expect(message).not.toContain('geheim')
    expect(message).not.toContain('passwort')
    expect(message).not.toContain('sk_test')
  })
})
