/**
 * Der Vorschau-Link der Startseite (Register N16, Nr. 96) —
 * src/server/startseite-vorschau.ts mit gemockter Sitzung, Datenbank und
 * Draft Mode.
 *
 * Beweist:
 *  - Signatur, Zweck und Ablauf: gültig bis knapp unter einer Stunde,
 *    abgelaufen ab genau einer Stunde, ein veränderter Inhalt oder eine fremde
 *    Signatur ist ungültig (nie „abgelaufen").
 *  - Die Seite bekommt eine Vorschau nur im Draft Mode, mit gültigem Link UND
 *    Admin-Sitzung — ohne Sitzung, mit fremder (Hof-)Sitzung, mit
 *    abgelaufenem Link: null, also die normale Startseite.
 *  - Ohne Draft Mode liest die Funktion weder die Parameter noch die Sitzung —
 *    der Weg jedes Besuchs bleibt statisch.
 *  - Die Signatur steht im Parameter `sig`, den die Sentry-Hygiene nach dem
 *    Namen entfernt; der Inhalt trägt kein Geheimnis.
 *  - „Vorschau öffnen" wirkt auf jedem Gerät mit Admin-Sitzung (Runde 2): Die
 *    Route /admin/startseite/vorschau schaltet dort den Draft Mode ein und
 *    leitet mit demselben Link auf die Startseite; ohne Admin-Sitzung, mit
 *    abgelaufenem oder falschem Link kein Draft Mode, normale Startseite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const draft = vi.hoisted(() => ({ an: false, enable: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
  draftMode: vi.fn(async () => ({ isEnabled: draft.an, enable: draft.enable })),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn() } } }))

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bereinigeEreignis } from '@/lib/sentry-hygiene'
import {
  VORSCHAU_GUELTIG_MS,
  erzeugeVorschauPfad,
  pruefeVorschau,
  vorschauDieserAnfrage,
} from '@/server/startseite-vorschau'
import { GET as oeffneVorschauRoute } from '@/app/admin/startseite/vorschau/route'

const AUSGESTELLT = new Date('2026-10-15T10:00:00Z')
const DATUM = new Date('2027-03-27T09:00:00Z')

function parameterAus(pfad: string): Record<string, string> {
  return Object.fromEntries(new URL(pfad, 'http://localhost').searchParams)
}

function link(blockEntwurfId: string | null = 'block-1'): Record<string, string> {
  return parameterAus(erzeugeVorschauPfad({ datum: DATUM, blockEntwurfId }, AUSGESTELLT))
}

describe('pruefeVorschau', () => {
  it('gilt mit Datum und Block bis knapp unter einer Stunde', () => {
    const { vorschau, sig } = link()
    const kurzVorher = new Date(AUSGESTELLT.getTime() + VORSCHAU_GUELTIG_MS - 1)
    expect(pruefeVorschau(vorschau, sig, kurzVorher)).toEqual({ ok: true, datum: DATUM, blockEntwurfId: 'block-1' })
    const ohneBlock = link(null)
    expect(pruefeVorschau(ohneBlock.vorschau, ohneBlock.sig, AUSGESTELLT)).toEqual({ ok: true, datum: DATUM, blockEntwurfId: null })
  })

  it('ist ab genau einer Stunde abgelaufen', () => {
    const { vorschau, sig } = link()
    expect(pruefeVorschau(vorschau, sig, new Date(AUSGESTELLT.getTime() + VORSCHAU_GUELTIG_MS))).toEqual({ ok: false, grund: 'abgelaufen' })
  })

  it('ist mit verändertem Inhalt oder fremder Signatur ungültig — nie „abgelaufen"', () => {
    const { vorschau, sig } = link()
    const anderesDatum = parameterAus(erzeugeVorschauPfad({ datum: new Date('2030-01-01T00:00:00Z'), blockEntwurfId: 'block-1' }, AUSGESTELLT))
    expect(pruefeVorschau(anderesDatum.vorschau, sig, AUSGESTELLT)).toEqual({ ok: false, grund: 'ungueltig' })
    expect(pruefeVorschau(vorschau, 'a'.repeat(64), AUSGESTELLT)).toEqual({ ok: false, grund: 'ungueltig' })
    const spaet = new Date(AUSGESTELLT.getTime() + 2 * VORSCHAU_GUELTIG_MS)
    expect(pruefeVorschau(vorschau, 'b'.repeat(64), spaet)).toEqual({ ok: false, grund: 'ungueltig' })
  })

  it('trägt kein Geheimnis im Inhalt und die Signatur nur im Parameter sig', () => {
    const pfad = erzeugeVorschauPfad({ datum: DATUM, blockEntwurfId: 'block-1' }, AUSGESTELLT)
    const { vorschau, sig } = parameterAus(pfad)
    expect(Buffer.from(vorschau, 'base64url').toString()).toBe(`startseite-vorschau:${AUSGESTELLT.getTime()}:${DATUM.getTime()}:block-1`)
    expect(sig).toMatch(/^[a-f0-9]{64}$/)
    // Die Sentry-Hygiene nimmt `sig` aus der Adresse einer Anfrage — die Signatur reist nie mit.
    const ereignis = bereinigeEreignis({ request: { url: `https://hof.example${pfad}` } } as never) as { request?: { url?: string } } | null
    expect(ereignis?.request?.url).toBeDefined()
    expect(ereignis?.request?.url).not.toContain(sig)
  })
})

describe('vorschauDieserAnfrage', () => {
  const JETZT = new Date(AUSGESTELLT.getTime() + 60_000)

  beforeEach(() => {
    vi.clearAllMocks()
    draft.an = true
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true } as never)
  })

  it('zeigt die Vorschau mit Draft Mode, gültigem Link und Admin-Sitzung', async () => {
    expect(await vorschauDieserAnfrage(Promise.resolve(link()), JETZT)).toEqual({ datum: DATUM, blockEntwurfId: 'block-1' })
  })

  it('liest ohne Draft Mode weder die Adresse noch die Sitzung — die Seite bleibt statisch', async () => {
    draft.an = false
    const parameter = { then: vi.fn() } as unknown as Promise<Record<string, string>>
    expect(await vorschauDieserAnfrage(parameter, JETZT)).toBeNull()
    expect((parameter as unknown as { then: ReturnType<typeof vi.fn> }).then).not.toHaveBeenCalled()
    expect(headers).not.toHaveBeenCalled()
    expect(auth.api.getSession).not.toHaveBeenCalled()
  })

  it('gibt ohne Sitzung die normale Startseite', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    expect(await vorschauDieserAnfrage(Promise.resolve(link()), JETZT)).toBeNull()
  })

  it('gibt mit fremder Sitzung (kein Admin) die normale Startseite', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'hof-1', role: 'FARMER' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: false } as never)
    expect(await vorschauDieserAnfrage(Promise.resolve(link()), JETZT)).toBeNull()
  })

  it('gibt mit abgelaufenem oder falsch signiertem Link die normale Startseite — und fragt die Sitzung gar nicht erst', async () => {
    const spaet = new Date(AUSGESTELLT.getTime() + VORSCHAU_GUELTIG_MS)
    expect(await vorschauDieserAnfrage(Promise.resolve(link()), spaet)).toBeNull()
    expect(await vorschauDieserAnfrage(Promise.resolve({ ...link(), sig: 'c'.repeat(64) }), JETZT)).toBeNull()
    expect(await vorschauDieserAnfrage(Promise.resolve({ vorschau: '<script>', sig: 'x' }), JETZT)).toBeNull()
    expect(auth.api.getSession).not.toHaveBeenCalled()
  })
})

describe('Route /admin/startseite/vorschau — „Vorschau öffnen" auf jedem Gerät', () => {
  const JETZT = new Date(AUSGESTELLT.getTime() + 60_000)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(JETZT)
    // Ein anderes Gerät: Dort hat noch keine Action den Draft Mode eingeschaltet.
    draft.an = false
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function oeffne(parameter: Record<string, string>): Promise<Response> {
    return oeffneVorschauRoute(new NextRequest(`http://localhost/admin/startseite/vorschau?${new URLSearchParams(parameter)}`))
  }

  it('schaltet mit Admin-Sitzung den Draft Mode ein und leitet mit demselben Link auf die Startseite', async () => {
    const parameter = link()
    const antwort = await oeffne(parameter)
    expect(draft.enable).toHaveBeenCalledTimes(1)
    expect(antwort.status).toBe(303)
    expect(antwort.headers.get('location')).toBe(`http://localhost/?vorschau=${parameter.vorschau}&sig=${parameter.sig}`)
    expect(antwort.headers.get('cache-control')).toContain('no-store')
  })

  it('zeigt ohne Sitzung oder mit Hof-Sitzung die normale Startseite — ohne Draft Mode', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as never)
    expect((await oeffne(link())).headers.get('location')).toBe('http://localhost/')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: 'hof-1', role: 'FARMER' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isAdmin: false } as never)
    expect((await oeffne(link())).headers.get('location')).toBe('http://localhost/')
    expect(draft.enable).not.toHaveBeenCalled()
  })

  it('zeigt mit abgelaufenem, falsch signiertem oder unsinnigem Link die normale Startseite — ohne nach der Sitzung zu fragen', async () => {
    vi.setSystemTime(new Date(AUSGESTELLT.getTime() + VORSCHAU_GUELTIG_MS))
    expect((await oeffne(link())).headers.get('location')).toBe('http://localhost/')
    vi.setSystemTime(JETZT)
    expect((await oeffne({ ...link(), sig: 'c'.repeat(64) })).headers.get('location')).toBe('http://localhost/')
    expect((await oeffne({ vorschau: '<script>', sig: 'x' })).headers.get('location')).toBe('http://localhost/')
    expect(draft.enable).not.toHaveBeenCalled()
    expect(auth.api.getSession).not.toHaveBeenCalled()
  })
})
