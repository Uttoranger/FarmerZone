/**
 * Abmelden von werblichen Mails mit einem Klick (RFC 8058, Nr. 47) — die
 * Adressen und Kopfzeilen aus EINER Quelle (src/lib/abmelde-link.ts), rein.
 *
 * Beweist:
 *  - `List-Unsubscribe` nennt in spitzen Klammern die Ein-Klick-Adresse mit
 *    dem signierten Token, `List-Unsubscribe-Post` genau
 *    „List-Unsubscribe=One-Click".
 *  - Der Link im Text der Mail führt auf die Seite mit dem Knopf, wie bisher.
 *  - Die Sätze sind geduzt, ohne Fachwort, mit Ausweg.
 */
import { describe, expect, it } from 'vitest'
import {
  ABMELDE_SEITE,
  ABMELDEN_FEHLGESCHLAGEN,
  ABMELDE_LINK_UNGUELTIG,
  EIN_KLICK_ABMELDUNG,
  abmeldeSeitenPfad,
  einKlickAbmeldePfad,
  listUnsubscribeKoepfe,
} from '@/lib/abmelde-link'

const TOKEN = 'a2Z1bmRpbkBleGFtcGxlLmNvbTpmYXJtLTE.0123456789abcdef'

describe('Adressen', () => {
  it('die Seite mit dem Knopf und der Ein-Klick-Endpunkt tragen den Token als Parameter', () => {
    expect(abmeldeSeitenPfad(TOKEN)).toBe(`/account/unsubscribe?token=${TOKEN}`)
    expect(einKlickAbmeldePfad(TOKEN)).toBe(`/api/abmelden?token=${TOKEN}`)
    expect(ABMELDE_SEITE).toBe('/account/unsubscribe')
    expect(EIN_KLICK_ABMELDUNG).toBe('/api/abmelden')
  })

  it('ein Token mit Sonderzeichen wird kodiert — nie ein zweiter Parameter durch den Token', () => {
    expect(einKlickAbmeldePfad('a&b=c')).toBe('/api/abmelden?token=a%26b%3Dc')
    expect(new URL(einKlickAbmeldePfad('a&b=c'), 'https://farmerzone.example').searchParams.get('token')).toBe('a&b=c')
  })
})

describe('Kopfzeilen einer werblichen Mail (RFC 2369 und RFC 8058)', () => {
  it('List-Unsubscribe in spitzen Klammern mit der vollen Adresse, List-Unsubscribe-Post für den Ein-Klick', () => {
    expect(listUnsubscribeKoepfe('https://farmerzone.example', TOKEN)).toEqual({
      'List-Unsubscribe': `<https://farmerzone.example/api/abmelden?token=${TOKEN}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
  })
})

describe('Sätze', () => {
  it('geduzt, mit Punkt und Ausweg, ohne Fachwort', () => {
    for (const satz of [ABMELDE_LINK_UNGUELTIG, ABMELDEN_FEHLGESCHLAGEN]) {
      expect(satz).toMatch(/^[A-ZÄÖÜ].*\.$/)
      expect(satz).toMatch(/\b(?:dich|deine|versuch|Öffne|Mein Konto)\b/)
      expect(satz).not.toMatch(/Token|Request|One-Click|Header|Error/i)
    }
  })
})
