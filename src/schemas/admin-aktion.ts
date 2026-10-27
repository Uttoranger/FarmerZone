import { z } from 'zod'

/*
 * Das Admin-Protokoll (Register N33, Nr. 188): welche Arten es gibt, worauf
 * sich ein Eintrag beziehen darf und was im Grund stehen darf. Hier, weil
 * `art` und `bezugArt` als Text in der Datenbank stehen (Tabelle AdminAktion)
 * und beim Schreiben geprüft werden (protokolliere, src/server/admin-protokoll.ts).
 *
 * NIE Adresse, Name, Inhalt oder Token: Der Bezug ist eine Kennung, der Grund
 * ein kurzer Satz des Admins — die Wache `ohnePersonendaten` lehnt alles mit
 * `@` oder einer Ziffernfolge ab 7 Stellen ab (E-Mail-Adresse, Telefonnummer).
 *
 * Eine neue Admin-Aktion trägt ihre Art hier ein (gestapelt: 185–198).
 */

export const ADMIN_AKTIONEN = [
  // Höfe (Recht hoefe_freischalten)
  'hof_freigeschaltet',
  'hof_freigabe_entzogen',
  'hof_abgelehnt',
  'servicegebuehr_geaendert',
  'gruendung_bis_geaendert',
  'gruendung_ausgenommen',
  'gruendung_wieder_aufgenommen',
  'gruendung_festgeschrieben',
  'gruendung_einstellung_geaendert',
  'testhof_markiert',
  'testhof_zurueckgenommen',
  'rundschreiben_gesendet',
  // Eingriffe (Recht hof_sperren_storno, N34)
  'hof_gesperrt',
  'hof_sperre_aufgehoben',
  // Briefkasten und Postfach (ansehen)
  'meldung_triagiert',
  'meldung_buendel_stand',
  'meldung_abgelegt',
  'team_antwort',
  // Mails (Recht mails_nochmal)
  'mail_jetzt_geschickt',
  'mail_verworfen',
  'mail_nochmal',
  'mail_art_nochmal',
  // Betrieb (ansehen)
  'betrieb_gemessen',
  // Geld (Recht geld)
  'kostenposten_angelegt',
  'kostenposten_geaendert',
  'kostenposten_beendet',
  'kostenposten_geloescht',
  'finanzen_export',
  // Bestellungen (Nr. 186): „Außerhalb erstattet“ (Recht geld)
  'erstattung_erledigt',
  // Bestellungen (Nr. 186): volle Adresse nach Grund (Recht adresse_anzeigen), Notfall-Storno (Recht hof_sperren_storno)
  'adresse_angezeigt',
  'notfall_storno',
  // Benachrichtigungen (Recht benachrichtigungen)
  'empfaenger_hinzugefuegt',
  'empfaenger_entfernt',
  'zustellregeln_geaendert',
  'testmail_gesendet',
  // Startseite (Recht startseite_veroeffentlichen)
  'startseite_block_geloescht',
  'startseite_veroeffentlicht',
  'startseite_zurueckgezogen',
  'startseite_uebernommen',
  // Eigener Zugang (Inhaber: Notfallzugang)
  'ersatzcodes_erstellt',
  'passkey_entfernt',
] as const

export type AdminAktionArt = (typeof ADMIN_AKTIONEN)[number]

/** Worauf sich ein Eintrag bezieht — immer mit einer Kennung, nie mit einem Namen. Genau die sechs Arten der Freigabe (188). */
export const ADMIN_BEZUG_ARTEN = ['hof', 'bestellung', 'mail', 'person', 'plattform', 'monat'] as const

export type AdminBezugArt = (typeof ADMIN_BEZUG_ARTEN)[number]

/** Kennung der Plattform als Bezug, wenn es nichts Genaueres gibt (Einstellungen, Zustellung, Rundschreiben). */
export const PLATTFORM_BEZUG = 'plattform'

/** Was unter `bezugArt: 'plattform'` eine eigene Kennung hat — sie steht mit Vorsatz in `bezugId`. */
export const PLATTFORM_TEILE = ['meldung', 'kostenposten', 'fassung', 'block'] as const

export type PlattformTeil = (typeof PLATTFORM_TEILE)[number]

/**
 * `bezugId` für `bezugArt: 'plattform'` mit eigener Kennung: `<teil>:<kennung>`
 * (etwa `meldung:cm…`, `fassung:cm…`). So bleibt die Kennung im Protokoll,
 * und eine Abfrage nach `plattform` trennt die Teile über den Vorsatz
 * (`bezugId` beginnt mit `meldung:`) — nie eine nackte fremde Kennung neben
 * PLATTFORM_BEZUG.
 */
export function plattformBezug(teil: PlattformTeil, kennung: string): string {
  return `${teil}:${kennung}`
}

export const ADMIN_GRUND_MAX = 300

export const ADMIN_GRUND_FEHLER = 'Schreib den Grund ohne E-Mail-Adresse und ohne Telefonnummer.'

/** Kein `@`, keine Ziffernfolge ab 7 Stellen — dann ist es weder Adresse noch Telefonnummer. */
export function ohnePersonendaten(text: string): boolean {
  return !text.includes('@') && !/\d{7,}/.test(text)
}

/** Der Grund einer Admin-Aktion — für Actions, die ihn abfragen (Sperre, Storno, Notbremse), VOR der Wirkung prüfen. */
export const adminGrundSchema = z.string().trim().min(1).max(ADMIN_GRUND_MAX).refine(ohnePersonendaten, { message: ADMIN_GRUND_FEHLER })

/** Ein Eintrag ohne Grund — der Grund wird getrennt geprüft (protokolliere verwirft nur ihn, nie den Eintrag). */
export const adminAktionSchema = z.object({
  /** null = System (Ablauf, Webhook). */
  wer: z.string().min(1).max(100).nullable(),
  art: z.enum(ADMIN_AKTIONEN),
  bezugArt: z.enum(ADMIN_BEZUG_ARTEN),
  /** Nur eine Kennung: Buchstaben, Ziffern, `_ - . :` — kein Leerzeichen, kein `@`. */
  bezugId: z.string().regex(/^[\w.:-]{1,200}$/),
  mitPasskey: z.boolean(),
})

export type AdminAktionEintrag = z.input<typeof adminAktionSchema> & { grund?: string | null }
