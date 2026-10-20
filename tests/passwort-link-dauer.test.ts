/**
 * Die Dauer des Links zum neuen Passwort steht an EINER Stelle (Nr. 121, aus
 * Nr. 114: „1 Stunde“ stand viermal als Text und einmal als 3600).
 *
 * Beweist: Die Konstante in src/lib/anmeldecode.ts ist die Quelle. Stellt der
 * Test sie auf zwei Stunden, sagen die Reset-Mail und „Das war ich nicht“
 * „2 Stunden“ und nirgends mehr „1 Stunde“ (die echten Vorlagen und Texte,
 * nur die Konstante ist ersetzt). Better Auth und das Formular „Passwort
 * vergessen“ (Client, wechselt erst nach dem Absenden zum Hinweis) prüft der
 * Quelltext: Sie lesen die Konstante und tragen keine eigene Dauer.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/anmeldecode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/anmeldecode')>()),
  PASSWORT_LINK_STUNDEN: 2,
  PASSWORT_LINK_SEKUNDEN: 2 * 60 * 60,
  PASSWORT_LINK_DAUER_TEXT: '2 Stunden',
}))

import { PasswordResetEmail } from '@/emails/password-reset'
import { NICHT_ICH_TEXT } from '@/lib/geraete'

const quelle = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('Dauer des Passwort-Links aus einer Quelle', () => {
  it('die Reset-Mail nennt die Dauer der Konstante – in der Vorschau und im Text', () => {
    const html = renderToStaticMarkup(createElement(PasswordResetEmail, { resetUrl: 'https://example.com/neu' }))
    expect(html).toContain('<strong>2 Stunden</strong>')
    expect(html).toContain('Link gültig 2 Stunden')
    expect(html).not.toContain('1 Stunde')
  })

  it('„Das war ich nicht“ nennt dieselbe Dauer', () => {
    expect(NICHT_ICH_TEXT.fertigSatz).toContain('Der Link gilt 2 Stunden.')
    expect(NICHT_ICH_TEXT.fertigSatz).not.toContain('1 Stunde')
  })

  it('Better Auth und das Formular lesen die Konstante und tragen keine eigene Dauer', () => {
    expect(quelle('src/lib/auth.ts')).toMatch(/resetPasswordTokenExpiresIn: PASSWORT_LINK_SEKUNDEN,/)
    const formular = quelle('src/app/(auth)/forgot-password/passwort-vergessen-formular.tsx')
    expect(formular).toContain('PASSWORT_LINK_DAUER_TEXT')
    // Gegenprobe der Suche: Das Muster findet eine fest geschriebene Dauer.
    const dauerImText = /\b(\d+|ein|eine|zwei) Stunden?\b/
    expect('Der Link ist 1 Stunde gültig.').toMatch(dauerImText)
    expect(formular).not.toMatch(dauerImText)
  })
})
