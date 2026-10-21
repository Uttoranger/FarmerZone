/**
 * Die Spanne als Streifen (Register N23, Konzept Umfeld §4/§6, Board
 * system-h5-region-eigene-teile §2) — rein, ohne Datenbank:
 *   - die Lage in Worten in allen fünf Fällen, in GANZEN Zahlen der kleinsten
 *     gezeigten Einheit (Cent; bei € / t und € / dt ganze Euro), samt der
 *     Grenze 3 % (genau 3 % ist „nahe"),
 *   - Streifen erst ab zwei Höfen mit verschiedenen Werten; ein Hof; gleiche
 *     Werte; zwei Gebindeklassen; mehrere eigene Produkte ohne Lage,
 *   - die Gründe für „nicht vergleichbar",
 *   - der Satz für Screenreader und die Darstellung ohne Namen, ohne Titel,
 *     ohne Antippen.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  NICHT_VERGLEICHBAR_TEXT,
  PREIS_LAGE_TEXT,
  baueUmfeldZeilen,
  median,
  preisLage,
  type UmfeldEingabe,
  type UmfeldHof,
  type UmfeldProdukt,
  type UmfeldZeile,
} from '@/lib/umfeld'
import { PreisStreifen } from '@/components/region/preis-streifen'

let zaehler = 0
beforeEach(() => {
  zaehler = 0
})

/** Ein Produkt mit Preis in Euro — die Abfrage liefert Cent aus dem Decimal. */
function produkt(teil: Partial<UmfeldProdukt> & { euro: number }): UmfeldProdukt {
  const { euro, ...rest } = teil
  zaehler += 1
  return {
    id: `prod-${zaehler}`,
    name: `Produkt ${zaehler}`,
    category: 'HONIG',
    subcategory: 'BLUETENHONIG',
    preisCents: Math.round(euro * 100),
    unit: 'KG',
    unitSize: null,
    nettoMenge: null,
    nettoEinheit: null,
    imageUrl: null,
    bildAusschnitt: null,
    kaufbar: true,
    ...rest,
  }
}

const milch = (euro: number) => produkt({ euro, category: 'MILCH', subcategory: 'TRINKMILCH', unit: 'LITER', unitSize: 1 })
const honig = (euro: number) => produkt({ euro })
const heu = (euro: number, kg: number) =>
  produkt({ euro, category: 'HEU_STROH', subcategory: 'WIESENHEU', unit: 'BALLEN', nettoMenge: kg, nettoEinheit: 'KG' })

function hof(entfernungKm: number, produkte: UmfeldProdukt[]): UmfeldHof {
  zaehler += 1
  return {
    slug: `testhof-${zaehler}`,
    name: `Testhof ${zaehler}`,
    postalCode: '1234',
    city: 'Testort',
    lat: 47.25,
    lon: 11.4,
    entfernungKm,
    fotos: [],
    kategorien: ['HONIG'],
    produkte,
  }
}

function eingabe(teil: Partial<UmfeldEingabe>): UmfeldEingabe {
  return { bereich: 'LEBENSMITTEL', km: 25, eigeneProdukte: [], hoefe: [], eigenerSlug: 'sonnhof', ...teil }
}

function zeile(teil: Partial<UmfeldEingabe>, titel: string): UmfeldZeile {
  const gefunden = baueUmfeldZeilen(eingabe(teil)).find((z) => z.titel === titel)
  if (!gefunden) throw new Error(`Zeile ${titel} fehlt`)
  return gefunden
}

describe('preisLage — die Lage in Worten, in ganzen Zahlen', () => {
  const spanne = { kleinst: 147, hoechst: 166, mitte: 158 }

  it('unter dem Kleinstwert: unter der Spanne', () => {
    expect(preisLage(146, spanne)).toBe('UNTER_SPANNE')
  })

  it('über dem Höchstwert: über der Spanne', () => {
    expect(preisLage(167, spanne)).toBe('UEBER_SPANNE')
  })

  it('genau 3 % von der Mitte entfernt gilt als nahe — darüber nicht mehr', () => {
    const s = { kleinst: 50, hoechst: 200, mitte: 100 }
    expect(preisLage(103, s)).toBe('NAHE_MITTE')
    expect(preisLage(97, s)).toBe('NAHE_MITTE')
    expect(preisLage(104, s)).toBe('UEBER_MITTE')
    expect(preisLage(96, s)).toBe('UNTER_MITTE')
  })

  it('sonst unter bzw. über der Mitte', () => {
    expect(preisLage(150, spanne)).toBe('UNTER_MITTE')
    expect(preisLage(164, spanne)).toBe('UEBER_MITTE')
  })

  it('die Spanne wird vor der Mitte geprüft — knapp unter dem Kleinstwert ist nie „nahe"', () => {
    expect(preisLage(99, { kleinst: 100, hoechst: 200, mitte: 101 })).toBe('UNTER_SPANNE')
    expect(preisLage(201, { kleinst: 100, hoechst: 200, mitte: 199 })).toBe('UEBER_SPANNE')
  })

  it('in ganzen Euro (€ / t): 5 von 170 ist nahe, 6 nicht', () => {
    const s = { kleinst: 150, hoechst: 190, mitte: 170 }
    expect(preisLage(175, s)).toBe('NAHE_MITTE')
    expect(preisLage(176, s)).toBe('UEBER_MITTE')
  })

  it('jede Lage hat ihre Worte — ohne Wertung', () => {
    expect(PREIS_LAGE_TEXT).toEqual({
      UNTER_SPANNE: 'unter der Spanne',
      UNTER_MITTE: 'unter der Mitte',
      NAHE_MITTE: 'nahe der Mitte',
      UEBER_MITTE: 'über der Mitte',
      UEBER_SPANNE: 'über der Spanne',
    })
  })
})

describe('median — die Mitte in ganzen Zahlen, so wie sie angezeigt wird', () => {
  it('ungerade: der mittlere Wert', () => {
    expect(median([166, 147, 158])).toBe(158)
  })

  it('gerade: die Mitte der beiden mittleren, kaufmännisch auf die ganze Zahl gerundet', () => {
    expect(median([100, 101])).toBe(101)
    expect(median([600, 400, 480, 500])).toBe(490)
  })
})

describe('Streifen — erst ab zwei Höfen mit verschiedenen Werten', () => {
  it('drei Höfe und „Deins" unter der Mitte: Werte ohne Namen, Spanne, Mitte, Lage und der Satz', () => {
    const z = zeile({ hoefe: [hof(6, [milch(1.47)]), hof(11, [milch(1.58)]), hof(19, [milch(1.66)])], eigeneProdukte: [milch(1.5)] }, 'Trinkmilch')
    const [preis] = z.preise
    expect(preis.spanne).toBe('€ 1,47 – 1,66 / L')
    expect(preis.mitte).toBe('Mitte € 1,58')
    expect(preis.lage).toBe('UNTER_MITTE')
    expect(preis.deins).toBe('Deins € 1,50 / L · unter der Mitte')
    expect(preis.streifen).toEqual({
      werte: [147, 158, 166],
      kleinst: 147,
      hoechst: 166,
      mitte: 158,
      deins: 150,
      kleinstText: '€ 1,47',
      hoechstText: '€ 1,66',
      satz: '3 Höfe von € 1,47 bis € 1,66 / L, Mitte € 1,58; deiner € 1,50, unter der Mitte',
    })
  })

  it('„Deins" über der Spanne: Streifen und Lage auch außerhalb', () => {
    const z = zeile({ hoefe: [hof(3, [honig(15.8)]), hof(8, [honig(16.9)]), hof(12, [honig(18)])], eigeneProdukte: [honig(19)] }, 'Blütenhonig')
    expect(z.preise[0].lage).toBe('UEBER_SPANNE')
    expect(z.preise[0].streifen?.deins).toBe(1900)
    expect(z.preise[0].streifen?.satz).toBe('3 Höfe von € 15,80 bis € 18,00 / kg, Mitte € 16,90; deiner € 19,00, über der Spanne')
  })

  it('ohne eigenes Produkt: Streifen ohne „Deins", der Satz ohne „deiner"', () => {
    const z = zeile({ hoefe: [hof(3, [honig(1.2)]), hof(8, [honig(1.55)]), hof(12, [honig(1.9)])] }, 'Blütenhonig')
    expect(z.preise[0].streifen?.deins).toBeNull()
    expect(z.preise[0].lage).toBeNull()
    expect(z.preise[0].deins).toBeNull()
    expect(z.preise[0].streifen?.satz).toBe('3 Höfe von € 1,20 bis € 1,90 / kg, Mitte € 1,55')
  })

  it('ein Hof: kein Streifen, keine Lage — „nur 1 Angebot im Umkreis"', () => {
    const z = zeile({ hoefe: [hof(4, [honig(2.9)])], eigeneProdukte: [honig(2.5)] }, 'Blütenhonig')
    expect(z.anzahlText).toBe('1 Hof')
    expect(z.preise[0]).toMatchObject({ spanne: '€ 2,90 / kg', zusatz: 'nur 1 Angebot im Umkreis', mitte: null, streifen: null, lage: null })
    expect(z.preise[0].deins).toBe('Deins € 2,50 / kg')
  })

  it('gleiche Werte: die Zeile wie bisher, ohne Streifen, ohne Mitte und ohne Lage', () => {
    const z = zeile({ hoefe: [hof(4, [honig(1.2)]), hof(9, [honig(1.2)])], eigeneProdukte: [honig(1.3)] }, 'Blütenhonig')
    expect(z.preise[0]).toMatchObject({ spanne: '€ 1,20 / kg', zusatz: null, mitte: null, streifen: null, lage: null, deins: 'Deins € 1,30 / kg' })
  })

  it('mehrere eigene Produkte: „Deins" ist eine Spanne — kein grüner Punkt, keine Lage', () => {
    const z = zeile({ hoefe: [hof(3, [milch(1.47)]), hof(8, [milch(1.66)])], eigeneProdukte: [milch(1.4), milch(1.6)] }, 'Trinkmilch')
    expect(z.preise[0].deins).toBe('Deins € 1,40 – 1,60 / L')
    expect(z.preise[0].lage).toBeNull()
    expect(z.preise[0].streifen).toMatchObject({ werte: [147, 166], deins: null, satz: '2 Höfe von € 1,47 bis € 1,66 / L, Mitte € 1,57' })
  })

  it('Futter: je Gebindeklasse ein Streifen in € / t, mit den Klassen in Worten', () => {
    const z = zeile(
      {
        bereich: 'FUTTERMITTEL',
        hoefe: [hof(2, [heu(6, 15), heu(40, 250)]), hof(5, [heu(9, 15)]), hof(9, [heu(47.5, 250)])],
        eigeneProdukte: [heu(43, 250)],
      },
      'Wiesenheu'
    )
    expect(z.preise.map((p) => p.klasse)).toEqual(['Kleingebinde bis 25 kg', 'Großgebinde über 25 kg'])
    expect(z.preise[0].streifen).toMatchObject({ werte: [400, 600], mitte: 500, deins: null })
    expect(z.preise[1].streifen).toMatchObject({ werte: [160, 190], mitte: 175, deins: 172 })
    expect(z.preise[1].deins).toBe('Deins € 172 / t · nahe der Mitte')
    expect(z.preise[1].streifen?.satz).toBe('2 Höfe von € 160 bis € 190 / t, Mitte € 175; deiner € 172, nahe der Mitte')
  })

  it('rechnet mit den Werten, wie sie angezeigt werden: € 2,01 für 2 kg sind € 1,01 / kg', () => {
    const z = zeile({ hoefe: [hof(3, [produkt({ euro: 2.01, unitSize: 2 })]), hof(5, [honig(1.2)])] }, 'Blütenhonig')
    expect(z.preise[0].streifen?.werte).toEqual([101, 120])
    expect(z.preise[0].spanne).toBe('€ 1,01 – 1,20 / kg')
  })
})

describe('nicht vergleichbar — mit Grund, aus einer Tabelle', () => {
  it('Stück und Paket ohne Gewicht', () => {
    expect(zeile({ hoefe: [hof(3, [produkt({ euro: 4, category: 'BROT', subcategory: null, unit: 'STUECK' })])] }, 'Brot & Gebäck').hinweis).toBe(
      'Preis je Stück, nicht vergleichbar – ohne Gewicht je Stück.'
    )
    expect(zeile({ hoefe: [hof(3, [produkt({ euro: 4, category: 'BROT', subcategory: null, unit: 'PAKET' })])] }, 'Brot & Gebäck').hinweis).toBe(
      NICHT_VERGLEICHBAR_TEXT.PAKET
    )
  })

  it('Liter in einer Kilo-Zeile und Kilo in einer Liter-Zeile', () => {
    expect(zeile({ hoefe: [hof(3, [produkt({ euro: 8, unit: 'LITER', unitSize: 0.5 })])] }, 'Blütenhonig').hinweis).toBe(
      'nicht vergleichbar – Liter und Kilo vergleichen wir nicht.'
    )
    expect(zeile({ hoefe: [hof(3, [produkt({ euro: 1.4, category: 'MILCH', subcategory: 'TRINKMILCH', unit: 'KG' })])] }, 'Trinkmilch').hinweis).toBe(
      NICHT_VERGLEICHBAR_TEXT.LITER_KILO
    )
  })

  it('verschiedene Gründe in einer Zeile: schlicht nicht vergleichbar', () => {
    const z = zeile(
      { hoefe: [hof(3, [produkt({ euro: 4, category: 'BROT', subcategory: null, unit: 'STUECK' })]), hof(5, [produkt({ euro: 4, category: 'BROT', subcategory: null, unit: 'PAKET' })])] },
      'Brot & Gebäck'
    )
    expect(z.hinweis).toBe(NICHT_VERGLEICHBAR_TEXT.GEMISCHT)
  })

  it('Eier im Paket bleiben nicht vergleichbar: unitSize zählt dort Pakete, nicht Stück (Punkt 3 gestoppt)', () => {
    const eier = produkt({ euro: 4.2, category: 'EIER', subcategory: 'EIER_FREILAND', unit: 'PAKET', unitSize: 10 })
    const z = zeile({ hoefe: [hof(3, [eier]), hof(5, [{ ...eier, id: 'prod-eier', preisCents: 380 }])] }, 'Freiland')
    expect(z.preise).toEqual([])
    expect(z.hinweis).toBe(NICHT_VERGLEICHBAR_TEXT.PAKET)
  })
})

describe('PreisStreifen — ein Bild mit Satz, ohne Namen und ohne Antippen', () => {
  const daten = {
    werte: [147, 158, 166],
    kleinst: 147,
    hoechst: 166,
    mitte: 158,
    deins: 150,
    kleinstText: '€ 1,47',
    hoechstText: '€ 1,66',
    satz: '3 Höfe von € 1,47 bis € 1,66 / L, Mitte € 1,58; deiner € 1,50, unter der Mitte',
  }

  it('ist role="img" mit dem ganzen Satz; je Hof ein Punkt, die Mitte, „Deins" und die Enden', () => {
    const html = renderToStaticMarkup(createElement(PreisStreifen, { streifen: daten }))
    expect(html).toContain('role="img"')
    expect(html).toContain(`aria-label="${daten.satz}"`)
    expect(html.match(/data-punkt="hof"/g)).toHaveLength(3)
    expect(html.match(/data-punkt="deins"/g)).toHaveLength(1)
    expect(html.match(/data-punkt="mitte"/g)).toHaveLength(1)
    expect(html).toContain('>Deins<')
    expect(html).toContain('€ 1,47')
    expect(html).toContain('€ 1,66')
  })

  it('die Punkte tragen keinen Namen, keinen Titel und keinen Tooltip und sind nicht fokussierbar', () => {
    const html = renderToStaticMarkup(createElement(PreisStreifen, { streifen: daten }))
    for (const verboten of ['title=', 'tabindex', '<button', '<a ', 'role="button"', 'aria-describedby', 'onclick']) {
      expect(html.toLowerCase()).not.toContain(verboten)
    }
    // Gegenprobe: Der Satz steht genau einmal da — als Beschriftung des Bilds.
    expect(html.split(daten.satz)).toHaveLength(2)
  })

  /** Das Element mit `data-ende="…"` als Text samt Attributen. */
  const ende = (html: string, art: string) => html.match(new RegExp(`<span data-ende="${art}"[^>]*>[^<]*`))?.[0] ?? ''

  it('„Deins" innerhalb: Kleinst- und Höchstwert an den Enden der Spur', () => {
    const html = renderToStaticMarkup(createElement(PreisStreifen, { streifen: daten }))
    expect(ende(html, 'kleinst')).toContain('left-0')
    expect(ende(html, 'kleinst')).toContain('€ 1,47')
    expect(ende(html, 'hoechst')).toContain('right-0')
    expect(ende(html, 'hoechst')).toContain('€ 1,66')
  })

  it('„Deins" über der Spanne: der Höchstwert steht unter dem Ende der Spanne, nicht unter „Deins"', () => {
    // Skala 147–175: das Ende der Spanne (166) liegt bei 19/28 der Spur.
    const html = renderToStaticMarkup(createElement(PreisStreifen, { streifen: { ...daten, deins: 175 } }))
    const hoechst = ende(html, 'hoechst')
    expect(hoechst).not.toContain('right-0')
    expect(hoechst).toContain(`${19 / 28} *`)
    expect(hoechst).toContain('translateX(-50%)')
    expect(ende(html, 'kleinst')).toContain('left-0')
  })

  it('„Deins" unter der Spanne: der Kleinstwert steht unter dem Ende der Spanne', () => {
    // Skala 120–166: das Ende der Spanne (147) liegt bei 27/46 der Spur.
    const html = renderToStaticMarkup(createElement(PreisStreifen, { streifen: { ...daten, deins: 120 } }))
    const kleinst = ende(html, 'kleinst')
    expect(kleinst).not.toContain('left-0')
    expect(kleinst).toContain(`${27 / 46} *`)
    expect(ende(html, 'hoechst')).toContain('right-0')
  })

  it('liegen die Enden der Spanne eng (Deins weit draußen), steht ein gemeinsames „von – bis" unter der Spanne', () => {
    const html = renderToStaticMarkup(createElement(PreisStreifen, { streifen: { ...daten, deins: 220 } }))
    expect(ende(html, 'spanne')).toContain('€ 1,47 – € 1,66')
    expect(html).not.toContain('data-ende="kleinst"')
    expect(html).not.toContain('data-ende="hoechst"')
  })

  it('ohne „Deins" kein grüner Punkt und kein Wort „Deins"', () => {
    const html = renderToStaticMarkup(createElement(PreisStreifen, { streifen: { ...daten, deins: null, satz: '3 Höfe von € 1,47 bis € 1,66 / L, Mitte € 1,58' } }))
    expect(html).not.toContain('data-punkt="deins"')
    expect(html).not.toContain('Deins')
    expect(html.match(/data-punkt="hof"/g)).toHaveLength(3)
  })
})
