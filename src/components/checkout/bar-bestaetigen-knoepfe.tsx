'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import {
  bestaetigeBarBestellung,
  storniereBarBestellung,
  type BarAktionStand,
} from '@/server/actions/bar-bestaetigung'

/**
 * Die zwei Knöpfe der Bar-Bestätigung (Mockup
 * web-k3-bar-bestellung-bestaetigen-link-aus-mail.html). Echte Formulare mit
 * Server Action (POST): Sie funktionieren auch, bevor JavaScript geladen ist
 * — wer aus dem Mailprogramm kommt, tippt oft sofort. Was passiert, entscheidet
 * der Server; hier gibt es nur „läuft gerade" und den Fehlersatz.
 */
export function BarBestaetigenKnoepfe({ token }: { token: string }) {
  const [bestaetigt, bestaetigen, bestaetigtLaeuft] = useActionState<BarAktionStand, FormData>(
    bestaetigeBarBestellung,
    {}
  )
  const [storniert, stornieren, storniertLaeuft] = useActionState<BarAktionStand, FormData>(
    storniereBarBestellung,
    {}
  )
  const laeuft = bestaetigtLaeuft || storniertLaeuft
  const fehler = bestaetigt.error ?? storniert.error

  return (
    <div className="flex flex-col gap-[18px]">
      <form action={bestaetigen}>
        <input type="hidden" name="token" value={token} />
        <Button
          type="submit"
          disabled={laeuft}
          className="h-[54px] w-full rounded-full bg-accent px-[18px] text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          {bestaetigtLaeuft ? 'Wird bestätigt …' : 'Ja, ich hole verbindlich ab'}
        </Button>
      </form>

      {fehler && (
        <p role="alert" className="text-center text-sm text-status-offen">
          {fehler}
        </p>
      )}

      <form action={stornieren} className="flex justify-center">
        <input type="hidden" name="token" value={token} />
        <Button
          type="submit"
          variant="ghost"
          disabled={laeuft}
          className="h-11 rounded-full px-[18px] text-sm font-semibold text-status-offen hover:text-status-offen"
        >
          {storniertLaeuft ? 'Wird storniert …' : 'Doch nicht – Bestellung stornieren'}
        </Button>
      </form>
    </div>
  )
}
