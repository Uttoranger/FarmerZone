import { z } from 'zod'
import {
  BEITRAG_PRODUKTE_MAX,
  BEITRAG_TEXT_MAX,
  BEITRAG_TITEL_MAX,
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
  // Kein sendWhatsApp mehr (Register T5, Nr. 67): Ein Feld, das trotzdem
  // kommt, verwirft Zod — beim Veröffentlichen geht nichts per WhatsApp raus.
})

/**
 * Felder mit eigenem Satz für die Oberfläche. Alle anderen (Bild-Adresse,
 * Produktliste, Haken) füllt das Formular selbst; trifft dort etwas nicht zu,
 * hat jemand die Anfrage gebaut — dann ein allgemeiner Satz statt Zod-Text.
 */
export const BEITRAG_FELDER_MIT_SATZ: readonly string[] = ['title', 'body', 'anlass']

/**
 * Ein verknüpftes Produkt gehört nicht zum Hof der Anmeldung oder gibt es
 * nicht mehr (Nr. 35). Die Auswahl zeigt nur eigene Produkte — der Fall
 * entsteht bei einer veralteten Seite oder einer gebauten Anfrage.
 */
export const BEITRAG_PRODUKT_FREMD =
  'Ein ausgewähltes Produkt gibt es auf deinem Hof nicht mehr. Lade die Seite neu und wähl die Produkte noch einmal.'

export type BeitragVeroeffentlichenEingabe = z.input<typeof beitragVeroeffentlichenSchema>

/**
 * „Geöffnet" je Person setzen oder zurücksetzen (Register W1, Nr. 66):
 * Beitrag und Abonnement sind Prisma-Kennungen (cuid), mehr kommt nicht aus
 * dem Browser — keine Zahl, die Zahl folgt aus der gespeicherten Liste.
 */
export const whatsAppGetipptSchema = z.object({
  postId: z.cuid(),
  subscriptionId: z.cuid(),
  geoeffnet: z.boolean(),
})
