import { mitAnzahl } from '@/lib/format'
import type { UmfeldKm } from '@/lib/umfeld'

/*
 * Die Hinweise über den Futterkarten wörtlich nach Board s1-/w1-region Bild 2 (Liste Lauf 32 region, Nr. 272):
 * am Handy die Zahl der Höfe statt der Angebote („10 Angebote · nur Höfe mit LFBIS-Nummer“ zählte Angebote; das
 * Board und E9 zählen Höfe), im Web der Satz mit dem Umkreis. Nur Text, gezählt wird in src/lib/futter-kaufen.ts
 * (die Pins der Karte sind genau die Höfe der gezeigten Angebote).
 */

/** „2 Höfe mit LFBIS-Nummer“ — am Handy neben „Liste / Karte“. */
export function futterZahlZeile(hoefe: number): string {
  return mitAnzahl(hoefe, 'Hof mit LFBIS-Nummer', 'Höfe mit LFBIS-Nummer')
}

/** „Höfe mit LFBIS-Nummer im Umkreis von 25 km – du kaufst für deine Tiere.“ — im Web über Liste und Karte. */
export function futterHinweisImUmkreis(km: UmfeldKm): string {
  return `Höfe mit LFBIS-Nummer im Umkreis von ${km} km – du kaufst für deine Tiere.`
}
