/**
 * Rücksprung nach der Hof-Anmeldung (Nr. 156, Seitenkarte P7 und P9).
 *
 * Beweist:
 *  - Das Ziel ist nur ein Pfad des Hofbereichs (FARMER_PATHS), ohne Query und
 *    Anker; fremde Rechner, /admin, Punkt-Segmente und „/ordersx" führen ins
 *    Dashboard. /teilen und /verify bleiben wie bisher.
 *  - Der Proxy schickt Abgemeldete auf /login?von=<pfad> und setzt den Kopf
 *    x-hof-pfad selbst — ein mitgeschickter Wert wird überschrieben.
 *  - Die Wache `verlangeHofDerSitzung`: ohne Sitzung oder nicht FARMER →
 *    /login?von=<geprüfter Pfad>, ohne Hof → /onboarding.
 *  - /login leitet einen schon angemeldeten Hof zu seinem Ziel.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const kopf = { wert: new Headers() }

vi.mock('next/headers', () => ({ headers: vi.fn(async () => kopf.wert) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/server/queries/admin', () => ({ isAdminUser: vi.fn(async () => false) }))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({ KundeShellMitSitzung: () => null }))
vi.mock('@/components/anmelden/anmelden-seite', () => ({ AnmeldenSeite: () => null }))

import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { hofAnmeldeAdresse, zielNachHofAnmeldung } from '@/lib/anmeldecode'
import { FARMER_PATHS, istHofPfad } from '@/lib/hof-pfade'
import { proxy } from '@/proxy'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import LoginPage from '@/app/(auth)/login/page'

const getSession = vi.mocked(auth.api.getSession)
const farmForUser = vi.mocked(getFarmForUser)

async function umleitung(lauf: () => Promise<unknown>): Promise<string | null> {
  try {
    await lauf()
    return null
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : ''
    if (text.startsWith('REDIRECT:')) return text.slice('REDIRECT:'.length)
    throw fehler
  }
}

beforeEach(() => {
  kopf.wert = new Headers()
  getSession.mockReset()
  farmForUser.mockReset()
})

describe('zielNachHofAnmeldung — nur Pfade des Hofbereichs', () => {
  it('führt zur Bestellung zurück, von der die Anmeldung kam', () => {
    expect(zielNachHofAnmeldung('/orders/abc')).toBe('/orders/abc')
    expect(zielNachHofAnmeldung('/orders')).toBe('/orders')
    expect(zielNachHofAnmeldung('/settings/pickup-slots')).toBe('/settings/pickup-slots')
  })

  it('nimmt keinen Query-Teil und keinen Anker mit', () => {
    expect(zielNachHofAnmeldung('/orders?x=1')).toBe('/orders')
    expect(zielNachHofAnmeldung('/orders/abc#oben')).toBe('/orders/abc')
  })

  it('alles andere führt ins Dashboard', () => {
    for (const von of [
      null,
      '',
      '//fremd.example',
      'https://fremd.example/orders',
      '/admin',
      '/orders/../admin',
      '/orders/%2e%2e/admin',
      '/ordersx',
      '/orders/%41',
      '/api/reserve',
      '/\\fremd.example',
      '/onboarding',
    ]) {
      expect(zielNachHofAnmeldung(von), String(von)).toBe('/dashboard')
    }
  })

  it('jeder Eintrag der Liste ist ein Ziel', () => {
    for (const pfad of FARMER_PATHS) expect(zielNachHofAnmeldung(pfad)).toBe(pfad)
    expect(istHofPfad('/ordersx')).toBe(false)
    expect(istHofPfad('/orders/abc')).toBe(true)
  })
})

describe('hofAnmeldeAdresse', () => {
  it('trägt den geprüften Pfad als von, sonst /login ohne Ziel', () => {
    expect(hofAnmeldeAdresse('/orders/abc')).toBe('/login?von=/orders/abc')
    expect(hofAnmeldeAdresse('/orders?x=1')).toBe('/login?von=/orders')
    expect(hofAnmeldeAdresse(null)).toBe('/login')
    expect(hofAnmeldeAdresse('/admin')).toBe('/login')
    expect(hofAnmeldeAdresse('//fremd.example')).toBe('/login')
  })
})

describe('src/proxy.ts', () => {
  it('ohne Cookie: /orders/abc → /login?von=/orders/abc', async () => {
    const antwort = await proxy(new NextRequest('https://hof.example/orders/abc'))
    expect(antwort.status).toBe(307)
    const ziel = new URL(antwort.headers.get('location') ?? '')
    expect(`${ziel.pathname}${ziel.search}`).toBe('/login?von=/orders/abc')
  })

  it('ohne Cookie: der Query-Teil geht nicht mit', async () => {
    const antwort = await proxy(new NextRequest('https://hof.example/orders?filter=offen'))
    const ziel = new URL(antwort.headers.get('location') ?? '')
    expect(`${ziel.pathname}${ziel.search}`).toBe('/login?von=/orders')
  })

  it('mit Cookie: setzt x-hof-pfad selbst und überschreibt einen mitgeschickten Wert', async () => {
    const anfrage = new NextRequest('https://hof.example/orders/abc', {
      headers: { cookie: 'better-auth.session_token=erfunden', 'x-hof-pfad': '//fremd.example' },
    })
    const antwort = await proxy(anfrage)
    expect(antwort.headers.get('location')).toBeNull()
    expect(antwort.headers.get('x-middleware-request-x-hof-pfad')).toBe('/orders/abc')
  })

  it('ein Pfad außerhalb des Hofbereichs bleibt unberührt (Gegenprobe)', async () => {
    const antwort = await proxy(new NextRequest('https://hof.example/hoefe', { headers: { 'x-hof-pfad': '/orders' } }))
    expect(antwort.headers.get('location')).toBeNull()
    expect(antwort.headers.get('x-middleware-request-x-hof-pfad')).toBeNull()
  })
})

describe('verlangeHofDerSitzung', () => {
  it('abgelaufene Sitzung: das Ziel bleibt erhalten', async () => {
    kopf.wert = new Headers({ 'x-hof-pfad': '/orders/abc' })
    getSession.mockResolvedValue(null as never)
    expect(await umleitung(verlangeHofDerSitzung)).toBe('/login?von=/orders/abc')
  })

  it('ein ungeprüfter Kopf kommt nie in die Adresse', async () => {
    kopf.wert = new Headers({ 'x-hof-pfad': '//fremd.example' })
    getSession.mockResolvedValue(null as never)
    expect(await umleitung(verlangeHofDerSitzung)).toBe('/login')
  })

  it('angemeldet, aber nicht FARMER → Anmeldung', async () => {
    kopf.wert = new Headers({ 'x-hof-pfad': '/sales' })
    getSession.mockResolvedValue({ user: { id: 'nutzerin-1', role: 'CUSTOMER' } } as never)
    expect(await umleitung(verlangeHofDerSitzung)).toBe('/login?von=/sales')
    expect(farmForUser).not.toHaveBeenCalled()
  })

  it('FARMER ohne Hof → /onboarding', async () => {
    getSession.mockResolvedValue({ user: { id: 'nutzerin-1', role: 'FARMER' } } as never)
    farmForUser.mockResolvedValue(null)
    expect(await umleitung(verlangeHofDerSitzung)).toBe('/onboarding')
  })

  it('FARMER mit Hof → userId und farmId', async () => {
    getSession.mockResolvedValue({ user: { id: 'nutzerin-1', role: 'FARMER' } } as never)
    farmForUser.mockResolvedValue({ id: 'hof-1', name: 'Testhof', slug: 'testhof', logoUrl: null, logoAusschnitt: null, adminGesperrtAm: null, adminSperrGrund: null, agbFassung: null, email: 'kontakt@testhof.example' })
    expect(await verlangeHofDerSitzung()).toEqual({ userId: 'nutzerin-1', farmId: 'hof-1' })
  })
})

describe('/login für einen schon angemeldeten Hof', () => {
  const seite = (von?: string) => LoginPage({ searchParams: Promise.resolve(von === undefined ? {} : { von }) })

  it('führt zum geprüften Ziel', async () => {
    getSession.mockResolvedValue({ user: { id: 'nutzerin-1', role: 'FARMER' } } as never)
    expect(await umleitung(() => seite('/orders/abc'))).toBe('/orders/abc')
    expect(await umleitung(() => seite())).toBe('/dashboard')
    expect(await umleitung(() => seite('/admin'))).toBe('/dashboard')
  })

  it('ohne Sitzung bleibt das Formular (Gegenprobe)', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await umleitung(() => seite('/orders/abc'))).toBeNull()
  })
})
