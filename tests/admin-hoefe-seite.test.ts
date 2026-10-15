/**
 * Admin › Höfe im Seitenmuster (Register N15, Nr. 94) — die Regeln hinter der
 * Seite, rein und ohne Datenbank.
 *
 * Beweist:
 *  - Kennzahlen aus den Zeilen der Hofliste (gemockte Daten): Warten, Online,
 *    Pausiert und Ohne Zahlung zählen genau wie die Filter der Liste; die
 *    Gründungsplätze rechnen „frei“ aus Plätzen und Vergebenen; ein Ton steht
 *    nur bei Handlungsbedarf.
 *  - Warteliste: „bekäme Gründungsplatz Nr. k“ nur mit Stripe, ohne Stripe
 *    „Gründungsplatz erst mit Freischaltung“, sind alle Plätze vergeben, gar
 *    keine Zeile. k folgt der Reihenfolge der Freischaltung (gruendungsplatzVon).
 *  - Spalte Gründungshof: „Nr. 3 · bis 30.06.2027“ mit der Marke „abweichend“
 *    bzw. „Standard“, ohne Platz „kein Gründungshof“.
 *  - Reiter-Zustand aus der Adresse: ein unbekannter Wert fällt auf den
 *    Standard, der Standard hängt von den wartenden Höfen ab; die Adressen der
 *    Reiter tragen `reiter`.
 */
import { describe, it, expect } from 'vitest'
import { adminHofZeile, zaehleHofFilter, type AdminHofZeile, type HofRohdaten } from '@/lib/admin-hoefe'
import {
  GRUENDUNGSHOF_SPALTE,
  GRUENDUNGSPLATZ_WARTELISTE,
  HOEFE_REITER_IDS,
  gruendungshofZelle,
  gruendungshoefeListe,
  hoefeKennzahlen,
  hoefeSeitenAdresse,
  hoefeUnterreiter,
  platzBeiFreischaltung,
  waehleHoefeReiter,
  wartelistePlatzZeile,
} from '@/lib/admin-hoefe-seite'
import type { HofFuerPlatz } from '@/lib/gruendungshof'
import { hoefeReiterAus } from '@/schemas/admin-reiter'

const JETZT = new Date('2026-10-15T10:00:00+02:00')
const MAX = 12

function roh(id: string, ueber: Partial<HofRohdaten> = {}): HofRohdaten {
  return {
    id,
    name: `Hof ${id}`,
    slug: `hof-${id}`,
    ownerEmail: `${id}@example.com`,
    emailBestaetigt: true,
    emailBestaetigungOffen: false,
    createdAt: new Date('2026-09-01T09:00:00+02:00'),
    approvedAt: new Date('2026-09-02T09:00:00+02:00'),
    archivedAt: null,
    land: 'AT',
    serviceFeePercent: 5,
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: null,
    monat: { bestellungen: 0, gebuehrOnlineCents: 0, gebuehrBarCents: 0, gebuehrEntfallenCents: 0 },
    monatBezeichnung: 'Oktober 2026',
    stripeBereit: true,
    onlineAn: true,
    isPaused: false,
    betriebsnummer: null,
    sepaErteilt: false,
    ...ueber,
  }
}

const zeile = (r: HofRohdaten, platz: number | null = null): AdminHofZeile => adminHofZeile(r, { gruendungsplatz: platz, maxPlaetze: MAX }, JETZT)

/** Ein Bestand wie im Mockup: zwei Höfe online, einer pausiert, einer ohne Stripe, zwei wartend. */
function mockupHoefe(): AdminHofZeile[] {
  return [
    zeile(roh('a'), 1),
    zeile(roh('b'), 2),
    zeile(roh('c', { isPaused: true }), 3),
    zeile(roh('d', { stripeBereit: false }), 4),
    zeile(roh('w1', { approvedAt: null }), null),
    zeile(roh('w2', { approvedAt: null, stripeBereit: false }), null),
  ]
}

const gesamt = (liste: ReturnType<typeof hoefeKennzahlen>) => Object.fromEntries(liste.map((k) => [k.id, k]))

describe('Kennzahlen der Höfe', () => {
  it('Warten · Online · Pausiert · Ohne Zahlung · Gründungsplätze, in dieser Reihenfolge', () => {
    const kennzahlen = hoefeKennzahlen(mockupHoefe(), { vergeben: 7, max: MAX })
    expect(kennzahlen.map((k) => [k.titel, k.wert])).toEqual([
      ['Warten', '2'],
      ['Online', '2'],
      ['Pausiert', '1'],
      ['Ohne Zahlung', '1'],
      ['Gründungsplätze', '5 frei'],
    ])
    expect(gesamt(kennzahlen).gruendungsplaetze?.satz).toBe('7 von 12 vergeben')
  })

  it('zählt genau wie die Filter der Liste — eine Regel, keine zweite', () => {
    const hoefe = mockupHoefe()
    const filter = zaehleHofFilter(hoefe)
    const k = gesamt(hoefeKennzahlen(hoefe, { vergeben: 4, max: MAX }))
    expect(k.online?.wert).toBe(String(filter.online))
    expect(k.pausiert?.wert).toBe(String(filter.pausiert))
    expect(k.ohneZahlung?.wert).toBe(String(filter['stripe-fehlt']))
  })

  it('„Ohne Zahlung“ findet auch einen pausierten Hof ohne Stripe — wie der Filter „Stripe fehlt“', () => {
    const hoefe = [zeile(roh('p', { isPaused: true, stripeBereit: false }), 1)]
    const k = gesamt(hoefeKennzahlen(hoefe, { vergeben: 1, max: MAX }))
    expect(k.pausiert?.wert).toBe('1')
    expect(k.ohneZahlung?.wert).toBe('1')
    expect(k.online?.wert).toBe('0')
  })

  it('ein stillgelegter Hof zählt in keiner Kachel', () => {
    const hoefe = [zeile(roh('s', { archivedAt: new Date('2026-10-01T09:00:00+02:00') }), null)]
    const k = hoefeKennzahlen(hoefe, { vergeben: 0, max: MAX })
    expect(k.slice(0, 4).map((x) => x.wert)).toEqual(['0', '0', '0', '0'])
  })

  it('Ton nur bei Handlungsbedarf: Warten tun, wenn jemand wartet; Gründungsplätze tun, wenn einer wartet und Platz ist', () => {
    const k = gesamt(hoefeKennzahlen(mockupHoefe(), { vergeben: 7, max: MAX }))
    expect(k.warten?.ton).toBe('tun')
    expect(k.gruendungsplaetze?.ton).toBe('tun')
    expect(k.online?.ton ?? 'neutral').toBe('neutral')
    expect(k.pausiert?.ton ?? 'neutral').toBe('neutral')
    expect(k.ohneZahlung?.ton ?? 'neutral').toBe('neutral')
  })

  it('Gegenprobe: niemand wartet — kein Ton; alle Plätze vergeben — „0 frei“ ohne Ton', () => {
    const ohneWartende = mockupHoefe().filter((h) => h.status.id !== 'wartet')
    const ruhig = gesamt(hoefeKennzahlen(ohneWartende, { vergeben: 4, max: MAX }))
    expect(ruhig.warten?.ton ?? 'neutral').toBe('neutral')
    expect(ruhig.gruendungsplaetze?.ton ?? 'neutral').toBe('neutral')
    const voll = gesamt(hoefeKennzahlen(mockupHoefe(), { vergeben: 12, max: MAX }))
    expect(voll.gruendungsplaetze?.wert).toBe('0 frei')
    expect(voll.gruendungsplaetze?.ton ?? 'neutral').toBe('neutral')
  })

  it('am Handy zu dritt: Warten, Online und die Plätze — mit dem Kurztitel „Plätze frei“', () => {
    const k = gesamt(hoefeKennzahlen(mockupHoefe(), { vergeben: 7, max: MAX }))
    expect(Object.values(k).filter((x) => x.amHandy !== false).map((x) => x.id)).toEqual(['warten', 'online', 'gruendungsplaetze'])
    expect(k.gruendungsplaetze?.titelKurz).toBe('Plätze frei')
  })
})

describe('Warteliste: Gründungsplatz bei Freischaltung', () => {
  const frist = (id: string, tag: number): HofFuerPlatz => ({
    id,
    approvedAt: new Date(`2026-09-${String(tag).padStart(2, '0')}T09:00:00+02:00`),
    createdAt: new Date('2026-08-01T09:00:00+02:00'),
    archivedAt: null,
  })
  const warteHof: HofFuerPlatz = { id: 'wartet', approvedAt: null, createdAt: new Date('2026-10-10T09:00:00+02:00'), archivedAt: null }
  const sieben = Array.from({ length: 7 }, (_, i) => frist(`h${i + 1}`, i + 1))

  it('k ist die Zahl der Höfe im Rennen plus eins — der Hof kommt als letzter in die Reihenfolge der Freischaltung', () => {
    expect(platzBeiFreischaltung('wartet', [...sieben, warteHof], JETZT, MAX)).toBe(8)
  })

  it('ein stillgelegter Hof gibt seinen Platz frei und ein wartender belegt keinen', () => {
    const still = { ...frist('weg', 5), archivedAt: new Date('2026-10-01T09:00:00+02:00') }
    const weitereWartende: HofFuerPlatz = { ...warteHof, id: 'zweiter' }
    expect(platzBeiFreischaltung('wartet', [...sieben, still, weitereWartende, warteHof], JETZT, MAX)).toBe(8)
  })

  it('alle Plätze vergeben: kein Platz', () => {
    const zwoelf = Array.from({ length: 12 }, (_, i) => frist(`h${i + 1}`, i + 1))
    expect(platzBeiFreischaltung('wartet', [...zwoelf, warteHof], JETZT, MAX)).toBeNull()
    // Gegenprobe: elf vergeben — der zwölfte Platz ist noch frei.
    expect(platzBeiFreischaltung('wartet', [...zwoelf.slice(0, 11), warteHof], JETZT, MAX)).toBe(12)
  })

  it('mit Stripe: „bekäme Gründungsplatz Nr. k“', () => {
    expect(wartelistePlatzZeile({ stripeBereit: true }, 8)).toEqual({ art: 'bekaeme', text: 'bekäme Gründungsplatz Nr. 8' })
    expect(GRUENDUNGSPLATZ_WARTELISTE.bekaeme(8)).toBe('bekäme Gründungsplatz Nr. 8')
  })

  it('ohne Stripe: „Gründungsplatz erst mit Freischaltung“ — auch wenn ein Platz frei wäre', () => {
    expect(wartelistePlatzZeile({ stripeBereit: false }, 8)).toEqual({ art: 'erst', text: 'Gründungsplatz erst mit Freischaltung' })
  })

  it('Gegenprobe: sind alle Plätze vergeben, gibt es keine Zeile — mit und ohne Stripe', () => {
    expect(wartelistePlatzZeile({ stripeBereit: true }, null)).toBeNull()
    expect(wartelistePlatzZeile({ stripeBereit: false }, null)).toBeNull()
  })
})

describe('Spalte Gründungshof', () => {
  const standard = { bisTag: '2027-12-31', bisText: '31. Dezember 2027', abweichend: false }
  const eigenes = { bisTag: '2027-06-30', bisText: '30. Juni 2027', abweichend: true }

  it('„Nr. 3 · bis 30.06.2027“ mit der Marke „abweichend“', () => {
    expect(gruendungshofZelle({ gruendungsplatz: 3, gruendung: eigenes })).toEqual({ text: 'Nr. 3 · bis 30.06.2027', marke: 'abweichend' })
  })

  it('beim Standard-Ende die Marke „Standard“', () => {
    expect(gruendungshofZelle({ gruendungsplatz: 1, gruendung: standard })).toEqual({ text: 'Nr. 1 · bis 31.12.2027', marke: 'Standard' })
  })

  it('ohne Platz keine Zelle — die Seite schreibt „kein Gründungshof“', () => {
    expect(gruendungshofZelle({ gruendungsplatz: null, gruendung: null })).toBeNull()
    expect(GRUENDUNGSHOF_SPALTE.kein).toBe('kein Gründungshof')
  })

  it('die Liste der Gründungshöfe: nur Höfe mit Platz, nach Platz geordnet', () => {
    const liste = gruendungshoefeListe([zeile(roh('x'), 3), zeile(roh('y'), null), zeile(roh('z'), 1), zeile(roh('v', { approvedAt: null }), null)])
    expect(liste.map((h) => h.id)).toEqual(['z', 'x'])
  })
})

describe('Reiter-Zustand aus der Adresse', () => {
  const parameter = (wert: string | null) => ({ get: (name: string) => (name === 'reiter' ? wert : null) })

  it('ein bekannter Reiter wird gelesen', () => {
    for (const id of HOEFE_REITER_IDS) expect(hoefeReiterAus(parameter(id))).toBe(id)
  })

  it('Gegenprobe: unbekannt oder fehlend ist „kein Reiter gewählt“ — nie ein Fehler', () => {
    expect(hoefeReiterAus(parameter('unsinn'))).toBeNull()
    expect(hoefeReiterAus(parameter('WARTEN'))).toBeNull()
    expect(hoefeReiterAus(parameter(''))).toBeNull()
    expect(hoefeReiterAus(parameter(null))).toBeNull()
  })

  it('ohne Wahl: Warten, solange jemand wartet, sonst Alle Höfe; eine Wahl bleibt, wie sie ist', () => {
    expect(waehleHoefeReiter(null, 2)).toBe('warten')
    expect(waehleHoefeReiter(null, 0)).toBe('alle')
    expect(waehleHoefeReiter('alle', 2)).toBe('alle')
    expect(waehleHoefeReiter('warten', 0)).toBe('warten')
    expect(waehleHoefeReiter('gruendung', 5)).toBe('gruendung')
  })

  it('die Adressen tragen reiter; der Filter nur im Reiter „Alle Höfe“, die Suche überall', () => {
    expect(hoefeSeitenAdresse({ reiter: 'warten', filter: 'alle', suche: '' })).toBe('/admin?reiter=warten')
    expect(hoefeSeitenAdresse({ reiter: 'alle', filter: 'pausiert', suche: '' })).toBe('/admin?reiter=alle&filter=pausiert')
    expect(hoefeSeitenAdresse({ reiter: 'gruendung', filter: 'pausiert', suche: ' lind ' })).toBe('/admin?reiter=gruendung&suche=lind')
  })

  it('die Pillen: Zahl und Adresse je Reiter, der Gründungshof-Reiter als „7 / 12“', () => {
    const pillen = hoefeUnterreiter({ wartende: 2, alle: 4, gruendungshoefe: 7, maxPlaetze: MAX, suche: '' })
    expect(pillen.map((p) => [p.id, p.label, p.zahl, p.href])).toEqual([
      ['warten', 'Warten auf Freischaltung', '2', '/admin?reiter=warten'],
      ['alle', 'Alle Höfe', '4', '/admin?reiter=alle'],
      ['gruendung', 'Gründungshöfe', '7 / 12', '/admin?reiter=gruendung'],
    ])
    expect(pillen.map((p) => p.labelKurz)).toEqual(['Warten', 'Alle', undefined])
  })

  it('die Suche geht beim Wechsel des Reiters mit', () => {
    const pillen = hoefeUnterreiter({ wartende: 0, alle: 4, gruendungshoefe: 7, maxPlaetze: MAX, suche: 'moor' })
    expect(pillen.every((p) => p.href.endsWith('&suche=moor'))).toBe(true)
  })
})
