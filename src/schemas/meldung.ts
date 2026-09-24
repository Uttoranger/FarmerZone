import { z } from 'zod'
import {
  MELDUNG_ARTEN,
  MELDUNG_KENNUNG_MAX,
  MELDUNG_TEXT_MAX,
  MELDUNG_TEXT_MIN,
  MELDUNG_STATUS,
  TRIAGE_NOTIZ_MAX,
  ZIEL_STATUS,
} from '@/lib/meldung'
import { bereinige } from '@/lib/fremdtext'

/**
 * Was das Meldeformular an den Server schickt (Sprint fehlerbriefkasten).
 * Honigtopf und Zeitschranke prüft die Action VOR diesem Schema — ein Bot
 * soll keine Validierungsmeldung bekommen, an der er lernen könnte.
 */
export const meldungEingabeSchema = z.object({
  art: z.enum(MELDUNG_ARTEN, { message: 'Bitte wähle oben aus, worum es geht.' }),
  text: z
    .string()
    .trim()
    .min(MELDUNG_TEXT_MIN, `Bitte beschreibe es mit mindestens ${MELDUNG_TEXT_MIN} Zeichen.`)
    .max(MELDUNG_TEXT_MAX, `Höchstens ${MELDUNG_TEXT_MAX} Zeichen.`),
  seiteUrl: z.string().trim().max(500).default(''),
  userAgent: z.string().trim().max(500).default(''),
  viewport: z.string().trim().max(40).default(''),
  diagKennung: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(MELDUNG_KENNUNG_MAX, 'Kennung zu lang').optional()
  ),
  customerEmail: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().email('Ungültige E-Mail-Adresse').max(200).optional()
  ),
  screenshotUrl: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().url().max(500).optional()
  ),
})

export type MeldungEingabe = z.infer<typeof meldungEingabeSchema>

/** Die Triage im Admin-Bereich — jedes Feld optional, leer = null. */
const leerZuNull = (max: number, feld: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v),
    z.string().trim().max(max, `${feld}: höchstens ${max} Zeichen`).nullable()
  )

export const triageEingabeSchema = z.object({
  status: z.enum(MELDUNG_STATUS, { message: 'Unbekannter Status.' }),
  // Nur der Knopf „Ja, ein Wunsch" schickt eine Art; das Formular lässt sie weg.
  art: z.enum(MELDUNG_ARTEN, { message: 'Unbekannte Art.' }).optional(),
  clusterKey: leerZuNull(60, 'Cluster'),
  triageNotiz: leerZuNull(TRIAGE_NOTIZ_MAX, 'Notiz'),
  duplikatVonId: leerZuNull(40, 'Duplikat von'),
  sprintName: leerZuNull(60, 'Sprint'),
  antwortAnMelder: leerZuNull(500, 'Antwort'),
})

export type TriageEingabe = z.infer<typeof triageEingabeSchema>

/** Ziele, die eine PR-Nummer brauchen — sie steht in sprintName und im Audit. */
const MIT_PR: readonly string[] = ['GEPLANT', 'ERLEDIGT', 'GEPRUEFT']

/**
 * Der Body der Schreibroute POST /api/triage/status (Sprint
 * Briefkasten-Rückkopplung). STRIKT: ein unbekanntes Feld ist ein Fehler —
 * insbesondere antwortAnMelder. Die Route schreibt nie Text, den ein Melder
 * sieht, außer ihren festen Sätzen.
 */
export const triageStatusSchema = z
  .object({
    // Kurznummer oder volle ID — beides nur Kleinbuchstaben und Ziffern (cuid).
    meldungId: z.string().trim().regex(/^[a-z0-9]{8,30}$/, 'meldungId: Kurznummer (8 Zeichen) oder volle ID.'),
    status: z.enum(ZIEL_STATUS, { message: 'status: erlaubt sind VERMUTLICH_WUNSCH, GEPLANT, ERLEDIGT, GEPRUEFT.' }),
    prNummer: z.number().int().positive().max(1_000_000).optional(),
    // Steuer- und Richtungszeichen fallen VOR der Längenprüfung weg — der Grund
    // landet in der Triage-Notiz und damit wieder im Export.
    grund: z
      .string()
      .transform((g) => bereinige(g).replace(/\s+/g, ' ').trim())
      .pipe(z.string().min(1, 'grund ist leer.').max(300, 'grund: höchstens 300 Zeichen.'))
      .optional(),
    quelle: z.enum(['deployment', 'merge']).default('deployment'),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (MIT_PR.includes(d.status) && d.prNummer === undefined) {
      ctx.addIssue({ code: 'custom', path: ['prNummer'], message: `prNummer fehlt — ${d.status} braucht die Nummer des PR.` })
    }
    if (d.status === 'VERMUTLICH_WUNSCH' && d.grund === undefined) {
      ctx.addIssue({ code: 'custom', path: ['grund'], message: 'grund fehlt — sag in eigenen Worten, warum es ein Wunsch ist.' })
    }
  })

export type TriageStatusEingabe = z.infer<typeof triageStatusSchema>
