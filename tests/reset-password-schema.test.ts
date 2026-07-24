/**
 * Tests für das Reset-Passwort-Schema (src/schemas/reset-password.ts).
 *
 * Beweist: dieselben Regeln wie bei der Registrierung (<8 Zeichen → Fehler)
 * und Nichtübereinstimmung beider Felder wird abgewiesen.
 */
import { describe, it, expect } from 'vitest'
import { resetPasswordSchema } from '@/schemas/reset-password'

describe('resetPasswordSchema', () => {
  it('lehnt Passwörter unter 8 Zeichen mit deutscher Meldung ab', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'Abc123x', // 7 Zeichen
      passwordConfirm: 'Abc123x',
    })
    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.issues[0].message).toBe('Mindestens 8 Zeichen')
  })

  it('weist nicht übereinstimmende Felder ab', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'Hofladen1',
      passwordConfirm: 'Hofladen2',
    })
    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.issues[0].message).toBe(
      'Passwörter stimmen nicht überein.'
    )
  })

  it('akzeptiert ein gültiges, übereinstimmendes Passwort', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'Hofladen1',
        passwordConfirm: 'Hofladen1',
      }).success
    ).toBe(true)
  })
})
