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
 *   Brot, Getränke, Brennholz, Sonstiges, Mischfutter und Ergänzungsfutter
 *   haben bewusst keine L2.
 *   Der BEREICH (Lebensmittel, Futtermittel, Sonstiges) ist eine Funktion der
 *   Kategorie — bereichVon — und nie eine Spalte (Sprint Bereiche 1,
 *   docs/konzepte/bereiche.md).
 *   Siegel sind orthogonal zur Kategorie: mehrere je Produkt, keines Pflicht.
 *   Tierarten gibt es nur für die Futtermittel-Kennzeichnung.
 *
 * Wer eine Unterkategorie ergänzt, ändert das Prisma-Enum UND diese Datei —
 * sonst schlägt der Abgleich-Test an. Labels stehen hier, nirgends sonst.
 */

// ---------------------------------------------------------------------------
// Kategorien (L1)
// ---------------------------------------------------------------------------

// Reihenfolge = Reihenfolge des Prisma-Enums `ProductCategory` (so steht es in
// PostgreSQL). Enthält die Altlast FUTTERMITTEL, weil Bestandsdaten sie noch
// tragen können. Für Auswahl und Anzeige gilt CATEGORY_OPTIONS — ohne Altlast.
// FISCH steht bewusst unmittelbar nach FLEISCH (Sprint kategorie-fisch).
export const PRODUCT_CATEGORY_VALUES = [
  'MILCH', 'EIER', 'FLEISCH', 'FISCH', 'GEMUESE', 'OBST',
  'BROT', 'HONIG', 'GETRAENKE', 'FUTTERMITTEL',
  'HEU_STROH', 'GETREIDE_KOERNER', 'MISCHFUTTER', 'ERGAENZUNGSFUTTER',
  'BRENNHOLZ', 'SONSTIGES',
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
  // Altlast — nur noch für Bestandsdaten in der Anzeige.
  FUTTERMITTEL: 'Futtermittel',
  HEU_STROH: 'Heu & Stroh',
  GETREIDE_KOERNER: 'Getreide & Körner',
  MISCHFUTTER: 'Mischfutter',
  ERGAENZUNGSFUTTER: 'Ergänzungsfutter',
  BRENNHOLZ: 'Brennholz',
  SONSTIGES: 'Sonstiges',
}

/**
 * Kategorien aus Taxonomie 1, die seit Bereiche 1 nicht mehr gewählt werden
 * dürfen. Postgres entfernt Enum-Werte nicht sauber — sie bleiben im Enum,
 * Zod lehnt sie ab, der Cleanup-Sprint entfernt sie (Konzept 2.3).
 */
export const ALTLAST_KATEGORIEN = ['FUTTERMITTEL'] as const satisfies readonly ProductCategoryValue[]

export function istAltlastKategorie(l1: ProductCategoryValue | null | undefined): boolean {
  return l1 != null && (ALTLAST_KATEGORIEN as readonly ProductCategoryValue[]).includes(l1)
}

/** Wählbare Kategorien (ohne Altlast) in Enum-Reihenfolge — für Select und Filterchips. */
export const CATEGORY_OPTIONS: { value: ProductCategoryValue; label: string }[] = PRODUCT_CATEGORY_VALUES
  .filter((value) => !istAltlastKategorie(value))
  .map((value) => ({ value, label: KATEGORIE_LABEL[value] }))

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
  // Altlast (Taxonomie 1): Rechtsbegriffe als L2. Bleibt, damit Bestandsdaten
  // eine Zuordnung haben; wählbar ist davon nichts mehr.
  FUTTERMITTEL: ['EINZELFUTTERMITTEL', 'MISCHFUTTERMITTEL', 'ERGAENZUNGSFUTTERMITTEL'],
  // Kunden suchen die Art, nicht den Rechtsbegriff (Konzept 2.2).
  HEU_STROH: ['WIESENHEU', 'LUZERNE', 'STROH', 'SILAGE'],
  GETREIDE_KOERNER: ['MAIS', 'HAFER', 'GERSTE', 'WEIZEN', 'ROGGEN', 'TRITICALE'],
  // Bei Misch- und Ergänzungsfutter ist die Tierart die Facette, keine L2.
  MISCHFUTTER: [],
  ERGAENZUNGSFUTTER: [],
  BRENNHOLZ: [],
  SONSTIGES: [],
} as const satisfies Record<ProductCategoryValue, readonly string[]>

export type ProductSubcategoryValue = (typeof TAXONOMIE)[ProductCategoryValue][number]

/** Alle L2 in Enum-Reihenfolge (Fleisch, Eier, Milch, Gemüse, Obst, Honig,
 *  Futtermittel-Altlast, Heu & Stroh, Getreide & Körner — so steht es im
 *  Prisma-Enum, nicht in L1-Reihenfolge). */
export const PRODUCT_SUBCATEGORY_VALUES = [
  ...TAXONOMIE.FLEISCH,
  ...TAXONOMIE.EIER,
  ...TAXONOMIE.MILCH,
  ...TAXONOMIE.GEMUESE,
  ...TAXONOMIE.OBST,
  ...TAXONOMIE.HONIG,
  ...TAXONOMIE.FUTTERMITTEL,
  ...TAXONOMIE.HEU_STROH,
  ...TAXONOMIE.GETREIDE_KOERNER,
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
  // Futtermittel-Altlast
  EINZELFUTTERMITTEL: 'Einzelfuttermittel',
  MISCHFUTTERMITTEL: 'Mischfuttermittel',
  ERGAENZUNGSFUTTERMITTEL: 'Ergänzungsfuttermittel',
  // Heu & Stroh
  WIESENHEU: 'Wiesenheu',
  LUZERNE: 'Luzerne',
  STROH: 'Stroh',
  SILAGE: 'Silage',
  // Getreide & Körner
  MAIS: 'Mais',
  HAFER: 'Hafer',
  GERSTE: 'Gerste',
  WEIZEN: 'Weizen',
  ROGGEN: 'Roggen',
  TRITICALE: 'Triticale',
}

/** L2 aus Taxonomie 1, die seit Bereiche 1 nicht mehr gewählt werden dürfen. */
export const ALTLAST_UNTERKATEGORIEN: readonly ProductSubcategoryValue[] = TAXONOMIE.FUTTERMITTEL

export function istAltlastUnterkategorie(l2: ProductSubcategoryValue | null | undefined): boolean {
  return l2 != null && ALTLAST_UNTERKATEGORIEN.includes(l2)
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
// Bereiche (Sprint Bereiche 1, docs/konzepte/bereiche.md §2.1)
// ---------------------------------------------------------------------------

export const BEREICH_VALUES = ['LEBENSMITTEL', 'FUTTERMITTEL', 'SONSTIGES'] as const

export type Bereich = (typeof BEREICH_VALUES)[number]

/**
 * Welche Kategorie zu welchem Bereich gehört. Der Bereich ist KEINE Spalte —
 * zwei Wahrheiten driften. Die Altlast FUTTERMITTEL steht hier nicht; sie ist
 * nicht wählbar, bereichVon ordnet sie trotzdem den Futtermitteln zu.
 */
export const BEREICH_KATEGORIEN = {
  LEBENSMITTEL: ['MILCH', 'EIER', 'FLEISCH', 'FISCH', 'GEMUESE', 'OBST', 'BROT', 'HONIG', 'GETRAENKE'],
  FUTTERMITTEL: ['HEU_STROH', 'GETREIDE_KOERNER', 'MISCHFUTTER', 'ERGAENZUNGSFUTTER'],
  SONSTIGES: ['BRENNHOLZ', 'SONSTIGES'],
} as const satisfies Record<Bereich, readonly ProductCategoryValue[]>

/** Der Bereich einer Kategorie. Ohne Kategorie: Sonstiges. */
export function bereichVon(l1: ProductCategoryValue | null | undefined): Bereich {
  if (l1 == null) return 'SONSTIGES'
  // Die Altlast ist fachlich Futter: Bestandsdaten mit FUTTERMITTEL behalten so
  // ihre Kennzeichnungspflicht und bleiben aus den Lebensmittel-Chips heraus.
  if (l1 === 'FUTTERMITTEL') return 'FUTTERMITTEL'
  for (const bereich of BEREICH_VALUES) {
    if ((BEREICH_KATEGORIEN[bereich] as readonly ProductCategoryValue[]).includes(l1)) return bereich
  }
  // Jede wählbare Kategorie steht in BEREICH_KATEGORIEN — das sichert ein Test.
  return 'SONSTIGES'
}

export function istFuttermittel(l1: ProductCategoryValue | null | undefined): boolean {
  return bereichVon(l1) === 'FUTTERMITTEL'
}

/**
 * Die zwei Kacheln im Kategorie-Sheet des Produktformulars. Sonstiges liegt
 * unter Lebensmittel (Konzept 6.1) — für den Hof gibt es nur „für Menschen"
 * und „für Tiere".
 */
export const FORMULAR_KACHELN = {
  LEBENSMITTEL: {
    titel: 'Lebensmittel',
    untertitel: 'Für Menschen',
    kategorien: [...BEREICH_KATEGORIEN.LEBENSMITTEL, ...BEREICH_KATEGORIEN.SONSTIGES],
  },
  FUTTERMITTEL: {
    titel: 'Futtermittel',
    untertitel: 'Für Tiere',
    kategorien: [...BEREICH_KATEGORIEN.FUTTERMITTEL],
  },
} as const

export type FormularKachel = keyof typeof FORMULAR_KACHELN

export function kachelVon(l1: ProductCategoryValue | null | undefined): FormularKachel {
  return istFuttermittel(l1) ? 'FUTTERMITTEL' : 'LEBENSMITTEL'
}

// ---------------------------------------------------------------------------
// Futtermittelart (Konzept 2.4) — Pflichtangabe nach VO (EG) 767/2009
// ---------------------------------------------------------------------------

export const FUTTERMITTELART_VALUES = [
  'EINZELFUTTERMITTEL', 'ALLEINFUTTERMITTEL', 'ERGAENZUNGSFUTTERMITTEL', 'MINERALFUTTERMITTEL',
] as const

export type FuttermittelartValue = (typeof FUTTERMITTELART_VALUES)[number]

export const FUTTERMITTELART_LABEL: Record<FuttermittelartValue, string> = {
  EINZELFUTTERMITTEL: 'Einzelfuttermittel',
  ALLEINFUTTERMITTEL: 'Alleinfuttermittel',
  ERGAENZUNGSFUTTERMITTEL: 'Ergänzungsfuttermittel',
  MINERALFUTTERMITTEL: 'Mineralfuttermittel',
}

/** Ein Satz je Art, aus dem Glossar des Konzepts — steht im Formular unter der Auswahl. */
export const FUTTERMITTELART_ERKLAERUNG: Record<FuttermittelartValue, string> = {
  EINZELFUTTERMITTEL: 'Ein einzelner Ausgangsstoff, zum Beispiel Heu oder Hafer.',
  ALLEINFUTTERMITTEL: 'Eine Mischung, die den Bedarf der Tiere allein deckt.',
  ERGAENZUNGSFUTTERMITTEL: 'Eine Mischung, die zusammen mit anderem Futter gefüttert wird.',
  MINERALFUTTERMITTEL: 'Ein Ergänzungsfutter mit mindestens 40 % Rohasche.',
}

/**
 * Welche Futtermittelart zu welcher Kategorie passt (Tabelle 2.4) und der
 * Satz, der das begründet. Der Satz ist zugleich die Fehlermeldung (F4) und
 * die Erklärung, warum das Feld bei genau einem Wert schon vorbelegt ist.
 */
const FUTTERMITTELART_REGEL: Partial<
  Record<ProductCategoryValue, { erlaubt: readonly FuttermittelartValue[]; satz: string }>
> = {
  HEU_STROH: {
    erlaubt: ['EINZELFUTTERMITTEL'],
    satz: 'Ein Produkt aus Heu & Stroh ist ein Einzelfuttermittel.',
  },
  GETREIDE_KOERNER: {
    erlaubt: ['EINZELFUTTERMITTEL'],
    satz: 'Ein Produkt aus Getreide & Körnern ist ein Einzelfuttermittel.',
  },
  MISCHFUTTER: {
    erlaubt: ['ALLEINFUTTERMITTEL'],
    satz: 'Mischfutter ist ein Alleinfuttermittel.',
  },
  ERGAENZUNGSFUTTER: {
    erlaubt: ['ERGAENZUNGSFUTTERMITTEL', 'MINERALFUTTERMITTEL'],
    satz: 'Ergänzungsfutter ist ein Ergänzungsfuttermittel oder Mineralfuttermittel.',
  },
}

/** Die erlaubten Futtermittelarten einer Kategorie; leer außerhalb der Futtermittel. */
export function futtermittelartenFuer(l1: ProductCategoryValue | null | undefined): readonly FuttermittelartValue[] {
  if (l1 == null) return []
  return FUTTERMITTELART_REGEL[l1]?.erlaubt ?? []
}

/** Der Satz zur Futtermittelart einer Kategorie — Fehlertext und Begründung; null ohne Regel. */
export function futtermittelartSatz(l1: ProductCategoryValue | null | undefined): string | null {
  if (l1 == null) return null
  return FUTTERMITTELART_REGEL[l1]?.satz ?? null
}

// ---------------------------------------------------------------------------
// Nettomenge und Gebinde
// ---------------------------------------------------------------------------

export const NETTO_EINHEIT_VALUES = ['KG', 'LITER'] as const

export type NettoEinheitValue = (typeof NETTO_EINHEIT_VALUES)[number]

export const NETTO_EINHEIT_LABEL: Record<NettoEinheitValue, string> = { KG: 'kg', LITER: 'L' }

/** Ab diesem Gebinde-Inhalt gilt ein Futtermittel als Großgebinde (Konzept §9). */
export const GROSSGEBINDE_AB_KG = 25

/**
 * Großgebinde ab 25 kg Inhalt — genau 25 kg zählt schon als groß. Liter zählen
 * 1:1 als kg: Für die Einordnung reicht das; eine Dichte kennt die Plattform nicht.
 */
export function istGrossgebinde(
  nettoMenge: number | { toString(): string },
  // Die Einheit ändert nichts an der Schwelle — sie steht im Aufruf (Signatur
  // aus Konzept §4), damit die 1:1-Annahme für Liter sichtbar bleibt, wo sie
  // getroffen wird.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bewusst ungenutzt, siehe oben
  _nettoEinheit: NettoEinheitValue
): boolean {
  const menge = typeof nettoMenge === 'number' ? nettoMenge : Number(nettoMenge.toString())
  return Number.isFinite(menge) && menge >= GROSSGEBINDE_AB_KG
}

/** Einheiten, deren Gewicht in der Kennzeichnung steht statt in unitSize. */
export const GROSSGEBINDE_EINHEITEN = ['BALLEN', 'BIGBAG'] as const

export function istGrossgebindeEinheit(unit: string): boolean {
  return (GROSSGEBINDE_EINHEITEN as readonly string[]).includes(unit)
}

/**
 * Bietet das Formular Ballen und Big Bags an? In den Bereichen Futtermittel und
 * Sonstiges ja (Brennholz im Big Bag), bei Lebensmitteln nicht (Rückfrage F7).
 * Reine Formularlogik — Zod prüft das bewusst nicht.
 */
export function grossgebindeEinheitenAngeboten(l1: ProductCategoryValue | null | undefined): boolean {
  return bereichVon(l1) !== 'LEBENSMITTEL'
}

// ---------------------------------------------------------------------------
// Abgabe und Betrieb
// ---------------------------------------------------------------------------

export const ABGABE_VALUES = ['ALLE', 'NUR_BETRIEBE'] as const

export type AbgabeValue = (typeof ABGABE_VALUES)[number]

export const BETRIEBSSTATUS_VALUES = ['PRIMAERPRODUKTION', 'REGISTRIERT', 'ZUGELASSEN'] as const

export type BetriebsstatusValue = (typeof BETRIEBSSTATUS_VALUES)[number]

/** Name und Hilfesatz je Status — welche Nummer in Farm.betriebsnummer steht (Konzept §3). */
export const BETRIEBSSTATUS: Record<BetriebsstatusValue, { name: string; hilfe: string }> = {
  PRIMAERPRODUKTION: {
    name: 'Primärproduktion',
    hilfe: 'Du verkaufst nur selbst erzeugtes Futter — trag deine LFBIS-Nummer ein.',
  },
  REGISTRIERT: {
    name: 'Registriert',
    hilfe: 'Du handelst oder lagerst Futter — trag deine BAES- bzw. BVL-Registrierungsnummer ein.',
  },
  ZUGELASSEN: {
    name: 'Zugelassen',
    hilfe: 'Du mischst mit zulassungspflichtigen Zusatzstoffen — trag deine α-Nummer nach VO (EG) 183/2005 ein.',
  },
}

/**
 * Welche Betriebsnummer zu einem Futtermittel angezeigt wird: die des Hofs
 * (Farm.betriebsnummer, Rückfrage F6), sonst die Altlast aus der Kennzeichnung.
 * null, wenn keine da ist.
 */
export function betriebsnummerFuerAnzeige(
  hof: { betriebsnummer: string | null },
  kennzeichnung: { registrierungsnummer: string | null } | null
): string | null {
  const vomHof = hof.betriebsnummer?.trim()
  if (vomHof) return vomHof
  const altlast = kennzeichnung?.registrierungsnummer?.trim()
  return altlast ? altlast : null
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

// ---------------------------------------------------------------------------
// Kategorie-Vorschlag aus dem Produktnamen (Sprint Produktformular Nachschliff)
// ---------------------------------------------------------------------------

/**
 * Wörter, bei denen nur der Hof weiß, ob es für Menschen oder Tiere ist. Sie
 * lösen NIE einen Vorschlag aus — auch nicht als Wortanfang („Haferflocken").
 * Ein falscher Vorschlag würde das Produkt in den falschen Bereich legen.
 */
export const DUAL_USE = [
  'Mais', 'Hafer', 'Gerste', 'Weizen', 'Roggen', 'Triticale', 'Erdäpfel', 'Kartoffel',
] as const

/**
 * Kurze Synonymliste: Wörter, die kein Label sind, aber eindeutig eine
 * Unterkategorie meinen. Zählen nur als GANZES Wort — „Heu" darf nicht
 * „Heumilch" treffen; Heumilch ist in Österreich ein eigener Begriff.
 */
const SYNONYME: Readonly<Record<string, ProductSubcategoryValue>> = {
  Heu: 'WIESENHEU',
  Heuballen: 'WIESENHEU',
  Heumilch: 'TRINKMILCH',
  Milch: 'TRINKMILCH',
  Speck: 'WURST',
  Salami: 'WURST',
  Schinken: 'WURST',
  Hendl: 'HAEHNCHEN',
  Huhn: 'HAEHNCHEN',
  Apfel: 'KERNOBST',
  Äpfel: 'KERNOBST',
  Birnen: 'KERNOBST',
  Kirschen: 'STEINOBST',
  Zwetschken: 'STEINOBST',
  Marillen: 'STEINOBST',
  Erdbeeren: 'BEEREN',
  Himbeeren: 'BEEREN',
  Heidelbeeren: 'BEEREN',
  Karotten: 'WURZELGEMUESE',
  Tomaten: 'FRUCHTGEMUESE',
}

/**
 * Unterkategorien, deren Label allein nichts sagt („Bio", „Freiland"). Sie
 * zählen nur, wenn im Namen auch ihre Kategorie steht — sonst würde
 * „Bio-Lammfleisch" zu Eier › Bio.
 */
const ALLGEMEINE_L2: readonly ProductSubcategoryValue[] = ['EIER_BIO', 'EIER_FREILAND', 'EIER_BODENHALTUNG']

/** Kategorien, die nie vorgeschlagen werden: Altlast und „Sonstiges" (sagt nichts). */
const OHNE_VORSCHLAG: readonly ProductCategoryValue[] = ['FUTTERMITTEL', 'SONSTIGES']

/** Klein, Umlaute ausgeschrieben, ß → ss — „Erdäpfel" und „Erdaepfel" sind dasselbe Wort. */
function normiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

function woerter(text: string): string[] {
  return normiere(text).split(/[^a-z0-9]+/).filter(Boolean)
}

/** „Joghurt & Topfen" → [joghurt, topfen]: jeder Teil eines Labels ist ein Schlüssel. */
function labelSchluessel(label: string): string[] {
  return woerter(label).filter((w) => w.length >= 3)
}

// Kurze Schlüssel (Heu, Bio) nur als ganzes Wort: Am Wortanfang träfe „Heu"
// auch „Heurigenbrot" und „Heute".
const KURZ_BIS = 3

const trifftWortanfang = (namensWoerter: string[], schluessel: string[]) =>
  schluessel.some((s) =>
    namensWoerter.some((w) => (s.length <= KURZ_BIS ? w === s : w.startsWith(s)))
  )

export type KategorieVorschlag = {
  category: ProductCategoryValue
  subcategory: ProductSubcategoryValue | null
}

/**
 * Schlägt aus dem Produktnamen eine Kategorie vor — nur, wenn es EINEN
 * eindeutigen Treffer gibt; sonst null. Ein Vorschlag ist nie eine Wahl: Das
 * Formular zeigt ihn als Chip, übernommen wird er erst mit einem Tipp.
 *
 * Regeln: Labels der Unterkategorien und Kategorien zählen am Wortanfang
 * („Lammfleisch" → Lamm), Synonyme und Label-Teile bis drei Buchstaben (Heu,
 * Bio) nur als ganzes Wort. Unterkategorie-Treffer
 * gehen vor Kategorie-Treffern. Mehrere Unterkategorien derselben Kategorie
 * („Lammwurst") ergeben nur die Kategorie. Ein Wort aus DUAL_USE verhindert
 * jeden Vorschlag.
 */
export function kategorieVorschlag(name: string): KategorieVorschlag | null {
  const namensWoerter = woerter(name)
  if (namensWoerter.length === 0) return null

  const dualUse = DUAL_USE.map(normiere)
  if (namensWoerter.some((w) => dualUse.some((d) => w.startsWith(d)))) return null

  const l1Treffer = new Set<ProductCategoryValue>()
  for (const l1 of CATEGORY_OPTIONS.map((o) => o.value)) {
    if (OHNE_VORSCHLAG.includes(l1)) continue
    if (trifftWortanfang(namensWoerter, labelSchluessel(KATEGORIE_LABEL[l1]))) l1Treffer.add(l1)
  }
  // „Ei" ist zu kurz für einen Wortanfang („Eis", „Eintopf") — nur als ganzes Wort.
  if (namensWoerter.includes('ei')) l1Treffer.add('EIER')

  const l2Treffer = new Set<ProductSubcategoryValue>()
  for (const l2 of PRODUCT_SUBCATEGORY_VALUES) {
    if (istAltlastUnterkategorie(l2)) continue
    if (!trifftWortanfang(namensWoerter, labelSchluessel(UNTERKATEGORIE_LABEL[l2]))) continue
    if (ALLGEMEINE_L2.includes(l2) && !l1Treffer.has(kategorieVon(l2))) continue
    l2Treffer.add(l2)
  }
  for (const [wort, l2] of Object.entries(SYNONYME)) {
    if (namensWoerter.includes(normiere(wort))) l2Treffer.add(l2)
  }

  if (l2Treffer.size > 0) {
    if (l2Treffer.size === 1) {
      const [l2] = l2Treffer
      return { category: kategorieVon(l2), subcategory: l2 }
    }
    const kategorien = new Set([...l2Treffer].map(kategorieVon))
    if (kategorien.size === 1) {
      const [l1] = kategorien
      return { category: l1, subcategory: null }
    }
    return null
  }

  if (l1Treffer.size === 1) {
    const [l1] = l1Treffer
    return { category: l1, subcategory: null }
  }
  return null
}
