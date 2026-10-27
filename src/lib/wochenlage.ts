import { centsAlsEuro, formatEuro } from '@/lib/format'
import { GEZAEHLTE_TOEPFE, topfVonBestellung, type BestellungFuerFinanzen } from '@/lib/finanzen'

/*
 * Die Regeln der Wochenlage (Register N32, Nr. 192) — rein, ohne Datenbank.
 * Geladen werden die Zahlen in src/server/queries/wochenlage.ts, gesetzt in
 * die Mail vom Renderer des Wochenberichts (src/server/mail-arten/betreiber.ts).
 */

/** Eine Zahl der Wochenlage mit ihrem Wort — fertig für die Vorlage, nur Zahlen, nie Personendaten. */
export type LageZeile = { label: string; wert: string }

/** Die Zahlen der Wochenlage (Register N32, Nr. 192): alles Anzahlen und Cent, nichts Personenbezogenes. */
export type WochenlageZahlen = {
  bestellungen: number
  umsatzCents: number
  servicegebuehrCents: number
  servicegebuehrErwartetCents: number
  neueHoefe: number
  offen: number
  ueberfaellig: number
  fehler: number
  kostenMonatCents: number
}

/**
 * Die Servicegebühr der Bestellungen einer Woche — aus derselben Zuordnung wie
 * Admin › Geld (`topfVonBestellung`), damit Mail und Seite nie verschiedene
 * Zahlen nennen. Gezählt = eingezogen + geschuldet; erwartet kann noch dazukommen.
 */
export function servicegebuehrDerWoche(
  bestellungen: readonly BestellungFuerFinanzen[],
  stripeLiveAb: Date | null
): { gezaehltCents: number; erwartetCents: number } {
  let gezaehltCents = 0
  let erwartetCents = 0
  for (const b of bestellungen) {
    const gebuehr = Math.max(0, Math.round(b.serviceFeeCents))
    const topf = topfVonBestellung(b, stripeLiveAb)
    if (GEZAEHLTE_TOEPFE.includes(topf)) gezaehltCents += gebuehr
    else if (topf === 'erwartet') erwartetCents += gebuehr
  }
  return { gezaehltCents, erwartetCents }
}

/**
 * Die Zeilen der Wochenlage in der Reihenfolge der Mail. Stripe-Gebühren
 * stehen hier noch nicht: Admin › Geld kennt sie erst mit Nr. 191; dann kommt
 * die Zeile dazu, vorher nennt die Mail keine Zahl, die dort fehlt.
 */
export function wochenlageZeilen(z: WochenlageZahlen): LageZeile[] {
  const euro = (cents: number) => formatEuro(centsAlsEuro(cents))
  return [
    { label: 'Bestellungen', wert: String(z.bestellungen) },
    { label: 'Umsatz der Höfe', wert: euro(z.umsatzCents) },
    { label: 'Servicegebühr', wert: z.servicegebuehrErwartetCents > 0 ? `${euro(z.servicegebuehrCents)} (dazu erwartet: ${euro(z.servicegebuehrErwartetCents)})` : euro(z.servicegebuehrCents) },
    { label: 'Neue Höfe', wert: String(z.neueHoefe) },
    { label: 'Offene Aufgaben', wert: z.ueberfaellig > 0 ? `${z.offen} (überfällig: ${z.ueberfaellig})` : String(z.offen) },
    { label: 'Fehlermeldungen der Woche', wert: String(z.fehler) },
    { label: 'Kosten diesen Monat', wert: euro(z.kostenMonatCents) },
  ]
}
