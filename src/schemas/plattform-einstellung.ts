import { z } from 'zod'
import { EINSTELLUNGEN_GRUPPEN, GRUENDUNG_EINSTELLUNG_FEHLER, HOFPREIS_STICHTAG_FEHLER, GRUENDUNG_MONATE_MAX, GRUENDUNG_PLAETZE_MAX } from '@/lib/plattform-einstellung'

/**
 * Die Eingabe der Gruppe Gründungshöfe in Admin › Einstellungen (Register
 * K2-Ergänzung, Nr. 93; Aktion seit Nr. 116) — für die Server Action
 * (src/server/actions/plattform-einstellung.ts). Strikt: ein unbekanntes Feld
 * ist ein Fehler. Das Schema prüft die Form; ob die Zahl unter den vergebenen
 * Plätzen liegt, ob sie sinkt und ob der Stichtag nach hinten rückt, sagt
 * `pruefeGruendungEingabe` (src/lib/plattform-einstellung.ts) mit dem Stand
 * aus der Datenbank. Jede Meldung ist ein eigener deutscher Satz — Zods
 * Standardtext ist englisch. Das Standard-Ende ist seit Nr. 116 nicht mehr
 * änderbar und steht deshalb nicht in der Eingabe.
 */
export const gruendungEinstellungSchema = z.strictObject(
  {
    plaetze: z
      .number(GRUENDUNG_EINSTELLUNG_FEHLER.plaetze)
      .int(GRUENDUNG_EINSTELLUNG_FEHLER.plaetze)
      .min(0, GRUENDUNG_EINSTELLUNG_FEHLER.plaetze)
      .max(GRUENDUNG_PLAETZE_MAX, GRUENDUNG_EINSTELLUNG_FEHLER.plaetze),
    monate: z
      .number(GRUENDUNG_EINSTELLUNG_FEHLER.monate)
      .int(GRUENDUNG_EINSTELLUNG_FEHLER.monate)
      .min(1, GRUENDUNG_EINSTELLUNG_FEHLER.monate)
      .max(GRUENDUNG_MONATE_MAX, GRUENDUNG_EINSTELLUNG_FEHLER.monate),
    /** Leer = ohne Stichtag (nur, solange noch keiner gesetzt ist — das prüft die Regel). */
    aktionBisTag: z.string(GRUENDUNG_EINSTELLUNG_FEHLER.datum).regex(/^\d{4}-\d{2}-\d{2}$/, GRUENDUNG_EINSTELLUNG_FEHLER.datum).nullable(),
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

/**
 * Die Eingabe „Hofpreis-Modell ab“ (Register N38, Nr. 197): ein Wiener
 * Kalendertag. Ob er in der Zukunft liegt und ob der alte noch änderbar ist,
 * sagt `pruefeHofpreisStichtag` mit dem Stand aus der Datenbank.
 */
export const hofpreisStichtagSchema = z.strictObject(
  { tag: z.string(HOFPREIS_STICHTAG_FEHLER.datum).regex(/^\d{4}-\d{2}-\d{2}$/, HOFPREIS_STICHTAG_FEHLER.datum) },
  HOFPREIS_STICHTAG_FEHLER.datum
)
