'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * Kopiert die Adresse der Hofseite — der kleine Knopf neben der Adresse im
 * Kopf von Mein Hof. Nur die Zwischenablage, kein Teilen-Menü: Dafür steht
 * „Hof teilen" daneben. Das Häkchen bleibt zwei Sekunden, dann wieder das
 * Kopier-Symbol.
 */
export function AdresseKopierenKnopf({ url, className }: { url: string; className?: string }): React.JSX.Element {
  const [kopiert, setKopiert] = useState(false)

  async function kopiere() {
    try {
      await navigator.clipboard.writeText(url)
      setKopiert(true)
      toast.success('Adresse kopiert')
      setTimeout(() => setKopiert(false), 2000)
    } catch {
      toast.error('Die Adresse konnte nicht kopiert werden.')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void kopiere()}
      aria-label={kopiert ? 'Adresse kopiert' : 'Adresse kopieren'}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-app-ink-soft transition-colors hover:bg-muted/60 hover:text-app-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className
      )}
    >
      {kopiert ? (
        <Check className="size-4 text-green-700 dark:text-green-300" strokeWidth={2} aria-hidden="true" />
      ) : (
        <Copy className="size-4" strokeWidth={1.7} aria-hidden="true" />
      )}
    </button>
  )
}
