/**
 * Ende der Gründungszeit in der Anzeige (Nr. 264, Register N48, K2/E-018).
 *
 * Beweist: Ein Satz „bis <Tag>“ zur erlassenen Bargebühr nennt den letzten Tag OHNE Gebühr — den Wiener Tag vor
 * dem Einzugsbeginn (`einzugAbFuer`), ein Satz „ab <Tag>“ den Einzugsbeginn selbst. Geprüft an beiden Karten, die
 * es sagen: „Bar bei Abholung“ (`barKarte`, /settings/payments) und „Barzahlung“ (`ladeBarzahlung` →
 * `<Barzahlung>`, /settings/konditionen), dazu die Bar-Spalte des Rechenbeispiels daneben.
 *  - gespeichertes gruendungBis 31.12.2027 → „bis 31. Dezember 2027“, „Einzug ab 1. Jänner 2028“
 *  - gespeichertes gruendungBis 31.1.2028 (wie nach dem Festschreiben mit 12 Monaten) → „bis 31. Jänner 2028“
 *  - eigener Einzugstag im Admin (Farm.einzugAb) → „bis“ = Wiener Tag davor; /settings nennt weiter gruendungBis.
 * Der Tag kommt dabei echt aus `einzugAbFuer` und `bestimmeGruendungBis` (nur Datenbank und Einstellung gemockt).
 * Grenzfall Mitternacht in Wien: am letzten Tag um 23:59 ist die Bargebühr erlassen, um 0:00 nicht mehr.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const db = vi.hoisted(() => ({
  farm: { findUnique: vi.fn() },
  monatsabrechnung: { findMany: vi.fn() },
}))
const platz = vi.hoisted(() => ({ hoefe: [] as HofFuerGruendung[] }))

vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/server/queries/plattform-einstellung', () => ({ lesePlattformEinstellung: vi.fn(async () => ({ hofpreisModellAb: null })) }))
vi.mock('@/server/queries/admin', () => ({ ladeHoefeFuerGruendung: vi.fn(async () => platz.hoefe) }))
vi.mock('@/server/actions/lastschrift', () => ({ starteLastschrift: vi.fn(), oeffneRechnung: vi.fn() }))
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: vi.fn() }))

import { ladeBarzahlung } from '@/server/queries/plattformgebuehr'
import { Barzahlung } from '@/components/hof-einstellungen/barzahlung'
import { BAR_KARTE_TEXT, barKarte, konditionenRechenbeispiel, konditionenZeile, type KonditionenHof } from '@/lib/hof-einstellungen'
import { LASTSCHRIFT_TEXT } from '@/lib/konditionen'
import { einzugAbFuer, einzugFuer, gebuehrLageFuer, letzterFreierTag, type GebuehrLage } from '@/lib/plattformgebuehr'
import { bestimmeGruendungBis } from '@/lib/gruendungshof'
import { wienerMitternacht } from '@/lib/wiener-tag'
import type { HofFuerGruendung } from '@/server/queries/admin'

/** Mitten in der Gründungszeit, nach dem Stichtag 1. Februar 2027 (Hofpreis-Modell gilt). */
const JETZT = new Date('2027-03-03T10:00:00+01:00')
const HOF_ID = 'hof-gruendung-ende'

/** Das geschützte Leerzeichen im Datum ist Satz, nicht Wortlaut (formatDatumLang). */
const normal = (text: string | null): string => (text ?? '').replace(/ /g, ' ')
const html = (el: React.ReactElement): string => normal(renderToStaticMarkup(el))

/** `Farm.gruendungBis` ist eine DATE-Spalte: Prisma liefert UTC-Mitternacht des gespeicherten Tags. */
const datumsSpalte = (tag: string): Date => new Date(`${tag}T00:00:00.000Z`)

/** Ein Wiener Tag als Zeitpunkt (Mitternacht in Wien), wie die Admin-Action `Farm.einzugAb` speichert. */
function wienTag(tag: string): Date {
  const zeitpunkt = wienerMitternacht(tag)
  if (!zeitpunkt) throw new Error(`kein Tag: ${tag}`)
  return zeitpunkt
}

type HofZeile = { gruendungBis: Date | null; einzugAb: Date | null }

/** Der Hof hält Gründungsplatz 1 (festgeschrieben); seine Spalten kommen aus `zeile`. */
function hofInDb(zeile: HofZeile): void {
  db.farm.findUnique.mockResolvedValue({
    id: HOF_ID,
    gruendungBis: zeile.gruendungBis,
    einzugAb: zeile.einzugAb,
    plattformgebuehrProzent: null,
    barMandatPflicht: true,
    barSperreNachTagen: 14,
    sepaMandatAm: null,
    sepaZahlungsmittelId: null,
  })
  platz.hoefe = [
    {
      id: HOF_ID,
      ownerId: 'konto-gruendung-ende',
      approvedAt: new Date('2026-12-01T10:00:00+01:00'),
      createdAt: new Date('2026-11-20T10:00:00+01:00'),
      archivedAt: null,
      gruendungBis: zeile.gruendungBis,
      gruendungAusgenommen: false,
      gruendungPlatz: 1,
      gruendungFest: true,
      gruendungPlaetze: 100,
    },
  ]
}

/** Die Lage, wie /settings/payments sie lädt (ladeGebuehrLage): wirksames Gründungs-Ende nur ohne Farm.einzugAb. */
function lageFuer(zeile: HofZeile, jetzt: Date = JETZT, sepaMandatAm: Date | null = null): GebuehrLage {
  const gruendungBis = zeile.einzugAb ? null : bestimmeGruendungBis({ id: HOF_ID, gruendungBis: zeile.gruendungBis }, platz.hoefe)
  return gebuehrLageFuer({ plattformgebuehrProzent: null, einzugAb: zeile.einzugAb, barMandatPflicht: true, sepaMandatAm }, null, gruendungBis, jetzt)
}

/** Die Karte „Barzahlung“, wie /settings/konditionen sie zeigt: ladeBarzahlung → <Barzahlung>. */
async function barzahlungKarte(): Promise<string> {
  const daten = await ladeBarzahlung(HOF_ID, JETZT)
  if (!daten) throw new Error('Hof fehlt')
  return html(createElement(Barzahlung, { daten }))
}

function konditionenHof(gruendungBis: Date | null): KonditionenHof {
  return {
    tarif: null,
    serviceFeePercent: '5',
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: new Date('2026-01-01T00:00:00Z'),
    platformFeePercent: '0',
    gruendungBis,
    produkteImShop: 9,
    abholzeitenJeWoche: 3,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.monatsabrechnung.findMany.mockResolvedValue([])
})

describe('Gründungshof mit gespeichertem Ende 31. Dezember 2027', () => {
  const ZEILE: HofZeile = { gruendungBis: datumsSpalte('2027-12-31'), einzugAb: null }

  it('„Bar bei Abholung“ sagt „Bis 31. Dezember 2027 zahlst du als Gründungshof …“', () => {
    hofInDb(ZEILE)
    const karte = barKarte(lageFuer(ZEILE), JETZT, ZEILE)
    expect(normal(karte.satz)).toBe(normal(BAR_KARTE_TEXT.gruendungSatz('31. Dezember 2027')))
  })

  it('„Barzahlung“ sagt „Einzug ab 1. Jänner 2028“ und „Bis 31. Dezember 2027 behältst du …“', async () => {
    hofInDb(ZEILE)
    const karte = await barzahlungKarte()
    expect(karte).toContain(`Einzug ab 1. Jänner 2028 · ${LASTSCHRIFT_TEXT.erlassen('31. Dezember 2027')}`)
    // Gegenprobe: Der Einzugstag steht nie hinter „Bis“.
    expect(karte).not.toContain('Bis 1. Jänner 2028')
  })

  it('die Bar-Spalte des Rechenbeispiels daneben nennt denselben letzten Tag', () => {
    hofInDb(ZEILE)
    const r = konditionenRechenbeispiel(konditionenHof(ZEILE.gruendungBis), JETZT, lageFuer(ZEILE))
    expect(normal(r.bar.satz)).toBe(LASTSCHRIFT_TEXT.erlassen('31. Dezember 2027'))
  })
})

describe('Gründungshof mit gespeichertem Ende 31. Jänner 2028 (E-018)', () => {
  const ZEILE: HofZeile = { gruendungBis: datumsSpalte('2028-01-31'), einzugAb: null }

  it('beide Karten sagen „bis 31. Jänner 2028“, der Einzug beginnt am 1. Februar 2028', async () => {
    hofInDb(ZEILE)
    expect(normal(barKarte(lageFuer(ZEILE), JETZT, ZEILE).satz)).toBe(normal(BAR_KARTE_TEXT.gruendungSatz('31. Jänner 2028')))
    const karte = await barzahlungKarte()
    expect(karte).toContain(`Einzug ab 1. Februar 2028 · ${LASTSCHRIFT_TEXT.erlassen('31. Jänner 2028')}`)
  })
})

describe('Hof mit eigenem Einzugstag im Admin (Farm.einzugAb)', () => {
  /** Sommerzeit: Mitternacht in Wien ist 22:00 UTC am Vortag. */
  const ZEILE: HofZeile = { gruendungBis: datumsSpalte('2027-12-31'), einzugAb: wienTag('2027-06-01') }

  it('„bis“ ist der Wiener Tag vor diesem Einzugstag, in beiden Karten', async () => {
    hofInDb(ZEILE)
    expect(normal(barKarte(lageFuer(ZEILE), JETZT, ZEILE).satz)).toBe(LASTSCHRIFT_TEXT.erlassen('31. Mai 2027'))
    const karte = await barzahlungKarte()
    expect(karte).toContain(`Einzug ab 1. Juni 2027 · ${LASTSCHRIFT_TEXT.erlassen('31. Mai 2027')}`)
  })

  it('/settings nennt weiter das Ende der Grundgebühr (gruendungBis, inklusiv)', () => {
    const zeile = konditionenZeile({ tarif: null, gruendungBis: ZEILE.gruendungBis }, JETZT)
    expect(normal(zeile)).toBe('Gründungshof bis 31. Dezember 2027 · ohne Grundgebühr')
  })
})

describe('Grenzfall Mitternacht in Wien: der genannte letzte Tag ist der letzte erlassene', () => {
  const ZEILE: HofZeile = { gruendungBis: datumsSpalte('2027-12-31'), einzugAb: null }
  const MANDAT = new Date('2027-03-01T10:00:00+01:00')

  it('am 31. Dezember 2027 um 23:59 erlassen, am 1. Jänner 2028 um 0:00 nicht mehr', () => {
    hofInDb(ZEILE)
    const spaet = new Date('2027-12-31T23:59:59.999+01:00')
    const mitternacht = new Date('2028-01-01T00:00:00.000+01:00')
    const vorher = lageFuer(ZEILE, spaet, MANDAT)
    const danach = lageFuer(ZEILE, mitternacht, MANDAT)
    if (vorher.modell !== 'hofpreis' || danach.modell !== 'hofpreis') throw new Error('Hofpreis-Modell erwartet')
    expect(einzugFuer(vorher, 'ONSITE_CASH', spaet)).toBe('erlassen')
    expect(einzugFuer(danach, 'ONSITE_CASH', mitternacht)).toBe('sepa')
    // Der Satz um 23:59 nennt genau diesen Tag; um 0:00 steht keiner mehr.
    expect(normal(barKarte(vorher, spaet, ZEILE).satz)).toBe(normal(BAR_KARTE_TEXT.gruendungSatz('31. Dezember 2027')))
    expect(barKarte(danach, mitternacht, ZEILE).satz).toBeNull()
  })
})

describe('letzterFreierTag: der Wiener Tag vor dem Einzugsbeginn, als Text', () => {
  it.each([
    ['Gründungs-Ende 31.12.2027 (Winterzeit)', datumsSpalte('2027-12-31'), '31. Dezember 2027'],
    ['Gründungs-Ende 31.1.2028 (E-018)', datumsSpalte('2028-01-31'), '31. Jänner 2028'],
    ['Gründungs-Ende 30.6.2028 (Sommerzeit)', datumsSpalte('2028-06-30'), '30. Juni 2028'],
  ])('%s', (_fall, gruendungBis, tag) => {
    const einzugAb = einzugAbFuer({ einzugAb: null }, null, gruendungBis)
    expect(normal(letzterFreierTag(einzugAb))).toBe(tag)
  })

  it('ohne Gründungsplatz: der Tag vor dem Stichtag 1. Februar 2027', () => {
    expect(normal(letzterFreierTag(einzugAbFuer({ einzugAb: null }, null, null)))).toBe('31. Jänner 2027')
  })
})
