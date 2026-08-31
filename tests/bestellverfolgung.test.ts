/**
 * Tests für die Bestellverfolgung: der signierte Bestell-Link
 * (src/lib/bestell-link.ts), die Status-Darstellung in Kundinnen-Sprache
 * (src/lib/bestellstatus.ts) und der Kalendereintrag (src/lib/kalender.ts).
 *
 * Verhalten, keine Mock-Spiegel: Die Signatur-Tests erzeugen und prüfen am
 * echten HMAC, die Status-Tests laufen über JEDEN realen Enum-Wert, die
 * ICS-Tests messen die fertige Datei (Oktette, Maskierung, Zeitzone).
 */
import { describe, it, expect } from 'vitest'
import { OrderStatus } from '@prisma/client'
import { bestellSignatur, bestellLinkGilt, bestellungPfad } from '@/lib/bestell-link'
import {
  bestellStatusAnzeige,
  formatiereAbholtermin,
  zahlungsAnzeige,
  MARKE_GRUEN,
} from '@/lib/bestellstatus'
import { erzeugeIcs, icsFalte, icsText, wienKalendertag } from '@/lib/kalender'

describe('Bestell-Link — die Signatur', () => {
  it('eine gültige Signatur öffnet', () => {
    expect(bestellLinkGilt('order-1', bestellSignatur('order-1'))).toBe(true)
  })

  it('eine manipulierte Signatur wird abgelehnt', () => {
    const signatur = bestellSignatur('order-1')
    const gedreht = signatur.slice(0, -1) + (signatur.at(-1) === 'a' ? 'b' : 'a')
    expect(bestellLinkGilt('order-1', gedreht)).toBe(false)
  })

  it('die gültige Signatur einer ANDEREN Bestellung wird abgelehnt', () => {
    expect(bestellLinkGilt('order-2', bestellSignatur('order-1'))).toBe(false)
  })

  it('Müll und leere Signaturen werden abgelehnt', () => {
    expect(bestellLinkGilt('order-1', '')).toBe(false)
    expect(bestellLinkGilt('order-1', 'keine-signatur')).toBe(false)
  })

  it('der Pfad trägt Hof-Slug, Bestell-ID und die Signatur als ?s=', () => {
    const pfad = bestellungPfad('hof-mueller', 'order-1')
    expect(pfad).toBe(`/hof-mueller/bestellung/order-1?s=${bestellSignatur('order-1')}`)
    expect(pfad).toMatch(/\?s=[0-9a-f]{64}$/)
  })
})

describe('bestellStatusAnzeige — jeder reale Status bekommt Marke, Farbe und Satz', () => {
  const TERMIN = 'am Freitag, 4. September zwischen 14:00 und 16:00 Uhr'

  // Über das ECHTE Enum, nicht über eine abgeschriebene Liste: Kommt je ein
  // neunter Status dazu, wird dieser Test rot statt still unvollständig.
  it.each(Object.values(OrderStatus))('%s liefert eine vollständige Darstellung', (status) => {
    const anzeige = bestellStatusAnzeige(status, TERMIN)
    expect(anzeige.marke.length).toBeGreaterThan(0)
    expect(anzeige.satz.length).toBeGreaterThan(10)
    expect(anzeige.farbe).toMatch(/bg-/)
    expect(anzeige.farbe).toMatch(/text-/)
  })

  it('READY erklärt sich mit dem Abholtermin im Satz', () => {
    const anzeige = bestellStatusAnzeige('READY', TERMIN)
    expect(anzeige.marke).toBe('Abholbereit')
    expect(anzeige.satz).toContain('Dein Paket wartet')
    expect(anzeige.satz).toContain(TERMIN)
  })

  it('die FARBEN tragen die Bedeutung — grün läuft, orange verlangt etwas, rot ist schiefgegangen, grau ist vorbei', () => {
    // Nicht nur „irgendeine Farbe": Ein grünes „Storniert" wäre eine
    // falsche Botschaft, die kein Typcheck fängt.
    expect(bestellStatusAnzeige('READY', TERMIN).farbe).toBe(MARKE_GRUEN)
    expect(bestellStatusAnzeige('PAID', TERMIN).farbe).toBe(MARKE_GRUEN)
    expect(bestellStatusAnzeige('PENDING_CONFIRMATION', TERMIN).farbe).toContain('#FBEEE3')
    expect(bestellStatusAnzeige('CANCELLED', TERMIN).farbe).toBe('bg-red-100 text-red-700')
    expect(bestellStatusAnzeige('NOT_PICKED_UP', TERMIN).farbe).toBe('bg-red-100 text-red-700')
    expect(bestellStatusAnzeige('PICKED_UP', TERMIN).farbe).toContain('#F0EDE5')
  })

  it('PENDING_CONFIRMATION unterscheidet ehrlich nach Zahlungsart: online gibt es keinen Bestätigungslink', () => {
    // Vor-Ort: Der Bestätigungslink aus der Mail ist der nächste Schritt.
    expect(bestellStatusAnzeige('PENDING_CONFIRMATION', TERMIN, 'ONSITE_CASH').satz).toContain(
      'E-Mail'
    )
    // Online steht der Status nur, bis der Stripe-Webhook PAID setzt — ein
    // Verweis auf einen Bestätigungslink wäre gelogen (den gibt es nicht).
    const online = bestellStatusAnzeige('PENDING_CONFIRMATION', TERMIN, 'ONLINE')
    expect(online.marke).toBe('Zahlung offen')
    expect(online.satz).not.toContain('E-Mail')
  })

  it('ein unbekannter Status fällt auf eine definierte, neutrale Darstellung zurück', () => {
    const anzeige = bestellStatusAnzeige('KUENFTIGER_WERT', TERMIN)
    expect(anzeige.marke).toBe('Bestellung')
    expect(anzeige.satz.length).toBeGreaterThan(10)
    expect(anzeige.farbe).toMatch(/bg-/)
  })

  it('formatiereAbholtermin nennt den Wiener Wochentag, auch wenn der Server in UTC läuft', () => {
    // 4. September 2026 ist ein Freitag; gespeichert wird 12:00 (Mittag).
    expect(formatiereAbholtermin(new Date('2026-09-04T12:00:00Z'), '14:00', '16:00')).toBe(
      'am Freitag, 4. September zwischen 14:00 und 16:00 Uhr'
    )
  })

  it('zahlungsAnzeige übersetzt Art und Zustand in Kundinnen-Sprache', () => {
    expect(zahlungsAnzeige('ONSITE_CASH', 'PENDING')).toEqual({
      art: 'Bar bei Abholung',
      zustand: 'Noch offen',
    })
    expect(zahlungsAnzeige('ONLINE', 'PAID')).toEqual({ art: 'Online', zustand: 'Bezahlt' })
    expect(zahlungsAnzeige('ONLINE', 'REFUNDED')).toEqual({
      art: 'Online',
      zustand: 'Rückerstattet',
    })
  })
})

describe('Kalendereintrag (ICS)', () => {
  const EINTRAG = {
    titel: 'Abholung Hof Müller',
    ort: 'Dorfstraße 12, 4910 Ried im Innkreis',
    beschreibung: 'Bestellung HM-2611-A4F2\nhttps://farmerzone.at/hof-mueller/bestellung/o1?s=abc',
    datum: '2026-09-04',
    beginn: '14:00',
    ende: '16:00',
    kennung: 'order-1',
    erstellt: new Date('2026-08-31T10:00:00Z'),
  }

  it('trägt Beginn, Ende, Ort und Titel — die Zeiten als Wiener Ortszeit', () => {
    const ics = erzeugeIcs(EINTRAG)
    expect(ics).toContain('DTSTART;TZID=Europe/Vienna:20260904T140000')
    expect(ics).toContain('DTEND;TZID=Europe/Vienna:20260904T160000')
    expect(ics).toContain('SUMMARY:Abholung Hof Müller')
    // Der Beistrich der Adresse ist maskiert, sonst zerfiele das Feld.
    expect(ics).toContain('LOCATION:Dorfstraße 12\\, 4910 Ried im Innkreis')
    expect(ics).toContain('BEGIN:VTIMEZONE')
    expect(ics).toContain('TZID:Europe/Vienna')
    expect(ics).toContain('UID:abholung-order-1@farmerzone')
    expect(ics).toContain('DTSTAMP:20260831T100000Z')
  })

  it('maskiert Sonderzeichen und Zeilenumbrüche, Umlaute bleiben Umlaute', () => {
    expect(icsText('Müller; und, zwar\\so')).toBe('Müller\\; und\\, zwar\\\\so')
    expect(icsText('Zeile 1\nZeile 2')).toBe('Zeile 1\\nZeile 2')
    // Auch CRLF und ein NACKTES \r werden je EIN \n — roh wären sie in der
    // Datei verbotene Steuerzeichen.
    expect(icsText('a\r\nb')).toBe('a\\nb')
    expect(icsText('a\rb')).toBe('a\\nb')
    const ics = erzeugeIcs(EINTRAG)
    // Der Zeilenumbruch der Beschreibung wird zu \n im Wert — die Datei
    // selbst bricht NUR mit CRLF um.
    expect(ics).toContain('Bestellung HM-2611-A4F2\\n')
    expect(ics.split('\r\n').some((z) => z.includes('\n'))).toBe(false)
  })

  it('faltet lange Zeilen bei 75 Oktetten, ohne ein Mehrbyte-Zeichen zu zerteilen', () => {
    const lang = 'DESCRIPTION:' + 'Käsestraße 5, Öhling — '.repeat(12)
    const gefaltet = icsFalte(lang)
    for (const zeile of gefaltet.split('\r\n')) {
      expect(Buffer.byteLength(zeile, 'utf8')).toBeLessThanOrEqual(75)
    }
    // Entfalten (CRLF+Leerzeichen entfernen) ergibt exakt die Ausgangszeile —
    // beim Falten ging kein Zeichen verloren und keines kaputt.
    expect(gefaltet.replace(/\r\n /g, '')).toBe(lang)
  })

  it('jede Zeile der fertigen Datei hält die 75-Oktett-Grenze, Enden mit CRLF', () => {
    const ics = erzeugeIcs(EINTRAG)
    expect(ics.endsWith('\r\n')).toBe(true)
    for (const zeile of ics.split('\r\n')) {
      expect(Buffer.byteLength(zeile, 'utf8')).toBeLessThanOrEqual(75)
    }
  })

  it('füllt einstellige Stunden auf — „9:00" wird T090000, nie ungültiges T90000', () => {
    const ics = erzeugeIcs({ ...EINTRAG, beginn: '9:00', ende: '11:30' })
    expect(ics).toContain('DTSTART;TZID=Europe/Vienna:20260904T090000')
    expect(ics).toContain('DTEND;TZID=Europe/Vienna:20260904T113000')
  })

  it('wienKalendertag löst den Kalendertag in Wien auf — auch über die UTC-Datumsgrenze', () => {
    expect(wienKalendertag(new Date('2026-09-04T12:00:00Z'))).toBe('2026-09-04')
    // 23:30 UTC im Winter = 00:30 des FOLGETAGS in Wien.
    expect(wienKalendertag(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16')
  })
})
