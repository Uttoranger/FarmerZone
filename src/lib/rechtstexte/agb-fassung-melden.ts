import * as Sentry from '@sentry/nextjs'
import { agbFassungFuerBestellung, type AgbKennung } from '@/lib/rechtstexte/agb-fassung'

/**
 * Die Fassung der AGB einer Bestellung auf dem Server (N45): aus ihrem
 * Snapshot (gebuehrModell) über agbFassungFuerBestellung — und bei einem
 * unbekannten Wert eine Meldung an Sentry. Nur hier wird gemeldet (Mail-Bau,
 * Kassen-Seite bei „Erneut bezahlen“, beide auf dem Server); agb-fassung.ts
 * bleibt rein und auch im Browser importierbar. Gemeldet werden nur der Wert des Modells und die
 * Bestell-ID, keine Personendaten. Nie ein Wurf: Mail und Kasse dürfen daran
 * nicht scheitern, der Ersatz ist 0.9.
 */
export function agbFassungMitMeldung(bestellung: { id: string; gebuehrModell?: string | null }): AgbKennung {
  const { fassung, unbekannt } = agbFassungFuerBestellung({ gebuehrModell: bestellung.gebuehrModell })
  if (unbekannt) {
    Sentry.captureMessage('Unbekanntes Gebührenmodell für die AGB-Fassung', {
      tags: { bereich: 'agb-fassung' },
      extra: { gebuehrModell: bestellung.gebuehrModell, orderId: bestellung.id },
    })
  }
  return fassung
}
