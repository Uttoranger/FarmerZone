import { z } from 'zod'
import {
  BEITRAG_PRODUKTE_MAX,
  BEITRAG_TEXT_MAX,
  BEITRAG_TITEL_MAX,
  BEITRAG_WHATSAPP_MAX,
  BILD_URL_MAX,
} from '@/lib/eingabegrenzen'

/**
 * Die Eingaben der Beitrags-Actions (src/server/actions/status-posts.ts,
 * Nr. 32): Alles, was aus dem Browser kommt, ist Fremddaten, bevor es in eine
 * WHERE-Klausel, die Datenbank oder eine Mail an Abonnentinnen geht.
 */

/** Die Kennung eines Beitrags. */
export const beitragIdSchema = z.string().min(1).max(64)

/**
 * Die Anlässe wie im Enum `StatusPostAnlass` — hier ausgeschrieben, weil
 * Schemas auch im Browser laufen (kein Import aus `@prisma/client`);
 * tests/status-posts.test.ts gleicht beide Listen ab.
 */
export const STATUS_POST_ANLASS_VALUES = ['FRESH_PRODUCT', 'NEW_SEASON', 'PROMOTION', 'ANNOUNCEMENT'] as const

export const beitragVeroeffentlichenSchema = z.object({
  title: z
    .string({ message: 'Gib deinem Beitrag einen Titel.' })
    .trim()
    .min(1, 'Gib deinem Beitrag einen Titel.')
    .max(BEITRAG_TITEL_MAX, `Der Titel darf höchstens ${BEITRAG_TITEL_MAX} Zeichen haben — bitte kürzen.`),
  body: z
    .string({ message: 'Schreib ein paar Worte zu deinem Beitrag.' })
    .trim()
    .min(1, 'Schreib ein paar Worte zu deinem Beitrag.')
    .max(BEITRAG_TEXT_MAX, `Der Text darf höchstens ${BEITRAG_TEXT_MAX} Zeichen haben — bitte kürzen.`),
  anlass: z.enum(STATUS_POST_ANLASS_VALUES, { message: 'Wähle einen Anlass für deinen Beitrag.' }),
  photoUrl: z.string().max(BILD_URL_MAX).optional(),
  linkedProductIds: z.array(z.string().min(1).max(64)).max(BEITRAG_PRODUKTE_MAX).optional(),
  showOnFarmPage: z.boolean(),
  sendEmail: z.boolean(),
  sendWhatsApp: z.boolean(),
})

/**
 * Felder mit eigenem Satz für die Oberfläche. Alle anderen (Bild-Adresse,
 * Produktliste, Haken) füllt das Formular selbst; trifft dort etwas nicht zu,
 * hat jemand die Anfrage gebaut — dann ein allgemeiner Satz statt Zod-Text.
 */
export const BEITRAG_FELDER_MIT_SATZ: readonly string[] = ['title', 'body', 'anlass']

export type BeitragVeroeffentlichenEingabe = z.input<typeof beitragVeroeffentlichenSchema>

/** „Per WhatsApp verschickt": wie viele Abonnentinnen bisher angetippt sind. */
export const whatsAppGezaehltSchema = z.object({
  postId: beitragIdSchema,
  count: z.number().int().min(0).max(BEITRAG_WHATSAPP_MAX),
})
