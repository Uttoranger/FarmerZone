/**
 * Der Anlass eines Beitrags (Register F8, Nr. 128): Wort und Symbol an EINER
 * Stelle — „Aktuell vom Hof“ auf der Hofseite liest sie von hier.
 *
 * Die Liste der Werte steht als Zod-Quelle in src/schemas/status-post.ts
 * (Schemas laufen auch im Browser und dürfen `@prisma/client` nicht
 * einbinden; tests/status-posts.test.ts gleicht sie mit dem Enum ab). Hier
 * steht sie nur unter dem Namen, unter dem Fachregeln und Adressen (etwa
 * `?anlass=` für „Neuer Beitrag“) sie nehmen — keine zweite Liste.
 *
 * Die Wörter stehen nur hier (Nr. 134): Assistent „Neuer Beitrag“, Mail an
 * Abonnentinnen, Teilen-Bild und das Bild der Route /api/status-image lesen sie
 * von hier; tests/anlass-woerter-wache.test.ts hält das fest.
 */
import { CalendarDays, Leaf, MessageCircle, Tag, type LucideIcon } from 'lucide-react'

/**
 * Alle Anlässe in der Reihenfolge des Assistenten — für Zod (`z.enum(BEITRAG_ANLAESSE)`) und Auswahllisten.
 * Wie im Enum `StatusPostAnlass` ausgeschrieben, weil die Liste auch im Browser läuft (kein Import aus
 * `@prisma/client`); tests/status-posts.test.ts gleicht beide ab. Hier statt in src/schemas/status-post.ts,
 * damit die Startseite sie ohne Zod lädt (Nr. 196); das Schema nimmt dieselbe Liste.
 */
export const BEITRAG_ANLAESSE = ['FRESH_PRODUCT', 'NEW_SEASON', 'PROMOTION', 'ANNOUNCEMENT'] as const

export type BeitragAnlass = (typeof BEITRAG_ANLAESSE)[number]

/** Wort und Symbol je Anlass — so steht er an der Marke über dem Beitrag. */
export const BEITRAG_ANLASS: Record<BeitragAnlass, { wort: string; symbol: LucideIcon }> = {
  FRESH_PRODUCT: { wort: 'Frisches Produkt', symbol: Leaf },
  NEW_SEASON: { wort: 'Neue Saison', symbol: CalendarDays },
  PROMOTION: { wort: 'Aktion', symbol: Tag },
  // Register N42 c (Lauf 30, Nr. 225): das Etikett heißt „Hinweis“ – „Mitteilung“ steht in der Wortliste unter „nicht“; das Enum bleibt.
  ANNOUNCEMENT: { wort: 'Hinweis', symbol: MessageCircle },
}

/**
 * Sätze im Ablauf „Neuer Beitrag“ (Boards s2/w2-beitraege, Lauf 30, Nr. 225), die
 * der Lauf geändert hat — Wortliste N42 c („Hofseite“ zusammen, „Neuigkeiten“ statt
 * „E-Mail-Updates“, „die Kundin“ in Sätzen). Die Zahl der Tage zwischen zwei Mails
 * kommt als Parameter aus `MAILABSTAND_TAGE` (beitrag-mailabstand.ts).
 */
export const BEITRAG_ABLAUF_TEXT = {
  vorschauSchritt: 'Überprüfen und absenden',
  anredeTipp: 'wird automatisch ersetzt. Auf der Hofseite steht die Anrede ohne Namen.',
  hofseiteTitel: 'Auf meiner Hofseite anzeigen',
  hofseiteSatz: 'Alle Besucher sehen es · für 7 Tage oben',
  mailTitel: 'Per E-Mail an Abonnentinnen',
  mailAbonniert: (anzahl: number, tage: number): string =>
    `${anzahl} ${anzahl === 1 ? 'Kundin bekommt' : 'Kundinnen bekommen'} deine Neuigkeiten per E-Mail · einmal in ${tage} Tagen möglich`,
  mailGesperrt: (vorTagen: number, tage: number): string =>
    `Die letzte E-Mail ging vor ${vorTagen} ${vorTagen === 1 ? 'Tag' : 'Tagen'} raus · einmal in ${tage} Tagen möglich`,
  mailKeine: 'Noch keine Abonnentinnen',
  zustimmung:
    'Nur Kundinnen, die selbst zugestimmt haben, bekommen E-Mail oder WhatsApp. WhatsApp verschickst du nach dem Veröffentlichen selbst – mit einem Tipp je Person.',
  hofseiteZusammenfassung: 'Auf deiner Hofseite für 7 Tage oben',
  /** Empfänger-Zeile der Vorschau mit Einzahl und Mehrzahl (Nr. 278 Runde 1; vorher „1 E-Mails werden …“). */
  mailZusammenfassung: (anzahl: number): string =>
    `${anzahl} ${anzahl === 1 ? 'E-Mail wird' : 'E-Mails werden'} automatisch versendet`,
  /** Klein unter der Vorschau: Der Beispielname steht nur hier (Liste Lauf 32 Z. 430). */
  vorschauNameHinweis: 'Name wird je Person eingesetzt.',
  veroeffentlichtHofseite: 'auf der Hofseite',
} as const

/** Beispielname der Vorschau „Neuer Beitrag“ (Board s2-/w2-beitraege Bild 4: „Hallo Anna!“). */
export const VORSCHAU_BEISPIELNAME = 'Anna'

/**
 * Der Text der Vorschau, wie er bei einer Kundin ankommt: `{Vorname}` durch den Beispielnamen ersetzt.
 * Nur Anzeige — abgeschickt wird der Text mit Platzhalter, ersetzt wird je Empfängerin beim Versand.
 */
export function beitragVorschauText(body: string): string {
  return body.replaceAll('{Vorname}', VORSCHAU_BEISPIELNAME)
}
