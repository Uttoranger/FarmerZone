import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Der grün getönte Kasten für ein erledigtes Ergebnis (Boards s2-/w2-passwort Bild 2
 * „Schau in deine E-Mails“, s3-/w3-widerruf Bild 4): Fläche und Schrift aus dem Paar „läuft“
 * (`bg-zustand-laeuft-grund`, `text-zustand-laeuft`, ≥ 4,5:1 in beiden Themes,
 * tests/design-tokens.test.ts), links bündig, oben ein grün gefüllter Kreis mit Haken, darunter
 * der Titel in Fraunces und der Inhalt. Das Gegenstück für Fehler ist `HinweiskarteFehler`
 * (ui/hinweiskarte.tsx). Liegt in components/anmelden, weil ui/ nicht zur Nr. 239 gehört;
 * der Bedarf für ui/ steht im Bericht 239.
 */
export function ErfolgKasten({
  titel,
  titelStufe = 2,
  children,
  className,
}: {
  titel: ReactNode
  /** h1, wenn der Kasten die Seite trägt (Bestätigung ohne eigenen Kopf); sonst h2. */
  titelStufe?: 1 | 2
  children?: ReactNode
  className?: string
}): React.JSX.Element {
  const Titel = titelStufe === 1 ? 'h1' : 'h2'
  return (
    <div
      data-slot="erfolg-kasten"
      className={cn(
        'flex flex-col items-start gap-2 rounded-2xl border border-zustand-laeuft/30 bg-zustand-laeuft-grund px-4 py-4 text-[15px] leading-normal text-zustand-laeuft',
        className
      )}
    >
      <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Check className="size-5" strokeWidth={2.4} />
      </span>
      <Titel className="font-heading text-[22px] leading-tight font-semibold text-foreground">{titel}</Titel>
      {children}
    </div>
  )
}
