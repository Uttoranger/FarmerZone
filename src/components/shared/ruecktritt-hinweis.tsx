import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ruecktrittHinweise, type RuecktrittAngabe } from '@/lib/ruecktritt-angaben'

/**
 * Die Angaben des Hofs zum Rücktritt unter dem Produktnamen (Nr. 214,
 * N39-Ergänzung): „Kein Rücktritt: verdirbt schnell“ und „Rücksendung
 * geschätzt ca. € …“ — EIN Baustein für Produktseite, Kasse und die
 * Produktliste des Hofs. Ohne Angabe steht nichts. Ruhiger Hinweis in
 * normaler Nebenschrift mit leisem Symbol: Er bewertet nichts, und die App
 * entscheidet nichts (der Hof prüft im Einzelfall). Ob er bei „Betrieb“
 * entfällt, entscheidet der Aufrufer.
 */
export function RuecktrittHinweis({ angabe, className }: { angabe: RuecktrittAngabe; className?: string }): React.JSX.Element | null {
  const hinweise = ruecktrittHinweise(angabe)
  if (hinweise.length === 0) return null
  return (
    <ul data-ruecktritt-hinweis="" className={cn('flex flex-col gap-0.5 text-[12.5px] leading-snug text-muted-foreground', className)}>
      {hinweise.map((h) => (
        <li key={h} className="flex items-start gap-1.5">
          <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          <span className="min-w-0 break-words">{h}</span>
        </li>
      ))}
    </ul>
  )
}
