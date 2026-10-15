import { z } from 'zod'
import { EINSTELLUNGEN_GRUPPEN, GRUENDUNG_EINSTELLUNG_FEHLER, GRUENDUNG_PLAETZE_MAX } from '@/lib/plattform-einstellung'

/**
 * Die Eingabe der Gruppe Gründungshöfe in Admin › Einstellungen (Register
 * K2-Ergänzung, Nr. 93) — für die Server Action
 * (src/server/actions/plattform-einstellung.ts). Strikt: ein unbekanntes Feld
 * ist ein Fehler. Das Schema prüft die Form; ob die Zahl unter den vergebenen
 * Plätzen liegt und ob der Tag vorbei ist, sagt `pruefeGruendungEingabe`
 * (src/lib/plattform-einstellung.ts) mit dem Stand aus der Datenbank. Jede
 * Meldung ist ein eigener deutscher Satz — Zods Standardtext ist englisch.
 */
export const gruendungEinstellungSchema = z.strictObject(
  {
    plaetze: z
      .number(GRUENDUNG_EINSTELLUNG_FEHLER.plaetze)
      .int(GRUENDUNG_EINSTELLUNG_FEHLER.plaetze)
      .min(0, GRUENDUNG_EINSTELLUNG_FEHLER.plaetze)
      .max(GRUENDUNG_PLAETZE_MAX, GRUENDUNG_EINSTELLUNG_FEHLER.plaetze),
    bisTag: z.string(GRUENDUNG_EINSTELLUNG_FEHLER.datum).regex(/^\d{4}-\d{2}-\d{2}$/, GRUENDUNG_EINSTELLUNG_FEHLER.datum),
    anzeige: z.boolean(GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig),
  },
  GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig
)

export type GruendungEinstellungEingabe = z.infer<typeof gruendungEinstellungSchema>

/**
 * Die Gruppe aus der Adresse (`?gruppe=`) — Fremdtext: Unbekanntes zeigt
 * still die erste Gruppe statt einer Fehlerseite (ARCHITECTURE §4).
 */
export const einstellungenGruppeSchema = z.enum(EINSTELLUNGEN_GRUPPEN).catch('gruendung')
