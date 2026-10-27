import { z } from 'zod'

/*
 * Die Einstellungen der Plattformgebühr je Hof im Admin (Register N38,
 * Nr. 198): Satz, Mandat Pflicht für bar, Tage bis zur Sperre,
 * Abrechnungstag (1–28) und Einzug ab (leer = Vorgabe, „zurücksetzen“).
 * Satz und Einzug gelten nur für neue Bestellungen (der Snapshot je Bestellung
 * bleibt).
 */

export const PLATTFORMGEBUEHR_HOF_FEHLER = {
  satz: 'Gib den Satz als Zahl zwischen 0 und 20 ein, höchstens zwei Nachkommastellen (etwa 6 oder 6,5).',
  tage: 'Tage bis zur Sperre: eine ganze Zahl von 1 bis 90.',
  tag: 'Abrechnungstag: eine ganze Zahl von 1 bis 28.',
  einzug: 'Gib „Einzug ab“ als Datum ein oder lass das Feld leer für die Vorgabe.',
} as const

/** „6“, „6,5“, „6.50“ → „6.50“ (Decimal-Text, kein Float); nur 0 bis 20 %. */
export function satzAlsDezimal(text: string): string | null {
  const t = /^(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(text.trim())
  if (!t) return null
  const ganz = Number.parseInt(t[1], 10)
  const nach = (t[2] ?? '').padEnd(2, '0')
  if (ganz > 20 || (ganz === 20 && nach !== '00')) return null
  return `${ganz}.${nach}`
}

export const plattformgebuehrHofSchema = z
  .object({
    farmId: z.string().regex(/^[\w-]{1,64}$/),
    satz: z.string().max(10).transform((s, ctx) => {
      const d = satzAlsDezimal(s)
      if (d === null) {
        ctx.addIssue({ code: 'custom', message: PLATTFORMGEBUEHR_HOF_FEHLER.satz })
        return z.NEVER
      }
      return d
    }),
    mandatPflicht: z.boolean(),
    sperreTage: z.number().int({ message: PLATTFORMGEBUEHR_HOF_FEHLER.tage }).min(1, { message: PLATTFORMGEBUEHR_HOF_FEHLER.tage }).max(90, { message: PLATTFORMGEBUEHR_HOF_FEHLER.tage }),
    abrechnungsTag: z.number().int({ message: PLATTFORMGEBUEHR_HOF_FEHLER.tag }).min(1, { message: PLATTFORMGEBUEHR_HOF_FEHLER.tag }).max(28, { message: PLATTFORMGEBUEHR_HOF_FEHLER.tag }),
    /** Leer = Vorgabe (Stichtag bzw. nach der Gründung). */
    einzugAb: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: PLATTFORMGEBUEHR_HOF_FEHLER.einzug })]),
  })
  .strict()

export type PlattformgebuehrHofEingabe = z.input<typeof plattformgebuehrHofSchema>

/**
 * Hof › Rechnung öffnen (`oeffneRechnung`): welche Abrechnung, welche
 * Rechnung (bar oder online) und wohin — PDF oder die gehostete Seite zum
 * Bezahlen. Die Kennung prüft die Action zusätzlich gegen den Hof der Sitzung.
 */
export const rechnungSchema = z
  .object({
    abrechnungId: z.string().regex(/^[\w-]{1,64}$/),
    art: z.enum(['bar', 'online']),
    ziel: z.enum(['pdf', 'bezahlen']),
  })
  .strict()
