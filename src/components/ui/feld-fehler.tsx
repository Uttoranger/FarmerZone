import type { ReactNode } from 'react'
import { fehlerKennung, feldFehlerAttribute, hilfeKennung } from '@/components/shared/formular-meldungen'
import { cn } from '@/lib/utils'

/**
 * Der orange Rand eines Felds mit Fehler (V17; Board s1-produkt-neu Bild 5): 2 px in
 * `--fz-status-offen`, gesetzt über `aria-invalid` — der Zustand, den der Screenreader liest, ist
 * derselbe, den man sieht. Für Input, Textarea und SelectTrigger: Der Rand ersetzt das Rot der
 * Grundbausteine (aria-invalid:border-destructive), weil Feldfehler im neuen Design orange stehen
 * (Register O1: Seiten, die Fehler orange zeigen, bleiben so). Den Fokusring behält das Feld.
 */
export const FELD_FEHLER_RAHMEN =
  'aria-invalid:border-2 aria-invalid:border-status-offen aria-invalid:ring-0 dark:aria-invalid:ring-0 aria-invalid:focus-visible:ring-2 aria-invalid:focus-visible:ring-ring'

/** Was ein Eingabefeld von FeldMitFehler bekommt: Kennung, Verbindung zu Fehler und Hilfe, Klassen. */
export type FeldVerbindung = {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
  className: string
}

/**
 * Ein Feld mit Beschriftung, Hilfe und Feldfehler (V17; Board s1-produkt-neu, Bild 5): die
 * Beschriftung 15 px halbfett, darunter das Feld, darunter der Fehlersatz orange (14 px, halbfett,
 * `role="alert"`) — oder, ohne Fehler, die Hilfe leise. Das Feld bekommt `aria-invalid` und
 * `aria-describedby` über feldFehlerAttribute (Nr. 174, WCAG 3.3.1) und den orangen Rand
 * (FELD_FEHLER_RAHMEN); das Feld selbst zeichnet der Aufrufer (`children` als Funktion), damit
 * Input, Textarea oder DezimalFeld gleich gehen. Welcher Satz erscheint, entscheidet das Schema
 * (src/schemas, tests/fehlertext-wache.test.ts), nie der Baustein.
 */
export function FeldMitFehler({
  id,
  label,
  fehler,
  hilfe,
  className,
  children,
}: {
  id: string
  label: ReactNode
  /** Der Satz, was passiert ist und was die Person tun kann; leer = kein Fehler. */
  fehler?: string | null
  hilfe?: ReactNode
  className?: string
  children: (feld: FeldVerbindung) => ReactNode
}): React.JSX.Element {
  const hatFehler = Boolean(fehler)
  const verbindung = feldFehlerAttribute(id, hatFehler, !hatFehler && Boolean(hilfe))
  return (
    <div data-slot="feld" data-fehler={hatFehler ? 'ja' : undefined} className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[15px] font-semibold text-foreground">
        {label}
      </label>
      {children({ id, ...verbindung, className: FELD_FEHLER_RAHMEN })}
      {hatFehler ? (
        <p id={fehlerKennung(id)} role="alert" className="text-[14px] leading-snug font-semibold text-status-offen">
          {fehler}
        </p>
      ) : (
        hilfe && (
          <p id={hilfeKennung(id)} className="text-[13px] leading-snug text-muted-foreground">
            {hilfe}
          </p>
        )
      )}
    </div>
  )
}
