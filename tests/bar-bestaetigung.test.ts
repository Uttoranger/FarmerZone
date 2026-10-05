/**
 * Bar-Bestätigung (H3): Was die Seite /{hof}/bestaetigen/{token} zeigt und ob
 * der Knopf bestätigen darf — reine Regel aus src/lib/bar-bestaetigung.ts,
 * dazu das Schema des Tokens aus der Adresse. Ohne Mock, `jetzt` als Parameter.
 */
import { describe, it, expect } from 'vitest'
import { barBestaetigungsAnsicht, GRUND_KUNDIN_STORNIERT, type BarBestellung } from '@/lib/bar-bestaetigung'
import { GRUND_NICHT_BESTAETIGT, fristVon } from '@/lib/fristen'
import { barBestaetigungsTokenSchema } from '@/schemas/bar-bestaetigung'

const MINUTE = 60 * 1000

/** Eine Barbestellung, am 02.10.2026 um 10:00 Wiener Zeit bestellt, Abholung am Tag darauf. */
function bestellung(teil: Partial<BarBestellung> = {}): BarBestellung {
  return {
    status: 'PENDING_CONFIRMATION',
    paymentMethod: 'ONSITE_CASH',
    cancelReason: null,
    createdAt: new Date('2026-10-02T08:00:00Z'),
    pickupDate: new Date('2026-10-03T12:00:00Z'),
    pickupTimeStart: '15:00',
    ...teil,
  }
}

describe('barBestaetigungsAnsicht — offen nur innerhalb der Frist', () => {
  it('innerhalb der Frist: offen — der Knopf darf bestätigen', () => {
    const b = bestellung()
    expect(barBestaetigungsAnsicht(b, new Date(b.createdAt.getTime() + 30 * MINUTE))).toBe('offen')
  })

  it('eine Millisekunde vor der Frist: noch offen', () => {
    const b = bestellung()
    expect(barBestaetigungsAnsicht(b, new Date(fristVon(b).getTime() - 1))).toBe('offen')
  })

  it('genau an der Frist: verfallen — auch wenn sie noch niemand storniert hat (Frist gilt beim Lesen)', () => {
    const b = bestellung()
    expect(barBestaetigungsAnsicht(b, fristVon(b))).toBe('verfallen')
  })

  it('der Bestellschluss (Beginn des Abholfensters) schneidet die zwei Stunden ab', () => {
    // Bestellt 13:30 Wiener Zeit, Abholung heute ab 14:00 — Frist 14:00, nicht 15:30.
    const b = bestellung({
      createdAt: new Date('2026-10-02T11:30:00Z'),
      pickupDate: new Date('2026-10-02T12:00:00Z'),
      pickupTimeStart: '14:00',
    })
    expect(barBestaetigungsAnsicht(b, new Date('2026-10-02T11:59:00Z'))).toBe('offen')
    expect(barBestaetigungsAnsicht(b, new Date('2026-10-02T12:00:00Z'))).toBe('verfallen')
  })
})

describe('barBestaetigungsAnsicht — alles andere bestätigt nie', () => {
  const jetzt = new Date('2026-10-02T08:30:00Z')

  it('ohne Bestellung zum Token: ungültig', () => {
    expect(barBestaetigungsAnsicht(null, jetzt)).toBe('ungueltig')
  })

  it('eine Online-Bestellung bestätigt man nie per Link: ungültig', () => {
    expect(barBestaetigungsAnsicht(bestellung({ paymentMethod: 'ONLINE' }), jetzt)).toBe('ungueltig')
  })

  it('Karte bei Abholung läuft wie bar', () => {
    expect(barBestaetigungsAnsicht(bestellung({ paymentMethod: 'ONSITE_CARD' }), jetzt)).toBe('offen')
  })

  it('wegen der Frist storniert: verfallen', () => {
    const b = bestellung({ status: 'CANCELLED', cancelReason: GRUND_NICHT_BESTAETIGT })
    expect(barBestaetigungsAnsicht(b, jetzt)).toBe('verfallen')
  })

  it('von der Kundin oder vom Hof storniert: storniert', () => {
    expect(barBestaetigungsAnsicht(bestellung({ status: 'CANCELLED', cancelReason: GRUND_KUNDIN_STORNIERT }), jetzt)).toBe(
      'storniert'
    )
    expect(barBestaetigungsAnsicht(bestellung({ status: 'CANCELLED', cancelReason: 'Hof hat abgesagt' }), jetzt)).toBe(
      'storniert'
    )
  })

  it('schon bestätigt, gepackt oder abgeholt: erledigt — nie ein zweites Mal bestätigen', () => {
    for (const status of ['CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP'] as const) {
      expect(barBestaetigungsAnsicht(bestellung({ status }), jetzt), status).toBe('erledigt')
    }
  })
})

describe('barBestaetigungsTokenSchema — der Token aus der Adresse', () => {
  it('nimmt einen Token, wie der Checkout ihn erzeugt (nanoid, 32 Zeichen)', () => {
    expect(barBestaetigungsTokenSchema.safeParse('V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k').success).toBe(true)
  })

  it('lehnt alles ab, was kein Token sein kann — ohne Datenbankabfrage', () => {
    for (const falsch of ['', 'kurz', 'a/b/c/d/e/f/g/h', '../../etc/passwd', 'x'.repeat(65), 'token mit leerzeichen']) {
      expect(barBestaetigungsTokenSchema.safeParse(falsch).success, falsch).toBe(false)
    }
  })

  it('lehnt Nicht-Text ab (Formulardaten können fehlen oder eine Datei sein)', () => {
    expect(barBestaetigungsTokenSchema.safeParse(null).success).toBe(false)
    expect(barBestaetigungsTokenSchema.safeParse(undefined).success).toBe(false)
    expect(barBestaetigungsTokenSchema.safeParse(['V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k']).success).toBe(false)
  })
})
