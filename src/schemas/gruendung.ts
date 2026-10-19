import { z } from 'zod'

/*
 * Die Eingaben für „Nicht als Gründungshof zählen“ und „Wieder als
 * Gründungshof zählen“ (Register K2, Ergänzung 16.10.2026, Nr. 109). Die
 * Actions geben nach außen nur die Sätze hier zurück, nie eine Zod-Meldung —
 * sonst stünde bei falschem Typ Zods englischer Standardsatz im Dialog.
 */

export const GRUENDUNG_EINGABE_UNGUELTIG = 'Wir konnten die Eingabe nicht lesen. Lade die Seite neu und versuch es noch einmal.'
/** Der Hof hält gerade einen Platz, der Haken fehlt (Register K1: zugesagte Konditionen bleiben). */
export const GRUENDUNG_AUSNEHMEN_ZUSTIMMUNG_FEHLT =
  'Der Hof hält gerade einen Gründungsplatz. Das geht nur bei einem Testhof oder mit Zustimmung des Hofs – setz dafür den Haken.'
/** Nur ein freigeschalteter, nicht stillgelegter Hof steht in der Vergabe. */
export const GRUENDUNG_NUR_FREIGESCHALTET = 'Nur ein freigeschalteter Hof zählt für die Gründungsplätze. Lade die Seite neu.'
/** Das bedingte Schreiben traf nichts: Ein zweiter Tab hat schon aus- bzw. wieder aufgenommen. */
export const GRUENDUNG_AUSNEHMEN_GEAENDERT = 'Der Hof hat sich inzwischen geändert. Lade die Seite neu und entscheide noch einmal.'

/** Wiederaufnahme nach dem Festschreiben, aber die Aktion ist vorbei (Stichtag) — es gibt keinen Platz mehr (Nr. 116). */
export const GRUENDUNG_AKTION_VORBEI = 'Die Aktion ist vorbei – es werden keine Gründungsplätze mehr vergeben.'

/** Die Kennung eines Hofs (cuid) — Länge begrenzt, damit kein Riesentext in die Abfrage geht. */
const hofKennung = z.string().min(1).max(64)

export const nimmAusGruendungSchema = z.strictObject({
  farmId: hofKennung,
  /** Der Haken „Das ist ein Testhof – oder der Hof hat zugestimmt“; Pflicht, wenn der Hof einen Platz hält. */
  bestaetigt: z.boolean(),
})

export const nimmWiederAufSchema = z.strictObject({ farmId: hofKennung })

/**
 * „Zusagen festschreiben“ (Register K2, Änderung Nr. 116): nur die
 * Bestätigung im Dialog — welche Höfe welchen Platz bekommen, rechnet die
 * Action selbst nach der Sperre, nie aus dem Browser.
 */
export const schreibeZusagenFestSchema = z.strictObject({ bestaetigt: z.literal(true) })

/** Der Schalter „Abzeichen zeigen“ unter Konditionen und Tarif (Nr. 116) — nur für den eigenen Hof. */
export const abzeichenSichtbarSchema = z.strictObject({ zeigen: z.boolean() })
