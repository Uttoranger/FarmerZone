/**
 * Das Kachelraster „Was suchst du?" der Startseite — EINE Konfiguration für
 * beide Gruppen, rein und ohne Browser prüfbar (tests/startseite.test.ts).
 *
 * Beide Gruppen sehen gleich aus: Futter ist ein zweiter Einstieg neben dem
 * Hofladen, kein farbiger Sonderblock. Die Namen kommen aus KATEGORIE_LABEL,
 * die Links aus schreibeHoefeFilter — so landet jede Kachel genau dort, wo
 * /hoefe den Filter liest (bereich + kat). Die Bilder setzt die Seite über
 * product-image.ts dazu; dieses Modul bleibt dafür ohne Dateizugriff.
 */
import type { ProductCategoryValue } from '@/schemas/product'
import { LEERER_HOEFE_FILTER, schreibeHoefeFilter } from '@/schemas/hoefe-filter'
import { KATEGORIE_LABEL, type AnzeigeBereich } from '@/lib/taxonomie'

export type KachelGruppe = {
  titel: string
  /** Kleine Zeile unter dem Titel; null, wo es nichts hinzuzufügen gibt. */
  untertitel: string | null
  bereich: AnzeigeBereich
  kategorien: readonly ProductCategoryValue[]
}

export const STARTSEITE_KACHELGRUPPEN = [
  {
    titel: 'Für die Küche',
    untertitel: null,
    bereich: 'LEBENSMITTEL',
    kategorien: ['EIER', 'FLEISCH', 'MILCH', 'GEMUESE', 'BROT', 'HONIG'],
  },
  {
    titel: 'Für Stall und Tiere',
    untertitel: 'Mit Kilopreis und allen Pflichtangaben — vom Kleinballen bis zum Big Bag.',
    bereich: 'FUTTERMITTEL',
    kategorien: ['HEU_STROH', 'GETREIDE_KOERNER', 'MISCHFUTTER', 'ERGAENZUNGSFUTTER'],
  },
] as const satisfies readonly KachelGruppe[]

export type Kachel = { kategorie: ProductCategoryValue; name: string; href: string }

/** Der Weg einer Kachel: die Hofübersicht, gefiltert auf Bereich und Kategorie. */
export function kachelLink(bereich: AnzeigeBereich, kategorie: ProductCategoryValue): string {
  const query = schreibeHoefeFilter({ ...LEERER_HOEFE_FILTER, bereich, kategorien: [kategorie] })
  return query ? `/hoefe?${query}` : '/hoefe'
}

/** Die Kacheln einer Gruppe in ihrer Reihenfolge. */
export function kachelnVon(gruppe: KachelGruppe): Kachel[] {
  return gruppe.kategorien.map((kategorie) => ({
    kategorie,
    name: KATEGORIE_LABEL[kategorie],
    href: kachelLink(gruppe.bereich, kategorie),
  }))
}
