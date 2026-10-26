import { ADMIN_SITZUNG_STUNDEN } from '@/lib/admin-anmeldung'

/*
 * Höchstdauer einer Sitzung (Register S18, Nr. 178) — rein und ohne
 * Datenbank. Better Auth verlängert eine benutzte Sitzung täglich um 7 Tage
 * (`expiresIn`/`updateAge` in src/lib/auth.ts); ohne Grenze bliebe ein Handy,
 * das jede Woche einmal geöffnet wird, für immer angemeldet. Gezählt wird ab
 * der Anmeldung (`createdAt`), nicht ab der letzten Nutzung. Geprüft in
 * src/lib/auth.ts an der Stelle, die Sitzungen liest (`/get-session`, dazu
 * jeder andere Better-Auth-Weg mit Sitzungs-Cookie).
 */

/** Hof und Kundin: höchstens 30 Tage ab der Anmeldung, auch wenn die Sitzung benutzt wird (S18). */
export const SITZUNG_HOECHSTENS_TAGE = 30

const STUNDE_MS = 60 * 60 * 1000

/**
 * `admin` = Konto mit der Rolle ADMIN: 12 Stunden wie im Admin-Bereich (N20,
 * `ADMIN_SITZUNG_STUNDEN`). Den Admin-Bereich eines Hof-Kontos mit Admin-Recht
 * prüft weiter die Admin-Wache (src/server/admin-wache.ts); sein Hof bleibt
 * bei 30 Tagen.
 */
export type SitzungRolle = 'admin' | 'konto'

/** Die Rolle für die Höchstdauer aus der Rolle des Kontos (Better Auth `user.role`). */
export function sitzungRolle(kontoRolle: unknown): SitzungRolle {
  return kontoRolle === 'ADMIN' ? 'admin' : 'konto'
}

/** Ist die Sitzung älter als erlaubt? Genau an der Grenze gilt sie nicht mehr. */
export function sitzungAbgelaufen(createdAt: Date, jetzt: Date, rolle: SitzungRolle): boolean {
  const hoechstensMs = rolle === 'admin' ? ADMIN_SITZUNG_STUNDEN * STUNDE_MS : SITZUNG_HOECHSTENS_TAGE * 24 * STUNDE_MS
  return jetzt.getTime() - createdAt.getTime() >= hoechstensMs
}

/** Der Satz unter „Angemeldete Geräte" auf Konto und Sicherheit (Board SterneSicherheit, linkes Handy). */
export const SITZUNG_DAUER_SATZ = `Du bleibst ${SITZUNG_HOECHSTENS_TAGE} Tage angemeldet. Danach melden wir dich zur Sicherheit ab – bei einem neuen Gerät bekommst du eine E-Mail.`

/** „Angemeldete Geräte" unter /account (Board SterneSicherheit, rechtes Handy). */
export const KUNDIN_GERAETE_TEXT = {
  ueberallAbmelden: 'Überall abmelden',
  hinweis: 'Kennst du ein Gerät nicht? Melde es ab – deine Bestellungen bleiben, nur die Anmeldung dort endet.',
  blattTitel: 'Überall abmelden?',
  blattSatz: 'Du wirst auf allen Geräten abgemeldet, auch auf diesem. Deine Bestellungen und Abos bleiben.',
  wasWirSpeichern: 'Was wir speichern',
} as const
