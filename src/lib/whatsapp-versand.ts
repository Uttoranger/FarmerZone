/**
 * WhatsApp an Abonnentinnen, ehrlich und je Person (Register W1, Nachtlauf
 * Nr. 66). Die App kann nicht wissen, ob in WhatsApp gesendet wurde — wa.me
 * hat keinen Rückkanal. Deshalb heißt der Zustand „geöffnet", nie „gesendet";
 * markiert wird beim Zurückkommen in den Browser, nie per Zeitschaltung; jede
 * Person lässt sich zurücksetzen. Gespeichert wird, WER angetippt wurde
 * (StatusPost.whatsappGetippt, Abonnements-IDs), die Zahl folgt daraus; die
 * Empfängerinnen liest die Liste beim Öffnen, nie die beim Veröffentlichen
 * eingefrorene Zahl.
 *
 * Rein: Die Seite /status/[id]/send-whatsapp und der Knopf im Reiter
 * „Beiträge" (mein-hof-beitraege.ts) nehmen Texte und Regeln nur von hier.
 */

/** Die Sätze mit Zusage („geöffnet", Zählhinweis) — nur aus dieser Quelle. */
export const WHATSAPP_VERSAND_TEXT = {
  geoeffnet: 'Geöffnet',
  zuruecksetzenFrage: 'Doch nicht gesendet?',
  zuruecksetzen: 'Zurücksetzen',
  hinweis: 'WhatsApp öffnet sich mit dem Text. Wir sehen nicht, ob du gesendet hast – darum zählst du selbst nach.',
  stand: (geoeffnet: number, gesamt: number): string => `${geoeffnet} von ${gesamt} geöffnet`,
  offen: (offen: number): string => `${offen} ausstehend`,
  abschluss: (gesamt: number): string => `Alle ${gesamt} geöffnet – gesendet hast du in WhatsApp.`,
  /** Der Knopf je Beitrag im Reiter „Beiträge" (Mockup mobil-h4-beitraege-teilen-je-beitrag). */
  knopf: (getippt: number, gesamt: number): string => `WhatsApp · ${getippt} von ${gesamt}`,
  /** Die Überschrift der Seite — auch dort, wo keine Abonnentin da ist (jede Seite hat ihre eine h1). */
  ueberschrift: 'WhatsApp versenden',
  /** Keine Abonnentin mit WhatsApp (Register N9): der Leerzustand der Seite; der Ausweg führt zurück in den Reiter „Beiträge“. */
  leer: {
    titel: 'Noch keine Abonnentin mit WhatsApp',
    satz: 'Hier steht jede Kundin, die deine Beiträge per WhatsApp bekommen möchte.',
    aktion: 'Zu den Beiträgen',
  },
} as const

/** Eine heutige Abonnentin mit WhatsApp-Häkchen und Nummer; `id` ist die Abonnements-ID. */
export type Abonnentin = { id: string; name: string; phone: string }

export type VersandPerson = Abonnentin & { geoeffnet: boolean }

export type VersandStand = {
  personen: VersandPerson[]
  geoeffnet: number
  gesamt: number
  /** Alle heutigen Abonnentinnen geöffnet (ohne Abonnentinnen nie). */
  fertig: boolean
}

/**
 * Je Person, ob sie geöffnet ist, und der Zähler daraus. Gezählt wird nur,
 * wer heute abonniert ist: Eine gespeicherte Kennung von jemandem, der sich
 * inzwischen abgemeldet hat, zählt nicht — so steht nie „4 von 3".
 */
export function versandStand(abonnentinnen: readonly Abonnentin[], getippt: readonly string[]): VersandStand {
  const angetippt = new Set(getippt)
  const personen = abonnentinnen.map((a) => ({ ...a, geoeffnet: angetippt.has(a.id) }))
  const geoeffnet = personen.filter((p) => p.geoeffnet).length
  return { personen, geoeffnet, gesamt: personen.length, fertig: personen.length > 0 && geoeffnet === personen.length }
}

/** Wer zuletzt „Tippen" bekam und ob die Seite seither verlassen wurde (WhatsApp vorn bzw. neuer Tab). */
export type Rueckkehr = { id: string; verlassen: boolean } | null

/**
 * Die Seite meldet „verlassen" (unsichtbar oder ohne Fokus) und „zurueck"
 * (sichtbar oder mit Fokus). Geöffnet ist eine Person erst, wenn die Seite
 * nach ihrem Tipp verlassen wurde und wieder da ist — am Handy die Rückkehr
 * aus WhatsApp, am Desktop das Zurückwechseln aus dem wa.me-Tab. Ein Tipp,
 * der nichts geöffnet hat, zählt so nicht; gespeichert wird genau einmal.
 */
export function nachSeitenEreignis(
  stand: Rueckkehr,
  ereignis: 'verlassen' | 'zurueck'
): { stand: Rueckkehr; speichern: string | null } {
  if (!stand) return { stand: null, speichern: null }
  if (ereignis === 'verlassen') return { stand: { id: stand.id, verlassen: true }, speichern: null }
  return stand.verlassen ? { stand: null, speichern: stand.id } : { stand, speichern: null }
}
