/**
 * Tests für das Registrierungs-Schema (src/schemas/register.ts).
 *
 * Beweist: 7 Zeichen → Fehler „Mindestens 8 Zeichen", 8 Zeichen (mit
 * erfüllter Checkliste) → ok; die weiteren Checklisten-Regeln greifen
 * nach der Längenregel.
 */
import { describe, it, expect } from 'vitest'
import { passwordSchema, registrationSchema } from '@/schemas/register'

describe('passwordSchema', () => {
  it('lehnt 7 Zeichen mit deutscher Meldung ab', () => {
    const result = passwordSchema.safeParse('Abc123x') // 7 Zeichen
    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.issues[0].message).toBe('Mindestens 8 Zeichen')
  })

  it('akzeptiert 8 Zeichen, wenn die Checkliste erfüllt ist', () => {
    expect(passwordSchema.safeParse('Abc123xy').success).toBe(true) // exakt 8
  })

  it('verlangt nach der Länge auch Groß-/Kleinbuchstaben und Zahl', () => {
    const result = passwordSchema.safeParse('nurkleinbuchstaben')
    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.issues[0].message).toContain('Großbuchstaben')
  })
})

describe('registrationSchema', () => {
  it('akzeptiert einen vollständigen gültigen Datensatz', () => {
    expect(
      registrationSchema.safeParse({
        email: 'franz@example.com',
        password: 'Hofladen1',
        name: 'Franz Müller',
      }).success
    ).toBe(true)
  })

  it('meldet bei zu kurzem Passwort die Längenregel zuerst', () => {
    const result = registrationSchema.safeParse({
      email: 'franz@example.com',
      password: 'Kurz1ab', // 7 Zeichen
      name: 'Franz Müller',
    })
    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.issues[0].message).toBe('Mindestens 8 Zeichen')
  })
})
