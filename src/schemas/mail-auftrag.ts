import { z } from 'zod'

/*
 * Die Mail-Warteschlange (Register N26, Nr. 158): welche Arten es gibt, welche
 * Stände ein Auftrag hat und was in `bezug` stehen darf. Hier, weil `art` und
 * `bezug` als Text bzw. JSON in der Datenbank stehen und beim Lesen geprüft
 * werden — und weil Admin › Betrieb (Nr. 161) dieselben Namen filtert.
 */

/**
 * Jede Mail, die das System verschickt — ein Name je `send…`-Funktion in
 * src/lib/email.ts, dazu die Testmail (/api/test-email) und der Bescheid an
 * Kundinnen (schreibeKundinnen). Welcher Weg (Sofort, Wichtig, Kann warten)
 * zu welcher Art gehört, steht in ARCHITECTURE „Mails“; den Weg stellt Nr. 159 um.
 */
export const MAIL_ARTEN = [
  // Sofort: Code, Einmal-Link oder Bestätigungslink — direkt, nur Protokoll.
  'anmeldecode',
  'bestellcode',
  'login-link',
  'passwort-link',
  'email-bestaetigung',
  'registrierungs-hinweis',
  'bar-bestaetigungslink',
  'admin-sicherheit',
  'neue-anmeldung',
  'zu-viele-versuche',
  'betrieb-warnung',
  'testmail',
  // Wichtig: Bestellungen, Höfe und Betreiber.
  'bestellung-bestaetigung',
  'bestellung-bezahlt-hof',
  'bar-bestaetigt-hof',
  'abholbereit',
  'nicht-abholbereit',
  'storniert',
  'artikel-fehlt',
  'verfallen',
  'zahlung-zu-spaet',
  'erstattung-offen',
  'neuer-hof',
  'freischaltung',
  'meldung',
  'wochenbericht',
  'postfach',
  'antwort-an-team',
  'betreiber-bestaetigung',
  'betreiber-testmail',
  'abo-bestaetigung',
  // Kann warten: Beiträge, Rundschreiben, Bescheide.
  'beitrag',
  'rundschreiben',
  'bescheid',
] as const

export const mailArtSchema = z.enum(MAIL_ARTEN)
export type MailArt = z.infer<typeof mailArtSchema>

/** Der Weg einer Mail im Code; auf Admin-Seiten heißen sie „Sofort“, „Wichtig“, „Kann warten“ (Wortliste N8). */
export const VORRANG = { sofort: 0, wichtig: 1, kannWarten: 2 } as const
export type Vorrang = (typeof VORRANG)[keyof typeof VORRANG]

export const MAIL_STATUS = ['offen', 'in_arbeit', 'gesendet', 'gescheitert', 'gesperrt', 'ohne_schluessel', 'verworfen'] as const
export const mailStatusSchema = z.enum(MAIL_STATUS)
export type MailStatus = z.infer<typeof mailStatusSchema>

/**
 * Eine Kennung (cuid, uuid, Slug-artige ID) — nie eine Adresse (kein @), nie
 * Text (kein Leerzeichen), nie ein Token (höchstens 64 Zeichen).
 */
const kennung = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)

/**
 * Der Bezug eines Auftrags: nur Kennungen unter Namen, die auf `Id` enden
 * (`orderId`, `aboId`, `postId` …), höchstens vier. So kann `bezug` keine
 * Adresse, keinen Namen, keinen Text und keinen Token tragen (N26).
 * Arten mit festem Bezug haben ein eigenes Schema in BEZUG_JE_ART.
 */
const kennungen = z
  .record(z.string().regex(/^[a-z][A-Za-z]{0,30}Id$/), kennung)
  .refine((b) => Object.keys(b).length <= 4)

/** Beitrag an ein Abo: Schlüssel `beitrag:<postId>:<aboId>`. */
export const beitragBezugSchema = z.object({ postId: kennung, aboId: kennung }).strict()
export type BeitragBezug = z.infer<typeof beitragBezugSchema>

const BEZUG_JE_ART: Partial<Record<MailArt, z.ZodType<Record<string, string>>>> = {
  beitrag: beitragBezugSchema,
}

/** Das Schema für den Bezug einer Art (fest, sonst nur Kennungen). */
export function bezugSchemaFuer(art: MailArt): z.ZodType<Record<string, string>> {
  return BEZUG_JE_ART[art] ?? kennungen
}
