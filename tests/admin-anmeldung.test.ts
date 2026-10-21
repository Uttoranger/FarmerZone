/**
 * Admin nur mit Passkey (Register N20, Ergänzung Lauf 18; Nr. 115) — die
 * reinen Regeln aus src/lib/admin-anmeldung.ts und src/lib/ersatzcodes.ts,
 * ohne Mock, die Zeit als Parameter. Grenzen je auf die Millisekunde: 24
 * Stunden nach adminSeit, 15 Minuten Sitzung (Fälle a und b), 5 Minuten
 * frische Bestätigung (Fall c), 12 Stunden Admin-Sitzung.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ADMIN_ANMELDEN_FEHLER,
  REGISTRIERUNG_GESPERRT,
  adminSitzungAbgelaufen,
  anmeldeartFuerPfad,
  einrichtenZustand,
  frischBestaetigt,
  passkeyAdresse,
  passkeyFehlerText,
  passkeyPflicht,
  registrierungsFall,
  sichererWeiterPfad,
  type RegistrierungsLage,
} from '@/lib/admin-anmeldung'
import { ERSATZCODE_ALPHABET, ERSATZCODE_ANZAHL, ersatzcodeAnmeldenSchema, ersatzcodeDatei, ersatzcodeHash, erzeugeErsatzcode, erzeugeErsatzcodes, normalisiereErsatzcode } from '@/lib/ersatzcodes'
import { emailSchema } from '@/schemas/email'

const JETZT = new Date('2026-10-20T10:00:00Z')
const MINUTE = 60_000
const STUNDE = 60 * MINUTE
const vor = (ms: number): Date => new Date(JETZT.getTime() - ms)

function lage(abweichend: Omit<Partial<RegistrierungsLage>, 'sitzung'> & { sitzung?: Partial<RegistrierungsLage['sitzung']> } = {}): RegistrierungsLage {
  const { sitzung, ...rest } = abweichend
  return {
    isAdmin: true,
    adminSeit: vor(STUNDE),
    passkeys: 0,
    codeBestaetigt: true,
    ...rest,
    sitzung: { angemeldetAm: vor(5 * MINUTE), anmeldeart: 'passwort', passkeyAm: null, ...sitzung },
  }
}

describe('registrierungsFall — wer einen Passkey anlegen darf', () => {
  it('(a) erster Passkey: Passwort-Sitzung, frischer Code, adminSeit im Fenster', () => {
    expect(registrierungsFall(lage(), JETZT)).toBe('erster')
  })

  it('(a) nein ohne E-Mail-Code, ohne Passwort-Anmeldung, als Nicht-Admin oder ohne adminSeit', () => {
    expect(registrierungsFall(lage({ codeBestaetigt: false }), JETZT)).toBeNull()
    expect(registrierungsFall(lage({ sitzung: { anmeldeart: 'passkey' } }), JETZT)).toBeNull()
    expect(registrierungsFall(lage({ sitzung: { anmeldeart: null } }), JETZT)).toBeNull()
    expect(registrierungsFall(lage({ isAdmin: false }), JETZT)).toBeNull()
    expect(registrierungsFall(lage({ adminSeit: null }), JETZT)).toBeNull()
  })

  it('(a) 24 Stunden nach adminSeit genau noch, eine Millisekunde danach nicht mehr', () => {
    expect(registrierungsFall(lage({ adminSeit: vor(24 * STUNDE) }), JETZT)).toBe('erster')
    expect(registrierungsFall(lage({ adminSeit: vor(24 * STUNDE + 1) }), JETZT)).toBeNull()
  })

  it('(a) Sitzung genau 15 Minuten alt noch, eine Millisekunde älter nicht', () => {
    expect(registrierungsFall(lage({ sitzung: { angemeldetAm: vor(15 * MINUTE) } }), JETZT)).toBe('erster')
    expect(registrierungsFall(lage({ sitzung: { angemeldetAm: vor(15 * MINUTE + 1) } }), JETZT)).toBeNull()
  })

  it('(b) nach Ersatzcode: 15 Minuten lang genau ein Fall — danach und nach dem eingelösten Anspruch nicht', () => {
    const ersatz = { anmeldeart: 'ersatzcode', angemeldetAm: vor(15 * MINUTE) }
    expect(registrierungsFall(lage({ passkeys: 2, codeBestaetigt: false, sitzung: ersatz }), JETZT)).toBe('ersatzcode')
    expect(registrierungsFall(lage({ passkeys: 2, sitzung: { ...ersatz, angemeldetAm: vor(15 * MINUTE + 1) } }), JETZT)).toBeNull()
    expect(registrierungsFall(lage({ passkeys: 2, sitzung: { anmeldeart: 'ersatzcode-eingeloest', passkeyAm: JETZT } }), JETZT)).toBeNull()
  })

  it('(c) weiterer Passkey: passkeyAm genau 5 Minuten alt noch, eine Millisekunde älter nicht; nie ohne vorhandenen Passkey', () => {
    expect(registrierungsFall(lage({ passkeys: 1, sitzung: { anmeldeart: 'passkey', passkeyAm: vor(5 * MINUTE) } }), JETZT)).toBe('weiterer')
    expect(registrierungsFall(lage({ passkeys: 1, sitzung: { anmeldeart: 'passkey', passkeyAm: vor(5 * MINUTE + 1) } }), JETZT)).toBeNull()
    expect(registrierungsFall(lage({ passkeys: 0, codeBestaetigt: false, sitzung: { anmeldeart: 'passkey', passkeyAm: JETZT } }), JETZT)).toBeNull()
  })
})

describe('Pflicht, 12 Stunden, frische Bestätigung', () => {
  it('Pflicht ohne Passkey und nach einem Ersatzcode, der jünger ist als der jüngste Passkey', () => {
    expect(passkeyPflicht({ anzahl: 0, juengsterPasskey: null, letzterErsatzcode: null })).toBe(true)
    expect(passkeyPflicht({ anzahl: 1, juengsterPasskey: vor(STUNDE), letzterErsatzcode: vor(MINUTE) })).toBe(true)
    expect(passkeyPflicht({ anzahl: 1, juengsterPasskey: vor(MINUTE), letzterErsatzcode: vor(STUNDE) })).toBe(false)
    expect(passkeyPflicht({ anzahl: 2, juengsterPasskey: vor(MINUTE), letzterErsatzcode: null })).toBe(false)
  })

  it('Admin-Sitzung: genau 12 Stunden abgelaufen, eine Millisekunde davor nicht', () => {
    expect(adminSitzungAbgelaufen(vor(12 * STUNDE), JETZT)).toBe(true)
    expect(adminSitzungAbgelaufen(vor(12 * STUNDE - 1), JETZT)).toBe(false)
  })

  it('frisch: genau 5 Minuten ja, eine Millisekunde mehr nein, nie bestätigt nein, aus der Zukunft nein', () => {
    expect(frischBestaetigt(vor(5 * MINUTE), JETZT)).toBe(true)
    expect(frischBestaetigt(vor(5 * MINUTE + 1), JETZT)).toBe(false)
    expect(frischBestaetigt(null, JETZT)).toBe(false)
    expect(frischBestaetigt(new Date(JETZT.getTime() + MINUTE), JETZT)).toBe(false)
  })

  it('Anmeldeart nach dem Pfad: Passwort, Passkey, Ersatzcode — alles andere keine', () => {
    expect(anmeldeartFuerPfad('/sign-in/email')).toBe('passwort')
    expect(anmeldeartFuerPfad('/passkey/verify-authentication')).toBe('passkey')
    expect(anmeldeartFuerPfad('/admin-ersatzcode/anmelden')).toBe('ersatzcode')
    expect(anmeldeartFuerPfad('/sign-in/email-otp')).toBeNull()
    expect(anmeldeartFuerPfad(undefined)).toBeNull()
  })
})

describe('sichererWeiterPfad — keine offene Weiterleitung', () => {
  it('lässt relative Pfade unter /admin samt Abfrage durch', () => {
    expect(sichererWeiterPfad('/admin/finanzen/export?jahr=2026')).toBe('/admin/finanzen/export?jahr=2026')
    expect(sichererWeiterPfad('/admin')).toBe('/admin')
  })

  it('macht aus allem anderen /admin', () => {
    for (const fremd of ['//boese.example.com/admin', 'https://boese.example.com/admin', '/\\boese.example.com', '/adminx', '/admin.boese.example.com', '/admin/../hof', '/admin%2F..%2Fhof', '/dashboard', 'admin', '', ' /admin', null, undefined]) {
      expect(sichererWeiterPfad(fremd), String(fremd)).toBe('/admin')
    }
  })
})

describe('passkeyAdresse — geschützt bestimmt', () => {
  it('Hostname als rpID, Herkunft der App-Adresse', () => {
    expect(passkeyAdresse('https://hof-test.example.com')).toEqual({ rpID: 'hof-test.example.com', origin: ['https://hof-test.example.com'] })
  })

  it('unlesbar, leer oder fremdes Schema: null (die Hooks antworten dann mit 503) — kein Wurf', () => {
    expect(passkeyAdresse(null)).toBeNull()
    expect(passkeyAdresse('')).toBeNull()
    expect(passkeyAdresse('kein-adresse')).toBeNull()
    expect(passkeyAdresse('ftp://example.com')).toBeNull()
  })

  it('lokal zusätzlich der eigene Port — nur http://localhost', () => {
    expect(passkeyAdresse('http://localhost:3000', 'http://localhost:3115')?.origin).toEqual(['http://localhost:3000', 'http://localhost:3115'])
    expect(passkeyAdresse('http://localhost:3000', 'https://boese.example.com')?.origin).toEqual(['http://localhost:3000'])
    expect(passkeyAdresse('https://hof-test.example.com', 'http://localhost:3115')?.origin).toEqual(['https://hof-test.example.com'])
  })
})

describe('einrichtenZustand — was die Pflichtseite zeigt', () => {
  const basis = { adminSeit: vor(STUNDE), passkeys: 0, pflicht: true, codeBestaetigtAm: null, sitzung: { angemeldetAm: vor(MINUTE), anmeldeart: 'passwort', passkeyAm: null } }
  it('erst den Code, dann den Passkey; zu alte Sitzung → neu anmelden; Fenster vorbei → gesperrt', () => {
    expect(einrichtenZustand(basis, JETZT)).toBe('bestaetigen')
    expect(einrichtenZustand({ ...basis, codeBestaetigtAm: vor(MINUTE) }, JETZT)).toBe('passkey')
    expect(einrichtenZustand({ ...basis, sitzung: { ...basis.sitzung, angemeldetAm: vor(16 * MINUTE) } }, JETZT)).toBe('neu-anmelden')
    expect(einrichtenZustand({ ...basis, adminSeit: vor(25 * STUNDE) }, JETZT)).toBe('gesperrt')
    expect(einrichtenZustand({ ...basis, adminSeit: null }, JETZT)).toBe('gesperrt')
  })

  it('nach Ersatzcode: einrichten (15 Minuten), danach abgelaufen; mit Passkey ohne Pflicht: eingerichtet', () => {
    const ersatz = { ...basis, passkeys: 1, sitzung: { ...basis.sitzung, anmeldeart: 'ersatzcode' } }
    expect(einrichtenZustand(ersatz, JETZT)).toBe('ersatzcode')
    expect(einrichtenZustand({ ...ersatz, sitzung: { ...ersatz.sitzung, angemeldetAm: vor(16 * MINUTE) } }, JETZT)).toBe('ersatzcode-abgelaufen')
    expect(einrichtenZustand({ ...basis, passkeys: 1, pflicht: false }, JETZT)).toBe('eingerichtet')
  })
})

describe('passkeyFehlerText', () => {
  it('nach dem Code der Antwort — fremdes Konto, Nutzerprüfung, abgebrochen, zu viele, sonst allgemein', () => {
    expect(passkeyFehlerText({ code: 'PASSKEY_FREMDES_KONTO', status: 401 } as { status: number })).toBe(ADMIN_ANMELDEN_FEHLER.fremdesKonto)
    expect(passkeyFehlerText({ code: 'NUTZERPRUEFUNG_FEHLT', status: 401 } as { status: number })).toBe(ADMIN_ANMELDEN_FEHLER.nutzerpruefung)
    expect(passkeyFehlerText({ code: 'ERROR_CEREMONY_ABORTED', status: 400 } as { status: number })).toBe(ADMIN_ANMELDEN_FEHLER.abgebrochen)
    expect(passkeyFehlerText({ code: 'PASSKEY_NICHT_ERLAUBT', status: 403 } as { status: number })).toBe(REGISTRIERUNG_GESPERRT)
    expect(passkeyFehlerText({ status: 429 })).toBe(ADMIN_ANMELDEN_FEHLER.zuViele)
    expect(passkeyFehlerText({ status: 500 })).toBe(ADMIN_ANMELDEN_FEHLER.allgemein)
  })

  // Zweiter Einrichtversuch auf demselben Gerät (Nr. 126): Der Browser kennt die Passkeys des Kontos
  // (excludeCredentials) und wirft InvalidStateError; @simplewebauthn/browser macht daraus diesen Code,
  // und der Passkey-Client reicht ihn mit Status 400 weiter.
  it('Gerät hat den Passkey schon: ein eigener Satz mit Ausweg statt „Das hat nicht geklappt“', () => {
    const satz = passkeyFehlerText({ code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED', status: 400 } as { status: number })

    expect(satz).toBe('Dieses Gerät hat schon einen Passkey für dein Konto. Nimm ein anderes Gerät oder melde dich mit dem Passkey an.')
    expect(satz).toBe(ADMIN_ANMELDEN_FEHLER.schonRegistriert)
    expect(satz).not.toBe(ADMIN_ANMELDEN_FEHLER.allgemein)
  })

  it('Gegenprobe: Der Code ist wirklich der des Passkey-Clients (Version 1.6.23 nachgelesen) und des Browser-Pakets', () => {
    const client = readFileSync(join(process.cwd(), 'node_modules/@better-auth/passkey/dist/client.mjs'), 'utf8')
    expect(client).toContain('e.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"')
    expect(client).toMatch(/code: e\.code,[\s\S]{0,120}status: 400/)
  })
})

describe('Ersatzcodes', () => {
  /** Feste „Zufalls"-Bytes in einer Runde — Tests sind wiederholbar. */
  function festerZufall(bytes: number[]): (n: number) => Uint8Array {
    let i = 0
    return (n) => Uint8Array.from({ length: n }, () => bytes[i++ % bytes.length])
  }

  it('zehn verschiedene Codes XXXX-XXXX nur aus dem Alphabet ohne verwechselbare Zeichen', () => {
    const codes = erzeugeErsatzcodes()
    expect(codes).toHaveLength(ERSATZCODE_ANZAHL)
    expect(new Set(codes).size).toBe(ERSATZCODE_ANZAHL)
    const zeichen = `[${ERSATZCODE_ALPHABET}]`
    for (const code of codes) expect(code).toMatch(new RegExp(`^${zeichen}{4}-${zeichen}{4}$`))
    expect(ERSATZCODE_ALPHABET).not.toMatch(/[0O1IL2Z5S6B8]/)
  })

  it('verwirft Bytes über dem größten Vielfachen der Alphabetlänge (keine Verzerrung)', () => {
    // 250 liegt über 240 (= 10 × 24) und wird übersprungen; 0 ist das erste Zeichen.
    expect(erzeugeErsatzcode(festerZufall([250, 0, 1, 2, 3, 4, 5, 6, 7]))).toBe('ACDE-FGHJ')
  })

  it('getippte Form egal: Kleinbuchstaben, Leerzeichen, Strich — falsche Länge oder Zeichen: null', () => {
    expect(normalisiereErsatzcode(' jmea qufd ')).toBe('JMEAQUFD')
    expect(normalisiereErsatzcode('JMEA-QUFD')).toBe('JMEAQUFD')
    expect(normalisiereErsatzcode('JMEA-QUF')).toBeNull()
    expect(normalisiereErsatzcode('JMEO-QUFD')).toBeNull()
  })

  it('der Hash: HMAC, je Konto verschieden, gleich für jede Schreibweise — der Code steht nicht darin', async () => {
    const a = await ersatzcodeHash('geheim', 'konto-a', 'jmea-qufd')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).toBe(await ersatzcodeHash('geheim', 'konto-a', 'JMEAQUFD'))
    expect(a).not.toBe(await ersatzcodeHash('geheim', 'konto-b', 'JMEA-QUFD'))
    expect(a).not.toBe(await ersatzcodeHash('anderes', 'konto-a', 'JMEA-QUFD'))
    expect(a.toUpperCase()).not.toContain('JMEA')
  })

  describe('Systemgrenze der Anmeldung mit Ersatzcode: die Adresse', () => {
    const parse = (email: unknown) => ersatzcodeAnmeldenSchema.safeParse({ email, code: 'JMEA-QUFD' })

    it('eine gültige Adresse geht durch emailSchema: ohne Ränder, klein geschrieben', () => {
      const geprueft = parse('  Admin@Example.COM ')

      expect(geprueft.success && geprueft.data.email).toBe('admin@example.com')
      expect(geprueft.success && geprueft.data.email).toBe(emailSchema().parse('  Admin@Example.COM '))
    })

    it('eine Adresse mit falschem Format wird nicht abgewiesen, sondern bleibt eine unbekannte Adresse: dieselbe allgemeine Antwort, nichts zum Ablesen', () => {
      for (const roh of ['kein format', 'ohne-at.example.com', '@example.com', ' Zwei@@Example.com ']) {
        const geprueft = parse(roh)
        expect(geprueft.success, roh).toBe(true)
        // Wie vor Nr. 126 ohne Rand und klein — der Endpunkt sucht dann ohne Treffer und antwortet wie bei jeder unbekannten Adresse.
        expect(geprueft.success && geprueft.data.email, roh).toBe(roh.trim().toLowerCase())
      }
    })

    it('zu lang oder gar keine Zeichenkette: ebenfalls kein eigener Fehler, die Adresse ist höchstens 254 Zeichen lang', () => {
      const lang = parse(`${'a'.repeat(300)}@example.com`)
      expect(lang.success && lang.data.email.length).toBeLessThanOrEqual(254)
      expect(parse(42).success && parse(42)).toMatchObject({ data: { email: '' } })
    })

    it('der Code bleibt eine Zeichenkette bis 40 Zeichen', () => {
      expect(ersatzcodeAnmeldenSchema.safeParse({ email: 'admin@example.com', code: 'x'.repeat(41) }).success).toBe(false)
    })
  })

  it('die Datei enthält die Codes und keinen Namen eines Kontos', () => {
    const datei = ersatzcodeDatei(['JMEA-QUFD', 'DAQW-MCJV'], '20.10. um 10:00')
    expect(datei).toContain('JMEA-QUFD')
    expect(datei).toContain('DAQW-MCJV')
    expect(datei).not.toContain('@')
  })
})
