/**
 * Tests für die Zod-Regeln aus Sprint Bereiche 1 (docs/konzepte/bereiche.md §4,
 * Rückfragen F2–F7). Eine Regel je describe, benannt wie in der freigegebenen
 * Liste (P1–P14 Produkt, C1–C5 Checkout, H1–H2 Hof).
 */
import { describe, it, expect } from 'vitest'
import { productFormSchema, FUTTER_FEHLER, unitOptionsFuer } from '@/schemas/product'
import { checkoutFormSchema, checkoutRequestSchema } from '@/schemas/checkout'
import { hofBetriebsnummerSchema, betriebsstatusSchema, BETRIEBSNUMMER_ZU_KURZ } from '@/schemas/betrieb'
import {
  pruefeBetriebsnachweis,
  betriebsnummerFuerBestellung,
  BETRIEBSNACHWEIS_FEHLER,
} from '@/lib/betriebsnachweis'

const futterGueltig = {
  futtermittelart: 'EINZELFUTTERMITTEL',
  zielTierarten: ['PFERD'],
  zusammensetzung: 'Wiesenheu vom ersten Schnitt',
  analytischeBestandteile: 'Rohprotein 9 %, Rohfaser 28 %',
  nettoMenge: '300',
  nettoEinheit: 'KG',
  rohprotein: '',
  rohfaser: '',
  rohfett: '',
  rohasche: '',
  zusatzstoffe: '',
  gebrauchshinweis: '',
  bestaetigt: true,
}

const heu = {
  name: 'Heu Rundballen',
  price: 45,
  unit: 'BALLEN',
  category: 'HEU_STROH',
  subcategory: 'WIESENHEU',
  futter: futterGueltig,
}

const eier = { name: 'Eier', price: 3.6, unit: 'PAKET', category: 'EIER' }

function fehler(input: unknown): Record<string, string> {
  const ergebnis = productFormSchema.safeParse(input)
  if (ergebnis.success) return {}
  // Erste Meldung je Pfad — so zeigt das Formular sie auch an.
  const nachPfad: Record<string, string> = {}
  for (const i of ergebnis.error.issues) nachPfad[i.path.join('.')] ??= i.message
  return nachPfad
}

describe('P1 — Altlast-Kategorie FUTTERMITTEL', () => {
  it('wird mit dem Hinweis auf die neuen Kategorien abgelehnt', () => {
    const f = fehler({ ...heu, category: 'FUTTERMITTEL', subcategory: null })
    expect(f['category']).toBe(
      'Diese Kategorie gibt es nicht mehr — bitte Heu & Stroh, Getreide & Körner, Mischfutter oder Ergänzungsfutter wählen.'
    )
  })
})

describe('P2 — Altlast-Unterkategorie', () => {
  it('lehnt einen Rechtsbegriff als Unterkategorie ab, mit demselben Text', () => {
    const f = fehler({ ...heu, category: 'GETREIDE_KOERNER', subcategory: 'EINZELFUTTERMITTEL' })
    expect(f['subcategory']).toBe(FUTTER_FEHLER.altlast)
  })

  it('auch außerhalb der Futtermittel', () => {
    expect(fehler({ ...eier, subcategory: 'MISCHFUTTERMITTEL' })['subcategory']).toBe(FUTTER_FEHLER.altlast)
  })
})

describe('P3/P4 — Kennzeichnung nur und immer im Bereich Futtermittel', () => {
  it('fehlt sie bei Heu & Stroh, ist das ein Fehler', () => {
    expect(fehler({ ...heu, futter: null })['futter']).toBe(
      'Bei Futtermitteln brauchen wir die Kennzeichnung vom Sackanhänger.'
    )
  })

  it('bei Eiern ist sie verboten — neuer Wortlaut ohne die alte Kategorie', () => {
    expect(fehler({ ...eier, futter: futterGueltig })['futter']).toBe(
      'Eine Futter-Kennzeichnung gibt es nur bei Futtermitteln.'
    )
  })
})

describe('P5 — Unterkategorie gehört zur Kategorie', () => {
  it('Hafer passt nicht zu Heu & Stroh', () => {
    expect(fehler({ ...heu, subcategory: 'HAFER' })['subcategory']).toBe(
      'Diese Unterkategorie passt nicht zu Heu & Stroh.'
    )
  })
})

describe('P6 — Sorte Pflicht, wo die Futter-Kategorie welche hat (F2)', () => {
  it('Heu & Stroh ohne Sorte: Fehler mit dem neuen Wortlaut', () => {
    expect(fehler({ ...heu, subcategory: null })['subcategory']).toBe(
      'Bitte wähle die Sorte — zum Beispiel Wiesenheu oder Stroh.'
    )
  })

  it('Getreide & Körner ohne Sorte: ebenfalls Fehler', () => {
    expect(fehler({ ...heu, category: 'GETREIDE_KOERNER', subcategory: null })['subcategory']).toBe(
      FUTTER_FEHLER.unterkategorie
    )
  })

  it('Mischfutter hat keine Sorten — ohne ist gültig', () => {
    const r = productFormSchema.safeParse({
      ...heu,
      category: 'MISCHFUTTER',
      subcategory: null,
      futter: { ...futterGueltig, futtermittelart: 'ALLEINFUTTERMITTEL' },
    })
    expect(r.success).toBe(true)
  })

  it('bei Lebensmitteln bleibt eine fehlende Unterkategorie erlaubt', () => {
    expect(productFormSchema.safeParse({ ...eier, subcategory: null }).success).toBe(true)
  })
})

describe('P7 — Futtermittelart passt zur Kategorie (F4)', () => {
  it('Heu & Stroh mit Alleinfuttermittel', () => {
    const f = fehler({ ...heu, futter: { ...futterGueltig, futtermittelart: 'ALLEINFUTTERMITTEL' } })
    expect(f['futter.futtermittelart']).toBe('Ein Produkt aus Heu & Stroh ist ein Einzelfuttermittel.')
  })

  it('Getreide & Körner mit Alleinfuttermittel — Artikel „Körnern"', () => {
    const f = fehler({
      ...heu,
      category: 'GETREIDE_KOERNER',
      subcategory: 'HAFER',
      futter: { ...futterGueltig, futtermittelart: 'ALLEINFUTTERMITTEL' },
    })
    expect(f['futter.futtermittelart']).toBe('Ein Produkt aus Getreide & Körnern ist ein Einzelfuttermittel.')
  })

  it('Mischfutter mit Einzelfuttermittel', () => {
    const f = fehler({ ...heu, category: 'MISCHFUTTER', subcategory: null })
    expect(f['futter.futtermittelart']).toBe('Mischfutter ist ein Alleinfuttermittel.')
  })

  it('Ergänzungsfutter mit Einzelfuttermittel', () => {
    const f = fehler({ ...heu, category: 'ERGAENZUNGSFUTTER', subcategory: null })
    expect(f['futter.futtermittelart']).toBe(
      'Ergänzungsfutter ist ein Ergänzungsfuttermittel oder Mineralfuttermittel.'
    )
  })

  it('Ergänzungsfutter nimmt Ergänzungs- und Mineralfuttermittel an', () => {
    for (const art of ['ERGAENZUNGSFUTTERMITTEL', 'MINERALFUTTERMITTEL']) {
      const r = productFormSchema.safeParse({
        ...heu,
        category: 'ERGAENZUNGSFUTTER',
        subcategory: null,
        futter: { ...futterGueltig, futtermittelart: art },
      })
      expect(r.success, art).toBe(true)
    }
  })

  it('fehlende Futtermittelart bekommt denselben Satz', () => {
    const f = fehler({ ...heu, futter: { ...futterGueltig, futtermittelart: '' } })
    expect(f['futter.futtermittelart']).toBe('Ein Produkt aus Heu & Stroh ist ein Einzelfuttermittel.')
  })
})

describe('P8 — Nettomenge', () => {
  it('leer, 0 und negativ: Sackanhänger-Satz', () => {
    for (const nettoMenge of ['', '0', '-1', null]) {
      const f = fehler({ ...heu, futter: { ...futterGueltig, nettoMenge } })
      expect(f['futter.nettoMenge'], String(nettoMenge)).toBe(
        'Bitte trag ein, wie viel ein Gebinde enthält — steht auf dem Sackanhänger.'
      )
    }
  })

  it('„300" und „0,5" werden zur Zahl', () => {
    expect(productFormSchema.parse(heu).futter?.nettoMenge).toBe(300)
    const halb = productFormSchema.parse({ ...heu, futter: { ...futterGueltig, nettoMenge: '0,5' } })
    expect(halb.futter?.nettoMenge).toBe(0.5)
  })
})

describe('P9 — Nettoeinheit', () => {
  it('ist Pflicht und nur KG oder LITER', () => {
    expect(fehler({ ...heu, futter: { ...futterGueltig, nettoEinheit: undefined } })['futter.nettoEinheit']).toBeDefined()
    expect(fehler({ ...heu, futter: { ...futterGueltig, nettoEinheit: 'TONNE' } })['futter.nettoEinheit']).toBeDefined()
    const liter = productFormSchema.parse({ ...heu, futter: { ...futterGueltig, nettoEinheit: 'LITER' } })
    expect(liter.futter?.nettoEinheit).toBe('LITER')
  })
})

describe('P10 — Rohwerte (F3)', () => {
  const text = 'Rohprotein, Rohfaser, Rohfett und Rohasche sind Prozentwerte — bitte eine Zahl zwischen 0 und 100.'

  it('101 und −1 sind Fehler', () => {
    expect(fehler({ ...heu, futter: { ...futterGueltig, rohprotein: '101' } })['futter.rohprotein']).toBe(text)
    expect(fehler({ ...heu, futter: { ...futterGueltig, rohasche: '-1' } })['futter.rohasche']).toBe(text)
  })

  it('Buchstaben sind ein Fehler mit demselben Satz', () => {
    expect(fehler({ ...heu, futter: { ...futterGueltig, rohfett: 'viel' } })['futter.rohfett']).toBe(text)
  })

  it('leer wird null, „9,5" wird 9.5, 0 und 100 sind erlaubt', () => {
    const r = productFormSchema.parse({
      ...heu,
      futter: { ...futterGueltig, rohprotein: '9,5', rohfaser: '0', rohfett: '100', rohasche: '' },
    })
    expect(r.futter?.rohprotein).toBe(9.5)
    expect(r.futter?.rohfaser).toBe(0)
    expect(r.futter?.rohfett).toBe(100)
    expect(r.futter?.rohasche).toBeNull()
  })
})

describe('P11 — Abgabe nur an Betriebe nur bei Futtermitteln', () => {
  it('Eier mit NUR_BETRIEBE: Fehler', () => {
    expect(fehler({ ...eier, abgabe: 'NUR_BETRIEBE' })['abgabe']).toBe(
      'Die Abgabebeschränkung gibt es nur für Futtermittel.'
    )
  })

  it('Heu mit NUR_BETRIEBE: gültig', () => {
    expect(productFormSchema.parse({ ...heu, abgabe: 'NUR_BETRIEBE' }).abgabe).toBe('NUR_BETRIEBE')
  })

  it('ohne Angabe: ALLE', () => {
    expect(productFormSchema.parse(eier).abgabe).toBe('ALLE')
  })
})

describe('P12 — Ballen und Big Bags ohne Gebindegröße', () => {
  it('Ballen mit unitSize 300: Fehler', () => {
    expect(fehler({ ...heu, unitSize: 300 })['unitSize']).toBe(
      'Bei Ballen und Big Bags steht das Gewicht in der Kennzeichnung.'
    )
  })

  it('Big Bag Brennholz ohne unitSize: gültig (F7 — keine Zod-Regel zum Bereich)', () => {
    const r = productFormSchema.parse({ name: 'Brennholz Buche', price: 180, unit: 'BIGBAG', category: 'BRENNHOLZ' })
    expect(r.unit).toBe('BIGBAG')
    expect(r.unitSize).toBeNull()
  })

  it('das Formular bietet Ballen und Big Bags bei Lebensmitteln nicht an', () => {
    expect(unitOptionsFuer('EIER').map((u) => u.value)).not.toContain('BALLEN')
    expect(unitOptionsFuer('HEU_STROH').map((u) => u.value)).toContain('BIGBAG')
    expect(unitOptionsFuer('BRENNHOLZ').map((u) => u.value)).toContain('BIGBAG')
  })
})

describe('P13 — MwSt-Vorbelegung aus der Kategorie', () => {
  it('leer bei Heu & Stroh → 10', () => {
    expect(productFormSchema.parse({ ...heu, vatRate: '' }).vatRate).toBe(10)
  })

  it('ein getippter Satz bleibt', () => {
    expect(productFormSchema.parse({ ...heu, vatRate: '13' }).vatRate).toBe(13)
    expect(productFormSchema.parse({ ...heu, vatRate: 0 }).vatRate).toBe(0)
  })
})

describe('P14 — Registrierungsnummer ist Altlast (F6)', () => {
  it('eine mitgeschickte Nummer landet nicht im Ergebnis', () => {
    const r = productFormSchema.parse({ ...heu, futter: { ...futterGueltig, registrierungsnummer: 'AT 1234567' } })
    expect(r.futter && 'registrierungsnummer' in r.futter).toBe(false)
  })
})

describe('C1–C3 — Betriebsnachweis (pruefeBetriebsnachweis)', () => {
  it('ohne NUR_BETRIEBE-Position ist Privat in Ordnung', () => {
    expect(pruefeBetriebsnachweis({ nurBetriebeImKorb: false, kaeuferArt: 'PRIVAT', betriebsnummer: null })).toEqual({
      ok: true,
    })
  })

  it('NUR_BETRIEBE als Privat: Fehler an der Käuferart', () => {
    expect(pruefeBetriebsnachweis({ nurBetriebeImKorb: true, kaeuferArt: 'PRIVAT', betriebsnummer: '12345' })).toEqual({
      ok: false,
      feld: 'kaeuferArt',
      meldung: BETRIEBSNACHWEIS_FEHLER,
    })
  })

  it('NUR_BETRIEBE als Betrieb mit 4 Zeichen: Fehler an der Nummer', () => {
    const r = pruefeBetriebsnachweis({ nurBetriebeImKorb: true, kaeuferArt: 'BETRIEB', betriebsnummer: '1234' })
    expect(r).toEqual({ ok: false, feld: 'betriebsnummer', meldung: BETRIEBSNACHWEIS_FEHLER })
  })

  it('Leerzeichen zählen nicht mit', () => {
    const r = pruefeBetriebsnachweis({ nurBetriebeImKorb: true, kaeuferArt: 'BETRIEB', betriebsnummer: '  1234  ' })
    expect(r.ok).toBe(false)
  })

  it('NUR_BETRIEBE als Betrieb mit 5 Zeichen: in Ordnung', () => {
    expect(pruefeBetriebsnachweis({ nurBetriebeImKorb: true, kaeuferArt: 'BETRIEB', betriebsnummer: '12345' }).ok).toBe(
      true
    )
  })

  it('der Fehlertext ist der aus dem Konzept', () => {
    expect(BETRIEBSNACHWEIS_FEHLER).toBe(
      'Dieses Futtermittel gibt der Hof nur an landwirtschaftliche Betriebe ab. Bitte trag deine Betriebsnummer ein.'
    )
  })
})

describe('C1–C3 — Checkout-Formular', () => {
  const formular = {
    customerName: 'Max Mustermann',
    customerEmail: 'max@example.com',
    customerPhone: '+43 660 0000000',
    pickupSlotKey: '2026-09-26|09:00|12:00',
    paymentMethod: 'ONLINE',
  }

  it('C1: Käuferart ist ohne Angabe PRIVAT', () => {
    expect(checkoutFormSchema.parse(formular).kaeuferArt).toBe('PRIVAT')
  })

  it('mit NUR_BETRIEBE im Korb und Privat: Fehler an kaeuferArt', () => {
    const r = checkoutFormSchema.safeParse({ ...formular, nurBetriebeImKorb: true })
    expect(r.success).toBe(false)
    expect(r.error?.issues.find((i) => i.path[0] === 'kaeuferArt')?.message).toBe(BETRIEBSNACHWEIS_FEHLER)
  })

  it('mit NUR_BETRIEBE im Korb, Betrieb und Nummer: gültig', () => {
    const r = checkoutFormSchema.safeParse({
      ...formular,
      nurBetriebeImKorb: true,
      kaeuferArt: 'BETRIEB',
      betriebsnummer: 'AT 1234567',
    })
    expect(r.success).toBe(true)
  })

  it('der Request an den Server kennt Käuferart und Nummer, Standard PRIVAT', () => {
    const basis = {
      farmId: 'f1',
      farmSlug: 'hof-test',
      sessionId: 's1',
      customerName: 'Max Mustermann',
      customerEmail: 'max@example.com',
      customerPhone: '+43 660 0000000',
      pickupDate: '2026-09-26',
      pickupTimeStart: '09:00',
      pickupTimeEnd: '12:00',
      paymentMethod: 'ONSITE_CASH',
      items: [{ productId: 'p1', name: 'Heu', quantity: 1, unitPrice: 45 }],
    }
    expect(checkoutRequestSchema.parse(basis).kaeuferArt).toBe('PRIVAT')
    expect(checkoutRequestSchema.parse({ ...basis, kaeuferArt: 'BETRIEB', betriebsnummer: ' AT 1 ' }).betriebsnummer).toBe(
      'AT 1'
    )
    expect(checkoutRequestSchema.safeParse({ ...basis, kaeuferArt: 'FIRMA' }).success).toBe(false)
  })
})

describe('C5 — Nummer nur bei Betrieb in der Bestellung', () => {
  it('Privat speichert keine Nummer, auch wenn eine mitkommt', () => {
    expect(betriebsnummerFuerBestellung('PRIVAT', 'AT 1234567')).toBeNull()
  })

  it('Betrieb speichert die getrimmte Nummer, leer wird null', () => {
    expect(betriebsnummerFuerBestellung('BETRIEB', '  AT 1234567 ')).toBe('AT 1234567')
    expect(betriebsnummerFuerBestellung('BETRIEB', '   ')).toBeNull()
    expect(betriebsnummerFuerBestellung('BETRIEB', undefined)).toBeNull()
  })
})

describe('H1 — Betriebsnummer des Hofs', () => {
  it('trimmt die Eingabe', () => {
    expect(hofBetriebsnummerSchema.parse('  AT 1234567  ')).toBe('AT 1234567')
  })

  it('leer bleibt erlaubt und wird null', () => {
    expect(hofBetriebsnummerSchema.parse('')).toBeNull()
    expect(hofBetriebsnummerSchema.parse('   ')).toBeNull()
    expect(hofBetriebsnummerSchema.parse(null)).toBeNull()
    expect(hofBetriebsnummerSchema.parse(undefined)).toBeNull()
  })

  it('unter 5 Zeichen: Fehler mit dem vereinbarten Satz', () => {
    const r = hofBetriebsnummerSchema.safeParse('1234')
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Eine Betriebsnummer hat mindestens 5 Zeichen.')
    expect(BETRIEBSNUMMER_ZU_KURZ).toBe('Eine Betriebsnummer hat mindestens 5 Zeichen.')
  })

  it('genau 5 Zeichen sind erlaubt', () => {
    expect(hofBetriebsnummerSchema.parse('12345')).toBe('12345')
  })
})

describe('H2 — Betriebsstatus des Hofs', () => {
  it('nimmt die drei Werte an, leer wird null', () => {
    expect(betriebsstatusSchema.parse('ZUGELASSEN')).toBe('ZUGELASSEN')
    expect(betriebsstatusSchema.parse('')).toBeNull()
    expect(betriebsstatusSchema.parse(null)).toBeNull()
  })

  it('verweigert Unbekanntes', () => {
    expect(betriebsstatusSchema.safeParse('XY').success).toBe(false)
  })
})
