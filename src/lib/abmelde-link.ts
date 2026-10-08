/**
 * Abmelden von werblichen Mails (Register S11) — Adressen, Kopfzeilen und
 * Sätze aus EINER Quelle. Rein und ohne env (tests/abmelde-link.test.ts);
 * den Token signiert src/lib/unsubscribe.ts, die Adresse der App kommt vom
 * Aufrufer (APP_URL).
 *
 * Zwei Wege mit demselben Token (bewusst ohne Ablauf):
 *  - der Link im Text der Mail → die Seite mit dem Knopf „Ja, abmelden";
 *  - seit Nr. 47 die Kopfzeilen `List-Unsubscribe` und
 *    `List-Unsubscribe-Post` (RFC 2369, RFC 8058): Mailprogramme bieten
 *    damit selbst „Abmelden" an und schicken einen POST ohne weitere Frage an
 *    `/api/abmelden`. Ein GET dorthin ändert nie etwas (S2) und führt nur
 *    auf die Seite mit dem Knopf.
 */

/** Die Seite mit dem Knopf (Link im Text der Mail). */
export const ABMELDE_SEITE = '/account/unsubscribe'

/** Der Endpunkt für die Ein-Klick-Abmeldung des Mailprogramms. */
export const EIN_KLICK_ABMELDUNG = '/api/abmelden'

/** Der feste Inhalt des POST nach RFC 8058 — Feld und Wert. */
export const EIN_KLICK_FELD = 'List-Unsubscribe'
export const EIN_KLICK_WERT = 'One-Click'

export function abmeldeSeitenPfad(token: string): string {
  return `${ABMELDE_SEITE}?token=${encodeURIComponent(token)}`
}

export function einKlickAbmeldePfad(token: string): string {
  return `${EIN_KLICK_ABMELDUNG}?token=${encodeURIComponent(token)}`
}

/**
 * Die beiden Kopfzeilen einer werblichen Mail. Nur werbliche Mails tragen
 * sie (heute die Beiträge per Mail) — eine Bestellbestätigung bietet kein
 * „Abmelden" an, das es für sie nicht gibt.
 */
export function listUnsubscribeKoepfe(appUrl: string, token: string): { 'List-Unsubscribe': string; 'List-Unsubscribe-Post': string } {
  return {
    'List-Unsubscribe': `<${appUrl}${einKlickAbmeldePfad(token)}>`,
    'List-Unsubscribe-Post': `${EIN_KLICK_FELD}=${EIN_KLICK_WERT}`,
  }
}

/**
 * Grenze für `POST /api/abmelden` je IP und Minute (erste Stufe,
 * `enforceRateLimit`). Bewusst weit über der Vorgabe von 20: Den POST
 * schicken nicht Kundinnen, sondern die Server weniger großer Mailanbieter —
 * nach einem Beitrag an viele Abonnentinnen kommen deren Abmeldungen über
 * dieselben wenigen Adressen, und eine abgewiesene Abmeldung käme nie wieder.
 * Ohne gültigen Token (HMAC über Adresse und Hof) erreicht ein Aufruf die
 * Datenbank gar nicht; die Grenze hält nur eine Schleife mit einem echten
 * Token davon ab, sie zu beschäftigen.
 */
export const EIN_KLICK_JE_MINUTE = 300

/** Antwort des Endpunkts, wenn der Link nicht gilt (die Seite sagt dasselbe mit ihren Worten). */
export const ABMELDE_LINK_UNGUELTIG =
  'Dieser Abmelde-Link gilt nicht. Öffne den Link aus der Mail noch einmal oder verwalte deine Abos unter „Mein Konto".'

/** Antwort des Endpunkts, wenn das Speichern scheitert. */
export const ABMELDEN_FEHLGESCHLAGEN = 'Wir konnten dich gerade nicht abmelden. Bitte versuch es später noch einmal.'
