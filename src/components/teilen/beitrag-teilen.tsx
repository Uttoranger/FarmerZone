'use client'

import { useState, useTransition } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Share2 } from 'lucide-react'
import { ladeTeilenFensterBeitragAction } from '@/server/actions/teilen-fenster'
import { TeilenFenster } from '@/components/teilen/teilen-fenster'
import { BEITRAG_TEILEN_TEXT, type TeilenFensterBeitrag } from '@/lib/teilen-fenster'
import { BEZEICHNER, befundVon, istNetzfehler } from '@/lib/upload-diagnose'

/*
 * Beitrag teilen = ein Fenster (Register T5, Nachtlauf Nr. 67): das
 * Teilen-Fenster im Beitrag-Modus, geöffnet nach dem Veröffentlichen
 * (status-new-client.tsx) und über „Teilen" je aktivem Beitrag im Reiter
 * „Beiträge" (BeitragTeilenKnopf). Die Daten lädt der Server erst auf
 * Wunsch — die Liste lädt nicht für jeden Beitrag ein Fenster vorab.
 */

/**
 * Meldet eine gescheiterte Anfrage (Aktion nach einem Deploy unbekannt,
 * Server-Fehler) mit festem Text und Fehlerklasse, nie mit Inhalten; ein
 * Netzabbruch ist nur eine Brotkrume (Vorbild meldeGescheitertesSpeichern in
 * components/mein-hof/abschnitt-speichern.ts). Wirft nie.
 */
function meldeGescheitertesLaden(fehler: unknown): void {
  try {
    const { klasse, meldung } = befundVon(fehler)
    const name = BEZEICHNER.test(klasse) ? klasse : 'Unbekannt'
    if (istNetzfehler(fehler)) {
      Sentry.addBreadcrumb({ category: 'teilen-fenster', level: 'warning', message: 'Teilen-Fenster: Verbindung abgebrochen', data: { klasse: name } })
      return
    }
    const ereignis = new Error('Teilen-Fenster: Laden gescheitert')
    ereignis.name = name
    Sentry.captureException(ereignis, { level: 'error', tags: { bereich: 'teilen-fenster', klasse: name }, extra: { fehlertext: meldung } })
  } catch {
    // Absichtlich leer: Telemetrie scheitert leise, der Satz für den Hof kommt trotzdem.
  }
}

/**
 * Die Fensterdaten eines eigenen Beitrags — wirft nie: Geworfen ginge es an
 * die Fehlergrenze, und nach dem Veröffentlichen sähe ein veröffentlichter
 * Beitrag wie gescheitert aus.
 */
export async function ladeBeitragFenster(postId: string): Promise<{ daten: TeilenFensterBeitrag } | { error: string }> {
  try {
    return await ladeTeilenFensterBeitragAction(postId)
  } catch (fehler) {
    meldeGescheitertesLaden(fehler)
    return { error: BEITRAG_TEILEN_TEXT.ladenGingNicht }
  }
}

/** „Teilen" je aktivem Beitrag im Reiter „Beiträge" — öffnet das Fenster im Beitrag-Modus. */
export function BeitragTeilenKnopf({
  beitragId,
  titel,
  className,
  onFehler,
}: {
  beitragId: string
  titel: string
  className?: string
  /** Der Satz für die Fehlerzeile der Beitragszeile; null räumt sie. */
  onFehler: (fehler: string | null) => void
}): React.JSX.Element {
  const [daten, setDaten] = useState<TeilenFensterBeitrag | null>(null)
  const [laeuft, starte] = useTransition()

  function oeffnen() {
    onFehler(null)
    starte(async () => {
      const antwort = await ladeBeitragFenster(beitragId)
      if ('error' in antwort) onFehler(antwort.error)
      else setDaten(antwort.daten)
    })
  }

  return (
    <>
      <button type="button" onClick={oeffnen} disabled={laeuft} aria-busy={laeuft || undefined} className={className}>
        <Share2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
        Teilen
        <span className="sr-only">: {titel}</span>
      </button>
      {daten && (
        <TeilenFenster
          daten={daten}
          offen
          onOffenChange={(offen) => {
            if (!offen) setDaten(null)
          }}
        />
      )}
    </>
  )
}
