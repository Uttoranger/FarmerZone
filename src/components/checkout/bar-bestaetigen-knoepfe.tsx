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
    // Board s1-/w1-bestellung-link Bild 2: am Handy der grüne Knopf über die volle Breite, darunter leise das
    // Stornieren; im Browser unter einer Linie rechts bündig — Stornieren links neben dem Knopf.
    <div className="flex flex-col gap-1 md:flex-row-reverse md:items-center md:justify-start md:gap-4 md:border-t md:border-border md:pt-4">
      <form action={bestaetigen} className="md:shrink-0">
        <input type="hidden" name="token" value={token} />
        <Button
          type="submit"
          disabled={laeuft}
          className="h-[52px] w-full rounded-[14px] bg-accent px-[18px] text-base font-semibold text-accent-foreground hover:bg-accent-hover md:w-auto md:rounded-full md:px-5"
        >
          {bestaetigtLaeuft ? 'Wird bestätigt …' : 'Ja, ich hole verbindlich ab'}
        </Button>
      </form>

      {fehler && (
        <p role="alert" className="text-center text-sm text-status-offen md:order-last md:mr-auto md:text-left">
          {fehler}
        </p>
      )}

      <form action={stornieren} className="flex justify-center">
        <input type="hidden" name="token" value={token} />
        <Button
          type="submit"
          variant="ghost"
          disabled={laeuft}
          className="h-11 rounded-full px-[18px] text-[15px] font-semibold text-foreground"
        >
          {storniertLaeuft ? 'Wird storniert …' : 'Doch nicht – Bestellung stornieren'}
        </Button>
      </form>
    </div>
  )
}
