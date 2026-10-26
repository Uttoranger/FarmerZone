import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { NETZ_KNOPF } from '@/lib/netz'
import { cn } from '@/lib/utils'

/** Die Kennung des Satzes unter einem Feld – Feld und Satz verbindet `aria-describedby`. */
export function fehlerKennung(feldId: string): string {
  return `${feldId}-fehler`
}

/** Die Kennung der Hilfe unter einem Feld. */
export function hilfeKennung(feldId: string): string {
  return `${feldId}-hilfe`
}

/**
 * Die Attribute, die ein Feld mit seinem Fehlersatz verbinden (Nr. 174, WCAG
 * 3.3.1): `aria-invalid` und `aria-describedby` auf Fehler und – wenn da – Hilfe.
 */
export function feldFehlerAttribute(
  feldId: string,
  hatFehler: boolean,
  hatHilfe = false
): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  const ids = [hatFehler ? fehlerKennung(feldId) : null, hatHilfe ? hilfeKennung(feldId) : null].filter(Boolean)
  return {
    ...(hatFehler ? { 'aria-invalid': true as const } : {}),
    ...(ids.length > 0 ? { 'aria-describedby': ids.join(' ') } : {}),
  }
}

/**
 * Der Fehlersatz unter einem Feld: orange (Register O1), `role="alert"`, damit
 * ihn der Screenreader beim Erscheinen vorliest. Ohne Text nichts.
 */
export function FeldFehlerSatz({ feldId, text, className }: { feldId: string; text?: string | null; className?: string }): React.JSX.Element | null {
  if (!text) return null
  return (
    <p id={fehlerKennung(feldId)} role="alert" className={cn('mt-1 text-xs font-medium text-status-offen', className)}>
      {text}
    </p>
  )
}

/**
 * Ein Speicherfehler, der kein Feld betrifft: die orange Hinweiskarte am
 * Formular statt eines Toasts (DESIGN_SYSTEM, „Zustände"). Scheiterte der
 * Aufruf am Netz (`nochmal`), steht der Knopf „Nochmal" daneben (Register N29)
 * – die Eingabe bleibt stehen, ein Tipp wiederholt das Speichern.
 */
export function SpeicherFehler({
  text,
  nochmal,
  onNochmal,
  laeuft,
  className,
}: {
  text: string | null | undefined
  nochmal?: boolean
  onNochmal?: () => void
  laeuft?: boolean
  className?: string
}): React.JSX.Element | null {
  if (!text) return null
  return (
    <div role="alert">
      <Hinweiskarte
        ton="orange"
        className={className}
        aktion={
          nochmal && onNochmal ? (
            <button type="button" onClick={onNochmal} disabled={laeuft} className={KNOPF_RAHMEN}>
              {NETZ_KNOPF}
            </button>
          ) : undefined
        }
      >
        {text}
      </Hinweiskarte>
    </div>
  )
}
