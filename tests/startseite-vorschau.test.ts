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
 *  - Seit Nr. 99 trägt der signierte Inhalt die Quelle (Entwurf, Live oder eine
 *    Fassung): Eine andere Quelle ändert die Signatur, eine unbekannte ist
 *    ungültig.
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
  erzeugeVorschauAbfrage,
  pruefeVorschau,
  vorschauDieserAnfrage,
} from '@/server/startseite-vorschau'
import { GET as oeffneVorschauRoute } from '@/app/admin/startseite/vorschau/route'
import type { VorschauQuelle } from '@/schemas/startseite'
import { createHmac } from 'crypto'

const AUSGESTELLT = new Date('2026-10-15T10:00:00Z')
const DATUM = new Date('2027-03-27T09:00:00Z')

function parameterAus(pfad: string): Record<string, string> {
  return Object.fromEntries(new URL(pfad, 'http://localhost').searchParams)
}

/** Der Pfad der Startseite mit Vorschau-Link — wie ihn die Action baut (`/?${abfrage}`). */
function erzeugeVorschauPfad(inhalt: Parameters<typeof erzeugeVorschauAbfrage>[0], jetzt: Date): string {
  return `/?${erzeugeVorschauAbfrage(inhalt, jetzt)}`
}

function link(blockEntwurfId: string | null = 'block-1', quelle: VorschauQuelle = 'entwurf'): Record<string, string> {
  return parameterAus(erzeugeVorschauPfad({ datum: DATUM, blockEntwurfId, quelle }, AUSGESTELLT))
}

describe('pruefeVorschau', () => {
  it('gilt mit Datum und Block bis knapp unter einer Stunde', () => {
    const { vorschau, sig } = link()
    const kurzVorher = new Date(AUSGESTELLT.getTime() + VORSCHAU_GUELTIG_MS - 1)
    expect(pruefeVorschau(vorschau, sig, kurzVorher)).toEqual({ ok: true, datum: DATUM, blockEntwurfId: 'block-1', quelle: 'entwurf' })
    const ohneBlock = link(null)
    expect(pruefeVorschau(ohneBlock.vorschau, ohneBlock.sig, AUSGESTELLT)).toEqual({ ok: true, datum: DATUM, blockEntwurfId: null, quelle: 'entwurf' })
  })

  it('ist ab genau einer Stunde abgelaufen', () => {
    const { vorschau, sig } = link()
    expect(pruefeVorschau(vorschau, sig, new Date(AUSGESTELLT.getTime() + VORSCHAU_GUELTIG_MS))).toEqual({ ok: false, grund: 'abgelaufen' })
  })

  it('ist mit verändertem Inhalt oder fremder Signatur ungültig — nie „abgelaufen"', () => {
    const { vorschau, sig } = link()
    const anderesDatum = parameterAus(erzeugeVorschauPfad({ datum: new Date('2030-01-01T00:00:00Z'), blockEntwurfId: 'block-1', quelle: 'entwurf' }, AUSGESTELLT))
    expect(pruefeVorschau(anderesDatum.vorschau, sig, AUSGESTELLT)).toEqual({ ok: false, grund: 'ungueltig' })
    expect(pruefeVorschau(vorschau, 'a'.repeat(64), AUSGESTELLT)).toEqual({ ok: false, grund: 'ungueltig' })
    const spaet = new Date(AUSGESTELLT.getTime() + 2 * VORSCHAU_GUELTIG_MS)
    expect(pruefeVorschau(vorschau, 'b'.repeat(64), spaet)).toEqual({ ok: false, grund: 'ungueltig' })
  })

  it('trägt kein Geheimnis im Inhalt und die Signatur nur im Parameter sig', () => {
    const pfad = erzeugeVorschauPfad({ datum: DATUM, blockEntwurfId: 'block-1', quelle: 'fassung:f1' }, AUSGESTELLT)
    const { vorschau, sig } = parameterAus(pfad)
    expect(Buffer.from(vorschau, 'base64url').toString()).toBe(`startseite-vorschau:${AUSGESTELLT.getTime()}:${DATUM.getTime()}:block-1:fassung:f1`)
    expect(sig).toMatch(/^[a-f0-9]{64}$/)
    // Die Sentry-Hygiene nimmt `sig` aus der Adresse einer Anfrage — die Signatur reist nie mit.
    const ereignis = bereinigeEreignis({ request: { url: `https://hof.example${pfad}` } } as never) as { request?: { url?: string } } | null
    expect(ereignis?.request?.url).toBeDefined()
    expect(ereignis?.request?.url).not.toContain(sig)
  })
})

describe('Quelle im signierten Inhalt (Nr. 99)', () => {
  it('liest Entwurf, Live und eine Fassung zurück', () => {
    for (const quelle of ['entwurf', 'live', 'fassung:cm1abc'] as const) {
      const { vorschau, sig } = link('block-1', quelle)
      expect(pruefeVorschau(vorschau, sig, AUSGESTELLT)).toMatchObject({ ok: true, quelle })
    }
  })

  it('macht aus dem Entwurf mit fremder Signatur nie Live — eine andere Quelle braucht eine eigene Signatur', () => {
    const entwurf = link('block-1', 'entwurf')
    const live = link('block-1', 'live')
    expect(live.sig).not.toBe(entwurf.sig)
    expect(pruefeVorschau(live.vorschau, entwurf.sig, AUSGESTELLT)).toEqual({ ok: false, grund: 'ungueltig' })
  })

  it('weist eine unbekannte Quelle ab, auch richtig signiert', () => {
    const roh = `startseite-vorschau:${AUSGESTELLT.getTime()}:${DATUM.getTime()}::alles`
    const sig = createHmac('sha256', process.env.BETTER_AUTH_SECRET ?? '').update(roh).digest('hex')
    expect(pruefeVorschau(Buffer.from(roh).toString('base64url'), sig, AUSGESTELLT)).toEqual({ ok: false, grund: 'ungueltig' })
    // Gegenprobe: derselbe Weg mit bekannter Quelle gilt — die Signatur oben ist also richtig gebaut.
    const gut = `${roh.slice(0, -'alles'.length)}live`
    const gutSig = createHmac('sha256', process.env.BETTER_AUTH_SECRET ?? '').update(gut).digest('hex')
    expect(pruefeVorschau(Buffer.from(gut).toString('base64url'), gutSig, AUSGESTELLT)).toMatchObject({ ok: true, quelle: 'live' })
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
    expect(await vorschauDieserAnfrage(Promise.resolve(link()), JETZT)).toEqual({ datum: DATUM, blockEntwurfId: 'block-1', quelle: 'entwurf' })
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
