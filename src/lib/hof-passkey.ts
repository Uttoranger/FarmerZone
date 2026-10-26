import { ADMIN_ANMELDEN_FEHLER, FRISCH_MINUTEN, passkeyFehlerText } from '@/lib/admin-anmeldung'
import { tagMonat } from '@/lib/geraete'
import { uhrzeitInWien } from '@/lib/fristen'

/*
 * Passkey für Höfe (Register E7, Ergänzung 25.10.2026; Nr. 179) — Texte und
 * kleine Regeln ohne Datenbank für die Karte auf Konto und Sicherheit, die
 * Hof-Anmeldung auf /login und die Actions in src/server/actions/hof-passkey.ts.
 * Wer einen Passkey anlegen darf, entscheidet registrierungsFall (Fall `hof`,
 * src/lib/admin-anmeldung.ts); frisch heißt hofFrisch (Passwort oder Passkey
 * in den letzten 5 Minuten). Admins bleiben bei N20.
 */

/** Höchstlänge eines selbst gewählten Namens (Umbenennen). */
export const PASSKEY_NAME_MAX = 60

export const HOF_PASSKEY_TEXT = {
  titel: 'Anmelden mit Fingerabdruck oder Gesicht',
  satz: 'Schneller als ein Passwort und sicher gegen Phishing. Dein Passwort bleibt als Ersatz.',
  /** Am Handy wie im Board (linkes Handy), ab 768 px allgemein — dort ist es meist ein PC oder ein Sicherheitsschlüssel. */
  einrichtenHandy: 'Auf diesem Handy einrichten',
  einrichtenGeraet: 'Auf diesem Gerät einrichten',
  weiterer: 'Weiteren Passkey hinzufügen',
  laeuft: 'Dein Browser fragt …',
  eingerichtet: 'Passkey eingerichtet. Ab jetzt meldest du dich damit an – das Passwort bleibt als Ersatz.',
  liste: 'Deine Passkeys',
  umbenennen: 'Umbenennen',
  umbenennenTitel: 'Passkey umbenennen',
  nameFeld: 'Name',
  speichern: 'Speichern',
  nameLeer: 'Gib dem Passkey einen Namen.',
  nameZuLang: `Höchstens ${PASSKEY_NAME_MAX} Zeichen.`,
  entfernen: 'Entfernen',
  entfernenFrage: 'Diesen Passkey entfernen?',
  entfernenSatz: 'Mit diesem Passkey kannst du dich danach nicht mehr anmelden. Dein Passwort gilt weiter.',
  frischTitel: 'Kurz neu anmelden',
  frischSatz: `Zur Sicherheit geht das nur in den ersten ${FRISCH_MINUTEN} Minuten nach der Anmeldung. Melde dich neu an – danach landest du wieder hier.`,
  frischMitPasskey: `Bestätige mit deinem Passkey – oder melde dich neu mit Passwort an. Danach geht es ${FRISCH_MINUTEN} Minuten lang ohne Rückfrage.`,
  neuAnmelden: 'Neu anmelden',
  abbrechen: 'Abbrechen',
  /** Ein Hof mit Admin-Recht verwaltet seine Passkeys nach N20 im Admin-Bereich. */
  adminSatz: 'Dein Konto hat Admin-Rechte. Deine Passkeys verwaltest du im Admin-Bereich unter Einstellungen › Anmeldung.',
  adminLink: 'Zur Anmeldung im Admin-Bereich',
  fehlt: 'Diesen Passkey gibt es nicht mehr.',
  nichtErlaubt: 'Das geht hier gerade nicht.',
} as const

/** Der Knopf auf /login in der Hof-Karte (zusätzlich zum Passwort). */
export const HOF_PASSKEY_ANMELDEN = {
  knopf: 'Mit Passkey anmelden',
  laeuft: 'Dein Browser fragt …',
  oder: 'oder',
  unbekannt: 'Diesen Passkey kennen wir nicht. Melde dich mit deinem Passwort an und richte ihn unter Konto und Sicherheit neu ein.',
} as const

/**
 * Der Satz zu einem Fehler aus `signIn.passkey()` bzw. `addPasskey()` für
 * Höfe: wie bei Admins (passkeyFehlerText), nur ein unbekannter Passkey
 * verweist nicht auf das Admin-Konto, sondern auf Passwort und Konto und
 * Sicherheit.
 */
export function hofPasskeyFehlerText(fehler: { status?: number; code?: unknown } | null | undefined): string {
  const satz = passkeyFehlerText(fehler)
  return satz === ADMIN_ANMELDEN_FEHLER.unbekannt ? HOF_PASSKEY_ANMELDEN.unbekannt : satz
}

/**
 * Name eines Passkeys in der Liste: „Gerät · Datum, Uhrzeit" (Freigabe Nr. 179)
 * — der gespeicherte Name (geraetName beim Einrichten oder selbst gewählt) und
 * wann er eingerichtet wurde, damit zwei Passkeys vom selben Gerätetyp
 * unterscheidbar sind.
 */
export function passkeyAnzeigeName(name: string | null, erstelltAm: Date | null): string {
  const basis = name?.trim() || 'Passkey'
  return erstelltAm === null ? basis : `${basis} · ${tagMonat(erstelltAm)}, ${uhrzeitInWien(erstelltAm)}`
}
