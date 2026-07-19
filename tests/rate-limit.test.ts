import { describe, it, expect } from 'vitest'
import {
  createRateLimiter,
  getClientIp,
  CHECKOUT_RESERVE_MAX_PER_WINDOW,
  RATE_LIMIT_WINDOW_MS,
} from '@/lib/rate-limit'

describe('createRateLimiter', () => {
  it('erlaubt Aufrufe unter dem Limit', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000 })
    const t0 = 1_000_000
    expect(limiter.check('ip-a', t0)).toBe(true)
    expect(limiter.check('ip-a', t0 + 10)).toBe(true)
    expect(limiter.check('ip-a', t0 + 20)).toBe(true)
  })

  it('blockiert Aufrufe über dem Limit', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000 })
    const t0 = 1_000_000
    limiter.check('ip-a', t0)
    limiter.check('ip-a', t0 + 10)
    limiter.check('ip-a', t0 + 20)
    expect(limiter.check('ip-a', t0 + 30)).toBe(false)
    expect(limiter.check('ip-a', t0 + 40)).toBe(false)
  })

  it('gibt nach Ablauf des Fensters wieder frei', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 })
    const t0 = 1_000_000
    limiter.check('ip-a', t0)
    limiter.check('ip-a', t0 + 10)
    expect(limiter.check('ip-a', t0 + 20)).toBe(false)
    // Fenster abgelaufen: die alten Treffer fallen heraus
    expect(limiter.check('ip-a', t0 + 60_001)).toBe(true)
  })

  it('zählt geblockte Aufrufe nicht mit (Fenster verlängert sich nicht selbst)', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 })
    const t0 = 1_000_000
    limiter.check('ip-a', t0)
    // Dauerfeuer während der Sperre darf die Freigabe nicht hinauszögern
    limiter.check('ip-a', t0 + 30_000)
    limiter.check('ip-a', t0 + 59_000)
    expect(limiter.check('ip-a', t0 + 60_001)).toBe(true)
  })

  it('führt Schlüssel unabhängig voneinander', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 })
    const t0 = 1_000_000
    expect(limiter.check('ip-a', t0)).toBe(true)
    expect(limiter.check('ip-a', t0 + 1)).toBe(false)
    expect(limiter.check('ip-b', t0 + 2)).toBe(true)
  })

  it('nutzt ohne Optionen die benannten Konstanten', () => {
    const limiter = createRateLimiter()
    const t0 = 1_000_000
    for (let i = 0; i < CHECKOUT_RESERVE_MAX_PER_WINDOW; i++) {
      expect(limiter.check('ip-a', t0 + i)).toBe(true)
    }
    expect(limiter.check('ip-a', t0 + CHECKOUT_RESERVE_MAX_PER_WINDOW)).toBe(false)
    expect(limiter.check('ip-a', t0 + RATE_LIMIT_WINDOW_MS + 1)).toBe(true)
  })
})

describe('getClientIp', () => {
  it('nimmt den ERSTEN Eintrag aus x-forwarded-for (Client vor Proxies)', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' })
    expect(getClientIp(headers)).toBe('203.0.113.7')
  })

  it('trimmt Leerzeichen im x-forwarded-for-Eintrag', () => {
    const headers = new Headers({ 'x-forwarded-for': '  203.0.113.7 , 10.0.0.1' })
    expect(getClientIp(headers)).toBe('203.0.113.7')
  })

  it('fällt auf x-real-ip zurück, wenn x-forwarded-for fehlt', () => {
    const headers = new Headers({ 'x-real-ip': '198.51.100.4' })
    expect(getClientIp(headers)).toBe('198.51.100.4')
  })

  it("liefert 'unknown', wenn keine IP-Header vorhanden sind", () => {
    expect(getClientIp(new Headers())).toBe('unknown')
  })

  it('ignoriert einen leeren x-forwarded-for-Header', () => {
    const headers = new Headers({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.4' })
    expect(getClientIp(headers)).toBe('198.51.100.4')
  })
})
