/**
 * Produkt-Taxonomie — die EINE Quelle für Kategorien, Unterkategorien, Siegel
 * und Tierarten (Sprint Taxonomie 1).
 *
 * Rein, ohne Datenbank: Die Wertlisten spiegeln die Prisma-Enums
 * (prisma/schema.prisma) in derselben Reihenfolge; ein Test hält beide
 * deckungsgleich. Diese Datei läuft auch im Browser (Produktformular) — deshalb
 * keine Prisma-Typen, sondern eigene Literale.
 *
 * DIE REGELN:
 *   Jede Unterkategorie (L2) gehört zu GENAU EINER Kategorie (L1). Fisch,
 *   Brot, Getränke, Brennholz und Sonstiges haben bewusst keine L2.
 *   Siegel sind orthogonal zur Kategorie: mehrere je Produkt, keines Pflicht.
 *   Tierarten gibt es nur für die Futtermittel-Kennzeichnung.
 *
 * Wer eine Unterkategorie ergänzt, ändert das Prisma-Enum UND diese Datei —
 * sonst schlägt der Abgleich-Test an. Labels stehen hier, nirgends sonst.
 */

// ---------------------------------------------------------------------------
// Kategorien (L1)
// ---------------------------------------------------------------------------

// Reihenfolge = Reihenfolge des Prisma-Enums `ProductCategory` und zugleich
// die Sortierung in Filterleiste und Produktformular. FISCH steht bewusst
// unmittelbar nach FLEISCH (Sprint kategorie-fisch), FUTTERMITTEL vor
// BRENNHOLZ (Sprint Taxonomie 1).
export const PRODUCT_CATEGORY_VALUES = [
  'MILCH', 'EIER', 'FLEISCH', 'FISCH', 'GEMUESE', 'OBST',
  'BROT', 'HONIG', 'GETRAENKE', 'FUTTERMITTEL', 'BRENNHOLZ', 'SONSTIGES',
] as const

export type ProductCategoryValue = (typeof PRODUCT_CATEGORY_VALUES)[number]

export const KATEGORIE_LABEL: Record<ProductCategoryValue, string> = {
  MILCH: 'Milch & Molkerei',
  EIER: 'Eier',
  FLEISCH: 'Fleisch & Wurst',
  FISCH: 'Fisch',
  GEMUESE: 'Gemüse',
  OBST: 'Obst',
  BROT: 'Brot & Gebäck',
  HONIG: 'Honig & Bienenprodukte',
  GETRAENKE: 'Getränke',
  FUTTERMITTEL: 'Futtermittel',
  BRENNHOLZ: 'Brennholz',
  SONSTIGES: 'Sonstiges',
}

/** Wert + Label in Enum-Reihenfolge — für Select und Filterchips. */
export const CATEGORY_OPTIONS: { value: ProductCategoryValue; label: string }[] =
  PRODUCT_CATEGORY_VALUES.map((value) => ({ value, label: KATEGORIE_LABEL[value] }))

// ---------------------------------------------------------------------------
// Unterkategorien (L2)
// ---------------------------------------------------------------------------

/** Welche L2 zu welcher L1 gehört. Leeres Array = keine Unterkategorien. */
export const TAXONOMIE = {
  MILCH: ['TRINKMILCH', 'KAESE', 'JOGHURT_TOPFEN', 'BUTTER'],
  EIER: ['EIER_BIO', 'EIER_FREILAND', 'EIER_BODENHALTUNG'],
  FLEISCH: ['RIND', 'SCHWEIN', 'HAEHNCHEN', 'PUTE', 'LAMM', 'WILD', 'WURST'],
  FISCH: [],
  GEMUESE: [
    'ERDAEPFEL', 'WURZELGEMUESE', 'BLATT_SALAT', 'KOHL', 'FRUCHTGEMUESE',
    'KUERBIS', 'ZWIEBEL_LAUCH', 'KRAEUTER', 'EINGELEGT',
  ],
  OBST: ['KERNOBST', 'STEINOBST', 'BEEREN', 'NUESSE', 'EINGEKOCHT_GETROCKNET'],
  BROT: [],
  HONIG: ['BLUETENHONIG', 'WALDHONIG', 'SORTENHONIG', 'BIENENPRODUKTE'],
  GETRAENKE: [],
  FUTTERMITTEL: ['EINZELFUTTERMITTEL', 'MISCHFUTTERMITTEL', 'ERGAENZUNGSFUTTERMITTEL'],
  BRENNHOLZ: [],
  SONSTIGES: [],
} as const satisfies Record<ProductCategoryValue, readonly string[]>

export type ProductSubcategoryValue = (typeof TAXONOMIE)[ProductCategoryValue][number]

/** Alle L2 in Enum-Reihenfolge (Fleisch, Eier, Milch, Gemüse, Obst, Honig,
 *  Futtermittel — so steht es im Prisma-Enum, nicht in L1-Reihenfolge). */
export const PRODUCT_SUBCATEGORY_VALUES = [
  ...TAXONOMIE.FLEISCH,
  ...TAXONOMIE.EIER,
  ...TAXONOMIE.MILCH,
  ...TAXONOMIE.GEMUESE,
  ...TAXONOMIE.OBST,
  ...TAXONOMIE.HONIG,
  ...TAXONOMIE.FUTTERMITTEL,
] as const satisfies readonly ProductSubcategoryValue[]

// Deutsch, mit Umlauten. Die L1 steht in der Anzeige daneben — deshalb
// „Freiland", nicht „Eier: Freiland".
export const UNTERKATEGORIE_LABEL: Record<ProductSubcategoryValue, string> = {
  // Fleisch
  RIND: 'Rind',
  SCHWEIN: 'Schwein',
  HAEHNCHEN: 'Hähnchen',
  PUTE: 'Pute',
  LAMM: 'Lamm',
  WILD: 'Wild',
  WURST: 'Wurst',
  // Eier
  EIER_BIO: 'Bio',
  EIER_FREILAND: 'Freiland',
  EIER_BODENHALTUNG: 'Bodenhaltung',
  // Milch
  TRINKMILCH: 'Trinkmilch',
  KAESE: 'Käse',
  JOGHURT_TOPFEN: 'Joghurt & Topfen',
  BUTTER: 'Butter',
  // Gemüse
  ERDAEPFEL: 'Erdäpfel',
  WURZELGEMUESE: 'Wurzelgemüse',
  BLATT_SALAT: 'Blatt & Salat',
  KOHL: 'Kohl',
  FRUCHTGEMUESE: 'Fruchtgemüse',
  KUERBIS: 'Kürbis',
  ZWIEBEL_LAUCH: 'Zwiebel & Lauch',
  KRAEUTER: 'Kräuter',
  EINGELEGT: 'Eingelegt',
  // Obst
  KERNOBST: 'Kernobst',
  STEINOBST: 'Steinobst',
  BEEREN: 'Beeren',
  NUESSE: 'Nüsse',
  EINGEKOCHT_GETROCKNET: 'Eingekocht & Getrocknet',
  // Honig
  BLUETENHONIG: 'Blütenhonig',
  WALDHONIG: 'Waldhonig',
  SORTENHONIG: 'Sortenhonig',
  BIENENPRODUKTE: 'Bienenprodukte',
  // Futtermittel
  EINZELFUTTERMITTEL: 'Einzelfuttermittel',
  MISCHFUTTERMITTEL: 'Mischfuttermittel',
  ERGAENZUNGSFUTTERMITTEL: 'Ergänzungsfuttermittel',
}

/** Die Unterkategorien einer Kategorie in Anzeigereihenfolge; leer ohne L2. */
export function unterkategorienVon(l1: ProductCategoryValue): readonly ProductSubcategoryValue[] {
  return TAXONOMIE[l1]
}

/** Hat diese Kategorie überhaupt Unterkategorien? */
export function hatUnterkategorien(l1: ProductCategoryValue | null | undefined): boolean {
  return l1 != null && TAXONOMIE[l1].length > 0
}

/** Gehört die L2 zur L1? Ohne L1 gehört nichts irgendwohin. */
export function gehoertZu(
  l1: ProductCategoryValue | null | undefined,
  l2: ProductSubcategoryValue
): boolean {
  if (l1 == null) return false
  return (TAXONOMIE[l1] as readonly ProductSubcategoryValue[]).includes(l2)
}

/** Die L1, zu der eine L2 gehört — es gibt genau eine. */
export function kategorieVon(l2: ProductSubcategoryValue): ProductCategoryValue {
  const treffer = PRODUCT_CATEGORY_VALUES.find((l1) => gehoertZu(l1, l2))
  // Jede L2 steht in TAXONOMIE — das sichert der Typ. Ohne Treffer wäre die
  // Tabelle kaputt, nicht die Eingabe; deshalb ein Fehler statt eines Rückfalls.
  if (!treffer) throw new Error(`Unterkategorie ohne Kategorie: ${l2}`)
  return treffer
}

/**
 * Lohnt sich eine Unterkategorie-Ebene in der Anzeige? Erst ab zwei
 * VERSCHIEDENEN L2 in der Menge — eine einzige würde nur wiederholen, was
 * ohnehin da ist. Für spätere Sprints (Hofseite, Filter); heute nur getestet.
 */
export function zeigeUnterkategorien(
  produkte: ReadonlyArray<{ subcategory: ProductSubcategoryValue | null }>
): boolean {
  const verschiedene = new Set<ProductSubcategoryValue>()
  for (const p of produkte) {
    if (p.subcategory) verschiedene.add(p.subcategory)
    if (verschiedene.size >= 2) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Siegel
// ---------------------------------------------------------------------------

export const PRODUCT_LABEL_VALUES = ['BIO', 'GENTECHNIKFREI', 'AMA_GUETESIEGEL'] as const

export type ProductLabelValue = (typeof PRODUCT_LABEL_VALUES)[number]

export type Siegel = {
  name: string
  /** Ein Satz in Du-Form, ohne Fachjargon — steht im Formular unter dem Häkchen. */
  erklaerung: string
  /** Gibt es ein Symbol dafür (Bio: Blatt)? Ohne Symbol steht nur der Name. */
  hatIcon: boolean
}

export const SIEGEL: Record<ProductLabelValue, Siegel> = {
  BIO: {
    name: 'Bio',
    erklaerung: 'Das Produkt kommt aus biologischer Landwirtschaft — du hast dafür eine gültige Bio-Zertifizierung.',
    hatIcon: true,
  },
  GENTECHNIKFREI: {
    name: 'Gentechnikfrei',
    erklaerung: 'Die Tiere wurden ohne gentechnisch veränderte Futtermittel gefüttert.',
    hatIcon: false,
  },
  AMA_GUETESIEGEL: {
    name: 'AMA-Gütesiegel',
    erklaerung: 'Herkunft und Qualität wurden unabhängig geprüft — die Rohstoffe kommen aus Österreich.',
    hatIcon: false,
  },
}

/** Doppelte Siegel entfernen, Reihenfolge wie in PRODUCT_LABEL_VALUES. */
export function bereinigeSiegel(labels: readonly ProductLabelValue[]): ProductLabelValue[] {
  const gesetzt = new Set(labels)
  return PRODUCT_LABEL_VALUES.filter((l) => gesetzt.has(l))
}

// ---------------------------------------------------------------------------
// Tierarten (Futtermittel-Kennzeichnung)
// ---------------------------------------------------------------------------

export const TIERART_VALUES = ['PFERD', 'RIND', 'GEFLUEGEL', 'SCHWEIN', 'SCHAF_ZIEGE', 'HEIMTIER'] as const

export type TierartValue = (typeof TIERART_VALUES)[number]

/** Deutsch, Plural — „für Pferde und Rinder". */
export const TIERART_LABEL: Record<TierartValue, string> = {
  PFERD: 'Pferde',
  RIND: 'Rinder',
  GEFLUEGEL: 'Geflügel',
  SCHWEIN: 'Schweine',
  SCHAF_ZIEGE: 'Schafe & Ziegen',
  HEIMTIER: 'Heimtiere',
}
