import { z } from 'zod'
import { EIN_KLICK_FELD, EIN_KLICK_WERT } from '@/lib/abmelde-link'

/**
 * Der Abmelde-Token aus der Adresse (Seite, Server Action, Ein-Klick-Endpunkt).
 * Hier nur die Gestalt — ob er gilt, entscheidet die Signatur
 * (`verifyUnsubscribeToken`, src/lib/unsubscribe.ts). Die Obergrenze liegt
 * weit über jedem echten Token (Adresse bis 254 Zeichen, Base64 plus Signatur).
 */
export const abmeldeTokenSchema = z.string().min(1).max(1000)

/**
 * Der Inhalt des Ein-Klick-POST nach RFC 8058: genau „List-Unsubscribe=One-Click"
 * als Formularfeld. Weitere Felder schaden nicht, fehlen darf es nicht.
 */
export const einKlickAbmeldungSchema = z.object({ [EIN_KLICK_FELD]: z.literal(EIN_KLICK_WERT) })
