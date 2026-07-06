'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { PauseCircle, PlayCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { setPause } from '@/server/actions/farm'

export function PauseClient({
  initialPaused,
  initialMessage,
}: {
  initialPaused: boolean
  initialMessage: string | null
}) {
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
        toast.success(newPaused ? 'Shop pausiert' : 'Shop wieder aktiv')
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
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className={`rounded-xl border p-4 ${isPaused ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-primary/8'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isPaused ? (
              <PauseCircle className="size-6 text-amber-600 shrink-0" />
            ) : (
              <PlayCircle className="size-6 text-primary shrink-0" />
            )}
            <div>
              <p className={`font-semibold ${isPaused ? 'text-amber-800' : 'text-green-800'}`}>
                {isPaused ? 'Shop ist pausiert' : 'Shop ist aktiv'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPaused
                  ? 'Kunden sehen eine Pause-Meldung statt deiner Produkte.'
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
              'Shop aktivieren'
            ) : (
              'Shop pausieren'
            )}
          </Button>
        </div>
      </div>

      {/* Pause message */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-3">
        <Label htmlFor="pauseMessage" className="font-medium text-foreground block">
          Nachricht für Kunden (optional)
        </Label>
        <p className="text-xs text-muted-foreground">
          Wird angezeigt, wenn der Shop pausiert ist — z.B. "Ich bin im Urlaub vom 1.–14. Juli."
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

