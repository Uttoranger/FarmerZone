/**
 * Einstellungen nach den Boards November 2026 (Nr. 224, Lauf 30).
 *
 * Beweist:
 *  - „Bar bei Abholung“ auf /settings/payments: „Braucht Lastschrift“ mit
 *    „Lastschrift einrichten“ genau dann, wenn `barMoeglich` nein sagt — keine
 *    neue Regel (Gegenprobe über dieselben Lagen); ein Gründungshof, dessen
 *    Bargebühr noch erlassen ist, liest den Gründungssatz mit seinem Tag; im
 *    Modell „bisher“ kein Satz.
 *  - Das Rechenbeispiel von „Deine Konditionen“ rechnet im Hofpreis-Modell über
 *    `bestellGebuehr` (wie Kasse und /api/checkout) und sagt „Plattformgebühr“.
 *  - Rendertest „kein ‚Servicegebühr‘ nach dem Stichtag“ für „Deine
 *    Konditionen“; Gegenprobe: ohne Preisanzeige (Modell „bisher“) steht das Wort da.
 *  - Wörter der Boards: „Urlaub und Pause“ in der Übersicht, „Deinen Hof
 *    dauerhaft schließen.“ beim Stilllegen (nie „Hofladen“), Gegenprobe am Bestand.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/konditionen',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/server/actions/farm-archive', () => ({ archiveFarm: vi.fn(), reactivateFarm: vi.fn() }))

import {
  BAR_KARTE_TEXT,
  KONTO_TEXT,
  RECHENBEISPIEL_GEBUEHR_IM_PREIS,
  URLAUB_UND_PAUSE,
  barKarte,
  konditionenRechenbeispiel,
  type KonditionenHof,
  type EinstellungBereich,
} from '@/lib/hof-einstellungen'
import { barMoeglich, bestellGebuehr, type GebuehrLage } from '@/lib/plattformgebuehr'
import { BAR_SERVICEGEBUEHR_AB } from '@/lib/konditionen'
import { KonditionenAnsicht } from '@/components/hof-einstellungen/konditionen-ansicht'
import { EinstellungenUebersicht } from '@/components/hof-einstellungen/einstellungen-uebersicht'
import { ArchiveFarmCard } from '@/app/(hof)/settings/account/archive-farm-card'

const STICHTAG = new Date('2027-02-01T00:00:00+01:00')
const NACH = new Date('2027-03-03T10:00:00+01:00')
/** Gründungs-Ende als DATE-Spalte (UTC-Mitternacht des Tages), Einzug ab dem Tag danach. */
const GRUENDUNG_BIS = new Date('2028-01-31T00:00:00.000Z')
const EINZUG_NACH_GRUENDUNG = new Date('2028-02-01T00:00:00+01:00')

function lage(teil: Partial<Extract<GebuehrLage, { modell: 'hofpreis' }>> = {}): GebuehrLage {
  return { modell: 'hofpreis', hundertstel: 600, einzugAb: STICHTAG, barMandatPflicht: true, sepaMandatAm: null, ...teil }
}

function hof(teil: Partial<KonditionenHof> = {}): KonditionenHof {
  return {
    tarif: null,
    serviceFeePercent: '5',
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: new Date('2026-01-01T00:00:00Z'),
    platformFeePercent: '0',
    gruendungBis: null,
    produkteImShop: 9,
    abholzeitenJeWoche: 3,
    ...teil,
  }
}

const html = (el: React.ReactElement): string => renderToStaticMarkup(el)
/** Das geschützte Leerzeichen im Datum ist Satz, nicht Wortlaut (formatDatumLang). */
const normal = (text: string | null): string => (text ?? '').replace(/\u00a0/g, ' ')

describe('Bar bei Abholung: Marke aus barMoeglich (N42 g, V71)', () => {
  it('ohne Lastschrift bei Pflicht und fälligem Einzug: „Braucht Lastschrift“ mit dem Weg „Lastschrift einrichten“', () => {
    const karte = barKarte(lage(), null, NACH)
    expect(karte).toEqual({ marke: 'Braucht Lastschrift', ton: 'offen', satz: BAR_KARTE_TEXT.lastschriftSatz, lastschrift: true })
    expect(BAR_KARTE_TEXT.einrichten).toBe('Lastschrift einrichten')
  })

  it('Gründungshof vor seinem Einzug: „Aktiv“ und der Satz mit seinem Tag', () => {
    const karte = barKarte(lage({ einzugAb: EINZUG_NACH_GRUENDUNG }), GRUENDUNG_BIS, NACH)
    expect(karte.marke).toBe('Aktiv')
    expect(karte.lastschrift).toBe(false)
    expect(normal(karte.satz)).toBe('Bis 31. Jänner 2028 zahlst du als Gründungshof auf Barverkäufe keine Plattformgebühr; die Lastschrift brauchst du erst danach.')
  })

  it('mit Lastschrift oder ohne Pflicht: „Aktiv“ ohne Knopf; im Modell „bisher“ ohne Satz', () => {
    expect(barKarte(lage({ sepaMandatAm: STICHTAG }), null, NACH)).toMatchObject({ marke: 'Aktiv', lastschrift: false, satz: null })
    expect(barKarte(lage({ barMandatPflicht: false }), null, NACH)).toMatchObject({ marke: 'Aktiv', lastschrift: false })
    expect(barKarte({ modell: 'bisher' }, GRUENDUNG_BIS, NACH)).toEqual({ marke: 'Aktiv', ton: 'fertig', satz: null, lastschrift: false })
  })

  it('keine eigene Regel: der Knopf steht genau dann, wenn barMoeglich nein sagt (auch bei gesperrtem Hof)', () => {
    const lagen: GebuehrLage[] = [
      { modell: 'bisher' },
      lage(),
      lage({ sepaMandatAm: STICHTAG }),
      lage({ barMandatPflicht: false }),
      lage({ einzugAb: EINZUG_NACH_GRUENDUNG }),
      lage({ sepaMandatAm: STICHTAG, barGesperrt: true }),
    ]
    for (const l of lagen) expect(barKarte(l, null, NACH).lastschrift, JSON.stringify(l)).toBe(!barMoeglich(l, NACH))
    // Gegenprobe: Die Lagen decken beide Antworten ab.
    expect(new Set(lagen.map((l) => barMoeglich(l, NACH))).size).toBe(2)
  })
})

describe('Rechenbeispiel im Hofpreis-Modell', () => {
  it('rechnet über bestellGebuehr mit dem Satz des Hofs und sagt „Plattformgebühr“', () => {
    const r = konditionenRechenbeispiel(hof(), NACH, { hundertstel: 600 })
    const { gebuehrCents, gesamtCents } = bestellGebuehr([{ preisCents: 2000, menge: 1 }], 600)
    const online = Object.fromEntries(r.online.zeilen.map((z) => [z.label, z.betrag]))
    expect(online[RECHENBEISPIEL_GEBUEHR_IM_PREIS]).toBe(`+ € ${(gebuehrCents / 100).toFixed(2).replace('.', ',')}`)
    expect(online['Kunde zahlt']).toBe(`€ ${(gesamtCents / 100).toFixed(2).replace('.', ',')}`)
    expect(online['Deine Auszahlung']).toBe('€ 20,00')
    expect(JSON.stringify(r)).not.toContain('Servicegebühr')
    expect(r.satz).toContain('Plattformgebühr 6 %')
  })

  it('Gegenprobe: ohne Preisanzeige bleibt das Beispiel der Fassung „bisher“', () => {
    expect(JSON.stringify(konditionenRechenbeispiel(hof(), NACH, null))).toContain('Servicegebühr')
  })
})

describe('„Deine Konditionen“ gerendert: kein „Servicegebühr“ nach dem Stichtag', () => {
  it('mit Preisanzeige (Modell „hofpreis“) steht das Wort nirgends — Kopf, Beispiel, Abrechnung, Stand', () => {
    const markup = html(createElement(KonditionenAnsicht, { hof: hof(), jetzt: NACH, preis: { hundertstel: 600 }, stichtag: STICHTAG }))
    expect(markup).not.toContain('Servicegebühr')
    expect(markup).toContain('Plattformgebühr')
    expect(normal(markup)).toContain('Stand: 1. Februar 2027')
  })

  it('Gegenprobe: ohne Preisanzeige (Modell „bisher“) steht das Wort da', () => {
    const markup = html(createElement(KonditionenAnsicht, { hof: hof(), jetzt: NACH, preis: null, stichtag: BAR_SERVICEGEBUEHR_AB }))
    expect(markup).toContain('Servicegebühr')
  })
})

describe('Wörter der Boards', () => {
  it('die Übersicht nennt „Urlaub und Pause“ (V8)', () => {
    const bereich: EinstellungBereich = { id: 'urlaubsmodus', titel: URLAUB_UND_PAUSE, zeile: 'Aus · du nimmst Bestellungen an', ton: 'neutral', href: '/settings/pause' }
    const markup = html(createElement(EinstellungenUebersicht, { bereiche: [bereich] }))
    expect(markup).toContain('Urlaub und Pause')
    expect(markup).not.toContain('Urlaubsmodus')
  })

  it('Stilllegen sagt „Hof“, nie „Hofladen“, und verweist auf „Urlaub und Pause“ (V55)', () => {
    const markup = html(createElement(ArchiveFarmCard, { farmSlug: 'hof-test', isArchived: false }))
    expect(markup).toContain(KONTO_TEXT.stilllegenSatz)
    expect(markup).toContain('Deinen Hof dauerhaft schließen.')
    expect(markup).toContain(URLAUB_UND_PAUSE)
    expect(markup).not.toMatch(/Hofladen|Urlaubsmodus/)
    // Gegenprobe: Die Suche schlägt am alten Satz an.
    expect('Deinen Hofladen dauerhaft schließen.').toMatch(/Hofladen/)
  })
})
