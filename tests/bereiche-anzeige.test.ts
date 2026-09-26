/**
 * Tests für Sprint Bereiche 2 — Hofladen und Futtermittel in der Kundenansicht
 * (src/lib/bereiche-anzeige.ts, src/schemas/hoefe-filter.ts,
 * berechneHofAuswahl in src/lib/hofuebersicht.ts).
 *
 * Beweist: kaufbar ist eine Regel; ein Bereich zeigt nur Höfe mit passendem,
 * kaufbarem Angebot (Karte und Liste teilen die Menge); Facetten gelten je
 * Produkt; Chips ohne Treffer fehlen; die Sorten-Reihe erscheint erst ab zwei
 * Sorten; die Kilopreis-Sortierung; der URL-Zustand übersteht Hin- und
 * Rückweg und verwirft Unsinn ohne Fehler; die Hofseite teilt nach Bereich
 * und ordnet Sektionen nach der Sortierung des Hofs.
 */
import { describe, it, expect } from 'vitest'
import {
  SPRUNGMARKEN_AB,
  abGrundpreis,
  baueAngebotsZeile,
  filtereNachAngebot,
  gebindeChips,
  grundpreisAusKennzeichnung,
  hofPasst,
  hofseitenLink,
  istKaufbar,
  kategorieChips,
  siegelChips,
  sortenChips,
  sortiereNachGrundpreis,
  teileHofseite,
  tierChips,
  kennzeichnungsZeilen,
  zeigeKaufknopf,
  type AngebotsZeile,
  type ProduktFilter,
} from '@/lib/bereiche-anzeige'
import { UMKREIS_STUFEN, berechneHofAuswahl } from '@/lib/hofuebersicht'
import { formatAbGrundpreis, formatGrundpreisNetto, kilopreisNetto } from '@/lib/format'
import {
  LEERER_HOEFE_FILTER,
  SUCHTEXT_MAX,
  UM_KM_VALUES,
  leseHoefeFilter,
  schreibeHoefeFilter,
  wechsleBereich,
  type HoefeFilter,
} from '@/schemas/hoefe-filter'
import { ANZEIGE_BEREICHE, SIEGEL, TIERART_LABEL, type ProductCategoryValue } from '@/lib/taxonomie'

function zeile(teil: Partial<AngebotsZeile> & { category: ProductCategoryValue | null }): AngebotsZeile {
  return {
    name: 'Produkt',
    subcategory: null,
    labels: [],
    tiere: [],
    grundpreis: null,
    grossgebinde: null,
    ...teil,
  }
}

const heu = (teil: Partial<AngebotsZeile> = {}) =>
  zeile({
    name: 'Heu',
    category: 'HEU_STROH',
    subcategory: 'WIESENHEU',
    tiere: ['PFERD'],
    grundpreis: { wert: 0.15, einheit: 'KG' },
    grossgebinde: true,
    ...teil,
  })
const eier = (teil: Partial<AngebotsZeile> = {}) => zeile({ name: 'Eier', category: 'EIER', ...teil })

const FILTER: ProduktFilter = {
  bereich: 'LEBENSMITTEL',
  kategorien: [],
  sorten: [],
  siegel: [],
  tiere: [],
  gebinde: null,
}
const FUTTER: ProduktFilter = { ...FILTER, bereich: 'FUTTERMITTEL' }

describe('Anzeige-Bereiche — ein Label', () => {
  it('der erste Bereich heißt „Hofladen" und trägt Brennholz und Sonstiges', () => {
    expect(ANZEIGE_BEREICHE.LEBENSMITTEL.titel).toBe('Hofladen')
    expect(ANZEIGE_BEREICHE.LEBENSMITTEL.untertitel).toBe('Lebensmittel und mehr')
    expect(ANZEIGE_BEREICHE.LEBENSMITTEL.kategorien.slice(-2)).toEqual(['BRENNHOLZ', 'SONSTIGES'])
    expect(ANZEIGE_BEREICHE.FUTTERMITTEL.titel).toBe('Futtermittel')
  })
})

describe('istKaufbar', () => {
  it('sichtbar und freier Bestand über null → kaufbar', () => {
    expect(istKaufbar({ isAvailable: true, stock: 1, reservedStock: 0 })).toBe(true)
  })

  it('ausverkauft, voll reserviert oder ausgeblendet → nicht kaufbar', () => {
    expect(istKaufbar({ isAvailable: true, stock: 0, reservedStock: 0 })).toBe(false)
    expect(istKaufbar({ isAvailable: true, stock: 2, reservedStock: 2 })).toBe(false)
    expect(istKaufbar({ isAvailable: false, stock: 5, reservedStock: 0 })).toBe(false)
  })

  it('baueAngebotsZeile lässt nicht kaufbare Produkte weg', () => {
    const roh = {
      name: 'Heu',
      isAvailable: true,
      stock: 0,
      reservedStock: 0,
      price: 45,
      category: 'HEU_STROH' as const,
      subcategory: 'WIESENHEU' as const,
      labels: [],
      futter: { zielTierarten: ['PFERD' as const], nettoMenge: 300, nettoEinheit: 'KG' as const },
    }
    expect(baueAngebotsZeile(roh)).toBeNull()
    expect(baueAngebotsZeile({ ...roh, stock: 1 })?.grossgebinde).toBe(true)
    expect(baueAngebotsZeile({ ...roh, stock: 1, futter: null })).toMatchObject({ grundpreis: null, grossgebinde: null, tiere: [] })
  })
})

describe('grundpreisAusKennzeichnung', () => {
  it('Preis je Gebinde ÷ Nettomenge', () => {
    expect(grundpreisAusKennzeichnung(45, { nettoMenge: 300, nettoEinheit: 'KG' })).toEqual({ wert: 0.15, einheit: 'KG' })
  })

  it('ohne Kennzeichnung, ohne Menge oder ohne Preis: null', () => {
    expect(grundpreisAusKennzeichnung(45, null)).toBeNull()
    expect(grundpreisAusKennzeichnung(45, { nettoMenge: 0, nettoEinheit: 'KG' })).toBeNull()
    expect(grundpreisAusKennzeichnung(0, { nettoMenge: 25, nettoEinheit: 'KG' })).toBeNull()
  })
})

describe('hofPasst — Bereich und Facetten', () => {
  const eierhof = { angebot: [eier()] }
  const futterhof = { angebot: [heu()] }
  const gemischt = { angebot: [eier(), heu()] }
  const leer = { angebot: [] }

  it('Futtermittel zeigt nur Höfe mit kaufbarem Futter', () => {
    expect(filtereNachAngebot([eierhof, futterhof, gemischt, leer], FUTTER)).toEqual([futterhof, gemischt])
  })

  it('der Hofladen zeigt keinen reinen Futterhof, aber einen Hof ohne kaufbares Angebot', () => {
    expect(filtereNachAngebot([eierhof, futterhof, gemischt, leer], FILTER)).toEqual([eierhof, gemischt, leer])
  })

  it('sobald ein Filter gesetzt ist, fällt der leere Hof heraus', () => {
    expect(hofPasst(leer, { ...FILTER, siegel: ['BIO'] })).toBe(false)
  })

  it('Facetten gelten je Produkt: Bio-Eier und normales Heu sind kein Bio-Futter', () => {
    const hof = { angebot: [eier({ labels: ['BIO'] }), heu()] }
    expect(hofPasst(hof, { ...FUTTER, siegel: ['BIO'] })).toBe(false)
    expect(hofPasst({ angebot: [heu({ labels: ['BIO'] })] }, { ...FUTTER, siegel: ['BIO'] })).toBe(true)
  })

  it('Tiere sind ein ODER, Siegel ein UND', () => {
    const hof = { angebot: [heu({ tiere: ['RIND'], labels: ['BIO'] })] }
    expect(hofPasst(hof, { ...FUTTER, tiere: ['PFERD', 'RIND'] })).toBe(true)
    expect(hofPasst(hof, { ...FUTTER, siegel: ['BIO', 'AMA_GUETESIEGEL'] })).toBe(false)
  })

  it('Gebinde: der 25-kg-Sack steht unter Klein, nicht unter Groß', () => {
    // Korrektur an Bereiche 2 im Umfeld-Sprint: Genau 25 kg zählte schon als
    // groß, obwohl der Chip „Klein (bis 25 kg)" versprach.
    const sack = baueAngebotsZeile({
      name: 'Hafer',
      isAvailable: true,
      stock: 4,
      reservedStock: 0,
      price: 12,
      category: 'GETREIDE_KOERNER',
      subcategory: 'HAFER',
      labels: [],
      futter: { zielTierarten: ['PFERD'], nettoMenge: 25, nettoEinheit: 'KG' },
    })
    const hof = { angebot: sack ? [sack] : [] }
    expect(hofPasst(hof, { ...FUTTER, gebinde: 'KLEIN' })).toBe(true)
    expect(hofPasst(hof, { ...FUTTER, gebinde: 'GROSS' })).toBe(false)
  })

  it('Gebinde: Groß über 25 kg, Klein bis 25 kg, ohne Kennzeichnung weder noch', () => {
    const gross = { angebot: [heu({ grossgebinde: true })] }
    const klein = { angebot: [heu({ grossgebinde: false })] }
    const ohne = { angebot: [heu({ grossgebinde: null })] }
    expect([gross, klein, ohne].map((h) => hofPasst(h, { ...FUTTER, gebinde: 'GROSS' }))).toEqual([true, false, false])
    expect([gross, klein, ohne].map((h) => hofPasst(h, { ...FUTTER, gebinde: 'KLEIN' }))).toEqual([false, true, false])
  })

  it('eine Sorte gilt nur zusammen mit ihrer Kategorie', () => {
    const hof = { angebot: [heu({ subcategory: 'STROH' })] }
    expect(hofPasst(hof, { ...FUTTER, kategorien: ['HEU_STROH'], sorten: ['WIESENHEU'] })).toBe(false)
    // Ohne gewählte Kategorie ist die Sorte wirkungslos.
    expect(hofPasst(hof, { ...FUTTER, sorten: ['WIESENHEU'] })).toBe(true)
  })
})

describe('Chips', () => {
  const hoefe = [
    { angebot: [heu(), heu({ subcategory: 'STROH' })] },
    { angebot: [heu({ labels: ['BIO'], tiere: ['RIND'], grossgebinde: false })] },
    { angebot: [zeile({ category: 'GETREIDE_KOERNER', subcategory: 'HAFER', tiere: ['PFERD'] })] },
    { angebot: [eier(), zeile({ category: 'BRENNHOLZ' })] },
  ]

  it('Kategorie-Chips nur aus dem Bereich, in Taxonomie-Reihenfolge, ohne Treffer fehlen sie', () => {
    expect(kategorieChips(hoefe, FUTTER).map((c) => [c.wert, c.anzahl])).toEqual([
      ['HEU_STROH', 2],
      ['GETREIDE_KOERNER', 1],
    ])
    expect(kategorieChips(hoefe, FILTER).map((c) => c.wert)).toEqual(['EIER', 'BRENNHOLZ'])
  })

  it('ein gewählter Chip bleibt stehen, auch wenn ihn eine andere Facette auf null drückt', () => {
    const chips = kategorieChips(hoefe, { ...FUTTER, kategorien: ['GETREIDE_KOERNER'], siegel: ['BIO'] })
    expect(chips.find((c) => c.wert === 'GETREIDE_KOERNER')).toMatchObject({ anzahl: 0 })
  })

  it('Sorten-Reihe erst mit gewählter Kategorie und ab zwei Sorten, mit Zählern', () => {
    expect(sortenChips(hoefe, FUTTER)).toEqual([])
    expect(sortenChips(hoefe, { ...FUTTER, kategorien: ['HEU_STROH'] })).toEqual([
      { wert: 'WIESENHEU', label: 'Wiesenheu', anzahl: 2 },
      { wert: 'STROH', label: 'Stroh', anzahl: 1 },
    ])
    // Nur eine Sorte in der Ergebnismenge → keine Reihe.
    expect(sortenChips(hoefe, { ...FUTTER, kategorien: ['GETREIDE_KOERNER'] })).toEqual([])
  })

  it('die Sortenwahl selbst lässt die Reihe stehen', () => {
    expect(sortenChips(hoefe, { ...FUTTER, kategorien: ['HEU_STROH'], sorten: ['STROH'] })).toHaveLength(2)
  })

  it('Siegel, Tiere und Gebinde nur, was es gibt; Tiere und Gebinde nur im Futter', () => {
    expect(siegelChips(hoefe, FUTTER, (s) => SIEGEL[s].name).map((c) => c.wert)).toEqual(['BIO'])
    expect(tierChips(hoefe, FUTTER, (t) => TIERART_LABEL[t]).map((c) => [c.wert, c.anzahl])).toEqual([
      ['PFERD', 2],
      ['RIND', 1],
    ])
    expect(gebindeChips(hoefe, FUTTER).map((c) => c.wert)).toEqual(['KLEIN', 'GROSS'])
    expect(tierChips(hoefe, FILTER, (t) => t)).toEqual([])
    expect(gebindeChips(hoefe, FILTER)).toEqual([])
  })
})

describe('Kilopreis', () => {
  const teuer = { name: 'teuer', angebot: [heu({ grundpreis: { wert: 0.3, einheit: 'KG' } })] }
  const billig = {
    name: 'billig',
    angebot: [heu({ grundpreis: { wert: 0.5, einheit: 'KG' } }), heu({ grundpreis: { wert: 0.12, einheit: 'KG' } })],
  }
  const ohne = { name: 'ohne', angebot: [heu({ grundpreis: null })] }

  it('abGrundpreis ist der günstigste PASSENDE Kilopreis', () => {
    expect(abGrundpreis(billig, FUTTER)).toEqual({ wert: 0.12, einheit: 'KG' })
    expect(abGrundpreis(ohne, FUTTER)).toBeNull()
  })

  it('sortiert aufsteigend, Höfe ohne Kilopreis ans Ende in bisheriger Reihenfolge', () => {
    expect(sortiereNachGrundpreis([ohne, teuer, billig], FUTTER).map((h) => h.name)).toEqual(['billig', 'teuer', 'ohne'])
  })
})

describe('berechneHofAuswahl mit Bereich — Liste und Karte teilen die Menge', () => {
  const hof = (name: string, angebot: AngebotsZeile[], lat = 48.2) => ({
    name,
    angebot,
    kategorien: [] as ProductCategoryValue[],
    suchNamen: [] as string[],
    latitude: lat,
    longitude: 13.5,
  })
  const HOEFE = [
    hof('Eierhof', [eier()]),
    hof('Futterhof', [heu({ grundpreis: { wert: 0.3, einheit: 'KG' } })]),
    hof('Gemischter Hof', [eier(), heu({ grundpreis: { wert: 0.12, einheit: 'KG' } })]),
  ]
  const BASIS = { ...LEERER_HOEFE_FILTER, bezugspunkt: null, umkreis: null }

  it('Futtermittel: nur Futterhöfe — die Karte liest dieselbe Liste', () => {
    const { gefiltert } = berechneHofAuswahl(HOEFE, { ...BASIS, bereich: 'FUTTERMITTEL' })
    expect(gefiltert.map((h) => h.name)).toEqual(['Futterhof', 'Gemischter Hof'])
  })

  it('Kategorien und Suche gelten nur im Bereich: kein „Heu"-Treffer im Hofladen', () => {
    const { gefiltert } = berechneHofAuswahl(HOEFE, { ...BASIS, suchtext: 'Heu' })
    expect(gefiltert).toEqual([])
    const gemischt = berechneHofAuswahl(HOEFE, BASIS).gefiltert.find((h) => h.name === 'Gemischter Hof')
    expect(gemischt?.kategorien).toEqual(['EIER'])
  })

  it('sort=grundpreis ordnet nach Kilopreis und liefert ihn für die Karte', () => {
    const { gefiltert } = berechneHofAuswahl(HOEFE, { ...BASIS, bereich: 'FUTTERMITTEL', sortierung: 'GRUNDPREIS' })
    expect(gefiltert.map((h) => [h.name, h.abGrundpreis?.wert])).toEqual([
      ['Gemischter Hof', 0.12],
      ['Futterhof', 0.3],
    ])
  })

  it('das Schaufenster greift im Futter zuerst nach Futter', () => {
    const { vorschauKategorien } = berechneHofAuswahl(HOEFE, { ...BASIS, bereich: 'FUTTERMITTEL' })
    expect(vorschauKategorien).toEqual(['HEU_STROH', 'GETREIDE_KOERNER', 'MISCHFUTTER', 'ERGAENZUNGSFUTTER'])
  })
})

describe('URL-Zustand von /hoefe', () => {
  const lies = (query: string) => leseHoefeFilter(new URLSearchParams(query))

  it('die nackte Adresse ist Hofladen, Liste, ohne Filter — und schreibt sich leer', () => {
    expect(lies('')).toEqual(LEERER_HOEFE_FILTER)
    expect(schreibeHoefeFilter(LEERER_HOEFE_FILTER)).toBe('')
  })

  it('Hin- und Rückweg ergeben denselben Zustand', () => {
    const filter: HoefeFilter = {
      bereich: 'FUTTERMITTEL',
      kategorien: ['HEU_STROH'],
      sorten: ['WIESENHEU'],
      siegel: ['BIO'],
      tiere: ['PFERD', 'RIND'],
      gebinde: 'GROSS',
      sortierung: 'GRUNDPREIS',
      suchtext: 'heu',
      suchMarken: ['Heu, gepresst', 'Stroh'],
      ansicht: 'karte',
      um: 'hof-test',
      km: 25,
    }
    expect(lies(schreibeHoefeFilter(filter))).toEqual(filter)
  })

  it('verwirft Unsinn still, statt einen Fehler zu werfen', () => {
    expect(lies('bereich=quatsch&kat=GIBTS,EIER,EIER&siegel=BIO,XX&ansicht=globus')).toEqual({
      ...LEERER_HOEFE_FILTER,
      kategorien: ['EIER'],
      siegel: ['BIO'],
    })
  })

  it('eine Kategorie aus dem anderen Bereich und eine Sorte ohne ihre Kategorie fallen weg', () => {
    expect(lies('kat=HEU_STROH,EIER&sorte=WIESENHEU,EIER_BIO')).toMatchObject({
      kategorien: ['EIER'],
      sorten: ['EIER_BIO'],
    })
  })

  it('Tiere, Gebinde und Kilopreis-Sortierung gibt es nur im Futter', () => {
    expect(lies('tiere=PFERD&gebinde=gross&sort=grundpreis')).toMatchObject({ tiere: [], gebinde: null, sortierung: null })
  })

  it('zu langer Suchtext und die Altlast-Sorte werden verworfen', () => {
    expect(lies(`q=${'x'.repeat(SUCHTEXT_MAX + 1)}`).suchtext).toBe('')
    expect(lies('bereich=futter&kat=HEU_STROH&sorte=EINZELFUTTERMITTEL').sorten).toEqual([])
  })

  it('Bezugspunkt und Umkreis stehen nie in der URL', () => {
    const query = schreibeHoefeFilter({ ...LEERER_HOEFE_FILTER, suchtext: 'Eier' })
    expect(query).not.toMatch(/lat|lon|umkreis|plz/)
  })

  it('um= trägt nur den Slug eines Hofs, nie Koordinaten — samt Umkreis', () => {
    // Ausnahme aus dem Umfeld-Sprint: Bezugspunkt ist der öffentliche
    // Standort eines Hofs, nicht der des Besuchers.
    const query = schreibeHoefeFilter({ ...LEERER_HOEFE_FILTER, um: 'hof-test', km: 10, ansicht: 'karte' })
    expect(query).toBe('ansicht=karte&um=hof-test&km=10')
    expect(query).not.toMatch(/lat|lon|\d+\.\d+/)
  })

  it('verwirft einen kaputten Slug, einen fremden Umkreis und einen Umkreis ohne um', () => {
    expect(lies('um=Hof Test&km=25')).toMatchObject({ um: null, km: null })
    expect(lies('um=hof--test')).toMatchObject({ um: null })
    expect(lies('um=../admin')).toMatchObject({ um: null })
    expect(lies('um=hof-test&km=30')).toMatchObject({ um: 'hof-test', km: null })
    expect(lies('um=hof-test&km=abc')).toMatchObject({ um: 'hof-test', km: null })
    expect(lies('km=25')).toMatchObject({ um: null, km: null })
    expect(lies('um=hof-test')).toMatchObject({ um: 'hof-test', km: null })
    // Ohne um schreibt sich auch ein km nicht in die URL.
    expect(schreibeHoefeFilter({ ...LEERER_HOEFE_FILTER, km: 25 })).toBe('')
  })

  it('die um-Stufen sind die des Umkreis-Reglers ohne „egal"', () => {
    expect([...UM_KM_VALUES, null]).toEqual(UMKREIS_STUFEN)
  })

  it('beim Bereichswechsel bleibt der Bezugspunkt aus um=', () => {
    const vorher: HoefeFilter = { ...LEERER_HOEFE_FILTER, bereich: 'FUTTERMITTEL', um: 'hof-test', km: 25 }
    expect(wechsleBereich(vorher, 'LEBENSMITTEL')).toMatchObject({ um: 'hof-test', km: 25 })
  })

  it('beim Bereichswechsel fallen die bereichsgebundenen Filter, Siegel und Suche bleiben', () => {
    const vorher: HoefeFilter = {
      ...LEERER_HOEFE_FILTER,
      bereich: 'FUTTERMITTEL',
      kategorien: ['HEU_STROH'],
      tiere: ['PFERD'],
      gebinde: 'KLEIN',
      sortierung: 'GRUNDPREIS',
      siegel: ['BIO'],
      suchtext: 'bio',
    }
    expect(wechsleBereich(vorher, 'LEBENSMITTEL')).toEqual({
      ...LEERER_HOEFE_FILTER,
      siegel: ['BIO'],
      suchtext: 'bio',
    })
  })

  it('der Hof-Link trägt den Futter-Bereich mit', () => {
    expect(hofseitenLink('hof-test', 'FUTTERMITTEL')).toBe('/hof-test?bereich=futter')
    expect(hofseitenLink('hof-test', 'LEBENSMITTEL')).toBe('/hof-test')
  })
})

describe('teileHofseite', () => {
  const p = (id: string, category: ProductCategoryValue | null) => ({ id, category })

  it('beide Bereiche: Umschalter, Standard Hofladen, Futter wird nicht gerendert', () => {
    const teil = teileHofseite([p('eier', 'EIER'), p('heu', 'HEU_STROH')], null)
    expect(teil).toMatchObject({ bereiche: ['LEBENSMITTEL', 'FUTTERMITTEL'], aktiv: 'LEBENSMITTEL', umschalter: true })
    expect(teil.sektionen.flatMap((s) => s.produkte.map((x) => x.id))).toEqual(['eier'])
  })

  it('der Wunsch aus der URL gilt, wenn der Hof den Bereich anbietet', () => {
    const teil = teileHofseite([p('eier', 'EIER'), p('heu', 'HEU_STROH')], 'FUTTERMITTEL')
    expect(teil.aktiv).toBe('FUTTERMITTEL')
    expect(teil.sektionen.flatMap((s) => s.produkte.map((x) => x.id))).toEqual(['heu'])
  })

  it('nur ein Bereich: kein Umschalter, ein unpassender Wunsch wird übergangen', () => {
    const nurFutter = teileHofseite([p('heu', 'HEU_STROH')], 'LEBENSMITTEL')
    expect(nurFutter).toMatchObject({ bereiche: ['FUTTERMITTEL'], aktiv: 'FUTTERMITTEL', umschalter: false })
    const nurLaden = teileHofseite([p('eier', 'EIER')], 'FUTTERMITTEL')
    expect(nurLaden).toMatchObject({ aktiv: 'LEBENSMITTEL', umschalter: false })
  })

  it('keine Produkte: kein Bereich, keine Sektion', () => {
    expect(teileHofseite([], 'FUTTERMITTEL')).toEqual({
      bereiche: [],
      aktiv: null,
      umschalter: false,
      sektionen: [],
      sprungmarken: false,
    })
  })

  it('Sektionen folgen dem ersten Produkt je Kategorie in der Sortierung des Hofs', () => {
    // Das Lamm steht ganz oben → Fleisch zuerst, obwohl die Taxonomie Milch und Eier vorn hat.
    const teil = teileHofseite(
      [p('lamm', 'FLEISCH'), p('eier', 'EIER'), p('kaese', 'MILCH'), p('wurst', 'FLEISCH')],
      null
    )
    expect(teil.sektionen.map((s) => [s.titel, s.produkte.map((x) => x.id)])).toEqual([
      ['Fleisch & Wurst', ['lamm', 'wurst']],
      ['Eier', ['eier']],
      ['Milch & Molkerei', ['kaese']],
    ])
  })

  it('ohne Kategorie landet ein Produkt bei Sonstiges im Hofladen', () => {
    const teil = teileHofseite([p('x', null), p('holz', 'SONSTIGES')], null)
    expect(teil.sektionen).toEqual([
      { kategorie: 'SONSTIGES', titel: 'Sonstiges', anker: 'kategorie-sonstiges', produkte: [p('x', null), p('holz', 'SONSTIGES')] },
    ])
  })

  it(`Sprungmarken erst ab ${SPRUNGMARKEN_AB} Produkten im gezeigten Bereich`, () => {
    const elf = Array.from({ length: SPRUNGMARKEN_AB - 1 }, (_, i) => p(`e${i}`, 'EIER'))
    expect(teileHofseite(elf, null).sprungmarken).toBe(false)
    expect(teileHofseite([...elf, p('milch', 'MILCH')], null).sprungmarken).toBe(true)
    // Futter zählt im Hofladen nicht mit.
    expect(teileHofseite([...elf, p('heu', 'HEU_STROH')], null).sprungmarken).toBe(false)
  })
})

describe('formatAbGrundpreis', () => {
  it('schreibt den günstigsten Kilopreis mit „ab" und auf Cent gerundet', () => {
    expect(formatAbGrundpreis({ wert: 0.1234, einheit: 'KG' })).toBe('ab € 0,12 / kg')
    expect(formatAbGrundpreis({ wert: 2, einheit: 'LITER' })).toBe('ab € 2,00 / L')
  })
})

describe('kilopreisNetto — die eine Rechenstelle', () => {
  it('Hofkarte und Produktkarte zeigen denselben Wert', () => {
    const wert = kilopreisNetto(45, 125)
    expect(wert).toBeCloseTo(0.36)
    expect(formatAbGrundpreis(grundpreisAusKennzeichnung(45, { nettoMenge: 125, nettoEinheit: 'KG' })!)).toBe(
      `ab ${formatGrundpreisNetto(45, 125, 'KG')}`
    )
  })

  it('ohne brauchbare Menge oder ohne Preis: null', () => {
    expect(kilopreisNetto(45, 0)).toBeNull()
    expect(kilopreisNetto(0, 25)).toBeNull()
    expect(kilopreisNetto(45, null)).toBeNull()
  })
})

describe('zeigeKaufknopf — Hofseite', () => {
  it('sichtbar, Bestand und kein Pause-Modus', () => {
    expect(zeigeKaufknopf({ isAvailable: true, stock: 1 }, false)).toBe(true)
    expect(zeigeKaufknopf({ isAvailable: true, stock: 0 }, false)).toBe(false)
    expect(zeigeKaufknopf({ isAvailable: false, stock: 5 }, false)).toBe(false)
    expect(zeigeKaufknopf({ isAvailable: true, stock: 5 }, true)).toBe(false)
  })
})

describe('kennzeichnungsZeilen — Pflichtangaben vor dem Kauf', () => {
  const HOF = { name: 'Hof Test', address: 'Teststraße 1', postalCode: '4910', city: 'Testdorf' }
  const MINIMAL = {
    futtermittelart: 'EINZELFUTTERMITTEL' as const,
    zielTierarten: [],
    zusammensetzung: '',
    analytischeBestandteile: '  ',
    zusatzstoffe: null,
    gebrauchshinweis: null,
    nettoMenge: 300,
    nettoEinheit: 'KG' as const,
    rohprotein: null,
    rohfaser: null,
    rohfett: null,
    rohasche: null,
    betriebsnummer: null,
  }

  it('Pflichtzeilen stehen immer da, auch leer — freiwillige fehlen ohne Inhalt', () => {
    expect(kennzeichnungsZeilen(MINIMAL, HOF)).toEqual([
      { titel: 'Art', wert: 'Einzelfuttermittel' },
      { titel: 'Für', wert: 'Nicht angegeben' },
      { titel: 'Zusammensetzung', wert: 'Nicht angegeben' },
      { titel: 'Analytische Bestandteile', wert: 'Nicht angegeben' },
      { titel: 'Nettomenge', wert: '300 kg je Gebinde' },
      { titel: 'Betriebsnummer', wert: 'Nicht angegeben' },
      { titel: 'Verantwortlich', wert: 'Hof Test, Teststraße 1, 4910 Testdorf' },
    ])
  })

  it('volle Kennzeichnung: Tiere, Gehalte, Zusatzstoffe, Gebrauchshinweis, Nummer', () => {
    const zeilen = kennzeichnungsZeilen(
      {
        ...MINIMAL,
        futtermittelart: 'ERGAENZUNGSFUTTERMITTEL',
        zielTierarten: ['PFERD', 'RIND'],
        zusammensetzung: 'Hafer, Gerste',
        analytischeBestandteile: 'Rohprotein 12 %',
        zusatzstoffe: 'Vitamin E',
        gebrauchshinweis: 'Täglich 200 g',
        nettoMenge: 12.5,
        rohprotein: 12,
        rohasche: 8.5,
        betriebsnummer: 'LFBIS-1234567',
      },
      HOF
    )
    expect(zeilen.map((z) => z.titel)).toEqual([
      'Art',
      'Für',
      'Zusammensetzung',
      'Analytische Bestandteile',
      'Gehalte',
      'Zusatzstoffe',
      'Nettomenge',
      'Gebrauchshinweis',
      'Betriebsnummer',
      'Verantwortlich',
    ])
    expect(zeilen.find((z) => z.titel === 'Für')?.wert).toBe('Pferde, Rinder')
    expect(zeilen.find((z) => z.titel === 'Gehalte')?.wert).toBe('Rohprotein 12 % · Rohasche 8,5 %')
    expect(zeilen.find((z) => z.titel === 'Nettomenge')?.wert).toBe('12,5 kg je Gebinde')
  })
})
