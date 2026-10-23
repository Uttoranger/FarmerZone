import { describe, expect, it } from 'vitest'
import { berechneMailabstandBeginn, mailVersandMeldung } from '@/lib/beitrag-mailabstand'
import { formatZahl } from '@/lib/format'

describe('berechneMailabstandBeginn', () => {
  it('zählt sieben mal 24 Stunden zurück, auch über die Zeitumstellung — nicht sieben Wiener Kalendertage', () => {
    // 28.10.2026, 12:00 Uhr in Wien (MEZ); sieben Tage davor galt noch Sommerzeit (bis 25.10.).
    const jetzt = new Date('2026-10-28T11:00:00.000Z')

    const beginn = berechneMailabstandBeginn(jetzt)

    // 168 Stunden zurück ist der 21.10. um 13:00 Uhr Wiener Zeit, nicht 12:00 Uhr.
    expect(beginn.toISOString()).toBe('2026-10-21T11:00:00.000Z')
  })
})

describe('mailVersandMeldung (Nr. 149)', () => {
  it('sagt „wird verschickt“ — die Mails gehen erst nach der Antwort hinaus', () => {
    expect(mailVersandMeldung(1)).toBe('wird an 1 Abo verschickt')
    expect(mailVersandMeldung(1200)).toBe(`wird an ${formatZahl(1200)} Abos verschickt`)
    expect(mailVersandMeldung(2)).not.toContain('versendet')
  })
})
