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


// ─── Passwortstärke (Registrieren, Nr. 15) ──────────────────────────────────

/** Was einem Passwort fehlt, in den Worten des Satzes „es fehlt: …". */
const FEHLT_TEXT: Record<string, string> = {
  length: 'mindestens 8 Zeichen',
  upper: 'ein Großbuchstabe',
  lower: 'ein Kleinbuchstabe',
  digit: 'eine Zahl',
}

/** Ab dieser Länge heißt ein gültiges Passwort „Sehr gut". */
export const PASSWORT_SEHR_GUT_AB = 12

export type PasswortStaerke = {
  /** Gefüllte Balken der Anzeige, 0 bis 4. */
  balken: 0 | 1 | 2 | 3 | 4
  /** Erfüllt das Passwort die Regeln, die der Server verlangt (validatePassword)? */
  gueltig: boolean
  /** Der Satz unter den Balken. */
  text: string
}

/**
 * Die Stärke-Anzeige unter dem Passwortfeld (Mockup web-h0-hof-registrieren:
 * vier Balken, „Gut – mindestens 8 Zeichen"). Gültig ist genau, was
 * validatePassword gültig nennt — die Anzeige verspricht nie mehr als der
 * Server prüft. Darunter sagt sie, was noch fehlt, statt nur „zu schwach".
 */
export function passwortStaerke(pw: string): PasswortStaerke {
  if (pw.length === 0) {
    return { balken: 0, gueltig: false, text: 'Mindestens 8 Zeichen, mit Groß- und Kleinbuchstaben und einer Zahl.' }
  }
  const { valid, checks } = validatePassword(pw)
  if (!valid) {
    const fehlt = checks.filter((c) => !c.passed).map((c) => FEHLT_TEXT[c.id] ?? c.label)
    const erfuellt = checks.length - fehlt.length
    return {
      balken: erfuellt >= 3 ? 2 : 1,
      gueltig: false,
      text: `Zu schwach – es ${fehlt.length === 1 ? 'fehlt' : 'fehlen'}: ${fehlt.join(', ')}`,
    }
  }
  return pw.length >= PASSWORT_SEHR_GUT_AB
    ? { balken: 4, gueltig: true, text: 'Sehr gut – schön lang' }
    : { balken: 3, gueltig: true, text: 'Gut – mindestens 8 Zeichen' }
}
