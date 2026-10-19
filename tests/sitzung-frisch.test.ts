/**
 * Sitzung frisch aus der Datenbank (Register E7, Ergänzung; Nr. 114) — die
 * Konfiguration von Better Auth in src/lib/auth.ts.
 *
 * Beweist: Der Cookie-Cache ist aus. Mit ihm galt eine abgemeldete Sitzung bis
 * zu 5 Minuten weiter (Abmelden eines Geräts, „Das war ich nicht"). Dass eine
 * gelöschte Sitzung beim nächsten getSession wirklich weg ist, prüft
 * tests/integration/geraete.int.test.ts gegen die echte Datenbank.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

describe('Better Auth: Sitzung ohne Zwischenspeicher im Cookie', () => {
  it('cookieCache ist ausgeschaltet', async () => {
    const { auth } = await import('@/lib/auth')
    expect(auth.options.session?.cookieCache?.enabled).toBe(false)
  }, 30_000)
})
