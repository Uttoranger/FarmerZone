'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { PFLICHT_KNOPF, PflichtKarte } from '@/components/heute/pflicht-karte'
import { LASTSCHRIFT_TEXT } from '@/lib/konditionen'
import { POSTFACH_HREF } from '@/lib/postfach'
import { oeffneRechnung } from '@/server/actions/lastschrift'

/**
 * Hof › Heute: Barzahlung gesperrt („Bar gesperrt“), weil die Plattformgebühr eines Monats
 * offen oder zurückgebucht ist (Register N38, Nr. 198). „Jetzt bezahlen“
 * öffnet die gehostete Rechnung von Stripe — die Adresse holt der Server erst
 * beim Klick. Nach `invoice.paid` verschwindet die Karte von selbst.
 *
 * Zurückgebucht: Die Rechnung bar ist bei Stripe schon bezahlt, „Jetzt bezahlen“
 * auf sie liefe ins Leere. Dann der Satz ohne Fachbegriff und der Weg ins
 * Postfach — dort liegt seit Nr. 290 dieselbe Nachricht, und die Nachforderung
 * über den Betrag steht unter Deine Konditionen („Jetzt bezahlen“). Bezahlt der
 * Hof sie, ist er von selbst frei; sonst hebt das Team die Sperre auf (Notweg).
 */
export function LastschriftSperreKarte({
  abrechnungId,
  monatText,
  stand,
}: {
  abrechnungId: string
  monatText: string
  stand: 'offen' | 'gescheitert' | 'zurueckgebucht'
}): React.JSX.Element {
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  if (stand === 'zurueckgebucht') {
    return (
      <PflichtKarte
        titel={LASTSCHRIFT_TEXT.heuteTitel}
        knoepfe={
          <Link href={POSTFACH_HREF} className={PFLICHT_KNOPF}>
            {LASTSCHRIFT_TEXT.zumPostfach}
          </Link>
        }
      >
        <p>{LASTSCHRIFT_TEXT.zurueckgebuchtSatz(monatText)}</p>
      </PflichtKarte>
    )
  }
  return (
    <PflichtKarte
      titel={LASTSCHRIFT_TEXT.heuteTitel}
      knoepfe={
        <button
          type="button"
          className={PFLICHT_KNOPF}
          disabled={laeuft}
          aria-busy={laeuft || undefined}
          onClick={() =>
            starte(async () => {
              setFehler(null)
              const antwort = await oeffneRechnung({ abrechnungId, art: 'bar', ziel: 'bezahlen' })
              if ('error' in antwort) setFehler(antwort.error)
              else window.location.assign(antwort.url)
            })
          }
        >
          {LASTSCHRIFT_TEXT.bezahlen}
        </button>
      }
    >
      <p>{LASTSCHRIFT_TEXT.heuteSatz(monatText)}</p>
      {fehler && (
        <p role="alert" className="mt-1 font-semibold">
          {fehler}
        </p>
      )}
    </PflichtKarte>
  )
}
