import { formatEuro } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import type { ErstattungOffenFall } from '@/schemas/mail-auftrag'

/*
 * „Erstattung offen" (Nr. 19c, Register N14): was passiert ist und was der
 * Betreiber von Hand tun muss — je Fall EIN Satz und EINE Anweisung. Seit
 * Nr. 159 geht die Mail über die Warteschlange; dort steht nur der Fall und
 * die Beträge in Cent, nie Text (N26). Sentry (Storno in cancelOrder, Webhook
 * bei gescheiterter Erstattung) und der Renderer der Mail lesen dieselben
 * Sätze von hier.
 */

export type ErstattungOffenInhalt = {
  /** Was passiert ist — ein Satz. */
  was: string
  /** Was von Hand zu tun ist — dieselbe Anweisung wie an Sentry. */
  handanweisung: string
  betraege: Array<{ label: string; cents: number }>
}

/** Beim Storno durch den Hof: Die Bestellung ist storniert, die Erstattung über Stripe nicht. */
const STORNO_WAS =
  'Der Hof hat die Bestellung storniert, die Erstattung über Stripe hat aber nicht geklappt. Die Bestellung ist storniert, das Geld steht noch aus.'

/**
 * Satz, Anweisung und Beträge eines Falls. `kundinCents` ist beim Webhook die
 * gescheiterte Erstattung, beim Storno der Betrag an die Kundin; `hofCents`
 * der Betrag, der vom Hof zurückgebucht wird. Fehlt ein Betrag, den der Fall
 * nennt, gilt 0 — die Aufrufer geben ihn immer mit.
 */
export function erstattungOffenInhalt(fall: ErstattungOffenFall, cents: { kundinCents?: number; hofCents?: number }): ErstattungOffenInhalt {
  const kundin = cents.kundinCents ?? 0
  const hof = cents.hofCents ?? 0
  const betrag = formatEuro(centsAlsEuro(kundin))
  const gescheitert = [{ label: 'Gescheiterte Erstattung', cents: kundin }]
  switch (fall) {
    case 'storno_rest':
      return {
        was: STORNO_WAS,
        handanweisung:
          'Teilerstattung, KEINE Vollerstattung: der Kundin den Rest über den Betrag erstatten (ohne reverse_transfer, ohne refund_application_fee) und vom Hof den Betrag per Rückbuchung der Überweisung holen. Vorher in Stripe prüfen, was davon schon gebucht ist.',
        betraege: [
          { label: 'An die Kundin erstatten', cents: kundin },
          { label: 'Vom Hof zurückbuchen', cents: hof },
        ],
      }
    case 'storno_rest_ohne_betraege':
      return {
        was: STORNO_WAS,
        handanweisung:
          'Teilerstattung, KEINE Vollerstattung: Beträge erst aus den Stripe-Buchungen bestimmen – Kundin = bezahlt laut Stripe − alle Teilerstattungen, Hof = Warenpreis der Bestellung − Provision − alle Teil-Rückbuchungen. Buchungen ohne Zuordnung und einen abweichenden bezahlten Betrag vorher klären.',
        betraege: [],
      }
    case 'storno_voll':
      return {
        was: STORNO_WAS,
        handanweisung: 'Überweisung zurückbuchen und Plattformgebühr erstatten',
        betraege: [
          { label: 'An die Kundin erstatten', cents: kundin },
          { label: 'Davon vom Hof (über die Rückbuchung der Überweisung)', cents: hof },
        ],
      }
    case 'storno_unbekannt':
      return {
        was: STORNO_WAS,
        handanweisung:
          'Stand bei Stripe unbekannt: erst prüfen, ob es zu dieser Zahlung schon Erstattungen gibt. Keine → Überweisung zurückbuchen und Plattformgebühr erstatten; sonst Teilerstattung mit festen Beträgen (Rest).',
        betraege: [],
      }
    case 'schon_erledigt':
      return {
        was: `Stripe meldet eine Erstattung über ${betrag} an die Kundin als gescheitert. Die App zählt sie nicht oder nicht mehr als erstattet – das Geld steht noch aus.`,
        handanweisung:
          'In Stripe prüfen, ob der Kundin der Betrag inzwischen auf anderem Weg erstattet wurde; sonst erneut erstatten – über Stripe ohne reverse_transfer und ohne refund_application_fee – und sie informieren.',
        betraege: gescheitert,
      }
    case 'vollstorno_zurueckgenommen':
      // Die Vollerstattung lief mit reverse_transfer und refund_application_fee
      // (Nr. 27: mit Merkmalen). Ob Stripe Rückbuchung und Gebührenerstattung
      // nach dem Scheitern stehen lässt, sagt das Ereignis nicht — deshalb
      // keine Anweisung, die das voraussetzt.
      return {
        was: `Stripe meldet die Vollerstattung über ${betrag} nach einem Storno als gescheitert. Die Bestellung bleibt storniert, in der App ist die Zahlung wieder offen – das Geld steht noch aus.`,
        handanweisung:
          'Vollerstattung gescheitert: In Stripe prüfen, was von der Rückbuchung der Überweisung und der Erstattung der Plattformgebühr noch steht, dann der Kundin den vollen Betrag erneut erstatten (reverse_transfer und refund_application_fee nur, wenn Überweisung und Gebühr wieder beim Hof liegen) und sie informieren.',
        betraege: gescheitert,
      }
    case 'zurueckgenommen':
      return {
        was: `Stripe meldet eine Erstattung über ${betrag} an die Kundin als gescheitert. Wir haben sie in der App zurückgenommen – das Geld steht noch aus.`,
        handanweisung:
          'Der Kundin den Betrag erneut erstatten – über Stripe ohne reverse_transfer und ohne refund_application_fee (die Rückbuchung vom Hof ist davon nicht betroffen) – und sie informieren. Die App zählt ihn nicht mehr als erstattet.',
        betraege: gescheitert,
      }
    case 'unklar':
      return {
        was: `Stripe meldet eine Erstattung über ${betrag} dieser Bestellung als gescheitert, aber Stripe und App passen nicht zusammen. In der App wurde nichts geändert.`,
        handanweisung: 'In Stripe prüfen, was zu dieser Zahlung wirklich erstattet ist, der Kundin den offenen Betrag von Hand erstatten und den Stand der Bestellung klären.',
        betraege: gescheitert,
      }
    case 'fremd':
      return {
        was: `Stripe meldet eine Erstattung über ${betrag} als gescheitert, die die App keiner ihrer Buchungen zuordnen kann (z. B. ein älterer Vollstorno ohne Merkmale oder eine Erstattung von Hand). In der App wurde nichts geändert.`,
        handanweisung:
          'In Stripe prüfen und der Kundin den Betrag von Hand erstatten. Ein älterer Vollstorno ohne Merkmale steht in der App weiter als erstattet.',
        betraege: gescheitert,
      }
  }
}
