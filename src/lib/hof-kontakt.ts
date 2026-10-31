/**
 * Die Adresse, an die wir einen Hof anschreiben (Entscheidung 2 aus
 * Morgenbericht 25, Nr. 194): die Hof-E-Mail aus dem Profil, sonst die
 * Anmelde-Adresse der Inhaberin.
 *
 * Warum eine Funktion: Die Hof-E-Mail ist freiwillig (Anlegen und Profil).
 * Vier Leser nahmen das Feld ohne Rückfall – bei leerem Feld ging die
 * Bestellmail an eine leere Adresse und Stripe bekam keine (Bericht 174).
 *
 * Bewusst NUR zum Anschreiben: Wo Kundinnen die Hof-E-Mail sehen
 * (Bestellseite, Angaben zum Hof), bleibt das Feld, wie es ist – die
 * Anmelde-Adresse stünde dort sonst öffentlich. Direkte Zugriffe auf das
 * Feld meldet tests/hof-kontakt-wache.test.ts.
 */
export type HofKontakt = { email: string; owner: { email: string } }

export function hofKontaktEmail(farm: HofKontakt): string {
  return farm.email.trim() || farm.owner.email
}

/** Für Prisma-Selects: was hofKontaktEmail braucht. */
export const HOF_KONTAKT_FELDER = { email: true, owner: { select: { email: true } } } as const

/**
 * Hat der Hof eine eigene E-Mail-Adresse für die Kundschaft? (Nr. 212, § 4
 * Abs. 1 Z 3 FAGG): Die Belehrung nennt die Adresse des Betriebs, nicht das
 * Anmelde-Konto der Inhaberin. Der Rückfall in hofKontaktEmail bleibt für
 * Bestandshöfe; neu freigeschaltet wird nur mit eingetragener Adresse.
 *
 * Eine Funktion statt `farm.email` an jeder Stelle (tests/hof-kontakt-wache).
 */
export function hofEmailFehlt(farm: { email: string }): boolean {
  return farm.email.trim() === ''
}

/** Die id des Hof-E-Mail-Feldes im Profil-Formular — Sprungziel der Karte in Heute. */
export const HOF_EMAIL_ANKER = 'email'

/** Die Sätze zur Pflicht-Adresse — eine Quelle für Freischalten, Einrichten, Heute und Admin-Hof-Akte. Deutsch, geduzt. */
export const HOF_EMAIL_TEXT = {
  /** Freischalten ohne Adresse (Fehler der Admin-Aktion). */
  freischaltenFehlt: 'Der Hof hat noch keine E-Mail-Adresse für Kundschaft',
  /** Der Erklärsatz unter dem Feld in „Hof einrichten“. */
  erklaerung: 'Diese Adresse sehen deine Kundinnen und Kunden in der Bestellung und in der Rücktrittsbelehrung.',
  /** Das Feld ist beim Einrichten Pflicht. */
  pflicht: 'Bitte gib die E-Mail-Adresse deines Hofs an – Kundinnen und Kunden erreichen dich dort.',
  /** Ungültiges Format beim Anlegen (Pflichtfeld: „leer lassen“ ist dort keine Antwort). */
  ungueltig: 'Bitte gib eine gültige E-Mail-Adresse für deinen Hof an.',
  label: 'E-Mail des Hofs',
  /** Das Feld im Profil und unter Mein Hof: leer bleibt speicherbar (Bestandshöfe), die Karte in Heute weist darauf hin. */
  profilLabel: 'Hof-E-Mail',
  karteTitel: 'E-Mail-Adresse für Kundschaft eintragen',
  karteSatz: 'Deine Kundinnen und Kunden sehen diese Adresse in der Bestellung und in der Rücktrittsbelehrung. Bitte trag sie in den Einstellungen ein.',
  karteLink: 'Zu den Einstellungen',
  /** Direkt auf das Feld im Profil: /settings/profile mit Anker auf die id des Feldes. */
  einstellungenPfad: `/settings/profile#${HOF_EMAIL_ANKER}`,
  /** Zeile der Admin-Hof-Akte bei leerem Feld. */
  akteFehlt: 'Hof-E-Mail fehlt',
} as const
