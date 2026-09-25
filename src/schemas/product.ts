import { z } from 'zod'
import {
  PRODUCT_CATEGORY_VALUES,
  PRODUCT_SUBCATEGORY_VALUES,
  PRODUCT_LABEL_VALUES,
  TIERART_VALUES,
  FUTTERMITTELART_VALUES,
  NETTO_EINHEIT_VALUES,
  ABGABE_VALUES,
  KATEGORIE_LABEL,
  gehoertZu,
  hatUnterkategorien,
  istFuttermittel,
  istAltlastKategorie,
  istAltlastUnterkategorie,
  istGrossgebindeEinheit,
  futtermittelartenFuer,
  futtermittelartSatz,
  grossgebindeEinheitenAngeboten,
  type ProductCategoryValue,
} from '@/lib/taxonomie'
import { mwstStandard } from '@/lib/mwst'
import { nachkommastellen, parseDezimal } from '@/lib/format'

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
  { value: 'BALLEN', label: 'Ballen' },
  { value: 'BIGBAG', label: 'Big Bag' },
] as const

export const PRODUCT_UNIT_VALUES = ['STUECK', 'KG', 'G', 'LITER', 'ML', 'M3', 'PAKET', 'BALLEN', 'BIGBAG'] as const

/**
 * Futtermittel verkauft man nicht in g, ml oder m³ — und nur bei diesen sechs
 * Einheiten lässt sich das Gewicht je Gebinde eindeutig fragen.
 */
const FUTTER_EINHEITEN: readonly string[] = ['KG', 'LITER', 'STUECK', 'PAKET', 'BALLEN', 'BIGBAG']

/**
 * Die Einheiten, die das Formular für eine Kategorie anbietet: Ballen und Big
 * Bags nur bei Futtermitteln und Sonstiges (Rückfrage F7), Futtermittel nur in
 * FUTTER_EINHEITEN. Reine Anzeige — das Schema nimmt jede Einheit an.
 */
export function unitOptionsFuer(
  category: ProductCategoryValue | null | undefined
): readonly (typeof UNIT_OPTIONS)[number][] {
  if (istFuttermittel(category)) return UNIT_OPTIONS.filter((u) => FUTTER_EINHEITEN.includes(u.value))
  return grossgebindeEinheitenAngeboten(category)
    ? UNIT_OPTIONS
    : UNIT_OPTIONS.filter((u) => !istGrossgebindeEinheit(u.value))
}

export const UNIT_LABELS: Record<string, string> = {
  STUECK: 'Stück',
  KG: 'kg',
  G: 'g',
  LITER: 'L',
  ML: 'ml',
  M3: 'm³',
  PAKET: 'Paket',
  BALLEN: 'Ballen',
  BIGBAG: 'Big Bag',
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

/**
 * Getippter Text („5,99") wird zur Zahl, Zahlen bleiben Zahlen. Leer ist
 * undefined. Unlesbares wird zu NaN, damit z.number() den Fehler meldet —
 * ein stilles undefined ließe „abc" als „kein Wert" durchgehen.
 */
const dezimal = (v: unknown): unknown => {
  if (v === '' || v === null || v === undefined) return undefined
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseDezimal(v) ?? Number.NaN
  return v
}

/** Gebindegröße: leer = null, sonst größer 0, höchstens drei Nachkommastellen (125 g). */
const optionalPositiveNumber = z.preprocess(
  (v) => {
    const d = dezimal(v)
    return d === undefined ? null : d
  },
  z
    .number({ error: 'Bitte nur Zahlen, z. B. 2 oder 0,5.' })
    .positive('Muss größer als 0 sein')
    .refine((n) => nachkommastellen(n) <= 3, 'Höchstens drei Nachkommastellen, z. B. 0,125.')
    .nullable()
)

/** Preis je Gebinde: Pflicht, größer 0, auf den Cent (zwei Nachkommastellen). */
const preisZahl = z.preprocess(
  dezimal,
  z
    .number({ error: 'Bitte gib einen Preis ein, z. B. 5,99.' })
    .positive('Preis muss größer als 0 sein')
    .refine((n) => nachkommastellen(n) <= 2, 'Höchstens zwei Nachkommastellen, z. B. 5,99.')
)

/**
 * MwSt-Satz in Prozent: 0 bis 100. Leer bleibt hier null — den Standard setzt
 * das Schema erst am Ende, weil er von der Kategorie abhängt (mwstStandard).
 */
const mwstZahl = z.preprocess(
  (v) => dezimal(v) ?? null,
  z.number({ error: 'Bitte nur Zahlen, z. B. 10.' }).min(0).max(100).nullable()
)

// LEER IST NULL, NIE UNDEFINED — für alle optionalen Zahlenfelder des
// Formulars. react-hook-form liest `undefined` als „Ausgangswert
// wiederherstellen": Beim Tippen von „0," war die Gebindegröße kurz leer, das
// Formular holte die gespeicherte 1 zurück, und aus „0,5" wurde „15".
const optionalMonth = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined || v === '0') return null
    const n = Number(v)
    return isNaN(n) ? null : n
  },
  z.number().int().min(1).max(12).nullable()
)

/** Leerer String und undefined werden zu null — „Keine Angabe". */
const leerZuNull = (v: unknown) => (v === '' || v === undefined ? null : v)

/** Optionaler Freitext: leer erlaubt, Länge begrenzt, Ränder abgeschnitten. */
const optionalerText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))

// Fehlertexte der Futter-Kennzeichnung — in Du-Form, mit dem Hinweis, WO der
// Wert steht. Der Hof tippt vom Sackanhänger ab; die Meldung sagt ihm das.
// Wortlaute aus docs/konzepte/bereiche.md §4 und den Rückfragen F2–F4.
export const FUTTER_FEHLER = {
  tierarten: 'Bitte wähle mindestens eine Tierart, für die das Futter gedacht ist.',
  zusammensetzung: 'Bitte trag die Zusammensetzung ein — sie steht auf dem Sackanhänger oder Lieferschein.',
  analytischeBestandteile:
    'Bitte trag die analytischen Bestandteile ein — sie stehen auf dem Sackanhänger oder Lieferschein.',
  bestaetigt: 'Bitte bestätige, dass die Angaben dem Sackanhänger bzw. Lieferschein entsprechen.',
  unterkategorie: 'Bitte wähle die Sorte — zum Beispiel Wiesenheu oder Stroh.',
  fehlt: 'Bei Futtermitteln brauchen wir die Kennzeichnung vom Sackanhänger.',
  verboten: 'Eine Futter-Kennzeichnung gibt es nur bei Futtermitteln.',
  altlast:
    'Diese Kategorie gibt es nicht mehr — bitte Heu & Stroh, Getreide & Körner, Mischfutter oder Ergänzungsfutter wählen.',
  nettoMenge: 'Bitte trag ein, wie viel ein Gebinde enthält — steht auf dem Sackanhänger.',
  rohwerte: 'Rohprotein, Rohfaser, Rohfett und Rohasche sind Prozentwerte — bitte eine Zahl zwischen 0 und 100.',
  abgabe: 'Die Abgabebeschränkung gibt es nur für Futtermittel.',
  grossgebinde: 'Bei Ballen und Big Bags gibt es keine Gebindegröße — das Gewicht steht direkt unter der Einheit.',
} as const

/** Nettomenge eines Gebindes: Pflicht, größer 0, höchstens drei Nachkommastellen (Decimal(10,3)). */
const nettoMengeZahl = z.preprocess(
  dezimal,
  z
    .number({ error: FUTTER_FEHLER.nettoMenge })
    .positive(FUTTER_FEHLER.nettoMenge)
    .refine((n) => nachkommastellen(n) <= 3, 'Höchstens drei Nachkommastellen, z. B. 0,125.')
)

/**
 * Rohwert in Prozent: leer = null, sonst 0 bis 100. Mehr als zwei
 * Nachkommastellen rundet die Spalte (Decimal(5,2)) — auf dem Sackanhänger
 * steht ohnehin höchstens eine.
 */
const rohwertZahl = z.preprocess(
  (v) => dezimal(v) ?? null,
  z.number({ error: FUTTER_FEHLER.rohwerte }).min(0, FUTTER_FEHLER.rohwerte).max(100, FUTTER_FEHLER.rohwerte).nullable()
)

/**
 * Die Futter-Kennzeichnung, wie der Hof sie eingibt. `bestaetigt` ist der
 * Haken „Die Angaben entsprechen dem Sackanhänger" — die Server Action macht
 * daraus `bestaetigtAm = jetzt`. Ein Boolean statt `z.literal(true)`, damit das
 * Formular mit `false` starten kann; die Prüfung verlangt trotzdem true.
 *
 * futtermittelart ist hier nullable: Ob sie fehlt oder nicht zur Kategorie
 * passt, entscheidet productFormSchema — erst dort ist die Kategorie bekannt,
 * und beide Fälle bekommen denselben Satz (futtermittelartSatz).
 *
 * KEINE registrierungsnummer mehr (Rückfrage F6): Die Nummer gehört dem Hof
 * (Farm.betriebsnummer). Ein mitgeschicktes Feld verwirft Zod stillschweigend.
 */
export const futterKennzeichnungSchema = z.object({
  futtermittelart: z.preprocess(leerZuNull, z.enum(FUTTERMITTELART_VALUES).nullable()),
  zielTierarten: z.array(z.enum(TIERART_VALUES)).min(1, FUTTER_FEHLER.tierarten),
  zusammensetzung: z.string().trim().min(3, FUTTER_FEHLER.zusammensetzung).max(2000),
  analytischeBestandteile: z
    .string()
    .trim()
    .min(3, FUTTER_FEHLER.analytischeBestandteile)
    .max(2000),
  nettoMenge: nettoMengeZahl,
  nettoEinheit: z.enum(NETTO_EINHEIT_VALUES),
  rohprotein: rohwertZahl,
  rohfaser: rohwertZahl,
  rohfett: rohwertZahl,
  rohasche: rohwertZahl,
  zusatzstoffe: optionalerText(2000),
  gebrauchshinweis: optionalerText(2000),
  bestaetigt: z.boolean().refine((v) => v === true, FUTTER_FEHLER.bestaetigt),
})

export type FutterKennzeichnungFormData = z.infer<typeof futterKennzeichnungSchema>

/** Kategorie-Feld: null = „Keine Angabe" (heutiges Verhalten); ungültige Werte werden abgelehnt. */
const kategorieFeld = z.preprocess(leerZuNull, z.enum(PRODUCT_CATEGORY_VALUES).nullable()).default(null)

const produktFelder = z.object({
  name: z.string().min(2, 'Mindestens 2 Zeichen').max(100),
  description: z.string().max(1000, 'Maximal 1000 Zeichen').optional().or(z.literal('')),
  imageUrl: z.string().optional().or(z.literal('')),
  category: kategorieFeld,
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
  // Nur im Bereich Futtermittel — Pflicht dort, verboten sonst (superRefine).
  // null = keine Kennzeichnung (das Formular schreibt null, nie undefined).
  futter: futterKennzeichnungSchema.nullable().optional(),
  // ≠ ALLE nur im Bereich Futtermittel (superRefine).
  abgabe: z.enum(ABGABE_VALUES).default('ALLE'),
  countsTowardLimit: z.boolean().default(true),
  price: preisZahl,
  vatRate: mwstZahl,
  unit: z.enum(PRODUCT_UNIT_VALUES),
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

type ProduktFelder = z.infer<typeof produktFelder>

function pruefeProdukt(data: ProduktFelder, ctx: z.RefinementCtx): void {
  // Altlast aus Taxonomie 1: bleibt im Enum, wird aber nicht mehr angenommen
  // (Konzept 2.3). Ein Bestandsprodukt muss beim nächsten Speichern umziehen.
  if (istAltlastKategorie(data.category)) {
    ctx.addIssue({ code: 'custom', path: ['category'], message: FUTTER_FEHLER.altlast })
  }

  // L2 muss zur L1 gehören. Fehlt die L2, ist das KEIN Fehler — auch nicht,
  // wenn die L1 welche hätte (Bestandsprodukte); das Formular zeigt dann
  // nur einen Hinweis. Ausnahme Futtermittel, siehe unten.
  if (data.subcategory !== null) {
    if (istAltlastUnterkategorie(data.subcategory)) {
      ctx.addIssue({ code: 'custom', path: ['subcategory'], message: FUTTER_FEHLER.altlast })
    } else if (data.category === null) {
      ctx.addIssue({ code: 'custom', path: ['subcategory'], message: 'Wähle zuerst eine Kategorie.' })
    } else if (!gehoertZu(data.category, data.subcategory)) {
      ctx.addIssue({
        code: 'custom',
        path: ['subcategory'],
        message: `Diese Unterkategorie passt nicht zu ${KATEGORIE_LABEL[data.category]}.`,
      })
    }
  }

  // Der Bereich entscheidet, nicht der Vergleich mit einer einzelnen
  // Kategorie (Invariante „Bereich ist abgeleitet", ARCHITECTURE.md §5).
  if (istFuttermittel(data.category)) {
    // Heu vs. Stroh ist fachlich kein Detail, und ohne L2 gruppiert das
    // Umfeld später nicht (Rückfrage F2). Nur wo die Kategorie L2 hat.
    if (data.subcategory === null && hatUnterkategorien(data.category)) {
      ctx.addIssue({ code: 'custom', path: ['subcategory'], message: FUTTER_FEHLER.unterkategorie })
    }
    if (data.futter == null) {
      ctx.addIssue({ code: 'custom', path: ['futter'], message: FUTTER_FEHLER.fehlt })
    } else {
      const satz = futtermittelartSatz(data.category)
      const art = data.futter.futtermittelart
      // Ohne Satz (Altlast-Kategorie) gibt es keine Tabelle — der
      // Altlast-Fehler oben sagt dann schon, was zu tun ist.
      if (satz && (art === null || !futtermittelartenFuer(data.category).includes(art))) {
        ctx.addIssue({ code: 'custom', path: ['futter', 'futtermittelart'], message: satz })
      }
    }
  } else {
    if (data.futter != null) {
      ctx.addIssue({ code: 'custom', path: ['futter'], message: FUTTER_FEHLER.verboten })
    }
    if (data.abgabe !== 'ALLE') {
      ctx.addIssue({ code: 'custom', path: ['abgabe'], message: FUTTER_FEHLER.abgabe })
    }
  }

  if (istGrossgebindeEinheit(data.unit) && data.unitSize != null) {
    ctx.addIssue({ code: 'custom', path: ['unitSize'], message: FUTTER_FEHLER.grossgebinde })
  }
}

// Leerer MwSt-Satz → Vorschlag für die Kategorie. Erst am Ende, weil der
// Vorschlag von der Kategorie abhängt; mwstStandard ist nur Vorbelegung.
const mitMwstVorschlag = (data: ProduktFelder) => ({ ...data, vatRate: data.vatRate ?? mwstStandard(data.category) })

export const productFormSchema = produktFelder.superRefine(pruefeProdukt).transform(mitMwstVorschlag)

export type ProductFormData = z.infer<typeof productFormSchema>

export const KATEGORIE_PFLICHT = 'Bitte wähle eine Kategorie — so finden Kunden dein Produkt.'
export const FUTTER_OHNE_GEBINDEGROESSE =
  'Bei Futtermitteln gibst du statt der Gebindegröße das Gewicht direkt unter der Einheit an.'

/**
 * Anlegen ist strenger als Bearbeiten. Ohne Kategorie landet ein neues Produkt
 * im Bereich Sonstiges zwischen den Lebensmitteln; ein neues Futtermittel mit
 * Gebindegröße hätte zwei Gewichte, die sich widersprechen können (Gebinde und
 * Nettomenge). Bestandsprodukte bleiben mit productFormSchema speicherbar —
 * der Hof muss den Bestand ändern können, ohne das Produkt erst umzubauen.
 */
export const productAnlegenSchema = produktFelder
  // Die Pflicht sitzt am Feld, nicht in superRefine: Zod 4 überspringt
  // Querprüfungen, solange ein anderes Feld fehlt — der Button zählte die
  // Kategorie sonst erst, wenn Name und Preis schon stimmen.
  .extend({ category: kategorieFeld.refine((c) => c !== null, KATEGORIE_PFLICHT) })
  .superRefine(pruefeProdukt)
  .superRefine((data, ctx) => {
    if (istFuttermittel(data.category) && data.unitSize != null) {
      ctx.addIssue({ code: 'custom', path: ['unitSize'], message: FUTTER_OHNE_GEBINDEGROESSE })
    }
  })
  .transform(mitMwstVorschlag)

/**
 * Chip „… übernehmen" in der Produktliste (setzeKategorie): nur wählbare
 * Kategorien außerhalb der Futtermittel, die Unterkategorie passend oder leer.
 */
export const kategorieSetzenSchema = z
  .object({
    productId: z.string().min(1).max(100),
    category: z.enum(PRODUCT_CATEGORY_VALUES),
    subcategory: z.enum(PRODUCT_SUBCATEGORY_VALUES).nullable(),
  })
  .strict()
  .refine((d) => !istAltlastKategorie(d.category) && !istFuttermittel(d.category), {
    path: ['category'],
    message: 'Futtermittel brauchen eine Kennzeichnung — bitte im Produkt selbst wählen.',
  })
  .refine((d) => d.subcategory === null || (!istAltlastUnterkategorie(d.subcategory) && gehoertZu(d.category, d.subcategory)), {
    path: ['subcategory'],
    message: 'Diese Unterkategorie passt nicht zur Kategorie.',
  })

/** Anfrage des Dual-Use-Hinweises (pruefeDualUse) — Name, Kategorie und beim Bearbeiten die eigene ID. */
export const dualUseAnfrageSchema = z.object({
  name: z.string().max(100),
  category: z.enum(PRODUCT_CATEGORY_VALUES).nullable(),
  productId: z.string().min(1).max(100).optional(),
})

/**
 * Feldreihenfolge des Produktformulars — für „zum ersten Fehler springen"
 * (Muster aus dem Checkout). Gleiche Reihenfolge wie die Abschnitte im Dialog.
 */
export const PRODUKT_FELD_REIHENFOLGE = [
  'imageUrl',
  'name',
  'category',
  'subcategory',
  'description',
  'unit',
  'unitSize',
  'price',
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
  'vatRate',
  'futter',
  'abgabe',
] as const satisfies readonly (keyof ProductFormData)[]
