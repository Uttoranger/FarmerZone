/**
 * Die Produktseite /[farmSlug]/produkt/[id] (Nachtlauf Nr. 11, Gate 4 —
 * Mockups web-k2-futter-groesse-waehlen, web-k2-brennmaterial-brennholz,
 * mobil-k2-*), rein und ohne Browser.
 *
 * Beweist:
 *  - Sichtbarkeit wie auf der Hofseite: nur ein Produkt dieses Hofs, das im
 *    Shop steht (isAvailable) — ein fremdes oder ausgeblendetes Produkt gibt
 *    es hier nicht.
 *  - Produktfamilie (E3): Kacheln nur für sichtbare Produkte derselben
 *    familieId und erst ab zwei Größen; ohne familieId keine. Die gewählte
 *    Größe aus ?groesse= gilt nur innerhalb der Familie.
 *  - Grundpreis = Preis ÷ Nettomenge je Gebinde, centgenau (kaufmännisch
 *    gerundet in ganzen Zahlen, nie über Fließkomma-Geld).
 *  - Vorrat aus dem echten Bestand mit derselben Regel wie die Hofseiten-Karte
 *    (knapp ≤ 5), Mengengrenze am Bestand abzüglich Korb.
 *  - Schild nach E9 nur mit LFBIS-Status und Nummer, ohne „geprüft".
 *  - „Gleich mit abholen": andere Produkte desselben Hofs, je Familie eins,
 *    Kaufbares zuerst.
 *  - Links: Produktseite, Vorschau, Rückweg zu allen Produkten.
 */
import { describe, it, expect } from 'vitest'
import { formatGrundpreisNetto, formatGrundpreisZeile, grundpreisJeEinheit } from '@/lib/format'
import { kartenZustand } from '@/lib/bereiche-anzeige'
import {
  alleProdukteLink,
  bestaetigtAmText,
  brennmaterialZeilen,
  futterSchild,
  gewaehlteGroesse,
  gleichMitAbholen,
  groesseAdresse,
  groessenKacheln,
  kaufBetragCents,
  mengeNochMoeglich,
  produktAngaben,
  produktFamilie,
  produktLink,
  produktMetadaten,
  produktPfad,
  sichtbaresProdukt,
  vorratText,
  zweitePreiszeile,
} from '@/lib/produktdetail'
import { leseGroesse } from '@/schemas/produktdetail'
import type { PublicFutter, PublicProduct } from '@/server/queries/farm'
import type { ProductCategoryValue } from '@/lib/taxonomie'

function produkt(id: string, teil: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id, name: `Produkt ${id}`, description: null, imageUrl: null, category: 'GEMUESE' as ProductCategoryValue,
    categoryImageUrl: null, price: 4.5, unit: 'STUECK', unitSize: null, stock: 20, isAvailable: true,
    allergens: [], isOrganic: false, requiresCool: false, requiresFreezer: false, seasonStart: null, seasonEnd: null,
    unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE', futter: null,
    familieId: null, brennmaterial: null,
    ...teil,
  }
}

function futter(teil: Partial<PublicFutter> = {}): PublicFutter {
  return {
    futtermittelart: 'EINZELFUTTERMITTEL', zielTierarten: ['PFERD'], zusammensetzung: 'Wiesenheu',
    analytischeBestandteile: 'Rohprotein 9 %', zusatzstoffe: null, gebrauchshinweis: null,
    nettoMenge: 5, nettoEinheit: 'KG', rohprotein: null, rohfaser: null, rohfett: null, rohasche: null,
    betriebsnummer: '1234567', bestaetigtAm: '2026-09-20T22:30:00.000Z',
    ...teil,
  }
}

const HOF = { name: 'Hof Test', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf' }

describe('Sichtbarkeit wie auf der Hofseite', () => {
  const produkte = [produkt('p_a'), produkt('p_aus', { isAvailable: false }), produkt('p_leer', { stock: 0 })]

  it('findet ein sichtbares Produkt dieses Hofs', () => {
    expect(sichtbaresProdukt(produkte, 'p_a')?.id).toBe('p_a')
  })

  it('auch ausverkauft bleibt es sichtbar — wie auf der Hofseite, dort mit „Ausverkauft"', () => {
    expect(sichtbaresProdukt(produkte, 'p_leer')?.id).toBe('p_leer')
  })

  it('ein ausgeblendetes Produkt (nicht im Shop) gibt es hier nicht', () => {
    expect(sichtbaresProdukt(produkte, 'p_aus')).toBeNull()
  })

  it('ein Produkt, das nicht zu diesem Hof gehört, gibt es hier nicht — die ID allein reicht nie', () => {
    expect(sichtbaresProdukt(produkte, 'p_fremd')).toBeNull()
  })
})

describe('Produktfamilie (E3)', () => {
  const produkte = [
    produkt('p_1kg', { familieId: 'fam_heu', name: 'Bergwiesen-Heu 1 kg-Sackerl', price: 2.5, futter: futter({ nettoMenge: 1 }) }),
    produkt('p_eier'),
    produkt('p_5kg', { familieId: 'fam_heu', name: 'Bergwiesen-Heu 5 kg-Sack', price: 8, futter: futter({ nettoMenge: 5 }), stock: 3 }),
    produkt('p_rund', { familieId: 'fam_heu', name: 'Bergwiesen-Heu Rundballen', price: 45, futter: futter({ nettoMenge: 250 }), unit: 'BALLEN', stock: 0 }),
    produkt('p_versteckt', { familieId: 'fam_heu', isAvailable: false }),
    produkt('p_stroh', { familieId: 'fam_stroh' }),
  ]

  it('alle sichtbaren Größen derselben Familie, in der Reihenfolge des Hofs', () => {
    expect(produktFamilie(produkte, produkte[0]!).map((p) => p.id)).toEqual(['p_1kg', 'p_5kg', 'p_rund'])
  })

  it('ohne familieId keine Kacheln', () => {
    expect(produktFamilie(produkte, produkte[1]!)).toEqual([])
  })

  it('eine Familie mit nur einer sichtbaren Größe zeigt keine Kacheln', () => {
    expect(produktFamilie(produkte, produkte[5]!)).toEqual([])
  })

  it('?groesse= gilt nur innerhalb der Familie — sonst bleibt das Produkt aus der Adresse', () => {
    const familie = produktFamilie(produkte, produkte[0]!)
    expect(gewaehlteGroesse(familie, produkte[0]!, 'p_5kg').id).toBe('p_5kg')
    expect(gewaehlteGroesse(familie, produkte[0]!, 'p_eier').id).toBe('p_1kg')
    expect(gewaehlteGroesse(familie, produkte[0]!, 'p_versteckt').id).toBe('p_1kg')
    expect(gewaehlteGroesse(familie, produkte[0]!, null).id).toBe('p_1kg')
    expect(gewaehlteGroesse([], produkte[1]!, 'p_5kg').id).toBe('p_eier')
  })

  it('Kacheln: Größe, Menge, Preis je Gebinde, Kilopreis und Vorrat', () => {
    const kacheln = groessenKacheln(produktFamilie(produkte, produkte[0]!), false)
    expect(kacheln.map((k) => k.name)).toEqual(['1 kg-Sackerl', '5 kg-Sack', 'Rundballen'])
    // Steht die Menge schon im Namen („5 kg-Sack"), steht sie nicht noch einmal darunter.
    expect(kacheln[1]).toMatchObject({ id: 'p_5kg', hinweis: null, preis: '€ 8,00', grundpreis: '€ 1,60 / kg', vorrat: 'nur noch 3 Stück', zustand: 'knapp' })
    expect(kacheln[2]).toMatchObject({ hinweis: '250 kg', preis: '€ 45,00', grundpreis: '€ 0,18 / kg', vorrat: 'ausverkauft', zustand: 'ausverkauft' })
    expect(kacheln[0]).toMatchObject({ grundpreis: '€ 2,50 / kg', vorrat: 'noch 20 Stück', zustand: 'normal' })
  })

  it('ohne gemeinsamen Namensanfang heißt die Kachel wie das Produkt', () => {
    const familie = [produkt('a', { familieId: 'f', name: 'Kleinballen' }), produkt('b', { familieId: 'f', name: 'Rundballen' })]
    expect(groessenKacheln(familie, false).map((k) => k.name)).toEqual(['Kleinballen', 'Rundballen'])
  })

  it('ohne Familie keine Kacheln — und kein Hängen', () => {
    expect(groessenKacheln([], false)).toEqual([])
    expect(groessenKacheln([produkt('einzeln', { name: 'Eier' })], false).map((k) => k.name)).toEqual(['Eier'])
  })

  it('pausiert: kein „ausverkauft" erfunden, die Kachel bleibt wählbar', () => {
    const kacheln = groessenKacheln(produktFamilie(produkte, produkte[0]!), true)
    expect(kacheln[0]).toMatchObject({ zustand: 'normal', vorrat: null })
  })
})

describe('Grundpreis centgenau', () => {
  it('Preis ÷ Nettomenge je Gebinde', () => {
    expect(formatGrundpreisNetto(8, 5, 'KG')).toBe('€ 1,60 / kg')
    expect(formatGrundpreisNetto(45, 250, 'KG')).toBe('€ 0,18 / kg')
    expect(formatGrundpreisNetto(4.5, 15, 'KG')).toBe('€ 0,30 / kg')
  })

  it('kaufmännisch gerundet ohne Fließkommafehler: € 2,01 für 2 kg sind € 1,01 / kg (nicht € 1,00)', () => {
    // 2.01 / 2 * 100 ist in Fließkomma 100,49999999999999 — Math.round gäbe 100.
    expect(formatGrundpreisNetto(2.01, 2, 'KG')).toBe('€ 1,01 / kg')
    expect(formatGrundpreisZeile(2.01, 'KG', 2)).toBe('€ 1,01 / kg')
    expect(grundpreisJeEinheit(2.01, 2)).toBe(1.01)
  })

  it('Gegenprobe: dieselben Werte wie bisher, wo Fließkomma nicht stolpert', () => {
    expect(formatGrundpreisZeile(3, 'G', 500)).toBe('€ 0,01 / g')
    expect(formatGrundpreisZeile(50, 'KG', 2)).toBe('€ 25,00 / kg')
    expect(grundpreisJeEinheit(10, 3)).toBe(3.33)
    expect(formatGrundpreisNetto(0, 5, 'KG')).toBeNull()
    expect(formatGrundpreisNetto(8, 0, 'KG')).toBeNull()
  })

  it('die zweite Preiszeile: Kilopreis bei Futter, sonst Grundpreis, bei Stück keine', () => {
    expect(zweitePreiszeile(produkt('f', { price: 8, futter: futter({ nettoMenge: 5 }) }))).toBe('€ 1,60 / kg')
    expect(zweitePreiszeile(produkt('h', { price: 6, unit: 'G', unitSize: 500 }))).toBe('€ 0,01 / g')
    expect(zweitePreiszeile(produkt('k', { price: 7, unit: 'KG', unitSize: 2 }))).toBe('€ 3,50 / kg')
    expect(zweitePreiszeile(produkt('s'))).toBeNull()
  })
})

describe('Vorrat und Menge', () => {
  it('dieselbe Schwelle wie die Hofseiten-Karte: knapp ab 5, ausverkauft bei 0', () => {
    const vorrat = (stock: number) => {
      const p = produkt('p', { stock })
      return vorratText(p, kartenZustand(p, false))
    }
    expect(vorrat(6)).toBe('noch 6 Stück')
    expect(vorrat(5)).toBe('nur noch 5 Stück')
    expect(vorrat(1)).toBe('nur noch 1 Stück')
    expect(vorrat(0)).toBe('ausverkauft')
  })

  it('Gebinde zählen als Gebinde', () => {
    const p = produkt('p', { stock: 4, unit: 'KG', unitSize: 2 })
    expect(vorratText(p, kartenZustand(p, false))).toBe('nur noch 4 × 2 kg')
  })

  it('pausiert: kein Vorrat', () => {
    const p = produkt('p')
    expect(vorratText(p, kartenZustand(p, true))).toBeNull()
  })

  it('die Mengengrenze ist der Bestand abzüglich dessen, was schon im Korb liegt', () => {
    expect(mengeNochMoeglich(10, 0)).toBe(10)
    expect(mengeNochMoeglich(10, 7)).toBe(3)
    expect(mengeNochMoeglich(10, 10)).toBe(0)
    expect(mengeNochMoeglich(3, 5)).toBe(0)
    expect(mengeNochMoeglich(0, 0)).toBe(0)
  })

  it('der Betrag am Knopf in ganzen Cent — 3 × € 1,10 sind 330, nicht 330,00000000000006', () => {
    expect(kaufBetragCents(1.1, 3)).toBe(330)
    expect(kaufBetragCents(19.99, 7)).toBe(13993)
    expect(kaufBetragCents(8, 1)).toBe(800)
  })
})

describe('Schild nach E9', () => {
  const heu = produkt('heu', { category: 'HEU_STROH', futter: futter() })

  it('LFBIS: „Futtermittelbetrieb · LFBIS <Nummer>", sofort, ohne Prüfvermerk', () => {
    const schild = futterSchild(heu, 'PRIMAERPRODUKTION')
    expect(schild).toBe('Futtermittelbetrieb · LFBIS 1234567')
    expect(schild).not.toMatch(/geprüft/i)
  })

  it('steht das Kürzel schon in der Nummer, steht es nicht doppelt da', () => {
    for (const nummer of ['LFBIS 1234567', 'lfbis: 1234567', 'LFBIS-1234567']) {
      expect(futterSchild(produkt('heu', { category: 'HEU_STROH', futter: futter({ betriebsnummer: nummer }) }), 'PRIMAERPRODUKTION')).toBe('Futtermittelbetrieb · LFBIS 1234567')
    }
  })

  it('ohne Nummer, ohne Status oder mit anderem Status kein Schild', () => {
    expect(futterSchild(produkt('heu', { category: 'HEU_STROH', futter: futter({ betriebsnummer: null }) }), 'PRIMAERPRODUKTION')).toBeNull()
    expect(futterSchild(heu, null)).toBeNull()
    expect(futterSchild(heu, 'REGISTRIERT')).toBeNull()
  })

  it('nur bei Futtermitteln', () => {
    expect(futterSchild(produkt('eier', { category: 'EIER' }), 'PRIMAERPRODUKTION')).toBeNull()
  })
})

describe('„Gleich mit abholen"', () => {
  const einstieg = produkt('p_heu5', { familieId: 'fam_heu' })
  const produkte = [
    produkt('p_heu1', { familieId: 'fam_heu' }),
    einstieg,
    produkt('p_leer', { stock: 0 }),
    produkt('p_stroh1', { familieId: 'fam_stroh' }),
    produkt('p_stroh2', { familieId: 'fam_stroh' }),
    produkt('p_aus', { isAvailable: false }),
    produkt('p_eier'),
    produkt('p_karotten'),
  ]

  it('andere sichtbare Produkte, nie die eigene Familie, je Familie eins, Kaufbares zuerst, höchstens drei', () => {
    expect(gleichMitAbholen(produkte, einstieg, false).map((p) => p.id)).toEqual(['p_stroh1', 'p_eier', 'p_karotten'])
  })

  it('reicht Kaufbares nicht, füllt Ausverkauftes auf', () => {
    expect(gleichMitAbholen(produkte, einstieg, false, 5).map((p) => p.id)).toEqual(['p_stroh1', 'p_eier', 'p_karotten', 'p_leer'])
  })

  it('pausiert: nichts zum Mitnehmen', () => {
    expect(gleichMitAbholen(produkte, einstieg, true)).toEqual([])
  })
})

describe('Angaben und Brennmaterial', () => {
  it('Futter: die Kennzeichnung mit „laut Angabe des Hofs" (E9)', () => {
    const zeilen = produktAngaben(produkt('heu', { category: 'HEU_STROH', futter: futter() }), HOF)
    expect(zeilen).toContainEqual({ titel: 'Betriebsnummer', wert: '1234567 (laut Angabe des Hofs)' })
    expect(zeilen).toContainEqual({ titel: 'Verantwortlich', wert: 'Hof Test, Musterweg 1, 4900 Musterdorf' })
  })

  it('Lebensmittel: Allergene, Lagerung, Saison, Herkunft — was es heute gibt', () => {
    const zeilen = produktAngaben(
      produkt('k', { allergens: ['Milch', 'Ei'], requiresCool: true, seasonStart: 5, seasonEnd: 9 }),
      HOF
    )
    expect(zeilen.map((z) => z.titel)).toEqual(['Allergene', 'Lagerung', 'Saison', 'Herkunft'])
    expect(zeilen[0]!.wert).toBe('Enthält Milch, Ei')
    expect(zeilen[3]!.wert).toBe('Hof Test, 4900 Musterdorf')
  })

  it('ohne Angaben bleibt die Herkunft', () => {
    expect(produktAngaben(produkt('k'), HOF)).toEqual([{ titel: 'Herkunft', wert: 'Hof Test, 4900 Musterdorf' }])
  })

  it('Brennmaterial nennt Holzart, Scheitlänge und Trocknung', () => {
    const zeilen = brennmaterialZeilen({
      holzart: 'Buche', scheitlaengeCm: 33, trocknung: 'OFENFERTIG', restfeuchteMax: 20,
      wassergehalt: null, koernung: null, ueberdacht: true,
    })
    expect(zeilen).toEqual([
      { titel: 'Holzart', wert: 'Buche' },
      { titel: 'Scheitlänge', wert: '33 cm' },
      { titel: 'Trocknung', wert: 'Ofenfertig, unter 20 % Restfeuchte' },
      { titel: 'Lagerung', wert: 'überdacht gelagert' },
    ])
  })

  it('Hackschnitzel: Wassergehalt und Körnung', () => {
    const zeilen = brennmaterialZeilen({
      holzart: 'Fichte', scheitlaengeCm: null, trocknung: 'LUFTTROCKEN', restfeuchteMax: null,
      wassergehalt: 30, koernung: 31, ueberdacht: false,
    })
    expect(zeilen).toEqual([
      { titel: 'Holzart', wert: 'Fichte' },
      { titel: 'Trocknung', wert: 'Lufttrocken' },
      { titel: 'Wassergehalt', wert: 'W30' },
      { titel: 'Körnung', wert: 'P31' },
    ])
  })

  it('das Bestätigungsdatum ist ein Wiener Kalendertag', () => {
    // 22:30 UTC am 20. September ist in Wien schon der 21.
    expect(bestaetigtAmText('2026-09-20T22:30:00.000Z')).toBe('21. September 2026')
  })
})

describe('Links und Adresse', () => {
  it('die Produktseite hängt am Hof', () => {
    expect(produktPfad('hof-test', 'p_1')).toBe('/hof-test/produkt/p_1')
    expect(produktLink('hof-test', 'p_1', false)).toBe('/hof-test/produkt/p_1')
  })

  it('aus der Vorschau des Hofs bleibt es die Vorschau', () => {
    expect(produktLink('hof-test', 'p_1', true)).toBe('/hof-test/produkt/p_1?vorschau=1')
    expect(alleProdukteLink('hof-test', true)).toBe('/hof-test?vorschau=1&reiter=produkte')
  })

  it('zurück zu allen Produkten: der Reiter Produkte der Hofseite', () => {
    expect(alleProdukteLink('hof-test', false)).toBe('/hof-test?reiter=produkte')
  })

  it('nach einer Größenwahl: ?groesse= in der Adresse, die übrigen Parameter bleiben', () => {
    expect(groesseAdresse('/hof-test/produkt/p_1kg', '', 'p_5kg', 'p_1kg')).toBe('/hof-test/produkt/p_1kg?groesse=p_5kg')
    expect(groesseAdresse('/hof-test/produkt/p_1kg', 'vorschau=1&groesse=p_5kg', 'p_rund', 'p_1kg')).toBe('/hof-test/produkt/p_1kg?vorschau=1&groesse=p_rund')
    // Zurück auf die Größe aus dem Pfad: kein Parameter mehr.
    expect(groesseAdresse('/hof-test/produkt/p_1kg', 'groesse=p_5kg', 'p_1kg', 'p_1kg')).toBe('/hof-test/produkt/p_1kg')
  })

  it('?groesse= wird geprüft, Unsinn fällt still weg', () => {
    expect(leseGroesse('p_5kg')).toBe('p_5kg')
    expect(leseGroesse(['p_a', 'p_b'])).toBe('p_b')
    expect(leseGroesse(undefined)).toBeNull()
    expect(leseGroesse('')).toBeNull()
    expect(leseGroesse('<script>')).toBeNull()
    expect(leseGroesse('x'.repeat(65))).toBeNull()
  })
})

describe('Metadaten nur aus öffentlichen Daten', () => {
  it('Titel aus Produkt und Hof, Beschreibung aus der Produktbeschreibung', () => {
    const m = produktMetadaten(produkt('p', { name: 'Bergwiesen-Heu', description: 'Erster Schnitt.\nLuftig getrocknet.' }), HOF)
    expect(m.titel).toBe('Bergwiesen-Heu — Hof Test')
    expect(m.beschreibung).toBe('Erster Schnitt. Luftig getrocknet.')
  })

  it('ohne Beschreibung: Preis und Hof', () => {
    expect(produktMetadaten(produkt('p', { name: 'Eier' }), HOF).beschreibung).toBe('Eier bei Hof Test, Musterdorf — € 4,50 / Stück')
  })

  it('höchstens 155 Zeichen', () => {
    expect(produktMetadaten(produkt('p', { description: 'a'.repeat(400) }), HOF).beschreibung).toHaveLength(155)
  })
})
