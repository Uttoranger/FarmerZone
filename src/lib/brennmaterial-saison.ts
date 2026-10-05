import { wienKalendertag } from '@/lib/kalender'

/**
 * Die Brennmaterial-Saison: Oktober bis März (Gate 4, Startseite —
 * „Brennmaterial-Band nur Oktober–März"). Außerhalb der Heizzeit wirbt die
 * Startseite nicht für Brennholz; die Kategorie selbst bleibt das ganze Jahr
 * über auffindbar (Chip, /hoefe).
 *
 * Der Monat ist der WIENER Monat, nie Serverzeit (CODING_STANDARDS §2): Vercel
 * rechnet in UTC — am 1. Oktober um 0:30 Uhr stünde die Seite sonst noch im
 * September, am 1. April um 1:00 Uhr noch im März.
 */

/** Die Monate der Saison (1 = Jänner) — Oktober, November, Dezember, Jänner, Februar, März. */
export const BRENNMATERIAL_SAISON_MONATE: readonly number[] = [10, 11, 12, 1, 2, 3]

/** Der Wortlaut der Saison-Marke am Band. */
export const BRENNMATERIAL_SAISON_TEXT = 'Saison Oktober bis März'

/** Ob die Startseite das Brennmaterial-Band zeigt — rein, `jetzt` ist Parameter. */
export function istBrennmaterialSaison(jetzt: Date): boolean {
  const monat = Number(wienKalendertag(jetzt).slice(5, 7))
  return BRENNMATERIAL_SAISON_MONATE.includes(monat)
}
