/**
 * Tests für die signierten Links (src/lib/reorder-token.ts, src/lib/unsubscribe.ts).
 *
 * Beweist am ECHTEN Code: gültige Signaturen werden akzeptiert, manipulierte
 * abgelehnt; Reorder-Tokens älter als 180 Tage sind ungültig, Unsubscribe-Tokens
 * bleiben unabhängig vom Alter gültig (Abmeldelinks müssen dauerhaft wirken).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { generateReorderToken, verifyReorderToken } from '@/lib/reorder-token'
import { generateUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/unsubscribe'

const TAG_MS = 24 * 60 * 60 * 1000

afterEach(() => {
  vi.useRealTimers()
})

describe('Reorder-Token', () => {
  it('akzeptiert eine gültige Signatur und liefert die Nutzdaten zurück', () => {
    const token = generateReorderToken('order-1', 'farm-1')
    expect(verifyReorderToken(token)).toEqual({ orderId: 'order-1', farmId: 'farm-1' })
  })

  it('lehnt eine manipulierte Signatur ab', () => {
    const token = generateReorderToken('order-1', 'farm-1')
    const [payload, hmac] = token.split('.')
    const gedreht = hmac.slice(0, -1) + (hmac.at(-1) === 'a' ? 'b' : 'a')
    expect(verifyReorderToken(`${payload}.${gedreht}`)).toBeNull()
  })

  it('lehnt manipulierte Nutzdaten ab (fremde Bestell-ID untergeschoben)', () => {
    const token = generateReorderToken('order-1', 'farm-1')
    const hmac = token.slice(token.lastIndexOf('.') + 1)
    const fremd = Buffer.from(`order-fremd:farm-1:${Date.now()}`).toString('base64url')
    expect(verifyReorderToken(`${fremd}.${hmac}`)).toBeNull()
  })

  it('lehnt Müll und leere Eingaben ab', () => {
    expect(verifyReorderToken('')).toBeNull()
    expect(verifyReorderToken('kein-punkt')).toBeNull()
    expect(verifyReorderToken('a.b')).toBeNull()
  })

  it('akzeptiert ein Token kurz vor der 180-Tage-Grenze', () => {
    const token = generateReorderToken('order-1', 'farm-1')
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.now() + 179 * TAG_MS))
    expect(verifyReorderToken(token)).toEqual({ orderId: 'order-1', farmId: 'farm-1' })
  })

  it('lehnt ein Token älter als 180 Tage ab', () => {
    const token = generateReorderToken('order-1', 'farm-1')
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.now() + 181 * TAG_MS))
    expect(verifyReorderToken(token)).toBeNull()
  })
})

describe('Unsubscribe-Token', () => {
  it('akzeptiert eine gültige Signatur und normalisiert die Adresse', () => {
    const token = generateUnsubscribeToken('Kunde@Example.com', 'farm-1')
    expect(verifyUnsubscribeToken(token)).toEqual({
      email: 'kunde@example.com',
      farmId: 'farm-1',
    })
  })

  it('lehnt eine manipulierte Signatur ab', () => {
    const token = generateUnsubscribeToken('kunde@example.com', 'farm-1')
    const [payload, hmac] = token.split('.')
    const gedreht = hmac.slice(0, -1) + (hmac.at(-1) === 'a' ? 'b' : 'a')
    expect(verifyUnsubscribeToken(`${payload}.${gedreht}`)).toBeNull()
  })

  it('lehnt eine untergeschobene fremde Adresse ab', () => {
    const token = generateUnsubscribeToken('kunde@example.com', 'farm-1')
    const hmac = token.slice(token.lastIndexOf('.') + 1)
    const fremd = Buffer.from('fremd@example.com:farm-1').toString('base64url')
    expect(verifyUnsubscribeToken(`${fremd}.${hmac}`)).toBeNull()
  })

  it('bleibt auch nach Jahren gültig — Abmeldelinks laufen bewusst nicht ab', () => {
    const token = generateUnsubscribeToken('kunde@example.com', 'farm-1')
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.now() + 5 * 365 * TAG_MS))
    expect(verifyUnsubscribeToken(token)).toEqual({
      email: 'kunde@example.com',
      farmId: 'farm-1',
    })
  })
})
