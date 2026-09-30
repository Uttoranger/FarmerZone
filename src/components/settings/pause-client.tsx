'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { PauseCircle, PlayCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { setPause } from '@/server/actions/farm'

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
      {/* Status card */}
      <div className={`rounded-xl border p-4 ${isPaused ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40' : 'border-green-200 dark:border-green-900/60 bg-primary/8'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isPaused ? (
              <PauseCircle className="size-6 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <PlayCircle className="size-6 text-primary shrink-0" />
            )}
            <div>
              <p className={`font-semibold ${isPaused ? 'text-amber-800 dark:text-amber-200' : 'text-green-800 dark:text-green-200'}`}>
                {isPaused ? 'Bestellungen sind pausiert' : 'Du nimmst Bestellungen an'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPaused
                  ? 'Deine Hofseite bleibt sichtbar, mit deiner Nachricht. Bestellen kann gerade niemand.'
                  : 'Kunden können Produkte sehen und bestellen.'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleToggle}
            disabled={isPending}
            className={`shrink-0 ${
              isPaused
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPaused ? (
              'Bestellungen annehmen'
            ) : (
              'Bestellungen pausieren'
            )}
          </Button>
        </div>
      </div>

      {/* Pause message */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
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
          className="w-full"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Nachricht speichern'}
        </Button>
      </div>
    </div>
  )
}

