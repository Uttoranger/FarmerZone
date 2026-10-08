/**
 * Die lokale Diagnose-Route /api/test-email (nur NODE_ENV=development) und die
 * Post-Sperre (Register Z3, Nr. 43): Eine gesperrte Mail ist nicht verschickt
 * — die Antwort darf dann nicht „ok" sagen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/email', () => ({ sendRaw: vi.fn() }))

import { GET } from '@/app/api/test-email/route'
import { sendRaw } from '@/lib/email'

const anfrage = (): NextRequest => new NextRequest('http://localhost:3000/api/test-email?to=kundin@example.org')

beforeEach(() => {
  vi.mocked(sendRaw).mockReset()
  vi.stubEnv('NODE_ENV', 'development')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('/api/test-email', () => {
  it('meldet eine gesperrte Mail als nicht verschickt', async () => {
    vi.mocked(sendRaw).mockResolvedValue({ gesperrt: true })

    const antwort = await GET(anfrage())

    expect(await antwort.json()).toEqual({
      ok: false,
      to: 'kundin@example.org',
      error: 'Nicht verschickt: Die Adresse steht nicht in TEST_EMPFAENGER.',
    })
  })

  it('Gegenprobe: eine verschickte Mail ist ok', async () => {
    vi.mocked(sendRaw).mockResolvedValue({ id: 'email_1' })

    const antwort = await GET(anfrage())

    expect(await antwort.json()).toEqual({ ok: true, to: 'kundin@example.org', error: null })
  })

  it('Gegenprobe: ein Versandfehler bleibt ein Fehler', async () => {
    vi.mocked(sendRaw).mockResolvedValue({ error: 'RESEND_API_KEY nicht gesetzt' })

    const antwort = await GET(anfrage())

    expect(await antwort.json()).toEqual({ ok: false, to: 'kundin@example.org', error: 'RESEND_API_KEY nicht gesetzt' })
  })
})
