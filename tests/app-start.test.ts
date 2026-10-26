/**
 * Der App-Start /app (Register N31, Nr. 172): Die installierte App startet hier,
 * die Route leitet nach der Sitzung weiter.
 *
 * Beweist (Sitzung und Admin-Abfrage gemockt):
 *  - Hof (Rolle FARMER) → /dashboard, auch wenn das Konto zusätzlich Admin ist.
 *  - Admin ohne Hof → /admin.
 *  - Kundin, ohne Sitzung und eine Sitzung ohne Nutzer → / (Gegenprobe: nie /dashboard oder /admin).
 *  - Immer 307, nie zwischengespeichert, nie im Suchindex.
 *  - Die Admin-Abfrage läuft nur, wenn sie gebraucht wird (kein Hof, aber eine Sitzung).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getSession, istAdmin } = vi.hoisted(() => ({ getSession: vi.fn(), istAdmin: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('@/server/queries/admin', () => ({ isAdminUser: istAdmin }))

import { GET } from '@/app/app/route'

async function ziel(): Promise<{ status: number; ort: string; antwort: Response }> {
  const antwort = await GET(new NextRequest('http://localhost:3000/app'))
  return { status: antwort.status, ort: new URL(antwort.headers.get('location') ?? '', 'http://localhost:3000').pathname, antwort }
}

beforeEach(() => {
  vi.clearAllMocks()
  istAdmin.mockResolvedValue(false)
})

describe('GET /app', () => {
  it('Hof geht ins Dashboard — auch als Admin mit Hof', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'FARMER' } })
    istAdmin.mockResolvedValue(true)
    expect((await ziel()).ort).toBe('/dashboard')
    expect(istAdmin).not.toHaveBeenCalled()
  })

  it('Admin ohne Hof geht nach /admin', async () => {
    getSession.mockResolvedValue({ user: { id: 'u2', role: 'CUSTOMER' } })
    istAdmin.mockResolvedValue(true)
    expect((await ziel()).ort).toBe('/admin')
  })

  it('Kundin geht auf die Startseite — nie ins Dashboard oder nach /admin (Gegenprobe)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u3', role: 'CUSTOMER' } })
    const { ort } = await ziel()
    expect(ort).toBe('/')
    expect(ort).not.toBe('/dashboard')
    expect(ort).not.toBe('/admin')
  })

  it('ohne Sitzung geht es auf die Startseite, ohne die Datenbank zu fragen', async () => {
    getSession.mockResolvedValue(null)
    expect((await ziel()).ort).toBe('/')
    getSession.mockResolvedValue({})
    expect((await ziel()).ort).toBe('/')
    expect(istAdmin).not.toHaveBeenCalled()
  })

  it('307, kein Cache, noindex', async () => {
    getSession.mockResolvedValue(null)
    const { status, antwort } = await ziel()
    expect(status).toBe(307)
    expect(antwort.headers.get('cache-control')).toContain('no-store')
    expect(antwort.headers.get('x-robots-tag')).toContain('noindex')
  })
})
