import { UNIT_LABELS } from '@/schemas/product'

/**
 * Preis- und Einheiten-Darstellung der öffentlichen Hofseite — EIN Format
 * für alle Orte, an denen eine Kundin einen Produktpreis sieht.
 *
 * Herkunft: Diese beiden Funktionen standen wörtlich so in
 * src/components/farm/product-grid.tsx (der Hofseite). Sie sind hierher
 * gewandert, damit die Produktvorschau der Hofübersicht sie BENUTZEN kann,
 * statt ein zweites Format zu erfinden — die Hofseite importiert sie jetzt
 * von hier, ihre Ausgabe ist unverändert.
 *
 * (Der reine `formatEuro`-Baustein existiert im Repo noch an weiteren
 * Stellen — Verkäufe, Auswertungen, Warenkorb. Die zusammenzuführen ist
 * eigene Pflegearbeit und gehört nicht in diesen Sprint.)
 */
export function formatEuro(n: number): string {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n)
}

/** „3,50 € / kg" bzw. „4,20 € / 0.5 kg", wenn eine Gebindegröße gesetzt ist. */
export function formatPrice(price: number, unit: string, unitSize: number | null): string {
  const unitLabel = UNIT_LABELS[unit] ?? unit
  if (unitSize && unitSize !== 1) return `${formatEuro(price)} / ${unitSize} ${unitLabel}`
  return `${formatEuro(price)} / ${unitLabel}`
}
