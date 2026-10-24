import { createHmac } from 'crypto'
import { env } from '@/lib/env'

/**
 * Der Fingerabdruck einer Empfängeradresse in der Mail-Warteschlange
 * (Register N26, Nr. 158): HMAC-SHA256 über die klein geschriebene, getrimmte
 * Adresse mit dem Zweck-Präfix `mail-empfaenger:` und dem Geheimnis der
 * signierten Links.
 *
 * WARUM: Der Support sucht Mails nach exakter Adresse (Nr. 161/167), auch
 * solche ohne Bestellung (Anmeldecode). Die Adresse selbst steht nie in
 * `MailAuftrag`; mit Geheimnis lässt sich der Wert aus einer bekannten Adresse
 * nicht nachrechnen, das Präfix trennt diese Verwendung von den Signaturen mit
 * demselben Schlüssel (Muster wie `kundeIdAus`, `geraeteKennungHash`).
 *
 * Gesetzt nur vom Worker und von `sendRaw` beim Versand, nie aus einem
 * Formular; verglichen wird nur über diese Funktion (Suche: Fingerabdruck der
 * eingegebenen Adresse = gespeicherter Wert). Gilt trotzdem als
 * personenbezogen: nie angezeigt, nie exportiert, nach 90 Tagen gelöscht.
 */
export function empfaengerFingerabdruck(adresse: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(`mail-empfaenger:${adresse.trim().toLowerCase()}`)
    .digest('hex')
}
