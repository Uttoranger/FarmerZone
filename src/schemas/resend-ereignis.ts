import { z } from 'zod'

/*
 * Zustellmeldungen von Resend (Register N26, Nr. 160) — was der Webhook
 * POST /api/webhooks/resend aus dem Inhalt liest. Nur `type`, `created_at`
 * und `data.email_id`: Zod lässt jedes andere Feld weg, also auch Absender,
 * Empfänger und Betreff. Eine Adresse kommt so nie weiter als bis zum Parser.
 */

/** Größte angenommene Meldung — Resend schickt wenige KB; mehr wird nicht gelesen (413). */
export const RESEND_EREIGNIS_MAX_BYTES = 64 * 1024

/** Die drei Ereignisse, die etwas vermerken; jedes andere beantwortet der Webhook mit 200 ohne Wirkung. */
export const RESEND_ZUSTELL_EREIGNISSE = {
  'email.delivered': 'zugestellt',
  'email.bounced': 'bounce',
  'email.complained': 'beschwerde',
} as const

export type ResendZustellEreignis = keyof typeof RESEND_ZUSTELL_EREIGNISSE
export type Zustellung = (typeof RESEND_ZUSTELL_EREIGNISSE)[ResendZustellEreignis]

/** Erster Blick: nur die Art. */
export const resendEreignisArtSchema = z.object({ type: z.string().max(100) })

/** Ein Ereignis, das etwas vermerkt — `email_id` ist die `resendId` des Auftrags. */
export const resendZustellSchema = z.object({
  type: z.enum(Object.keys(RESEND_ZUSTELL_EREIGNISSE) as [ResendZustellEreignis, ...ResendZustellEreignis[]]),
  created_at: z.string().max(100),
  data: z.object({ email_id: z.string().min(1).max(100) }),
})
export type ResendZustellMeldung = z.infer<typeof resendZustellSchema>
