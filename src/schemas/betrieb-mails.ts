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

// ─── Alle Mails (Register N27, Nr. 167) ──────────────────────────────────────

/** Die Stände, nach denen „Alle Mails“ filtert — Wörter der Seite, nicht die Spalte `status`. */
export const MAIL_STAENDE = ['gesendet', 'zugestellt', 'offen', 'gescheitert', 'gesperrt', 'verworfen', 'abgelehnt'] as const
export type MailStandFilter = (typeof MAIL_STAENDE)[number]

/** Die Wege als Filter (Wortliste N8: Sofort, Wichtig, Kann warten). */
export const MAIL_WEGE = ['sofort', 'wichtig', 'kannWarten'] as const
export type MailWegFilter = (typeof MAIL_WEGE)[number]

/** Der Zeitraum: höchstens 90 Tage — länger hält das Protokoll nicht. */
export const MAIL_ZEITRAEUME = ['24h', '7t', '30t', '90t'] as const
export type MailZeitraum = (typeof MAIL_ZEITRAEUME)[number]

export type AlleMailsFilter = {
  art: z.infer<typeof mailArtSchema> | null
  weg: MailWegFilter | null
  stand: MailStandFilter | null
  zeitraum: MailZeitraum
  hof: string | null
  support: boolean
}

/** Eine Kennung (cuid u. ä.) — nie eine Adresse, nie Text. */
const kennungSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
/** Die Kennung eines Auftrags — dasselbe Muster wie `mailAuswahlSchema`. */
export const mailKennungSchema = z.string().regex(/^[a-z0-9]{20,40}$/)

/** Seite weiter: `<Millisekunden>.<Kennung>` des letzten Eintrags (Cursor über `erstelltAm`, `id`). */
const cursorSchema = z
  .string()
  .regex(/^[0-9]{1,15}\.[A-Za-z0-9_-]{1,64}$/)
  .transform((w) => {
    const [ms, id] = w.split('.')
    return { am: new Date(Number.parseInt(ms, 10)), id }
  })

/** Ein Parameter nur, wenn er genau einmal und als Text kommt — sonst der Standard. */
function einmal(wert: string | string[] | undefined): string | undefined {
  return typeof wert === 'string' ? wert : undefined
}

export type AlleMailsParameter = {
  /** `?liste=alle` — sonst die Übersicht E-Mails aus Nr. 161. */
  liste: boolean
  filter: AlleMailsFilter
  nach: { am: Date; id: string } | null
  /** Die gewählte Mail (Detail rechts bzw. Blatt am Handy). */
  mail: string | null
}

/**
 * Die Adresse von „Alle Mails“ (`?reiter=mails&liste=alle`), alles mit Zod:
 * Ein unbekannter oder doppelter Wert ist nie ein Fehler, sondern der
 * Standard (alle, 90 Tage) — ein alter Link zeigt die Liste.
 */
export function alleMailsAus(p: Record<string, string | string[] | undefined>): AlleMailsParameter {
  const nimm = <T>(schema: z.ZodType<T>, wert: string | string[] | undefined): T | null => {
    const r = schema.safeParse(einmal(wert))
    return r.success ? r.data : null
  }
  return {
    liste: einmal(p.liste) === 'alle',
    filter: {
      art: nimm(mailArtSchema, p.art),
      weg: nimm(z.enum(MAIL_WEGE), p.weg),
      stand: nimm(z.enum(MAIL_STAENDE), p.stand),
      zeitraum: nimm(z.enum(MAIL_ZEITRAEUME), p.zeitraum) ?? '90t',
      hof: nimm(kennungSchema, p.hof),
      support: einmal(p.support) === '1',
    },
    nach: nimm(cursorSchema, p.nach),
    mail: nimm(mailKennungSchema, p.mail),
  }
}

/** „Nochmal schicken“ und „Vorschau“ meinen genau einen Auftrag. */
export const mailEinzelnSchema = z.object({ id: mailKennungSchema }).strict()
/** „Alle nochmal schicken“ in „Braucht dich“: alle gescheiterten einer Art. */
export const mailArtEingabeSchema = z.object({ art: mailArtSchema }).strict()
