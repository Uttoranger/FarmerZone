/**
 * Tests für die Schemas aus Sprint Produktformular Nachschliff:
 * productAnlegenSchema (Anlegen ist strenger als Bearbeiten),
 * kategorieSetzenSchema (Chip „… übernehmen" in der Produktliste) und die
 * Futter-Einheiten im Formular.
 */
import { describe, it, expect } from 'vitest'
import {
  productFormSchema,
  productAnlegenSchema,
  kategorieSetzenSchema,
  unitOptionsFuer,
  KATEGORIE_PFLICHT,
  FUTTER_OHNE_GEBINDEGROESSE,
} from '@/schemas/product'

const futterGueltig = {
  futtermittelart: 'EINZELFUTTERMITTEL',
  zielTierarten: ['PFERD'],
  zusammensetzung: 'Wiesenheu',
  analytischeBestandteile: 'Rohprotein 9 %, Rohfaser 28 %',
  nettoMenge: 20,
  nettoEinheit: 'KG',
  rohprotein: null,
  rohfaser: null,
  rohfett: null,
  rohasche: null,
  zusatzstoffe: '',
  gebrauchshinweis: '',
  bestaetigt: true,
}

const ohneKategorie = { name: 'Lammfleisch', price: 18, unit: 'KG' }
const futterMitGebinde = {
  name: 'Heu Pakete',
  price: 200,
  unit: 'STUECK',
  unitSize: 50,
  category: 'HEU_STROH',
  subcategory: 'WIESENHEU',
  futter: futterGueltig,
}

function fehler(schema: typeof productFormSchema | typeof productAnlegenSchema, input: unknown): Record<string, string> {
  const ergebnis = schema.safeParse(input)
  if (ergebnis.success) return {}
  const nachPfad: Record<string, string> = {}
  for (const i of ergebnis.error.issues) nachPfad[i.path.join('.')] ??= i.message
  return nachPfad
}

describe('Kategorie beim Anlegen', () => {
  it('ist Pflicht — mit dem Satz, warum', () => {
    expect(fehler(productAnlegenSchema, ohneKategorie)['category']).toBe(KATEGORIE_PFLICHT)
  })

  it('beim Bearbeiten eines Bestandsprodukts ohne Kategorie kein Fehler', () => {
    expect(productFormSchema.safeParse(ohneKategorie).success).toBe(true)
  })

  it('mit Kategorie legt sich das Produkt an', () => {
    expect(productAnlegenSchema.safeParse({ ...ohneKategorie, category: 'FLEISCH', subcategory: 'LAMM' }).success).toBe(
      true
    )
  })
})

describe('Futtermittel mit Gebindegröße (Altfall, Rückfrage F1)', () => {
  it('lässt sich beim Anlegen nicht mehr speichern', () => {
    expect(fehler(productAnlegenSchema, futterMitGebinde)['unitSize']).toBe(FUTTER_OHNE_GEBINDEGROESSE)
  })

  it('bleibt beim Bearbeiten speicherbar — der Bestand muss sich ändern lassen', () => {
    expect(productFormSchema.safeParse({ ...futterMitGebinde, stock: 3 }).success).toBe(true)
  })

  it('ohne Gebindegröße legt sich ein Futtermittel an', () => {
    expect(productAnlegenSchema.safeParse({ ...futterMitGebinde, unitSize: null }).success).toBe(true)
  })

  it('Lebensmittel dürfen beim Anlegen weiter feste Pakete haben', () => {
    const paket = { name: 'Rindfleisch-Paket', price: 50, unit: 'KG', unitSize: 2, category: 'FLEISCH' }
    expect(productAnlegenSchema.safeParse(paket).success).toBe(true)
  })
})

describe('Futter-Einheiten im Formular (Rückfrage F2)', () => {
  it('Futtermittel: kg, Liter, Stück, Paket, Ballen, Big Bag — kein g, ml, m³', () => {
    expect(unitOptionsFuer('HEU_STROH').map((u) => u.value)).toEqual([
      'STUECK',
      'KG',
      'LITER',
      'PAKET',
      'BALLEN',
      'BIGBAG',
    ])
  })

  it('Lebensmittel behalten g und ml, ohne Ballen', () => {
    const werte = unitOptionsFuer('MILCH').map((u) => u.value)
    expect(werte).toContain('ML')
    expect(werte).not.toContain('BALLEN')
  })
})

describe('kategorieSetzenSchema', () => {
  it('nimmt eine passende Kategorie mit Unterkategorie an', () => {
    expect(kategorieSetzenSchema.safeParse({ productId: 'p1', category: 'FLEISCH', subcategory: 'LAMM' }).success).toBe(
      true
    )
  })

  it('lehnt eine Unterkategorie aus einer anderen Kategorie ab', () => {
    expect(kategorieSetzenSchema.safeParse({ productId: 'p1', category: 'MILCH', subcategory: 'LAMM' }).success).toBe(
      false
    )
  })

  it('lehnt Futtermittel ab — sie brauchen eine Kennzeichnung aus dem Dialog', () => {
    expect(
      kategorieSetzenSchema.safeParse({ productId: 'p1', category: 'HEU_STROH', subcategory: 'WIESENHEU' }).success
    ).toBe(false)
  })

  it('lehnt die Altlast und fremde Felder ab', () => {
    expect(kategorieSetzenSchema.safeParse({ productId: 'p1', category: 'FUTTERMITTEL', subcategory: null }).success).toBe(
      false
    )
    expect(
      kategorieSetzenSchema.safeParse({ productId: 'p1', category: 'EIER', subcategory: null, stock: 99 }).success
    ).toBe(false)
  })
})
