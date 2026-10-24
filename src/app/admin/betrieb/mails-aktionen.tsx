'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { schickeMailJetztAction, verwirfMailAction } from '@/server/actions/betrieb'
import { istNetzfehler } from '@/lib/upload-diagnose'
import { cn } from '@/lib/utils'
import type { MailAuswahl } from '@/schemas/betrieb-mails'
import { KNOPF_ORANGE_RAHMEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

/** Die Sätze kommen vom Server (MAIL_TEXT) — die Komponente bindet keine Fachregel ein. */
export type MailKnoepfeTexte = { jetztSchicken: string; verwerfen: string; fehler: string }

/** Fremde Fehler nach Sentry: nur die Klasse unter festem Satz, ein Netzabbruch nur als Brotkrume (Muster JetztMessen). */
function meldeGescheitert(fehler: unknown): void {
  try {
    const klasse = fehler instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(fehler.name) ? fehler.name : 'Unbekannt'
    if (istNetzfehler(fehler)) {
      Sentry.addBreadcrumb({ category: 'betrieb', level: 'warning', message: 'E-Mails: Verbindung abgebrochen', data: { klasse } })
    } else {
      const ereignis = new Error('Betrieb: Aktion an einer Mail gescheitert')
      ereignis.name = klasse
      Sentry.captureException(ereignis, { level: 'error', tags: { bereich: 'betrieb', klasse } })
    }
  } catch {
    // Telemetrie scheitert leise — der Satz steht trotzdem da.
  }
}

/**
 * „Jetzt schicken“ und „Verwerfen“ für einen Auftrag oder alle einer Art in
 * „Braucht dich“ bzw. „Jetzt schicken“ in der Warnkarte (Nr. 161). Beide
 * sind heikel (Register N20): Ohne frische Bestätigung antwortet die Action
 * mit `frisch`, der Dialog fragt nach dem Passkey und die Action läuft genau
 * einmal erneut (`useFrischBestaetigt`). Danach steht ihr Satz als
 * Statuszeile da, und die Seite holt den neuen Stand (`router.refresh()`).
 */
export function MailKnoepfe({
  auswahl,
  jetzt,
  verwerfen,
  texte,
  className,
}: {
  auswahl: MailAuswahl
  /** Beschriftung von „Jetzt schicken“ — fehlt sie, gibt es den Knopf nicht (der Code erlaubt es nicht). */
  jetzt?: string
  verwerfen?: string
  texte: MailKnoepfeTexte
  className?: string
}): React.JSX.Element {
  const router = useRouter()
  const [satz, setSatz] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const schicken = useFrischBestaetigt(schickeMailJetztAction)
  const weg = useFrischBestaetigt(verwirfMailAction)

  const ausloesen = (aktion: 'jetzt' | 'verwerfen'): void => {
    starte(async () => {
      try {
        const antwort = aktion === 'jetzt' ? await schicken.ausfuehren(auswahl) : await weg.ausfuehren(auswahl)
        setSatz('error' in antwort ? antwort.error : antwort.satz)
        if (!('error' in antwort)) router.refresh()
      } catch (fehler) {
        setSatz(texte.fehler)
        meldeGescheitert(fehler)
      }
    })
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {schicken.dialog}
      {weg.dialog}
      <div className="flex flex-wrap gap-2">
        {jetzt && (
          <button type="button" onClick={() => ausloesen('jetzt')} disabled={laeuft} aria-busy={laeuft} className={cn(KNOPF_RAHMEN, 'font-semibold')}>
            {jetzt}
          </button>
        )}
        {verwerfen && (
          <button type="button" onClick={() => ausloesen('verwerfen')} disabled={laeuft} className={KNOPF_ORANGE_RAHMEN}>
            {verwerfen}
          </button>
        )}
      </div>
      <p role="status" className="text-[12.5px] leading-snug text-muted-foreground empty:sr-only">
        {satz}
      </p>
    </div>
  )
}
