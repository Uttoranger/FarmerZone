import { z } from 'zod'
import { validatePassword, PASSWORD_SCHEMA_MESSAGE } from '@/lib/password-rules'
import { HOFNAME_MAX, PERSONENNAME_MAX, ZU_LANG } from '@/lib/eingabegrenzen'
import { emailSchema } from '@/schemas/email'

// Passwort-Regeln der Registrierung: explizites min(8) mit eigener deutscher
// Meldung, danach die volle Checkliste (Groß-/Kleinbuchstabe, Zahl).
// Muss zu minPasswordLength: 8 in src/lib/auth.ts passen.
export const passwordSchema = z
  .string()
  .min(8, 'Mindestens 8 Zeichen')
  .refine((pw) => validatePassword(pw).valid, { message: PASSWORD_SCHEMA_MESSAGE })

/**
 * Die Antwort, wenn es zur Adresse schon ein Konto gibt (Nr. 19b): eine
 * neutralere Wortwahl als „bereits registriert", mit beiden Auswegen für die
 * echte Person. Die Kontenaufzählung schließt sie NICHT: Eine neue Adresse
 * bekommt `{ ok: true }` (und wird angemeldet), eine vergebene diesen Satz —
 * dazu ein Zeitunterschied. Wirklich neutral wäre nur dieselbe Antwort wie
 * bei Erfolg plus eine Mail an das bestehende Konto (offen, Bericht 19b).
 * Hier statt in register.ts: Eine 'use server'-Datei exportiert nur
 * asynchrone Funktionen.
 */
export const KONTO_VIELLEICHT_VORHANDEN =
  'Das hat nicht geklappt. Wenn es zu dieser Adresse schon ein Konto gibt, melde dich an oder setze dein Passwort zurück.'

export const registrationSchema = z.object({
  email: emailSchema('Ungültige E-Mail-Adresse.'),
  password: passwordSchema,
  name: z
    .string()
    .min(2, 'Name muss mindestens 2 Zeichen haben.')
    .max(PERSONENNAME_MAX, ZU_LANG.personenname),
})

/**
 * Der Name, wie die Registrierung ihn speichert: Vor- und Nachname mit einem
 * Leerzeichen dazwischen. Das Formular zählt mit derselben Funktion gegen
 * die Grenze, die registerFarmer prüft. Ein leerer Teil fällt weg: Seit
 * Nr. 15 fragt das Formular nach EINEM Feld „Dein Name" (Mockup
 * web-h0-hof-registrieren) und schickt es als Vornamen — ohne diese Regel
 * stünde hinten ein Leerzeichen im gespeicherten Namen.
 */
export function vollerName(vorname: string, nachname: string): string {
  return [vorname.trim(), nachname.trim()].filter((teil) => teil.length > 0).join(' ')
}

/**
 * Das Registrieren-Formular im Browser (Nr. 15). Strenger als
 * registrationSchema: Der Hofname ist Pflicht. Einen Haken „Konditionen
 * akzeptieren" gibt es bewusst nicht (Nachbesserung 1): Welche Konditionen für
 * neu registrierte Höfe gelten — Tarife oder Gründungsplatz —, entscheidet
 * der Mensch noch; eine Zustimmung zu etwas Offenem wäre eine Vertragszusage.
 * Den Hofnamen prüft nur das Formular — der Server (registerFarmer) bleibt
 * unverändert und legt wie bisher nur das Konto an; den Hof legt Einrichten an
 * (createFarm), vorbelegt mit diesem Namen (src/lib/hofname-entwurf.ts).
 * Pflichtfelder stehen am Feld, nicht in superRefine (CODING_STANDARDS §8).
 */
export const registrierenFormularSchema = z.object({
  hofname: z
    .string()
    .trim()
    .min(2, 'Bitte gib den Namen deines Hofs an.')
    .max(HOFNAME_MAX, ZU_LANG.hofname),
  name: z
    .string()
    .trim()
    .min(2, 'Bitte gib deinen Namen an.')
    .max(PERSONENNAME_MAX, ZU_LANG.personenname),
  email: emailSchema('Bitte gib eine gültige E-Mail-Adresse an.'),
  password: passwordSchema,
})

export type RegistrierenFormular = z.input<typeof registrierenFormularSchema>

export type RegistrierenFeld = keyof RegistrierenFormular

/** Die erste Meldung je Feld — für Tests und für den Fehlerzähler. */
export function registrierenFehler(eingabe: RegistrierenFormular): Partial<Record<RegistrierenFeld, string>> {
  const ergebnis = registrierenFormularSchema.safeParse(eingabe)
  if (ergebnis.success) return {}
  const fehler: Partial<Record<RegistrierenFeld, string>> = {}
  for (const issue of ergebnis.error.issues) {
    const feld = issue.path[0] as RegistrierenFeld
    fehler[feld] ??= issue.message
  }
  return fehler
}
