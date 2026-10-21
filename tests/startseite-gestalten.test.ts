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
 *  - Die Listen der Arten und Vorlagen decken genau die Prisma-Enums ab.
 *  - Zusatz-Abschnitt „Neu bei den Höfen“ (Nr. 129, N16): erlaubt, nicht
 *    verlangt, höchstens einmal, nur nach HOEFE und vor FUSS; Auswahl der
 *    Reihe (ein Beitrag je Hof, höchstens sechs) und was der Browser ausblendet.
 */
import { describe, expect, it } from 'vitest'
import { StartseiteArt, StartseiteVorlage } from '@prisma/client'
import {
  NEUER_ABSCHNITT,
  NEUIGKEITEN_MAX,
  STANDARD_REIHENFOLGE,
  VORLAGEN,
  ZUSATZ_ARTEN,
  darfVerschieben,
  neueZusatzArt,
  sichtbareNeuigkeiten,
  waehleNeuigkeiten,
  istLive,
  istRelativerLink,
  pruefeReihenfolge,
  standZeitpunkt,
  standardZeilen,
  verschiebe,
  wienerEingabe,
  zeitpunktAusEingabe,
  zuRendern,
  type ListenEintrag,
  type StartseitenBlockDaten,
  type StartseitenZeile,
} from '@/lib/startseite-gestalten'
import { STARTSEITE_SAETZE, startseitenBlockSchema, type StartseitenBlockEingabe } from '@/schemas/startseite'

describe('Arten und Vorlagen', () => {
  it('kennen genau die Werte der Prisma-Enums — ein neuer Wert fällt sofort auf', () => {
    expect([...VORLAGEN].sort()).toEqual(Object.values(StartseiteVorlage).sort())
    expect([...STANDARD_REIHENFOLGE, ...ZUSATZ_ARTEN, 'BLOCK'].sort()).toEqual(Object.values(StartseiteArt).sort())
  })
})

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

  it('Zusatz „Neu bei den Höfen“: ohne gültig, mit gültig — an jeder Stelle nach den Höfen und vor dem Fuß, auch ausgeblendet', () => {
    const NEU: ListenEintrag = { art: 'NEUIGKEITEN', sichtbar: true }
    expect(pruefeReihenfolge(standard())).toBeNull()
    const liste = standard()
    for (let stelle = 2; stelle < liste.length; stelle++) {
      const mit = [...liste.slice(0, stelle), NEU, ...liste.slice(stelle)]
      expect(pruefeReihenfolge(mit), `Stelle ${stelle}`).toBeNull()
      expect(pruefeReihenfolge(mit.map((e) => (e.art === 'NEUIGKEITEN' ? { ...e, sichtbar: false } : e)))).toBeNull()
    }
    // Mit einem Block zwischen Kopf und Höfen.
    expect(pruefeReihenfolge([liste[0], BLOCK, liste[1], NEU, ...liste.slice(2)])).toBeNull()
  })

  it('Zusatz höchstens einmal und nie vor den Höfen, nie über dem Kopf, nie unter dem Fuß', () => {
    const NEU: ListenEintrag = { art: 'NEUIGKEITEN', sichtbar: true }
    const liste = standard()
    expect(pruefeReihenfolge([...liste.slice(0, 2), NEU, NEU, ...liste.slice(2)])).toBe('abschnitt-doppelt')
    expect(pruefeReihenfolge([...liste.slice(0, 2), NEU, ...liste.slice(2, 5), NEU, ...liste.slice(5)])).toBe('abschnitt-doppelt')
    expect(pruefeReihenfolge([liste[0], NEU, ...liste.slice(1)])).toBe('hoefe-nicht-unter-kopf')
    expect(pruefeReihenfolge([NEU, ...liste])).toBe('kopf-nicht-oben')
    expect(pruefeReihenfolge([...liste, NEU])).toBe('fuss-nicht-unten')
  })

  it('der Zusatz lässt sich verschieben, aber nicht über die Höfe', () => {
    const liste: ListenEintrag[] = [...standard().slice(0, 2), { art: 'NEUIGKEITEN', sichtbar: true }, ...standard().slice(2)]
    expect(darfVerschieben(liste, 2, 1)).toBe(true)
    expect(darfVerschieben(liste, 2, -1)).toBe(false)
  })

  it('die Kennung eines hinzugefügten Zusatzes führt zur Art zurück, jede andere nicht', () => {
    for (const art of ZUSATZ_ARTEN) expect(neueZusatzArt(NEUER_ABSCHNITT[art])).toBe(art)
    expect(neueZusatzArt('neu')).toBeNull()
    expect(neueZusatzArt('NEUIGKEITEN')).toBeNull()
    expect(neueZusatzArt('startseite-kopf')).toBeNull()
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

describe('zeitpunktAusEingabe', () => {
  it('rechnet im Winter mit einer Stunde Vorsprung, im Sommer mit zwei', () => {
    expect(zeitpunktAusEingabe('2026-12-01', '06:00')?.toISOString()).toBe('2026-12-01T05:00:00.000Z')
    expect(zeitpunktAusEingabe('2027-07-01', '06:00')?.toISOString()).toBe('2027-07-01T04:00:00.000Z')
  })

  it('trifft an den Tagen der Umstellung die Wiener Uhrzeit', () => {
    // 28. März 2027: um 2 Uhr springt die Uhr auf 3 Uhr.
    expect(zeitpunktAusEingabe('2027-03-28', '01:30')?.toISOString()).toBe('2027-03-28T00:30:00.000Z')
    expect(zeitpunktAusEingabe('2027-03-28', '06:00')?.toISOString()).toBe('2027-03-28T04:00:00.000Z')
    // 31. Oktober 2027: um 3 Uhr zurück auf 2 Uhr.
    expect(zeitpunktAusEingabe('2027-10-31', '06:00')?.toISOString()).toBe('2027-10-31T05:00:00.000Z')
    expect(zeitpunktAusEingabe('2027-10-31', '00:30')?.toISOString()).toBe('2027-10-30T22:30:00.000Z')
  })

  it('kennt die fehlende Stunde Ende März nicht und nimmt keinen Unsinn', () => {
    expect(zeitpunktAusEingabe('2027-03-28', '02:30')).toBeNull()
    expect(zeitpunktAusEingabe('2027-02-30', '06:00')).toBeNull()
    expect(zeitpunktAusEingabe('2027-03-01', '24:00')).toBeNull()
    expect(zeitpunktAusEingabe('2027-03-01', '6:00')).toBeNull()
  })

  it('geht mit wienerEingabe hin und zurück', () => {
    const zeitpunkt = new Date('2027-04-06T21:59:00.000Z')
    expect(wienerEingabe(zeitpunkt)).toEqual({ tag: '2027-04-06', uhrzeit: '23:59' })
    const { tag, uhrzeit } = wienerEingabe(zeitpunkt)
    expect(zeitpunktAusEingabe(tag, uhrzeit)?.toISOString()).toBe(zeitpunkt.toISOString())
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

  it('nimmt als „geplanter Termin“ den Termin der nächsten Fassung — ohne Planung keinen', () => {
    const termin = new Date('2026-10-17T07:00:00Z')
    expect(standZeitpunkt('termin', JETZT, [], termin)).toBe(termin)
    expect(standZeitpunkt('termin', JETZT, [])).toBeNull()
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

  it('sperrt „//“ auch mitten im Link (Nr. 99, Nacharbeit 96)', () => {
    for (const link of ['/hoefe//fremd.example', '/a/b//', '/hoefe?ziel=//fremd.example']) expect(istRelativerLink(link), link).toBe(false)
    expect(istRelativerLink('/hoefe/a/b')).toBe(true)
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

describe('„Neu bei den Höfen“ — Auswahl und Anzeige (Nr. 129, N16)', () => {
  const beitrag = (id: string, slug: string) => ({ id, hof: { slug } })

  it('höchstens ein Beitrag je Hof — der erste (neueste) bleibt, die Reihenfolge der Zeit auch', () => {
    const liste = [beitrag('a1', 'hof-a'), beitrag('b1', 'hof-b'), beitrag('a2', 'hof-a'), beitrag('c1', 'hof-c')]
    expect(waehleNeuigkeiten(liste).map((b) => b.id)).toEqual(['a1', 'b1', 'c1'])
  })

  it('höchstens sechs, auch bei mehr Höfen', () => {
    const liste = Array.from({ length: 9 }, (_, i) => beitrag(`b${i}`, `hof-${i}`))
    expect(NEUIGKEITEN_MAX).toBe(6)
    expect(waehleNeuigkeiten(liste).map((b) => b.id)).toEqual(['b0', 'b1', 'b2', 'b3', 'b4', 'b5'])
  })

  it('leer bleibt leer', () => {
    expect(waehleNeuigkeiten([])).toEqual([])
  })

  it('der Browser blendet Abgelaufenes und über 14 Tage Altes aus — auf die Millisekunde', () => {
    const jetzt = new Date('2026-10-20T10:00:00.000Z')
    const n = (id: string, veroeffentlicht: string, endet: string | null) => ({ id, veroeffentlicht, endet })
    const liste = [
      n('ohne-ende', '2026-10-19T10:00:00.000Z', null),
      n('endet-gleich', '2026-10-19T10:00:00.000Z', '2026-10-20T10:00:00.000Z'),
      n('endet-danach', '2026-10-19T10:00:00.000Z', '2026-10-20T10:00:00.001Z'),
      n('genau-14-tage', '2026-10-06T10:00:00.000Z', null),
      n('zu-alt', '2026-10-06T09:59:59.999Z', null),
    ]
    expect(sichtbareNeuigkeiten(liste, jetzt).map((x) => x.id)).toEqual(['ohne-ende', 'endet-danach', 'genau-14-tage'])
  })
})
