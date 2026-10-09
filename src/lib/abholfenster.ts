/**
 * Welche Abholfenster ein Hof anbietet — und ob eine Wahl dazu passt.
 *
 * EINE Regel für Checkout-Formular und Checkout-Handler: Der Browser bietet
 * genau die Fenster an, die der Server annimmt. Vorher rechnete das Formular
 * mit der Uhr und dem Kalender des Browsers, und der Server prüfte gar nicht —
 * ein über Nacht offener Tab bestellte für gestern.
 *
 * Ein Fenster ist wählbar, wenn
 * - es ein aktiver PickupSlot des Hofs mit diesem Wochentag und genau diesen
 *   Zeiten ist (Wochentag des Kalendertags, also in Wiener Zeit),
 * - sein Bestellschluss (Beginn des Fensters, src/lib/fristen.ts) in der
 *   Zukunft liegt,
 * - der Tag im Zeitraum liegt, den auch die Tageskarten der Hofseite zeigen
 *   (heute und die 13 Tage danach, ABHOL_VORLAUF_TAGE).
 * Ob ein Fenster mit Höchstzahl (maxOrders) noch Platz hat, zählt die
 * Datenbank (src/server/abholfenster.ts); hier steht nur die Regel `istVoll`.
 *
 * Rein, ohne Datenbank: läuft im Server und im Browser (tests/abholfenster.test.ts).
 */
import { wienerZeitpunkt } from '@/lib/fristen'
import { kalendertagInWien } from '@/lib/servicegebuehr'
import { tagVersetzt, wochentagVon } from '@/lib/kalender'
import { ABHOL_VORLAUF_TAGE } from '@/lib/pickup-days'

export const CODE_ABHOLFENSTER_UNGUELTIG = 'ABHOLFENSTER_UNGUELTIG'
export const CODE_ABHOLFENSTER_VOLL = 'ABHOLFENSTER_VOLL'
export const ABHOLFENSTER_NICHT_VERFUEGBAR =
  'Dieses Zeitfenster ist leider nicht mehr verfügbar – bitte wähle ein anderes.'

/**
 * Ein wöchentliches Fenster, wie der Hof es eingetragen hat. Die öffentliche
 * Hofseite kennt nur Wochentag und Zeiten (schon auf aktive gefiltert), der
 * Server zusätzlich id, maxOrders und isActive.
 */
export type AbholSlot = {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive?: boolean
}

/** Die Wahl im Checkout: Kalendertag JJJJ-MM-TT und Wiener Uhrzeiten HH:MM. */
export type Abholwahl = { datum: string; start: string; ende: string }

export type AngebotenesFenster<S extends AbholSlot = AbholSlot> = Abholwahl & { slot: S }

/** „JJJJ-MM-TT|HH:MM|HH:MM" — der Wert des Auswahlfelds im Checkout. */
export function abholSchluessel(wahl: Abholwahl): string {
  return `${wahl.datum}|${wahl.start}|${wahl.ende}`
}

/** Alle wählbaren Fenster ab jetzt, nach Tag und Beginn sortiert. */
export function angeboteneAbholfenster<S extends AbholSlot>(slots: readonly S[], jetzt: Date): AngebotenesFenster<S>[] {
  const aktiv = slots.filter((s) => s.isActive !== false)
  const heute = kalendertagInWien(jetzt)
  const fenster: AngebotenesFenster<S>[] = []
  for (let versatz = 0; versatz < ABHOL_VORLAUF_TAGE; versatz++) {
    const datum = tagVersetzt(heute, versatz)
    const tag = wochentagVon(datum)
    for (const slot of aktiv) {
      if (slot.dayOfWeek !== tag) continue
      const schluss = wienerZeitpunkt(datum, slot.startTime)
      if (!schluss || schluss.getTime() <= jetzt.getTime()) continue
      fenster.push({ datum, start: slot.startTime, ende: slot.endTime, slot })
    }
  }
  return fenster.sort((a, b) => a.datum.localeCompare(b.datum) || a.start.localeCompare(b.start))
}

/** Passt die Wahl zu einem angebotenen Fenster? Dann dessen Slot, sonst null. */
export function findeAbholfenster<S extends AbholSlot>(
  slots: readonly S[],
  wahl: Abholwahl,
  jetzt: Date
): AngebotenesFenster<S> | null {
  return (
    angeboteneAbholfenster(slots, jetzt).find(
      (f) => f.datum === wahl.datum && f.start === wahl.start && f.ende === wahl.ende
    ) ?? null
  )
}

/** Voll ist nur ein Fenster mit Höchstzahl — null heißt unbegrenzt. */
export function istVoll(belegt: number, maxOrders: number | null): boolean {
  return maxOrders !== null && belegt >= maxOrders
}
