import { z } from 'zod'
import {
  MELDUNG_ARTEN,
  MELDUNG_KENNUNG_MAX,
  MELDUNG_TEXT_MAX,
  MELDUNG_TEXT_MIN,
  MELDUNG_STATUS,
} from '@/lib/meldung'

/**
 * Was das Meldeformular an den Server schickt (Sprint fehlerbriefkasten).
 * Honigtopf und Zeitschranke prüft die Action VOR diesem Schema — ein Bot
 * soll keine Validierungsmeldung bekommen, an der er lernen könnte.
 */
export const meldungEingabeSchema = z.object({
  art: z.enum(MELDUNG_ARTEN, { message: 'Bitte wähle Fehler, Wunsch oder Frage.' }),
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
  clusterKey: leerZuNull(60, 'Cluster'),
  triageNotiz: leerZuNull(2000, 'Notiz'),
  duplikatVonId: leerZuNull(40, 'Duplikat von'),
  sprintName: leerZuNull(60, 'Sprint'),
  antwortAnMelder: leerZuNull(500, 'Antwort'),
})

export type TriageEingabe = z.infer<typeof triageEingabeSchema>
