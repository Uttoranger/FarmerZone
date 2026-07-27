/**
 * Tests für das Passwortänderungs-Schema (src/schemas/change-password.ts).
 *
 * Beweist: dieselben Regeln wie Registrierung und Reset (<8 Zeichen → Fehler),
 * abweichende Wiederholung wird abgewiesen, fehlendes aktuelles Passwort
 * wird abgewiesen, gültige Eingabe passiert.
 */
import { describe, it, expect } from 'vitest'
import { changePasswordSchema } from '@/schemas/change-password'

describe('changePasswordSchema', () => {
  it('lehnt ein neues Passwort unter 8 Zeichen mit deutscher Meldung ab', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'Altes123',
      password: 'Abc123x', // 7 Zeichen
      passwordConfirm: 'Abc123x',
    })
    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.issues[0].message).toBe('Mindestens 8 Zeichen')
  })

  it('weist eine abweichende Wiederholung ab', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'Altes123',
      password: 'Hofladen1',
      passwordConfirm: 'Hofladen2',
    })
    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.issues[0].message).toBe(
      'Passwörter stimmen nicht überein.'
    )
  })

  it('weist ein leeres aktuelles Passwort ab', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: '',
      password: 'Hofladen1',
      passwordConfirm: 'Hofladen1',
    })
    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.issues[0].message).toBe(
      'Bitte aktuelles Passwort eingeben.'
    )
  })

  it('verlangt auch beim Ändern die volle Checkliste', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'Altes123',
      password: 'nurkleinbuchstaben',
      passwordConfirm: 'nurkleinbuchstaben',
    })
    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.issues[0].message).toContain('Großbuchstaben')
  })

  it('akzeptiert eine gültige Eingabe', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'Altes123',
        password: 'Hofladen1',
        passwordConfirm: 'Hofladen1',
      }).success
    ).toBe(true)
  })
})
