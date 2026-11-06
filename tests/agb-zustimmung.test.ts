/**
 * Zustimmung der Höfe zu den AGB (Nr. 207, Auftrag Punkt 4) ohne Datenbank:
 * die Regel, die Karte, die Zeile der Akte und die Server Action (Prisma und
 * Sitzung gemockt). Den Zustand in der echten Datenbank (zweite Zustimmung
 * ändert nichts) prüft tests/integration/agb-zustimmung.int.test.ts.
 *
 * Beweist:
 *  - brauchtAgbZustimmung: ohne Zustimmung und nach einer neuen Fassung ja,
 *    bei der aktuellen nein;
 *  - die Akte zeigt Fassung und Zeitpunkt in Wiener Zeit, sonst „noch nicht
 *    zugestimmt“;
 *  - die Karte „AGB bestätigen“: Link zu /agb, Knopf „Ich stimme den AGB zu“,
 *    Hinweis, dass der Hof nutzbar bleibt (kein Lockout);
 *  - die Action: ohne Sitzung nichts; Zod; nur AGB_NEUESTE ('1.0', N45) —
 *    '0.9' wird abgelehnt; Besitz über ownerId der Sitzung; bedingt über
 *    agbFassung (null oder andere).
 *  - N45: '0.9' und null brauchen Zustimmung; vor dem Stichtag nennt die Karte
 *    den Tag, beide Fassungen (Links /agb/1.0 und /agb/0.9) und den Verzicht
 *    (Punkt 32.4); ab dem Stichtag die Sätze aus Nr. 207; ohne geladenen
 *    Stichtag der Satz ohne Datum (Gegenprobe: nie das Datum der Vorgabe).
 *  - kein Code setzt die Zustimmung außer der Action (keine Zustimmungsfiktion).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { updateMany: vi.fn() } } }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { AGB_ZUSTIMMUNG_TEXT, agbAkteText, agbKartenStichtag, brauchtAgbZustimmung } from '@/lib/agb-zustimmung'
import { AGB_NEUESTE } from '@/lib/rechtstexte/agb-fassung'
import { formatDatumLang } from '@/lib/format'
import { BAR_SERVICEGEBUEHR_AB } from '@/lib/konditionen'
import { stimmeAgbZu } from '@/server/actions/agb-zustimmung'
import { AgbZustimmenKarte } from '@/components/heute/agb-karte'

const db = vi.mocked(prisma, true)

beforeEach(() => {
  vi.clearAllMocks()
  db.farm.updateMany.mockResolvedValue({ count: 1 } as never)
})

describe('Regel und Akte', () => {
  it('ohne Zustimmung und nach einer neuen Fassung: ja; Gegenprobe: bei der aktuellen nein', () => {
    expect(brauchtAgbZustimmung({ agbFassung: null }, '0.9')).toBe(true)
    expect(brauchtAgbZustimmung({ agbFassung: '0.9' }, '1.0')).toBe(true)
    expect(brauchtAgbZustimmung({ agbFassung: '0.9' }, '0.9')).toBe(false)
  })

  it('N45: die neueste Fassung ist 1.0 — ein Hof mit 0.9 oder ohne Zustimmung braucht sie, mit 1.0 nicht', () => {
    expect(AGB_NEUESTE).toBe('1.0')
    expect(brauchtAgbZustimmung({ agbFassung: '0.9' })).toBe(true)
    expect(brauchtAgbZustimmung({ agbFassung: null })).toBe(true)
    expect(brauchtAgbZustimmung({ agbFassung: '1.0' })).toBe(false)
  })

  it('Akte: Fassung und Zeitpunkt in Wiener Zeit (Sommer und Winter); sonst „noch nicht zugestimmt“', () => {
    expect(agbAkteText({ agbFassung: '0.9', agbZugestimmtAm: new Date('2026-10-31T13:05:00Z') })).toBe('Fassung 0.9 · 31.10.2026, 14:05 Uhr')
    expect(agbAkteText({ agbFassung: '0.9', agbZugestimmtAm: new Date('2026-07-01T22:30:00Z') })).toBe('Fassung 0.9 · 02.07.2026, 00:30 Uhr')
    expect(agbAkteText({ agbFassung: null, agbZugestimmtAm: null })).toBe('noch nicht zugestimmt')
  })
})

const STICHTAG = new Date('2027-02-01T00:00:00+01:00')
const AB_T = agbKartenStichtag(STICHTAG, new Date('2027-02-02T10:00:00+01:00'))
const VOR_T = agbKartenStichtag(STICHTAG, new Date('2026-12-01T10:00:00+01:00'))
const OHNE = agbKartenStichtag(null, new Date('2027-02-02T10:00:00+01:00'))
const ohneTags = (html: string) => html.replace(/<[^>]*>/g, '')

describe('Karte „AGB bestätigen“ vor dem Stichtag (N45)', () => {
  it('nennt den Tag, beide Fassungen und den Verzicht; Links /agb/1.0 und /agb/0.9; der Knopf bleibt', () => {
    const html = renderToStaticMarkup(createElement(AgbZustimmenKarte, { fassung: '1.0', geaendert: true, stichtag: VOR_T }))
    const tag = formatDatumLang(STICHTAG)
    expect(ohneTags(html)).toContain(
      `Ab ${tag} gilt Fassung 1.0. Bitte lies sie und stimm ihr zu – bis dahin gilt für dich Fassung 0.9. Mit deiner Zustimmung gilt Fassung 1.0 für dich ab ${tag}, ohne weitere Ankündigungsfrist (Punkt 32.4).`
    )
    expect(html).toContain('href="/agb/1.0"')
    expect(html).toContain('>Fassung 1.0 lesen')
    expect(html).toContain('href="/agb/0.9"')
    expect(html).toContain('>Ich stimme den AGB zu</button>')
    // Gegenprobe: nicht der Satz nach dem Stichtag.
    expect(html).not.toContain('haben sich geändert')
  })

  it('Ladefehler: der Satz ohne Datum — nie das Datum der Vorgabe', () => {
    const html = ohneTags(renderToStaticMarkup(createElement(AgbZustimmenKarte, { fassung: '1.0', geaendert: true, stichtag: OHNE })))
    expect(html).toContain('Ab dem Stichtag auf /konditionen gilt Fassung 1.0.')
    expect(html).toContain('ab dem Stichtag, ohne weitere Ankündigungsfrist (Punkt 32.4).')
    expect(html).not.toContain(formatDatumLang(BAR_SERVICEGEBUEHR_AB))
    expect(formatDatumLang(BAR_SERVICEGEBUEHR_AB)).toMatch(/Februar 2027/)
  })

  it('agbKartenStichtag: erreicht genau ab dem Stichtag; ohne Stichtag nie erreicht', () => {
    expect(agbKartenStichtag(STICHTAG, STICHTAG).erreicht).toBe(true)
    expect(agbKartenStichtag(STICHTAG, new Date(STICHTAG.getTime() - 1)).erreicht).toBe(false)
    expect(OHNE).toEqual({ tag: null, erreicht: false })
  })
})

describe('Karte „AGB bestätigen“ ab dem Stichtag', () => {
  it('Link zu /agb, Knopf „Ich stimme den AGB zu“, Fassung im Satz, Hof bleibt nutzbar', () => {
    const html = renderToStaticMarkup(createElement(AgbZustimmenKarte, { fassung: '1.0', geaendert: false, stichtag: AB_T }))
    expect(html).toContain('AGB bestätigen')
    expect(html).toContain('href="/agb"')
    expect(html).toContain('>Ich stimme den AGB zu</button>')
    expect(html).toContain('Fassung 1.0')
    expect(html).not.toContain('href="/agb/0.9"')
    expect(html).toContain('wie gewohnt nutzbar')
    expect(html).toContain('data-ton="orange"')
  })

  it('nach einer neuen Fassung sagt die Karte, dass sich die AGB geändert haben — Gegenprobe zur ersten Zustimmung', () => {
    const neu = renderToStaticMarkup(createElement(AgbZustimmenKarte, { fassung: '1.0', geaendert: true, stichtag: AB_T }))
    expect(neu).toContain('Die AGB haben sich geändert (jetzt Fassung 1.0)')
    const erst = renderToStaticMarkup(createElement(AgbZustimmenKarte, { fassung: '1.0', geaendert: false, stichtag: AB_T }))
    expect(erst).not.toContain('haben sich geändert')
  })
})

describe('stimmeAgbZu', () => {
  const sitzung = () => vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'nutzerin-1' } } as never)

  it('ohne Sitzung: nichts geschrieben', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    expect(await stimmeAgbZu({ fassung: AGB_NEUESTE })).toEqual({ error: AGB_ZUSTIMMUNG_TEXT.abgemeldet })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })

  it('ungültige Eingabe oder veraltete Fassung: nichts geschrieben', async () => {
    sitzung()
    expect(await stimmeAgbZu({ fassung: 'x'.repeat(50) })).toEqual({ error: AGB_ZUSTIMMUNG_TEXT.fehler })
    expect(await stimmeAgbZu('0.9')).toEqual({ error: AGB_ZUSTIMMUNG_TEXT.fehler })
    expect(await stimmeAgbZu({ fassung: '0.1' })).toEqual({ error: AGB_ZUSTIMMUNG_TEXT.veraltet })
    // N45: Die Zustimmung zur alten Fassung 0.9 lehnt die Action ab.
    expect(await stimmeAgbZu({ fassung: '0.9' })).toEqual({ error: AGB_ZUSTIMMUNG_TEXT.veraltet })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })

  it('Gegenprobe: aktuelle Fassung → bedingtes updateMany am Hof der Sitzung mit Fassung und Zeitpunkt', async () => {
    sitzung()
    expect(await stimmeAgbZu({ fassung: AGB_NEUESTE })).toEqual({ ok: true })
    const aufruf = db.farm.updateMany.mock.calls[0]![0]
    expect(aufruf.where).toEqual({ ownerId: 'nutzerin-1', OR: [{ agbFassung: null }, { agbFassung: { not: AGB_NEUESTE } }] })
    expect(aufruf.data).toEqual({ agbFassung: '1.0', agbZugestimmtAm: expect.any(Date) })
  })

  it('Datenbank weg: der Satz für den Hof, kein Wurf', async () => {
    sitzung()
    db.farm.updateMany.mockRejectedValue(new Error('weg'))
    expect(await stimmeAgbZu({ fassung: AGB_NEUESTE })).toEqual({ error: AGB_ZUSTIMMUNG_TEXT.fehler })
  })
})

describe('keine Zustimmungsfiktion', () => {
  function* dateien(ordner: string): Generator<string> {
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) yield* dateien(pfad)
      else if (/\.(ts|tsx)$/.test(name)) yield pfad
    }
  }

  it('agbZugestimmtAm schreibt unter src/ nur die Action stimmeAgbZu', () => {
    const schreiber = [...dateien('src')].filter((p) => /agbZugestimmtAm:\s*new Date|agbZugestimmtAm:\s*jetzt/.test(readFileSync(p, 'utf8')))
    expect(schreiber).toEqual(['src/server/actions/agb-zustimmung.ts'])
  }, 30_000)

  it('Gegenprobe: das Muster schlägt an einer Schreibstelle an', () => {
    expect(/agbZugestimmtAm:\s*new Date/.test('data: { agbZugestimmtAm: new Date() }')).toBe(true)
  })
})
