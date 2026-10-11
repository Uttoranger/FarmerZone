'use client'

import { ArrowUpRight, Eye } from 'lucide-react'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import { MEIN_HOF_ANSICHT_TEXT } from '@/lib/mein-hof-ansicht'
import { useMeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'

/*
 * „Kundenansicht" im Kopf von Mein Hof unter lg (Nachtlauf Nr. 49, Register
 * N4): schaltet den Umschalter auf „So sieht’s die Kundin" — die echte
 * Hofseite in der App, kein neuer Tab. Den neuen Tab bietet die Kundenansicht
 * selbst leise an („In neuem Tab öffnen"). Ab lg öffnet der Kopf die Vorschau
 * weiter in einem neuen Tab (seitenkopf.tsx).
 *
 * Ohne Umschalter darum herum (der Kopf allein, etwa in einer Vorschau)
 * bleibt es der Link in einen neuen Tab — nie ein Knopf ohne Wirkung.
 */
export function KundenansichtKnopf({ slug, className }: { slug: string; className: string }): React.JSX.Element {
  const steuerung = useMeinHofAnsicht()

  if (!steuerung) {
    return (
      <a href={vorschauLink(slug)} target="_blank" rel="noopener noreferrer" className={className}>
        {MEIN_HOF_ANSICHT_TEXT.kundenansicht}
        <ArrowUpRight className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
        <span className="sr-only">{MEIN_HOF_ANSICHT_TEXT.neuerTabHinweis}</span>
      </a>
    )
  }

  return (
    <button type="button" onClick={() => steuerung.zeigeKundin(null)} className={className}>
      <Eye className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      {MEIN_HOF_ANSICHT_TEXT.kundenansicht}
    </button>
  )
}
