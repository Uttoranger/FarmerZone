export type PasswordCheck = {
  id: string
  label: string
  test: (pw: string) => boolean
}

export const PASSWORD_CHECKS: PasswordCheck[] = [
  { id: 'length', label: 'Mindestens 8 Zeichen', test: (pw) => pw.length >= 8 },
  { id: 'upper', label: 'Ein Großbuchstabe (A–Z)', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'Ein Kleinbuchstabe (a–z)', test: (pw) => /[a-z]/.test(pw) },
  { id: 'digit', label: 'Eine Zahl (0–9)', test: (pw) => /[0-9]/.test(pw) },
]

export type ValidationResult = {
  valid: boolean
  checks: Array<{ id: string; label: string; passed: boolean }>
}

export function validatePassword(pw: string): ValidationResult {
  const checks = PASSWORD_CHECKS.map((c) => ({
    id: c.id,
    label: c.label,
    passed: c.test(pw),
  }))
  return { valid: checks.every((c) => c.passed), checks }
}

export const PASSWORD_SCHEMA_MESSAGE =
  'Passwort muss mindestens 8 Zeichen, einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.'

