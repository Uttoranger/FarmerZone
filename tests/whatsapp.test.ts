/**
 * Tests für die WhatsApp-Helfer (src/lib/whatsapp.ts).
 *
 * Beweist: Vorname-Extraktion mit Fallback ohne Anrede, deutsches
 * Datums-/Zeitformat in der Erinnerungs-Nachricht, korrektes URL-Encoding
 * (Umlaute) und die wa.me-Telefonnummern-Normalisierung.
 */
import { describe, it, expect } from 'vitest'
import { toWaPhone, buildOrderReminderMessage, buildOrderReminderUrl } from '@/lib/whatsapp'

// 20.07.2026 ist ein Montag; 12:00 lokal entspricht der Speicher-Konvention des Checkouts
const baseOrder = {
  customerName: 'Maria Huber',
  orderNumber: 'TST-2007-AB12',
  farmName: 'Biohof Müller',
  pickupDate: new Date(2026, 6, 20, 12, 0, 0),
  pickupTimeStart: '09:00',
  pickupTimeEnd: '12:00',
}

describe('buildOrderReminderMessage', () => {
  it('baut die komplette Nachricht mit Vorname, Wochentag und Zeitfenster', () => {
    expect(buildOrderReminderMessage(baseOrder)).toBe(
      'Hallo Maria, deine Bestellung TST-2007-AB12 bei Biohof Müller liegt am ' +
        'Montag, 20. Juli zwischen 09:00–12:00 Uhr zur Abholung bereit. Bis dann!'
    )
  })

  it('nimmt nur das erste Wort des Namens als Anrede', () => {
    const msg = buildOrderReminderMessage({ ...baseOrder, customerName: 'Anna-Lena Maier Huber' })
    expect(msg.startsWith('Hallo Anna-Lena, deine Bestellung')).toBe(true)
  })

  it('fällt ohne Namen auf eine Variante ohne Anrede zurück', () => {
    const msg = buildOrderReminderMessage({ ...baseOrder, customerName: '   ' })
    expect(msg.startsWith('Deine Bestellung TST-2007-AB12')).toBe(true)
    expect(msg).not.toContain('Hallo')
  })

  it('akzeptiert das Abholdatum auch als ISO-String (RSC-Serialisierung)', () => {
    const msg = buildOrderReminderMessage({
      ...baseOrder,
      pickupDate: new Date(2026, 6, 21, 12, 0, 0).toISOString(),
    })
    expect(msg).toContain('am Dienstag, 21. Juli')
  })
})

describe('buildOrderReminderUrl', () => {
  it('baut einen wa.me-Link mit normalisierter Nummer und URL-encodeter Nachricht', () => {
    const url = buildOrderReminderUrl('+43 660 123 45 67', baseOrder)
    expect(url.startsWith('https://wa.me/436601234567?text=')).toBe(true)
    expect(url).not.toContain(' ')
  })

  it('encodet Umlaute korrekt (ü → %C3%BC)', () => {
    const url = buildOrderReminderUrl('06601234567', {
      ...baseOrder,
      customerName: 'Jürgen Höfler',
      farmName: 'Grüner Hof',
    })
    expect(url).toContain('J%C3%BCrgen')
    expect(url).toContain('Gr%C3%BCner%20Hof')
    expect(url).not.toContain('ü')
  })
})

describe('toWaPhone (Konvention aus Kundendetail/Status-Werkstatt, jetzt zentral)', () => {
  it('entfernt das + bei internationalen Nummern', () => {
    expect(toWaPhone('+43 660 1234567')).toBe('436601234567')
  })

  it('ersetzt die führende 0 durch die österreichische Vorwahl 43', () => {
    expect(toWaPhone('0660 1234567')).toBe('436601234567')
  })

  it('entfernt Leerzeichen, Bindestriche, Klammern und Punkte', () => {
    expect(toWaPhone('(0660) 123-45.67')).toBe('436601234567')
    expect(toWaPhone('+43 660-123 45 67')).toBe('436601234567')
  })

  it('lässt bereits normalisierte Nummern unverändert', () => {
    expect(toWaPhone('436601234567')).toBe('436601234567')
  })
})
