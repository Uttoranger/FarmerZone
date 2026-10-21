'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { RotateCw } from 'lucide-react'
import { messeJetztAction } from '@/server/actions/betrieb'
import { istNetzfehler } from '@/lib/upload-diagnose'
import { cn } from '@/lib/utils'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'

/** Die Sätze kommen vom Server (BETRIEB_TEXT) — die Komponente bindet keine Fachregel ein. */
export type JetztMessenTexte = { knopf: string; misst: string; fehler: string }

/**
 * Der Knopf „Jetzt messen“ im Seitenkopf von Admin › Betrieb (Nr. 103). Der
 * Satz der Aktion steht danach als Statuszeile neben dem Knopf; die Seite holt
 * die neuen Zahlen über `router.refresh()`.
 *
 * Wirft die Anfrage (Netz weg, Aktion nach einem Deploy unbekannt), steht ein
 * fester Satz da statt der Fehlerseite — gemeldet wird dann nur die Klasse
 * unter einem festen Satz, ein Netzabbruch nur als Brotkrume (CODING_STANDARDS
 * §4, Vorbild `meldeGescheitertesSpeichern`).
 */
export function JetztMessen({ texte }: { texte: JetztMessenTexte }): React.JSX.Element {
  const router = useRouter()
  const [satz, setSatz] = useState<string | null>(null)
  const [misst, starte] = useTransition()

  const messen = (): void => {
    starte(async () => {
      try {
        const antwort = await messeJetztAction()
        setSatz('error' in antwort ? antwort.error : antwort.satz)
        router.refresh()
      } catch (fehler) {
        setSatz(texte.fehler)
        try {
          const klasse = fehler instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(fehler.name) ? fehler.name : 'Unbekannt'
          if (istNetzfehler(fehler)) {
            Sentry.addBreadcrumb({ category: 'betrieb', level: 'warning', message: 'Jetzt messen: Verbindung abgebrochen', data: { klasse } })
          } else {
            const ereignis = new Error('Betrieb: Jetzt messen gescheitert')
            ereignis.name = klasse
            Sentry.captureException(ereignis, { level: 'error', tags: { bereich: 'betrieb', klasse } })
          }
        } catch {
          // Telemetrie scheitert leise — der Satz steht trotzdem da.
        }
      }
    })
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      <p role="status" className="min-w-0 text-[12.5px] leading-snug text-muted-foreground empty:sr-only">
        {satz}
      </p>
      <button type="button" onClick={messen} disabled={misst} aria-busy={misst} className={cn(KNOPF_RAHMEN, 'gap-2 font-semibold disabled:opacity-60')}>
        <RotateCw className={cn('size-4', misst && 'animate-spin motion-reduce:animate-none')} strokeWidth={1.8} aria-hidden="true" />
        {misst ? texte.misst : texte.knopf}
      </button>
    </div>
  )
}
