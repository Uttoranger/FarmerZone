/**
 * Admin › Finanzen im Seitenmuster (Register N15, Nr. 94) — Geld wird nur
 * angezeigt, neu gerechnet wird nichts. Beweist:
 *  - Die Kennzahl „Grundgebühren“ steht nur in der Startphase (vor TARIFE_AB)
 *    mit 0 € und der Zahl der Gründungshöfe; danach gibt es sie nicht, weil
 *    es keine Zahl gibt, die die Seite zeigen dürfte (keine neue Rechnung).
 *  - Der Reiter kommt aus der Adresse: unbekannt oder fehlend ist „Monat“.
 *  - Die Adressen der Reiter und der Monatspfeile tragen Monat und Reiter.
 *  - Die Seite selbst, gerendert mit gemockten Abfragen: Kennzahlen mit den
 *    Beträgen von heute, vier Unterreiter, im Standard der Verlauf; die Kosten
 *    stehen im Reiter „Kosten“; eine Ansicht ohne Zahlen sagt das ehrlich.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch'))
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/finanzen',
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
import type { FinanzenDaten } from '@/server/queries/finanzen'

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

function daten(ueber: Partial<FinanzenDaten> = {}): FinanzenDaten {
  return {
    monat: '2026-09',
    bezeichnung: 'September 2026',
    vorigerMonat: '2026-08',
    naechsterMonat: '2026-10',
    einnahmen: { eingezogenCents: 7240, geschuldetCents: 6120, erwartetCents: 500, provisionCents: 0, bestellungen: 40, offeneBestellungen: 2, gezaehltCents: 13360 },
    kosten: { cents: 13650, anzahl: 5 },
    posten: [{ id: 'p1', name: 'Hosting Beispiel', kategorie: 'HOSTING', betragCents: 2500, rhythmus: 'MONATLICH', ab: '2026-01', bis: null, notiz: null, imMonatCents: 2500 }],
    verlauf: [{ monat: '2026-09', kurz: 'Sep 26', einnahmenCents: 13360, kostenCents: 13650 }],
    schnittCents: 334,
    brauchtBestellungen: 41,
    testzahlungenHinweis: null,
    ...ueber,
  }
}

async function seite(suche: { monat?: string; reiter?: string } = {}, jetzt: Date = VOR_TARIFEN): Promise<string> {
  vi.useFakeTimers({ now: jetzt, toFake: ['Date'] })
  try {
    const element = await AdminFinanzenPage({ searchParams: Promise.resolve(suche) })
    return renderToStaticMarkup(element)
  } finally {
    vi.useRealTimers()
  }
}

describe('die Seite', () => {
  abfragen.getFinanzen.mockResolvedValue(daten())
  abfragen.ladeHoefeFuerGruendung.mockResolvedValue(
    Array.from({ length: 7 }, (_, i) => ({ id: `h${i}`, ownerId: `u${i}`, approvedAt: new Date(`2026-09-0${i + 1}T09:00:00+02:00`), createdAt: new Date('2026-08-01T09:00:00+02:00'), archivedAt: null, gruendungBis: null }))
  )

  it('Seitenkopf mit Monat, Kennzahlen mit den Beträgen von heute und Grundgebühren in der Startphase', async () => {
    const html = await seite()
    expect(html).toMatch(/<h1[^>]*>Finanzen<\/h1>/)
    expect(html).toContain('September 2026')
    expect(html).toContain('aria-label="Monat wählen"')
    for (const betrag of [7240, 6120, 13650]) expect(html).toContain(formatEuro(betrag / 100))
    expect(html).toContain('Grundgebühren')
    expect(html).toContain(`${TARIF_ZEILE.startphase.titel} · 7 Gründungshöfe`)
    expect(html).toContain('trägt sich')
  })

  it('Gegenprobe: nach dem Stichtag der Tarife keine Kachel „Grundgebühren“', async () => {
    const html = await seite({}, new Date(TARIFE_AB.getTime() + 86_400_000))
    expect(html).not.toContain('Grundgebühren')
    expect(html).toContain('Ergebnis')
  })

  it('Ergebnis: nicht gedeckt orange (tun), gedeckt grün (läuft) — kein Rot; die anderen Kacheln ohne Ton', async () => {
    const tagMitWert = (html: string, wert: string): string => {
      const stelle = html.indexOf(`>${wert}</dd>`)
      expect(stelle, wert).toBeGreaterThan(-1)
      return html.slice(html.lastIndexOf('<dd', stelle), stelle)
    }
    const minus = await seite()
    expect(tagMitWert(minus, formatEuro(-2.9))).toContain('text-zustand-tun')
    expect(minus).toContain('noch nicht gedeckt')
    // Gegenprobe: Mit mehr Einnahmen als Kosten trägt es sich — „+ € …“ in Grün.
    abfragen.getFinanzen.mockResolvedValueOnce(daten({ einnahmen: { ...daten().einnahmen, gezaehltCents: 20000 } }))
    const plus = await seite()
    expect(tagMitWert(plus, `+ ${formatEuro(63.5)}`)).toContain('text-zustand-laeuft')
    expect(plus).toContain('trägt sich')
    expect(tagMitWert(plus, formatEuro(136.5))).not.toContain('text-zustand')
  })

  it('scheitert nur die Zahl der Gründungshöfe, fehlt nur die Kachel „Grundgebühren“ — das Geld der Seite bleibt', async () => {
    abfragen.ladeHoefeFuerGruendung.mockRejectedValueOnce(new Error('Datenbank nicht erreichbar'))
    const html = await seite()
    expect(html).not.toContain('Grundgebühren')
    expect(html).toContain(formatEuro(72.4))
    expect(html).toContain('Wann trägt sich die Plattform?')
  })

  it('Gegenprobe: scheitert die Finanzabfrage, steht der Ladefehler da — mit „Noch einmal versuchen“', async () => {
    abfragen.getFinanzen.mockRejectedValueOnce(new Error('Datenbank nicht erreichbar'))
    const html = await seite()
    expect(html).toContain('Wir konnten die Finanzen gerade nicht laden.')
    expect(html).toContain('Noch einmal versuchen')
    expect(html).not.toContain('Finanzen in Zahlen')
  })

  it('vier Unterreiter als Links, im Standard „Monat“ aktiv', async () => {
    const html = await seite()
    const nav = html.slice(html.indexOf('<nav aria-label="Ansicht der Finanzen"'), html.indexOf('</nav>', html.indexOf('<nav aria-label="Ansicht der Finanzen"')))
    expect([...nav.matchAll(/<a href="([^"]+)"[^>]*>/g)].map((t) => t[1])).toEqual([
      '/admin/finanzen?monat=2026-09',
      '/admin/finanzen?monat=2026-09&amp;reiter=kosten',
      '/admin/finanzen?monat=2026-09&amp;reiter=auszahlungen',
      '/admin/finanzen?monat=2026-09&amp;reiter=entfallen',
    ])
    expect(nav.match(/aria-current="page"/g)).toHaveLength(1)
    expect(nav).toMatch(/href="\/admin\/finanzen\?monat=2026-09"[^>]*aria-current="page"/)
    for (const wort of ['Monat', 'Kosten', 'Auszahlungen', 'Entfallene Gebühren']) expect(nav).toContain(wort)
  })

  it('Monat: der Verlauf mit seinem Satz; die Kosten stehen nicht daneben, sondern im eigenen Reiter', async () => {
    const html = await seite()
    expect(html).toContain('Wann trägt sich die Plattform?')
    expect(html).toContain('Einnahmen im Einzelnen')
    expect(html).not.toContain('Kosten der Plattform')
  })

  it('Kosten: die Liste der Posten, der Verlauf nicht', async () => {
    const html = await seite({ reiter: 'kosten' })
    expect(html).toContain('Kosten der Plattform')
    expect(html).toContain('Hosting Beispiel')
    expect(html).not.toContain('Wann trägt sich die Plattform?')
    expect(html).toMatch(/href="\/admin\/finanzen\?monat=2026-09&amp;reiter=kosten"[^>]*aria-current="page"/)
  })

  it('ein unbekannter Reiter zeigt den Monat', async () => {
    const html = await seite({ reiter: 'unsinn' })
    expect(html).toContain('Wann trägt sich die Plattform?')
  })

  it('die Monatspfeile behalten den Reiter', async () => {
    const html = await seite({ reiter: 'kosten' })
    expect(html).toContain('href="/admin/finanzen?monat=2026-08&amp;reiter=kosten"')
  })

  it('Auszahlungen und Entfallene Gebühren: es gibt dafür keine Zahlen, und die Seite erfindet keine', async () => {
    for (const reiter of ['auszahlungen', 'entfallen']) {
      const html = await seite({ reiter })
      expect(html, reiter).toContain(FINANZEN_REITER_OHNE_INHALT)
      expect(html, reiter).not.toContain('Wann trägt sich die Plattform?')
      expect(html, reiter).not.toContain('Kosten der Plattform')
    }
  })

  it('die Regel-Zeile steht unter jedem Reiter', async () => {
    for (const reiter of FINANZEN_REITER_IDS) expect(await seite({ reiter })).toContain('keine Buchhaltung')
  })
})
