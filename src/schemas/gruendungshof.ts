import { z } from 'zod'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'
import { EINSTELLUNG_UNGUELTIG } from '@/schemas/servicegebuehr'

/*
 * Die Sätze an der Oberfläche (Nr. 62). Die Action gibt für das Datum nur sie
 * zurück, nie eine Zod-Meldung — sonst stünde bei falschem Typ Zods englischer
 * Standardsatz im Dialog (wie bei der Servicegebühr, Nr. 35).
 */
export const GRUENDUNG_BIS_UNGUELTIG =
  'Wähle den letzten Tag als Gründungshof oder lass das Feld leer, dann gilt der Standard.'
export const GRUENDUNG_BIS_VERGANGEN = 'Dieser Tag ist schon vorbei. Wähle heute oder einen späteren Tag.'
/** Ein früheres Ende als das bisher wirksame ohne Haken (Register K1). */
export const GRUENDUNG_BIS_ZUSTIMMUNG_FEHLT =
  'Das Ende liegt vor dem bisherigen. Das geht nur mit Zustimmung des Hofs – setz dafür den Haken.'
/** Ein zweiter Tab hat das Ende zwischen Lesen und Schreiben verschoben. */
export const GRUENDUNG_BIS_GEAENDERT =
  'Das Ende hat sich inzwischen geändert. Lade die Seite neu und entscheide noch einmal.'

function baueSchema(heute: string) {
  return z.object({
    gruendungBis: z.preprocess(
      (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v),
      z
        .string({ message: GRUENDUNG_BIS_UNGUELTIG })
        .regex(/^\d{4}-\d{2}-\d{2}$/, GRUENDUNG_BIS_UNGUELTIG)
        // Die Form allein ließe den 30. Februar durch.
        .refine((tag) => wienerMitternacht(tag) !== null, GRUENDUNG_BIS_UNGUELTIG)
        // JJJJ-MM-TT vergleicht sich als Text wie als Datum.
        .refine((tag) => tag >= heute, GRUENDUNG_BIS_VERGANGEN)
        .nullable()
    ),
    bestaetigt: z.boolean({ message: EINSTELLUNG_UNGUELTIG }),
  })
}

export type GruendungBisSchema = ReturnType<typeof baueSchema>

/**
 * Die Admin-Eingabe für das Gründungs-Enddatum eines Hofs (Register K2):
 * ein Kalendertag JJJJ-MM-TT oder leer/null (= Standard), nicht vor dem
 * heutigen WIENER Tag, dazu `bestaetigt` — die Zustimmung des Hofs, die ein
 * früheres Ende verlangt (K1). Ob das Ende früher ist, weiß erst der Server
 * (das bisher wirksame Datum hängt am Gründungsplatz); das Schema prüft die
 * Form. Den Tag in den Wert der DATE-Spalte wandelt die Action
 * (`bildeGruendungBis`), nicht das Schema.
 */
export function gruendungBisSchema(jetzt: Date): GruendungBisSchema {
  return baueSchema(kalendertagInWien(jetzt))
}
