/**
 * Was die Bestätigungsseite über eine Bestellung sagt (src/lib/bestaetigung.ts)
 * — nur aus dem Datenbankstand; Stripes redirect_status ist höchstens ein Hinweis.
 */
import { describe, it, expect } from 'vitest'
import { bestaetigungsZustand } from '@/lib/bestaetigung'
import { GRUND_NICHT_BESTAETIGT, GRUND_ZAHLUNG_VERFALLEN } from '@/lib/fristen'

type Bestellung = Parameters<typeof bestaetigungsZustand>[0]

const online = (teil: Partial<Bestellung> = {}): Bestellung => ({
  paymentMethod: 'ONLINE',
  paymentStatus: 'PENDING',
  status: 'PENDING_CONFIRMATION',
  cancelReason: null,
  ...teil,
})
const vorOrt = (teil: Partial<Bestellung> = {}): Bestellung => ({ ...online(), paymentMethod: 'ONSITE_CASH', ...teil })

describe('Online-Zahlung', () => {
  it('„bezahlt" nur, wenn die Datenbank PAID sagt', () => {
    expect(bestaetigungsZustand(online({ paymentStatus: 'PAID', status: 'PAID' }), undefined)).toBe('bezahlt')
    expect(bestaetigungsZustand(online(), 'succeeded')).not.toBe('bezahlt')
  })

  it('redirect_status=succeeded vor dem Webhook: „Zahlung wird geprüft"', () => {
    expect(bestaetigungsZustand(online(), 'succeeded')).toBe('zahlung-wird-geprueft')
    expect(bestaetigungsZustand(online(), 'processing')).toBe('zahlung-wird-geprueft')
  })

  it('fehlgeschlagen aus Datenbank oder Rückmeldung — beides nur ein Angebot zum neuen Versuch', () => {
    expect(bestaetigungsZustand(online({ paymentStatus: 'FAILED' }), undefined)).toBe('zahlung-fehlgeschlagen')
    expect(bestaetigungsZustand(online(), 'failed')).toBe('zahlung-fehlgeschlagen')
  })

  it('storniert: kein Hinweis aus der Adresse ändert etwas', () => {
    const storniert = online({ status: 'CANCELLED', cancelReason: GRUND_ZAHLUNG_VERFALLEN })
    expect(bestaetigungsZustand(storniert, 'succeeded')).toBeNull()
    expect(bestaetigungsZustand(storniert, 'failed')).toBeNull()
  })

  it('ohne Hinweis und ohne Zahlung: nichts', () => {
    expect(bestaetigungsZustand(online(), undefined)).toBeNull()
  })
})

describe('Zahlung vor Ort', () => {
  it('wartet auf die Bestätigung per E-Mail', () => {
    expect(bestaetigungsZustand(vorOrt(), undefined)).toBe('bestaetigung-offen')
  })

  it.each(['CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP'] as const)('%s zählt als bestätigt', (status) => {
    expect(bestaetigungsZustand(vorOrt({ status }), undefined)).toBe('bestaetigt')
  })

  it('nicht rechtzeitig bestätigt: verfallen; anders storniert oder nicht abgeholt: nichts', () => {
    expect(bestaetigungsZustand(vorOrt({ status: 'CANCELLED', cancelReason: GRUND_NICHT_BESTAETIGT }), undefined)).toBe(
      'verfallen'
    )
    expect(bestaetigungsZustand(vorOrt({ status: 'CANCELLED', cancelReason: 'Vom Hof storniert' }), undefined)).toBeNull()
    expect(bestaetigungsZustand(vorOrt({ status: 'NOT_PICKED_UP' }), undefined)).toBeNull()
  })

  it('ein redirect_status spielt bei Zahlung vor Ort keine Rolle', () => {
    expect(bestaetigungsZustand(vorOrt(), 'succeeded')).toBe('bestaetigung-offen')
  })
})
