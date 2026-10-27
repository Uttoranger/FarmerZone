/**
 * Admin › Finanzen im Seitenmuster (Register N15, Nr. 94) — Geld wird nur
 * angezeigt, neu gerechnet wird nichts. Beweist:
 *  - Die Kennzahl „Grundgebühren“ steht nur in der Startphase (vor TARIFE_AB)
 *    mit 0 € und der Zahl der Gründungshöfe; danach gibt es sie nicht, weil
 *    es keine Zahl gibt, die die Seite zeigen dürfte (keine neue Rechnung).
 *  - Der Reiter kommt aus der Adresse: unbekannt oder fehlend ist „Monat“.
 *  - Die Adressen der Reiter und der Monatspfeile tragen Monat und Reiter.
 *  - Die Seite selbst heißt seit Nr. 191 „Geld“: /admin/finanzen leitet mit
 *    308 weiter (die Seite prüft tests/admin-geld-seite.test.ts).
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch'))
    return createElement('a', { href, ...attribute }, children)
  },
  // Der Ladepunkt (Nr. 105/121) fragt den Zustand des Links — beim Rendern auf dem Server lädt nichts.
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/finanzen',
  permanentRedirect: (ziel: string) => {
    throw new Error(`WEITER:${ziel}`)
  },
}))
vi.mock('@/server/admin-wache', () => ({ verlangeAdminSeite: vi.fn(async () => 'admin_1'), verlangeFrischeBestaetigung: vi.fn(async () => ({ ok: true, userId: 'admin_1', sitzungId: 'sitzung-admin_1' })), frischOderBestaetigen: vi.fn(async () => null), adminPflichtOffen: vi.fn(async () => false) }))
vi.mock('@/server/actions/finanzen', () => ({
  kostenpostenAnlegen: vi.fn(),
  kostenpostenAendern: vi.fn(),
  kostenpostenBeenden: vi.fn(),
  kostenpostenLoeschen: vi.fn(),
}))
const abfragen = vi.hoisted(() => ({
  getFinanzen: vi.fn(),
  ladeHoefeFuerGruendung: vi.fn(),
}))
vi.mock('@/server/queries/finanzen', () => ({
  getFinanzen: abfragen.getFinanzen,
  aktuellerFinanzMonat: () => '2026-10',
}))
vi.mock('@/server/queries/admin', () => ({ ladeHoefeFuerGruendung: abfragen.ladeHoefeFuerGruendung }))

import AdminFinanzenPage from '@/app/admin/finanzen/page'
import { FINANZEN_REITER_IDS, FINANZEN_REITER_OHNE_INHALT, finanzenAdresse, grundgebuehrenKachel } from '@/lib/admin-finanzen-seite'
import { TARIFE_AB, TARIF_ZEILE } from '@/lib/konditionen'
import { finanzenReiterAus } from '@/schemas/admin-reiter'
import { formatEuro } from '@/lib/format'

const VOR_TARIFEN = new Date('2026-10-15T10:00:00+02:00')

describe('Kennzahl „Grundgebühren“', () => {
  it('in der Startphase: 0 € und die Zahl der Gründungshöfe', () => {
    const kachel = grundgebuehrenKachel(VOR_TARIFEN, 7)
    expect(kachel).toEqual({ wert: formatEuro(0), satz: `${TARIF_ZEILE.startphase.titel} · 7 Gründungshöfe` })
  })

  it('ein einziger Gründungshof steht in der Einzahl', () => {
    expect(grundgebuehrenKachel(VOR_TARIFEN, 1)?.satz).toBe(`${TARIF_ZEILE.startphase.titel} · 1 Gründungshof`)
  })

  it('Gegenprobe: am Stichtag der Tarife und danach gibt es die Kachel nicht — dort läge eine Rechnung, die diese Seite nicht macht', () => {
    expect(grundgebuehrenKachel(TARIFE_AB, 7)).toBeNull()
    expect(grundgebuehrenKachel(new Date(TARIFE_AB.getTime() - 1), 7)).not.toBeNull()
  })
})

describe('Reiter-Zustand aus der Adresse', () => {
  it('ein bekannter Reiter wird gelesen', () => {
    for (const id of FINANZEN_REITER_IDS) expect(finanzenReiterAus(id)).toBe(id)
  })

  it('Gegenprobe: unbekannt, fehlend oder doppelt ist „Monat“ — nie ein Fehler', () => {
    expect(finanzenReiterAus('unsinn')).toBe('monat')
    expect(finanzenReiterAus(undefined)).toBe('monat')
    expect(finanzenReiterAus('')).toBe('monat')
    expect(finanzenReiterAus(['kosten', 'monat'] as unknown as string)).toBe('monat')
  })

  it('die Adressen: Monat immer, Reiter nur wenn er nicht der Standard ist', () => {
    expect(finanzenAdresse({ monat: '2026-09', reiter: 'monat' })).toBe('/admin/finanzen?monat=2026-09')
    expect(finanzenAdresse({ monat: '2026-09', reiter: 'kosten' })).toBe('/admin/finanzen?monat=2026-09&reiter=kosten')
  })
})

describe('/admin/finanzen heißt Geld (Nr. 191, N32)', () => {
  it('308 auf /admin/geld mit denselben Parametern — erst nach der Wache mit dem Recht „Geld“', async () => {
    const { verlangeAdminSeite } = await import('@/server/admin-wache')
    await expect(AdminFinanzenPage({ searchParams: Promise.resolve({ monat: '2026-09', zeitraum: 'jahr', jahr: '2025' }) })).rejects.toThrow(
      'WEITER:/admin/geld?monat=2026-09&zeitraum=jahr&jahr=2025'
    )
    expect(verlangeAdminSeite).toHaveBeenCalledWith({ recht: 'geld' })
    await expect(AdminFinanzenPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('WEITER:/admin/geld')
  })
})
