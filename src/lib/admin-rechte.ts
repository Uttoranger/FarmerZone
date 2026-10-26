/*
 * Rechte je Person im Admin-Bereich (Register N35, Nr. 188) — die EINE Stelle,
 * die `adminInhaber` und `adminRechte` deutet (Wache:
 * tests/admin-rechte-wache.test.ts; gelesen wird sonst nur in
 * src/server/admin-wache.ts).
 *
 *  - Immer: „ansehen“ (Heute, Höfe, Bestellungen, Postfach).
 *  - Einstellbar je Person: ADMIN_RECHTE.
 *  - Nur Inhaber, nie weitergebbar: INHABER_RECHTE.
 *
 * Ein Inhaber darf alles. Unbekannte Einträge in `adminRechte` (etwa ein
 * Recht, das es nicht mehr gibt) geben nichts frei.
 */

/** Einstellbar je Person (N35), in der Reihenfolge der Einstellungen › Team (Nr. 190). */
export const ADMIN_RECHTE = [
  'mails_nochmal',
  'adresse_anzeigen',
  'hof_sperren_storno',
  'hoefe_freischalten',
  'geld',
  'notbremse',
  'startseite_veroeffentlichen',
  'benachrichtigungen',
] as const

/** Nur Inhaber, nie weitergebbar (N35). */
export const INHABER_RECHTE = ['team', 'notfallzugang'] as const

export type EinstellbaresAdminRecht = (typeof ADMIN_RECHTE)[number]
export type InhaberRecht = (typeof INHABER_RECHTE)[number]
export type AdminRecht = 'ansehen' | EinstellbaresAdminRecht | InhaberRecht

/** Die Wörter der Oberfläche (N35, Wortliste N8). */
export const ADMIN_RECHT_TEXT: Record<AdminRecht, string> = {
  ansehen: 'Ansehen',
  mails_nochmal: 'Mails nochmal schicken',
  adresse_anzeigen: 'Volle Adresse anzeigen',
  hof_sperren_storno: 'Hof sperren und Notfall-Storno',
  hoefe_freischalten: 'Höfe freischalten, Gründung, Testhof und Servicegebühr',
  geld: 'Geld und Monatsabschluss',
  notbremse: 'Notbremse',
  startseite_veroeffentlichen: 'Startseite veröffentlichen',
  benachrichtigungen: 'Benachrichtigungen',
  team: 'Team, Rechte und Admin-Rechte vergeben',
  notfallzugang: 'Notfallzugang',
}

/** Was von einer Person gelesen wird — `isAdmin` prüft die Wache vorher. */
export type AdminPerson = { adminInhaber: boolean; adminRechte: readonly string[] }

const EINSTELLBAR: ReadonlySet<string> = new Set(ADMIN_RECHTE)

/** Darf diese Person das? Inhaber alles; sonst „ansehen“ immer und die einzeln vergebenen Rechte. */
export function darf(person: AdminPerson, recht: AdminRecht): boolean {
  if (person.adminInhaber) return true
  if (recht === 'ansehen') return true
  return EINSTELLBAR.has(recht) && person.adminRechte.includes(recht)
}

/** Die einstellbaren Rechte einer Person in fester Reihenfolge — ohne Unbekanntes, ohne Doppelte (für Anzeige und Speichern in 190). */
export function eingestellteRechte(person: AdminPerson): EinstellbaresAdminRecht[] {
  return ADMIN_RECHTE.filter((r) => person.adminInhaber || person.adminRechte.includes(r))
}

/** Antwort einer Admin-Aktion, wenn der Person das Recht fehlt (N35) — verrät nichts über andere Personen. */
export const ADMIN_RECHT_FEHLER = 'Dafür fehlt dir das Recht. Frag eine Inhaberin oder einen Inhaber im Team.'
