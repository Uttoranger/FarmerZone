/**
 * Die Bestätigungsseite der Zustellung (Register N14, Nr. 95):
 * /admin/postfach/zustellung/bestaetigen — ein Route Handler OHNE Anmeldung
 * (er hängt unter keinem Layout, also nicht hinter verlangeAdminSeite).
 *
 * Beweist: GET liest nur und zeigt den Knopf (Link-Scanner bestätigen nichts),
 * der Token steht im Formular, nicht in der Ziel-Adresse; ein kaputter,
 * abgelaufener oder benutzter Link zeigt einen Satz ohne Knopf; POST löst
 * genau mit dem Token aus dem Körper ein. Kein Referrer, kein Suchindex, kein
 * Cache. Datenbank und Action gemockt — das Einlösen selbst prüft
 * tests/integration/postfach-eingang.int.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/queries/postfach', () => ({ ladeEmpfaengerBestaetigung: vi.fn() }))
vi.mock('@/server/actions/postfach', () => ({ bestaetigeEmpfaenger: vi.fn() }))

import { GET, POST } from '@/app/admin/postfach/zustellung/bestaetigen/route'
import { ladeEmpfaengerBestaetigung } from '@/server/queries/postfach'
import { bestaetigeEmpfaenger } from '@/server/actions/postfach'
import { BESTAETIGEN_TEXT } from '@/lib/zustellung'

const TOKEN = 'Ab-_'.repeat(10) + 'xyz'
const ADRESSE = 'http://localhost:3000/admin/postfach/zustellung/bestaetigen'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET — nur lesen, Knopf zeigen', () => {
  it('offener Link: Seite mit Knopf, Token nur im Formular, ohne Referrer, Index und Cache', async () => {
    vi.mocked(ladeEmpfaengerBestaetigung).mockResolvedValue({ zustand: 'offen' })
    const antwort = await GET(new NextRequest(`${ADRESSE}?token=${TOKEN}`))
    const html = await antwort.text()
    expect(antwort.status).toBe(200)
    expect(html).toContain(BESTAETIGEN_TEXT.titel)
    expect(html).toContain('<form method="post" action="/admin/postfach/zustellung/bestaetigen">')
    expect(html).toContain(`name="token" value="${TOKEN}"`)
    expect(antwort.headers.get('referrer-policy')).toBe('no-referrer')
    expect(antwort.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(antwort.headers.get('cache-control')).toBe('no-store')
    expect(bestaetigeEmpfaenger).not.toHaveBeenCalled()
  })

  it('kaputter Token: „gilt nicht", ohne Knopf und ohne Datenbank', async () => {
    const antwort = await GET(new NextRequest(`${ADRESSE}?token=%3Cscript%3E`))
    const html = await antwort.text()
    expect(html).toContain(BESTAETIGEN_TEXT.ungueltigTitel)
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<script>')
    expect(ladeEmpfaengerBestaetigung).not.toHaveBeenCalled()
  })

  it('abgelaufener Link: der Satz mit Ausweg, ohne Knopf', async () => {
    vi.mocked(ladeEmpfaengerBestaetigung).mockResolvedValue({ zustand: 'abgelaufen' })
    const html = await (await GET(new NextRequest(`${ADRESSE}?token=${TOKEN}`))).text()
    expect(html).toContain(BESTAETIGEN_TEXT.abgelaufenTitel)
    expect(html).not.toContain('<form')
  })
})

describe('POST — einlösen per Knopf', () => {
  function formular(token: string): NextRequest {
    return new NextRequest(ADRESSE, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    })
  }

  it('löst mit dem Token aus dem Körper ein und dankt', async () => {
    vi.mocked(bestaetigeEmpfaenger).mockResolvedValue({ ok: true })
    const html = await (await POST(formular(TOKEN))).text()
    expect(bestaetigeEmpfaenger).toHaveBeenCalledWith(TOKEN)
    expect(html).toContain(BESTAETIGEN_TEXT.dankeTitel)
  })

  it('schon benutzt oder abgelaufen: der passende Satz', async () => {
    vi.mocked(bestaetigeEmpfaenger).mockResolvedValue({ error: 'ungueltig' })
    expect(await (await POST(formular(TOKEN))).text()).toContain(BESTAETIGEN_TEXT.ungueltigTitel)
    vi.mocked(bestaetigeEmpfaenger).mockResolvedValue({ error: 'abgelaufen' })
    expect(await (await POST(formular(TOKEN))).text()).toContain(BESTAETIGEN_TEXT.abgelaufenTitel)
  })
})
