import { z } from 'zod'
import {
  PRODUCT_CATEGORY_VALUES,
  PRODUCT_SUBCATEGORY_VALUES,
  PRODUCT_LABEL_VALUES,
  TIERART_VALUES,
  KATEGORIE_LABEL,
  gehoertZu,
} from '@/lib/taxonomie'

// Kategorien, Unterkategorien und Siegel leben seit Sprint Taxonomie 1 in
// src/lib/taxonomie.ts — der EINEN Quelle. Die drei Namen bleiben hier
// erreichbar, damit Filterleiste (/hoefe), Hofkarte und Hofübersicht
// unverändert weiterlaufen; neuer Code importiert direkt aus der Taxonomie.
export {
  PRODUCT_CATEGORY_VALUES,
  CATEGORY_OPTIONS,
  type ProductCategoryValue,
} from '@/lib/taxonomie'

export const ALLERGENS = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'krebstiere', label: 'Krebstiere' },
  { id: 'eier', label: 'Eier' },
  { id: 'fische', label: 'Fische' },
  { id: 'erdnuesse', label: 'Erdnüsse' },
  { id: 'soja', label: 'Soja' },
  { id: 'milch', label: 'Milch' },
  { id: 'schalenfruechte', label: 'Schalenfrüchte' },
  { id: 'sellerie', label: 'Sellerie' },
  { id: 'senf', label: 'Senf' },
  { id: 'sesamsamen', label: 'Sesamsamen' },
  { id: 'schwefeldioxid', label: 'Schwefeldioxid & Sulfite' },
  { id: 'lupinen', label: 'Lupinen' },
  { id: 'weichtiere', label: 'Weichtiere' },
] as const

export const UNIT_OPTIONS = [
  { value: 'STUECK', label: 'Stück' },
  { value: 'KG', label: 'kg' },
  { value: 'G', label: 'g' },
  { value: 'LITER', label: 'Liter' },
  { value: 'ML', label: 'ml' },
  { value: 'M3', label: 'm³' },
  { value: 'PAKET', label: 'Paket' },
] as const

export const UNIT_LABELS: Record<string, string> = {
  STUECK: 'Stück',
  KG: 'kg',
  G: 'g',
  LITER: 'L',
  ML: 'ml',
  M3: 'm³',
  PAKET: 'Paket',
}

// Kurznamen für kompakte Saison-Anzeigen (Badge auf der Hof-Seite,
// Klartext-Zeile im Produkt-Dialog) — identischer Wortlaut an beiden Stellen
export const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export function seasonLabel(start: number, end: number): string {
  return `Saisonal verfügbar: ${MONTH_SHORT[start - 1]} bis ${MONTH_SHORT[end - 1]}`
}

export const MONTH_OPTIONS = [
  { value: 1, label: 'Jänner' },
  { value: 2, label: 'Februar' },
  { value: 3, label: 'März' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Dezember' },
]

const optionalPositiveNumber = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return undefined
    const n = Number(v)
    return isNaN(n) ? undefined : n
  },
  z.number().positive('Muss größer als 0 sein').optional()
)

const optionalMonth = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined || v === '0') return undefined
    const n = Number(v)
    return isNaN(n) ? undefined : n
  },
  z.number().int().min(1).max(12).optional()
)

/** Leerer String und undefined werden zu null — „Keine Angabe". */
const leerZuNull = (v: unknown) => (v === '' || v === undefined ? null : v)

/** Optionaler Freitext: leer erlaubt, Länge begrenzt, Ränder abgeschnitten. */
const optionalerText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))

// Fehlertexte der Futter-Kennzeichnung — in Du-Form, mit dem Hinweis, WO der
// Wert steht. Der Hof tippt vom Sackanhänger ab; die Meldung sagt ihm das.
export const FUTTER_FEHLER = {
  tierarten: 'Bitte wähle mindestens eine Tierart, für die das Futter gedacht ist.',
  zusammensetzung: 'Bitte trag die Zusammensetzung ein — sie steht auf dem Sackanhänger oder Lieferschein.',
  analytischeBestandteile:
    'Bitte trag die analytischen Bestandteile ein — sie stehen auf dem Sackanhänger oder Lieferschein.',
  bestaetigt: 'Bitte bestätige, dass die Angaben dem Sackanhänger bzw. Lieferschein entsprechen.',
  unterkategorie: 'Bitte wähle, welche Art Futtermittel es ist.',
  fehlt: 'Bei Futtermitteln brauchen wir die Kennzeichnung vom Sackanhänger.',
  verboten: 'Eine Futter-Kennzeichnung gibt es nur bei der Kategorie Futtermittel.',
} as const

/**
 * Die Futter-Kennzeichnung, wie der Hof sie eingibt. `bestaetigt` ist der
 * Haken „Die Angaben entsprechen dem Sackanhänger" — die Server Action macht
 * daraus `bestaetigtAm = jetzt`. Ein Boolean statt `z.literal(true)`, damit das
 * Formular mit `false` starten kann; die Prüfung verlangt trotzdem true.
 */
export const futterKennzeichnungSchema = z.object({
  zielTierarten: z.array(z.enum(TIERART_VALUES)).min(1, FUTTER_FEHLER.tierarten),
  zusammensetzung: z.string().trim().min(3, FUTTER_FEHLER.zusammensetzung).max(2000),
  analytischeBestandteile: z
    .string()
    .trim()
    .min(3, FUTTER_FEHLER.analytischeBestandteile)
    .max(2000),
  zusatzstoffe: optionalerText(2000),
  registrierungsnummer: optionalerText(100),
  gebrauchshinweis: optionalerText(2000),
  bestaetigt: z.boolean().refine((v) => v === true, FUTTER_FEHLER.bestaetigt),
})

export type FutterKennzeichnungFormData = z.infer<typeof futterKennzeichnungSchema>

export const productFormSchema = z
  .object({
    name: z.string().min(2, 'Mindestens 2 Zeichen').max(100),
    description: z.string().max(1000, 'Maximal 1000 Zeichen').optional().or(z.literal('')),
    imageUrl: z.string().optional().or(z.literal('')),
    // null = "Keine Angabe" (heutiges Verhalten); ungültige Werte werden abgelehnt
    category: z.preprocess(leerZuNull, z.enum(PRODUCT_CATEGORY_VALUES).nullable()).default(null),
    // null erlaubt — Bestandsprodukte haben keine Unterkategorie. Ob sie zur
    // Kategorie passt, prüft superRefine unten.
    subcategory: z
      .preprocess(leerZuNull, z.enum(PRODUCT_SUBCATEGORY_VALUES).nullable())
      .default(null),
    // Siegel: mehrere möglich, jedes höchstens einmal.
    labels: z
      .array(z.enum(PRODUCT_LABEL_VALUES))
      .default([])
      .refine((l) => new Set(l).size === l.length, 'Ein Siegel kann nur einmal gewählt werden.'),
    // Nur bei Kategorie Futtermittel — Pflicht dort, verboten sonst (superRefine).
    futter: futterKennzeichnungSchema.optional(),
    countsTowardLimit: z.boolean().default(true),
    price: z.coerce.number().positive('Preis muss größer als 0 sein'),
    vatRate: z.coerce.number().min(0).max(100).default(10),
    unit: z.enum(['STUECK', 'KG', 'G', 'LITER', 'ML', 'M3', 'PAKET']),
    unitSize: optionalPositiveNumber,
    stock: z.coerce.number().int().min(0, 'Bestand kann nicht negativ sein').default(0),
    isAvailable: z.boolean().default(true),
    allergens: z.array(z.string()).default([]),
    requiresCool: z.boolean().default(false),
    requiresFreezer: z.boolean().default(false),
    seasonStart: optionalMonth,
    seasonEnd: optionalMonth,
    unavailableReason: z.string().max(200).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    // L2 muss zur L1 gehören. Fehlt die L2, ist das KEIN Fehler — auch nicht,
    // wenn die L1 welche hätte (Bestandsprodukte); das Formular zeigt dann
    // nur einen Hinweis. Ausnahme Futtermittel, siehe unten.
    if (data.subcategory !== null) {
      if (data.category === null) {
        ctx.addIssue({ code: 'custom', path: ['subcategory'], message: 'Wähle zuerst eine Kategorie.' })
      } else if (!gehoertZu(data.category, data.subcategory)) {
        ctx.addIssue({
          code: 'custom',
          path: ['subcategory'],
          message: `Diese Unterkategorie passt nicht zu ${KATEGORIE_LABEL[data.category]}.`,
        })
      }
    }

    if (data.category === 'FUTTERMITTEL') {
      if (data.subcategory === null) {
        ctx.addIssue({ code: 'custom', path: ['subcategory'], message: FUTTER_FEHLER.unterkategorie })
      }
      if (data.futter === undefined) {
        ctx.addIssue({ code: 'custom', path: ['futter'], message: FUTTER_FEHLER.fehlt })
      }
    } else if (data.futter !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['futter'], message: FUTTER_FEHLER.verboten })
    }
  })

export type ProductFormData = z.infer<typeof productFormSchema>

/**
 * Feldreihenfolge des Produktformulars — für „zum ersten Fehler springen"
 * (Muster aus dem Checkout). Gleiche Reihenfolge wie die Abschnitte im Dialog.
 */
export const PRODUKT_FELD_REIHENFOLGE = [
  'name',
  'category',
  'subcategory',
  'imageUrl',
  'description',
  'price',
  'unit',
  'unitSize',
  'vatRate',
  'stock',
  'isAvailable',
  'seasonStart',
  'seasonEnd',
  'unavailableReason',
  'labels',
  'allergens',
  'requiresCool',
  'requiresFreezer',
  'countsTowardLimit',
  'futter',
] as const satisfies readonly (keyof ProductFormData)[]
