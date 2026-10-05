/**
 * Entdecken im neuen Design (/hoefe, Nachtlauf Nr. 09, Gate 4, E2) — die
 * reine Logik in src/lib/hoefe-entdecken.ts: Kategorie-Chips samt
 * Futtermittel und Brennmaterial, die Mengen-Facette, aktive Filter mit
 * „Alle zurücksetzen", Kopf, Produkttreffer und Leerzustand. Jeder Chip ist
 * ein Link: Geprüft wird deshalb, wohin er führt (Ziel-Filter und Adresse),
 * und dass diese Adresse beim Neuladen genau denselben Filter ergibt.
 */
import { describe, it, expect } from 'vitest'
import {
  ENTDECKEN_KOPF,
  KILOPREIS_LABEL,
  MENGE_LABEL,
  MENGEN_HINWEIS,
  aktiveFilter,
  alleZuruecksetzen,
  entdeckenKopf,
  ergebnisZahl,
  futterReihe,
  hoefeHref,
  kategorieReihe,
  leerzustand,
  mengenReihe,
  naechsteUmkreisStufe,
  produktTreffer,
  siegelReihe,
  sortenReihe,
  sortierReihe,
  tierReihe,
  zaehleFilter,
  zeigtProdukte,
} from '@/lib/hoefe-entdecken'
import type { AngebotsProdukt } from '@/lib/bereiche-anzeige'
import { LEERER_HOEFE_FILTER, leseHoefeFilter, type HoefeFilter } from '@/schemas/hoefe-filter'
import { KLEINGEBINDE_BIS_KG, type ProductCategoryValue } from '@/lib/taxonomie'

let laufnummer = 0
function angebot(teil: Partial<AngebotsProdukt> & { name: string; category: ProductCategoryValue | null }): AngebotsProdukt {
  laufnummer += 1
  return {
    id: `p${laufnummer}`,
    subcategory: null,
    labels: [],
    tiere: [],
    grundpreis: null,
    grossgebinde: null,
    price: 4.5,
    unit: 'STUECK',
    unitSize: null,
    imageUrl: null,
    ...teil,
  }
}

function hof(name: string, zeilen: AngebotsProdukt[]) {
  return { slug: name.toLowerCase().replace(/\s+/g, '-'), name, angebot: zeilen }
}

const eier = angebot({ name: 'Freilandeier', category: 'EIER' })
const brot = angebot({ name: 'Bauernbrot', category: 'BROT', labels: ['BIO'] })
const holz = angebot({ name: 'Buche, ofenfertig', category: 'BRENNHOLZ' })
const heuKlein = angebot({ name: 'Heu im Sackerl', category: 'HEU_STROH', grossgebinde: false, grundpreis: { wert: 0.9, einheit: 'KG' } })
const heuBallen = angebot({ name: 'Heu Rundballen', category: 'HEU_STROH', grossgebinde: true, grundpreis: { wert: 0.18, einheit: 'KG' } })
const hafer = angebot({ name: 'Hafer', category: 'GETREIDE_KOERNER', grossgebinde: false, grundpreis: { wert: 0.6, einheit: 'KG' } })

const HOEFE = [hof('Hof Müller', [eier, brot, heuKlein]), hof('Waldhof', [holz, heuBallen, hafer])]

/** Wie die Seite eine Adresse liest: der Query-Teil durch den Parser. */
function neuGeladen(href: string): HoefeFilter {
  const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : ''
  return leseHoefeFilter(new URLSearchParams(query))
}

const futter: HoefeFilter = { ...LEERER_HOEFE_FILTER, bereich: 'FUTTERMITTEL' }

describe('hoefeHref — die Adresse eines Filters', () => {
  it('ohne Filter die nackte /hoefe', () => {
    expect(hoefeHref(LEERER_HOEFE_FILTER)).toBe('/hoefe')
  })

  it('jeder Filter überlebt das Neuladen (Hin- und Rückweg über die Adresse)', () => {
    const voll: HoefeFilter = {
      bereich: 'FUTTERMITTEL',
      kategorien: ['HEU_STROH'],
      sorten: ['WIESENHEU'],
      siegel: ['BIO'],
      tiere: ['PFERD'],
      gebinde: 'KLEIN',
      sortierung: 'GRUNDPREIS',
      suchtext: 'Heu',
      suchMarken: ['Stroh'],
      ansicht: 'karte',
    }
    expect(neuGeladen(hoefeHref(voll))).toEqual(voll)
    const hofladen: HoefeFilter = { ...LEERER_HOEFE_FILTER, kategorien: ['EIER', 'BRENNHOLZ'], siegel: ['BIO'], suchtext: 'Eier' }
    expect(neuGeladen(hoefeHref(hofladen))).toEqual(hofladen)
  })

  it('kein Standort, keine Postleitzahl in der Adresse', () => {
    expect(hoefeHref({ ...futter, suchtext: '5280 Braunau' })).not.toMatch(/lat|lon|umkreis|plz/)
  })
})

describe('kategorieReihe — eine Reihe mit Futtermittel und Brennmaterial (E2)', () => {
  it('Alle zuerst, dann die Hofladen-Kategorien mit Angebot, am Ende Futtermittel und Brennmaterial', () => {
    const reihe = kategorieReihe(HOEFE, LEERER_HOEFE_FILTER)
    expect(reihe.map((c) => c.label)).toEqual(['Alle', 'Eier', 'Brot & Gebäck', 'Futtermittel', 'Brennmaterial'])
    expect(reihe[0]).toMatchObject({ aktiv: true })
    expect(reihe.filter((c) => c.aktiv)).toHaveLength(1)
  })

  it('Futtermittel und Brennmaterial stehen auch ohne Angebot da', () => {
    const reihe = kategorieReihe([hof('Eierhof', [eier])], LEERER_HOEFE_FILTER)
    expect(reihe.map((c) => c.label)).toEqual(['Alle', 'Eier', 'Futtermittel', 'Brennmaterial'])
  })

  it('der Futtermittel-Chip setzt bereich=futter — und die Adresse lädt den Bereich Futtermittel', () => {
    const chip = kategorieReihe(HOEFE, LEERER_HOEFE_FILTER).find((c) => c.label === 'Futtermittel')!
    expect(chip.aktiv).toBe(false)
    expect(chip.ziel.bereich).toBe('FUTTERMITTEL')
    expect(hoefeHref(chip.ziel)).toBe('/hoefe?bereich=futter')
    expect(neuGeladen(hoefeHref(chip.ziel)).bereich).toBe('FUTTERMITTEL')
  })

  it('im Futter ist der Futtermittel-Chip gewählt; ein zweiter Tipp führt zurück in den Hofladen, Siegel und Suche bleiben', () => {
    const imFutter: HoefeFilter = { ...futter, gebinde: 'KLEIN', siegel: ['BIO'], suchtext: 'Heu' }
    const reihe = kategorieReihe(HOEFE, imFutter)
    const chip = reihe.find((c) => c.label === 'Futtermittel')!
    expect(chip.aktiv).toBe(true)
    expect(reihe.find((c) => c.label === 'Alle')!.aktiv).toBe(false)
    expect(chip.ziel).toMatchObject({ bereich: 'LEBENSMITTEL', gebinde: null, siegel: ['BIO'], suchtext: 'Heu' })
  })

  it('Brennmaterial ist die Kategorie BRENNHOLZ im Hofladen — wie der Chip der Startseite', () => {
    const chip = kategorieReihe(HOEFE, LEERER_HOEFE_FILTER).find((c) => c.label === 'Brennmaterial')!
    expect(chip.ziel).toMatchObject({ bereich: 'LEBENSMITTEL', kategorien: ['BRENNHOLZ'] })
    expect(hoefeHref(chip.ziel)).toBe('/hoefe?kat=BRENNHOLZ')
    // Kein zweiter „Brennholz"-Chip aus den Daten daneben.
    expect(kategorieReihe(HOEFE, LEERER_HOEFE_FILTER).filter((c) => c.ziel.kategorien.includes('BRENNHOLZ'))).toHaveLength(1)
  })

  it('eine Kategorie schaltet um: an, dazu eine zweite, wieder ab', () => {
    const an = kategorieReihe(HOEFE, LEERER_HOEFE_FILTER).find((c) => c.label === 'Eier')!.ziel
    expect(an.kategorien).toEqual(['EIER'])
    const zwei = kategorieReihe(HOEFE, an).find((c) => c.label === 'Brot & Gebäck')!.ziel
    expect(zwei.kategorien).toEqual(['EIER', 'BROT'])
    const ab = kategorieReihe(HOEFE, zwei).find((c) => c.label === 'Eier')!
    expect(ab.aktiv).toBe(true)
    expect(ab.ziel.kategorien).toEqual(['BROT'])
  })

  it('aus dem Futter heraus wechselt eine Hofladen-Kategorie den Bereich', () => {
    const ziel = kategorieReihe(HOEFE, { ...futter, kategorien: ['HEU_STROH'], tiere: ['PFERD'] }).find((c) => c.label === 'Eier')!.ziel
    expect(ziel).toMatchObject({ bereich: 'LEBENSMITTEL', kategorien: ['EIER'], tiere: [] })
  })

  it('„Alle" nimmt Bereich und Kategorien zurück, lässt Siegel und Suche stehen', () => {
    const alle = kategorieReihe(HOEFE, { ...futter, kategorien: ['HEU_STROH'], siegel: ['BIO'], suchtext: 'Heu' })[0]!
    expect(alle.ziel).toEqual({ ...LEERER_HOEFE_FILTER, siegel: ['BIO'], suchtext: 'Heu' })
  })
})

describe('Futter-Bereich: zweite Reihe und Mengen-Facette', () => {
  it('im Hofladen gibt es weder Futter-Reihe noch Mengen', () => {
    expect(futterReihe(HOEFE, LEERER_HOEFE_FILTER)).toEqual([])
    expect(mengenReihe(LEERER_HOEFE_FILTER)).toEqual([])
  })

  it('der Futter-Chip blendet die Mengen-Facette ein — Wortlaut „Kleinmengen | Ballen & mehr", Grenze 25 kg', () => {
    const chip = kategorieReihe(HOEFE, LEERER_HOEFE_FILTER).find((c) => c.label === 'Futtermittel')!
    const mengen = mengenReihe(neuGeladen(hoefeHref(chip.ziel)))
    expect(mengen.map((m) => m.label)).toEqual(['Alle Mengen', 'Kleinmengen', 'Ballen & mehr'])
    expect(MENGE_LABEL).toEqual({ KLEIN: 'Kleinmengen', GROSS: 'Ballen & mehr' })
    expect(KLEINGEBINDE_BIS_KG).toBe(25)
    expect(MENGEN_HINWEIS).toContain('25 kg')
    expect(mengen[0]!.aktiv).toBe(true)
  })

  it('„Kleinmengen" schreibt gebinde=klein in die Adresse, „Alle Mengen" nimmt es wieder heraus', () => {
    const klein = mengenReihe(futter).find((m) => m.label === 'Kleinmengen')!
    expect(hoefeHref(klein.ziel)).toBe('/hoefe?bereich=futter&gebinde=klein')
    const nachher = neuGeladen(hoefeHref(klein.ziel))
    expect(nachher.gebinde).toBe('KLEIN')
    expect(mengenReihe(nachher).find((m) => m.label === 'Kleinmengen')!.aktiv).toBe(true)
    expect(mengenReihe(nachher)[0]!.ziel.gebinde).toBeNull()
  })

  it('die Futter-Reihe zeigt die Futter-Kategorien mit Angebot', () => {
    expect(futterReihe(HOEFE, futter).map((c) => c.label)).toEqual(['Heu & Stroh', 'Getreide & Körner'])
  })
})

describe('Siegel, Sorten, Tiere, Sortierung — ebenfalls Links zum Umschalten', () => {
  it('Siegel nur, was es gibt; ein Tipp schaltet um', () => {
    const bio = siegelReihe(HOEFE, LEERER_HOEFE_FILTER)
    expect(bio.map((c) => c.label)).toEqual(['Bio'])
    expect(hoefeHref(bio[0]!.ziel)).toBe('/hoefe?siegel=BIO')
    expect(siegelReihe(HOEFE, bio[0]!.ziel)[0]).toMatchObject({ aktiv: true, ziel: LEERER_HOEFE_FILTER })
  })

  it('Tiere und Kilopreis nur im Futter', () => {
    const mitTier = [hof('Pferdehof', [angebot({ name: 'Heu', category: 'HEU_STROH', tiere: ['PFERD'] })])]
    expect(tierReihe(mitTier, LEERER_HOEFE_FILTER)).toEqual([])
    expect(tierReihe(mitTier, futter).map((c) => c.ziel.tiere)).toEqual([['PFERD']])
    expect(sortierReihe(LEERER_HOEFE_FILTER)).toEqual([])
    const sort = sortierReihe(futter)[0]!
    expect(sort.label).toBe(KILOPREIS_LABEL)
    expect(neuGeladen(hoefeHref(sort.ziel)).sortierung).toBe('GRUNDPREIS')
  })

  it('Sorten erst ab zwei Sorten der gewählten Kategorie', () => {
    const zwei = [
      hof('A', [angebot({ name: 'Bio-Eier', category: 'EIER', subcategory: 'EIER_BIO' })]),
      hof('B', [angebot({ name: 'Freiland', category: 'EIER', subcategory: 'EIER_FREILAND' })]),
    ]
    expect(sortenReihe(zwei, LEERER_HOEFE_FILTER)).toEqual([])
    const reihe = sortenReihe(zwei, { ...LEERER_HOEFE_FILTER, kategorien: ['EIER'] })
    expect(reihe.map((c) => c.label)).toEqual(['Bio', 'Freiland'])
    expect(neuGeladen(hoefeHref(reihe[0]!.ziel)).sorten).toEqual(['EIER_BIO'])
  })
})

describe('aktive Filter und „Alle zurücksetzen"', () => {
  const gesetzt: HoefeFilter = {
    ...futter,
    kategorien: ['HEU_STROH'],
    siegel: ['BIO'],
    gebinde: 'KLEIN',
    sortierung: 'GRUNDPREIS',
    suchtext: 'Heu',
    suchMarken: ['Stroh'],
    ansicht: 'karte',
  }

  it('ohne Filter ist nichts aktiv', () => {
    expect(aktiveFilter(LEERER_HOEFE_FILTER)).toEqual([])
    expect(zaehleFilter(LEERER_HOEFE_FILTER)).toBe(0)
  })

  it('nennt jeden Filter einzeln, mit verständlichem Wortlaut', () => {
    expect(aktiveFilter(gesetzt).map((f) => f.label)).toEqual([
      'Suche: Stroh',
      'Suche: Heu',
      'Futtermittel',
      'Heu & Stroh',
      'Bio',
      'Kleinmengen',
      KILOPREIS_LABEL,
    ])
  })

  it('jeder entfernt genau sich selbst', () => {
    const ohneBio = aktiveFilter(gesetzt).find((f) => f.label === 'Bio')!.ohne
    expect(ohneBio).toEqual({ ...gesetzt, siegel: [] })
    const ohneMarke = aktiveFilter(gesetzt).find((f) => f.label === 'Suche: Stroh')!.ohne
    expect(ohneMarke.suchMarken).toEqual([])
    expect(ohneMarke.suchtext).toBe('Heu')
  })

  it('„Futtermittel" entfernen heißt zurück in den Hofladen — Mengen und Futter-Kategorien fallen mit', () => {
    const ohne = aktiveFilter(gesetzt).find((f) => f.label === 'Futtermittel')!.ohne
    expect(ohne).toMatchObject({ bereich: 'LEBENSMITTEL', kategorien: [], gebinde: null, sortierung: null, siegel: ['BIO'] })
  })

  it('eine Kategorie entfernen nimmt ihre Sorten mit', () => {
    const mitSorte: HoefeFilter = { ...LEERER_HOEFE_FILTER, kategorien: ['EIER', 'MILCH'], sorten: ['EIER_BIO', 'KAESE'] }
    const ohneEier = aktiveFilter(mitSorte).find((f) => f.label === 'Eier')!.ohne
    expect(ohneEier).toMatchObject({ kategorien: ['MILCH'], sorten: ['KAESE'] })
  })

  it('Brennholz heißt in der Liste Brennmaterial — wie der Chip', () => {
    expect(aktiveFilter({ ...LEERER_HOEFE_FILTER, kategorien: ['BRENNHOLZ'] }).map((f) => f.label)).toEqual(['Brennmaterial'])
  })

  it('„Alle zurücksetzen" leert alle Filter, die Ansicht (Liste/Karte) bleibt', () => {
    expect(alleZuruecksetzen(gesetzt)).toEqual({ ...LEERER_HOEFE_FILTER, ansicht: 'karte' })
    expect(hoefeHref(alleZuruecksetzen({ ...gesetzt, ansicht: 'liste' }))).toBe('/hoefe')
  })

  it('die Zahl am Filter-Knopf zählt alles außer der Suche (die steht im Feld)', () => {
    expect(zaehleFilter(gesetzt)).toBe(5)
  })
})

describe('Kopf und Ergebniszahl', () => {
  it('ohne Suche „Höfe in deiner Nähe", im Futter „Futtermittel in deiner Nähe"', () => {
    expect(entdeckenKopf(LEERER_HOEFE_FILTER)).toEqual(ENTDECKEN_KOPF.hoefe)
    expect(entdeckenKopf(LEERER_HOEFE_FILTER).titel).toBe('Höfe in deiner Nähe')
    expect(entdeckenKopf(futter).titel).toBe('Futtermittel in deiner Nähe')
  })

  it('mit Suche nennt der Kopf den Begriff und sagt, warum Produkte erscheinen', () => {
    const kopf = entdeckenKopf({ ...futter, suchMarken: ['Eier'], suchtext: ' ' })
    expect(kopf.titel).toBe('„Eier" in deiner Nähe')
    expect(kopf.unterzeile).toBe('Produkte statt Höfe, weil du nach einem Produkt suchst')
  })

  it('Produkte statt Höfe: bei einer Suche und im Futter (Angebote), sonst Höfe', () => {
    expect(zeigtProdukte(LEERER_HOEFE_FILTER)).toBe(false)
    expect(zeigtProdukte({ ...LEERER_HOEFE_FILTER, suchtext: 'Eier' })).toBe(true)
    expect(zeigtProdukte({ ...LEERER_HOEFE_FILTER, suchtext: '   ' })).toBe(false)
    expect(zeigtProdukte(futter)).toBe(true)
  })

  it('zählt Höfe, Treffer oder Angebote — mit richtiger Einzahl', () => {
    expect(ergebnisZahl(LEERER_HOEFE_FILTER, 1)).toBe('1 Hof')
    expect(ergebnisZahl(LEERER_HOEFE_FILTER, 4)).toBe('4 Höfe')
    expect(ergebnisZahl({ ...LEERER_HOEFE_FILTER, suchtext: 'Eier' }, 2)).toBe('2 Treffer')
    expect(ergebnisZahl(futter, 1)).toBe('1 Angebot')
    expect(ergebnisZahl(futter, 3)).toBe('3 Angebote')
  })
})

describe('produktTreffer — die Produktsuche zeigt Produkte statt Höfe', () => {
  it('nur passende, kaufbare Produkte der übergebenen Höfe, in der Reihenfolge der Höfe', () => {
    const treffer = produktTreffer(HOEFE, { ...LEERER_HOEFE_FILTER, suchtext: 'brot' })
    expect(treffer.map((t) => [t.hof.name, t.produkt.name])).toEqual([['Hof Müller', 'Bauernbrot']])
  })

  it('Such-Marken sind untereinander ein ODER, der getippte Text ein UND', () => {
    const marken = produktTreffer(HOEFE, { ...LEERER_HOEFE_FILTER, suchMarken: ['Eier', 'Brot'] })
    expect(marken.map((t) => t.produkt.name)).toEqual(['Freilandeier', 'Bauernbrot'])
    const mitText = produktTreffer(HOEFE, { ...LEERER_HOEFE_FILTER, suchMarken: ['Eier', 'Brot'], suchtext: 'bauern' })
    expect(mitText.map((t) => t.produkt.name)).toEqual(['Bauernbrot'])
  })

  it('trifft der Text den Hofnamen, erscheinen die Produkte dieses Hofs (im gewählten Bereich)', () => {
    const treffer = produktTreffer(HOEFE, { ...LEERER_HOEFE_FILTER, suchtext: 'Waldhof' })
    expect(treffer.map((t) => t.produkt.name)).toEqual(['Buche, ofenfertig'])
  })

  it('Bereich und Facetten gelten je Produkt — Bio trifft nur das Bio-Brot', () => {
    const bio = produktTreffer(HOEFE, { ...LEERER_HOEFE_FILTER, siegel: ['BIO'], suchMarken: ['Brot', 'Eier'] })
    expect(bio.map((t) => t.produkt.name)).toEqual(['Bauernbrot'])
  })

  it('im Futter ohne Suche: alle passenden Angebote; Kleinmengen nur bis 25 kg', () => {
    expect(produktTreffer(HOEFE, futter).map((t) => t.produkt.name)).toEqual(['Heu im Sackerl', 'Heu Rundballen', 'Hafer'])
    expect(produktTreffer(HOEFE, { ...futter, gebinde: 'KLEIN' }).map((t) => t.produkt.name)).toEqual(['Heu im Sackerl', 'Hafer'])
    expect(produktTreffer(HOEFE, { ...futter, gebinde: 'GROSS' }).map((t) => t.produkt.name)).toEqual(['Heu Rundballen'])
  })

  it('„Günstigster Kilopreis" ordnet die Angebote nach Grundpreis', () => {
    const treffer = produktTreffer(HOEFE, { ...futter, sortierung: 'GRUNDPREIS' })
    expect(treffer.map((t) => t.produkt.name)).toEqual(['Heu Rundballen', 'Hafer', 'Heu im Sackerl'])
  })

  it('ohne Suche im Hofladen gibt es keine Produktliste', () => {
    expect(produktTreffer(HOEFE, LEERER_HOEFE_FILTER)).toEqual([])
  })
})

describe('leerzustand — immer mit Ausweg', () => {
  const basis = { sucheLeertDieListe: false, umkreis: null, filter: LEERER_HOEFE_FILTER }

  it('leert die Suche die Liste: Suche zurücksetzen', () => {
    const leer = leerzustand({ ...basis, sucheLeertDieListe: true, filter: { ...LEERER_HOEFE_FILTER, suchtext: 'Wels' } })
    expect(leer.ausweg).toEqual({ art: 'link', label: 'Suche zurücksetzen', ziel: LEERER_HOEFE_FILTER })
  })

  it('leert der Umkreis die Liste: eine Stufe weiter, bei 50 km aufheben', () => {
    expect(leerzustand({ ...basis, umkreis: 10 }).ausweg).toEqual({ art: 'umkreis', label: 'Auf 25 km erweitern', stufe: 25 })
    expect(leerzustand({ ...basis, umkreis: 25 }).ausweg).toEqual({ art: 'umkreis', label: 'Auf 50 km erweitern', stufe: 50 })
    expect(leerzustand({ ...basis, umkreis: 50 }).ausweg).toEqual({ art: 'umkreis', label: 'Umkreis aufheben', stufe: null })
    expect(leerzustand({ ...basis, umkreis: 10 }).titel).toBe('Im Umkreis von 10 km ist gerade nichts dabei')
    expect(naechsteUmkreisStufe(10)).toBe(25)
  })

  it('Futter ohne weitere Filter: zurück in den Hofladen', () => {
    const leer = leerzustand({ ...basis, filter: futter })
    expect(leer.ausweg).toMatchObject({ art: 'link', label: 'Zum Hofladen' })
    expect(leer.ausweg.art === 'link' && leer.ausweg.ziel.bereich).toBe('LEBENSMITTEL')
  })

  it('sonst: Filter zurücksetzen', () => {
    const filter: HoefeFilter = { ...LEERER_HOEFE_FILTER, kategorien: ['FISCH'], ansicht: 'karte' }
    const leer = leerzustand({ ...basis, filter })
    expect(leer.ausweg).toEqual({ art: 'link', label: 'Alle zurücksetzen', ziel: alleZuruecksetzen(filter) })
    expect(leer.titel.length).toBeGreaterThan(0)
    expect(leer.satz.length).toBeGreaterThan(0)
  })
})
