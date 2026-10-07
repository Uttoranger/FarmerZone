/**
 * Double-Opt-in (Register S11, Nachtlauf Nr. 38): Regeln und signierter Link
 * ohne Datenbank — src/lib/abo-bestaetigung.ts und abo-bestaetigung-token.ts.
 */
import { createHmac } from 'crypto'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ABO_BESTAETIGUNG_GUELTIG_MS,
  ABO_BESTAETIGUNG_PAUSE_MS,
  emailAnmeldungSchritt,
  wartetAufBestaetigung,
  werbemailErlaubt,
  type EmailAboStand,
} from '@/lib/abo-bestaetigung'
import { aboBestaetigungsPfad, erzeugeAboBestaetigungsToken, pruefeAboBestaetigungsToken } from '@/lib/abo-bestaetigung-token'
import { generateUnsubscribeToken } from '@/lib/unsubscribe'
import { generateReorderToken } from '@/lib/reorder-token'

const JETZT = new Date('2026-10-07T12:00:00Z')
const vor = (ms: number): Date => new Date(JETZT.getTime() - ms)

const BESTAND: EmailAboStand = { optInEmail: true, emailOptInAngefragtAm: null, emailOptInBestaetigtAm: null }
const ANGEFRAGT: EmailAboStand = { optInEmail: false, emailOptInAngefragtAm: vor(60 * 60 * 1000), emailOptInBestaetigtAm: null }
const BESTAETIGT: EmailAboStand = { optInEmail: true, emailOptInAngefragtAm: vor(2 * 60 * 60 * 1000), emailOptInBestaetigtAm: vor(60 * 60 * 1000) }

describe('werbemailErlaubt', () => {
  it('Bestand (nie angefragt) mit Haken bekommt weiter Mails — unverändert', () => {
    expect(werbemailErlaubt(BESTAND)).toBe(true)
  })

  it('eine angefragte, unbestätigte Anmeldung bekommt keine werbliche Mail', () => {
    expect(werbemailErlaubt(ANGEFRAGT)).toBe(false)
    // Auch wenn der Haken (z. B. vom alten Code im Deploy-Fenster) gesetzt ist.
    expect(werbemailErlaubt({ ...ANGEFRAGT, optInEmail: true })).toBe(false)
  })

  it('eine bestätigte Anmeldung bekommt Mails', () => {
    expect(werbemailErlaubt(BESTAETIGT)).toBe(true)
  })

  it('ohne Haken nie — auch bestätigt oder Bestand (abgemeldet)', () => {
    expect(werbemailErlaubt({ ...BESTAND, optInEmail: false })).toBe(false)
    expect(werbemailErlaubt({ ...BESTAETIGT, optInEmail: false })).toBe(false)
  })
})

describe('emailAnmeldungSchritt', () => {
  it('neue Adresse ohne Abo → Link schicken', () => {
    expect(emailAnmeldungSchritt(null, JETZT)).toBe('bestaetigung-schicken')
  })

  it('bestätigtes Abo → nichts tun, keine neue Bestätigung', () => {
    expect(emailAnmeldungSchritt(BESTAETIGT, JETZT)).toBe('schon-aktiv')
  })

  it('Bestand mit Haken → nichts tun (bleibt unverändert)', () => {
    expect(emailAnmeldungSchritt(BESTAND, JETZT)).toBe('schon-aktiv')
  })

  it('Bestand ohne E-Mail-Haken (z. B. nur WhatsApp) → Link schicken', () => {
    expect(emailAnmeldungSchritt({ ...BESTAND, optInEmail: false }, JETZT)).toBe('bestaetigung-schicken')
  })

  it('unbestätigt, Link vor weniger als der Pause → gebremst', () => {
    const frisch = { ...ANGEFRAGT, emailOptInAngefragtAm: vor(ABO_BESTAETIGUNG_PAUSE_MS - 1) }
    expect(emailAnmeldungSchritt(frisch, JETZT)).toBe('gebremst')
  })

  it('unbestätigt, genau nach der Pause → neuer Link', () => {
    const alt = { ...ANGEFRAGT, emailOptInAngefragtAm: vor(ABO_BESTAETIGUNG_PAUSE_MS) }
    expect(emailAnmeldungSchritt(alt, JETZT)).toBe('bestaetigung-schicken')
  })

  it('bestätigt, dann abgemeldet → neu bestätigen', () => {
    expect(emailAnmeldungSchritt({ ...BESTAETIGT, optInEmail: false }, JETZT)).toBe('bestaetigung-schicken')
  })
})

describe('wartetAufBestaetigung', () => {
  it('angefragt und Link noch gültig → wartet', () => {
    expect(wartetAufBestaetigung(ANGEFRAGT, JETZT)).toBe(true)
  })

  it('Link abgelaufen → wartet nicht mehr (Schalter zeigt aus)', () => {
    expect(wartetAufBestaetigung({ ...ANGEFRAGT, emailOptInAngefragtAm: vor(ABO_BESTAETIGUNG_GUELTIG_MS) }, JETZT)).toBe(false)
  })

  it('Bestand und bestätigt warten nie', () => {
    expect(wartetAufBestaetigung(BESTAND, JETZT)).toBe(false)
    expect(wartetAufBestaetigung(BESTAETIGT, JETZT)).toBe(false)
  })
})

describe('Bestätigungs-Token', () => {
  it('gültig ausgestellt → liefert die Abo-ID', () => {
    const token = erzeugeAboBestaetigungsToken('abo123', JETZT)
    expect(pruefeAboBestaetigungsToken(token, JETZT)).toEqual({ ok: true, aboId: 'abo123' })
  })

  it('1 ms vor dem Ablauf gültig, genau am Ablauf abgelaufen', () => {
    const token = erzeugeAboBestaetigungsToken('abo123', JETZT)
    const ende = JETZT.getTime() + ABO_BESTAETIGUNG_GUELTIG_MS
    expect(pruefeAboBestaetigungsToken(token, new Date(ende - 1))).toEqual({ ok: true, aboId: 'abo123' })
    expect(pruefeAboBestaetigungsToken(token, new Date(ende))).toEqual({ ok: false, grund: 'abgelaufen' })
  })

  it('manipulierte Abo-ID → ungültig (nicht „abgelaufen")', () => {
    const token = erzeugeAboBestaetigungsToken('abo123', JETZT)
    const [b64, sig] = token.split('.')
    const payload = Buffer.from(b64!, 'base64url').toString().replace('abo123', 'abo999')
    const gefaelscht = `${Buffer.from(payload).toString('base64url')}.${sig}`
    expect(pruefeAboBestaetigungsToken(gefaelscht, JETZT)).toEqual({ ok: false, grund: 'ungueltig' })
  })

  it('verlängerter Ablauf ohne neue Signatur → ungültig', () => {
    const token = erzeugeAboBestaetigungsToken('abo123', JETZT)
    const [b64, sig] = token.split('.')
    const payload = Buffer.from(b64!, 'base64url').toString().replace(/:\d+$/, ':99999999999999')
    expect(pruefeAboBestaetigungsToken(`${Buffer.from(payload).toString('base64url')}.${sig}`, JETZT)).toEqual({
      ok: false,
      grund: 'ungueltig',
    })
  })

  it('fremdes Geheimnis → ungültig', () => {
    const payload = `abo-optin:abo123:${JETZT.getTime() + 1000}`
    const sig = createHmac('sha256', 'ein-anderes-geheimnis').update(payload).digest('hex')
    expect(pruefeAboBestaetigungsToken(`${Buffer.from(payload).toString('base64url')}.${sig}`, JETZT).ok).toBe(false)
  })

  it('Abmelde- und Reorder-Token desselben Geheimnisses gelten hier nicht (Zweck)', () => {
    expect(pruefeAboBestaetigungsToken(generateUnsubscribeToken('kundin@example.com', 'abo123'), JETZT).ok).toBe(false)
    expect(pruefeAboBestaetigungsToken(generateReorderToken('abo123', 'hof1'), JETZT).ok).toBe(false)
  })

  it('Unsinn → ungültig statt Absturz', () => {
    for (const roh of ['', '.', 'abc', 'abc.def', '%%%.%%%', `${'a'.repeat(300)}.x`]) {
      expect(pruefeAboBestaetigungsToken(roh, JETZT), roh).toEqual({ ok: false, grund: 'ungueltig' })
    }
  })

  it('der Token trägt keine E-Mail-Adresse', () => {
    const token = erzeugeAboBestaetigungsToken('abo123', JETZT)
    expect(Buffer.from(token.split('.')[0]!, 'base64url').toString()).not.toContain('@')
  })

  it('der Pfad führt auf die Seite mit dem Knopf, Token kodiert', () => {
    expect(aboBestaetigungsPfad('a.b')).toBe('/account/neuigkeiten-bestaetigen?token=a.b')
  })
})

describe('Regeln und Texte sind im Browser ladbar', () => {
  // /account (Client-Komponente) liest ABO_TEXT. Zöge abo-bestaetigung.ts env
  // oder das Geheimnis mit, bräche die Seite im Browser („Fehlende
  // Umgebungsvariablen") — im Browser-Durchlauf von Nr. 38 so passiert.
  const quelltext = readFileSync(join(process.cwd(), 'src/lib/abo-bestaetigung.ts'), 'utf8')
  const importe = quelltext.split('\n').filter((zeile) => /^\s*import\b/.test(zeile))

  it('abo-bestaetigung.ts importiert weder env noch crypto noch das Geheimnis', () => {
    expect(importe.filter((zeile) => /@\/lib\/env|['"](node:)?crypto['"]|geheimnis/.test(zeile))).toEqual([])
  })

  it('Gegenprobe: die Suche erkennt den Import des Token-Moduls', () => {
    const token = readFileSync(join(process.cwd(), 'src/lib/abo-bestaetigung-token.ts'), 'utf8')
    expect(token).toMatch(/import \{ env \} from '@\/lib\/env'/)
  })
})
