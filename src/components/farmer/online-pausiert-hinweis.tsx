'use client'

import { useState, type ReactElement } from 'react'
import { CirclePause, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createOnboardingLink } from '@/server/actions/stripe-connect'
import { onlinePausiertText } from '@/lib/stripe-konto'

/**
 * Hinweis auf Heute: Der Hof will online kassieren und hat ein Stripe-Konto,
 * aber Stripe braucht noch Angaben (oder hat das Konto gesperrt,
 * account.updated). Der Knopf führt über einen Account Link direkt in Stripes
 * Formular — derselbe Weg wie in den Zahlungs-Einstellungen.
 */
export function OnlinePausiertHinweis({ barMoeglich }: { barMoeglich: boolean }): ReactElement {
  const [laedt, setLaedt] = useState(false)

  async function zuStripe() {
    setLaedt(true)
    try {
      const link = await createOnboardingLink()
      if (link.error || !link.url) throw new Error(link.error ?? 'Kein Link')
      window.location.href = link.url
    } catch {
      toast.error('Stripe ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.')
      setLaedt(false)
    }
  }

  return (
    <div role="status" className="mb-6 flex gap-3 rounded-xl border border-border bg-card p-4">
      <CirclePause className="mt-0.5 size-5 shrink-0 text-status-offen" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{onlinePausiertText(barMoeglich)}</p>
        <Button size="sm" onClick={zuStripe} disabled={laedt} className="mt-3">
          {laedt ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
          Bei Stripe ergänzen
        </Button>
      </div>
    </div>
  )
}
