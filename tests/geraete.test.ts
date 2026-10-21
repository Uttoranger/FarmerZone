/**
 * Angemeldete Geräte (Register E7, Ergänzung Lauf 17; Nr. 114) — die reinen
 * Regeln aus src/lib/geraete.ts, ohne Mock.
 *
 * Beweist:
 *  - geraetName: Gerät und Browser in festen Wörtern aus echten Browserangaben
 *    (Tabelle), sonst „Unbekanntes Gerät" — nie die Angabe selbst.
 *  - Die Liste: dieses Gerät zuerst, dann nach „zuletzt"; Texte in Wiener Zeit.
 *  - Das Blatt nennt die anderen Geräte; das eigene bleibt.
 *  - Nur Hof und Betrieb merken Geräte; ein fremdes Cookie zählt nicht.
 *  - Einmal-Links: Zweck mit Art und Bezug; Frist 7 Tage.
 */
import { describe, expect, it } from 'vitest'
import {
  GERAETE_TEXT,
  UNBEKANNTES_GERAET,
  alleAnderenSatz,
  bezugAusZweck,
  einmalLinkAblauf,
  einmalLinkAufraeumGrenze,
  einmalLinkZweck,
  einmalTokenSchema,
  geraeteZeilen,
  geraetArt,
  geraeteHinweise,
  geraetName,
  gueltigeGeraeteKennung,
  merktGeraete,
  zuletztText,
  type EigeneSitzung,
} from '@/lib/geraete'

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  ipadSafari: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  curl: 'curl/8.5.0',
}

describe('geraetName', () => {
  it.each([
    [UA.iphoneSafari, 'iPhone · Safari'],
    [UA.iphoneChrome, 'iPhone · Chrome'],
    [UA.androidChrome, 'Android · Chrome'],
    [UA.androidSamsung, 'Android · Samsung Internet'],
    [UA.windowsEdge, 'Windows · Edge'],
    [UA.windowsChrome, 'Windows · Chrome'],
    [UA.windowsFirefox, 'Windows · Firefox'],
    [UA.macSafari, 'Mac · Safari'],
    [UA.ipadSafari, 'iPad · Safari'],
    [UA.linuxFirefox, 'Linux · Firefox'],
  ])('%s → %s', (ua, name) => {
    expect(geraetName(ua)).toBe(name)
  })

  it('ohne erkennbares Gerät: „Unbekanntes Gerät" — auch leer, null und für Programme', () => {
    expect(geraetName(UA.curl)).toBe(UNBEKANNTES_GERAET)
    expect(geraetName('')).toBe(UNBEKANNTES_GERAET)
    expect(geraetName(null)).toBe(UNBEKANNTES_GERAET)
  })

  it('übernimmt nie Text aus der Angabe — nur feste Wörter', () => {
    const fremd = 'Mozilla/5.0 (Windows NT 10.0) <script>x</script> Chrome/1 Hallo-Welt'
    expect(geraetName(fremd)).toBe('Windows · Chrome')
  })

  it('Handy oder Computer fürs Symbol', () => {
    expect([UA.iphoneSafari, UA.androidChrome, UA.ipadSafari].map(geraetArt)).toEqual(['handy', 'handy', 'handy'])
    expect([UA.windowsChrome, UA.macSafari, null].map(geraetArt)).toEqual(['computer', 'computer', 'computer'])
  })
})

describe('Liste „Angemeldete Geräte"', () => {
  // 19.10.2026, 14:32 in Wien (UTC+2).
  const JETZT = new Date('2026-10-19T12:32:00.000Z')
  const sitzung = (id: string, ua: string, angemeldet: string, zuletzt: string): EigeneSitzung => ({
    id,
    userAgent: ua,
    createdAt: new Date(angemeldet),
    updatedAt: new Date(zuletzt),
  })
  const SITZUNGEN = [
    sitzung('s-android', UA.androidChrome, '2026-10-16T08:00:00.000Z', '2026-10-16T09:00:00.000Z'),
    sitzung('s-windows', UA.windowsChrome, '2026-10-03T08:00:00.000Z', '2026-10-19T06:14:00.000Z'),
    sitzung('s-iphone', UA.iphoneSafari, '2026-10-12T08:00:00.000Z', '2026-10-12T08:00:00.000Z'),
  ]

  it('dieses Gerät zuerst, dann die anderen nach „zuletzt", neueste oben — mit den Sätzen aus dem Mockup', () => {
    expect(geraeteZeilen(SITZUNGEN, 's-iphone', JETZT)).toEqual([
      { id: 's-iphone', name: 'iPhone · Safari', art: 'handy', dieses: true, unterzeile: 'dieses Gerät · angemeldet seit 12.10.' },
      { id: 's-windows', name: 'Windows · Chrome', art: 'computer', dieses: false, unterzeile: 'zuletzt heute, 08:14 · angemeldet seit 3.10.' },
      { id: 's-android', name: 'Android · Chrome', art: 'handy', dieses: false, unterzeile: 'zuletzt vor 3 Tagen · angemeldet seit 16.10.' },
    ])
  })

  it('„zuletzt" nach dem Wiener Kalendertag — kurz nach Mitternacht ist 23:50 von gestern „gestern"', () => {
    const nachMitternacht = new Date('2026-10-19T22:10:00.000Z') // 20.10., 00:10 in Wien
    expect(zuletztText(new Date('2026-10-19T21:50:00.000Z'), nachMitternacht)).toBe('gestern, 23:50')
    expect(zuletztText(new Date('2026-10-19T22:05:00.000Z'), nachMitternacht)).toBe('heute, 00:05')
    expect(zuletztText(new Date('2026-10-17T10:00:00.000Z'), nachMitternacht)).toBe('vor 3 Tagen')
  })

  it('das Blatt nennt die anderen Geräte und sagt, welches bleibt', () => {
    const zeilen = geraeteZeilen(SITZUNGEN, 's-iphone', JETZT)
    expect(alleAnderenSatz(zeilen)).toBe(
      'Windows · Chrome und Android · Chrome werden sofort abgemeldet. Dieses iPhone bleibt angemeldet.'
    )
    expect(alleAnderenSatz(geraeteZeilen(SITZUNGEN.slice(0, 2), 's-windows', JETZT))).toBe(
      'Android · Chrome wird sofort abgemeldet. Dieses Gerät bleibt angemeldet.'
    )
  })

  it('gleiche Geräte stehen einmal, mit Anzahl', () => {
    const doppelt = [...SITZUNGEN, sitzung('s-windows-2', UA.windowsChrome, '2026-10-05T08:00:00.000Z', '2026-10-18T08:00:00.000Z')]
    expect(alleAnderenSatz(geraeteZeilen(doppelt, 's-iphone', JETZT))).toBe(
      'Windows · Chrome (2×) und Android · Chrome werden sofort abgemeldet. Dieses iPhone bleibt angemeldet.'
    )
  })
})

describe('Geräte-Kennung', () => {
  it('nur Hof und Betrieb merken Geräte — Kundschaft nie', () => {
    expect(merktGeraete({ role: 'FARMER', isAdmin: false })).toBe(true)
    expect(merktGeraete({ role: 'ADMIN', isAdmin: false })).toBe(true)
    expect(merktGeraete({ role: 'CUSTOMER', isAdmin: true })).toBe(true)
    expect(merktGeraete({ role: 'CUSTOMER', isAdmin: false })).toBe(false)
  })

  it('ein Cookie mit fremder Form zählt nicht als Kennung', () => {
    expect(gueltigeGeraeteKennung('AAAAAAAAAAAAAAAAAAAAAA')).toBe('AAAAAAAAAAAAAAAAAAAAAA')
    for (const fremd of [null, undefined, '', 'kurz', 'A'.repeat(23), `${'A'.repeat(21)}=`]) {
      expect(gueltigeGeraeteKennung(fremd), String(fremd)).toBeNull()
    }
  })
})

describe('Einmal-Links', () => {
  const JETZT = new Date('2026-10-19T12:00:00.000Z')

  it('Zweck aus Art und Bezug — der Bezug nur zur passenden Art', () => {
    const zweck = einmalLinkZweck('nicht-ich', 'geraet-1')
    expect(zweck).toBe('nicht-ich:geraet-1')
    expect(bezugAusZweck(zweck, 'nicht-ich')).toBe('geraet-1')
    expect(bezugAusZweck(zweck, 'nicht')).toBeNull()
    expect(bezugAusZweck('admin-einrichten:s1', 'nicht-ich')).toBeNull()
  })

  it('gilt 7 Tage; ein benutzter bleibt 7 Tage stehen', () => {
    expect(einmalLinkAblauf(JETZT)).toEqual(new Date('2026-10-26T12:00:00.000Z'))
    expect(einmalLinkAufraeumGrenze(JETZT)).toEqual(new Date('2026-10-12T12:00:00.000Z'))
  })

  it('der Token im Link hat genau die Form, die wir erzeugen', () => {
    expect(einmalTokenSchema.safeParse('A'.repeat(43)).success).toBe(true)
    for (const fremd of ['A'.repeat(42), 'A'.repeat(44), `${'A'.repeat(42)}+`, 42]) {
      expect(einmalTokenSchema.safeParse(fremd).success, String(fremd)).toBe(false)
    }
  })
})

describe('Hinweis und Zusatz im Blatt: eine Fassung für Höfe, eine für Admins (Nr. 126, Register N20)', () => {
  it('für Höfe bleibt der Text, wie er war', () => {
    expect(geraeteHinweise(false)).toEqual({
      hinweis: 'Ein Gerät kennst du nicht? Melde es ab und ändere danach dein Passwort. Wir zeigen nur Gerät und Browser – keinen Ort, keine IP-Adresse.',
      blattZusatz: 'Auf den anderen Geräten musst du dich danach neu anmelden. Kennst du ein Gerät nicht, ändere danach dein Passwort.',
    })
  })

  it('für Admins geht der Hinweis auf die Passkeys — ohne Passwort, das ist bei Konten mit Passkey gesperrt (F10, Nr. 132)', () => {
    expect(geraeteHinweise(true)).toEqual({
      hinweis:
        'Ein Gerät kennst du nicht? Melde es ab und prüf deine Passkeys – entferne jeden, den du nicht kennst. Wir zeigen nur Gerät und Browser – keinen Ort, keine IP-Adresse.',
      blattZusatz: 'Auf den anderen Geräten musst du dich danach neu anmelden. Kennst du ein Gerät nicht, prüf danach deine Passkeys.',
    })
    expect(JSON.stringify(geraeteHinweise(true))).not.toContain('Passwort')
  })

  it('beide Fassungen stehen in EINER Quelle: GERAETE_TEXT, die Hof-Fassung ist die dort ohne Zusatz', () => {
    expect(geraeteHinweise(false).hinweis).toBe(GERAETE_TEXT.hinweis)
    expect(geraeteHinweise(false).blattZusatz).toBe(GERAETE_TEXT.blattZusatz)
    expect(geraeteHinweise(true).hinweis).toBe(GERAETE_TEXT.admin.hinweis)
    expect(geraeteHinweise(true).blattZusatz).toBe(GERAETE_TEXT.admin.blattZusatz)
  })
})
