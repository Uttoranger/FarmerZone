import { z } from 'zod'

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

export const PRODUCT_CATEGORY_VALUES = [
  'MILCH', 'EIER', 'FLEISCH', 'GEMUESE', 'OBST',
  'BROT', 'HONIG', 'GETRAENKE', 'BRENNHOLZ', 'SONSTIGES',
] as const

export type ProductCategoryValue = (typeof PRODUCT_CATEGORY_VALUES)[number]

export const CATEGORY_OPTIONS: { value: ProductCategoryValue; label: string }[] = [
  { value: 'MILCH', label: 'Milch & Molkerei' },
  { value: 'EIER', label: 'Eier' },
  { value: 'FLEISCH', label: 'Fleisch & Wurst' },
  { value: 'GEMUESE', label: 'Gemüse' },
  { value: 'OBST', label: 'Obst' },
  { value: 'BROT', label: 'Brot & Gebäck' },
  { value: 'HONIG', label: 'Honig & Süßes' },
  { value: 'GETRAENKE', label: 'Getränke' },
  { value: 'BRENNHOLZ', label: 'Brennholz' },
  { value: 'SONSTIGES', label: 'Sonstiges' },
]

export const productFormSchema = z.object({
  name: z.string().min(2, 'Mindestens 2 Zeichen').max(100),
  description: z.string().max(1000, 'Maximal 1000 Zeichen').optional().or(z.literal('')),
  imageUrl: z.string().optional().or(z.literal('')),
  // null = "Keine Angabe" (heutiges Verhalten); ungültige Werte werden abgelehnt
  category: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.enum(PRODUCT_CATEGORY_VALUES).nullable()
  ).default(null),
  countsTowardLimit: z.boolean().default(true),
  price: z.coerce.number().positive('Preis muss größer als 0 sein'),
  vatRate: z.coerce.number().min(0).max(100).default(10),
  unit: z.enum(['STUECK', 'KG', 'G', 'LITER', 'ML', 'M3', 'PAKET']),
  unitSize: optionalPositiveNumber,
  stock: z.coerce.number().int().min(0, 'Bestand kann nicht negativ sein').default(0),
  isAvailable: z.boolean().default(true),
  allergens: z.array(z.string()).default([]),
  isOrganic: z.boolean().default(false),
  requiresCool: z.boolean().default(false),
  requiresFreezer: z.boolean().default(false),
  seasonStart: optionalMonth,
  seasonEnd: optionalMonth,
  unavailableReason: z.string().max(200).optional().or(z.literal('')),
})

export type ProductFormData = z.infer<typeof productFormSchema>
