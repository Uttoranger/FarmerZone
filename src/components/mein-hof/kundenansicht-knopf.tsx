'use client'

import { ArrowUpRight, Eye } from 'lucide-react'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import { MEIN_HOF_ANSICHT_TEXT } from '@/lib/mein-hof-ansicht'
import { useMeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'

/*
 * „Kundenansicht" im Kopf von Mein Hof unter lg (Nachtlauf Nr. 49, Register
 * N4; seit Nr. 107 als Vollbild, N4 ergänzt): öffnet die echte Hofseite als
 * Vollbild-Blatt über Mein Hof (kundenansicht-vollbild.tsx) — kein neuer Tab,
 * eine Leiste auf dem Schirm. Ab lg öffnet der Kopf die Vorschau weiter in
 * einem neuen Tab (seitenkopf.tsx).
 *
 * Ohne Kundenansicht darum herum (der Kopf allein, etwa in einer Vorschau)
 * bleibt es der Link in einen neuen Tab — nie ein Knopf ohne Wirkung.
 */
export function KundenansichtKnopf({
  slug,
  className,
  nurSymbol = false,
}: {
  slug: string
  className: string
  /** Nur das Auge, das Wort für den Screenreader (Kopf am Handy, Board s1-mein-hof). */
  nurSymbol?: boolean
}): React.JSX.Element {
  const steuerung = useMeinHofAnsicht()

  if (!steuerung) {
    return (
      <a href={vorschauLink(slug)} target="_blank" rel="noopener noreferrer" className={className}>
        {nurSymbol ? (
          <>
            <Eye className="size-5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
            <span className="sr-only">{MEIN_HOF_ANSICHT_TEXT.kundenansicht}</span>
          </>
        ) : (
          <>
            {MEIN_HOF_ANSICHT_TEXT.kundenansicht}
            <ArrowUpRight className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          </>
        )}
        <span className="sr-only">{MEIN_HOF_ANSICHT_TEXT.neuerTabHinweis}</span>
      </a>
    )
  }

  return (
    <button type="button" onClick={() => steuerung.zeigeKundin(null)} className={className}>
      <Eye className={nurSymbol ? 'size-5 shrink-0' : 'size-4 shrink-0'} strokeWidth={1.7} aria-hidden="true" />
      {nurSymbol ? <span className="sr-only">{MEIN_HOF_ANSICHT_TEXT.kundenansicht}</span> : MEIN_HOF_ANSICHT_TEXT.kundenansicht}
    </button>
  )
}
