import { HOF_EMAIL_TEXT } from '@/lib/hof-kontakt'

/**
 * Die Sätze des Hofprofils (src/schemas/hofprofil.ts) — eine Quelle. Jeder
 * sagt, was fehlt und wozu der Hof es braucht (Muster: hofAnlegenFormularSchema,
 * CODING_STANDARDS §4), statt „Pflichtfeld". Deutsch, per Du, ohne Fachwort.
 */
export const PROFIL_MELDUNG = {
  name: 'Bitte gib den Namen deines Hofs an – so steht er im Shop.',
  ownerName: 'Bitte gib deinen Vor- und Nachnamen an – Kundinnen sehen, wer den Hof führt.',
  address: 'Bitte gib Straße und Hausnummer an – so finden dich Kundinnen zur Abholung.',
  postalCode: 'Bitte gib die Postleitzahl an – sie gehört zur Abholadresse.',
  city: 'Bitte gib den Ort an – er gehört zur Abholadresse.',
  phoneFehlt: 'Bitte gib eine Telefonnummer an – bei Fragen zur Abholung rufen Kundinnen dort an.',
  phoneKurz: 'Die Telefonnummer ist zu kurz – bitte mit Vorwahl, damit Kundinnen dich erreichen.',
  /** Im Profil darf die Hof-E-Mail leer bleiben (Bestandshöfe, Nr. 212): ungültig heißt „korrigieren oder leer lassen". Beim Anlegen (Pflicht) gilt HOF_EMAIL_TEXT.ungueltig. */
  email: 'Bitte gib eine gültige Hof-E-Mail an — oder lass das Feld leer.',
} as const

/**
 * Die Hilfe unter der Hof-E-Mail (Nr. 212): der Erklärsatz aus HOF_EMAIL_TEXT, nicht
 * mehr „leer → Anmelde-Adresse“. Gespeichert werden darf das Profil auch mit
 * leerem Feld (Bestandshöfe), die Karte in Heute weist dann darauf hin; der
 * Rückfall in hofKontaktEmail (Nr. 194) bleibt nur dafür.
 */
export const HOF_EMAIL_HILFE = HOF_EMAIL_TEXT.erklaerung

/** Der Zusatz an einem freiwilligen Feld – statt „*" an jedem Pflichtfeld (wie in der Kasse). */
export const FREIWILLIG = '(freiwillig)'
