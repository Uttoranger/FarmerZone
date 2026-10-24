import { z } from 'zod'
import { emailSchema } from '@/schemas/email'
import { bestellnummerSchema } from '@/schemas/bestellnummer'
import { mailArtSchema } from '@/schemas/mail-auftrag'

/*
 * Die Adresse von Admin › Betrieb (Register N26, N18-Ergänzung; Nr. 161):
 * Unterreiter (`?reiter=mails`), Suche (`?suche=`) und „Alle n Arten zeigen“
 * (`?alle=1`). Die Adresse ist Fremddaten: Ein unbekannter Wert ist nie ein
 * Fehler, sondern der Standard — ein alter Link zeigt die Seite.
 */

export const BETRIEB_REITER = ['ueberblick', 'mails'] as const
export type BetriebReiter = (typeof BETRIEB_REITER)[number]

export const betriebReiterSchema = z.enum(BETRIEB_REITER).catch('ueberblick')

export function betriebReiterAus(wert: string | string[] | undefined): BetriebReiter {
  return betriebReiterSchema.parse(wert)
}

/** „Alle n Arten zeigen“: nur `1` zählt, alles andere zeigt die auffälligen. */
export function alleArtenAus(wert: string | string[] | undefined): boolean {
  return wert === '1'
}

/** Was die Suche im Feld „Bestellnummer oder E-Mail-Adresse“ verstanden hat. */
export type MailSuche = { art: 'leer' } | { art: 'bestellung'; nummer: string } | { art: 'adresse'; adresse: string } | { art: 'ungueltig' }

/** So lang darf eine Eingabe höchstens sein — alles darüber ist keine Nummer und keine Adresse. */
const SUCHE_MAX = 254

/**
 * Entscheidet ohne Datenbank, was gesucht wird: das Muster einer Bestellnummer
 * → Bestellung; eine ganze E-Mail-Adresse (klein, ohne Ränder, exakt) →
 * Adresse; sonst ungültig. Eine Teiladresse („kunde@“, „@example.at“) ist
 * keine Adresse — es gibt keine Teilsuche.
 */
export function mailSucheAus(wert: string | string[] | undefined): MailSuche {
  if (typeof wert !== 'string' || wert.trim() === '') return { art: 'leer' }
  if (wert.length > SUCHE_MAX) return { art: 'ungueltig' }
  const nummer = bestellnummerSchema.safeParse(wert)
  if (nummer.success) return { art: 'bestellung', nummer: nummer.data }
  const adresse = emailSchema().safeParse(wert)
  if (adresse.success) return { art: 'adresse', adresse: adresse.data }
  return { art: 'ungueltig' }
}

/**
 * Welche Aufträge „Jetzt schicken“ bzw. „Verwerfen“ meint: einer (Kennung)
 * oder alle einer Art in „Braucht dich“. Die Kennung ist eine cuid — nie eine
 * Adresse, nie Text.
 */
export const mailAuswahlSchema = z.union([z.object({ id: z.string().regex(/^[a-z0-9]{20,40}$/) }).strict(), z.object({ art: mailArtSchema }).strict()])
export type MailAuswahl = z.infer<typeof mailAuswahlSchema>
