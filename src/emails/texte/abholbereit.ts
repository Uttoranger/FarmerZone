/**
 * Die Sätze der Abholbereit-Mail (src/emails/pickup-reminder.tsx) an EINER Stelle (Nr. 255, DESIGN_SYSTEM
 * „E-Mails“). Der Link „Vertrag widerrufen“ bleibt in src/lib/widerruf.ts (N39) — hier steht er nicht.
 */
export const ABHOLBEREIT_TEXT = {
  titel: 'Deine Bestellung liegt bereit',
  vorschauzeile: (hof: string) => `Deine Bestellung bei ${hof} liegt bereit`,
  knopfRoute: 'Route planen',
  knopfBestellung: 'Bestellung ansehen',
  schaffstDuNicht: 'Du schaffst es nicht? Gib dem Hof kurz Bescheid:',
  /** Ein Textknoten: Die Textfassung der Mail schriebe sonst „Anrufen ( +43 … )“. */
  anrufen: (nummer: string) => `Anrufen (${nummer})`,
} as const
