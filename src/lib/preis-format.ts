/**
 * ALTLAST — nur noch `formatEuro` mit dem Symbol HINTEN („50,00 €").
 *
 * `formatPrice` ist im Sprint Preis-Semantik nach src/lib/format.ts gewandert
 * (formatGrundpreis + formatGrundpreisZeile), damit Hofseite, Hofübersicht,
 * Warenkorb und Bauern-Bereich dieselbe Schreibweise zeigen.
 *
 * Diese `formatEuro`-Variante nutzen noch die Warenkorb-Summe der Hofseite,
 * die Bestellsummen im Checkout und die Servicegebühr-Einstellung. Kanonisch
 * ist `formatEuro` aus src/lib/format.ts („€ 50,00", Symbol vorn). Wer eine
 * dieser Stellen anfasst, stellt sie um; ist keine mehr übrig, fällt die Datei.
 */
export function formatEuro(n: number): string {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n)
}
