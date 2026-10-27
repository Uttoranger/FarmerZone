/**
 * Der Vorschau-Link der Startseite (Register N16, Nr. 96; seit Nr. 182 über die
 * eigene dynamische Route /startseite-vorschau) — src/server/startseite-vorschau.ts
 * mit gemockter Sitzung und Datenbank, dazu die Seite selbst.
 *
 * Beweist:
 *  - Signatur, Zweck und Ablauf: gültig bis knapp unter einer Stunde,
 *    abgelaufen ab genau einer Stunde, ein veränderter Inhalt oder eine fremde
 *    Signatur ist ungültig (nie „abgelaufen").
 *  - Die Vorschau-Seite bekommt den Entwurf mit gültigem Link UND
 *    Admin-Sitzung — OHNE Draft Mode (Nr. 182: Vercel gibt einer statischen
 *    Route keine Query weiter, darum die eigene Route). Ohne Sitzung, mit
 *    fremder (Hof-)Sitzung, mit abgelaufenem, fremd signiertem oder unsinnigem
 *    Link: null. Bei ungültiger Signatur wird die Sitzung gar nicht gelesen.
 *  - Die Seite zeigt ohne gültige Vorschau keinen Inhalt der Startseite und
 *    leitet nicht um, sondern sagt, was zu tun ist (Link auf Admin › Startseite).
 *  - Die Signatur steht im Parameter `sig`, den die Sentry-Hygiene nach dem
 *    Namen entfernt; der Inhalt trägt kein Geheimnis.
 *  - Seit Nr. 99 trägt der signierte Inhalt die Quelle (Entwurf, Live oder eine
 *    Fassung): Eine andere Quelle ändert die Signatur, eine unbekannte ist
 *    ungültig.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { adminSitzung } from './admin-sitzung'

// draftMode ist eine Attrappe, die nie „an" ist: Die Vorschau darf ihn nicht brauchen.
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
  draftMode: vi.fn(async () => ({ isEnabled: false, enable: vi.fn() })),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
// Seit Nr. 188 prüft die Vorschau über die echte Admin-Wache (Passkey der Sitzung, Recht „Startseite“) — Sitzung aus tests/admin-sitzung.ts.
vi.mock('@/lib/prisma', async () => ({ prisma: { user: { findUnique: vi.fn() }, session: { deleteMany: vi.fn() }, ...(await import('./admin-sitzung')).passkeyAttrappen() } }))
// Für die Seite: Shell und Inhalt als Marken, die Zeilen als Attrappe.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children?: ReactNode }) => createElement('div', { 'data-shell': 'kunde' }, children),
}))
vi.mock('@/components/startseite/startseiten-inhalt', () => ({
  STARTSEITE_TITEL: 'Titel der Startseite',
  StartseitenInhalt: ({ band }: { band?: { quelle: string } }) =>
    createElement('div', { 'data-inhalt': 'startseite', 'data-quelle': band?.quelle ?? 'keine' }),
}))
vi.mock('@/server/queries/startseite', () => ({ ladeVorschauZeilen: vi.fn(async () => []) }))

import { draftMode, headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bereinigeEreignis } from '@/lib/sentry-hygiene'
import {
  VORSCHAU_GUELTIG_MS,
  erzeugeVorschauAbfrage,
  pruefeVorschau,
  leseStartseitenVorschau,
} from '@/server/startseite-vorschau'
import { ladeVorschauZeilen } from '@/server/queries/startseite'
import VorschauSeite, { dynamic, metadata } from '@/app/startseite-vorschau/page'
import { ADMIN_STARTSEITE_HREF, STARTSEITE_VORSCHAU_HREF, STARTSEITE_VORSCHAU_UNGUELTIG } from '@/lib/startseite-gestalten'
import type { VorschauQuelle } from '@/schemas/startseite'
import { createHmac } from 'crypto'

const AUSGESTELLT = new Date('2026-10-15T10:00:00Z')
const DATUM = new Date('2027-03-27T09:00:00Z')

function parameterAus(pfad: string): Record<string, string> {
  return Object.fromEntries(new URL(pfad, 'http://localhost').searchParams)
}

/** Der Pfad der Vorschau-Seite mit Link — wie ihn die Action baut (`${STARTSEITE_VORSCHAU_HREF}?${abfrage}`). */
function erzeugeVorschauPfad(inhalt: Parameters<typeof erzeugeVorschauAbfrage>[0], jetzt: Date): string {
  return `${STARTSEITE_VORSCHAU_HREF}?${erzeugeVorschauAbfrage(inhalt, jetzt)}`
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

describe('leseStartseitenVorschau — die Lese-Funktion der Vorschau-Seite (Nr. 182)', () => {
  const JETZT = new Date(AUSGESTELLT.getTime() + 60_000)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.api.getSession).mockResolvedValue(adminSitzung('admin-1') as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true, adminInhaber: true } as never)
  })

  it('liefert mit gültigem Link und Admin-Sitzung den Inhalt — ohne Draft Mode', async () => {
    expect(await leseStartseitenVorschau(link(), JETZT)).toEqual({ datum: DATUM, blockEntwurfId: 'block-1', quelle: 'entwurf' })
    expect(draftMode).not.toHaveBeenCalled()
    // Die Sitzung kommt aus den Headern dieser Anfrage, frisch geprüft.
    expect(headers).toHaveBeenCalledTimes(1)
    // Das Recht genau einmal frisch aus der Datenbank (dazu liest die Wache `adminSeit` für die Passkey-Pflicht).
    expect(vi.mocked(prisma.user.findUnique).mock.calls.filter(([frage]) => frage?.select && 'adminRechte' in frage.select)).toHaveLength(1)
  })

  it('gibt mit Admin-Sitzung ohne Passkey oder ohne das Recht „Startseite veröffentlichen“ null (Nr. 188, Audit A2/B1)', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'admin-1' }, session: { id: 's', createdAt: new Date(), passkeyAm: null } } as never)
    expect(await leseStartseitenVorschau(link(), JETZT)).toBeNull()
    vi.mocked(auth.api.getSession).mockResolvedValue(adminSitzung('admin-1') as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true, adminInhaber: false, adminRechte: ['geld'] } as never)
    expect(await leseStartseitenVorschau(link(), JETZT)).toBeNull()
    // Gegenprobe: mit dem Recht wieder der Inhalt.
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true, adminInhaber: false, adminRechte: ['startseite_veroeffentlichen'] } as never)
    expect(await leseStartseitenVorschau(link(), JETZT)).not.toBeNull()
  })

  it('gibt ohne Sitzung null', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    expect(await leseStartseitenVorschau(link(), JETZT)).toBeNull()
  })

  it('gibt mit Hof-Sitzung (kein Admin) null', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'hof-1', role: 'FARMER' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: false } as never)
    expect(await leseStartseitenVorschau(link(), JETZT)).toBeNull()
  })

  it('gibt mit abgelaufenem, fremd signiertem oder unsinnigem Link null — und liest die Sitzung gar nicht erst', async () => {
    const spaet = new Date(AUSGESTELLT.getTime() + VORSCHAU_GUELTIG_MS)
    expect(await leseStartseitenVorschau(link(), spaet)).toBeNull()
    expect(await leseStartseitenVorschau({ ...link(), sig: 'c'.repeat(64) }, JETZT)).toBeNull()
    expect(await leseStartseitenVorschau({ vorschau: '<script>', sig: 'x' }, JETZT)).toBeNull()
    expect(await leseStartseitenVorschau({ vorschau: ['a', 'b'], sig: undefined }, JETZT)).toBeNull()
    expect(await leseStartseitenVorschau({}, JETZT)).toBeNull()
    expect(headers).not.toHaveBeenCalled()
    expect(auth.api.getSession).not.toHaveBeenCalled()
  })
})

describe('Seite /startseite-vorschau (Nr. 182)', () => {
  const JETZT = new Date(AUSGESTELLT.getTime() + 60_000)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(JETZT)
    vi.mocked(auth.api.getSession).mockResolvedValue(adminSitzung('admin-1') as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true, adminInhaber: true } as never)
    return () => vi.useRealTimers()
  })

  async function seite(parameter: Record<string, string | string[] | undefined>): Promise<string> {
    return renderToStaticMarkup(await VorschauSeite({ searchParams: Promise.resolve(parameter) }))
  }

  it('ist dynamisch, nie im Index, mit der Startseite als Canonical', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.alternates).toEqual({ canonical: '/' })
    expect(metadata.title).toBe('Titel der Startseite')
  })

  it('zeigt mit gültigem Link und Admin-Sitzung die Quelle aus dem Link — mit Band', async () => {
    const html = await seite(link('block-1', 'live'))
    expect(html).toContain('data-inhalt="startseite"')
    expect(html).toContain('data-quelle="live"')
    expect(ladeVorschauZeilen).toHaveBeenCalledWith({ datum: DATUM, blockEntwurfId: 'block-1', quelle: 'live' })
    expect(html).not.toContain(STARTSEITE_VORSCHAU_UNGUELTIG)
  })

  it('zeigt ohne Admin-Sitzung, abgelaufen oder ungültig keinen Inhalt, sondern den Fehlerzustand mit Weg zurück', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as never)
    const faelle = [link(), { ...link(), sig: 'c'.repeat(64) }, {}]
    for (const parameter of faelle) {
      const html = await seite(parameter)
      expect(html).not.toContain('data-inhalt')
      expect(html).toContain(STARTSEITE_VORSCHAU_UNGUELTIG)
      expect(html).toContain(`href="${ADMIN_STARTSEITE_HREF}"`)
    }
    vi.setSystemTime(new Date(AUSGESTELLT.getTime() + VORSCHAU_GUELTIG_MS))
    expect(await seite(link())).toContain(STARTSEITE_VORSCHAU_UNGUELTIG)
    expect(ladeVorschauZeilen).not.toHaveBeenCalled()
  })
})
