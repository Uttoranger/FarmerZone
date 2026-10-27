/**
 * Besuch über einen geteilten Link (Register T1, Nr. 25) — die reine Regel,
 * was die Hofseite aus ihrer Adresse liest.
 *
 * Der Kanal kommt NUR aus der aktuellen Adresse (`?k=wa` …), nichts wird im
 * Browser abgelegt: kein Cookie und auch kein anderer Speicher auf dem Gerät
 * der Kundin (§ 165 Abs. 3 TKG ohne Einwilligung vermeiden). Dass ein Besuch
 * genau einmal zählt, sichert allein das Entfernen von `k` aus der Adresse:
 * Danach findet ein Neuladen, ein zweiter Effekt (Strict Mode) oder ein
 * Zurück nichts mehr (tests/teilen-zaehlung.test.ts).
 */
// Ohne Zod (Nr. 196): Die Hofseite lädt diese Regel im Browser (tests/leistung-196.test.ts).
import { TEILEN_PARAMETER, istKanalCode, type TeilenKanalCode } from '@/lib/teilen-kanal'

export type BesuchAusAdresse = {
  /** Das gültige Kürzel — nur dann wird ein Besuch gemeldet. */
  kanal: TeilenKanalCode | null
  /** Die Adresse ohne `?k=…` (Rest, Reiter, `beitrag`, Anker bleiben), oder null, wenn es nichts zu entfernen gibt. */
  ohne: string | null
}

/**
 * Liest `?k=` aus der Adresse. Ein ungültiger Wert zählt nicht, verlässt aber
 * trotzdem die Adresse — teilt die Kundin die Seite weiter, trägt der Link
 * nichts vom Hof mit. Wirft nie.
 */
export function teilenBesuchAusAdresse(href: string): BesuchAusAdresse {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    // Keine lesbare Adresse: dann gibt es nichts zu zählen und nichts zu entfernen.
    return { kanal: null, ohne: null }
  }
  if (!url.searchParams.has(TEILEN_PARAMETER)) return { kanal: null, ohne: null }
  const gelesen = url.searchParams.get(TEILEN_PARAMETER)
  url.searchParams.delete(TEILEN_PARAMETER)
  return { kanal: istKanalCode(gelesen) ? gelesen : null, ohne: `${url.pathname}${url.search}${url.hash}` }
}
