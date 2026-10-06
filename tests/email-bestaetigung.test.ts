/**
 * E-Mail-Bestätigung für neue Höfe (S3, Nachtlauf Nr. 17b) — die reinen
 * Regeln aus src/lib/email-bestaetigung.ts, ohne Datenbank und ohne Mock.
 *
 * Beweist:
 *  - Stichtag: Nur Konten ab dem Stichtag müssen bestätigen; ältere bleiben
 *    unberührt, auch wenn sie unbestätigt sind (Grenze auf die Millisekunde).
 *  - „Offen" heißt pflichtig UND unbestätigt.
 *  - Erneut-senden-Bremse: 60 Sekunden Abstand, höchstens 5 in der Stunde,
 *    mit Wartezeit in ganzen Sekunden; alte Versände fallen aus dem Fenster.
 *  - Der gespeicherte Wert übersteht Müll (Fremddaten aus der Datenbank).
 *  - Der Link zeigt auf /verify mit dem Token, nie auf Better Auths GET-Pfad.
 */
import { describe, expect, it } from 'vitest'
import {
  BESTAETIGUNG_GESPERRTE_AUTH_PFADE,
  EMAIL_BESTAETIGUNG_STICHTAG,
  ERNEUT_SENDEN,
  bestaetigungOffen,
  bestaetigungPflichtig,
  bestaetigungsPfad,
  erneutSendenEntscheidung,
  erneutWarteText,
  leseVersandZeiten,
  restWartezeitErneut,
  schreibeVersandZeiten,
  versandKennung,
} from '@/lib/email-bestaetigung'

const STICHTAG = EMAIL_BESTAETIGUNG_STICHTAG.getTime()

describe('Stichtag', () => {
  it('liegt auf einer Wiener Mitternacht', () => {
    const teile = new Intl.DateTimeFormat('de-AT', {
      timeZone: 'Europe/Vienna',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(EMAIL_BESTAETIGUNG_STICHTAG)
    expect(teile).toBe('00:00')
  })

  it('ein Konto ab dem Stichtag muss bestätigen', () => {
    expect(bestaetigungPflichtig({ createdAt: new Date(STICHTAG) })).toBe(true)
    expect(bestaetigungPflichtig({ createdAt: new Date(STICHTAG + 86_400_000) })).toBe(true)
  })

  it('ein Konto vor dem Stichtag bleibt unberührt — auch eine Millisekunde davor', () => {
    expect(bestaetigungPflichtig({ createdAt: new Date(STICHTAG - 1) })).toBe(false)
    expect(bestaetigungPflichtig({ createdAt: new Date('2026-09-01T10:00:00Z') })).toBe(false)
  })

  it('der Stichtag lässt sich für Tests übergeben', () => {
    const anderer = new Date('2030-01-01T00:00:00Z')
    expect(bestaetigungPflichtig({ createdAt: new Date(STICHTAG) }, anderer)).toBe(false)
  })
})

describe('bestaetigungOffen', () => {
  it('neu und unbestätigt: offen', () => {
    expect(bestaetigungOffen({ createdAt: new Date(STICHTAG + 1), emailVerified: false })).toBe(true)
  })

  it('neu und bestätigt: nicht offen', () => {
    expect(bestaetigungOffen({ createdAt: new Date(STICHTAG + 1), emailVerified: true })).toBe(false)
  })

  it('alt und unbestätigt: nicht offen (bestehende Höfe unberührt)', () => {
    expect(bestaetigungOffen({ createdAt: new Date(STICHTAG - 1), emailVerified: false })).toBe(false)
  })

  it('nur true zählt als bestätigt — null und fehlend sind unbestätigt', () => {
    expect(bestaetigungOffen({ createdAt: new Date(STICHTAG + 1), emailVerified: null })).toBe(true)
  })
})

describe('erneutSendenEntscheidung — die Bremse', () => {
  const t0 = 1_800_000_000_000

  it('ohne bisherigen Versand: erlaubt, der Versand wird vermerkt', () => {
    expect(erneutSendenEntscheidung([], t0)).toEqual({ erlaubt: true, zeiten: [t0] })
  })

  it('innerhalb von 60 Sekunden: gebremst, mit Restzeit in ganzen Sekunden', () => {
    expect(ERNEUT_SENDEN.abstandSekunden).toBe(60)
    expect(erneutSendenEntscheidung([t0], t0 + 1)).toEqual({ erlaubt: false, warteSekunden: 60 })
    expect(erneutSendenEntscheidung([t0], t0 + 59_001)).toEqual({ erlaubt: false, warteSekunden: 1 })
  })

  it('genau nach 60 Sekunden: wieder erlaubt', () => {
    expect(erneutSendenEntscheidung([t0], t0 + 60_000)).toEqual({ erlaubt: true, zeiten: [t0, t0 + 60_000] })
  })

  it('höchstens 5 in der Stunde — der sechste wartet, bis der erste aus dem Fenster fällt', () => {
    expect(ERNEUT_SENDEN.hoechstensJeFenster).toBe(5)
    expect(ERNEUT_SENDEN.fensterSekunden).toBe(3600)
    const fuenf = [0, 1, 2, 3, 4].map((i) => t0 + i * 120_000)
    const jetzt = t0 + 10 * 60_000
    const e = erneutSendenEntscheidung(fuenf, jetzt)
    expect(e).toEqual({ erlaubt: false, warteSekunden: 50 * 60 })
    // Gegenprobe: Nach einer Stunde ab dem ersten geht es wieder.
    expect(erneutSendenEntscheidung(fuenf, t0 + 3_600_000).erlaubt).toBe(true)
  })

  it('Versände älter als eine Stunde fallen aus dem gespeicherten Stand', () => {
    const alt = t0 - 3_600_001
    expect(erneutSendenEntscheidung([alt], t0)).toEqual({ erlaubt: true, zeiten: [t0] })
  })

  it('ein Zeitpunkt in der Zukunft (Uhren zweier Instanzen) bremst wie ein frischer', () => {
    expect(erneutSendenEntscheidung([t0 + 5_000], t0).erlaubt).toBe(false)
  })

  it('restWartezeitErneut: 0 = sofort, sonst die Sekunden', () => {
    expect(restWartezeitErneut([], t0)).toBe(0)
    expect(restWartezeitErneut([t0], t0 + 30_000)).toBe(30)
  })

  it('der Satz nennt die Wartezeit ohne Fachwort', () => {
    expect(erneutWarteText(1)).toBe('Wir haben dir gerade eine E-Mail geschickt. Probier es in 1 Sekunde noch einmal.')
    expect(erneutWarteText(45)).toContain('45 Sekunden')
    expect(erneutWarteText(50 * 60)).toContain('50 Minuten')
  })
})

describe('gespeicherter Stand', () => {
  it('Hin und zurück', () => {
    expect(leseVersandZeiten(schreibeVersandZeiten([1, 2, 3]))).toEqual([1, 2, 3])
  })

  it('Müll ergibt keinen Stand, statt zu werfen', () => {
    expect(leseVersandZeiten('')).toEqual([])
    expect(leseVersandZeiten('abc,12,-5,1e3x')).toEqual([12])
  })

  it('die Kennung hängt am Konto, nicht an der Adresse', () => {
    expect(versandKennung('user-1')).toBe('email-bestaetigung-versand-user-1')
  })
})

describe('Link und gesperrte Pfade', () => {
  it('der Link führt auf /verify mit dem Token — kodiert', () => {
    expect(bestaetigungsPfad('a.b.c')).toBe('/verify?token=a.b.c')
    expect(bestaetigungsPfad('a&b')).toBe('/verify?token=a%26b')
  })

  it('Better Auths Wege über HTTP sind zu: Bestätigen per GET und offenes Anfordern', () => {
    expect(BESTAETIGUNG_GESPERRTE_AUTH_PFADE).toEqual(['/verify-email', '/send-verification-email'])
  })
})
