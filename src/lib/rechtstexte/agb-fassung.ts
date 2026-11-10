/**
 * Welche Fassung der AGB gilt (Register N45, A005) — die EINE Stelle, an der
 * zwischen den Fassungen gewählt wird. Rein, ohne Prisma und ohne Uhr (der
 * Zeitpunkt ist Parameter); auch im Browser importierbar, weil die Kasse den
 * Link ihrer Fassung braucht. Der Text der Fassungen steht in agb-0-9.ts und
 * agb.ts und wird hier bewusst nicht importiert: Die Kasse soll nicht die
 * ganzen AGB in ihr Browserpaket ziehen.
 *
 * Die Regeln:
 *  - Ab dem Stichtag „Hofpreis-Modell ab“ gilt 1.0, vorher 0.9 — dieselbe
 *    Grenze wie gebuehrModellFuer (genau am Stichtag schon 1.0).
 *  - Für jede Bestellung gilt die Fassung ihres Gebührenmodells (Snapshot
 *    Order.gebuehrModell): bisher (null) = 0.9, hofpreis = 1.0 — egal, wann
 *    eine Mail gebaut oder die Zahlung fortgesetzt wird.
 *  - Höfe stimmen der neuesten Fassung zu (AGB_NEUESTE).
 *    Farm.agbFassung '1.0' mit agbZugestimmtAm vor dem Stichtag = Zustimmung
 *    vorab nach der Ankündigung, samt Verzicht auf den Rest der Frist (AGB 32.4).
 */
import { gebuehrModellFuer, GEBUEHR_MODELL_HOFPREIS, type HofpreisEinstellung } from '@/lib/plattformgebuehr'

/** Alle Fassungen, die es gibt — älteste zuerst. Jede bleibt dauerhaft abrufbar (/agb/<Kennung>). */
export const AGB_FASSUNGEN = ['0.9', '1.0'] as const

export type AgbKennung = (typeof AGB_FASSUNGEN)[number]

/** Die Fassung, der Höfe zustimmen. */
export const AGB_NEUESTE: AgbKennung = '1.0'

/** Die Fassung für Bestellungen im Modell „bisher“ — auch nach dem Stichtag (B1, N45). */
export const AGB_BISHER: AgbKennung = '0.9'

export function istAgbKennung(wert: string): wert is AgbKennung {
  return (AGB_FASSUNGEN as readonly string[]).includes(wert)
}

/** Die Seite genau einer Fassung: „/agb/1.0“. */
export function agbFassungPfad(kennung: AgbKennung): string {
  return `/agb/${kennung}`
}

/** Die Fassung, die zu diesem Zeitpunkt gilt — vor dem Stichtag 0.9, ab dem Stichtag 1.0. */
export function geltendeAgbFassung(einstellung: HofpreisEinstellung | null, jetzt: Date): AgbKennung {
  return gebuehrModellFuer(einstellung, jetzt) === 'hofpreis' ? AGB_NEUESTE : AGB_BISHER
}

/**
 * Die Fassung einer Bestellung aus ihrem Snapshot. null und 'bisher' → 0.9,
 * 'hofpreis' → 1.0; jeder andere Wert → 0.9 mit `unbekannt` — nie ein Wurf,
 * denn Mail und Kasse dürfen daran nicht scheitern. Die Meldung an Sentry
 * machen die Aufrufer auf dem Server (Kennung des Werts und Bestell-ID).
 */
export function agbFassungFuerBestellung(bestellung: { gebuehrModell: string | null | undefined }): { fassung: AgbKennung; unbekannt: boolean } {
  const modell = bestellung.gebuehrModell ?? null
  if (modell === GEBUEHR_MODELL_HOFPREIS) return { fassung: AGB_NEUESTE, unbekannt: false }
  return { fassung: AGB_BISHER, unbekannt: modell !== null && modell !== 'bisher' }
}
