/**
 * Die Kunden-Anmeldung mit Code (E7, Nr. 08) — Fachregeln aus
 * src/lib/anmeldecode.ts und die Plugin-Einstellung, die auth.ts übernimmt.
 *
 * Beweist:
 *  - Der Code ist 6-stellig, 10 Minuten gültig, höchstens 5 Versuche; das
 *    Plugin bekommt genau diese Werte und speichert den Code nur gehasht.
 *  - Better Auth bremst Anfordern und Prüfen je IP (3 je Minute) — dieselben
 *    Pfade, die das Formular aufruft; dazu die Grenze je Adresse.
 *  - Nur Kundinnen (oder neue Adressen) bekommen einen Code, nie ein Hof.
 *  - Eingetippter oder eingefügter Code wird auf Ziffern gekürzt, nie still
 *    auf etwas anderes.
 *  - Fehlertexte geduzt, ohne Fachbegriff, mit Ausweg — je Fall ein eigener.
 *  - Wartezeit für „Code erneut senden".
 *  - Weiterleitung nach der Anmeldung nur auf eigene, relative Pfade
 *    (keine offene Weiterleitung), mit Gegenprobe; Hof-Ziel nur /teilen.
 *
 * Die Zählung in der Datenbank über Instanzen hinweg prüft
 * tests/integration/anmeldecode.int.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { emailOTP } from 'better-auth/plugins'
import {
  ANMELDECODE_GUELTIG_SEKUNDEN,
  ANMELDECODE_LAENGE,
  ANMELDECODE_MAX_VERSUCHE,
  ANMELDECODE_PLUGIN_OPTIONEN,
  ANMELDECODE_RATE_LIMIT,
  CODE_ANFORDERUNGEN_JE_ADRESSE,
  CODE_ERNEUT_WARTEZEIT_SEKUNDEN,
  GESPERRTE_AUTH_PFADE,
  STANDARD_ZIEL_NACH_CODE,
  anmeldeFehlerText,
  codeVersandErlaubt,
  codeVollstaendig,
  normalisiereCode,
  restWartezeitSekunden,
  rolleAusTreffern,
  zielNachAnmeldung,
  zielNachHofAnmeldung,
} from '@/lib/anmeldecode'
import { erzeugeAnforderungsSperre } from '@/lib/anmeldecode-sperre'
import { codeAnfordernSchema, codeEingabeSchema, zielParameterSchema } from '@/schemas/anmeldecode'

describe('Plugin-Einstellung', () => {
  it('Code 6-stellig, 10 Minuten gültig, höchstens 5 Versuche (S4)', () => {
    expect(ANMELDECODE_LAENGE).toBe(6)
    expect(ANMELDECODE_GUELTIG_SEKUNDEN).toBe(600)
    expect(ANMELDECODE_MAX_VERSUCHE).toBe(5)
    expect(ANMELDECODE_PLUGIN_OPTIONEN).toMatchObject({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
    })
  })

  it('speichert den Code nur gehasht und erneuert ihn bei jeder Anforderung', () => {
    expect(ANMELDECODE_PLUGIN_OPTIONEN.storeOTP).toBe('hashed')
    expect(ANMELDECODE_PLUGIN_OPTIONEN.resendStrategy).toBe('rotate')
  })

  it('bremst Anfordern und Prüfen je IP mit 3 Aufrufen je Minute', () => {
    const plugin = emailOTP({ ...ANMELDECODE_PLUGIN_OPTIONEN, sendVerificationOTP: async () => {} })
    const regel = (pfad: string) => plugin.rateLimit.find((r) => r.pathMatcher(pfad))
    for (const pfad of ['/email-otp/send-verification-otp', '/sign-in/email-otp']) {
      expect(regel(pfad), pfad).toMatchObject({ window: ANMELDECODE_RATE_LIMIT.window, max: ANMELDECODE_RATE_LIMIT.max })
    }
    expect(ANMELDECODE_RATE_LIMIT).toEqual({ window: 60, max: 3 })
  })

  it('„Code erneut senden" wartet so lange, wie das Fenster der IP-Grenze dauert', () => {
    expect(CODE_ERNEUT_WARTEZEIT_SEKUNDEN).toBe(ANMELDECODE_RATE_LIMIT.window)
  })

  it('sperrt die ungenutzten Code-Pfade und das Anfordern von Magic Links', () => {
    expect(GESPERRTE_AUTH_PFADE).toContain('/sign-in/magic-link')
    for (const pfad of [
      '/email-otp/request-password-reset',
      '/email-otp/reset-password',
      '/forget-password/email-otp',
      '/email-otp/verify-email',
      '/email-otp/check-verification-otp',
      '/email-otp/request-email-change',
      '/email-otp/change-email',
    ]) {
      expect(GESPERRTE_AUTH_PFADE, pfad).toContain(pfad)
    }
  })

  it('Gegenprobe: Anfordern, Anmelden und das Prüfen alter Magic Links bleiben offen', () => {
    for (const pfad of ['/email-otp/send-verification-otp', '/sign-in/email-otp', '/magic-link/verify']) {
      expect(GESPERRTE_AUTH_PFADE, pfad).not.toContain(pfad)
    }
  })
})

describe('erzeugeAnforderungsSperre — Codes je Adresse', () => {
  it('lässt je Adresse höchstens 5 Codes in 15 Minuten zu, andere Adressen bleiben frei', () => {
    const sperre = erzeugeAnforderungsSperre()
    const t0 = 1_000_000
    for (let i = 0; i < CODE_ANFORDERUNGEN_JE_ADRESSE.max; i++) {
      expect(sperre.erlaubt('kundin@example.com', t0 + i)).toBe(true)
    }
    expect(sperre.erlaubt('kundin@example.com', t0 + 10)).toBe(false)
    expect(sperre.erlaubt('andere@example.com', t0 + 10)).toBe(true)
  })

  it('gibt die Adresse nach Ablauf des Fensters wieder frei', () => {
    const sperre = erzeugeAnforderungsSperre()
    const t0 = 1_000_000
    for (let i = 0; i < CODE_ANFORDERUNGEN_JE_ADRESSE.max; i++) sperre.erlaubt('kundin@example.com', t0)
    expect(sperre.erlaubt('kundin@example.com', t0 + CODE_ANFORDERUNGEN_JE_ADRESSE.fensterMs - 1)).toBe(false)
    expect(sperre.erlaubt('kundin@example.com', t0 + CODE_ANFORDERUNGEN_JE_ADRESSE.fensterMs + 1)).toBe(true)
  })

  it('zählt Groß- und Kleinschreibung als dieselbe Adresse', () => {
    const sperre = erzeugeAnforderungsSperre()
    for (let i = 0; i < CODE_ANFORDERUNGEN_JE_ADRESSE.max; i++) sperre.erlaubt('Kundin@Example.com', 1)
    expect(sperre.erlaubt('kundin@example.com', 2)).toBe(false)
  })
})

describe('codeVersandErlaubt', () => {
  it('Kundin und neue Adresse bekommen einen Code', () => {
    expect(codeVersandErlaubt('CUSTOMER')).toBe(true)
    expect(codeVersandErlaubt(null)).toBe(true)
  })

  it('ein Hof bekommt nie einen Code — Höfe melden sich mit Passwort an (E7)', () => {
    expect(codeVersandErlaubt('FARMER')).toBe(false)
    expect(codeVersandErlaubt('ADMIN')).toBe(false)
    expect(codeVersandErlaubt('')).toBe(false)
  })
})

describe('rolleAusTreffern', () => {
  it('kein Konto: null — eine neue Adresse wird Kundin', () => {
    expect(rolleAusTreffern([])).toBeNull()
  })

  it('nur Kundinnen-Konten: CUSTOMER', () => {
    expect(rolleAusTreffern(['CUSTOMER'])).toBe('CUSTOMER')
    expect(rolleAusTreffern(['CUSTOMER', 'CUSTOMER'])).toBe('CUSTOMER')
  })

  it('ein einziger Hof oder Admin unter den Treffern genügt — egal an welcher Stelle', () => {
    expect(rolleAusTreffern(['CUSTOMER', 'FARMER'])).toBe('FARMER')
    expect(rolleAusTreffern(['FARMER', 'CUSTOMER'])).toBe('FARMER')
    expect(rolleAusTreffern(['CUSTOMER', 'ADMIN', 'CUSTOMER'])).toBe('ADMIN')
    expect(codeVersandErlaubt(rolleAusTreffern(['CUSTOMER', 'FARMER']))).toBe(false)
  })

  it('eine unbekannte Rolle zählt nicht als Kundin', () => {
    expect(codeVersandErlaubt(rolleAusTreffern(['CUSTOMER', '']))).toBe(false)
  })
})

describe('normalisiereCode und codeVollstaendig', () => {
  it('nimmt nur Ziffern — Leerzeichen und Bindestriche aus der Mail fallen weg', () => {
    expect(normalisiereCode('481 234')).toBe('481234')
    expect(normalisiereCode('481-234')).toBe('481234')
    expect(normalisiereCode(' 4a8b1 ')).toBe('481')
  })

  it('kürzt auf 6 Ziffern', () => {
    expect(normalisiereCode('48123499')).toBe('481234')
  })

  it('vollständig erst mit genau 6 Ziffern', () => {
    expect(codeVollstaendig('48123')).toBe(false)
    expect(codeVollstaendig('481234')).toBe(true)
    expect(codeVollstaendig('48123a')).toBe(false)
    expect(codeVollstaendig('')).toBe(false)
  })
})

describe('anmeldeFehlerText', () => {
  const TECHNIK = /otp|token|error|fehler \d|status|http|api/i

  it('falscher Code: stimmt nicht, mit Ausweg', () => {
    const text = anmeldeFehlerText({ code: 'INVALID_OTP', status: 400 }, 'pruefen')
    expect(text).toContain('stimmt nicht')
    expect(text).toMatch(/neuen/)
  })

  it('abgelaufen: nennt die 10 Minuten', () => {
    expect(anmeldeFehlerText({ code: 'OTP_EXPIRED', status: 400 }, 'pruefen')).toContain('10 Minuten')
  })

  it('zu oft falsch: neuer Code nötig', () => {
    const text = anmeldeFehlerText({ code: 'TOO_MANY_ATTEMPTS', status: 403 }, 'pruefen')
    expect(text).toContain('zu oft')
    expect(text).toMatch(/neuen Code/)
  })

  it('zu viele Anfragen: eine Minute warten', () => {
    expect(anmeldeFehlerText({ status: 429 }, 'senden')).toContain('Minute')
    expect(anmeldeFehlerText({ status: 429 }, 'pruefen')).toContain('Minute')
  })

  it('ungültige Adresse beim Senden', () => {
    expect(anmeldeFehlerText({ code: 'INVALID_EMAIL', status: 400 }, 'senden')).toContain('E-Mail-Adresse')
  })

  it('alles Unbekannte: freundlicher Satz statt Technik', () => {
    const senden = anmeldeFehlerText({ code: 'IRGENDWAS', status: 500 }, 'senden')
    const pruefen = anmeldeFehlerText({}, 'pruefen')
    expect(senden).toContain('Code')
    expect(pruefen).toContain('anmelden')
  })

  it('kein Text enthält Fachbegriffe oder Statuscodes', () => {
    const faelle = [
      { code: 'INVALID_OTP' },
      { code: 'OTP_EXPIRED' },
      { code: 'TOO_MANY_ATTEMPTS' },
      { status: 429 },
      { code: 'INVALID_EMAIL' },
      {},
    ]
    for (const fall of faelle) {
      for (const schritt of ['senden', 'pruefen'] as const) {
        expect(anmeldeFehlerText(fall, schritt)).not.toMatch(TECHNIK)
      }
    }
  })
})

describe('restWartezeitSekunden', () => {
  it('zählt von 60 auf 0 herunter und bleibt bei 0', () => {
    const t0 = 5_000_000
    expect(restWartezeitSekunden(t0, t0)).toBe(60)
    expect(restWartezeitSekunden(t0, t0 + 1)).toBe(60)
    expect(restWartezeitSekunden(t0, t0 + 59_001)).toBe(1)
    expect(restWartezeitSekunden(t0, t0 + 60_000)).toBe(0)
    expect(restWartezeitSekunden(t0, t0 + 120_000)).toBe(0)
  })

  it('ohne gesendeten Code keine Wartezeit', () => {
    expect(restWartezeitSekunden(null, 5_000_000)).toBe(0)
  })
})

describe('zielNachAnmeldung — keine offene Weiterleitung', () => {
  it('ohne Ziel: die bestehende Konto-Seite wie nach dem Magic Link', () => {
    expect(STANDARD_ZIEL_NACH_CODE).toBe('/account/profile')
    expect(zielNachAnmeldung(undefined)).toBe('/account/profile')
    expect(zielNachAnmeldung('')).toBe('/account/profile')
  })

  it('eigene relative Pfade gehen durch — samt Suche und Anker', () => {
    expect(zielNachAnmeldung('/account/profile')).toBe('/account/profile')
    expect(zielNachAnmeldung('/hof-test?tab=produkte#eier')).toBe('/hof-test?tab=produkte#eier')
  })

  it('fremde Adressen fallen auf das Standardziel zurück', () => {
    for (const boese of [
      'https://boese.example.com/account',
      '//boese.example.com',
      '/\\boese.example.com',
      '\\\\boese.example.com',
      'javascript:alert(1)',
      'http:/boese.example.com',
      '/%2F%2Fboese.example.com',
      ' /account/profile',
      '/account\n/profile',
      'account/profile',
    ]) {
      expect(zielNachAnmeldung(boese), boese).toBe('/account/profile')
    }
  })

  it('auch nach dem Normalisieren nie ein fremder Ursprung („/.//", „/a/..//", kodierte Punkte)', () => {
    // Die Eingabe beginnt mit genau einem „/", erst die Auflösung der
    // Punkt-Segmente macht daraus „//boese.example.com" — der Browser liest
    // das als fremden Rechner (Nachbesserung 1).
    for (const boese of [
      '/.//boese.example.com',
      '/a/..//boese.example.com',
      '/%2e//boese.example.com',
      '/%2E//boese.example.com',
      '/x/%2e%2e//boese.example.com',
      '/x/%2E%2E//boese.example.com',
      '/././/boese.example.com',
      '/.//boese.example.com/account?x=1#y',
      '/a/../\\boese.example.com',
      '/a/..%5C%5Cboese.example.com',
      '/.%5C/boese.example.com',
      '/.\t//boese.example.com',
      '/%09//boese.example.com',
      '/.%09//boese.example.com',
      '/%2e%2e//boese.example.com',
    ]) {
      expect(zielNachAnmeldung(boese), boese).toBe('/account/profile')
    }
  })

  it('Gegenprobe: Punkt-Segmente, die lokal bleiben, gehen normalisiert durch', () => {
    expect(zielNachAnmeldung('/a/../account/profile')).toBe('/account/profile')
    expect(zielNachAnmeldung('/./hof-test')).toBe('/hof-test')
  })

  it('keine Ziele in die Schnittstellen — ein Link soll nie eine Aktion auslösen', () => {
    expect(zielNachAnmeldung('/api/auth/sign-out')).toBe('/account/profile')
    expect(zielNachAnmeldung('/%61pi/auth/sign-out')).toBe('/account/profile')
    expect(zielNachAnmeldung('/x/../api/auth/sign-out')).toBe('/account/profile')
  })

  it('verwirft Nicht-Text und überlange Ziele', () => {
    expect(zielNachAnmeldung(['/a', '/b'])).toBe('/account/profile')
    expect(zielNachAnmeldung(42)).toBe('/account/profile')
    expect(zielNachAnmeldung('/' + 'a'.repeat(600))).toBe('/account/profile')
  })

  it('nimmt ein eigenes Standardziel (für „Bestellungen finden", Nr. 14)', () => {
    expect(zielNachAnmeldung('//boese.example.com', '/bestellungen')).toBe('/bestellungen')
  })
})

describe('zielNachHofAnmeldung', () => {
  it('führt zum Dashboard, nur /teilen darf als Rückkehr stehen', () => {
    expect(zielNachHofAnmeldung(null)).toBe('/dashboard')
    expect(zielNachHofAnmeldung('/teilen')).toBe('/teilen')
    expect(zielNachHofAnmeldung('/teilen/../admin')).toBe('/dashboard')
    expect(zielNachHofAnmeldung('https://boese.example.com')).toBe('/dashboard')
    expect(zielNachHofAnmeldung('/products')).toBe('/dashboard')
  })

  it('/verify darf als Rückkehr stehen — genau dieser Pfad (Nr. 17b, „Erneut senden" nach dem Anmelden)', () => {
    expect(zielNachHofAnmeldung('/verify')).toBe('/verify')
    expect(zielNachHofAnmeldung('/verify?token=x')).toBe('/dashboard')
    expect(zielNachHofAnmeldung('/verify/../admin')).toBe('/dashboard')
    expect(zielNachHofAnmeldung('//verify')).toBe('/dashboard')
  })
})

describe('Schemas', () => {
  it('E-Mail: ohne Ränder, klein, mit verständlicher Meldung', () => {
    const ok = codeAnfordernSchema.safeParse({ email: '  Kundin@Example.COM ' })
    expect(ok.success && ok.data.email).toBe('kundin@example.com')
    const falsch = codeAnfordernSchema.safeParse({ email: 'keine-adresse' })
    expect(falsch.success).toBe(false)
    if (!falsch.success) expect(falsch.error.issues[0]?.message).toContain('E-Mail-Adresse')
  })

  it('Code: genau 6 Ziffern', () => {
    expect(codeEingabeSchema.safeParse('481234').success).toBe(true)
    expect(codeEingabeSchema.safeParse('48123').success).toBe(false)
    expect(codeEingabeSchema.safeParse('48123a').success).toBe(false)
  })

  it('Ziel-Parameter: Text oder nichts, alles andere wird still zu nichts', () => {
    expect(zielParameterSchema.parse('/account/profile')).toBe('/account/profile')
    expect(zielParameterSchema.parse(undefined)).toBeUndefined()
    expect(zielParameterSchema.parse(['/a', '/b'])).toBeUndefined()
  })
})
