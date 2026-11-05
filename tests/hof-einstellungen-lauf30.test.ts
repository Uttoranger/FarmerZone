/**
 * Einstellungen nach den Boards November 2026 (Nr. 224, Lauf 30).
 *
 * Beweist:
 *  - „Bar bei Abholung“ auf /settings/payments: Marke „offen“ genau dann, wenn
 *    `barMoeglich` nein sagt — keine neue Regel (Gegenprobe über dieselben
 *    Lagen); „Lastschrift einrichten“ nur, wenn keine Sperre der Grund ist
 *    (gesperrt: „Bar gesperrt“ mit dem Weg zu „Deine Konditionen“). Ist die
 *    Bargebühr erlassen, nennt der Satz den Einzugstag `einzugAb` aus der Lage
 *    (Runde 1: nie `gruendungBis` daneben; Runde 2: derselbe Tag wie die Karte
 *    „Barzahlung“, Beweis unten am gerenderten „Deine Konditionen“);
 *    „Gründungshof“ nur, wenn Farm.einzugAb leer ist; im Modell „bisher“ kein Satz.
 *  - Das Rechenbeispiel von „Deine Konditionen“ rechnet im Hofpreis-Modell über
 *    `bestellGebuehr` (wie Kasse und /api/checkout), sagt „Plattformgebühr“ und
 *    wählt die Bar-Spalte nach `einzugFuer` (erlassen, sepa, ueberweisung, null).
 *  - Rendertest „kein ‚Servicegebühr‘ nach dem Stichtag“ für „Deine
 *    Konditionen“; Gegenprobe: im Modell „bisher“ steht das Wort da; ohne Lage
 *    keine Teile, die vom Stichtag abhängen.
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
vi.mock('@/server/actions/lastschrift', () => ({ starteLastschrift: vi.fn(), oeffneRechnung: vi.fn() }))
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: vi.fn() }))

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
import { BAR_GEBUEHR_SEPA_SATZ, BAR_SERVICEGEBUEHR_AB, LASTSCHRIFT_TEXT } from '@/lib/konditionen'
import { KonditionenAnsicht } from '@/components/hof-einstellungen/konditionen-ansicht'
import { EinstellungenUebersicht } from '@/components/hof-einstellungen/einstellungen-uebersicht'
import { ArchiveFarmCard } from '@/app/(hof)/settings/account/archive-farm-card'
import { Barzahlung, type BarzahlungAnzeige } from '@/components/hof-einstellungen/barzahlung'
import { formatDatumLang } from '@/lib/format'

const STICHTAG = new Date('2027-02-01T00:00:00+01:00')
const NACH = new Date('2027-03-03T10:00:00+01:00')
/** Einzug nach dem Gründungs-Ende 31. Jänner 2028 (einzugAbFuer: Mitternacht in Wien am Tag danach). */
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

/** Farm.einzugAb leer: der Tag kommt aus der Gründung (bzw. dem Stichtag). */
const OHNE_EINTRAG = { einzugAb: null }
/** Ein im Admin eingetragener Einzugsbeginn (Sommerzeit: Mitternacht in Wien = 22:00 UTC am Vortag). */
const EINZUG_EINGETRAGEN = new Date('2027-06-01T00:00:00+02:00')

describe('Bar bei Abholung: Marke aus barMoeglich (N42 g, V71)', () => {
  it('ohne Lastschrift bei Pflicht und fälligem Einzug: „Braucht Lastschrift“ mit dem Weg „Lastschrift einrichten“', () => {
    const karte = barKarte(lage(), NACH, OHNE_EINTRAG)
    expect(karte).toEqual({ marke: 'Braucht Lastschrift', ton: 'offen', satz: BAR_KARTE_TEXT.lastschriftSatz, lastschrift: true, zuKonditionen: false })
    expect(BAR_KARTE_TEXT.einrichten).toBe('Lastschrift einrichten')
  })

  it('Gründungshof vor seinem Einzug: „Aktiv“ und der Satz mit dem Einzugstag aus der Lage', () => {
    const karte = barKarte(lage({ einzugAb: EINZUG_NACH_GRUENDUNG }), NACH, OHNE_EINTRAG)
    expect(karte.marke).toBe('Aktiv')
    expect(karte.lastschrift).toBe(false)
    expect(normal(karte.satz)).toBe('Bis 1. Februar 2028 zahlst du als Gründungshof auf Barverkäufe keine Plattformgebühr; die Lastschrift brauchst du erst danach.')
  })

  it('Farm.einzugAb eingetragen (Sommerzeit): der Tag ist dieser Einzugstag in Wien, ohne „Gründungshof“ (nie gruendungBis)', () => {
    const karte = barKarte(lage({ einzugAb: EINZUG_EINGETRAGEN }), NACH, { einzugAb: EINZUG_EINGETRAGEN })
    expect(karte.marke).toBe('Aktiv')
    expect(normal(karte.satz)).toBe('Bis 1. Juni 2027 behältst du die Plattformgebühr aus Barbestellungen – wir verzichten darauf.')
    // Gegenprobe: Ab dem eingetragenen Tag ist nichts mehr erlassen — kein Satz.
    expect(barKarte(lage({ einzugAb: EINZUG_EINGETRAGEN, sepaMandatAm: STICHTAG }), EINZUG_EINGETRAGEN, { einzugAb: EINZUG_EINGETRAGEN }).satz).toBeNull()
  })

  it('mit Lastschrift oder ohne Pflicht: „Aktiv“ ohne Knopf; im Modell „bisher“ ohne Satz', () => {
    expect(barKarte(lage({ sepaMandatAm: STICHTAG }), NACH, OHNE_EINTRAG)).toMatchObject({ marke: 'Aktiv', lastschrift: false, satz: null })
    expect(barKarte(lage({ barMandatPflicht: false }), NACH, OHNE_EINTRAG)).toMatchObject({ marke: 'Aktiv', lastschrift: false })
    expect(barKarte({ modell: 'bisher' }, NACH, OHNE_EINTRAG)).toEqual({ marke: 'Aktiv', ton: 'fertig', satz: null, lastschrift: false, zuKonditionen: false })
  })

  it('gesperrter Hof mit Lastschrift: „Bar gesperrt“ mit eigenem Satz und dem Weg zu „Deine Konditionen“, kein „Lastschrift einrichten“', () => {
    const karte = barKarte(lage({ sepaMandatAm: STICHTAG, barGesperrt: true }), NACH, OHNE_EINTRAG)
    expect(karte).toEqual({ marke: 'Bar gesperrt', ton: 'offen', satz: BAR_KARTE_TEXT.gesperrtSatz, lastschrift: false, zuKonditionen: true })
    expect(BAR_KARTE_TEXT.einrichtenHref).toBe('/settings/konditionen#barzahlung')
    expect(karte.satz).not.toContain('sobald du die Lastschrift')
  })

  it('keine eigene Regel: „offen“ genau dann, wenn barMoeglich nein sagt; der Knopf nur, wenn keine Sperre der Grund ist', () => {
    const lagen: GebuehrLage[] = [
      { modell: 'bisher' },
      lage(),
      lage({ sepaMandatAm: STICHTAG }),
      lage({ barMandatPflicht: false }),
      lage({ einzugAb: EINZUG_NACH_GRUENDUNG }),
      lage({ sepaMandatAm: STICHTAG, barGesperrt: true }),
      lage({ barGesperrt: true }),
    ]
    for (const l of lagen) {
      const karte = barKarte(l, NACH, OHNE_EINTRAG)
      const gesperrt = l.modell === 'hofpreis' && l.barGesperrt === true
      expect(karte.ton === 'offen', JSON.stringify(l)).toBe(!barMoeglich(l, NACH))
      expect(karte.lastschrift, JSON.stringify(l)).toBe(!barMoeglich(l, NACH) && !gesperrt)
      expect(karte.zuKonditionen, JSON.stringify(l)).toBe(!barMoeglich(l, NACH) && gesperrt)
    }
    // Gegenprobe: Die Lagen decken beide Antworten ab.
    expect(new Set(lagen.map((l) => barMoeglich(l, NACH))).size).toBe(2)
  })
})

describe('Rechenbeispiel im Hofpreis-Modell', () => {
  /** € 20 Ware, 6 % je Stück aufgerundet = € 1,20 (bestellGebuehr), die Kundin zahlt € 21,20. */
  const bar = (l: GebuehrLage) => {
    const r = konditionenRechenbeispiel(hof(), NACH, l)
    return { zeilen: Object.fromEntries(r.bar.zeilen.map((z) => [z.label, z.betrag])), satz: normal(r.bar.satz) }
  }

  it('rechnet über bestellGebuehr mit dem Satz des Hofs und sagt „Plattformgebühr“', () => {
    const r = konditionenRechenbeispiel(hof(), NACH, lage({ sepaMandatAm: STICHTAG }))
    const { gebuehrCents, gesamtCents } = bestellGebuehr([{ preisCents: 2000, menge: 1 }], 600)
    expect([gebuehrCents, gesamtCents]).toEqual([120, 2120])
    const online = Object.fromEntries(r.online.zeilen.map((z) => [z.label, z.betrag]))
    expect(online[RECHENBEISPIEL_GEBUEHR_IM_PREIS]).toBe('+ € 1,20')
    expect(online['Kunde zahlt']).toBe('€ 21,20')
    expect(online['Deine Auszahlung']).toBe('€ 20,00')
    expect(JSON.stringify(r)).not.toContain('Servicegebühr')
    expect(r.satz).toContain('Plattformgebühr 6 %')
  })

  it('bar mit Lastschrift (sepa): dir bleibt der Warenpreis, die Monatsabrechnung holt die Gebühr per SEPA', () => {
    const b = bar(lage({ sepaMandatAm: STICHTAG }))
    expect(b.zeilen['Du kassierst („Bar zu kassieren“)']).toBe('€ 21,20')
    expect(b.zeilen['Dir bleibt']).toBe('€ 20,00')
    expect(b.satz).toBe(BAR_GEBUEHR_SEPA_SATZ)
  })

  it('bar erlassen (Gründungshof vor seinem Einzug): dir bleibt der ganze Betrag, kein SEPA-Satz', () => {
    const b = bar(lage({ einzugAb: EINZUG_NACH_GRUENDUNG }))
    expect(b.zeilen['Du kassierst („Bar zu kassieren“)']).toBe('€ 21,20')
    expect(b.zeilen['Dir bleibt']).toBe('€ 21,20')
    expect(b.satz).toBe('Bis 1. Februar 2028 behältst du die Plattformgebühr aus Barbestellungen – wir verzichten darauf.')
    expect(b.satz).not.toContain('SEPA')
  })

  it('bar per Überweisung (keine Lastschrift, nicht Pflicht): dir bleibt der Warenpreis, der Satz nennt die Überweisung', () => {
    const b = bar(lage({ barMandatPflicht: false }))
    expect(b.zeilen['Dir bleibt']).toBe('€ 20,00')
    expect(b.satz).toBe(LASTSCHRIFT_TEXT.mandatFrei)
    expect(b.satz).not.toContain('SEPA')
  })

  it('bar geht gerade nicht: ohne Lastschrift bei Pflicht der Pflicht-Satz, bei Sperre der Satz der Sperre', () => {
    expect(bar(lage()).satz).toBe(LASTSCHRIFT_TEXT.mandatPflicht)
    expect(bar(lage({ sepaMandatAm: STICHTAG, barGesperrt: true })).satz).toBe(BAR_KARTE_TEXT.gesperrtSatz)
    // Das Beispiel steht auf „Deine Konditionen“ selbst — kein Verweis auf die eigene Seite.
    expect(bar(lage({ sepaMandatAm: STICHTAG, barGesperrt: true })).satz).not.toContain('Konditionen')
    expect(bar(lage()).zeilen['Dir bleibt']).toBe('€ 20,00')
  })

  it('Gegenprobe: im Modell „bisher“ bleibt das Beispiel der Fassung „bisher“', () => {
    expect(JSON.stringify(konditionenRechenbeispiel(hof(), NACH, { modell: 'bisher' }))).toContain('Servicegebühr')
  })
})

describe('„Deine Konditionen“ gerendert: kein „Servicegebühr“ nach dem Stichtag', () => {
  it('im Modell „hofpreis“ steht das Wort nirgends — Kopf, Beispiel, Abrechnung, Stand', () => {
    const markup = html(createElement(KonditionenAnsicht, { hof: hof(), jetzt: NACH, gebuehr: { lage: lage(), stichtag: STICHTAG } }))
    expect(markup).not.toContain('Servicegebühr')
    expect(markup).toContain('Plattformgebühr')
    expect(normal(markup)).toContain('Stand: 1. Februar 2027')
  })

  it('Gegenprobe: im Modell „bisher“ steht das Wort da', () => {
    const markup = html(createElement(KonditionenAnsicht, { hof: hof(), jetzt: NACH, gebuehr: { lage: { modell: 'bisher' }, stichtag: BAR_SERVICEGEBUEHR_AB } }))
    expect(markup).toContain('Servicegebühr')
  })

  it('Lage unbekannt (Lesen gescheitert): ohne Rechenbeispiel, Abrechnung und Stand — nie die Fassung „bisher“', () => {
    const markup = html(createElement(KonditionenAnsicht, { hof: hof(), jetzt: NACH, gebuehr: null }))
    expect(markup).toContain('Deine Konditionen')
    expect(markup).not.toContain('Servicegebühr')
    expect(markup).not.toContain('Rechenbeispiel')
    expect(markup).not.toContain('So rechnen wir ab')
    expect(markup).not.toContain('Stand:')
    // Gegenprobe: Mit Lage stehen die Teile da.
    const mit = html(createElement(KonditionenAnsicht, { hof: hof(), jetzt: NACH, gebuehr: { lage: lage(), stichtag: STICHTAG } }))
    for (const teil of ['Rechenbeispiel', 'So rechnen wir ab', 'Stand:']) expect(mit).toContain(teil)
  })
})

describe('„Deine Konditionen“: Rechenbeispiel und Karte „Barzahlung“ nennen denselben Tag (Runde 2)', () => {
  /** Die Karte bekommt den Tag als Text aus ladeBarzahlung: formatDatumLang(einzugAbFuer(…)) — hier derselbe Einzug. */
  function karte(einzugAb: Date): BarzahlungAnzeige {
    return { satzText: '6', einzugAbText: formatDatumLang(einzugAb), einzugBegonnen: false, mandat: false, mandatPflicht: true, bank: null, letzte4: null, abrechnungen: [] }
  }
  const tage = (markup: string): string[] => [...normal(markup).matchAll(/Bis ([^<]+?) behältst du/g)].map((m) => m[1])

  it.each([
    ['Winterzeit, Gründungshof', EINZUG_NACH_GRUENDUNG, '1. Februar 2028'],
    ['Sommerzeit, eingetragener Einzug', EINZUG_EINGETRAGEN, '1. Juni 2027'],
  ])('%s', (_fall, einzugAb, tag) => {
    const seite =
      html(createElement(KonditionenAnsicht, { hof: hof(), jetzt: NACH, gebuehr: { lage: lage({ einzugAb }), stichtag: STICHTAG } })) +
      html(createElement(Barzahlung, { daten: karte(einzugAb) }))
    const genannt = tage(seite)
    // Zwei Stellen: die Bar-Spalte des Rechenbeispiels und die Karte „Barzahlung“.
    expect(genannt).toHaveLength(2)
    expect(new Set(genannt)).toEqual(new Set([tag]))
    // Gegenprobe: Der Vortag (die alte Rechnung des Beispiels) steht nirgends.
    expect(normal(seite)).not.toContain(formatDatumLang(new Date(einzugAb.getTime() - 1)).replace(/\u00a0/g, ' '))
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
