/**
 * Die Sätze der Mail „Bestellung verfallen“ (src/emails/bestellung-verfallen.tsx) an EINER Stelle (Nr. 255,
 * DESIGN_SYSTEM „E-Mails“).
 */
export const VERFALLEN_TEXT = {
  titel: 'Bestellung verfallen',
  vorschauzeile: 'Dir entstehen keine Kosten.',
  /** `bis` ist die verstrichene Frist („Mittwoch, 3. März, 09:40 Uhr“); ohne sie „nicht rechtzeitig“. */
  satz: (hof: string, bis?: string) =>
    `Du hast deine Bestellung bei ${hof} ${bis ? `nicht bis ${bis}` : 'nicht rechtzeitig'} bestätigt. Deshalb haben wir die Ware wieder freigegeben – dir entstehen keine Kosten.`,
} as const
