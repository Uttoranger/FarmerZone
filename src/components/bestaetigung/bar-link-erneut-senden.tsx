'use client'

import { useActionState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KNOPF_BREIT_RAHMEN } from '@/components/bestaetigung/bestaetigung-stil'
import { sendeBarLinkErneut, type BarLinkErneutStand } from '@/server/actions/bar-bestaetigung'

/**
 * „Mail nicht bekommen? Erneut senden" auf der Bestätigungsseite einer offenen
 * Barbestellung (Register S17 Punkt 2, Nr. 151). Ein Textknopf: Die Seite hat
 * ihre Hauptaktion schon, und die Kundin braucht ihn nur, wenn die Mail fehlt.
 *
 * Ein echtes Formular mit Server Action (POST) wie `BarBestaetigenKnoepfe` —
 * es geht auch, bevor JavaScript geladen ist. Mitgeschickt werden nur
 * Kennung und Signatur, die ohnehin in der Adresse der Seite stehen; an
 * welche Adresse die Mail geht, entscheidet der Server aus der Bestellung.
 * Die Antwort ist immer derselbe Satz.
 */
export function BarLinkErneutSenden({ orderId, sig }: { orderId: string; sig: string }) {
  const [stand, senden, laeuft] = useActionState<BarLinkErneutStand, FormData>(sendeBarLinkErneut, {})

  return (
    <form action={senden} className="flex flex-col gap-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="sig" value={sig} />
      <button
        type="submit"
        aria-busy={laeuft}
        // Nicht `disabled` während der Anfrage: Ein deaktivierter Knopf gibt den Fokus an den Seitenanfang ab.
        // Board s1-/w1-bestaetigung Bild 3: der Knopf mit Rand über die volle Breite, in der Karte mit der Frist.
        className={cn(KNOPF_BREIT_RAHMEN, 'mt-1 px-3 text-[15px] aria-busy:opacity-60')}
      >
        {laeuft && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {laeuft ? 'Wird gesendet …' : 'Mail nicht bekommen? Erneut senden'}
      </button>
      {/* Dauerhaft im Baum: Eine Live-Region, die erst mit ihrem Text entsteht, sprechen manche Vorleseprogramme nicht. */}
      <p
        role="status"
        className={stand.antwort ? 'flex items-start gap-2 text-[13px] leading-normal' : 'sr-only'}
      >
        {stand.antwort && (
          <>
            <MailCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
            <span>{stand.antwort}</span>
          </>
        )}
      </p>
    </form>
  )
}
