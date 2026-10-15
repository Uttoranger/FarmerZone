/**
 * Startseite gestalten (Register N16, Nr. 96) — die reinen Regeln aus
 * src/lib/startseite-gestalten.ts und das Schema des Blocks, ohne Datenbank.
 *
 * Beweist:
 *  - Reihenfolge: KOPF zuerst, FUSS zuletzt, HOEFE als erster Abschnitt unter
 *    dem Kopf (Blöcke dürfen dazwischen), jeder Abschnitt genau einmal, feste
 *    nie ausgeblendet; feste lassen sich nicht verschieben, andere nicht über
 *    KOPF/HOEFE oder unter FUSS.
 *  - Zeitraum: liveAb ≤ jetzt < liveBis, ohne bis offen, auf die Millisekunde.
 *  - Wiener Zeit: Tag + Uhrzeit → Zeitpunkt im Winter (+1) und Sommer (+2),
 *    an den Tagen der Umstellung, die fehlende Stunde Ende März ist ungültig.
 *  - Was die Seite rendert: ohne Zeilen die heutige Reihenfolge, eine kaputte
 *    Liste ebenso, Brennmaterial nur in der Saison, Blöcke nur im Zeitraum
 *    (außer dem Block in Bearbeitung der Vorschau), Ausgeblendetes nie.
 *  - Link nur relativ; Grenzen und Pflichtfelder je Vorlage im Schema.
 */
import { describe, expect, it } from 'vitest'
import {
  STANDARD_REIHENFOLGE,
  darfVerschieben,
  istLive,
  istRelativerLink,
  pruefeReihenfolge,
  standZeitpunkt,
  standardZeilen,
  verschiebe,
  wienerEingabe,
  wienerZeitpunkt,
  zuRendern,
  type ListenEintrag,
  type StartseitenBlockDaten,
  type StartseitenZeile,
} from '@/lib/startseite-gestalten'
import { STARTSEITE_SAETZE, startseitenBlockSchema, type StartseitenBlockEingabe } from '@/schemas/startseite'

const standard = (): ListenEintrag[] => STANDARD_REIHENFOLGE.map((art) => ({ art, sichtbar: true }))
const BLOCK: ListenEintrag = { art: 'BLOCK', sichtbar: true }

function block(teil: Partial<StartseitenBlockDaten> = {}): StartseitenBlockDaten {
  return {
    id: 'block-1',
    vorlage: 'SAISONKARTE',
    ueberzeile: null,
    titel: 'Erntezeit am Hof',
    text: null,
    bildUrl: null,
    linkUrl: null,
    linkText: null,
    hofSlugs: [],
    kategorie: null,
    liveAb: '2026-10-01T04:00:00.000Z',
    liveBis: '2026-10-31T23:00:00.000Z',
    ...teil,
  }
}

describe('pruefeReihenfolge', () => {
  it('nimmt die heutige Reihenfolge und Blöcke zwischen Kopf und Höfe an', () => {
    expect(pruefeReihenfolge(standard())).toBeNull()
    const mitBlock = [standard()[0], BLOCK, ...standard().slice(1)]
    expect(pruefeReihenfolge(mitBlock)).toBeNull()
  })

  it('verlangt den Kopf ganz oben und den Fuß ganz unten — auch ein Block darf nicht davor oder danach', () => {
    expect(pruefeReihenfolge([BLOCK, ...standard()])).toBe('kopf-nicht-oben')
    expect(pruefeReihenfolge([...standard(), BLOCK])).toBe('fuss-nicht-unten')
  })

  it('lässt keinen Abschnitt zwischen Kopf und Höfe', () => {
    const liste = standard()
    expect(pruefeReihenfolge(verschiebe(liste, 2, -1))).toBe('hoefe-nicht-unter-kopf')
  })

  it('verlangt jeden Abschnitt genau einmal', () => {
    expect(pruefeReihenfolge(standard().filter((e) => e.art !== 'FRAGEN'))).toBe('abschnitt-fehlt')
    const doppelt = standard()
    doppelt.splice(3, 0, { art: 'FUTTER', sichtbar: true })
    expect(pruefeReihenfolge(doppelt)).toBe('abschnitt-doppelt')
  })

  it('lässt Kopf, Höfe und Fuß nicht ausblenden, alle anderen schon', () => {
    for (const art of ['KOPF', 'HOEFE', 'FUSS'] as const) {
      expect(pruefeReihenfolge(standard().map((e) => (e.art === art ? { ...e, sichtbar: false } : e))), art).toBe('fest-ausgeblendet')
    }
    for (const art of ['FUTTER', 'BRENNMATERIAL', 'SO_FUNKTIONIERTS', 'FUER_HOEFE', 'FRAGEN'] as const) {
      expect(pruefeReihenfolge(standard().map((e) => (e.art === art ? { ...e, sichtbar: false } : e))), art).toBeNull()
    }
  })
})

describe('darfVerschieben', () => {
  it('bewegt feste Abschnitte nie', () => {
    const liste = standard()
    expect(darfVerschieben(liste, 0, 1)).toBe(false) // KOPF
    expect(darfVerschieben(liste, 1, 1)).toBe(false) // HOEFE
    expect(darfVerschieben(liste, 7, -1)).toBe(false) // FUSS
  })

  it('lässt Futter nicht über die Höfe und Fragen nicht unter den Fuß', () => {
    const liste = standard()
    expect(darfVerschieben(liste, 2, -1)).toBe(false)
    expect(darfVerschieben(liste, 6, 1)).toBe(false)
    expect(darfVerschieben(liste, 2, 1)).toBe(true)
  })

  it('lässt einen Block zwischen Kopf und Höfe wandern, aber nie über den Kopf', () => {
    const liste = [standard()[0], standard()[1], BLOCK, ...standard().slice(2)]
    expect(darfVerschieben(liste, 2, -1)).toBe(true)
    const oben = verschiebe(liste, 2, -1)
    expect(darfVerschieben(oben, 1, -1)).toBe(false)
  })
})

describe('istLive', () => {
  const zeitraum = { liveAb: new Date('2026-12-01T05:00:00Z'), liveBis: new Date('2026-12-24T22:59:00Z') }

  it('gilt ab liveAb genau — eine Millisekunde davor noch nicht', () => {
    expect(istLive(zeitraum, new Date('2026-12-01T04:59:59.999Z'))).toBe(false)
    expect(istLive(zeitraum, new Date('2026-12-01T05:00:00.000Z'))).toBe(true)
  })

  it('endet vor liveBis — eine Millisekunde davor noch live, genau dann nicht mehr', () => {
    expect(istLive(zeitraum, new Date('2026-12-24T22:58:59.999Z'))).toBe(true)
    expect(istLive(zeitraum, new Date('2026-12-24T22:59:00.000Z'))).toBe(false)
  })

  it('bleibt ohne liveBis offen', () => {
    expect(istLive({ liveAb: zeitraum.liveAb, liveBis: null }, new Date('2030-01-01T00:00:00Z'))).toBe(true)
  })
})

describe('wienerZeitpunkt', () => {
  it('rechnet im Winter mit einer Stunde Vorsprung, im Sommer mit zwei', () => {
    expect(wienerZeitpunkt('2026-12-01', '06:00')?.toISOString()).toBe('2026-12-01T05:00:00.000Z')
    expect(wienerZeitpunkt('2027-07-01', '06:00')?.toISOString()).toBe('2027-07-01T04:00:00.000Z')
  })

  it('trifft an den Tagen der Umstellung die Wiener Uhrzeit', () => {
    // 28. März 2027: um 2 Uhr springt die Uhr auf 3 Uhr.
    expect(wienerZeitpunkt('2027-03-28', '01:30')?.toISOString()).toBe('2027-03-28T00:30:00.000Z')
    expect(wienerZeitpunkt('2027-03-28', '06:00')?.toISOString()).toBe('2027-03-28T04:00:00.000Z')
    // 31. Oktober 2027: um 3 Uhr zurück auf 2 Uhr.
    expect(wienerZeitpunkt('2027-10-31', '06:00')?.toISOString()).toBe('2027-10-31T05:00:00.000Z')
    expect(wienerZeitpunkt('2027-10-31', '00:30')?.toISOString()).toBe('2027-10-30T22:30:00.000Z')
  })

  it('kennt die fehlende Stunde Ende März nicht und nimmt keinen Unsinn', () => {
    expect(wienerZeitpunkt('2027-03-28', '02:30')).toBeNull()
    expect(wienerZeitpunkt('2027-02-30', '06:00')).toBeNull()
    expect(wienerZeitpunkt('2027-03-01', '24:00')).toBeNull()
    expect(wienerZeitpunkt('2027-03-01', '6:00')).toBeNull()
  })

  it('geht mit wienerEingabe hin und zurück', () => {
    const zeitpunkt = new Date('2027-04-06T21:59:00.000Z')
    expect(wienerEingabe(zeitpunkt)).toEqual({ tag: '2027-04-06', uhrzeit: '23:59' })
    const { tag, uhrzeit } = wienerEingabe(zeitpunkt)
    expect(wienerZeitpunkt(tag, uhrzeit)?.toISOString()).toBe(zeitpunkt.toISOString())
  })
})

describe('zuRendern', () => {
  const JETZT = new Date('2026-10-15T10:00:00Z')
  const optionen = { brennmaterialSaison: true }

  it('rendert ohne Zeilen die heutige Reihenfolge (Deploy-Fenster, Lesefehler)', () => {
    expect(zuRendern([], JETZT, optionen).map((e) => e.art)).toEqual([...STANDARD_REIHENFOLGE])
  })

  it('fällt bei einer kaputten Liste auf die heutige Reihenfolge zurück — Kopf, Höfe und Fuß fehlen nie', () => {
    const ohneKopf = standardZeilen().filter((z) => z.art !== 'KOPF')
    expect(zuRendern(ohneKopf, JETZT, optionen).map((e) => e.art)).toEqual([...STANDARD_REIHENFOLGE])
    const kopfAus = standardZeilen().map((z) => (z.art === 'KOPF' ? { ...z, sichtbar: false } : z))
    expect(zuRendern(kopfAus, JETZT, optionen).map((e) => e.art)).toEqual([...STANDARD_REIHENFOLGE])
    // Gegenprobe: eine gültige Liste in anderer Reihenfolge bleibt, wie sie ist.
    const getauscht = verschiebe(standardZeilen(), 2, 1)
    expect(zuRendern(getauscht, JETZT, optionen).map((e) => e.art)).toEqual(getauscht.map((z) => z.art))
  })

  it('zeigt Brennmaterial nur in der Saison — auch wenn das Auge an ist', () => {
    expect(zuRendern(standardZeilen(), JETZT, { brennmaterialSaison: false }).map((e) => e.art)).not.toContain('BRENNMATERIAL')
    expect(zuRendern(standardZeilen(), JETZT, { brennmaterialSaison: true }).map((e) => e.art)).toContain('BRENNMATERIAL')
  })

  it('lässt Ausgeblendetes weg', () => {
    const ohneFragen = standardZeilen().map((z) => (z.art === 'FRAGEN' ? { ...z, sichtbar: false } : z))
    expect(zuRendern(ohneFragen, JETZT, optionen).map((e) => e.art)).not.toContain('FRAGEN')
  })

  it('zeigt Blöcke nur im Zeitraum, den Block in Bearbeitung der Vorschau immer', () => {
    const zeilen: StartseitenZeile[] = [
      standardZeilen()[0],
      { art: 'BLOCK', sichtbar: true, block: block({ id: 'jetzt' }) },
      { art: 'BLOCK', sichtbar: true, block: block({ id: 'spaeter', liveAb: '2027-03-26T05:00:00.000Z', liveBis: null }) },
      { art: 'BLOCK', sichtbar: false, block: block({ id: 'aus' }) },
      ...standardZeilen().slice(1),
    ]
    const ids = (blockEntwurfId: string | null) =>
      zuRendern(zeilen, JETZT, { ...optionen, blockEntwurfId }).flatMap((e) => (e.art === 'BLOCK' ? [e.block.id] : []))
    expect(ids(null)).toEqual(['jetzt'])
    expect(ids('spaeter')).toEqual(['jetzt', 'spaeter'])
    // Am 27. März 2027 ist der geplante Block live, der vom Oktober vorbei.
    const maerz = zuRendern(zeilen, new Date('2027-03-27T09:00:00Z'), optionen).flatMap((e) => (e.art === 'BLOCK' ? [e.block.id] : []))
    expect(maerz).toEqual(['spaeter'])
  })
})

describe('standZeitpunkt', () => {
  const JETZT = new Date('2026-10-15T10:00:00Z')

  it('nimmt heute, denselben Wiener Tag in einer Woche und den Beginn des nächsten geplanten Blocks', () => {
    expect(standZeitpunkt('heute', JETZT, [])).toBe(JETZT)
    expect(standZeitpunkt('woche', JETZT, [])?.toISOString()).toBe('2026-10-22T10:00:00.000Z')
    const bloecke = [
      { liveAb: new Date('2026-10-01T00:00:00Z'), liveBis: null },
      { liveAb: new Date('2026-12-01T05:00:00Z'), liveBis: null },
      { liveAb: new Date('2026-11-02T05:00:00Z'), liveBis: null },
    ]
    expect(standZeitpunkt('block', JETZT, bloecke)?.toISOString()).toBe('2026-11-02T05:00:00.000Z')
    expect(standZeitpunkt('block', JETZT, [bloecke[0]])).toBeNull()
  })

  it('hält über die Zeitumstellung dieselbe Wiener Uhrzeit (+1 Woche)', () => {
    // 28. Oktober 2026, 12:00 in Wien (Sommerzeit) → 4. November, 12:00 (Winterzeit).
    expect(standZeitpunkt('woche', new Date('2026-10-28T11:00:00Z'), [])?.toISOString()).toBe('2026-11-04T11:00:00.000Z')
  })
})

describe('istRelativerLink', () => {
  it('nimmt Pfade der eigenen Seite', () => {
    for (const link of ['/', '/hoefe', '/hoefe?kategorien=EIER', '/fuer-hoefe#preise']) expect(istRelativerLink(link), link).toBe(true)
  })

  it('weist fremde Adressen und Tricks ab', () => {
    for (const link of ['//fremd.example', '/\\fremd.example', 'https://fremd.example', 'hoefe', '/ hoefe', 'javascript:alert(1)', `/${'a'.repeat(200)}`]) {
      expect(istRelativerLink(link), link).toBe(false)
    }
  })
})

describe('startseitenBlockSchema', () => {
  const gueltig = (teil: Partial<StartseitenBlockEingabe> = {}): StartseitenBlockEingabe => ({
    vorlage: 'SAISONKARTE',
    ueberzeile: 'Erntezeit',
    titel: 'Kürbis, Äpfel und Most',
    text: '',
    bildUrl: null,
    linkUrl: '',
    linkText: '',
    farmIds: [],
    kategorie: null,
    liveAbTag: '2026-10-01',
    liveAbUhrzeit: '06:00',
    liveBisTag: null,
    liveBisUhrzeit: null,
    ...teil,
  })
  const satz = (teil: Partial<StartseitenBlockEingabe>) => {
    const r = startseitenBlockSchema.safeParse(gueltig(teil))
    return r.success ? null : r.error.issues[0]?.message
  }

  it('nimmt einen gültigen Block und macht Leeres zu null', () => {
    const r = startseitenBlockSchema.safeParse(gueltig())
    expect(r.success && r.data.text).toBeNull()
    expect(r.success && r.data.linkUrl).toBeNull()
  })

  it('hält die Grenzen: Überzeile 24, Titel 60, Text 160', () => {
    expect(satz({ ueberzeile: 'x'.repeat(24) })).toBeNull()
    expect(satz({ ueberzeile: 'x'.repeat(25) })).toBe(STARTSEITE_SAETZE.ueberzeile)
    expect(satz({ titel: 'x'.repeat(61) })).toBe(STARTSEITE_SAETZE.titelLang)
    expect(satz({ titel: '   ' })).toBe(STARTSEITE_SAETZE.titel)
    expect(satz({ text: 'x'.repeat(161) })).toBe(STARTSEITE_SAETZE.text)
  })

  it('nimmt nur relative Links', () => {
    expect(satz({ linkUrl: '//fremd.example' })).toBe(STARTSEITE_SAETZE.link)
    expect(satz({ linkUrl: 'https://fremd.example/hoefe' })).toBe(STARTSEITE_SAETZE.link)
    expect(satz({ linkUrl: '/hoefe' })).toBeNull()
  })

  it('verlangt je Vorlage ihr Pflichtfeld: Höfe (1–3, jeder einmal) bzw. Kategorie', () => {
    expect(satz({ vorlage: 'HOEFE_AUSWAHL', farmIds: [] })).toBe(STARTSEITE_SAETZE.hoefeMin)
    expect(satz({ vorlage: 'HOEFE_AUSWAHL', farmIds: ['a', 'b', 'c', 'd'] })).toBe(STARTSEITE_SAETZE.hoefeMax)
    expect(satz({ vorlage: 'HOEFE_AUSWAHL', farmIds: ['a', 'a'] })).toBe(STARTSEITE_SAETZE.hoefeDoppelt)
    expect(satz({ vorlage: 'KATEGORIE_HINWEIS', kategorie: null })).toBe(STARTSEITE_SAETZE.kategorie)
    expect(satz({ vorlage: 'KATEGORIE_HINWEIS', kategorie: 'EIER' })).toBeNull()
  })

  it('verlangt „bis" nach „ab" und eine Uhrzeit, die es in Wien gibt', () => {
    expect(satz({ liveBisTag: '2026-10-01', liveBisUhrzeit: '06:00' })).toBe(STARTSEITE_SAETZE.bisNachAb)
    expect(satz({ liveBisTag: '2026-10-01', liveBisUhrzeit: '06:01' })).toBeNull()
    expect(satz({ liveAbTag: '2027-03-28', liveAbUhrzeit: '02:30' })).toBe(STARTSEITE_SAETZE.umstellung)
    // Ohne Uhrzeit gilt „bis" bis zum Ende des Tages.
    expect(satz({ liveBisTag: '2026-10-01', liveBisUhrzeit: null })).toBeNull()
  })
})
