import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Das Schild eines Futters (Register E9, Ergänzung 20.10.2026, Nr. 123):
 * „Futtermittelbetrieb · LFBIS <Nummer> · laut Hof" in neutraler Farbe —
 * Rahmen, leise Schrift, ein Schild-Symbol OHNE Haken. Ein Haken läse sich
 * wie „geprüft"; die Plattform prüft die Nummer nicht, der Hof gibt sie
 * selbst an. EIN Baustein für Futter kaufen, Produktseite und die Vorschau im
 * Futter-Formular; den Wortlaut liefert `futterSchild` (src/lib/produktdetail.ts).
 */
export function FutterSchild({ text, className }: { text: string; className?: string }): React.JSX.Element {
  return (
    <p
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-border px-2.5 py-1 text-[12px] leading-snug text-muted-foreground',
        className
      )}
    >
      <Shield className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
      <span className="min-w-0 break-words">{text}</span>
    </p>
  )
}
