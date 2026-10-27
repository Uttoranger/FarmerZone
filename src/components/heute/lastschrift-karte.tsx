'use client'

import { useState, useTransition } from 'react'
import { Landmark } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_ORANGE } from '@/components/hof-bestellungen/stil'
import { LASTSCHRIFT_TEXT } from '@/lib/konditionen'
import { oeffneRechnung } from '@/server/actions/lastschrift'

/**
 * Hof › Heute: Barzahlung pausiert, weil die Plattformgebühr eines Monats
 * offen oder zurückgebucht ist (Register N38, Nr. 198). „Jetzt bezahlen“
 * öffnet die gehostete Rechnung von Stripe — die Adresse holt der Server erst
 * beim Klick. Nach `invoice.paid` verschwindet die Karte von selbst.
 */
export function LastschriftSperreKarte({ abrechnungId, monatText }: { abrechnungId: string; monatText: string }): React.JSX.Element {
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  return (
    <Hinweiskarte
      ton="orange"
      symbol={Landmark}
      titel={LASTSCHRIFT_TEXT.heuteTitel}
      aktion={
        <button
          type="button"
          className={KNOPF_ORANGE}
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
      <p className="text-[12.5px]">{LASTSCHRIFT_TEXT.heuteSatz(monatText)}</p>
      {fehler && (
        <p role="alert" className="mt-1 text-[12.5px]">
          {fehler}
        </p>
      )}
    </Hinweiskarte>
  )
}
