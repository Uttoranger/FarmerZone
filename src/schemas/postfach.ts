import { z } from 'zod'
import { LINK_MAX, POSTFACH_FEHLER, TEXT_MAX, TITEL_MAX, appPfadAusLink } from '@/lib/postfach'

/**
 * Die Grenzen des Postfachs (Register N12, Nr. 87) — für die Server Actions
 * (src/server/actions/postfach.ts) und die Formulare. Strikt: Ein unbekanntes
 * Feld ist ein Fehler; eine Seite (Hof/Team) oder ein Absender kommt nie aus
 * dem Browser, sondern aus der Sitzung.
 */

/** Die Werte der Prisma-Enums, 1:1 (tests/postfach.test.ts hält sie gleich). */
export const RUNDSCHREIBEN_ARTEN = ['INFO', 'WICHTIG'] as const
export const NACHRICHT_ARTEN = ['NORMAL', 'WICHTIG', 'SYSTEM'] as const
export const UNTERHALTUNG_SEITEN = ['HOF', 'TEAM'] as const

export const rundschreibenArtSchema = z.enum(RUNDSCHREIBEN_ARTEN)
export const nachrichtArtSchema = z.enum(NACHRICHT_ARTEN)
export const unterhaltungSeiteSchema = z.enum(UNTERHALTUNG_SEITEN)

const textSchema = z.string(POSTFACH_FEHLER.textLeer).trim().min(1, POSTFACH_FEHLER.textLeer).max(TEXT_MAX, POSTFACH_FEHLER.textZuLang)

const titelSchema = z.string(POSTFACH_FEHLER.titelLeer).trim().min(1, POSTFACH_FEHLER.titelLeer).max(TITEL_MAX, POSTFACH_FEHLER.titelZuLang)

/**
 * Ein freiwilliger Link: leer heißt null; sonst nur relativ („/…") oder auf
 * die Produktionsdomain — gespeichert wird der Weg in der App (appPfadAusLink).
 */
export const linkSchema = z.preprocess(
  (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v),
  z
    .string(POSTFACH_FEHLER.link)
    .max(LINK_MAX, POSTFACH_FEHLER.link)
    .transform((wert, ctx) => {
      const pfad = appPfadAusLink(wert)
      if (pfad === null) {
        ctx.addIssue({ code: 'custom', message: POSTFACH_FEHLER.link })
        return z.NEVER
      }
      return pfad
    })
    .nullable()
)

/** Der Hof antwortet im eigenen Faden. */
export const hofAntwortSchema = z.strictObject({
  unterhaltungId: z.cuid(POSTFACH_FEHLER.eingabe),
  text: textSchema,
})

/** „Gelesen" bzw. das Öffnen eines Fadens: bis zu dieser Nachricht ist gelesen. */
export const gelesenSchema = z.strictObject({
  unterhaltungId: z.cuid(POSTFACH_FEHLER.eingabe),
  nachrichtId: z.cuid(POSTFACH_FEHLER.eingabe),
})

/** Das Team antwortet im Faden eines Hofs. */
export const teamAntwortSchema = z.strictObject({
  unterhaltungId: z.cuid(POSTFACH_FEHLER.eingabe),
  text: textSchema,
  wichtig: z.boolean(POSTFACH_FEHLER.eingabe),
  link: linkSchema,
  perMail: z.boolean(POSTFACH_FEHLER.eingabe),
})

/** Wer ein Rundschreiben bekommt; der Server rechnet die Höfe selbst aus (empfaengerFuer). */
export const empfaengerRegelSchema = z.discriminatedUnion(
  'art',
  [
    z.strictObject({ art: z.literal('alle') }),
    z.strictObject({ art: z.literal('ausgewaehlt'), hofIds: z.array(z.cuid()).min(1, POSTFACH_FEHLER.keineEmpfaenger).max(500) }),
    z.strictObject({ art: z.literal('ohne-online-zahlung') }),
    z.strictObject({ art: z.literal('futter-ohne-nummer') }),
  ],
  { error: POSTFACH_FEHLER.keineEmpfaenger }
)

export const rundschreibenSchema = z.strictObject({
  titel: titelSchema,
  text: textSchema,
  art: z.enum(RUNDSCHREIBEN_ARTEN, POSTFACH_FEHLER.eingabe),
  link: linkSchema,
  perMail: z.boolean(POSTFACH_FEHLER.eingabe),
  empfaenger: empfaengerRegelSchema,
})

export type HofAntwort = z.infer<typeof hofAntwortSchema>
export type TeamAntwort = z.input<typeof teamAntwortSchema>
export type RundschreibenEingabe = z.input<typeof rundschreibenSchema>
