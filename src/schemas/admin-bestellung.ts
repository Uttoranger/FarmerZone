import { z } from 'zod'
import { ADMIN_GRUND_FEHLER, ADMIN_GRUND_MAX, adminGrundSchema } from '@/schemas/admin-aktion'
import type { MailZeitraum } from '@/schemas/betrieb-mails'
import { WIDERRUF_ADMIN_TEXT, WIDERRUF_GRENZEN } from '@/lib/widerruf'

/*
 * Admin › Bestellungen (Register N32, N34; Nr. 186): die Adresse der Seite
 * (Filter, gewählte Bestellung) und die Eingaben der drei Aktionen. Die
 * Suche selbst liest `mailSucheAus` (src/schemas/betrieb-mails.ts) — dasselbe
 * Feld wie Admin › Betrieb › E-Mails, eine Quelle.
 *
 * Die Adresse ist Fremddaten: Ein unbekannter Wert ist nie ein Fehler,
 * sondern der Standard — ein alter Link zeigt die Seite.
 */

/** Die Stände als Filter — Wörter der Seite, zugeordnet in `standBedingung` (src/lib/admin-bestellung.ts). */
export const BESTELL_STAENDE = ['offen', 'abgeholt', 'nicht_abgeholt', 'storniert'] as const
export type BestellStandFilter = (typeof BESTELL_STAENDE)[number]

/** Der Zeitraum: höchstens 90 Tage, dieselben Stufen wie „Alle Mails“ (ohne 24 Stunden). */
export const BESTELL_ZEITRAEUME = ['7t', '30t', '90t'] as const satisfies readonly MailZeitraum[]
export type BestellZeitraum = (typeof BESTELL_ZEITRAEUME)[number]

/** Eine Kennung (cuid u. ä.) — nie eine Adresse, nie Text. */
const kennungSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)

const ersterWert = (wert: unknown): unknown => (Array.isArray(wert) ? wert[0] : wert)

/** Der Filter der Liste — EINE Quelle für Typ und Lesen der Adresse. */
export const bestellFilterSchema = z.object({
  stand: z.preprocess(ersterWert, z.enum(BESTELL_STAENDE).nullable().catch(null)),
  hof: z.preprocess(ersterWert, kennungSchema.nullable().catch(null)),
  zeitraum: z.preprocess(ersterWert, z.enum(BESTELL_ZEITRAEUME).catch('90t')),
  erstattungOffen: z.preprocess((w) => ersterWert(w) === '1', z.boolean()),
})
export type BestellFilter = z.infer<typeof bestellFilterSchema>

/** Was die Seite aus der Adresse liest — `suche` geht roh an `mailSucheAus`. */
export type BestellungenParameter = {
  suche?: string | string[]
  stand?: string | string[]
  hof?: string | string[]
  zeitraum?: string | string[]
  offen?: string | string[]
  bestellung?: string | string[]
}

export function bestellFilterAus(p: BestellungenParameter): BestellFilter {
  return bestellFilterSchema.parse({ stand: p.stand ?? null, hof: p.hof ?? null, zeitraum: p.zeitraum, erstattungOffen: p.offen })
}

/** Die gewählte Bestellung (`?bestellung=`) — nur eine cuid, sonst keine. */
export function gewaehlteBestellungAus(wert: string | string[] | undefined): string | null {
  const id = z.cuid().safeParse(ersterWert(wert))
  return id.success ? id.data : null
}

/** Der Satz, wenn die Eingabe einer Aktion nicht passt — die Kennung kommt nie vom Menschen, nur aus der Seite. */
export const ADMIN_BESTELLUNG_EINGABE_FEHLER = 'Das hat nicht geklappt. Bitte lade die Seite neu.'

/** Der Satz, wenn der Grund fehlt (Pflicht bei allen drei Aktionen, N34). */
export const ADMIN_BESTELLUNG_GRUND_FEHLT = 'Schreib bitte kurz den Grund dazu.'

/** Kennung der Bestellung und Grund (Pflicht, ohne Adresse und Telefonnummer, höchstens 300 Zeichen). */
export const adminBestellAktionSchema = z.strictObject({
  orderId: z.cuid(ADMIN_BESTELLUNG_EINGABE_FEHLER),
  grund: adminGrundSchema,
})
export type AdminBestellAktion = z.infer<typeof adminBestellAktionSchema>

/** Der Satz zu einer abgelehnten Eingabe — nur eigene deutsche Sätze, nie der englische Standardtext von Zod. */
export function adminBestellFehler(fehler: z.ZodError): string {
  const problem = fehler.issues[0]
  if (problem?.path[0] !== 'grund') return ADMIN_BESTELLUNG_EINGABE_FEHLER
  if (problem.message === ADMIN_GRUND_FEHLER) return ADMIN_GRUND_FEHLER
  if (problem.code === 'too_big') return `Der Grund ist zu lang – höchstens ${ADMIN_GRUND_MAX} Zeichen.`
  return ADMIN_BESTELLUNG_GRUND_FEHLT
}

/**
 * „Zuordnen …“ eines Widerrufs ohne Bestellung (Nachbesserung Runde 2 zu
 * Nr. 200): Kennung des Widerrufs (aus der Seite), die Bestellnummer (vom
 * Menschen) und der Grund (Pflicht wie bei jeder Aktion hier, N34).
 */
export const adminWiderrufZuordnenSchema = z.strictObject({
  widerrufId: z.cuid(ADMIN_BESTELLUNG_EINGABE_FEHLER),
  bestellnummer: z.string().trim().min(1, WIDERRUF_ADMIN_TEXT.nummerFehlt).max(WIDERRUF_GRENZEN.bestellnummer, WIDERRUF_ADMIN_TEXT.nummerZuLang),
  grund: adminGrundSchema,
})
export type AdminWiderrufZuordnen = z.infer<typeof adminWiderrufZuordnenSchema>

/** Der Satz zu einer abgelehnten Eingabe beim Zuordnen: die Bestellnummer mit ihrem Satz, sonst wie oben. */
export function adminWiderrufFehler(fehler: z.ZodError): string {
  const problem = fehler.issues[0]
  if (problem?.path[0] === 'bestellnummer') return problem.code === 'too_big' ? WIDERRUF_ADMIN_TEXT.nummerZuLang : WIDERRUF_ADMIN_TEXT.nummerFehlt
  return adminBestellFehler(fehler)
}
