'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { PauseCircle, PlayCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { setPause } from '@/server/actions/farm'
import { KNOPF_GRUEN, KNOPF_ORANGE_RAHMEN } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'

/**
 * Pause — unter /settings/pause und im Hofseiten-Editor ab lg
 * (components/farmer/hofseite-editor.tsx), der über `onGespeichert` nach
 * jeder Änderung seine Vorschau neu lädt.
 */
export function PauseClient({
  initialPaused,
  initialMessage,
  onGespeichert,
}: {
  initialPaused: boolean
  initialMessage: string | null
  onGespeichert?: () => void
}): React.JSX.Element {
  const [isPaused, setIsPaused] = useState(initialPaused)
  const [message, setMessage] = useState(initialMessage ?? '')
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const newPaused = !isPaused
    startTransition(async () => {
      const res = await setPause(newPaused, message)
      if (res.error) {
        toast.error(res.error)
      } else {
        setIsPaused(newPaused)
        toast.success(newPaused ? 'Bestellungen pausiert' : 'Du nimmst wieder Bestellungen an')
        onGespeichert?.()
      }
    })
  }

  function handleSaveMessage() {
    startTransition(async () => {
      const res = await setPause(isPaused, message)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Nachricht gespeichert')
        onGespeichert?.()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Status: Orange = pausiert (offen, braucht dich), Grün = nimmt an (Farbrollen). */}
      <div className={cn('rounded-2xl border p-4', isPaused ? 'border-primary/45 bg-primary/12' : 'border-accent/45 bg-accent/12')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3">
            {isPaused ? (
              <PauseCircle className="size-6 shrink-0 text-status-offen" strokeWidth={1.7} aria-hidden="true" />
            ) : (
              <PlayCircle className="size-6 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
            )}
            <div>
              <p className="font-semibold text-foreground">
                {isPaused ? 'Bestellungen sind pausiert' : 'Du nimmst Bestellungen an'}
              </p>
              {/* Normale Textfarbe auf der Tönung — leise Schrift fiele am Tag unter 4,5:1 (wie Hinweiskarte). */}
              <p className="text-sm text-foreground">
                {isPaused
                  ? 'Deine Hofseite bleibt sichtbar, mit deiner Nachricht. Bestellen kann gerade niemand.'
                  : 'Kunden können Produkte sehen und bestellen.'}
              </p>
            </div>
          </div>
          {/* Wieder annehmen ist die gute Aktion (Grün); pausieren nimmt etwas weg (Orange-Umriss). */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={isPaused ? KNOPF_GRUEN : KNOPF_ORANGE_RAHMEN}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="sr-only">Einen Moment …</span>
              </>
            ) : isPaused ? (
              'Bestellungen annehmen'
            ) : (
              'Bestellungen pausieren'
            )}
          </button>
        </div>
      </div>

      {/* Pause message */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <Label htmlFor="pauseMessage" className="font-medium text-foreground block">
          Nachricht für Kunden (optional)
        </Label>
        <p className="text-xs text-muted-foreground">
          Steht auf deiner Hofseite, solange Bestellungen pausiert sind — z. B. „Ich bin im Urlaub vom 1.–14. Juli.“
        </p>
        <Textarea
          id="pauseMessage"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Ich bin im Urlaub bis ..."
        />
        <Button
          onClick={handleSaveMessage}
          disabled={isPending}
          variant="outline"
          className="min-h-11 w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span className="sr-only">Einen Moment …</span>
            </>
          ) : (
            'Nachricht speichern'
          )}
        </Button>
      </div>
    </div>
  )
}

