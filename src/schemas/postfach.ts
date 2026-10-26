import { z } from 'zod'
import {
  ADMIN_POSTFACH_REITER_IDS,
  EINGANG_ARTEN,
  EINGANG_FILTER_IDS,
  LINK_MAX,
  POSTFACH_FEHLER,
  TEXT_MAX,
  TITEL_MAX,
  appPfadAusLink,
  type AdminPostfachReiter,
  type EingangAuswahl,
  type EingangFilter,
} from '@/lib/postfach'
import { TOKEN_MUSTER, ZUSTELLUNG_FEHLER, type SchaltbareArt } from '@/lib/zustellung'
import { emailSchema } from '@/schemas/email'

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
  /** „Antwort möglich" (Register N14): Pflicht — das Formular setzt den Standard nach Art, der Server übernimmt nur, was kam. */
  antwortMoeglich: z.boolean(POSTFACH_FEHLER.eingabe),
  empfaenger: empfaengerRegelSchema,
})

export type HofAntwort = z.infer<typeof hofAntwortSchema>
export type TeamAntwort = z.input<typeof teamAntwortSchema>
export type RundschreibenEingabe = z.input<typeof rundschreibenSchema>

// ─── Admin-Postfach: Adresse (Register N12-Änderung, N14; Nr. 95) ───────────

/**
 * Der erste Wert, wenn Next einen doppelten Parameter als Liste liefert — EINE
 * Hilfe für die Adresse des Postfachs, auch für den Reiter „Meldungen"
 * (src/schemas/meldung.ts, seit Nr. 105).
 */
export function ersterWert(wert: unknown): unknown {
  return Array.isArray(wert) ? wert[0] : wert
}

/** Der Reiter aus ?reiter= — unbekannt oder leer heißt „Eingang", nie ein Fehler (wie src/schemas/admin-reiter.ts). */
export const adminPostfachReiterSchema = z.preprocess(ersterWert, z.enum(ADMIN_POSTFACH_REITER_IDS).catch('eingang'))

export function adminPostfachReiterAus(wert: string | string[] | undefined): AdminPostfachReiter {
  return adminPostfachReiterSchema.parse(wert)
}

/** Der Filter des Eingangs aus ?art= — unbekannt oder leer heißt „Offen". */
export const eingangFilterSchema = z.preprocess(ersterWert, z.enum(EINGANG_FILTER_IDS).catch('offen'))

export function eingangFilterAus(wert: string | string[] | undefined): EingangFilter {
  return eingangFilterSchema.parse(wert)
}

/**
 * Die gewählte Zeile aus ?id= („hof-ck…") bzw. aus ?meldung= (Umleitung von
 * /admin/meldungen/[id]: dort darf auch die Kurznummer stehen). Als Kennung
 * nur Buchstaben, Ziffern, „-" und „_" (cuid, Kurznummer, Seed-Kennungen);
 * die Art steht vor dem ersten „-". Alles andere öffnet nichts.
 */
const KENNUNG = /^[A-Za-z0-9_-]{1,60}$/
const auswahlSchema = z.string().regex(new RegExp(`^(${EINGANG_ARTEN.join('|')})-([A-Za-z0-9_-]{1,60})$`))

export function eingangAuswahlAus(id: string | string[] | undefined, meldung: string | string[] | undefined): EingangAuswahl | null {
  const roh = auswahlSchema.safeParse(ersterWert(id))
  if (roh.success) {
    const trenner = roh.data.indexOf('-')
    const art = EINGANG_ARTEN.find((a) => a === roh.data.slice(0, trenner))
    if (art) return { art, id: roh.data.slice(trenner + 1) }
  }
  const alt = z.string().regex(KENNUNG).safeParse(ersterWert(meldung))
  return alt.success ? { art: 'meldung', id: alt.data } : null
}

/** Der Faden aus der alten Adresse ?reiter=unterhaltungen&faden= — nur eine Kennung, sonst ohne Faden umleiten. */
export function fadenKennungAus(wert: string | string[] | undefined): string | undefined {
  const faden = z.string().regex(KENNUNG).safeParse(ersterWert(wert))
  return faden.success ? faden.data : undefined
}

// ─── Zustellung (Register N14, Nr. 95) ───────────────────────────────────────

/** Eine weitere Adresse: klein, ohne Ränder, höchstens 254 Zeichen (emailSchema). */
export const empfaengerHinzufuegenSchema = z.strictObject({
  email: emailSchema(ZUSTELLUNG_FEHLER.email),
})

export const empfaengerEntfernenSchema = z.strictObject({
  id: z.cuid(ZUSTELLUNG_FEHLER.eingabe),
})

/** Die schaltbaren Regeln beim Speichern — streng: jede Art genau einmal als Wahrheitswert. */
export const zustellRegelnSpeichernSchema = z.strictObject({
  fehlermeldung: z.boolean(ZUSTELLUNG_FEHLER.eingabe),
  hofWartet: z.boolean(ZUSTELLUNG_FEHLER.eingabe),
  antwortHof: z.boolean(ZUSTELLUNG_FEHLER.eingabe),
  wochenbericht: z.boolean(ZUSTELLUNG_FEHLER.eingabe),
}) satisfies z.ZodType<Record<SchaltbareArt, boolean>>

/** Der Token aus dem Link der Bestätigungsmail (genau 43 Zeichen base64url). */
export const empfaengerTokenSchema = z.string().regex(TOKEN_MUSTER)
