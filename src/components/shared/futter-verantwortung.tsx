import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Der Verantwortungs-Hinweis für Kundinnen bei Futter (Register E10a,
 * Nachtlauf Nr. 23): Produktseite unter den Größenkacheln, Warenkorb und
 * Mini-Warenkorb. Welche Sätze erscheinen, entscheidet futterVerantwortung
 * bzw. futterVerantwortungImKorb (src/lib/futter-registrierung.ts) — hier wird
 * nur angezeigt. Leise Schrift, kein Kasten: ein Hinweis, keine Warnung.
 */
export function FutterVerantwortung({ saetze, className }: { saetze: readonly string[]; className?: string }): React.JSX.Element | null {
  if (saetze.length === 0) return null
  return (
    <div className={cn('flex gap-2 text-xs leading-snug text-muted-foreground', className)}>
      <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      <p className="min-w-0 break-words">{saetze.join(' ')}</p>
    </div>
  )
}
