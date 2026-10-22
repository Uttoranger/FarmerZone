/**
 * Die Zustandszeile im Kopf von Mein Hof am Handy (Nachtlauf Nr. 143, Register N3,
 * Ergänzung 22.10.2026; Board system-h1-mein-hof-v3, Baustein „Zustandszeile“).
 *
 * Beweist:
 *  - zustandsZeile in allen Fällen und in dieser Reihenfolge: stillgelegt und
 *    „wartet“ → null (das sagt der Balken), aus → grau ohne Knopf, pausiert →
 *    Fortsetzen, keine Abholzeit → Eintragen, ausgebucht → Abholzeiten, kein
 *    kaufbares Produkt → Produkte, sonst grün mit der nächsten Abholung.
 *  - Titel aus derselben Quelle wie /hoefe, der Vorlauf wie in der Karte der Kundin.
 *  - ladeMeinHofZustand rechnet mit fester Uhr dieselben Fenster wie die Kasse:
 *    volle Tage aus `ausgebuchtAm` machen „ausgebucht“, ein volles Fenster wird bei der
 *    nächsten Abholung übersprungen, `istKaufbar` entscheidet „kaufbar“, und der
 *    Zustand folgt der Bedingung des Balkens (isActive false ohne Freigabe → wartet).
 * Jeder Fall mit Gegenprobe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn() } } }))
vi.mock('@/server/abholfenster', async (original) => ({
  ...(await original<typeof import('@/server/abholfenster')>()),
  ausgebuchteTage: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { ausgebuchteTage } from '@/server/abholfenster'
import { ladeMeinHofZustand } from '@/server/mein-hof-zustand'
import { ZUSTANDSZEILE_TEXT, zustandsZeile, hofZustand } from '@/lib/mein-hof'
import { ABHOLZEILE_TEXT, type NaechsteAbholung } from '@/lib/hofuebersicht'
import { kaufSperreHinweis } from '@/lib/bereiche-anzeige'

// Donnerstag, 22. Oktober 2026, 10:00 in Wien (Sommerzeit, UTC+2).
const JETZT = new Date('2026-10-22T08:00:00Z')
const FREITAG: NaechsteAbholung = { dayOfWeek: 5, startTime: '15:00', endTime: '18:00', tageVoraus: 1, kalendertag: '2026-10-23' }
const OFFEN = { zustand: 'sichtbar' as const, sperre: null, naechste: FREITAG, kaufbar: true }

describe('zustandsZeile', () => {
  it('nimmt Bestellungen an: grün, nächste Abholung im Hausformat, Knopf „Pausieren“', () => {
    expect(zustandsZeile(OFFEN)).toEqual({
      ton: 'gruen',
      titel: 'Nimmt Bestellungen an',
      satz: 'Nächste Abholung: Morgen 15:00–18:00',
      knopf: { art: 'pausieren', text: 'Pausieren' },
    })
  })

  it('stillgelegt und „wartet auf Freigabe“: keine Zeile — das sagt der Balken über jeder Seite', () => {
    expect(zustandsZeile({ ...OFFEN, zustand: 'stillgelegt' })).toBeNull()
    expect(zustandsZeile({ ...OFFEN, zustand: 'wartet' })).toBeNull()
    // Gegenprobe: „aus“ (freigeschaltet, aber nicht aktiv) zeigt der Balken nicht — grau, ohne Knopf.
    expect(zustandsZeile({ ...OFFEN, zustand: 'aus' })).toEqual({
      ton: 'grau',
      titel: 'Noch nicht freigegeben',
      satz: 'Kundinnen sehen deinen Hof nach der Freigabe.',
      knopf: null,
    })
  })

  it('pausiert sticht alles andere: orange, „Fortsetzen“', () => {
    const zeile = zustandsZeile({ ...OFFEN, zustand: 'pausiert', sperre: 'pause', kaufbar: false })
    expect(zeile).toEqual({ ton: 'orange', titel: 'Pausiert', satz: 'Bestellen kann gerade niemand.', knopf: { art: 'fortsetzen', text: 'Fortsetzen' } })
    // Gegenprobe: ohne Pause ist es wieder die grüne Zeile.
    expect(zustandsZeile(OFFEN)?.knopf?.art).toBe('pausieren')
  })

  it('ohne Abholzeit: „Noch nicht bestellbar“ wie auf /hoefe, Knopf „Eintragen“ — vor „kein Produkt“', () => {
    const zeile = zustandsZeile({ ...OFFEN, sperre: 'keine-abholzeit', naechste: null, kaufbar: false })
    expect(zeile).toEqual({
      ton: 'orange',
      titel: ABHOLZEILE_TEXT.nichtBestellbar,
      satz: 'Es fehlen Abholzeiten.',
      knopf: { art: 'eintragen', text: 'Eintragen' },
    })
  })

  it('ausgebucht: der Satz nennt den Vorlauf wie die Karte der Kundin, Knopf „Abholzeiten“', () => {
    const zeile = zustandsZeile({ ...OFFEN, sperre: 'ausgebucht', naechste: null })
    expect(zeile).toEqual({
      ton: 'orange',
      titel: 'Gerade ausgebucht',
      satz: 'Alle Abholzeiten der nächsten 2 Wochen sind voll.',
      knopf: { art: 'abholzeiten', text: 'Abholzeiten' },
    })
    // Derselbe Vorlauf-Text wie bei der Kundin, nicht nachgebaut.
    expect(kaufSperreHinweis('ausgebucht', 'Testhof A').satz).toContain(ZUSTANDSZEILE_TEXT.ausgebucht.satz.replace(/\.$/, ''))
  })

  it('kein kaufbares Produkt: „Noch nicht bestellbar“, Knopf „Produkte“ — wie die Hofliste', () => {
    const zeile = zustandsZeile({ ...OFFEN, kaufbar: false })
    expect(zeile).toEqual({
      ton: 'orange',
      titel: ABHOLZEILE_TEXT.nichtBestellbar,
      satz: 'Kein Produkt ist gerade zu kaufen.',
      knopf: { art: 'produkte', text: 'Produkte' },
    })
    expect(zustandsZeile({ ...OFFEN, kaufbar: true })?.ton).toBe('gruen')
  })
})

const findUnique = vi.mocked(prisma.farm.findUnique)
const volle = vi.mocked(ausgebuchteTage)

function hof(teile: Record<string, unknown> = {}) {
  return {
    isActive: true,
    isPaused: false,
    approvedAt: new Date('2026-09-01T10:00:00Z'),
    archivedAt: null,
    pauseMessage: null,
    pickupSlots: [{ dayOfWeek: 5, startTime: '15:00', endTime: '18:00' }],
    products: [{ isAvailable: true, stock: 5, reservedStock: 0 }],
    ...teile,
  }
}

/** Die vollen Freitage des Hofs, wie ausgebuchteTage sie liefert. */
function freitageVoll(...tage: string[]) {
  return new Map([['hof-1', new Map([['5|15:00|18:00', { dayOfWeek: 5, startTime: '15:00', endTime: '18:00', ausgebuchtAm: tage }]])]])
}

describe('ladeMeinHofZustand (feste Uhr: Donnerstag 10:00 in Wien)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    volle.mockResolvedValue(new Map())
  })

  async function zeile() {
    const zustand = await ladeMeinHofZustand('hof-1', JETZT)
    return zustand && zustandsZeile(zustand)
  }

  it('nimmt an: morgen ist Freitag', async () => {
    findUnique.mockResolvedValue(hof() as never)
    expect((await zeile())?.satz).toBe('Nächste Abholung: Morgen 15:00–18:00')
    expect(volle).toHaveBeenCalledWith(['hof-1'], JETZT)
  })

  it('überspringt ein volles Fenster wie die Abholzeile der Kundin', async () => {
    findUnique.mockResolvedValue(hof() as never)
    volle.mockResolvedValue(freitageVoll('2026-10-23') as never)
    expect((await zeile())?.satz).toBe('Nächste Abholung: Fr, 30. Okt 15:00–18:00')
  })

  it('alle Termine im Vorlauf voll → „Gerade ausgebucht“', async () => {
    findUnique.mockResolvedValue(hof() as never)
    volle.mockResolvedValue(freitageVoll('2026-10-23', '2026-10-30') as never)
    const zustand = await ladeMeinHofZustand('hof-1', JETZT)
    expect(zustand?.sperre).toBe('ausgebucht')
    expect(zustand && zustandsZeile(zustand)?.knopf?.art).toBe('abholzeiten')
  })

  it('ohne aktive Abholzeit → „Eintragen“; nur aktive zählen (die Abfrage filtert)', async () => {
    findUnique.mockResolvedValue(hof({ pickupSlots: [] }) as never)
    const zustand = await ladeMeinHofZustand('hof-1', JETZT)
    expect(zustand?.abholzeitAktiv).toBe(false)
    expect(zustand && zustandsZeile(zustand)?.knopf?.art).toBe('eintragen')
    const abfrage = findUnique.mock.calls[0][0] as { select: { pickupSlots: { where: unknown } } }
    expect(abfrage.select.pickupSlots.where).toEqual({ isActive: true })
  })

  it('kaufbar nach istKaufbar: reservierter Vorrat zählt nicht', async () => {
    findUnique.mockResolvedValue(hof({ products: [{ isAvailable: true, stock: 3, reservedStock: 3 }] }) as never)
    expect((await zeile())?.knopf?.art).toBe('produkte')
    findUnique.mockResolvedValue(hof({ products: [{ isAvailable: true, stock: 3, reservedStock: 2 }] }) as never)
    expect((await zeile())?.knopf?.art).toBe('pausieren')
  })

  it('pausiert: „Fortsetzen“ und die gespeicherte Nachricht', async () => {
    findUnique.mockResolvedValue(hof({ isPaused: true, pauseMessage: 'Bis Montag zu.' }) as never)
    const zustand = await ladeMeinHofZustand('hof-1', JETZT)
    expect(zustand?.pauseMessage).toBe('Bis Montag zu.')
    expect(zustand && zustandsZeile(zustand)?.knopf?.art).toBe('fortsetzen')
  })

  it('folgt dem Balken: nicht aktiv und nicht freigeschaltet → „wartet“, keine Zeile', async () => {
    const roh = hof({ isActive: false, approvedAt: null })
    findUnique.mockResolvedValue(roh as never)
    const zustand = await ladeMeinHofZustand('hof-1', JETZT)
    expect(zustand?.zustand).toBe('wartet')
    expect(zustand && zustandsZeile(zustand)).toBeNull()
    // Gegenprobe: hofZustand allein sagte „aus“ — dann stünde der Zustand zweimal da.
    expect(hofZustand(roh).art).toBe('aus')
    // Stillgelegt sticht wie im Balken.
    findUnique.mockResolvedValue(hof({ archivedAt: new Date('2026-10-01T10:00:00Z') }) as never)
    expect((await ladeMeinHofZustand('hof-1', JETZT))?.zustand).toBe('stillgelegt')
    // Freigeschaltet, aber nicht aktiv: grau.
    findUnique.mockResolvedValue(hof({ isActive: false }) as never)
    expect((await zeile())?.ton).toBe('grau')
  })
})
